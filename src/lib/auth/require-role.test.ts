import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "./current-profile";
import { requireRole } from "./require-role";

vi.mock("./current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const signedInAs = (role: Profile["role"]): Profile => ({
  id: "user-1",
  fullName: "Test User",
  role,
  jobRole: "sales",
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

describe("requireRole", () => {
  beforeEach(() => vi.mocked(getCurrentProfile).mockReset());

  it("lets an admin into admin pages", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("admin"));
    await expect(requireRole("admin")).resolves.toMatchObject({
      role: "admin",
    });
  });

  it("lets an admin into staff pages", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("admin"));
    await expect(requireRole("staff")).resolves.toMatchObject({
      role: "admin",
    });
  });

  it("lets staff into staff pages", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("staff"));
    await expect(requireRole("staff")).resolves.toMatchObject({
      role: "staff",
    });
  });

  it("sends staff away from admin pages", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(signedInAs("staff"));
    await expect(requireRole("admin")).rejects.toThrow("redirect:/");
  });

  it("sends a signed-out visitor to sign-in", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null);
    await expect(requireRole("staff")).rejects.toThrow("redirect:/sign-in");
  });
});
