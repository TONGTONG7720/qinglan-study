import { CurrentUserSchema, LoginInputSchema } from "@study/contracts";
import type { CurrentUser, LoginInput } from "@study/contracts";

import {
  HttpError,
  isAbortError,
  isRecoverableReadError,
  requestJson,
  requestSessionWriteJson,
} from "./http-client";

export type CurrentUserResult =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

export interface CurrentUserLoadOptions {
  readonly propagateRecoveryErrors?: boolean;
}

export async function loadCurrentUser(
  signal?: AbortSignal,
  options: CurrentUserLoadOptions = {},
): Promise<CurrentUserResult> {
  try {
    const payload = await requestJson("/v1/auth/me", signal);
    return { status: "authenticated", user: CurrentUserSchema.parse(payload) };
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    if (error instanceof HttpError && error.status === 401) {
      return { status: "anonymous" };
    }
    if (options.propagateRecoveryErrors === true && isRecoverableReadError(error)) throw error;
    return { status: "unavailable" };
  }
}

export async function login(input: LoginInput, signal?: AbortSignal): Promise<CurrentUser> {
  const parsed = LoginInputSchema.parse(input);
  const payload = await requestSessionWriteJson("/v1/auth/login", {
    body: parsed,
    resultQueryPath: "/v1/auth/me",
    signal,
  });
  if (typeof payload !== "object" || payload === null || !("user" in payload)) {
    throw new Error("Invalid login response");
  }
  return CurrentUserSchema.parse(payload.user);
}
