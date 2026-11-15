/** The segment control on Tools & Forms; each view is its own address so it survives a reload. */
export const TOOLS_VIEWS = ["wallpaper", "vinyl"] as const;
export type ToolsView = (typeof TOOLS_VIEWS)[number];

export const TOOLS_VIEW_LABEL: Record<ToolsView, string> = {
  wallpaper: "Wallpaper calculator",
  vinyl: "Vinyl sheet calculator",
};

export function parseToolsView(
  value: string | string[] | undefined,
): ToolsView {
  return TOOLS_VIEWS.find((view) => view === value) ?? "wallpaper";
}
