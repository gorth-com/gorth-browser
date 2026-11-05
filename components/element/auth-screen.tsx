import { ErrorFeedback } from "@/components/element/error-feedback";
import { useEffect, useRef, useState } from "react";
import { Button } from "@gorth-io/primitive/custom/button";
import { useAuth } from "@/hooks/use-auth";
import type { AuthViewState } from "@/lib/auth/view-types";

export function AuthScreen({ onReturn }: { onReturn: () => void }) {
  const auth = useAuth();
  const [view, setView] = useState<AuthViewState | null>(null);
  const returnToProfile = useRef(onReturn);
  useEffect(() => {
    returnToProfile.current = onReturn;
  }, [onReturn]);
  useEffect(() => {
    let active = true;
    let notified = false;
    const unsubscribe = window.electronAPI.auth.onViewChanged((state) => {
      notified = true;
      if (active) setView(state);
    });
    async function readState() {
      try {
        const state = await window.electronAPI.auth.viewState();
        if (active && !notified) setView(state);
      } catch {
        /* The account command exposes any main-process error. */
      }
    }
    void readState();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const completed = !!view?.completed && auth.authenticated && !auth.error;
  useEffect(() => {
    if (!completed) return;
    const timer = window.setTimeout(() => returnToProfile.current(), 500);
    return () => window.clearTimeout(timer);
  }, [completed]);

  return (
    <section
      aria-label="Xác thực Gorth"
      className={
        "flex h-full flex-col items-center justify-center gap-4 bg-background p-8"
      }
    >
      <h1 className="text-xl font-semibold">
        {completed ? "Đăng nhập thành công" : "Đăng nhập Gorth"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {view?.visible
          ? "Chọn tài khoản trong trình duyệt vừa mở. Phiên SSO của bạn được giữ nguyên."
          : "Đăng nhập bằng tài khoản Gorth SSO."}
      </p>
      {auth.error && <ErrorFeedback message={auth.error} />}
      {view?.visible ? (
        <Button
          className="h-9"
          onClick={async () => {
            await auth.cancel();
            onReturn();
          }}
        >
          Hủy đăng nhập
        </Button>
      ) : (
        <Button className="h-9" onClick={onReturn}>
          Quay lại hồ sơ
        </Button>
      )}
    </section>
  );
}
