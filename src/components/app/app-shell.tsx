"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_NAME } from "@/lib/app-name";

export type NavItem = {
  href: string;
  label: string;
  /** An element such as <Home />; components cannot cross the server/client boundary. */
  icon: ReactNode;
  /** A count shown at the right edge, e.g. pending requests; hidden at zero. */
  badge?: number;
};

type AppShellProps = {
  nav: NavItem[];
  /** Right side of the header: user menu, theme switch. */
  headerActions?: ReactNode;
  children: ReactNode;
};

function NavMenu({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {nav.map(({ href, label, icon, badge }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === href}
            className="font-semibold data-[active=true]:shadow-[inset_3px_0_0_var(--mint)]"
          >
            <Link href={href} onClick={() => setOpenMobile(false)}>
              {icon}
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
          {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppShell({ nav, headerActions, children }: AppShellProps) {
  return (
    <SidebarProvider className="flex-col [--header-height:3.5rem]">
      <header className="sticky top-0 z-40 flex h-(--header-height) items-center gap-3 border-b-[3px] border-mint bg-head px-4 text-head-foreground">
        <SidebarTrigger className="text-head-muted hover:bg-head-foreground/10 hover:text-head-foreground" />
        <span className="mr-auto truncate font-heading text-lg font-bold tracking-wider uppercase">
          {APP_NAME}
        </span>
        {headerActions}
      </header>
      <div className="flex flex-1">
        <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
          <SidebarContent className="p-2">
            <NavMenu nav={nav} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-5 pb-10">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
