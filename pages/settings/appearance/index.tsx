import { Separator } from "@gorth-com/primitive/default/separator";
import { Palette } from "@gorth-com/primitive/cores/lucide";
import { ThemeToggle } from "@/components/element/theme-toggle";
import { ToastSettings } from "@/components/element/toast-settings";
import { SidebarSettings } from "@/components/element/sidebar-settings";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
import { Switch } from "@gorth-com/primitive/default/switch";
import {
  RadioGroup,
  RadioGroupItem,
} from "@gorth-com/primitive/default/radio-group";
import type { SpecialPageProps } from "@/pages/shared";
import { Wrapper } from "@/layouts/wrapper";
import { PageHeading } from "@/components/heading";

const tabLayouts = [
  { value: "separate", label: "Separate" },
  { value: "compact", label: "Compact" },
];
function SettingsPage({
  sidebarVisible,
  onSidebarVisibilityChange,
  sidebarCollapsible,
  sidebarCollapseMode,
  onSidebarCollapsibleChange,
  onSidebarCollapseModeChange,
  tabLayout,
  onTabLayoutChange,
  enableWorkspace,
  onEnableWorkspaceChange,
  theme,
  onThemeChange,
  verticalTabs,
  onVerticalTabsChange,
  onSidebarSideChange,
  onShowTitlebarLogoChange,
  sidebarSide,
  showTitlebarLogo,
}: Pick<
  SpecialPageProps,
  | "sidebarVisible"
  | "onSidebarVisibilityChange"
  | "sidebarCollapsible"
  | "sidebarCollapseMode"
  | "onSidebarCollapsibleChange"
  | "onSidebarCollapseModeChange"
  | "tabLayout"
  | "onTabLayoutChange"
  | "enableWorkspace"
  | "onEnableWorkspaceChange"
  | "onSidebarSideChange"
  | "onShowTitlebarLogoChange"
  | "sidebarSide"
  | "showTitlebarLogo"
  | "verticalTabs"
  | "onVerticalTabsChange"
  | "theme"
  | "onThemeChange"
>) {
  return (
    <Wrapper>
      <div className="flex flex-col gap-6">
        <PageHeading icon={Palette} title="Appearance" />
        <Card className="gap-0 overflow-hidden py-0">
          <section className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle id="titlebar-logo-label">Titlebar logo</CardTitle>
                <CardDescription>
                  Show the logo beside the tab list.
                </CardDescription>
              </div>
              <Switch
                aria-labelledby="titlebar-logo-label"
                checked={showTitlebarLogo}
                onCheckedChange={onShowTitlebarLogoChange}
              />
            </div>
          </section>
          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>Color mode</CardTitle>
                  <CardDescription>
                    Choose the browser interface color mode.
                  </CardDescription>
                </div>
                <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
              </div>
            </section>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <ToastSettings />
            </section>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>Sidebar position</CardTitle>
                  <CardDescription>
                    Place the browser sidebar on either side.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle id="sidebar-visibility-label">
                    Show sidebar
                  </CardTitle>
                  <Switch
                    aria-labelledby="sidebar-visibility-label"
                    checked={sidebarVisible}
                    onCheckedChange={onSidebarVisibilityChange}
                  />
                </div>
              </div>
              <RadioGroup
                aria-label="Sidebar position"
                value={sidebarSide}
                className="flex flex-col gap-4"
                onValueChange={(value) => {
                  if (value === "left" || value === "right")
                    onSidebarSideChange(value);
                }}
              >
                <label className="flex items-center gap-3 text-sm">
                  <RadioGroupItem value="right" />
                  Show on the right
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <RadioGroupItem value="left" />
                  Show on the left
                </label>
              </RadioGroup>
            </section>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <SidebarSettings
                enabled={sidebarCollapsible}
                mode={sidebarCollapseMode}
                onEnabledChange={onSidebarCollapsibleChange}
                onModeChange={onSidebarCollapseModeChange}
              />
            </section>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-6 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>Tab layout</CardTitle>
                  <CardDescription>Choose the toolbar layout.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle id="vertical-tabs-label">Vertical tabs</CardTitle>
                  <Switch
                    aria-labelledby="vertical-tabs-label"
                    checked={verticalTabs}
                    onCheckedChange={onVerticalTabsChange}
                  />
                </div>
              </div>
              <RadioGroup
                aria-label="Tab layout"
                value={tabLayout}
                className="flex flex-col gap-4"
                onValueChange={(value) => {
                  if (value === "separate" || value === "compact")
                    onTabLayoutChange(value);
                }}
              >
                {tabLayouts.map((item) => (
                  <label
                    key={item.value}
                    className="flex items-center gap-3 text-sm"
                  >
                    <RadioGroupItem value={item.value} />
                    {item.label}
                  </label>
                ))}
              </RadioGroup>
            </section>
          </>

          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle id="enable-workspace-label">
                    Enable workspace
                  </CardTitle>
                  <CardDescription id="enable-workspace-description">
                    Show the workspace sidebar. Workspace management is not
                    available yet.
                  </CardDescription>
                </div>
                <Switch
                  aria-labelledby="enable-workspace-label"
                  aria-describedby="enable-workspace-description"
                  checked={enableWorkspace}
                  onCheckedChange={onEnableWorkspaceChange}
                />
              </div>
            </section>
          </>
        </Card>
      </div>
    </Wrapper>
  );
}
export { SettingsPage };
