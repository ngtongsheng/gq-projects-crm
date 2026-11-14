import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAccessOverrides } from "./access-overrides";
import { getCurrentProfile, type Profile } from "./current-profile";
import type { JobRole } from "./job-role";
import { requirePage } from "./require-page";

vi.mock("./current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("./access-overrides", () => ({ loadAccessOverrides: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

const signedInAs = (jobRole: JobRole): Profile => ({
  id: "user-1",
  fullName: "Test User",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

describe("requirePage", () => {
  beforeEach(() => {
    vi.mocked(loadAccessOverrides).mockResolvedValue({});
  });

  it("lets a role into its default page", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("sales"));
    await expect(requirePage("coll")).resolves.toMatchObject({
      jobRole: "sales",
    });
  });

  it("refuses a page the MD hid from the role", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("sales"));
    vi.mocked(loadAccessOverrides).mockResolvedValue({
      sales: { coll: false },
    });
    await expect(requirePage("coll")).rejects.toThrow("redirect:/not-allowed");
  });

  it("lets the MD in whatever the overrides say", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("md"));
    vi.mocked(loadAccessOverrides).mockResolvedValue({ md: { coll: false } });
    await expect(requirePage("coll")).resolves.toMatchObject({
      jobRole: "md",
    });
  });

  it("opens when any of the pages is allowed", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("site"));
    await expect(requirePage("rep", "srep")).resolves.toMatchObject({
      jobRole: "site",
    });
  });

  it("404s a page that is not built yet", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("md"));
    await expect(requirePage("cost")).rejects.toThrow("not-found");
  });

  it("sends a signed-out visitor to sign in", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null);
    await expect(requirePage("coll")).rejects.toThrow("redirect:/sign-in");
  });
});
