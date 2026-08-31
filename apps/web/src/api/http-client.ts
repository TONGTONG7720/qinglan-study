export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function apiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const base = configured === undefined || configured.length === 0 ? "" : configured.replace(/\/$/u, "");
  return `${base}${path}`;
}

export async function requestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const init: RequestInit = {
    credentials: "include",
    headers: { Accept: "application/json" },
  };
  if (signal !== undefined) {
    init.signal = signal;
  }
  const response = await fetch(apiUrl(path), init);

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${String(response.status)}`);
  }

  return response.json() as Promise<unknown>;
}
