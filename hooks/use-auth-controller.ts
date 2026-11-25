import { useCallback, useEffect, useRef, useState } from "react";
import {
  useQuery,
  useQueryClient,
} from "@gorth-com/primitive/cores/tanstack/query";
import { resetCallerAuthentication } from "@/lib/auth/client";
import type { AuthAction, AuthSnapshot, AuthResult } from "@/lib/auth/types";

const snapshotKey = ["desktop", "auth", "snapshot"] as const;

export function useAuthController() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const operation = useRef(false);
  const restored = useRef(false);
  const snapshot = useQuery({
    queryKey: snapshotKey,
    queryFn: () => window.electronAPI.auth.snapshot(),
    retry: false,
    gcTime: 0,
    networkMode: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: true,
    // Polling reads local state only; it never unlocks or refreshes credentials.
    refetchInterval: () => (operation.current ? false : 30_000),
  });
  const state = snapshot.data?.snapshot;
  const ready = snapshot.isFetched;
  const accept = useCallback(
    (result: AuthResult) => {
      // A command/event is newer than any snapshot already in flight.
      void queryClient.cancelQueries({ queryKey: snapshotKey });
      queryClient.setQueryData(snapshotKey, result);
    },
    [queryClient],
  );
  useEffect(() => {
    const unsubscribe = window.electronAPI.auth.onChanged(
      (value: AuthSnapshot) => accept({ snapshot: value }),
    );
    return () => {
      unsubscribe();
    };
  }, [accept]);
  useEffect(() => {
    if (!snapshot.isFetched || restored.current) return;
    restored.current = true;
    const initial = snapshot.data;
    if (!initial || !initial.snapshot.locked || !initial.snapshot.configured)
      return;
    operation.current = true;
    setRunning(true);
    void (async () => {
      try {
        const result = await window.electronAPI.auth.command("unlock");
        accept(result);
        setError(result.error ?? "");
      } catch {
        setError("Could not read account status.");
      } finally {
        operation.current = false;
        setRunning(false);
      }
    })();
  }, [snapshot.isFetched, accept]);
  const run = useCallback(
    async (action: AuthAction) => {
      const cancelling = action === "cancel";
      if (!cancelling) {
        if (operation.current) return false;
        operation.current = true;
        setRunning(true);
      }
      setError("");
      if (action !== "refresh" && action !== "cancel")
        resetCallerAuthentication();
      try {
        const result = await window.electronAPI.auth.command(action);
        accept(result);
        setError(result.error ?? "");
        return !result.error;
      } catch {
        setError("Account operation failed.");
        return false;
      } finally {
        if (!cancelling) {
          operation.current = false;
          setRunning(false);
        }
      }
    },
    [accept],
  );
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    const refreshIfNeeded = () => {
      const value = current.current;
      const user = value?.user;
      if (
        !user?.canRefresh ||
        value?.locked ||
        value?.busy ||
        operation.current
      )
        return;
      if (
        Date.now() - (user.verifiedAt ?? 0) >= 90_000 ||
        user.expiresAt - Date.now() <= 30_000
      )
        void run("refresh");
    };
    // Credential freshness remains an explicit native-auth policy.
    const timer = setInterval(refreshIfNeeded, 30_000);
    window.addEventListener("focus", refreshIfNeeded);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfNeeded);
    };
  }, [run]);
  const account = state?.user ?? null;
  const refresh = useCallback(async () => {
    if (!(await run("refresh"))) return null;
    return (
      queryClient.getQueryData<AuthResult>(snapshotKey)?.snapshot.user ?? null
    );
  }, [run, queryClient]);
  return {
    state,
    error:
      error ||
      snapshot.data?.error ||
      (snapshot.error ? "Could not read account status." : ""),
    busy: running || !!state?.busy,
    run,
    ready,
    account,
    username: account?.username ?? null,
    authenticated: !!account && !account.needsLogin,
    loading: !ready,
    locked: !!state?.locked,
    login: () => run("login"),
    register: () => run("register"),
    logout: () => run("logout"),
    unlock: () => run("unlock"),
    cancel: () => run("cancel"),
    refresh,
  };
}
