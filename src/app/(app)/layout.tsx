import { TrendingUp, UserCheck, Users } from "lucide-react";
import {
  AppShell,
  type NavItem,
  type NavModule,
} from "@/components/app/app-shell";
import { ImpersonationBar } from "@/components/app/impersonation-bar";
import { Button } from "@/components/ui/button";
import { loadAccessOverrides } from "@/lib/auth/access-overrides";
import { readImpersonation } from "@/lib/auth/impersonation";
import { GUIDE_PAGE, navPagesFor } from "@/lib/auth/pages";
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

  const adminItems: NavItem[] =
    profile.role === "admin"
      ? [
          {
            href: "/performance",
            label: "Sales Performance",
            icon: <TrendingUp />,
          },
          { href: "/people", label: "People", icon: <Users /> },
        ]
      : [];

  const pages = navPagesFor(profile, await loadAccessOverrides());
  const modules: NavModule[] = [
    {
      key: "crm",
      label: "CRM",
      nav: [
        ...pages.flatMap(({ key, href, label, icon: Icon }) => [
          { href, label, icon: <Icon /> },
          ...(key === "cust" ? ownershipItem : []),
        ]),
        {
          href: GUIDE_PAGE.href,
          label: GUIDE_PAGE.label,
          icon: <GUIDE_PAGE.icon />,
        },
        ...adminItems,
      ],
    },
  ];

  const impersonation = await readImpersonation();
  const impersonating = impersonation?.targetId === profile.id;

  return (
    <>
      {impersonating && <ImpersonationBar name={profile.fullName} />}
      <AppShell
        modules={modules}
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
