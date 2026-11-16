import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { Translate } from "@/lib/i18n/translate";
import { InstallationTabs } from "./installation-tabs";
import { loadInstallers } from "./installer-data";
import { InstallerDialog } from "./installer-dialog";
import { InstallerDirectory } from "./installer-directory";

/** The Installer contacts view: who installs for GQ and how to reach them (demo: instDir). */
export async function InstallerContacts({
  t,
  title,
  canEdit,
}: {
  t: Translate;
  title: string;
  canEdit: boolean;
}) {
  const installers = await loadInstallers();
  const active = installers.filter((installer) => installer.active).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={`${active} ${t("active installers")}`}
        actions={
          <>
            <InstallationTabs t={t} active="contacts" />
            {canEdit && (
              <InstallerDialog>
                <Button size="sm">
                  <Plus data-icon="inline-start" />
                  {t("Add installer")}
                </Button>
              </InstallerDialog>
            )}
          </>
        }
      />
      <InstallerDirectory installers={installers} canEdit={canEdit} />
    </div>
  );
}
