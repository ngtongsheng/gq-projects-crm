"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  canExtendHold,
  RESERVATION_STATUS_LABEL,
  type ReservationStatus,
  reservationMoves,
} from "@/lib/domain/reservation";
import { extendReservation, moveReservation } from "./actions";

const MOVE_LABEL: Partial<Record<ReservationStatus, string>> = {
  reserved: "Confirm",
  po_issued: "PO issued",
  delivered: "Delivered",
  released: "Release",
  cancelled: "Cancel",
};

/** What the people who arrange stock can do with a line next. Plain words, one click each. */
export function ReservationActions({
  reservationId,
  status,
  holdDays,
  mailto,
}: {
  reservationId: string;
  status: ReservationStatus;
  holdDays: number;
  mailto: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function run(
    action: (formData: FormData) => Promise<{ error: string | null }>,
    extra: Record<string, string>,
    done: string,
  ) {
    const formData = new FormData();
    formData.set("reservationId", reservationId);
    for (const [key, value] of Object.entries(extra)) formData.set(key, value);
    startTransition(async () => {
      const result = await action(formData);
      if (result.error) toast.error(result.error);
      else toast.success(done);
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {reservationMoves(status).map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "reserved" ? "default" : "outline"}
          disabled={pending}
          onClick={() =>
            run(
              moveReservation,
              { to },
              `Marked ${RESERVATION_STATUS_LABEL[to].toLowerCase()}.`,
            )
          }
        >
          {MOVE_LABEL[to]}
        </Button>
      ))}
      {canExtendHold(status) && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(extendReservation, {}, "Hold extended.")}
        >
          +{holdDays} days
        </Button>
      )}
      {mailto && (
        <Button size="sm" variant="ghost" asChild>
          <a href={mailto}>Email supplier</a>
        </Button>
      )}
    </div>
  );
}
