import { describe, expect, it } from "vitest";
import { forSalesperson, forSupervisor } from "./schedule-filters";

const DANIEL = "11111111-1111-4111-8111-111111111111";
const PRIYA = "22222222-2222-4222-8222-222222222222";
const RAJ = "33333333-3333-4333-8333-333333333333";
const SITI = "44444444-4444-4444-8444-444444444444";

const jobs = [
  {
    id: "a",
    salespersonId: DANIEL,
    secondSalespersonId: null,
    siteSupervisorId: RAJ,
  },
  {
    id: "b",
    salespersonId: PRIYA,
    secondSalespersonId: DANIEL,
    siteSupervisorId: SITI,
  },
  {
    id: "c",
    salespersonId: PRIYA,
    secondSalespersonId: null,
    siteSupervisorId: "",
  },
];
const bookings = [
  { id: "x", requestedBy: DANIEL, supervisorId: RAJ },
  { id: "y", requestedBy: PRIYA, supervisorId: SITI },
];

describe("forSalesperson", () => {
  it("shows everything when nobody is chosen", () => {
    const result = forSalesperson(jobs, bookings, undefined);
    expect(result.jobs).toHaveLength(3);
    expect(result.bookings).toHaveLength(2);
  });

  it("keeps the jobs where they are first or second salesperson, and their own bookings", () => {
    const result = forSalesperson(jobs, bookings, DANIEL);
    expect(result.jobs.map((job) => job.id)).toEqual(["a", "b"]);
    expect(result.bookings.map((booking) => booking.id)).toEqual(["x"]);
  });

  it("shows nothing for someone with no jobs or bookings", () => {
    const result = forSalesperson(jobs, bookings, RAJ);
    expect(result.jobs).toEqual([]);
    expect(result.bookings).toEqual([]);
  });
});

describe("forSupervisor", () => {
  it("shows every supervisor, and jobs without one, when unset", () => {
    const result = forSupervisor(jobs, bookings, undefined);
    expect(result.jobs).toHaveLength(3);
    expect(result.bookings).toHaveLength(2);
  });

  it("shows one supervisor's jobs and bookings", () => {
    const result = forSupervisor(jobs, bookings, RAJ);
    expect(result.jobs.map((job) => job.id)).toEqual(["a"]);
    expect(result.bookings.map((booking) => booking.id)).toEqual(["x"]);
  });

  it("shows no supervisors for none", () => {
    const result = forSupervisor(jobs, bookings, "none");
    expect(result.jobs).toEqual([]);
    expect(result.bookings).toEqual([]);
  });
});
