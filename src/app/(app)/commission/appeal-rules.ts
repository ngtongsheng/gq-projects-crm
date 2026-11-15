export type AppealStatus = "pending" | "approved" | "rejected";

/** One appeal per person per order; the loader and the rows use the same key. */
export function appealKey(mofId: string, personId: string): string {
  return `${mofId}:${personId}`;
}

/**
 * A salesperson appeals their own line while a late cut is still taken off it, unless an appeal is
 * already waiting or approved. After a rejection they may send another (the database allows it).
 */
export function canSendAppeal(input: {
  linePersonId: string;
  myId: string;
  lateCut: number;
  appealStatus: AppealStatus | undefined;
}): boolean {
  return (
    input.linePersonId === input.myId &&
    input.lateCut > 0 &&
    (input.appealStatus === undefined || input.appealStatus === "rejected")
  );
}
