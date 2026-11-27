import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createClient } from "@/lib/supabase/server";
import { type ClaimPerson, loadClaimPeople } from "./claim-people-data";
import { countClaimsReadyToRelease } from "./ready-to-release-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./claim-people-data", () => ({ loadClaimPeople: vi.fn() }));

const MEI = "11111111-1111-4111-8111-111111111111";
const ALI = "22222222-2222-4222-8222-222222222222";
const DEV = "44444444-4444-4444-8444-444444444444";
const SAM = "55555555-5555-4555-8555-555555555555";

type Row = { profile_id: string; month: string };
type Report = Row & { status: string };

const person = (
  id: string,
  jobRole: JobRole,
  active = true,
): [string, ClaimPerson] => [
  id,
  { id, name: "Someone", jobRole, sells: false, active },
];

let reportsRead: Report[][] = [];

/** A database of submitted claims and monthly reports that applies the report filters. */
function givenDatabase(claims: Row[], reports: Report[]) {
  const client = {
    from: (table: string) => ({
      select: () => {
        if (table === "travel_claims") {
          return { eq: async () => ({ data: claims, error: null }) };
        }
        return {
          in: (_column: "profile_id", ids: string[]) => ({
            in: async (_other: "month", months: string[]) => {
              const rows = reports.filter(
                (report) =>
                  ids.includes(report.profile_id) &&
                  months.includes(report.month),
              );
              reportsRead.push(rows);
              return { data: rows, error: null };
            },
          }),
        };
      },
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  reportsRead = [];
  vi.mocked(loadClaimPeople).mockResolvedValue(
    new Map([
      person(MEI, "sales"),
      person(ALI, "sales"),
      person(DEV, "director"),
      person(SAM, "sales", false),
    ]),
  );
});

describe("countClaimsReadyToRelease", () => {
  it("counts each claim against its own month's report only", async () => {
    givenDatabase(
      [
        { profile_id: MEI, month: "2026-10-01" },
        { profile_id: MEI, month: "2026-11-01" },
        { profile_id: ALI, month: "2026-11-01" },
        { profile_id: DEV, month: "2026-11-01" },
        { profile_id: SAM, month: "2026-11-01" },
      ],
      [
        { profile_id: MEI, month: "2026-10-01", status: "approved" },
        { profile_id: MEI, month: "2026-11-01", status: "draft" },
        { profile_id: ALI, month: "2026-09-01", status: "submitted" },
        { profile_id: ALI, month: "2026-10-01", status: "submitted" },
        { profile_id: SAM, month: "2026-11-01", status: "submitted" },
      ],
    );
    // Mei's October claim and the Sales Director, who files no report.
    expect(await countClaimsReadyToRelease()).toBe(2);
    expect(reportsRead.flat().map((report) => report.month)).not.toContain(
      "2026-09-01",
    );
  });

  it("reads no reports when no claim is submitted", async () => {
    givenDatabase([], []);
    expect(await countClaimsReadyToRelease()).toBe(0);
    expect(reportsRead).toEqual([]);
  });
});
