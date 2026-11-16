"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  BOOKING_PURPOSE_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
} from "@/lib/domain/site-booking";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { answerBooking } from "./booking-actions";
import type { CalendarBooking } from "./booking-data";

type BookingCardProps = {
  booking: CalendarBooking;
  supervisor: string;
  requester: string;
  /** The booked supervisor is signed in and the booking is still waiting. */
  canAnswer: boolean;
};

/** A site supervisor booking in the day list; the booked supervisor confirms or declines it here. */
export function BookingCard({
  booking,
  supervisor,
  requester,
  canAnswer,
}: BookingCardProps) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3 text-sm",
        booking.status === "declined" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {booking.startTime}
        </span>
        <StatusBadge tone={BOOKING_STATUS_TONE[booking.status]}>
          {t(BOOKING_STATUS_LABEL[booking.status])}
        </StatusBadge>
      </div>
      <div className="min-w-0">
        <p className="font-medium">
          {t(BOOKING_PURPOSE_LABEL[booking.purpose])} · {supervisor}
        </p>
        {booking.siteLabel && (
          <p className="text-muted-foreground">{booking.siteLabel}</p>
        )}
        <p className="text-muted-foreground">
          {t("Booked by")} {requester}
        </p>
        {booking.notes && (
          <p className="text-muted-foreground">{booking.notes}</p>
        )}
        {booking.declineReason && (
          <p className="text-muted-foreground">
            {t("Reason:")} {booking.declineReason}
          </p>
        )}
      </div>
      {canAnswer && <AnswerButtons bookingId={booking.id} />}
    </div>
  );
}

export function AnswerButtons({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await answerBooking(bookingId, "confirmed", "");
      if (result.error) toast.error(result.error);
      else toast.success(t("Booking confirmed."));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={confirm} disabled={pending}>
        {t("Confirm")}
      </Button>
      <DeclineDialog bookingId={bookingId} />
    </div>
  );
}

function DeclineDialog({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decline() {
    startTransition(async () => {
      const result = await answerBooking(bookingId, "declined", reason);
      setError(result.error);
      if (!result.error) {
        toast.success(t("Booking declined."));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("Decline")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Decline booking")}</DialogTitle>
          <DialogDescription>
            {t("The person who booked you will see the reason.")}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`reason-${bookingId}`}>
            {t("Reason (optional)")}
          </FieldLabel>
          <Input
            id={`reason-${bookingId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("e.g. Can do 2pm instead")}
            maxLength={300}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button variant="destructive" onClick={decline} disabled={pending}>
          {t("Decline booking")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
