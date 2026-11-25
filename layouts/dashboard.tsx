import { useBrowserSetup } from "@/hooks/use-browser-setup";
import { Fragment } from "react";
import { HeadingIcon } from "@/components/heading";
import { settingsPagesFirst, settingsPagesSecond } from "@/utils/constant";
import {
  Settings,
  LogIn,
  KeySquare,
  UserRound,
  Globe2,
  Rocket,
  Star,
  User,
} from "@gorth-com/primitive/cores/lucide";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@gorth-com/primitive/custom/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import { NavUser } from "@/components/dashboard/nav-user";
import { useAuth } from "@/hooks/use-auth";

import type { BrowserInternalPage } from "@/lib/browser/internal-pages";
interface SettingsDashboardProps {
  collapsible?: boolean;
  collapseMode?: "icon" | "none";
  variant: "settings";
  page: BrowserInternalPage;
  onOpenInternal: (page: Exclude<BrowserInternalPage, "new-tab">) => void;
}
export function Dashboard(props: SettingsDashboardProps) {
  const auth = useAuth();
  const account = auth.account;
  const profile = useBrowserSetup().data;
  const profileName = profile?.profileName ?? "Personal";
  const localIcon = { globe: Globe2, user: User, rocket: Rocket, star: Star }[
    profile?.profileIcon ?? "user"
  ];
  const navigate = (url: string) => {
    const item = [...settingsPagesFirst, ...settingsPagesSecond].find(
      (item) => item.id === url,
    );
    if (item) props.onOpenInternal(item.id);
  };
  return (
    <Sidebar
      collapsible={
        props.collapsible
          ? props.collapseMode === "none"
            ? "offcanvas"
            : "icon"
          : "none"
      }
      className={props.collapsible ? "absolute! inset-y-0 h-full" : "border-r"}
    >
      <SidebarHeader className="group-data-[collapsible=icon]:items-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-14 group-data-[collapsible=icon]:p-0!"
              onClick={() => props.onOpenInternal("settings/get-started")}
            >
              <HeadingIcon icon={Settings} />
              <span className="truncate text-2xl font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                Settings
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        {[
          settingsPagesFirst,
          settingsPagesSecond.filter((item) => item.id !== "settings/help"),
          settingsPagesSecond.filter((item) => item.id === "settings/help"),
        ].map((items, index) => (
          <Fragment key={index}>
            {index > 0 && <SidebarSeparator className="mx-0 -my-2" />}
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <SidebarMenuButton
                            aria-label={item.title}
                            aria-current={
                              props.page === item.id ? "page" : undefined
                            }
                            isActive={props.page === item.id}
                            className="group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
                            onClick={() => props.onOpenInternal(item.id)}
                          >
                            <item.icon />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {item.title}
                            </span>
                          </SidebarMenuButton>
                        }
                      />
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      <SidebarFooter className="group-data-[collapsible=icon]:items-center">
        <NavUser
          localIcon={localIcon}
          auth={auth}
          onNavigate={navigate}
          user={{
            name: auth.authenticated
              ? (account?.name ?? "Personal")
              : profileName,
            email: auth.authenticated ? "authenticated" : "local",
            avatar: auth.authenticated ? account?.image : undefined,
          }}
          nav={{
            main: [
              {
                title: "Tài khoản",
                url: "settings/get-started",
                icon: UserRound,
              },
            ],
            secondary: [
              { title: "Sign in", url: "/sign-in", icon: LogIn },
              { title: "Create account", url: "/sign-up", icon: KeySquare },
            ],
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
