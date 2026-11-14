# Parity check: how a screen is compared with the demo

The demo (`docs/mockup/gqp-office-demo.html`) is the spec. A screen passes when, for every role that sees it and at
both widths (1280 px and 390 px), the structure matches and the screenshots look the same.

## Setup
- Demo: serve the folder (`cd docs/mockup && python3 -m http.server 3112`) and open
  `http://localhost:3112/gqp-office-demo.html` in Chrome (profile "Agent"). Pick the person in "Signed in as". Data is
  example data in localStorage; "Reset example data" restores it.
- App: `pnpm dev`, open it in a second tab, and use the dev role panel (bottom left) to sign in as the same person
  (task 14 of loop 11 seeds them). The panel needs the test copy connected (`connect-test-copy` skill).
- Resize with the Chrome window (1280 and 390 wide).

## Step 1: structure diff
Run the snippet below in both tabs (Chrome javascript tool) on the same screen and person. It detects which page it is
on and returns an outline: sidebar items in order, page heading, tile labels, filter controls, tab labels, table column
headers in order, button labels. Diff the two outputs. Any difference fails, unless it is logged as a deviation in
`docs/decisions.md`.

If a screen uses markup the map does not cover, add a selector to the map (not a one-off snippet) so the next check
benefits. The app's tile labels carry `data-tile-label` (`StatTile`); new app components that show tiles must keep it.

```js
(() => {
  const demo = !!document.querySelector("#tabs .nav-i");
  const sel = demo
    ? {
        scope: "#main",
        nav: "#tabs .nav-i .lbl",
        heading: "h1.page",
        tiles: ".tile .k",
        filters: "#main select, #main input:not([type=checkbox]):not([type=hidden])",
        tabs: "#main .seg button, #main [role=tab], #main .tabs button",
        cols: "#main th",
        buttons: "#main button",
      }
    : {
        scope: "main",
        nav: "[data-sidebar=menu-button] span",
        heading: "main h1",
        tiles: "main [data-slot=card-description], main [data-tile-label]",
        filters: "main select, main input:not([type=checkbox]):not([type=hidden]), main [role=combobox]",
        tabs: "main [role=tab]",
        cols: "main th",
        buttons: "main button",
      };
  const vis = (e) => e.offsetParent !== null || e.getClientRects().length > 0;
  const txt = (e) =>
    (e.textContent || e.placeholder || e.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim();
  const list = (q) => [...document.querySelectorAll(q)].filter(vis).map(txt).filter(Boolean);
  return JSON.stringify(
    {
      page: demo ? "demo" : "app",
      nav: list(sel.nav),
      heading: list(sel.heading),
      tiles: list(sel.tiles),
      filters: [...document.querySelectorAll(sel.filters)]
        .filter(vis)
        .map((e) => e.placeholder || e.getAttribute("aria-label") || e.name || e.id || e.tagName),
      tabs: list(sel.tabs),
      columns: list(sel.cols),
      buttons: list(sel.buttons),
    },
    null,
    1,
  );
})()
```

Notes: the demo's nav is `#tabs .nav-i .lbl`, its page heading `h1.page`, tiles `.tile .k`. The app's nav is
shadcn's `[data-sidebar=menu-button]`. The demo has one flat nav, the app groups by module (top tabs), so compare the
sidebar of the matching module against the demo's list; the module tabs are a known shell deviation until loop 11 task 07.

## Step 2: screenshots side by side
For the same screen, person and width, take one screenshot of each and compare spacing, grouping, alignment, colour,
empty and error states. Fix drift in the app, not in the demo.

## Checklist (copy into the task's report, one row per role and width)
- [ ] Sidebar items, order and labels
- [ ] Page heading and subtitle
- [ ] Tiles: labels, order, notes
- [ ] Filters and controls
- [ ] Tabs
- [ ] Table columns in order
- [ ] Buttons per role (hidden vs shown)
- [ ] 1280 px screenshots match
- [ ] 390 px screenshots match
- [ ] Every deviation is logged in `docs/decisions.md`

## Worked example: Dashboard as Vicky (MD), 2026-11-14
Demo, "Signed in as" Vicky, 1280 px (lists shortened where marked):

```json
{
 "page": "demo",
 "nav": ["Dashboard","Sales Calendar","Installation","Customers","Projects","Costing","MOF Register","Site Work","Stock","Collection","Commission","Claims","Team Reports","Director Report","HR","Guide","Sales Performance","People","Tasks","Tools & Forms","Leave"],
 "heading": ["Team dashboard"],
 "tiles": ["Team visits this month","New customers this month","Open pipeline","Awarded this month","Payment outstanding"],
 "filters": [],
 "tabs": ["Sales activity","MOF & projects"],
 "columns": ["Name","Visits / target","Sales (MOF) this month","Sales YTD / target","New","Open projects","Pipeline","No activity 90d+","October report"],
 "buttons": ["Sales activity","MOF & projects","Team & roles","Sales & visit targets","Open tasks","Weekly outcomes","Review","Open daily log","Open","Check","Decide","Reassign","Reassign","Reassign","Approve OT claim","Approve replacement leave","Reject","Open Sales Reports","Reset example data"]
}
```

App, same snippet on the app's sign-in page (the only screen reachable in this run, see below):

```json
{ "page": "app", "nav": [], "heading": [], "tiles": [], "filters": ["email","password"], "tabs": [], "columns": [], "buttons": ["Sign in","Forgot password?"] }
```

The snippet runs and detects both pages. The app's Dashboard run is pending: on 2026-11-14 the dev role panel refused
to sign in ("Adding people works on the preview link or the live site") because this laptop is not connected to the
test copy. The first loop that connects it (task 14 seeds the people) must replace this block with the app's Dashboard
output as MD and record any difference as a deviation or a fix.
