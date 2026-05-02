import { api } from "@audora/backend/convex/_generated/api";
import { IconChartBar, IconMessageCircle, IconMessages, IconSettings, IconUsers } from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { Link, useLocation } from "react-router";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";

const data = {
  navMain: [
    {
      title: "Conversations",
      url: "/dashboard",
      icon: IconMessages,
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
    {
      title: "Chat",
      url: "/dashboard/chat",
      icon: IconMessageCircle,
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
  const location = useLocation();
  const isChatPage = location.pathname === "/dashboard/chat";
  const activeThreadKey = new URLSearchParams(location.search).get("thread");
  const chatThreads = useQuery(api.chat.listThreads, isChatPage ? {} : "skip");

  return (
    <Sidebar collapsible="icon" variant={variant}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <Link
              to="/"
              aria-label="Audora home"
              prefetch="viewport"
              className="flex h-10 items-center gap-2 rounded-md px-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
            >
              <img src="/logo.png" alt="" className="size-8 shrink-0 rounded-[10px]" />
              <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">Audora</span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {isChatPage && chatThreads && chatThreads.length > 0 ? (
          <SidebarGroup className="pt-0">
            <SidebarGroupLabel>Chat History</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenuSub>
                {chatThreads.map((thread) => (
                  <SidebarMenuSubItem key={thread.threadKey}>
                    <SidebarMenuSubButton asChild isActive={activeThreadKey === thread.threadKey}>
                      <Link
                        to={`/dashboard/chat?thread=${encodeURIComponent(thread.threadKey)}`}
                        prefetch="intent"
                        title={thread.preview}
                      >
                        <span>{thread.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
