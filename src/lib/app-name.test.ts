import { expect, test } from "vitest";
import { APP_NAME } from "./app-name";

test("app name is the company CRM name", () => {
  expect(APP_NAME).toBe("GQP Office");
});
