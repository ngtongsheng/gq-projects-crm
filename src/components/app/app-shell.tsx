"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { NavIcon } from "@/components/app/nav-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_NAME } from "@/lib/app-name";
import type { SidebarItem, SidebarItems } from "@/lib/auth/sidebar-items";

type AppShellProps = {
  nav: SidebarItems;
  /** Who is signed in, shown at the right of the header where the demo has "Signed in as". */
  user?: { name: string; title: string };
  /** Right side of the header, after the person: sign out. */
  headerActions?: ReactNode;
  children: ReactNode;
};

const SIDEBAR_OPEN_KEY = "gqp-office-sidebar-open";

const opensPage = (href: string, pathname: string) =>
  pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

// The longest matching link wins, so /reports/team beats /reports.
function activeHref(
  items: SidebarItem[],
  pathname: string,
): string | undefined {
  return items
    .filter(({ href }) => opensPage(href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function NavLinks({
  items,
  active,
}: {
  items: SidebarItem[];
  active: string | undefined;
}) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu className="gap-0.5">
      {items.map(({ key, href, label, badge }) => (
        <SidebarMenuItem key={key}>
          <SidebarMenuButton
            asChild
            isActive={href === active}
            className="relative h-auto min-h-[42px] gap-3 overflow-visible rounded-[10px] px-3 py-2 text-[length:15.5px] font-medium hover:bg-sunk data-active:bg-accent-soft data-active:font-semibold group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:justify-center [&_svg]:size-5 data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:-left-2 data-active:before:w-1 data-active:before:rounded-r-[4px] data-active:before:bg-mint data-active:before:content-['']"
          >
            <Link
              href={href}
              title={label}
              aria-current={href === active ? "page" : undefined}
              onClick={() => setOpenMobile(false)}
            >
              <NavIcon name={key} />
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                {label}
              </span>
              {badge ? (
                <span
                  data-nav-badge
                  className="ml-auto min-w-5 rounded-[10px] bg-bad px-1.5 text-center text-[11.5px] leading-5 font-semibold text-head-foreground group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:text-[10px] group-data-[collapsible=icon]:leading-4"
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function MenuToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title="Menu"
      aria-label="Show or hide menu"
      className="grid size-10 flex-none place-items-center rounded-[10px] border border-mint/55 bg-mint/12 text-head-foreground hover:bg-mint/25"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="size-5"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16" />
      </svg>
    </button>
  );
}

function Brand() {
  const [first, ...rest] = APP_NAME.split(" ");
  return (
    <div className="mr-auto flex min-w-0 items-center gap-3">
      <Image
        src="/gqp-office-logo.png"
        alt="GQ Projects"
        width={68}
        height={34}
        priority
        className="h-[34px] w-auto flex-none max-[520px]:h-7"
      />
      <span className="truncate font-heading text-[19px] leading-[1.1] font-bold tracking-[.06em] uppercase max-[520px]:text-base">
        {first} <b className="font-bold text-mint">{rest.join(" ")}</b>
      </span>
    </div>
  );
}

function SignedInAs({ name, title }: { name: string; title: string }) {
  return (
    <div className="flex min-w-0 flex-[0_1_auto] items-center gap-2">
      <span className="text-[11.5px] tracking-[.07em] whitespace-nowrap text-head-muted uppercase max-[520px]:hidden">
        Signed in as
      </span>
      <span
        data-signed-in
        className="min-w-0 truncate rounded-lg border border-border bg-card px-2.5 py-2 text-foreground"
      >
        {name}
        <span className="max-sm:hidden"> — {title}</span>
      </span>
    </div>
  );
}

export function AppShell({
  nav,
  user,
  headerActions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const active = activeHref([...nav.main, ...nav.after], pathname);

  // The collapsed state is read after mount so the server and first client render agree.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_OPEN_KEY) === "false") setOpen(false);
    } catch {
      // Storage can be blocked; the sidebar then simply starts open.
    }
  }, []);
  const rememberOpen = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
    } catch {
      // Not remembering the choice is harmless.
    }
  };

  return (
    <SidebarProvider
      open={open}
      onOpenChange={rememberOpen}
      className="flex-col [--header-height:63px]"
      style={
        {
          "--sidebar-width": "236px",
          "--sidebar-width-icon": "68px",
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-40 flex h-(--header-height) items-center gap-3 border-b-[3px] border-mint bg-head py-2.5 pr-4 pl-3 text-head-foreground">
        <MenuToggle />
        <Brand />
        {user ? <SignedInAs name={user.name} title={user.title} /> : null}
        {headerActions}
      </header>
      <div className="flex flex-1">
        <Sidebar
          collapsible="icon"
          className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
        >
          <SidebarContent className="gap-0 px-2 pt-3 pb-6">
            <NavLinks items={nav.main} active={active} />
            <SidebarSeparator className="mx-1.5 my-2" />
            <NavLinks items={nav.after} active={active} />
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
