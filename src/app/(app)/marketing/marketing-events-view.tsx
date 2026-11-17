"use client";

import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { ClaimPrintButton } from "../claims/claim-print-button";
import { MarketingEventCostDialog } from "./marketing-event-cost-dialog";
import { MarketingEventDialog } from "./marketing-event-dialog";
import { eventDates, MarketingEventPrint } from "./marketing-event-print";
import { MarketingEventSheet } from "./marketing-event-sheet";
import {
  type EventCostItem,
  eventListRows,
  eventSheet,
} from "./marketing-events";
import { MarketingExpenseDialog } from "./marketing-expense-dialog";
import type {
  EventCostLine,
  MarketingCategory,
  MarketingEvent,
  MarketingExpense,
} from "./marketing-types";

const head =
  "h-9 px-3.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";
const numberCell = "px-3.5 py-2.5 text-right font-mono tabular-nums";

type Dialog =
  | { kind: "event"; editing: boolean }
  | { kind: "cost"; line?: EventCostLine }
  | { kind: "expense"; expense: MarketingExpense };

type MarketingEventsViewProps = {
  events: readonly MarketingEvent[];
  expenses: readonly MarketingExpense[];
  categories: readonly MarketingCategory[];
  /** Vendor names offered when an expense-log line is edited from here. */
  vendors: readonly string[];
  /** The event the address asks for; the newest event when blank or unknown. */
  initialEventId: string | null;
  canEdit: boolean;
  today: string;
  printedBy: string;
};

/** The Events tab (demo mkEvtView): create an event, cost it, and see the budget against the actual cost. */
export function MarketingEventsView({
  events,
  expenses,
  categories,
  vendors,
  initialEventId,
  canEdit,
  today,
  printedBy,
}: MarketingEventsViewProps) {
  const t = useT();
  const [selectedId, setSelectedId] = useState(initialEventId);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const event = events.find((e) => e.id === selectedId) ?? events[0];
  const createButton = (
    <Button onClick={() => setDialog({ kind: "event", editing: false })}>
      <Plus data-icon="inline-start" />
      {t("Create event")}
    </Button>
  );

  if (!event) {
    return (
      <>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={CalendarDays}
            title={t("Create the event first")}
            description={t(
              "An event's costs are listed under the event. Create it, then add its costs.",
            )}
            action={canEdit ? createButton : undefined}
          />
        </div>
        {canEdit && dialog?.kind === "event" && (
          <MarketingEventDialog
            used={0}
            onSaved={setSelectedId}
            onDeleted={() => setSelectedId(null)}
            onClose={() => setDialog(null)}
          />
        )}
      </>
    );
  }

  const sheet = eventSheet(event, expenses, categories);
  const rows = eventListRows(events, expenses, categories);
  const dates = eventDates(event);
  const groups = [
    ...new Set(events.flatMap((e) => e.costs.map((cost) => cost.costGroup))),
  ].sort();

  function open(item: EventCostItem) {
    if (item.source === "sheet") {
      setDialog({
        kind: "cost",
        line: event?.costs.find((cost) => cost.id === item.id),
      });
      return;
    }
    const expense = expenses.find((e) => e.id === item.id);
    if (expense) setDialog({ kind: "expense", expense });
  }

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        {rows.length > 1 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-medium">
              {t("All events")}
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader className="bg-sunk">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={head}>{t("Event")}</TableHead>
                    <TableHead className={cn(head, "max-sm:hidden")}>
                      {t("Date")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right max-sm:hidden")}>
                      {t("Items")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right max-md:hidden")}>
                      {t("Budget")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right")}>
                      {t("Cost")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.id === event.id ? "selected" : undefined}
                      className="hover:bg-sunk"
                    >
                      <TableCell className="px-3.5 py-2.5 whitespace-normal">
                        <button
                          type="button"
                          aria-current={row.id === event.id}
                          onClick={() => setSelectedId(row.id)}
                          className="text-left font-medium hover:underline"
                        >
                          {row.name}
                        </button>
                        {row.venue && (
                          <p className="text-xs text-muted-foreground">
                            {row.venue}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 whitespace-nowrap max-sm:hidden">
                        {eventDates(row)}
                      </TableCell>
                      <TableCell className={cn(numberCell, "max-sm:hidden")}>
                        {row.items}
                      </TableCell>
                      <TableCell className={cn(numberCell, "max-md:hidden")}>
                        {row.budget === null ? "–" : formatRm(row.budget)}
                      </TableCell>
                      <TableCell
                        className={cn(numberCell, row.over && "text-bad")}
                      >
                        {formatRm(row.cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        <section className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <h2 className="font-heading text-lg font-semibold">{event.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[dates, event.venue].filter(Boolean).join(" · ")}
            </p>
            {event.notes && (
              <p className="text-sm text-muted-foreground">{event.notes}</p>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setDialog({ kind: "event", editing: true })}
                className="text-sm font-medium hover:underline"
              >
                {t("Edit event")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => setDialog({ kind: "event", editing: false })}
              >
                <Plus data-icon="inline-start" />
                {t("Create event")}
              </Button>
            )}
            <ClaimPrintButton label={t("Print / PDF")} />
            {canEdit && (
              <Button onClick={() => setDialog({ kind: "cost" })}>
                <Plus data-icon="inline-start" />
                {t("Add cost")}
              </Button>
            )}
          </div>
        </section>

        <MarketingEventSheet
          sheet={sheet}
          canEdit={canEdit}
          onOpenItem={open}
        />
      </div>

      <MarketingEventPrint
        event={event}
        sheet={sheet}
        printedOn={today}
        printedBy={printedBy}
        t={t}
      />

      {canEdit && dialog?.kind === "event" && (
        <MarketingEventDialog
          event={dialog.editing ? event : undefined}
          used={sheet.items.length}
          onSaved={setSelectedId}
          onDeleted={() => setSelectedId(null)}
          onClose={() => setDialog(null)}
        />
      )}
      {canEdit && dialog?.kind === "cost" && (
        <MarketingEventCostDialog
          key={dialog.line?.id ?? "new"}
          line={dialog.line}
          events={events}
          eventId={event.id}
          groups={groups}
          onClose={() => setDialog(null)}
        />
      )}
      {canEdit && dialog?.kind === "expense" && (
        <MarketingExpenseDialog
          expense={dialog.expense}
          categories={categories}
          events={events}
          vendors={vendors}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
