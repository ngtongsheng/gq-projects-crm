type JobBySalesperson = {
  salespersonId: string;
  secondSalespersonId: string | null;
};
type BookingBySalesperson = { requestedBy: string };

/**
 * One salesperson's part of the installation schedule: the jobs on MOFs under their name (as first
 * or second salesperson) and the site supervisor bookings they asked for. Everything when nobody
 * is chosen.
 */
export function forSalesperson<
  J extends JobBySalesperson,
  B extends BookingBySalesperson,
>(
  jobs: readonly J[],
  bookings: readonly B[],
  who: string | undefined,
): { jobs: J[]; bookings: B[] } {
  if (!who) return { jobs: [...jobs], bookings: [...bookings] };
  return {
    jobs: jobs.filter(
      (job) => job.salespersonId === who || job.secondSalespersonId === who,
    ),
    bookings: bookings.filter((booking) => booking.requestedBy === who),
  };
}

/**
 * The site supervisors whose work is shown: one person, "none" for nobody, or everyone when
 * unset. A job with no supervisor yet shows only when everyone is shown.
 */
export function forSupervisor<
  J extends { siteSupervisorId: string },
  B extends { supervisorId: string },
>(
  jobs: readonly J[],
  bookings: readonly B[],
  sup: string | undefined,
): { jobs: J[]; bookings: B[] } {
  if (sup === undefined) return { jobs: [...jobs], bookings: [...bookings] };
  if (sup === "none") return { jobs: [], bookings: [] };
  return {
    jobs: jobs.filter((job) => job.siteSupervisorId === sup),
    bookings: bookings.filter((booking) => booking.supervisorId === sup),
  };
}
