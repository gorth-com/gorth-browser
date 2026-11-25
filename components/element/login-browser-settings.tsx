import { ErrorFeedback } from "@/components/element/error-feedback";
import { useState } from "react";
import { Button } from "@gorth-com/primitive/custom/button";
import { useAuth } from "@/hooks/use-auth";

export function LoginBrowserSettings() {
  const auth = useAuth();
  const selected = auth.state?.loginBrowser ?? "default";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function select(browser: "default" | "gorth") {
    setSaving(true);
    setError("");
    try {
      const result = await window.electronAPI.auth.setLoginBrowser(browser);
      if (result.error) setError(result.error);
    } catch {
      setError("Không thể lưu trình duyệt đăng nhập.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border bg-card p-6"
      aria-label="Trình duyệt đăng nhập"
    >
      <h2 className="text-sm font-semibold">Trình duyệt đăng nhập</h2>
      <p className="text-xs text-muted-foreground">
        Chọn nơi mở trang đăng nhập Gorth. Không thay đổi trình duyệt mặc định
        của hệ điều hành.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "default", label: "Default browser" },
            { value: "gorth", label: "Gorth Browser" },
          ] as const
        ).map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            variant={selected === value ? "default" : "outline"}
            aria-pressed={selected === value}
            disabled={saving || auth.busy}
            onClick={() => void select(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Gorth Browser cần được cài và đăng ký deep link; khi chạy dev cần khởi
        động Browser trước. Nếu không mở được, chọn Default browser để thử lại.
      </p>
      {error && <ErrorFeedback message={error} />}
    </section>
  );
}
