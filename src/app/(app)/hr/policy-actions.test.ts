import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { addPolicy, updatePolicy } from "./policy-actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const signedInAs = (jobRole: Profile["jobRole"]) =>
  vi.mocked(requirePage).mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
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

type Call = { op: string; payload: Record<string, unknown> };

function fakeSupabase(
  result: {
    error?: { code?: string; message?: string };
    rows?: unknown[];
  } = {},
) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn(() => {
      const call: Call = { op: "", payload: {} };
      calls.push(call);
      const query: Record<string, unknown> = {};
      const done = () =>
        Object.assign(
          Promise.resolve({
            data: result.rows ?? [{ id: ID }],
            error: result.error ?? null,
          }),
          query,
        );
      query.insert = (payload: Record<string, unknown>) => {
        Object.assign(call, { op: "insert", payload });
        return done();
      };
      query.update = (payload: Record<string, unknown>) => {
        Object.assign(call, { op: "update", payload });
        return done();
      };
      query.eq = () => done();
      query.select = () => done();
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const policy = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  replacesId: null,
  category: "leave",
  title: "Leave policy",
  version: "2026-11-01",
  effectiveOn: "2026-11-01",
  isCommissionScheme: false,
  link: "",
  note: "",
  file: null,
  ...overrides,
});

const pdf = (id = ID) => ({
  path: `hr-policies/${id}/1a2b3c4d-policy.pdf`,
  fileName: "Policy.pdf",
  contentType: "application/pdf",
});

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs("md");
});

describe("addPolicy", () => {
  it("saves the document with the one it replaces and its PDF", async () => {
    const calls = fakeSupabase();
    const result = await addPolicy(
      policy({ replacesId: OTHER_ID, file: pdf() }),
    );
    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toMatchObject({
      id: ID,
      replaces_id: OTHER_ID,
      link: null,
      file_path: pdf().path,
      file_name: "Policy.pdf",
      file_content_type: "application/pdf",
    });
  });

  it("refuses anyone but the MD and HR & Accounts", async () => {
    signedInAs("sales");
    const calls = fakeSupabase();
    const result = await addPolicy(policy());
    expect(result.error).toMatch(/Only the Managing Director/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a PDF stored under another document's folder", async () => {
    const calls = fakeSupabase();
    const result = await addPolicy(policy({ file: pdf(OTHER_ID) }));
    expect(result.error).toMatch(/Upload it again/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a link and a PDF together, and a link that is not https", async () => {
    const calls = fakeSupabase();
    expect(
      (await addPolicy(policy({ file: pdf(), link: "https://example.com/a" })))
        .error,
    ).toMatch(/not both/);
    expect(
      (await addPolicy(policy({ link: "http://example.com" }))).error,
    ).toMatch(/https/);
    expect(calls).toHaveLength(0);
  });

  it("tells her when someone already replaced that policy", async () => {
    fakeSupabase({
      error: {
        code: "23505",
        message:
          "duplicate key value violates hr_policy_documents_replaces_id_key",
      },
    });
    const result = await addPolicy(policy({ replacesId: OTHER_ID }));
    expect(result.error).toMatch(/already replaced/);
  });
});

describe("updatePolicy", () => {
  it("keeps the PDF when neither a new PDF nor a link is given", async () => {
    const calls = fakeSupabase();
    await updatePolicy(policy());
    expect(calls[0]?.payload).not.toHaveProperty("file_path");
    expect(calls[0]?.payload).toMatchObject({ link: null });
  });

  it("drops the PDF when a link is given instead", async () => {
    const calls = fakeSupabase();
    await updatePolicy(policy({ link: "https://drive.google.com/x" }));
    expect(calls[0]?.payload).toMatchObject({
      link: "https://drive.google.com/x",
      file_path: null,
      file_name: null,
    });
  });

  it("never changes what the document replaces", async () => {
    const calls = fakeSupabase();
    await updatePolicy(policy({ replacesId: OTHER_ID }));
    expect(calls[0]?.payload).not.toHaveProperty("replaces_id");
  });

  it("says so when the document is gone", async () => {
    fakeSupabase({ rows: [] });
    expect((await updatePolicy(policy())).error).toMatch(/Could not find/);
  });
});
