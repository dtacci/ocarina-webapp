"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Music,
  Layers,
  Disc3,
  Activity,
  MonitorSmartphone,
  Settings,
  CircleDot,
  Mic,
  LogOut,
  ChevronUp,
  Waves,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { isEnabled, type FeatureFlag } from "@/lib/features";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  feature: FeatureFlag;
};

const navMain: NavItem[] = [
  { title: "Library", url: "/library", icon: Music, feature: "sampleBrowser" as const },
  { title: "Kits", url: "/kits", icon: Layers, feature: "kitBrowser" as const },
  { title: "Recordings", url: "/recordings", icon: Disc3, feature: "syncApi" as const },
  { title: "Activity", url: "/activity", icon: Activity, feature: "activityTimeline" as const },
];

const navTools: NavItem[] = [
  { title: "Devices", url: "/devices", icon: MonitorSmartphone, feature: "deviceRegistration" as const },
  { title: "Config", url: "/config", icon: Settings, feature: "configManager" as const },
];

const navComingSoon: NavItem[] = [
  { title: "Looper", url: "/looper", icon: CircleDot, feature: "looperDashboard" as const },
  { title: "Karaoke", url: "/karaoke", icon: Mic, feature: "karaokeBrowser" as const },
];

function NavSection({
  items,
  label,
  pathname,
}: {
  items: NavItem[];
  label: string;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const enabled = isEnabled(item.feature);
            return (
              <SidebarMenuItem key={item.title}>
                {enabled ? (
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={pathname.startsWith(item.url)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton disabled isActive={false}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                    {label === "Coming Soon" && (
                      <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                        v0.2
                      </Badge>
                    )}
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/library" />} size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground glow-amber">
                <Waves className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Digital Ocarina</span>
                <span className="text-xs text-muted-foreground">Web Companion</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavSection items={navMain} label="Browse" pathname={pathname} />
        <NavSection items={navTools} label="Tools" pathname={pathname} />
        <NavSection items={navComingSoon} label="Coming Soon" pathname={pathname} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">DO</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-sm font-medium">My Account</span>
                  <span className="text-xs text-muted-foreground">Free tier</span>
                </div>
                <ChevronUp className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                <form action="/api/auth/signout" method="post">
                  <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
