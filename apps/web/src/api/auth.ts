import { CurrentUserSchema, LoginInputSchema } from "@study/contracts";
import type { CurrentUser, LoginInput } from "@study/contracts";

import { HttpError, apiUrl, requestJson } from "./http-client";

export type CurrentUserResult =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

export async function loadCurrentUser(signal?: AbortSignal): Promise<CurrentUserResult> {
  try {
    const payload = await requestJson("/v1/auth/me", signal);
    return { status: "authenticated", user: CurrentUserSchema.parse(payload) };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (error instanceof HttpError && error.status === 401) {
      return { status: "anonymous" };
    }
    return { status: "unavailable" };
  }
}

export async function login(input: LoginInput, signal?: AbortSignal): Promise<CurrentUser> {
  const parsed = LoginInputSchema.parse(input);
  const init: RequestInit = {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
    },
    body: JSON.stringify(parsed),
  };
  if (signal !== undefined) init.signal = signal;
  const response = await fetch(apiUrl("/v1/auth/login"), init);
  if (!response.ok) {
    throw new HttpError(response.status, "Login failed");
  }
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("user" in payload)) {
    throw new Error("Invalid login response");
  }
  return CurrentUserSchema.parse(payload.user);
}
