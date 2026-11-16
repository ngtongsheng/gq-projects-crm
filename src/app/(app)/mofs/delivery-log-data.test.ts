import { describe, expect, it } from "vitest";
import { readableDeliveryOrders } from "./delivery-log-data";

const order = (mofs: unknown) => ({
  job_id: "job-1",
  mof_id: "mof-1",
  running_no: "A",
  transporter: null,
  do_date: null,
  items: null,
  is_final: true,
  passed_to_supplier: false,
  signed_returned: false,
  jobs: { status: "scheduled", scheduled_on: "2026-11-20", notes: null },
  mofs,
});

describe("readableDeliveryOrders", () => {
  it("keeps DOs whose MOF the person can read", () => {
    const rows = readableDeliveryOrders([
      order({
        mof_no: "MOF-2026-001",
        company_name: "Orion",
        project_name: "Lobby",
        scope: "s_and_l",
      }),
    ]);
    expect(rows.map((row) => row.mofs.mof_no)).toEqual(["MOF-2026-001"]);
  });

  it("drops DOs whose MOF is hidden instead of failing the whole register", () => {
    expect(readableDeliveryOrders([order(null)])).toEqual([]);
  });
});
