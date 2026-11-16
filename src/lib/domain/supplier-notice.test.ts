import { describe, expect, it } from "vitest";
import {
  type NoticeLine,
  pendingNotices,
  supplierEmails,
} from "./supplier-notice";

const line = (overrides: Partial<NoticeLine>): NoticeLine => ({
  id: "line",
  status: "reserved",
  sku: "SKU-1",
  supplier: "Mohawk",
  collection: "",
  qty: 10,
  unit: "box",
  projectName: "Tower A",
  expiresOn: "2026-11-30",
  supplierNotice: "reserve",
  supplierNotifiedAt: null,
  ...overrides,
});

describe("pendingNotices", () => {
  it("keeps lines the supplier has not been told about", () => {
    const lines = [
      line({ id: "new" }),
      line({ id: "told", supplierNotifiedAt: "2026-11-01T00:00:00Z" }),
      line({ id: "none", supplierNotice: null }),
    ];
    expect(pendingNotices(lines).map((l) => l.id)).toEqual(["new"]);
  });

  it("drops a notice the line has moved past", () => {
    const lines = [
      line({ id: "delivered", status: "delivered" }),
      line({ id: "released", status: "released", supplierNotice: "release" }),
      line({ id: "reserve-released", status: "released" }),
    ];
    expect(pendingNotices(lines).map((l) => l.id)).toEqual(["released"]);
  });
});

describe("supplierEmails", () => {
  const options = { sender: "Jess", today: "2026-11-15" };

  it("makes one draft per supplier covering every line", () => {
    const emails = supplierEmails(
      [
        line({ id: "a", supplier: "Mohawk" }),
        line({ id: "b", supplier: "Armstrong", sku: "SKU-2" }),
        line({
          id: "c",
          supplier: "Mohawk",
          sku: "SKU-3",
          supplierNotice: "release",
          status: "released",
        }),
      ],
      options,
    );

    expect(emails.map((e) => e.supplier)).toEqual(["Armstrong", "Mohawk"]);
    const mohawk = emails[1];
    expect(mohawk.lines).toEqual([
      { id: "a", notice: "reserve" },
      { id: "c", notice: "release" },
    ]);
    expect(mohawk.subject).toBe(
      "GQ Projects - stock reservation / release - 15 Nov 2026",
    );
    expect(mohawk.body).toContain("RESERVE");
    expect(mohawk.body).toContain("until 30 Nov 2026");
    expect(mohawk.body).toContain("RELEASE");
    expect(mohawk.body).toContain("- SKU-3: 10 box · project Tower A");
    expect(mohawk.body).toContain("Best regards,\nJess");
  });

  it("opens a draft with no address and the text encoded", () => {
    const [email] = supplierEmails([line({})], options);
    expect(email.mailto.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(email.mailto)).toContain("Dear Mohawk team");
  });

  it("states the new end date for an extension", () => {
    const [email] = supplierEmails(
      [line({ supplierNotice: "extend", expiresOn: "2026-12-14" })],
      options,
    );
    expect(email.body).toContain("EXTEND");
    expect(email.body).toContain("· until 14 Dec 2026");
  });
});
