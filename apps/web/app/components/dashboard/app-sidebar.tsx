import { IconDashboard, IconSettings, IconMessageCircle, IconMessages, IconChartBar, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "Conversations",
      url: "/dashboard",
      icon: IconMessages,
    },
    {
      title: "Chat",
      url: "/dashboard/chat",
      icon: IconMessageCircle,
    },
    {
      title: "Network",
      url: "/dashboard/network",
      icon: IconUsers,
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: IconChartBar,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: IconSettings,
    },
  ],
};

export function AppSidebar({
  variant,
  user,
}: {
  variant: "sidebar" | "floating" | "inset";
  user: any;
}) {
  return (
    <Sidebar collapsible="icon" variant={variant}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <Link
              to="/"
              prefetch="viewport"
              className="block group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center"
            >
              <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">Audora</span>
              <span className="hidden text-xl font-bold leading-none group-data-[collapsible=icon]:block">A</span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
