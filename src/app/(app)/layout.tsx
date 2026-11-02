import { Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { sectionsFor } from "@/lib/auth/nav-sections";
import { requireRole } from "@/lib/auth/require-role";
import { signOut } from "@/lib/auth/sign-out";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireRole("staff");

  const nav: NavItem[] = [
    ...sectionsFor(profile.jobRole).map(({ href, label, icon: Icon }) => ({
      href,
      label,
      icon: <Icon />,
    })),
    ...(profile.role === "admin"
      ? [{ href: "/people", label: "People", icon: <Users /> }]
      : []),
  ];

  return (
    <AppShell
      nav={nav}
      headerActions={
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-head-muted hover:bg-white/10 hover:text-head-foreground"
          >
            Sign out
          </Button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
