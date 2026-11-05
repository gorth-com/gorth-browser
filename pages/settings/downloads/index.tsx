import { ErrorFeedback } from "@/components/element/error-feedback";
import { useEffect, useState } from "react";
import { Download, FolderOpen } from "@gorth-io/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-io/primitive/default/card";
import { Button } from "@gorth-io/primitive/custom/button";
import { Switch } from "@gorth-io/primitive/default/switch";
import type { DownloadPreferences } from "@/lib/browser/downloads";
export function SettingsSectionPage() {
  const [preferences, setPreferences] = useState<DownloadPreferences | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void window.electronAPI.downloads
      .preferences()
      .then((value) => {
        if (!cancelled) setPreferences(value);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load download preferences.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const update = async (action: () => Promise<DownloadPreferences>) => {
    setBusy(true);
    setError("");
    try {
      setPreferences(await action());
    } catch {
      setError("Unable to update download preferences.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageShell icon={Download} title="Downloads">
      <Card>
        <CardHeader>
          <CardTitle>Download location</CardTitle>
          <CardDescription>
            Choose where files are saved. Automatic downloads never overwrite
            existing files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <ErrorFeedback message={error} />}
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 break-all text-sm text-muted-foreground">
              {preferences?.directory ?? "Loading…"}
            </p>
            <Button
              className="h-9"
              variant="outline"
              disabled={busy || !preferences}
              onClick={() =>
                void update(() =>
                  window.electronAPI.downloads.chooseDirectory(),
                )
              }
            >
              <FolderOpen className="size-4" />
              Change
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id="ask-download-location" className="text-sm font-medium">
                Ask where to save each file
              </p>
              <p className="text-xs text-muted-foreground">
                Show the native Save dialog before downloading.
              </p>
            </div>
            <Switch
              aria-labelledby="ask-download-location"
              checked={preferences?.askWhereToSave ?? true}
              disabled={busy || !preferences}
              onCheckedChange={(ask) =>
                void update(() =>
                  window.electronAPI.downloads.setAskWhereToSave(ask),
                )
              }
            />
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
