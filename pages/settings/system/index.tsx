import { useState, type ReactNode } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import {
  Settings,
  MemoryStick,
  Battery,
  ChevronRight,
  ExternalLink,
  Trash2,
  Plus,
} from "@gorth-io/primitive/cores/lucide";
import { PageShell, type SpecialPageProps } from "@/pages/shared";
import { PageHeading } from "@/components/heading";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { Switch } from "@gorth-io/primitive/default/switch";
import { Input } from "@gorth-io/primitive/default/input";
import { Separator } from "@gorth-io/primitive/default/separator";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import { Button } from "@gorth-io/primitive/custom/button";
import { ErrorFeedback } from "@/components/element/error-feedback";
import { useSystemSettings } from "@/hooks/use-system-settings";
import {
  memoryModes,
  normalizeActiveSite,
  type SystemPreferences,
} from "@/lib/browser/system";
import { toast } from "@/providers/toaster";

function SettingRow({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <CardTitle id={id}>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {children}
    </div>
  );
}
export function SettingsSectionPage(
  props: Pick<
    SpecialPageProps,
    | "flags"
    | "onFlagsChange"
    | "sleepAfterMinutes"
    | "archiveAfterDays"
    | "onSleepAfterMinutesChange"
    | "onArchiveAfterDaysChange"
    | "onOpenInternal"
  >,
) {
  const system = useSystemSettings();
  const [adding, setAdding] = useState(false);
  const preferences = system.data?.preferences;
  const siteForm = useForm({
    defaultValues: { site: "" },
    onSubmit: async ({ value }) => {
      if (!preferences || system.saving) return;
      try {
        const site = normalizeActiveSite(value.site.trim());
        await window.electronAPI.system.update({
          ...preferences,
          activeSites: [...new Set([...preferences.activeSites, site])],
        });
        siteForm.reset();
        setAdding(false);
      } catch (error) {
        toast.add({
          title:
            error instanceof Error ? error.message : "Could not add website.",
          type: "error",
        });
      }
    },
  });
  function toggle(
    key: keyof Pick<
      SystemPreferences,
      | "hardwareAcceleration"
      | "closeLastTab"
      | "warnMultipleTabs"
      | "warnQuit"
      | "fullscreenReminder"
      | "energySaver"
    >,
    title: string,
    description?: string,
  ) {
    return (
      <SettingRow id={`system-${key}`} title={title} description={description}>
        <Switch
          aria-labelledby={`system-${key}`}
          checked={preferences?.[key] ?? false}
          disabled={!preferences || system.saving}
          onCheckedChange={(value) =>
            preferences && system.update({ ...preferences, [key]: value })
          }
        />
      </SettingRow>
    );
  }
  const runProxy = () => {
    void window.electronAPI.system
      .openProxySettings()
      .catch((error: unknown) =>
        toast.add({
          title:
            error instanceof Error
              ? error.message
              : "Could not open proxy settings.",
          type: "error",
        }),
      );
  };
  const mode =
    memoryModes.find((item) => item.minutes === props.sleepAfterMinutes)
      ?.value ?? "";
  return (
    <PageShell icon={Settings} title="System">
      <ErrorFeedback
        message={system.error ? "Could not load System settings." : null}
      />
      <Card className="gap-0 overflow-hidden py-0">
        <SettingRow title="Shortcuts">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open shortcuts"
            onClick={() => props.onOpenInternal("settings/shortcuts")}
          >
            <ChevronRight />
          </Button>
        </SettingRow>
        <Separator />
        {toggle(
          "hardwareAcceleration",
          "Use graphics acceleration when available",
          system.data?.restartRequired
            ? "Restart Gorth Browser to apply this change."
            : undefined,
        )}
        <Separator />
        <SettingRow title="Open your computer's proxy settings">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open your computer's proxy settings"
            onClick={runProxy}
          >
            <ExternalLink />
          </Button>
        </SettingRow>
        <Separator />
        {toggle("closeLastTab", "Close window when closing last tab")}
        <Separator />
        {toggle(
          "warnMultipleTabs",
          "Warn me before closing a window with multiple tabs",
        )}
        <Separator />
        {toggle(
          "warnQuit",
          `Show warning before quitting${window.electronAPI.windowState.isMacOS ? " with ⌘Q" : " Gorth Browser"}`,
        )}
        <Separator />
        {toggle(
          "fullscreenReminder",
          "Show full screen reminder to press Esc on exit",
        )}
        <Separator />
        <SettingRow
          title="Smooth scrolling"
          description="Changes apply after a full browser restart."
        >
          <Switch
            aria-label="Smooth scrolling"
            checked={props.flags.smoothScrolling}
            onCheckedChange={(value) =>
              props.onFlagsChange({ ...props.flags, smoothScrolling: value })
            }
          />
        </SettingRow>
      </Card>

      <section className="flex flex-col gap-6">
        <PageHeading icon={MemoryStick} title="Memory" />
        <Card className="gap-0 overflow-hidden py-0">
          <SettingRow
            title="Always keep these sites active"
            description="Sites you add will stay active and won't be automatically unloaded or archived."
          >
            <Button
              variant="outline"
              disabled={!preferences || system.saving}
              onClick={() => setAdding(!adding)}
            >
              <Plus />
              Add
            </Button>
          </SettingRow>
          {adding && (
            <form
              className="flex flex-wrap items-center gap-2 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void siteForm.handleSubmit();
              }}
            >
              <siteForm.Field name="site">
                {(field) => (
                  <Input
                    autoFocus
                    aria-label="Website hostname"
                    placeholder="example.com"
                    className="min-w-0 flex-1"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </siteForm.Field>
              <siteForm.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={submitting || system.saving}>
                    Save
                  </Button>
                )}
              </siteForm.Subscribe>
              <Button
                variant="outline"
                type="button"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </form>
          )}
          {preferences?.activeSites.length ? (
            preferences.activeSites.map((site) => (
              <div
                key={site}
                className="flex items-center justify-between gap-4 p-4"
              >
                <span className="min-w-0 truncate text-sm">{site}</span>
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label={`Remove ${site}`}
                  disabled={system.saving}
                  onClick={() =>
                    system.update({
                      ...preferences,
                      activeSites: preferences.activeSites.filter(
                        (value) => value !== site,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          ) : (
            <div className="p-4">
              <CardDescription>
                {system.isPending ? "Loading sites…" : "No sites added"}
              </CardDescription>
            </div>
          )}
          <Separator />
          <SettingRow
            id="memory-saver-label"
            title="Memory Saver"
            description="Free up memory from inactive tabs. Tabs become active again when you return to them. Active, pinned, grouped, media, download and edited-form tabs are protected."
          >
            <Switch
              aria-labelledby="memory-saver-label"
              checked={props.flags.memorySaver}
              onCheckedChange={(value) =>
                props.onFlagsChange({ ...props.flags, memorySaver: value })
              }
            />
          </SettingRow>
          <RadioGroup
            aria-label="Memory Saver mode"
            value={mode}
            disabled={!props.flags.memorySaver}
            className="flex flex-col gap-4 p-4"
            onValueChange={(value) => {
              const selected = memoryModes.find((item) => item.value === value);
              if (selected) props.onSleepAfterMinutesChange(selected.minutes);
            }}
          >
            {memoryModes.map((item) => (
              <label
                key={item.value}
                className="flex cursor-pointer items-center gap-4"
              >
                <RadioGroupItem value={item.value} />
                <div className="flex flex-col gap-1">
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </label>
            ))}
          </RadioGroup>
          {!mode && (
            <div className="p-4">
              <CardDescription>
                Custom inactivity timeout: {props.sleepAfterMinutes} minutes.
                Select a mode to replace it.
              </CardDescription>
            </div>
          )}
          <Separator />
          <SettingRow
            title="Archive after inactivity (days)"
            description="0 disables automatic archiving. Archived tabs can be restored later."
          >
            <Input
              aria-label="Archive after inactivity (days)"
              type="number"
              min={0}
              max={365}
              className="w-24"
              value={props.archiveAfterDays}
              onChange={(event) =>
                props.onArchiveAfterDaysChange(
                  Math.min(365, Math.max(0, Number(event.target.value) || 0)),
                )
              }
            />
          </SettingRow>
          <div className="p-4">
            <Button
              variant="outline"
              onClick={() => props.onOpenInternal("archive")}
            >
              View archived tabs
            </Button>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-6">
        <PageHeading icon={Battery} title="Power" />
        <Card className="gap-0 overflow-hidden py-0">
          {toggle(
            "energySaver",
            "Energy Saver",
            "Save battery by unloading safe inactive tabs after at most 5 minutes and reducing browser animations. Active media is not throttled.",
          )}
          <RadioGroup
            aria-label="Energy Saver mode"
            value={preferences?.energyMode ?? "low-battery"}
            disabled={!preferences?.energySaver || system.saving}
            className="flex flex-col gap-4 p-4"
            onValueChange={(value) =>
              preferences &&
              (value === "low-battery" || value === "unplugged") &&
              system.update({ ...preferences, energyMode: value })
            }
          >
            <label className="flex cursor-pointer items-center gap-4">
              <RadioGroupItem value="low-battery" />
              <CardTitle>
                Turn on only when your battery is at 20% or lower
              </CardTitle>
            </label>
            <label className="flex cursor-pointer items-center gap-4">
              <RadioGroupItem value="unplugged" />
              <CardTitle>Turn on when your computer is unplugged</CardTitle>
            </label>
          </RadioGroup>
          <div className="p-4" aria-live="polite">
            <CardDescription>
              {system.data?.energyActive
                ? "Energy Saver is active."
                : "Energy Saver is inactive."}
              {system.data?.battery.percent != null
                ? ` Battery: ${system.data.battery.percent}%.`
                : " Battery percentage is unavailable on this device."}
              {system.data?.battery.onBattery === false
                ? " Connected to power or no battery detected."
                : ""}
              {system.data?.battery.onBattery === null
                ? " Power source could not be detected; automatic Energy Saver will stay inactive."
                : ""}
            </CardDescription>
          </div>
        </Card>
      </section>
    </PageShell>
  );
}
