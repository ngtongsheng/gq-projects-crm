import { describe, expect, it } from "vitest";
import { optionalId, optionalText, textField } from "./form-fields";

describe("textField", () => {
  it("reads text and treats a missing field or a file as blank", () => {
    const form = new FormData();
    form.set("name", "Ann");
    form.set("file", new Blob(["x"]));
    expect(textField(form, "name")).toBe("Ann");
    expect(textField(form, "missing")).toBe("");
    expect(textField(form, "file")).toBe("");
  });
});

describe("optionalText", () => {
  it("trims, saves blank as null and refuses long text", () => {
    expect(optionalText(5).parse("  hi  ")).toBe("hi");
    expect(optionalText(5).parse("   ")).toBeNull();
    const long = optionalText(5).safeParse("123456");
    expect(long.success).toBe(false);
    expect(long.error?.issues[0].message).toBe("Keep this under 5 characters.");
  });
});

describe("optionalId", () => {
  it("saves blank as null and refuses anything but an id", () => {
    const id = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(optionalId().parse("")).toBeNull();
    expect(optionalId().parse(id)).toBe(id);
    const bad = optionalId("Pick a person from the list.").safeParse("x");
    expect(bad.error?.issues[0].message).toBe("Pick a person from the list.");
  });
});
