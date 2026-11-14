/**
 * Foreign keys between the tables the example data fills: table -> column -> table it
 * points at. The reset uses them to clear rows the team added in the app under example
 * records, which would otherwise block deleting those records. Keep in step with the
 * migrations.
 */
export const EXAMPLE_REFERENCES: Record<string, Record<string, string>> = {
  contacts: { company_id: "companies" },
  contact_owners: { contact_id: "contacts" },
  ownership_requests: { contact_id: "contacts" },
  activities: { contact_id: "contacts" },
  activity_invitees: { activity_id: "activities" },
  projects: { contact_id: "contacts" },
  mofs: { project_id: "projects" },
  mof_lines: { mof_id: "mofs" },
  mof_costs: { mof_id: "mofs" },
  mof_total_changes: { mof_id: "mofs" },
  supplier_pos: { mof_id: "mofs" },
  installer_pos: { mof_id: "mofs" },
  installer_claims: { installer_po_id: "installer_pos" },
  jobs: { mof_id: "mofs" },
  delivery_orders: { mof_id: "mofs", job_id: "jobs" },
  site_bookings: { project_id: "projects" },
  site_logs: { mof_id: "mofs" },
  site_follow_ups: { site_log_id: "site_logs" },
  ot_claims: { mof_id: "mofs" },
  leftovers: { mof_id: "mofs" },
  stock_reservations: { item_id: "stock_items", project_id: "projects" },
  payments: { mof_id: "mofs" },
  commission_payouts: { mof_id: "mofs" },
};
