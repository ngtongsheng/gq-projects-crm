import { UserCheck, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { ImpersonationBar } from "@/components/app/impersonation-bar";
import { Button } from "@/components/ui/button";
import { readImpersonation } from "@/lib/auth/impersonation";
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
      ? [{ href: "/people", label: "People", icon: <Users /> }]
      : []),
  ];

  const impersonation = await readImpersonation();
  const impersonating = impersonation?.targetId === profile.id;

  return (
    <>
      {impersonating && <ImpersonationBar name={profile.fullName} />}
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
    </>
  );
}
