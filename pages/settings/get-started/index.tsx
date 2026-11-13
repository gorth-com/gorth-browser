import { Separator } from "@gorth-io/primitive/default/separator";
import { useEffect, useRef, useState } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import { useQuery } from "@gorth-io/primitive/cores/tanstack/query";
import {
  ChevronRight,
  Download,
  Upload,
  ExternalLink,
  Globe2,
  UserRound,
  Rocket,
  Star,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { Textarea } from "@gorth-io/primitive/default/textarea";
import {
  RadioGroup,
  RadioGroupItem,
} from "@gorth-io/primitive/default/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@gorth-io/primitive/custom/select";
import { PageHeading } from "@/components/heading";
import { Wrapper } from "@/layouts/wrapper";
import { useAuth } from "@/hooks/use-auth";
import { useBrowserSetup } from "@/hooks/use-browser-setup";
import { toast } from "@/providers/toaster";
import type { SpecialPageProps } from "@/pages/shared";
import {
  setupPreferencesSchema,
  type SetupPreferences,
} from "@/lib/browser/setup";

const newTabItems = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Blank page", value: "blank" },
];
const profileIcons = {
  globe: Globe2,
  user: UserRound,
  rocket: Rocket,
  star: Star,
};

export function SettingsSectionPage({
  onNavigate,
  onOpenInternal,
}: Pick<SpecialPageProps, "onNavigate" | "onOpenInternal">) {
  const auth = useAuth();
  const setup = useBrowserSetup();
  const defaultBrowser = useQuery({
    queryKey: ["browser-default"],
    queryFn: () => window.electronAPI.setup.isDefaultBrowser(),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [showStartupPages, setShowStartupPages] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const error =
      auth.error || setup.error?.message || defaultBrowser.error?.message;
    if (error)
      toast.add({
        title: "Unable to complete setup",
        id: "browser-get-started",
        description: error,
        type: "error",
      });
  }, [auth.error, setup.error, defaultBrowser.error]);
  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.add({
        id: "browser-get-started",
        title: message,
        description: undefined,
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: "Action failed",
        id: "browser-get-started",
        description:
          error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }
  async function save(changes: Partial<SetupPreferences>) {
    if (!setup.data) throw new Error("Browser preferences are not loaded yet.");
    const preferences = setupPreferencesSchema.parse({
      ...setup.data,
      ...changes,
    });
    setup.accept(await window.electronAPI.setup.save(preferences));
  }
  const startupForm = useForm({
    defaultValues: { urls: "" },
    onSubmit: async ({ value }) => {
      await perform(
        () =>
          save({
            startup: "pages",
            startupPages: value.urls
              .split(/\r?\n/)
              .map((url) => url.trim())
              .filter(Boolean),
          }),
        "Startup pages saved",
      );
    },
  });
  useEffect(() => {
    if (setup.data)
      startupForm.setFieldValue("urls", setup.data.startupPages.join("\n"));
  }, [setup.data?.startupPages, startupForm]);
  const Icon = profileIcons[setup.data?.profileIcon ?? "user"];
  const disabled = busy || !setup.data;
  async function account(
    action: Parameters<typeof auth.run>[0],
    message: string,
  ) {
    if (await auth.run(action))
      toast.add({
        id: "browser-get-started",
        title: message,
        description: undefined,
        type: "success",
      });
  }
  return (
    <Wrapper>
      <div className="flex flex-col gap-6">
        <PageHeading icon={Rocket} title="General" />
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center gap-4 p-4">
            <Icon className="size-6 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle>
                {auth.account
                  ? "Gorth Account"
                  : "Log in or create a Gorth account"}
              </CardTitle>
              <CardDescription>
                {auth.account?.email ??
                  "One secure identity for all your Gorth apps."}
              </CardDescription>
            </div>
            <Button
              disabled={auth.busy || !auth.state?.configured}
              onClick={() => void account("login", "Signed in to Gorth")}
            >
              {auth.account ? "Switch account" : "Get started"}
            </Button>
            {!auth.account && (
              <Button
                variant="outline"
                disabled={auth.busy || !auth.state?.configured}
                onClick={() =>
                  void account("register", "Gorth account connected")
                }
              >
                Create account
              </Button>
            )}
            {auth.account && (
              <Button
                variant="outline"
                disabled={auth.busy}
                onClick={() => void account("logout", "Signed out of this app")}
              >
                Sign out
              </Button>
            )}
            {auth.locked && (
              <Button
                variant="outline"
                disabled={auth.busy}
                onClick={() => void account("unlock", "Session unlocked")}
              >
                Unlock session
              </Button>
            )}
            {auth.busy && (
              <Button variant="outline" onClick={() => void auth.run("cancel")}>
                Cancel
              </Button>
            )}
          </div>
          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <CardTitle>Sign-in browser</CardTitle>
              <div className="flex gap-2">
                {(["default", "gorth"] as const).map((browser) => (
                  <Button
                    key={browser}
                    variant={
                      auth.state?.loginBrowser === browser
                        ? "default"
                        : "outline"
                    }
                    disabled={busy || auth.busy}
                    onClick={() =>
                      void perform(async () => {
                        const result =
                          await window.electronAPI.auth.setLoginBrowser(
                            browser,
                          );
                        if (result.error) throw new Error(result.error);
                      }, "Sign-in browser saved")
                    }
                  >
                    {browser === "default"
                      ? "Default browser"
                      : "Gorth Browser"}
                  </Button>
                ))}
              </div>
            </div>
          </>
          <>
            <Separator />
            <div className="flex items-center justify-between gap-4 p-4">
              <CardTitle>Profile name and icon</CardTitle>
              <Button
                variant="default"
                disabled={disabled}
                onClick={() => onOpenInternal("settings/profile")}
              >
                {setup.data?.profileName}
                <ChevronRight />
              </Button>
            </div>
          </>

          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <CardTitle>Import bookmarks and settings</CardTitle>
                <CardDescription>
                  Import bookmarks HTML or an exported Gorth setup JSON.
                  Passwords, cookies and settings from other browsers are not
                  imported.
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => file.current?.click()}
                >
                  <Download />
                  Import
                </Button>
                <input
                  ref={file}
                  type="file"
                  accept=".html,.htm,.json,text/html,application/json"
                  className="hidden"
                  aria-label="Import bookmarks HTML or Gorth setup JSON"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    event.target.value = "";
                    if (!selected) return;
                    void perform(async () => {
                      if (selected.size > 5 * 1024 * 1024)
                        throw new Error(
                          "Choose a bookmarks HTML file smaller than 5 MB.",
                        );
                      const text = await selected.text();
                      if (selected.name.toLowerCase().endsWith(".json")) {
                        const data: unknown = JSON.parse(text);
                        if (
                          !data ||
                          typeof data !== "object" ||
                          !("format" in data) ||
                          data.format !== "gorth-browser-setup" ||
                          !("preferences" in data)
                        )
                          throw new Error(
                            "Choose an exported Gorth setup JSON file.",
                          );
                        const preferences = setupPreferencesSchema.parse(
                          data.preferences,
                        );
                        setup.accept(
                          await window.electronAPI.setup.save(preferences),
                        );
                        return;
                      }
                      const document = new DOMParser().parseFromString(
                        text,
                        "text/html",
                      );
                      const items = Array.from(
                        document.querySelectorAll("a[href]"),
                      ).flatMap((link) => {
                        const url = link.getAttribute("href") ?? "";
                        if (!/^https?:\/\//i.test(url)) return [];
                        return [
                          { title: link.textContent?.trim() || url, url },
                        ];
                      });
                      const count =
                        await window.electronAPI.setup.importBookmarks(items);
                      if (!count)
                        throw new Error(
                          "No new bookmarks found. Existing bookmarks were kept.",
                        );
                    }, "Import completed");
                  }}
                />
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob(
                        [
                          JSON.stringify(
                            {
                              format: "gorth-browser-setup",
                              preferences: setup.data,
                            },
                            null,
                            2,
                          ),
                        ],
                        { type: "application/json" },
                      ),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "gorth-browser-setup.json";
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.add({
                      id: "browser-get-started",
                      title: "Setup export prepared",
                      description: undefined,
                      type: "success",
                    });
                  }}
                >
                  <Upload />
                  Export
                </Button>
              </div>
            </div>
          </>
          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <CardTitle>
                {defaultBrowser.data
                  ? "Gorth is your default browser"
                  : "Default browser"}
              </CardTitle>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void perform(
                    () => window.electronAPI.setup.openDefaultBrowserSettings(),
                    "Choose Gorth Browser in system settings",
                  )
                }
              >
                Open system settings
                <ExternalLink />
              </Button>
            </div>
          </>
          {window.electronAPI.windowState.isMacOS && (
            <>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                <CardTitle>Keep Gorth Browser in your Dock</CardTitle>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void perform(
                      () => window.electronAPI.setup.revealDockApplication(),
                      "Drag Gorth Browser from Finder into your Dock",
                    )
                  }
                >
                  Show app in Finder
                  <ExternalLink />
                </Button>
              </div>
            </>
          )}
          <>
            <Separator />
            <div className="flex flex-col gap-6 p-4">
              <CardTitle>On startup</CardTitle>
              <RadioGroup
                className="flex flex-col gap-4"
                value={
                  showStartupPages
                    ? "pages"
                    : (setup.data?.startup ?? "restore")
                }
                disabled={disabled}
                onValueChange={(value) => {
                  if (value === "pages")
                    startupForm.setFieldValue(
                      "urls",
                      setup.data?.startupPages.join("\n") ||
                        "https://www.gorth.org",
                    );
                  else
                    void perform(
                      () => save({ startup: value as "restore" | "new-tab" }),
                      "Startup preference saved",
                    );
                  setShowStartupPages(value === "pages");
                }}
              >
                {[
                  ["new-tab", "Open the New Tab page"],
                  ["restore", "Continue where you left off"],
                  ["pages", "Open a specific page or set of pages"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 text-sm"
                  >
                    <RadioGroupItem value={value} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              {(showStartupPages || setup.data?.startup === "pages") && (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void startupForm.handleSubmit();
                  }}
                >
                  <startupForm.Field name="urls">
                    {(field) => (
                      <label className="flex flex-col gap-2 text-sm">
                        Startup URLs (one per line)
                        <Textarea
                          required
                          value={field.state.value}
                          placeholder={setup.data?.startupPages.join("\n")}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                        />
                      </label>
                    )}
                  </startupForm.Field>
                  <div>
                    <Button type="submit" disabled={disabled}>
                      Save startup pages
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </>
        </Card>
        <section className="flex flex-col gap-6">
          <PageHeading icon={Globe2} title="New Tab Page" />
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <CardTitle>New tab page shows</CardTitle>
              <Select
                items={newTabItems}
                value={setup.data?.newTab ?? "dashboard"}
                disabled={disabled}
                onValueChange={(value) => {
                  if (value)
                    void perform(
                      () =>
                        save({ newTab: value as SetupPreferences["newTab"] }),
                      "New tab preference saved",
                    );
                }}
              >
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {newTabItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <CardTitle>Customize new tab page</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenInternal("settings/appearance")}
                  >
                    Appearance
                    <ExternalLink />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate("gorth://new-tab")}
                  >
                    Preview
                  </Button>
                </div>
              </div>
            </>
          </Card>
        </section>
      </div>
    </Wrapper>
  );
}
