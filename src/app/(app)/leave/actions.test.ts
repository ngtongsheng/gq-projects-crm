import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import {
  applyForLeave,
  approveLeave,
  cancelLeave,
  rejectLeave,
} from "./actions";
import { addLeaveSlip, confirmOriginalSlip } from "./slip-actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ALI = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const MD = "33333333-3333-4333-8333-333333333333";
const HR = "44444444-4444-4444-8444-444444444444";
const LEAVE = "55555555-5555-4555-8555-555555555555";

const signedIn = (id: string, jobRole: Profile["jobRole"]) =>
  vi.mocked(requirePage).mockResolvedValue({
    id,
    fullName: "Someone",
    role: "staff",
    jobRole,
    arrangesStock: false,
    sells: false,
    seesMargin: false,
    commissionMode: "standard",
    yearlyTarget: null,
    language: "en",
  });

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { table: string; op: string; payload: unknown; filters: unknown[] };

/** Each query takes the next result in line; calls and rpc calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const rpcs: unknown[][] = [];
  const queue = [...results];
  const client = {
    rpc: vi.fn((name: string, args: unknown) => {
      rpcs.push([name, args]);
      return Promise.resolve(queue.shift() ?? { data: null, error: null });
    }),
    from: vi.fn((table: string) => {
      const call: Call = {
        table,
        op: "select",
        payload: undefined,
        filters: [],
      };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update"]) {
        query[step] = (payload?: unknown) => {
          call.op = step;
          call.payload = payload;
          return Object.assign(Promise.resolve(result), query);
        };
      }
      for (const step of ["select", "single", "maybeSingle"]) {
        query[step] = () => Object.assign(Promise.resolve(result), query);
      }
      query.eq = (...args: unknown[]) => {
        call.filters.push(["eq", ...args]);
        return Object.assign(Promise.resolve(result), query);
      };
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { calls, rpcs };
}

/** Ali's leave as stored: his team lead, then the MD. */
const leaveRow = (extra: Record<string, unknown> = {}) => ({
  data: {
    id: LEAVE,
    person_id: ALI,
    leave_type: "annual",
    status: "pending",
    starts_on: "2099-03-10",
    slip_path: null,
    leave_approval_steps: [
      { position: 2, approver_id: null, approver_role: "md", decision: null },
      { position: 1, approver_id: LEAD, approver_role: null, decision: null },
    ],
    ...extra,
  },
  error: null,
});
const saved = { data: [{ id: LEAVE }], error: null };
const ok = { data: null, error: null };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const applyFields = (fields: Record<string, string> = {}) =>
  form({
    leaveType: "annual",
    startsOn: "2027-03-10",
    endsOn: "2027-03-12",
    halfDay: "",
    reason: " Family trip ",
    ...fields,
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyForLeave", () => {
  it("adds the leave and hands back its id", async () => {
    signedIn(ALI, "sales");
    const { calls } = fakeSupabase({ data: { id: LEAVE }, error: null });
    expect(await applyForLeave(applyFields())).toEqual({
      error: null,
      id: LEAVE,
    });
    expect(calls[0]).toMatchObject({
      table: "leave_requests",
      op: "insert",
      payload: {
        leave_type: "annual",
        starts_on: "2027-03-10",
        ends_on: "2027-03-12",
        half_day: null,
        reason: "Family trip",
      },
    });
  });

  it("refuses a half day over more than one day", async () => {
    signedIn(ALI, "sales");
    const { calls } = fakeSupabase();
    expect(await applyForLeave(applyFields({ halfDay: "am" }))).toEqual({
      error: "A half day is one day only.",
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses an end before the start", async () => {
    signedIn(ALI, "sales");
    fakeSupabase();
    expect(await applyForLeave(applyFields({ endsOn: "2027-03-09" }))).toEqual({
      error: "The last day is before the first day.",
    });
  });

  it("shows the database's overlap message", async () => {
    signedIn(ALI, "sales");
    fakeSupabase({
      data: null,
      error: {
        code: "23514",
        message: "There is already leave on these dates.",
      },
    });
    expect(await applyForLeave(applyFields())).toEqual({
      error: "There is already leave on these dates.",
    });
  });
});

describe("approveLeave and rejectLeave", () => {
  it("lets the team lead decide through decide_leave", async () => {
    signedIn(LEAD, "director");
    const { rpcs } = fakeSupabase(leaveRow(), ok);
    expect(await approveLeave(LEAVE, " fine ")).toEqual({ error: null });
    expect(rpcs).toEqual([
      ["decide_leave", { leave_request: LEAVE, approve: true, remark: "fine" }],
    ]);
  });

  it("refuses your own leave without calling the database", async () => {
    signedIn(ALI, "sales");
    const { rpcs } = fakeSupabase(leaveRow());
    expect(await approveLeave(LEAVE, "")).toEqual({
      error: "Nobody approves their own leave.",
    });
    expect(rpcs).toHaveLength(0);
  });

  it("refuses to approve an MC before the slip is uploaded", async () => {
    signedIn(HR, "accounts");
    const { rpcs } = fakeSupabase(leaveRow({ leave_type: "mc" }));
    expect(await approveLeave(LEAVE, "")).toEqual({
      error: "Upload the slip before the leave is approved.",
    });
    expect(rpcs).toHaveLength(0);
  });

  it("refuses someone who is not the next approver", async () => {
    signedIn(HR, "accounts");
    fakeSupabase(leaveRow());
    expect(await rejectLeave(LEAVE, "")).toEqual({
      error: "This leave is waiting for someone else.",
    });
  });

  it("refuses rejected leave", async () => {
    signedIn(MD, "md");
    const { rpcs } = fakeSupabase(leaveRow({ status: "rejected" }));
    expect(await approveLeave(LEAVE, "")).toEqual({
      error: "This leave is not waiting for approval.",
    });
    expect(rpcs).toHaveLength(0);
  });

  it("asks for a reload when the database refuses a stale decision", async () => {
    signedIn(MD, "md");
    fakeSupabase(leaveRow(), { data: null, error: { code: "42501" } });
    expect(await rejectLeave(LEAVE, "")).toEqual({
      error: "This leave has just changed. Reload the page.",
    });
  });
});

describe("cancelLeave", () => {
  it("cancels the person's own pending leave", async () => {
    signedIn(ALI, "sales");
    const { calls } = fakeSupabase(leaveRow(), saved);
    expect(await cancelLeave(LEAVE)).toEqual({ error: null });
    expect(calls[1]).toMatchObject({
      op: "update",
      payload: { status: "cancelled" },
      filters: [
        ["eq", "id", LEAVE],
        ["eq", "status", "pending"],
      ],
    });
  });

  it("refuses approved leave that has started", async () => {
    signedIn(ALI, "sales");
    const { calls } = fakeSupabase(
      leaveRow({ status: "approved", starts_on: "2020-01-01" }),
    );
    expect(await cancelLeave(LEAVE)).toEqual({
      error: "Leave that has started or is closed cannot be cancelled.",
    });
    expect(calls).toHaveLength(1);
  });

  it("refuses someone else's leave, even for the MD", async () => {
    signedIn(MD, "md");
    fakeSupabase(leaveRow());
    expect(await cancelLeave(LEAVE)).toEqual({
      error: "Only the person on leave cancels it.",
    });
  });
});

describe("slips", () => {
  const slip = (path: string) => ({
    path,
    fileName: "mc.jpg",
    contentType: "image/jpeg",
  });

  it("records a slip uploaded to the leave's folder", async () => {
    signedIn(ALI, "sales");
    const { calls } = fakeSupabase(leaveRow({ leave_type: "mc" }), ok);
    expect(
      await addLeaveSlip(LEAVE, slip(`leave/${LEAVE}/1a2b3c4d-mc.jpg`)),
    ).toEqual({ error: null });
    expect(calls[1]).toMatchObject({
      op: "update",
      payload: {
        slip_path: `leave/${LEAVE}/1a2b3c4d-mc.jpg`,
        slip_file_name: "mc.jpg",
        slip_content_type: "image/jpeg",
      },
    });
  });

  it("refuses a slip from another folder", async () => {
    signedIn(ALI, "sales");
    const { calls } = fakeSupabase();
    expect(
      await addLeaveSlip(LEAVE, slip(`tasks/${LEAVE}/1a2b3c4d-mc.jpg`)),
    ).toEqual({ error: "The slip could not be read. Upload it again." });
    expect(calls).toHaveLength(0);
  });

  it("lets only HR & Accounts tick the original", async () => {
    signedIn(ALI, "sales");
    fakeSupabase(
      leaveRow({ leave_type: "mc", slip_path: `leave/${LEAVE}/a-mc.jpg` }),
    );
    expect(await confirmOriginalSlip(LEAVE, true)).toEqual({
      error: "Only HR & Accounts confirms the original slip.",
    });

    signedIn(HR, "accounts");
    const { calls } = fakeSupabase(
      leaveRow({ leave_type: "mc", slip_path: `leave/${LEAVE}/a-mc.jpg` }),
      ok,
    );
    expect(await confirmOriginalSlip(LEAVE, true)).toEqual({ error: null });
    expect(calls[1]).toMatchObject({
      payload: { original_given_to_hr: true },
    });
  });
});
