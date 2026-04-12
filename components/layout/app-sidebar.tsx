"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Music,
  Layers,
  Disc3,
  Activity,
  MonitorSmartphone,
  Settings,
  Mic,
  LogOut,
  ChevronUp,
  Waves,
  AudioLines,
  BarChart2,
  Drum,
  Heart,
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
  /** If set, item is active only when this query param matches on the library path */
  matchQuery?: { key: string; value: string };
};

const navMain: NavItem[] = [
  { title: "Library", url: "/library", icon: Music, feature: "sampleBrowser" as const },
  {
    title: "Favorites",
    url: "/library?fav=1",
    icon: Heart,
    feature: "sampleBrowser" as const,
    matchQuery: { key: "fav", value: "1" },
  },
  { title: "Kits", url: "/kits", icon: Layers, feature: "kitBrowser" as const },
  { title: "Recordings", url: "/recordings", icon: Disc3, feature: "syncApi" as const },
  { title: "Activity", url: "/activity", icon: Activity, feature: "activityTimeline" as const },
];

const navTools: NavItem[] = [
  { title: "Looper", url: "/looper", icon: AudioLines, feature: "looperDA" as const },
  { title: "Drums", url: "/looper/drums", icon: Drum, feature: "drumPatternEditor" as const },
  { title: "Devices", url: "/devices", icon: MonitorSmartphone, feature: "deviceRegistration" as const },
  { title: "Config", url: "/config", icon: Settings, feature: "configManager" as const },
  { title: "Metrics", url: "/metrics", icon: BarChart2, feature: "deviceMetrics" as const },
  { title: "Analytics", url: "/analytics", icon: BarChart2, feature: "analyticsDashboard" as const },
];

const navComingSoon: NavItem[] = [
  { title: "Karaoke", url: "/karaoke", icon: Mic, feature: "karaokeBrowser" as const },
];

function isItemActive(
  item: NavItem,
  pathname: string,
  searchParams: URLSearchParams,
  siblings: NavItem[]
): boolean {
  const basePath = item.url.split("?")[0];
  if (!pathname.startsWith(basePath)) return false;

  if (item.matchQuery) {
    return searchParams.get(item.matchQuery.key) === item.matchQuery.value;
  }
  // A base-path item (no matchQuery) is active only when no sibling's
  // matchQuery currently matches — so Favorites "wins" over Library when ?fav=1.
  const overriddenBySibling = siblings.some(
    (s) =>
      s !== item &&
      s.matchQuery &&
      s.url.split("?")[0] === basePath &&
      searchParams.get(s.matchQuery.key) === s.matchQuery.value
  );
  return !overriddenBySibling;
}

function NavSection({
  items,
  label,
  pathname,
  searchParams,
}: {
  items: NavItem[];
  label: string;
  pathname: string;
  searchParams: URLSearchParams;
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
                    isActive={isItemActive(item, pathname, searchParams, items)}
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

function DynamicNavContent({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  return (
    <>
      <NavSection items={navMain} label="Browse" pathname={pathname} searchParams={searchParams} />
      <NavSection items={navTools} label="Tools" pathname={pathname} searchParams={searchParams} />
      <NavSection items={navComingSoon} label="Coming Soon" pathname={pathname} searchParams={searchParams} />
    </>
  );
}

function FallbackNavContent({ pathname }: { pathname: string }) {
  const empty = new URLSearchParams();
  return (
    <>
      <NavSection items={navMain} label="Browse" pathname={pathname} searchParams={empty} />
      <NavSection items={navTools} label="Tools" pathname={pathname} searchParams={empty} />
      <NavSection items={navComingSoon} label="Coming Soon" pathname={pathname} searchParams={empty} />
    </>
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
        <Suspense fallback={<FallbackNavContent pathname={pathname} />}>
          <DynamicNavContent pathname={pathname} />
        </Suspense>
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
