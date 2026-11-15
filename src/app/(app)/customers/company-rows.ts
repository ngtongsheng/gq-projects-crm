import { z } from "zod";
import type { CalendarDate } from "@/lib/format/date";
import { type CompanyStatus, companyStatus } from "./company-status";
import { type AccountType, CompanyType } from "./schemas";

export type CompanyInput = {
  id: string;
  name: string;
  companyType: CompanyType;
  rating: number;
  accountType: AccountType | null;
};

export type CompanyPersonInput = {
  id: string;
  companyId: string;
  name: string;
  ownerIds: string[];
};

export type CompanyRow = CompanyInput & {
  /** Distinct owners of the company's people, by name. The list shows the first two. */
  salespeople: { id: string; name: string }[];
  people: { id: string; name: string }[];
  lastVisit: CalendarDate | null;
  status: CompanyStatus;
};

/**
 * One row per company. Salespeople are the owners of its people; last visit is the latest
 * completed visit to any of them. Inputs are already limited by what the viewer may see.
 */
export function buildCompanyRows(
  companies: CompanyInput[],
  people: CompanyPersonInput[],
  lastVisitByPerson: Map<string, CalendarDate>,
  nameOfPerson: Map<string, string>,
  today: CalendarDate,
): CompanyRow[] {
  const peopleOf = Map.groupBy(people, (person) => person.companyId);

  return companies
    .map((company) => {
      const members = (peopleOf.get(company.id) ?? []).toSorted((a, b) =>
        a.name.localeCompare(b.name),
      );
      const ownerIds = new Set(members.flatMap((person) => person.ownerIds));
      const salespeople = [...ownerIds]
        .map((id) => ({ id, name: nameOfPerson.get(id) ?? "Unnamed" }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const lastVisit =
        members
          .map((person) => lastVisitByPerson.get(person.id))
          .filter((day): day is CalendarDate => day !== undefined)
          .sort()
          .at(-1) ?? null;
      return {
        ...company,
        salespeople,
        people: members.map(({ id, name }) => ({ id, name })),
        lastVisit,
        status: companyStatus(lastVisit, today),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// "inactive" includes companies never visited, as in the demo's "No visit 90+ days".
const StatusFilter = z.enum(["quiet", "inactive"]);

// Same convention as the people list: anything unrecognised means no filter.
const filterParams = z.object({
  q: z.string().trim().catch(""),
  owner: z.uuid().optional().catch(undefined),
  type: CompanyType.optional().catch(undefined),
  status: StatusFilter.optional().catch(undefined),
});
export type CompanyFilters = z.infer<typeof filterParams>;

export function parseCompanyFilters(
  params: Record<string, string | string[] | undefined>,
): CompanyFilters {
  return filterParams.parse({
    q: params.q ?? "",
    owner: params.owner,
    type: params.type,
    status: params.status,
  });
}

export function filterCompanies(
  rows: CompanyRow[],
  filters: CompanyFilters,
): CompanyRow[] {
  const query = filters.q.toLowerCase();
  return rows.filter((row) => {
    if (filters.owner && !row.salespeople.some((s) => s.id === filters.owner))
      return false;
    if (filters.type && row.companyType !== filters.type) return false;
    if (filters.status === "quiet" && row.status.kind !== "quiet") return false;
    if (
      filters.status === "inactive" &&
      row.status.kind !== "no_visit" &&
      row.status.kind !== "none"
    )
      return false;
    if (!query) return true;
    return (
      row.name.toLowerCase().includes(query) ||
      row.people.some((person) => person.name.toLowerCase().includes(query))
    );
  });
}
