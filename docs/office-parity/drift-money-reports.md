# Drift: projects, MOF, collection, commission, claims, performance, reports

Spec: `docs/mockup/gqp-office-demo.html`. Analysed 2026-11-14 against the app at `a8ddcaa`. The app matches the old
demo on most of this scope; the work is the deltas below. All lists are team-filtered once loop 11 lands.

## Projects (`/projects`): minor, S
- Layout unchanged. Site role sees only projects where they are PIC or support. Chips use the team-filtered list.

## MOF Register / My Sales (`/mofs`, `/mofs/[id]`, `/mofs/summary`): minor layout, M-L data
- Layout same: tiles, sales by person, views MOFs / Full register / PO tracking / Delivery log / Installer claims,
  4-box checklist (`MOF_CHECKS` unchanged).
- Variation orders (new entity, `p.vos[]`, `sheetVO`): no, client ref, date, signed amount, description, qty, cost,
  needs-work flag. Each VO's amount counts as sales in the month it is confirmed (`salesPieces`). The app stores one
  `vo_amount`. A VO that needs work on a 100% job reopens it (default 95%, stage "Installation in progress", register
  stage "Delivered – installing") and raises an `addWork` alert for site supervisors until "OK, noted", with WhatsApp text
  (`addWorkText`). VO cost adds into MOF cost.
- Field-level change history (`mofDiff` → `p.chg[]`): contract, cost, installer, scope, pic, support, account type, LOA
  date, items. Reason required when the job is complete or the order total changes. Cost rows hidden from users without
  cost access. The app has only `mof_total_changes`.
- DO numbering and print: see `drift-site-stock.md` (Installation). Delivery status (`delStatus`): Not delivered,
  Scheduled, Partially delivered (n DOs), Fully delivered.

## Collection (`/collection`): none beyond team filter.

## Commission (`/commission`, `/commission/settings`): minor layout, M rules
- Second late-collection cut moves from 120 to 180 days (`late2`); app default in
  `src/lib/domain/commission-settings.ts`. Cuts stay 25% after 90 days, 50% after 180.
- Late-collection appeal (`p.lateWaive[who]`): Pending / Approved / Rejected, reason (10+ chars), by, decision, reply.
  Approved sets the late cut to 0. Favour pill on the row; appeal and decide dialogs; "Appeals" tab under Claims.

## Claims (`vClaims` ~4240): missing, L
- One monthly claim per person (`mclaims`: who, month, status, exp[], comm[], otAmt, log). Cut-off day setting
  (default 25): dates after it roll to next month.
- Flow: Draft → Submitted → Checked (Jany) → Approved (Jany or Vicky) → Paid; Returned possible. Original vs final
  amount banners, remark, adjustment reasons, "original receipts received".
- Sections: (A) Commission lines at 90%+ paid, checkbox each, late cut shown, a pending claim blocks double claiming.
  (B) Travelling: Petrol, Toll, Parking, Outstation meals, Hotel, Mileage (0.60/km), Grab, Others; receipts numbered R1,
  R2 with a photo (not for mileage). Flags: no visit logged that day, hotel over budget, meals twice, >150 km/day, monthly
  cap on petrol+toll+parking. (C) OT / replacement leave rolled in.
- Gate: submit only after last month's report is submitted (`needRep`); `clRepOk` needs it reviewed + Vicky approved.
- Manager views: All claims (not-submitted list, approve), Appeals, Settings (cut-off, mileage rate, km/day, travel
  limit, needRep, late1/late2 and cut %).
- Print (`printClaim`): monthly claim form, sections A-C, Claimed / Checked / Approved signatures, original-vs-final box.
- Needs: HR package caps (`pkgNow`, `hotelCap`, `clCap`), OT rate, stored receipt images. Overtime (`/overtime`) folds
  into Claims; approvers Eddie, Vicky or Jany.

## Sales Performance (`/performance`): M
- Missing: VO timing (own month), prorated targets by join/leave (`annualT`, "Joined / Joins" note), tile row with
  Best month, row drilldown to the person's MOFs (Sales, Margin %, Margin RM, Collected, Outstanding, Status), team
  comparison panel with a monthly bar chart (two directors' teams). Eddie hidden when he has no awarded sales.

## Reports (`/reports`, `/reports/team`, `/reports/director`): M
- Two-step review: team lead (`leadOf`) or MD reviews, then Vicky's final "Approve (Vicky)" (`vickyOk`) for non-director
  kinds. Director reports go to Vicky only. Submission shows "Goes to <lead> & Vicky".
- "Print report": A4 with Prepared / Reviewed / Acknowledged signatures. BD report retitled "Marketing director monthly
  report".
- Site report restructured: (1) itinerary, one line per site per day, target n/50, scheduled vs added on the day,
  print form (`printSrep`); schedule check (`pvdPanel`); (2) shooting and handover table; (3) remarks. OT table and
  activity summary removed; stock-return counts added.

## WhatsApp hooks in this scope
- Monthly report reminder (`monMsg`, EN or BM): last working day 10:00 and 08:00 on the due day (first Monday, `dueT`).
  Per-person number and on/off. Weekly digest adds "claim not submitted, cut-off within 10 days" and "N claims to
  approve" for Jany and Vicky. VO additional-work notice to site supervisors.
