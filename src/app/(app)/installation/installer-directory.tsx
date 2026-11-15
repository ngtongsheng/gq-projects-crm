"use client";

import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { filterInstallers, whatsAppChatLink } from "@/lib/domain/installer";
import { formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type { InstallerRow } from "./installer-data";
import { InstallerDialog } from "./installer-dialog";

type InstallerDirectoryProps = {
  installers: InstallerRow[];
  /** Whether the person may add and edit installers. */
  canEdit: boolean;
};

const HEAD =
  "h-9 px-3.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";

/** The installer contacts table with its search and Show inactive tick (demo: instDir). */
export function InstallerDirectory({
  installers,
  canEdit,
}: InstallerDirectoryProps) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const rows = filterInstallers(installers, search, showInactive);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Search installers"
          placeholder="Search name, phone, skill, area"
          className="max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="showInactiveInstallers"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked === true)}
          />
          <Label htmlFor="showInactiveInstallers" className="font-normal">
            Show inactive
          </Label>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState title="No installer found." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-sunk">
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Installer</TableHead>
                <TableHead className={HEAD}>Phone</TableHead>
                <TableHead className={cn(HEAD, "max-sm:hidden")}>
                  What they can do
                </TableHead>
                <TableHead className={cn(HEAD, "max-sm:hidden")}>
                  Area
                </TableHead>
                <TableHead className={cn(HEAD, "max-sm:hidden")}>
                  Notes
                </TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Jobs</TableHead>
                <TableHead className={cn(HEAD, "max-sm:hidden")}>
                  Last job
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((installer) => (
                <TableRow
                  key={installer.id}
                  className={cn(
                    "align-top hover:bg-sunk",
                    !installer.active && "opacity-60",
                  )}
                >
                  <TableCell className="px-3.5 py-2.5 whitespace-normal">
                    {canEdit ? (
                      <InstallerDialog installer={installer}>
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                        >
                          {installer.name}
                        </button>
                      </InstallerDialog>
                    ) : (
                      <span className="font-medium">{installer.name}</span>
                    )}
                    {installer.company && (
                      <p className="text-xs text-muted-foreground">
                        {installer.company}
                      </p>
                    )}
                    {!installer.active && (
                      <StatusBadge tone="neutral">Inactive</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5">
                    <PhoneLines phones={[installer.phone, installer.phone2]} />
                  </TableCell>
                  <TableCell className="max-w-80 px-3.5 py-2.5 whitespace-normal max-sm:hidden">
                    {installer.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {installer.skills.map((skill) => (
                          <StatusBadge key={skill}>{skill}</StatusBadge>
                        ))}
                      </div>
                    )}
                    {installer.description && (
                      <p className="mt-1">{installer.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 whitespace-normal max-sm:hidden">
                    {installer.area}
                  </TableCell>
                  <TableCell className="max-w-64 px-3.5 py-2.5 whitespace-normal max-sm:hidden">
                    {installer.notes}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                    {installer.jobCount || ""}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 font-mono whitespace-nowrap tabular-nums max-sm:hidden">
                    {installer.lastJobOn ? formatDate(installer.lastJobOn) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Each number as a call link, with a WhatsApp link when it is a Malaysian number. */
function PhoneLines({ phones }: { phones: string[] }) {
  const shown = phones.filter(Boolean);
  if (shown.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }
  return shown.map((phone) => {
    const chat = whatsAppChatLink(phone);
    return (
      <div key={phone} className="flex items-center gap-2 whitespace-nowrap">
        <a
          href={`tel:${phone}`}
          className="font-mono tabular-nums hover:underline"
        >
          {phone}
        </a>
        {chat && (
          <a
            href={chat}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${phone}`}
            className="text-xs font-medium text-good hover:underline"
          >
            WhatsApp
          </a>
        )}
      </div>
    );
  });
}
