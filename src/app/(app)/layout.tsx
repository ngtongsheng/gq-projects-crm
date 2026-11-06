import { TrendingUp, UserCheck, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { sectionsFor } from "@/lib/auth/nav-sections";
import { requireRole } from "@/lib/auth/require-role";
import { signOut } from "@/lib/auth/sign-out";
import {
  canDecideOwnership,
  canOpenOwnershipRequests,
} from "./customers/ownership/ownership-access";
import { countPendingOwnershipRequests } from "./customers/ownership/pending-count";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireRole("staff");

  const pendingRequests = canDecideOwnership(profile.jobRole)
    ? await countPendingOwnershipRequests()
    : 0;
  const ownershipItem: NavItem[] = canOpenOwnershipRequests(profile.jobRole)
    ? [
        {
          href: "/customers/ownership",
          label: canDecideOwnership(profile.jobRole)
            ? "Ownership requests"
            : "My requests",
          icon: <UserCheck />,
          badge: pendingRequests,
        },
      ]
    : [];

  const nav: NavItem[] = [
    ...sectionsFor(profile.jobRole).flatMap(
      ({ key, href, label, icon: Icon }) => [
        { href, label, icon: <Icon /> },
        ...(key === "customers" ? ownershipItem : []),
      ],
    ),
    ...(profile.role === "admin"
      ? [
          {
            href: "/performance",
            label: "Sales Performance",
            icon: <TrendingUp />,
          },
          { href: "/people", label: "People", icon: <Users /> },
        ]
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
            className="text-head-muted hover:bg-head-foreground/10 hover:text-head-foreground"
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
