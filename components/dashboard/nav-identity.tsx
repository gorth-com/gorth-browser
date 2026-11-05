import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "@gorth-io/primitive/cores/lucide";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth-io/primitive/custom/avatar";
import { SidebarMenuButton } from "@gorth-io/primitive/custom/sidebar";
import { cn } from "@gorth-io/primitive/cores/cn";
import { formatUserInitials } from "@gorth-io/primitive/utils/formatter";
import type { UserProps } from "@gorth-io/primitive/utils/interface";

// Mirror Primitive's identity presentation without importing its Next.js module.
export function NavAvatar({ user, icon: Icon }: { user: UserProps; icon?: LucideIcon }) {
  return (
    <Avatar className="size-9 shrink-0 cursor-default">
      <AvatarImage src={user.avatar || undefined} alt={user.name} />
      <AvatarFallback
        className="bg-muted-foreground text-primary-foreground"
        suppressHydrationWarning
      >
        {Icon ? <Icon className="size-4" /> : formatUserInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
export function NavName({ user }: { user: UserProps }) {
  return (
    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
      <span
        className="block min-w-0 truncate font-medium"
        suppressHydrationWarning
      >
        {user.name}
      </span>
      {user.email && (
        <span
          className="block min-w-0 truncate text-xs"
          suppressHydrationWarning
        >
          {user.email}
        </span>
      )}
    </div>
  );
}
export function NavIdentity({ user, icon }: { user: UserProps; icon?: LucideIcon }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <NavAvatar user={user} icon={icon} />
      <NavName user={user} />
    </div>
  );
}
interface NavAccountProps extends ComponentProps<typeof SidebarMenuButton> {
  user: UserProps;
  icon?: LucideIcon;
  trailing?: ReactNode;
}
export function NavAccount({
  user,
  icon,
  trailing,
  className,
  ...props
}: NavAccountProps) {
  return (
    <SidebarMenuButton
      {...props}
      size="lg"
      className={cn(
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className,
        "h-14 w-full gap-2 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground not-data-[variant=destructive]:focus:**:text-sidebar-accent-foreground",
      )}
    >
      <NavIdentity user={user} icon={icon} />
      {trailing}
    </SidebarMenuButton>
  );
}
