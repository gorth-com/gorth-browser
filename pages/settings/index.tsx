import { ShortcutsPage } from "@/pages/settings/shortcuts";
import { FoldersPage } from "./folders";
import { Wrapper } from "@/layouts/wrapper";
import { SidebarProvider } from "@gorth-io/primitive/custom/sidebar";
import { useEffect, useState, type CSSProperties } from "react";
import { Dashboard } from "@/layouts/dashboard";
import type { SpecialPageProps } from "@/pages/shared";
import { SettingsPage as AppearancePage } from "./appearance";
import { AboutPage } from "./help";
import { SettingsSectionPage as Section0 } from "./get-started";
import { SettingsSectionPage as Section1 } from "./content";
import { SettingsSectionPage as Section2 } from "./shields";
import { SettingsSectionPage as Section3 } from "./privacy";
import { SettingsSectionPage as Section4 } from "./web3";
import { SettingsSectionPage as Section5 } from "./leo";
import { SettingsSectionPage as Section6 } from "./sync";
import { SettingsSectionPage as Section7 } from "./search";
import { SettingsSectionPage as Section8 } from "./extensions";
import { SettingsSectionPage as Section9 } from "./autofill";
import { SettingsSectionPage as Section10 } from "./languages";
import { SettingsSectionPage as Section11 } from "./downloads";
import { SettingsSectionPage as Section12 } from "./accessibility";
import { SettingsSectionPage as Section13 } from "./system";
import { SettingsSectionPage as Section14 } from "./reset";

import { ProfilePage } from "./profile";
import { ProxyPage } from "./proxy";
const sections = {
  "settings/folders": FoldersPage,
  "settings/proxy": ProxyPage,
  "settings/profile": ProfilePage,
  "settings/get-started": Section0,
  "settings/content": Section1,
  "settings/shields": Section2,
  "settings/privacy": Section3,
  "settings/web3": Section4,
  "settings/leo": Section5,
  "settings/sync": Section6,
  "settings/search": Section7,
  "settings/extensions": Section8,
  "settings/autofill": Section9,
  "settings/languages": Section10,
  "settings/downloads": Section11,
  "settings/accessibility": Section12,
  "settings/system": Section13,
  "settings/reset": Section14,
};
export function SettingsPage(props: SpecialPageProps) {
  const [open, setOpen] = useState(!props.sidebarCollapsible);
  useEffect(() => {
    setOpen(!props.sidebarCollapsible);
  }, [props.sidebarCollapsible]);
  const current =
    props.page === "settings" ? "settings/get-started" : props.page;
  const Section = sections[current as keyof typeof sections];

  return (
    <SidebarProvider
      open={!props.sidebarCollapsible || open}
      onOpenChange={setOpen}
      style={{ "--sidebar-width-icon": "3.5rem" } as CSSProperties}
      className="relative h-full min-h-0 items-stretch overflow-hidden"
    >
      <Dashboard
        collapsible={props.sidebarCollapsible}
        collapseMode={props.sidebarCollapseMode}
        variant="settings"
        page={current}
        onOpenInternal={props.onOpenInternal}
      />
      <section
        className="min-w-0 flex-1 overflow-y-auto"
        aria-label="Settings content"
      >
        {current === "settings/shortcuts" || current === "shortcuts" ? (
          <Wrapper>
            <ShortcutsPage />
          </Wrapper>
        ) : current === "settings/appearance" ? (
          <AppearancePage {...props} />
        ) : current === "settings/help" ? (
          <AboutPage onOpenInternal={props.onOpenInternal} />
        ) : current === "settings/system" ? (
          <Section13 {...props} />
        ) : Section ? (
          <Section {...props} />
        ) : null}
      </section>
    </SidebarProvider>
  );
}
