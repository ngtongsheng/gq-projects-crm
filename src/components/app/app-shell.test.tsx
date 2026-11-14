import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SidebarItems } from "@/lib/auth/sidebar-items";
import { AppShell } from "./app-shell";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const nav: SidebarItems = {
  main: [
    { key: "dash", label: "Dashboard", href: "/", badge: 2 },
    { key: "rep", label: "Team Reports", href: "/reports/team" },
    { key: "srep", label: "My Report", href: "/reports" },
  ],
  after: [{ key: "guide", label: "Guide", href: "/guide" }],
};

const render = (at: string) => {
  pathname.current = at;
  return renderToStaticMarkup(
    <AppShell nav={nav} user={{ name: "Vicky", title: "Managing Director" }}>
      page
    </AppShell>,
  );
};

describe("AppShell", () => {
  it("lists the links in order with the divider before the Guide", () => {
    const html = render("/");
    const at = (text: string) => html.indexOf(text);
    expect(at("Dashboard")).toBeLessThan(at("Team Reports"));
    expect(at("Team Reports")).toBeLessThan(at("My Report"));
    expect(at("My Report")).toBeLessThan(at("sidebar-separator"));
    expect(at("sidebar-separator")).toBeLessThan(html.lastIndexOf("Guide"));
  });

  it("marks the longest matching link as the current page", () => {
    const html = render("/reports/team");
    const current = html
      .split("<a ")
      .filter((link) => link.includes('aria-current="page"'))
      .map((link) => link.match(/title="([^"]+)"/)?.[1]);
    expect(current).toEqual(["Team Reports"]);
  });

  it("shows the badge count and the signed-in person", () => {
    const html = render("/");
    expect(html).toMatch(/data-nav-badge[^>]*>2</);
    expect(html).toContain("Vicky");
    expect(html).toContain("Managing Director");
  });
});
