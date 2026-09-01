import { createContext, createElement, type ReactNode, useContext } from "react";

import { resolveReleaseScope, type ReleaseScope } from "./release-scope-policy";

export const runtimeReleaseScope = resolveReleaseScope(
  import.meta.env.MODE,
  import.meta.env.VITE_RELEASE_SCOPE,
);

const ReleaseScopeContext = createContext<ReleaseScope>(runtimeReleaseScope);

export function ReleaseScopeProvider({
  children,
  scope,
}: {
  readonly children: ReactNode;
  readonly scope: ReleaseScope;
}) {
  return createElement(ReleaseScopeContext.Provider, { value: scope }, children);
}

export function useReleaseScope(): ReleaseScope {
  return useContext(ReleaseScopeContext);
}
