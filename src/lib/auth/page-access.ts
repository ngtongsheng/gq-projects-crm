import { loadAccessOverrides } from "./access-overrides";
import { canOpenPage, canSeeMargin, type PageKey, type Viewer } from "./pages";

export async function canOpen(viewer: Viewer, key: PageKey) {
  return canOpenPage(viewer, key, await loadAccessOverrides());
}

/** Sees an MOF's cost and margin; the database applies the same rule. */
export async function seesMofCost(viewer: Viewer) {
  return canSeeMargin(viewer, await loadAccessOverrides());
}
