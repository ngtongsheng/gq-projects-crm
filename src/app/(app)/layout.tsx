import { AppShell } from "@/components/app/app-shell";
import { ImpersonationBar } from "@/components/app/impersonation-bar";
import { Button } from "@/components/ui/button";
import { loadAccessOverrides } from "@/lib/auth/access-overrides";
import { readImpersonation } from "@/lib/auth/impersonation";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { requireRole } from "@/lib/auth/require-role";
import { sidebarItemsFor } from "@/lib/auth/sidebar-items";
import { signOut } from "@/lib/auth/sign-out";
import { canDecideOwnership } from "./customers/ownership/ownership-access";
import { countPendingOwnershipRequests } from "./customers/ownership/pending-count";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireRole("staff");

  // Open ownership requests wait on the Dashboard badge; the list opens from the dashboard's
  // attention panel. More badges (invitations, leave, tasks) join here as their pages are built.
  const pendingRequests = canDecideOwnership(profile.jobRole)
    ? await countPendingOwnershipRequests()
    : 0;

  const nav = sidebarItemsFor({
    viewer: profile,
    isAdmin: profile.role === "admin",
    overrides: await loadAccessOverrides(),
    badges: { dash: pendingRequests },
  });

  const impersonation = await readImpersonation();
  const impersonating = impersonation?.targetId === profile.id;

  return (
    <>
      {impersonating && <ImpersonationBar name={profile.fullName} />}
      <AppShell
        nav={nav}
        user={{
          name: profile.fullName ?? "Signed in",
          title: JobRoleLabel[profile.jobRole],
        }}
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
