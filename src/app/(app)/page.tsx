import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth/require-role";

export default async function Home() {
  const profile = await requireRole("staff");

  return (
    <PageHeader
      title="Home"
      description={
        profile.fullName ? `Welcome, ${profile.fullName}.` : undefined
      }
    />
  );
}
