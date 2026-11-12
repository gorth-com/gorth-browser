import { useEffect, useState } from "react";
import { RefreshCw } from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Switch } from "@gorth-io/primitive/default/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@gorth-io/primitive/default/card";
import { Separator } from "@gorth-io/primitive/default/separator";
import { PageShell } from "@/pages/shared";
import { syncKinds, type SyncOptions } from "@/lib/browser/sync";
import { toast } from "@/providers/toaster";
interface Backup { id: string; name: string; deviceName: string; createdAt: string }
const showError = (error: unknown) => toast.add({ title: error instanceof Error ? error.message : "Sync failed.", type: "error" });
export function SettingsSectionPage() {
  const [state, setState] = useState<Awaited<ReturnType<typeof window.electronAPI.sync.status>> | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const status = await window.electronAPI.sync.status(); setState(status);
    if (status.authenticated) setBackups(((await window.electronAPI.sync.backups("list")) as { items: Backup[] }).items);
    else setBackups([]);
  };
  useEffect(() => {
    void refresh().catch(showError);
    const unsubscribe = window.electronAPI.auth.onChanged(() => { void refresh().catch(showError); });
    const timer = setInterval(() => { void window.electronAPI.sync.status().then(setState).catch(showError); }, 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    try { await action(); await refresh(); } catch (error) { showError(error); } finally { setBusy(false); }
  }
  const configure = (options: SyncOptions) => perform(() => window.electronAPI.sync.configure(options));
  return <PageShell icon={RefreshCw} title="Sync"><div className="flex flex-col gap-6">
    <Card><CardHeader><CardTitle>Cloud sync</CardTitle><CardDescription>Use the same Gorth account on each device. Newer edits win; deletions sync too. Cookies, passwords and history stay on this device.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4"><span>Automatic sync</span><Switch aria-label="Automatic sync" checked={state?.options.enabled ?? false} disabled={!state?.authenticated || busy || state.busy} onCheckedChange={(enabled) => { if (state) void configure({ ...state.options, enabled }); }} /></div><Separator />
        {syncKinds.map((kind) => <div key={kind} className="flex items-center justify-between gap-4"><span className="capitalize">{kind === "preferences" ? "Appearance" : kind}</span><Switch aria-label={`Sync ${kind}`} checked={state?.options.kinds.includes(kind) ?? false} disabled={!state?.authenticated || busy || state.busy} onCheckedChange={(checked) => {
          if (!state) return;
          const kinds = new Set(state.options.kinds);
          if (checked) { kinds.add(kind); if (kind === "groups" || kind === "workspaces") kinds.add("tabs"); if (kind === "workspaces") kinds.add("groups"); }
          else { kinds.delete(kind); if (kind === "tabs") { kinds.delete("groups"); kinds.delete("workspaces"); } if (kind === "groups") kinds.delete("workspaces"); }
          void configure({ ...state.options, kinds: [...kinds] });
        }} /></div>)}<Separator />
        <p className="text-sm text-muted-foreground">{!state?.authenticated ? "Sign in under Gorth profile to enable sync." : state.lastSync ? `Last synced: ${new Date(state.lastSync).toLocaleString()}` : "Not synced yet."}</p>
        <p className="text-sm text-muted-foreground">Workspaces are retained for backup/restore; this version does not yet offer a workspace editor.</p>
        {state?.error ? <Button variant="outline" onClick={() => showError(new Error(state.error!))}>View last sync error</Button> : null}
        <Button disabled={!state?.authenticated || !state.options.enabled || busy || state.busy} onClick={() => void perform(() => window.electronAPI.sync.now())}>Sync now</Button>
      </CardContent></Card>
    <Card><CardHeader><CardTitle>Cloud backups</CardTitle><CardDescription>Restore merges selected categories and saves a safety backup first. Up to 50 backups per account.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4"><Button disabled={!state?.authenticated || busy || state.busy} onClick={() => void perform(() => window.electronAPI.sync.backups("save"))}>Create backup</Button>
        {backups.map((backup) => <div key={backup.id} className="flex flex-wrap items-center justify-between gap-2"><div><p>{backup.name}</p><p className="text-sm text-muted-foreground">{backup.deviceName} · {new Date(backup.createdAt).toLocaleString()}</p></div><div className="flex gap-2">
          <Button variant="outline" disabled={busy || state?.busy} onClick={() => void perform(() => window.electronAPI.sync.backups("restore", backup.id))}>Restore</Button>
          <Button variant="outline" disabled={busy || state?.busy} onClick={() => void perform(() => window.electronAPI.sync.backups("delete", backup.id))}>Delete</Button>
        </div></div>)}
      </CardContent></Card>
  </div></PageShell>;
}
