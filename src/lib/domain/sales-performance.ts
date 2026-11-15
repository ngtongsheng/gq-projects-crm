import { canLeadTeam, type JobRole } from "@/lib/auth/job-role";
import {
  hasSalesInYear,
  orderInvoice,
  salesIn,
  type VariationOrderSale,
} from "@/lib/domain/order-sales";
import { daysBetween } from "@/lib/format/date";
import { fromCents, sumRm, toCents } from "@/lib/format/money";
import type { MofStageKey } from "./mof-stages";

/** An order as the performance table counts it. Cancelled orders are not passed in. */
export type PerformanceOrder = {
  mofId: string;
  mofNo: string;
  projectName: string;
  companyName: string;
  stage: MofStageKey;
  salespersonId: string;
  /** "YYYY-MM-DD" */
  loaDate: string;
  contractSum: number;
  /** Each counts as sales in the month it was confirmed, not the LOA month. */
  variationOrders: readonly VariationOrderSale[];
  /** Everything paid against the order. */
  received: number;
  /** Null when no cost has been entered, or when the viewer may not see cost. */
  cost: number | null;
};

export type PerformancePerson = {
  id: string;
  name: string;
  /** The full-year target; the year's target is cut to the days they were here. */
  yearlyTarget: number | null;
  /** "YYYY-MM-DD" */
  joinedOn: string | null;
  /** "YYYY-MM-DD" */
  leftOn: string | null;
  jobRole: JobRole;
  /** The team lead, for the team comparison. */
  reportsTo: string | null;
};

export type PerformanceRow = {
  personId: string;
  name: string;
  /** Sales by month, January first: the contract sum in the LOA month, each VO in its confirmed month. */
  months: number[];
  ytd: number;
  /** The yearly target for the days in the year they were here; null without one. */
  target: number | null;
  /** The yearly target before it is cut for a join or leave date. */
  fullTarget: number | null;
  joinedOn: string | null;
  /** Year-to-date sales as a share of the target, to 0.1; null without a target. */
  achievedPct: number | null;
  /** Orders registered (LOA) in the year. */
  count: number;
  /** Margin as a share of sales, over the orders that have a cost; null when none do. */
  marginPct: number | null;
  marginYtd: number | null;
  /** Still owed on all their orders, whatever year they were registered. */
  outstanding: number;
  /** Received as a share of invoiced on all their orders; can pass 100 when overpaid. */
  collectedPct: number | null;
  /** Everything paid against all their orders, whatever year they were registered. */
  received: number;
};

const pct = (part: number, whole: number): number | null =>
  toCents(whole) > 0
    ? Math.round((toCents(part) * 1000) / toCents(whole)) / 10
    : null;

const sum = (values: readonly number[]) => sumRm([...values]);

type RowOwner = {
  personId: string;
  name: string;
  target: number | null;
  fullTarget: number | null;
  joinedOn: string | null;
};

function rowFor(
  owner: RowOwner,
  year: number,
  orders: readonly PerformanceOrder[],
): PerformanceRow {
  const inYear = orders.filter((order) => order.loaDate.startsWith(`${year}-`));
  const months = Array.from({ length: 12 }, (_, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
    return sum(orders.map((order) => salesIn(order, prefix)));
  });
  const ytd = sum(orders.map((order) => salesIn(order, `${year}-`)));

  const costed = inYear.filter((order) => order.cost !== null);
  const costedInvoice = sum(costed.map(orderInvoice));
  const marginYtd =
    costed.length === 0
      ? null
      : fromCents(
          toCents(costedInvoice) -
            toCents(sum(costed.map((order) => order.cost ?? 0))),
        );

  const invoiced = sum(orders.map(orderInvoice));
  const received = sum(orders.map((order) => order.received));
  return {
    ...owner,
    months,
    ytd,
    achievedPct: owner.target === null ? null : pct(ytd, owner.target),
    count: inYear.length,
    marginPct: marginYtd === null ? null : pct(marginYtd, costedInvoice),
    marginYtd,
    outstanding: fromCents(Math.max(0, toCents(invoiced) - toCents(received))),
    collectedPct: pct(received, invoiced),
    received,
  };
}

/**
 * The yearly target for the part of the year someone was here: only the days from the join date
 * in the year they joined, and only up to the leave date in the year they left. Zero before they
 * joined or after they left. Whole ringgit, as the office worked it out.
 */
export function proratedTarget(
  yearlyTarget: number,
  joinedOn: string | null,
  leftOn: string | null,
  year: number,
): number {
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  if ((joinedOn && joinedOn > last) || (leftOn && leftOn < first)) return 0;
  const from = joinedOn && joinedOn > first ? joinedOn : first;
  const to = leftOn && leftOn < last ? leftOn : last;
  if (from > to) return 0;
  if (from === first && to === last) return yearlyTarget;
  return Math.round(
    (yearlyTarget * (daysBetween(from, to) + 1)) /
      (daysBetween(first, last) + 1),
  );
}

/** "Joined 3 Mar 2026" in the year they joined, "Joins 1 Dec 2026" before they have. */
export function joinNote(
  joinedOn: string | null,
  year: number,
  today: string,
): { kind: "joined" | "joins"; date: string } | null {
  if (!joinedOn) return null;
  if (joinedOn > today) return { kind: "joins", date: joinedOn };
  return joinedOn.startsWith(`${year}-`)
    ? { kind: "joined", date: joinedOn }
    : null;
}

/** The month with the most sales (0 = January); the earliest when months tie. Null when nothing sold. */
export function bestMonth(
  months: readonly number[],
): { index: number; amount: number } | null {
  let best: { index: number; amount: number } | null = null;
  for (const [index, amount] of months.entries()) {
    if (toCents(amount) > 0 && (best === null || amount > best.amount)) {
      best = { index, amount };
    }
  }
  return best;
}

const targetFor = (person: PerformancePerson, year: number): number | null => {
  if (person.yearlyTarget === null) return null;
  return (
    proratedTarget(person.yearlyTarget, person.joinedOn, person.leftOn, year) ||
    null
  );
};

const ownerOf = (person: PerformancePerson, year: number): RowOwner => ({
  personId: person.id,
  name: person.name,
  target: targetFor(person, year),
  fullTarget: person.yearlyTarget,
  joinedOn: person.joinedOn,
});

const totalTarget = (targets: readonly (number | null)[]): number | null =>
  targets.some((target) => target !== null)
    ? sum(targets.map((target) => target ?? 0))
    : null;

/**
 * One row per salesperson for a year, and a total row. A person is listed when they have an order
 * or a variation order dated that year, or a target for the part of the year they were here. A
 * director with no orders at all is left out. The contract sum counts by the LOA date and each
 * variation order by its confirmed date, for the first salesperson.
 */
export function performanceRows(
  orders: readonly PerformanceOrder[],
  people: readonly PerformancePerson[],
  year: number,
): { rows: PerformanceRow[]; total: PerformanceRow } {
  const hasOrders = (person: PerformancePerson) =>
    orders.some((order) => order.salespersonId === person.id);
  const listed = people
    .filter((person) => {
      if (canLeadTeam(person.jobRole) && !hasOrders(person)) return false;
      return (
        targetFor(person, year) !== null ||
        orders.some(
          (order) =>
            order.salespersonId === person.id && hasSalesInYear(order, year),
        )
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = listed.map((person) =>
    rowFor(
      ownerOf(person, year),
      year,
      orders.filter((order) => order.salespersonId === person.id),
    ),
  );

  const listedIds = new Set(listed.map((person) => person.id));
  const total = rowFor(
    {
      personId: "total",
      name: "Total",
      target: totalTarget(rows.map((row) => row.target)),
      fullTarget: totalTarget(rows.map((row) => row.fullTarget)),
      joinedOn: null,
    },
    year,
    orders.filter((order) => listedIds.has(order.salespersonId)),
  );
  return { rows, total };
}

export type TeamTotals = {
  leadId: string;
  leadName: string;
  /** The lead first, then the salespeople who report to them. */
  memberNames: string[];
  row: PerformanceRow;
};

/**
 * One column per team for the side-by-side panel: each director (or marketing director) with
 * the salespeople who report to them, the lead counted in their own team. A lead with nobody
 * under them shows their own sales only. Someone who left before the year is not a team.
 */
export function teamComparison(
  orders: readonly PerformanceOrder[],
  people: readonly PerformancePerson[],
  year: number,
): TeamTotals[] {
  return people
    .filter(
      (person) =>
        canLeadTeam(person.jobRole) &&
        !(person.leftOn && person.leftOn < `${year}-01-01`),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((lead) => {
      const members = people
        .filter(
          (person) =>
            person.jobRole === "sales" && person.reportsTo === lead.id,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      const team = [lead, ...members];
      const ids = new Set(team.map((person) => person.id));
      return {
        leadId: lead.id,
        leadName: lead.name,
        memberNames: team.map((person) => person.name),
        row: rowFor(
          {
            personId: lead.id,
            name: `${lead.name}'s team`,
            target: totalTarget(team.map((person) => targetFor(person, year))),
            fullTarget: totalTarget(team.map((person) => person.yearlyTarget)),
            joinedOn: null,
          },
          year,
          orders.filter((order) => ids.has(order.salespersonId)),
        ),
      };
    });
}

export type PersonMofLine = {
  mofId: string;
  mofNo: string;
  projectName: string;
  companyName: string;
  /** "YYYY-MM-DD" */
  loaDate: string;
  stage: MofStageKey;
  /** Contract sum plus variation orders. */
  sales: number;
  /** Null when the order has no cost, or the viewer may not see cost. */
  marginPct: number | null;
  marginRm: number | null;
  collectedPct: number | null;
  outstanding: number;
};

/** The orders a person registered (LOA) in the year, newest first, for the row drilldown. */
export function personMofs(
  orders: readonly PerformanceOrder[],
  personId: string,
  year: number,
): PersonMofLine[] {
  return orders
    .filter(
      (order) =>
        order.salespersonId === personId &&
        order.loaDate.startsWith(`${year}-`),
    )
    .sort((a, b) => b.loaDate.localeCompare(a.loaDate))
    .map((order) => {
      const sales = orderInvoice(order);
      const marginRm =
        order.cost === null
          ? null
          : fromCents(toCents(sales) - toCents(order.cost));
      return {
        mofId: order.mofId,
        mofNo: order.mofNo,
        projectName: order.projectName,
        companyName: order.companyName,
        loaDate: order.loaDate,
        stage: order.stage,
        sales,
        marginPct: marginRm === null ? null : pct(marginRm, sales),
        marginRm,
        collectedPct: pct(order.received, sales),
        outstanding: fromCents(
          Math.max(0, toCents(sales) - toCents(order.received)),
        ),
      };
    });
}
