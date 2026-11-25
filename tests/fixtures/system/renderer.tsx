import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-com/primitive/cores/tanstack/query";
import { SettingsSectionPage } from "@/pages/settings/system";
import { PortalProvider } from "@/providers/portal";
import { ToasterProvider } from "@/providers/toaster";
import { ConfirmationProvider } from "@/providers/confirmation";
import { useSystemEffects } from "@/hooks/use-system-settings";
import "@/styles/globals.css";
const calls: string[] = [];
Object.assign(window, { systemFixture: { calls } });
function Fixture() {
  useSystemEffects();
  const [flags, setFlags] = useState({
    memorySaver: true,
    smoothScrolling: true,
  });
  const [minutes, setMinutes] = useState(15);
  const [days, setDays] = useState(0);
  return (
    <SettingsSectionPage
      flags={flags}
      onFlagsChange={(value) =>
        setFlags({
          memorySaver: value.memorySaver,
          smoothScrolling: value.smoothScrolling,
        })
      }
      sleepAfterMinutes={minutes}
      onSleepAfterMinutesChange={(value) => {
        calls.push(`sleep:${value}`);
        setMinutes(value);
      }}
      archiveAfterDays={days}
      onArchiveAfterDaysChange={setDays}
      onOpenInternal={(page) => calls.push(page)}
    />
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <PortalProvider>
      <ToasterProvider>
        <ConfirmationProvider>
          <Fixture />
        </ConfirmationProvider>
      </ToasterProvider>
    </PortalProvider>
  </QueryClientProvider>,
);
