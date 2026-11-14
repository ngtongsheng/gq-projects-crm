import { describe, expect, it, vi } from "vitest";
import {
  couldSave,
  VIEW_ONLY_CODE,
  VIEW_ONLY_MESSAGE,
  viewOnlyFetch,
} from "./view-only-fetch";

const BASE = "https://project.supabase.co";

describe("couldSave", () => {
  it("lets reads through", () => {
    expect(couldSave(`${BASE}/rest/v1/contacts?select=*`, "GET")).toBe(false);
    expect(couldSave(`${BASE}/rest/v1/contacts`, "HEAD")).toBe(false);
    expect(couldSave(`${BASE}/auth/v1/user`, "get")).toBe(false);
  });

  it("catches every kind of change to a table", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(couldSave(`${BASE}/rest/v1/contacts`, method)).toBe(true);
    }
  });

  it("lets the listed read-only functions through and catches every other function", () => {
    expect(couldSave(`${BASE}/rest/v1/rpc/my_team`, "POST")).toBe(false);
    expect(couldSave(`${BASE}/rest/v1/rpc/save_mof`, "POST")).toBe(true);
    expect(couldSave(`${BASE}/rest/v1/rpc/brand_new_function`, "POST")).toBe(
      true,
    );
  });

  it("lets this browser's own session move, but no other account change", () => {
    expect(
      couldSave(`${BASE}/auth/v1/token?grant_type=refresh_token`, "POST"),
    ).toBe(false);
    expect(couldSave(`${BASE}/auth/v1/verify`, "POST")).toBe(false);
    expect(couldSave(`${BASE}/auth/v1/logout?scope=global`, "POST")).toBe(
      false,
    );
    expect(couldSave(`${BASE}/auth/v1/user`, "PUT")).toBe(true);
    expect(couldSave(`${BASE}/auth/v1/admin/generate_link`, "POST")).toBe(true);
    expect(couldSave(`${BASE}/auth/v1/admin/users/abc`, "DELETE")).toBe(true);
  });

  it("catches uploads", () => {
    expect(couldSave(`${BASE}/storage/v1/object/files/a.png`, "POST")).toBe(
      true,
    );
  });

  it("lets signed read links through, one file or several", () => {
    expect(
      couldSave(
        `${BASE}/storage/v1/object/sign/attachments/leave/a/b.jpg`,
        "POST",
      ),
    ).toBe(false);
    expect(
      couldSave(`${BASE}/storage/v1/object/sign/attachments`, "POST"),
    ).toBe(false);
  });

  it("still refuses signed upload links and every other way to change a file", () => {
    expect(
      couldSave(
        `${BASE}/storage/v1/object/upload/sign/attachments/leave/a/b.jpg`,
        "POST",
      ),
    ).toBe(true);
    expect(
      couldSave(
        `${BASE}/storage/v1/object/upload/sign/attachments/leave/a/b.jpg`,
        "PUT",
      ),
    ).toBe(true);
    expect(
      couldSave(`${BASE}/storage/v1/object/attachments/leave/a/b.jpg`, "POST"),
    ).toBe(true);
    expect(
      couldSave(
        `${BASE}/storage/v1/object/attachments/leave/a/b.jpg`,
        "DELETE",
      ),
    ).toBe(true);
    expect(couldSave(`${BASE}/storage/v1/object/move`, "POST")).toBe(true);
    expect(couldSave(`${BASE}/storage/v1/object/copy`, "POST")).toBe(true);
    expect(
      couldSave(`${BASE}/storage/v1/object/list/attachments`, "POST"),
    ).toBe(true);
    expect(couldSave(`${BASE}/storage/v1/object/sign`, "POST")).toBe(true);
    expect(
      couldSave(`${BASE}/storage/v1/object/sign/attachments/a/b.jpg`, "DELETE"),
    ).toBe(true);
    expect(
      couldSave(`${BASE}/storage/v1/object/signature/attachments/x`, "POST"),
    ).toBe(true);
  });
});

describe("viewOnlyFetch", () => {
  const ok = () => vi.fn(async () => new Response("[]", { status: 200 }));

  it("refuses a change while viewing, before it leaves the server", async () => {
    const send = ok();
    const guarded = viewOnlyFetch(async () => true, send);

    const response = await guarded(`${BASE}/rest/v1/contacts`, {
      method: "POST",
      body: "{}",
    });

    expect(send).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: VIEW_ONLY_CODE,
      message: VIEW_ONLY_MESSAGE,
    });
  });

  it("passes reads through while viewing", async () => {
    const send = ok();
    const guarded = viewOnlyFetch(async () => true, send);

    await guarded(`${BASE}/rest/v1/contacts?select=*`, { method: "GET" });

    expect(send).toHaveBeenCalledOnce();
  });

  it("passes changes through when nobody is viewing", async () => {
    const send = ok();
    const guarded = viewOnlyFetch(async () => false, send);

    await guarded(new Request(`${BASE}/rest/v1/contacts`, { method: "PATCH" }));

    expect(send).toHaveBeenCalledOnce();
  });
});
