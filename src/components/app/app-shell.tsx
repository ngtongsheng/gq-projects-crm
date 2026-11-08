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

export type NavModule = {
  key: string;
  label: string;
  /** The sidebar links shown while the current page belongs to this module. */
  nav: NavItem[];
};

type AppShellProps = {
  modules: NavModule[];
  /** Right side of the header: user menu, theme switch. */
  headerActions?: ReactNode;
  children: ReactNode;
};

const opensPage = (href: string, pathname: string) =>
  pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

// Longest matching link wins, so /customers/ownership beats /customers.
function activeModuleOf(modules: NavModule[], pathname: string): NavModule {
  let best = modules[0];
  let bestLength = -1;
  for (const mod of modules) {
    for (const { href } of mod.nav) {
      if (opensPage(href, pathname) && href.length > bestLength) {
        best = mod;
        bestLength = href.length;
      }
    }
  }
  return best;
}

function ModuleTabs({
  modules,
  active,
}: {
  modules: NavModule[];
  active: NavModule;
}) {
  return (
    <nav
      aria-label="Modules"
      className="mr-auto flex min-w-0 items-center gap-1 overflow-x-auto"
    >
      {modules.map((mod) => (
        <Link
          key={mod.key}
          href={mod.nav[0]?.href ?? "/"}
          aria-current={mod.key === active.key ? "page" : undefined}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold text-head-muted hover:bg-head-foreground/10 hover:text-head-foreground aria-[current=page]:bg-head-foreground/15 aria-[current=page]:text-head-foreground"
        >
          {mod.label}
        </Link>
      ))}
    </nav>
  );
}

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

export function AppShell({ modules, headerActions, children }: AppShellProps) {
  const pathname = usePathname();
  const active = activeModuleOf(modules, pathname);

  return (
    <SidebarProvider className="flex-col [--header-height:3.5rem]">
      <header className="sticky top-0 z-40 flex h-(--header-height) items-center gap-3 border-b-[3px] border-mint bg-head px-4 text-head-foreground">
        <SidebarTrigger className="text-head-muted hover:bg-head-foreground/10 hover:text-head-foreground" />
        <span className="truncate font-heading text-lg font-bold tracking-wider uppercase">
          {APP_NAME}
        </span>
        <ModuleTabs modules={modules} active={active} />
        {headerActions}
      </header>
      <div className="flex flex-1">
        <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
          <SidebarContent className="p-2">
            {active && <NavMenu nav={active.nav} />}
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
