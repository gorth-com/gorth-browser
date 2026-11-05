import { useCallback, useEffect, useRef, useState } from "react";
import { resetCallerAuthentication } from "@/lib/auth/client";
import type { AuthAction, AuthSnapshot } from "@/lib/auth/types";

export function useAuthController() {
  const [state, setState] = useState<AuthSnapshot>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const operation = useRef(false);
  useEffect(() => {
    let active = true;
    const accept = (value: AuthSnapshot) => {
      if (active) setState(value);
    };
    const unsubscribe = window.electronAPI.auth.onChanged(accept);
    const update = async (initial = false) => {
      try {
        let result = await window.electronAPI.auth.snapshot();
        if (initial && result.snapshot.locked && result.snapshot.configured)
          result = await window.electronAPI.auth.command("unlock");
        accept(result.snapshot);
        if (active && result.error) setError(result.error);
      } catch {
        if (active) setError("Could not read account status.");
      } finally {
        if (active) setReady(true);
      }
    };
    void update(true);
    // Snapshot never decrypts the vault or makes network requests.
    const timer = setInterval(() => void update(), 30_000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  const run = useCallback(async (action: AuthAction) => {
    if (action !== "cancel") {
      if (operation.current) return false;
      operation.current = true;
      setRunning(true);
    }
    setError("");
    if (action !== "refresh" && action !== "cancel")
      resetCallerAuthentication();
    try {
      const result = await window.electronAPI.auth.command(action);
      setState(result.snapshot);
      setError(result.error ?? "");
      return !result.error;
    } catch {
      setError("Account operation failed.");
      return false;
    } finally {
      if (action !== "cancel") {
        operation.current = false;
        setRunning(false);
      }
    }
  }, []);
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    const refreshIfNeeded = () => {
      const snapshot = current.current;
      if (
        !snapshot?.user ||
        !snapshot.user.canRefresh ||
        snapshot.locked ||
        snapshot.busy ||
        operation.current
      )
        return;
      if (
        Date.now() - (snapshot.user.verifiedAt ?? 0) >= 90_000 ||
        snapshot.user.expiresAt - Date.now() <= 30_000
      )
        void run("refresh");
    };
    // Revalidate the native app session before the 120-second freshness cutoff.
    const timer = setInterval(refreshIfNeeded, 30_000);
    const onFocus = refreshIfNeeded;
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [run]);
  const account = state?.user ?? null;
  const refresh = useCallback(async () => {
    if (!(await run("refresh"))) return null;
    try {
      const result = await window.electronAPI.auth.snapshot();
      setState(result.snapshot);
      return result.snapshot.user;
    } catch {
      setError("Không đọc được phiên Gorth sau khi làm mới.");
      return null;
    }
  }, [run]);
  return {
    state,
    error,
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
