import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { requireSection } from "@/lib/auth/require-section";
import { loadCommissionSettings } from "../commission-settings-data";
import { CommissionSettingsForm } from "./commission-settings-form";

export const metadata: Metadata = { title: "Commission settings" };

export default async function CommissionSettingsPage() {
  const me = await requireSection("commission");
  // The database holds the same line: only the MD and admins write app_settings.
  if (me.role !== "admin" && me.jobRole !== "md") redirect("/not-allowed");
  const settings = await loadCommissionSettings();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Commission settings"
        description="The rules every commission is worked out from. Per-person exceptions are set on People."
      />
      <CommissionSettingsForm settings={settings} />
    </div>
  );
}
