import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Not available" };

export default async function NotAllowedPage() {
  await requireRole("staff");

  return (
    <>
      <PageHeader title="Not available for your role" />
      <EmptyState
        icon={Lock}
        title="This section is not part of your job role"
        description="Use the menu on the left to open the sections you can see. If you think you need this one, ask an admin."
      />
    </>
  );
}
