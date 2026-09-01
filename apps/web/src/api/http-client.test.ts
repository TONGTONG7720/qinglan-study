import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HttpError,
  queryWriteResult,
  RequestNetworkError,
  RequestTimeoutError,
  requestIdempotentWriteJson,
  requestJson,
  requestSessionWriteJson,
  WriteResultUnknownError,
} from "./http-client";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HTTP request coordination", () => {
  it("performs a safe read exactly once with credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("/v1/read")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("keeps HTTP status and Retry-After metadata", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("", {
      status: 429,
      headers: { "retry-after": "12" },
    })));

    const error = await requestJson("/v1/read").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 12 });
  });

  it("times out a safe read without automatically retrying", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => { reject(new DOMException("aborted", "AbortError")); }, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestJson("/v1/slow", undefined, 50);
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the timeout active while the response body is being read", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => { reject(new DOMException("aborted", "AbortError")); },
          { once: true },
        );
      }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestJson("/v1/slow-body", undefined, 50);
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("distinguishes confirmed browser offline from an online network failure", async () => {
    const online = vi.spyOn(window.navigator, "onLine", "get");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network")));

    online.mockReturnValueOnce(false);
    const offline = await requestJson("/v1/read").catch((reason: unknown) => reason);
    expect(offline).toBeInstanceOf(RequestNetworkError);
    expect(offline).toMatchObject({ offline: true });

    online.mockReturnValueOnce(true);
    const network = await requestJson("/v1/read").catch((reason: unknown) => reason);
    expect(network).toBeInstanceOf(RequestNetworkError);
    expect(network).toMatchObject({ offline: false });
  });

  it("never replays an idempotent business write when a 5xx makes the result unknown", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await requestIdempotentWriteJson("/v1/write", {
      body: { value: "safe" },
      idempotencyKey: "operation-key-0001",
      resultQueryPath: "/v1/operations/operation-0001",
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(WriteResultUnknownError);
    expect(error).toMatchObject({ reason: "SERVER", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("idempotency-key")).toBe("operation-key-0001");
  });

  it("queries an unknown write only when the caller explicitly requests the safe result", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "SUCCEEDED" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);

    const error = await requestIdempotentWriteJson("/v1/write", {
      body: { value: "safe" },
      idempotencyKey: "operation-key-0002",
      resultQueryPath: "/v1/operations/operation-0002",
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(WriteResultUnknownError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (!(error instanceof WriteResultUnknownError)) throw new Error("Expected unknown write result");

    await expect(queryWriteResult(error)).resolves.toEqual({ status: "SUCCEEDED" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/v1/operations/operation-0002");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
  });

  it("requires a stable idempotency key and operation query path before sending a business write", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => requestIdempotentWriteJson("/v1/write", {
      body: {},
      idempotencyKey: "short",
      resultQueryPath: "/v1/operations/op",
    })).toThrow(/idempotency/u);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a session write timeout as unknown and does not replay login", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => { reject(new DOMException("aborted", "AbortError")); }, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestSessionWriteJson("/v1/auth/login", {
      body: { loginId: "student", password: "not-logged" },
      resultQueryPath: "/v1/auth/me",
      timeoutMs: 50,
    });
    const errorPromise = request.catch((reason: unknown) => reason);
    await vi.advanceTimersByTimeAsync(50);
    const error = await errorPromise;
    expect(error).toBeInstanceOf(WriteResultUnknownError);
    expect(error).toMatchObject({ reason: "TIMEOUT", resultQueryPath: "/v1/auth/me" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps caller cancellation separate from timeout recovery", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => { reject(new DOMException("aborted", "AbortError")); }, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestJson("/v1/read", controller.signal, 5_000);
    controller.abort();
    const error = await request.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: "AbortError" });
    expect(error).not.toBeInstanceOf(RequestTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
