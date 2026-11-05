import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-io/primitive/cores/tanstack/query";
import { SettingsSectionPage } from "@/pages/settings/get-started";
import { NewTabPage } from "@/pages/new-tab";
import { SettingsPage as AppearancePage } from "@/pages/settings/appearance";
import { SidebarProvider } from "@gorth-io/primitive/custom/sidebar";
import { AuthContext, useAuth } from "@/hooks/use-auth";
import { PortalProvider } from "@/providers/portal";
import { ToasterProvider } from "@/providers/toaster";
import {
  setupPreferencesSchema,
  type SetupPreferences,
} from "@/lib/browser/setup";
import "@/styles/globals.css";

document.documentElement.classList.add("dark");
let preferences = setupPreferencesSchema.parse({});
const calls: string[] = [];
const listeners = new Set<(value: SetupPreferences) => void>();
Object.assign(window, {
  setupFixture: { calls, preferences: () => preferences },
  electronAPI: {
    windowState: { isMacOS: true },
    portal: { update: () => {}, onBlur: () => () => {} },
    setup: {
      isDefaultBrowser: async () => false,
      load: async () => preferences,
      save: async (value: SetupPreferences) => {
        preferences = setupPreferencesSchema.parse(value);
        listeners.forEach((listener) => listener(preferences));
        calls.push("saved:" + preferences.startup);
        return preferences;
      },
      onChanged: (listener: (value: SetupPreferences) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      openDefaultBrowserSettings: async () => {
        calls.push("default-browser");
      },
      revealDockApplication: async () => {
        throw new Error("Packaged application required");
      },
    },
    auth: { setLoginBrowser: async () => ({}) },
  },
});
const client = new QueryClient();
function Fixture() {
  const [appearance, setAppearance] = useState(false);
  const [tabLayout, setTabLayout] = useState<"separate" | "compact">(
    "separate",
  );
  const [vertical, setVertical] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const [collapseMode, setCollapseMode] = useState<"icon" | "none">("icon");
  const [side, setSide] = useState<"left" | "right">("left");
  const [visible, setVisible] = useState(false);
  Object.assign(window, {
    showAppearance: () => setAppearance(true),
    appearanceState: { tabLayout, vertical, collapsible, collapseMode, side },
  });
  const [preview, setPreview] = useState(false);
  const [account, setAccount] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const auth = {
    account,
    error: "",
    busy: false,
    locked: false,
    state: { configured: true, loginBrowser: "default" },
    run: async (action: string) => {
      calls.push(action);
      setAccount(
        action === "logout"
          ? null
          : { name: "Fixture", email: "fixture@example.test" },
      );
      return true;
    },
  } as unknown as ReturnType<typeof useAuth>;
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <PortalProvider>
          <ToasterProvider>
            {appearance ? (
              <SidebarProvider>
                <AppearancePage
                  sidebarVisible={visible}
                  onSidebarVisibilityChange={setVisible}
                  sidebarCollapsible={collapsible}
                  sidebarCollapseMode={collapseMode}
                  onSidebarCollapsibleChange={setCollapsible}
                  onSidebarCollapseModeChange={setCollapseMode}
                  tabLayout={tabLayout}
                  onTabLayoutChange={(value) => {
                    setTabLayout(value);
                    if (value === "separate") setVertical(false);
                  }}
                  verticalTabs={vertical}
                  onVerticalTabsChange={(value) => {
                    setVertical(value);
                    if (value) setTabLayout("compact");
                  }}
                  sidebarSide={side}
                  onSidebarSideChange={setSide}
                  theme="dark"
                  onThemeChange={() => {}}
                  enableWorkspace={false}
                  onEnableWorkspaceChange={() => {}}
                  showTitlebarLogo={true}
                  onShowTitlebarLogoChange={() => {}}
                />
              </SidebarProvider>
            ) : preview ? (
              <NewTabPage
                theme="dark"
                onThemeChange={() => {}}
                onNavigate={() => {}}
              />
            ) : (
              <SettingsSectionPage
                onNavigate={(value) => {
                  calls.push(value);
                  if (value === "gorth://new-tab") setPreview(true);
                }}
                onOpenInternal={(value) => calls.push(value)}
              />
            )}
          </ToasterProvider>
        </PortalProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
