import { describe, expect, it } from "vitest";
import {
  nextPickupNumberSchema,
  pickupSettingsSchema,
} from "./pickup-settings-schema";
import { pickupFormSchema, sampleSchema } from "./sample-schemas";

const sample = {
  product: "Carpet Tile",
  brand: "",
  sku: " xch-03 ",
  name: "",
  qty: "2",
  unit: "box",
  spec: "",
  notes: "",
};

describe("sampleSchema", () => {
  it("keeps the SKU in capitals and blank text as null", () => {
    expect(sampleSchema.parse(sample)).toMatchObject({
      sku: "XCH-03",
      brand: null,
      name: null,
      qty: 2,
    });
  });

  it("needs a SKU or a product name", () => {
    const result = sampleSchema.safeParse({ ...sample, sku: "" });
    expect(result.error?.issues[0]?.message).toBe(
      "Key in the SKU or the product name.",
    );
  });

  it("allows none left but not a blank or negative quantity", () => {
    expect(sampleSchema.safeParse({ ...sample, qty: "0" }).success).toBe(true);
    expect(sampleSchema.safeParse({ ...sample, qty: "" }).success).toBe(false);
    expect(sampleSchema.safeParse({ ...sample, qty: "-1" }).success).toBe(
      false,
    );
  });
});

const line = {
  sampleId: null,
  productName: "37,PRI-04",
  spec: "",
  qty: "1",
  unit: "pc",
  remarks: "",
};
const form = {
  personInCharge: "Wai Mun",
  contact: "012-3723925",
  method: "lalamove",
  appointmentOn: "2026-11-20",
  driverContact: "",
  vehicleNo: "",
  address: "",
  takenBy: "",
  forWhom: "",
  lines: [line],
};

describe("pickupFormSchema", () => {
  it("accepts a form with one row and reads blanks as null", () => {
    expect(pickupFormSchema.parse(form)).toMatchObject({
      takenBy: null,
      driverContact: null,
      lines: [{ sampleId: null, qty: 1, remarks: null }],
    });
  });

  it("takes at most 10 rows and at least 1", () => {
    expect(
      pickupFormSchema.safeParse({ ...form, lines: Array(11).fill(line) })
        .success,
    ).toBe(false);
    expect(pickupFormSchema.safeParse({ ...form, lines: [] }).success).toBe(
      false,
    );
  });

  it("needs a quantity above zero on every row", () => {
    expect(
      pickupFormSchema.safeParse({ ...form, lines: [{ ...line, qty: "0" }] })
        .success,
    ).toBe(false);
  });
});

describe("pickupSettingsSchema", () => {
  it("turns a Malaysian number into digits with the country code", () => {
    expect(
      pickupSettingsSchema.parse({
        bestLinkWhatsapp: "012-372 3925",
        driveFolderUrl: "",
      }),
    ).toEqual({ bestLinkWhatsapp: "60123723925", driveFolderUrl: null });
    expect(
      pickupSettingsSchema.parse({
        bestLinkWhatsapp: "+60 12-372 3925",
        driveFolderUrl: "https://drive.google.com/drive/folders/abc",
      }).bestLinkWhatsapp,
    ).toBe("60123723925");
  });

  it("refuses a number that is too short and a link that is not https", () => {
    expect(
      pickupSettingsSchema.safeParse({
        bestLinkWhatsapp: "123",
        driveFolderUrl: "",
      }).success,
    ).toBe(false);
    expect(
      pickupSettingsSchema.safeParse({
        bestLinkWhatsapp: "",
        driveFolderUrl: "drive.google.com/x",
      }).success,
    ).toBe(false);
  });
});

describe("nextPickupNumberSchema", () => {
  it("reads digits and refuses zero", () => {
    expect(nextPickupNumberSchema.parse({ nextNo: "25" }).nextNo).toBe(25);
    expect(nextPickupNumberSchema.safeParse({ nextNo: "0" }).success).toBe(
      false,
    );
  });
});
