import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: a sales or BD report needs at least 3 highlights to be submitted, and the BD
// Director's needs the pass-down confirmation. Site reports have neither rule.

const needHighlights = "Fill in at least 3 highlights before submitting.";
const needConfirmation = "Tick the pass-down confirmation before submitting.";

let t: TestDatabase;
let monthsAgo = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

const highlights = (...achievements: string[]) =>
  JSON.stringify(
    achievements.map((achievement) => ({ company: "Co", achievement })),
  );

/** A draft for a month of its own (one report per person per month), then submit it. */
async function submit(options: { highlights: string; confirmed?: boolean }) {
  monthsAgo += 1;
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.monthly_reports (month, highlights, pass_downs_confirmed)
     values (date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date - make_interval(months => $1::int),
       $2::jsonb, $3) returning id`,
    [monthsAgo, options.highlights, options.confirmed ?? false],
  );
  return t.db.query(
    `update public.monthly_reports set status = 'submitted', stats = '{"salesVisits": 1}'::jsonb
     where id = $1`,
    [rows[0].id],
  );
}

describe("sales report", () => {
  beforeAll(() => t.actAs("sales"));

  it("refuses submitting with fewer than 3 highlights", async () => {
    await expect(submit({ highlights: highlights("a", "b") })).rejects.toThrow(
      needHighlights,
    );
  });

  it("does not count a blank highlight", async () => {
    await expect(
      submit({ highlights: highlights("a", "b", "  ") }),
    ).rejects.toThrow(needHighlights);
  });

  it("allows submitting with 3 highlights", async () => {
    await expect(
      submit({ highlights: highlights("a", "b", "c") }),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });
});

describe("BD report", () => {
  beforeAll(() => t.actAs("bd"));

  it("refuses submitting with fewer than 3 highlights", async () => {
    await expect(
      submit({ highlights: highlights("a", "b"), confirmed: true }),
    ).rejects.toThrow(needHighlights);
  });

  it("refuses submitting without the pass-down confirmation", async () => {
    await expect(
      submit({ highlights: highlights("a", "b", "c") }),
    ).rejects.toThrow(needConfirmation);
  });

  it("allows submitting with 3 highlights and the confirmation", async () => {
    await expect(
      submit({ highlights: highlights("a", "b", "c"), confirmed: true }),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });
});

describe("site report", () => {
  beforeAll(() => t.actAs("site"));

  it("allows submitting with no highlights", async () => {
    await expect(submit({ highlights: highlights() })).resolves.toMatchObject({
      affectedRows: 1,
    });
  });
});
