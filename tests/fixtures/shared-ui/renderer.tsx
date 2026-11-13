import { ConfirmationProvider } from "@/providers/confirmation";
import { ProxyPage } from "@/pages/settings/proxy";
import { confirmAction } from "@/lib/confirmation";
import { useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-io/primitive/cores/tanstack/query";
import { PageHeading } from "@/components/heading";
import { Settings } from "@gorth-io/primitive/cores/lucide";
import { SidebarProvider } from "@gorth-io/primitive/custom/sidebar";
import { Button } from "@gorth-io/primitive/custom/button";
import { Dashboard } from "@/layouts/dashboard";
import { AuthContext, useAuth } from "@/hooks/use-auth";
import { PortalProvider } from "@/providers/portal";
import { TooltipProvider } from "@/providers/tooltip";
import "@/styles/globals.css";
const calls: string[] = [];
Object.assign(window, {
  confirmFixture: () => {
    void confirmAction({
      title: "Delete fixture account?",
      destructive: true,
    }).then((answer) => calls.push(`confirm:${answer}`));
  },
});
const queryClient = new QueryClient();
Object.assign(window, {
  electronAPI: {
    networkProxy: {
      get: async () => ({
        mode: "system",
        host: "",
        port: 8080,
        hasCredentials: false,
      }),
      save: async (input: { settings: object }) => ({
        ...input.settings,
        hasCredentials: false,
      }),
      route: async () => "DIRECT",
    },
    setup: {
      load: async () => ({ profileName: "Personal", profileIcon: "user" }),
      onChanged: () => () => {},
    },
    portal: {
      update: () => {},
      onBlur: () => () => {},
    },
  },
});
function Fixture() {
  const [open, setOpen] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [page, setPage] = useState<
    "settings/get-started" | "settings/appearance" | "settings/proxy"
  >("settings/appearance");
  const account = authenticated
    ? {
        name: "Desktop Fixture Long Account Name",
        email: "fixture@example.test",
      }
    : null;
  const auth = {
    account,
    authenticated,
    loading: false,
    busy: false,
    login: () => calls.push("login"),
    register: () => calls.push("register"),
    logout: () => {
      calls.push("logout");
      setAuthenticated(false);
    },
  } as unknown as ReturnType<typeof useAuth>;
  Object.assign(window, { sidebarFixture: { calls } });
  return (
    <AuthContext.Provider value={auth}>
      <TooltipProvider>
        <PortalProvider>
          <ConfirmationProvider>
            <SidebarProvider
              open={open}
              onOpenChange={setOpen}
              className="h-screen min-h-0"
              style={{ "--sidebar-width-icon": "3.5rem" } as CSSProperties}
            >
              <Dashboard
                variant="settings"
                onOpenInternal={(value) => {
                  calls.push(value);
                  setPage(value as typeof page);
                }}
                collapsible
                collapseMode="icon"
                page={page}
              />
              <main className="flex-1 bg-background p-6 text-foreground">
                <div data-heading-fixture>
                  <PageHeading title="Heading fixture" icon={Settings} />
                </div>
                <Button onClick={() => setOpen((value) => !value)}>
                  Toggle sidebar
                </Button>
                {page === "settings/proxy" && <ProxyPage />}
              </main>
            </SidebarProvider>
          </ConfirmationProvider>
        </PortalProvider>
      </TooltipProvider>
    </AuthContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Fixture />
  </QueryClientProvider>,
);
