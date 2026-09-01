const defaultReadTimeoutMs = 10_000;
const defaultWriteTimeoutMs = 15_000;

export class HttpError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Safe read timed out after ${String(timeoutMs)} ms`);
    this.name = "RequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class RequestNetworkError extends Error {
  readonly offline: boolean;

  constructor(offline: boolean) {
    super(offline ? "Browser is offline" : "Network request failed");
    this.name = "RequestNetworkError";
    this.offline = offline;
  }
}

export type WriteResultUnknownReason = "TIMEOUT" | "OFFLINE" | "NETWORK" | "SERVER" | "INVALID_RESPONSE";

export class WriteResultUnknownError extends Error {
  readonly reason: WriteResultUnknownReason;
  readonly resultQueryPath: string;
  readonly status: number | null;

  constructor(
    reason: WriteResultUnknownReason,
    resultQueryPath: string,
    status: number | null = null,
  ) {
    super("Write result is unknown; query the safe result endpoint instead of replaying the write");
    this.name = "WriteResultUnknownError";
    this.reason = reason;
    this.resultQueryPath = resultQueryPath;
    this.status = status;
  }
}

interface RequestLifecycle {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
  readonly callerAborted: () => boolean;
  readonly timedOut: () => boolean;
}

interface JsonRequestOptions {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs: number;
  readonly writeResultQueryPath?: string;
}

export interface SessionWriteOptions {
  readonly body: unknown;
  readonly resultQueryPath: string;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number;
}

export interface IdempotentWriteOptions extends SessionWriteOptions {
  readonly idempotencyKey: string;
}

function abortError(): DOMException {
  return new DOMException("Request aborted", "AbortError");
}

function createRequestLifecycle(callerSignal: AbortSignal | undefined, timeoutMs: number): RequestLifecycle {
  const controller = new AbortController();
  let didTimeOut = false;
  const onCallerAbort = () => { controller.abort(); };
  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  }
  const timeout = window.setTimeout(() => {
    didTimeOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    callerAborted: () => callerSignal?.aborted ?? false,
    timedOut: () => didTimeOut,
    cleanup: () => {
      window.clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    },
  };
}

function browserIsOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function retryAfterSeconds(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (value === null || !/^\d+$/u.test(value)) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function writeUnknown(
  reason: WriteResultUnknownReason,
  options: JsonRequestOptions,
  status: number | null = null,
): WriteResultUnknownError {
  const path = options.writeResultQueryPath;
  if (path === undefined) throw new Error("Write requests require a safe result query path");
  return new WriteResultUnknownError(reason, path, status);
}

function throwRequestTransportError(
  error: unknown,
  lifecycle: RequestLifecycle,
  options: JsonRequestOptions,
): never {
  if (lifecycle.callerAborted()) throw abortError();
  if (lifecycle.timedOut()) {
    if (options.writeResultQueryPath !== undefined) throw writeUnknown("TIMEOUT", options);
    throw new RequestTimeoutError(options.timeoutMs);
  }
  const offline = browserIsOffline();
  if (options.writeResultQueryPath !== undefined) {
    throw writeUnknown(offline ? "OFFLINE" : "NETWORK", options);
  }
  if (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) {
    throw new RequestNetworkError(offline);
  }
  throw error;
}

async function performJsonRequest(path: string, options: JsonRequestOptions): Promise<unknown> {
  const lifecycle = createRequestLifecycle(options.signal, options.timeoutMs);
  const init: RequestInit = {
    method: options.method,
    credentials: "include",
    headers: options.headers,
    signal: lifecycle.signal,
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  try {
    let response: Response;
    try {
      response = await fetch(apiUrl(path), init);
    } catch (error: unknown) {
      throwRequestTransportError(error, lifecycle, options);
    }

    if (!response.ok) {
      if (options.writeResultQueryPath !== undefined && response.status >= 500) {
        throw writeUnknown("SERVER", options, response.status);
      }
      throw new HttpError(
        response.status,
        `Request failed with status ${String(response.status)}`,
        retryAfterSeconds(response),
      );
    }
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    try {
      return await response.json() as unknown;
    } catch (error: unknown) {
      if (lifecycle.callerAborted() || lifecycle.timedOut() || error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) {
        throwRequestTransportError(error, lifecycle, options);
      }
      if (options.writeResultQueryPath !== undefined) throw writeUnknown("INVALID_RESPONSE", options);
      throw error;
    }
  } finally {
    lifecycle.cleanup();
  }
}

export function apiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const base = configured === undefined || configured.length === 0 ? "" : configured.replace(/\/$/u, "");
  return `${base}${path}`;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isRecoverableReadError(error: unknown): boolean {
  return error instanceof RequestTimeoutError
    || error instanceof RequestNetworkError
    || (error instanceof HttpError && (error.status === 401 || error.status === 429 || error.status >= 500));
}

export function requestJson(
  path: string,
  signal?: AbortSignal,
  timeoutMs: number = defaultReadTimeoutMs,
): Promise<unknown> {
  return performJsonRequest(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    timeoutMs,
  });
}

export function requestSessionWriteJson(path: string, options: SessionWriteOptions): Promise<unknown> {
  return performJsonRequest(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
    },
    body: options.body,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? defaultWriteTimeoutMs,
    writeResultQueryPath: options.resultQueryPath,
  });
}

export function requestIdempotentWriteJson(path: string, options: IdempotentWriteOptions): Promise<unknown> {
  if (!/^[A-Za-z0-9._:-]{16,160}$/u.test(options.idempotencyKey)) {
    throw new Error("A stable 16-160 character idempotency key is required");
  }
  if (!/^\/v1\/operations\/[A-Za-z0-9-]{1,160}$/u.test(options.resultQueryPath)) {
    throw new Error("Business writes require an operation status query path");
  }
  return performJsonRequest(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
      "idempotency-key": options.idempotencyKey,
    },
    body: options.body,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? defaultWriteTimeoutMs,
    writeResultQueryPath: options.resultQueryPath,
  });
}

export function queryWriteResult(
  error: WriteResultUnknownError,
  signal?: AbortSignal,
): Promise<unknown> {
  return requestJson(error.resultQueryPath, signal);
}
