import type { ReactNode } from "react";

/** A titled block on the Leave page, with a short note beside the title. */
export function LeaveSection({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: ReactNode;
  /** A button or links at the right of the title row. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
