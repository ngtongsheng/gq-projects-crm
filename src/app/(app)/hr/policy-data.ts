import { z } from "zod";
import { POLICY_CATEGORIES, type PolicyDocument } from "@/lib/domain/hr-policy";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionSettings } from "../commission/commission-settings-data";
import { loadLeaveSetup } from "../leave/leave-data";

const documentRows = z.array(
  z.object({
    id: z.uuid(),
    category: z.enum(POLICY_CATEGORIES),
    title: z.string(),
    version: z.string(),
    effective_on: z.iso.date(),
    is_commission_scheme: z.boolean(),
    file_name: z.string().nullable(),
    link: z.string().nullable(),
    replaces_id: z.uuid().nullable(),
    note: z.string(),
  }),
);

/** Every policy document, current and older; row-level security lets only the MD and HR & Accounts read them. */
export async function loadPolicyDocuments(): Promise<PolicyDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_policy_documents")
    .select(
      "id, category, title, version, effective_on, is_commission_scheme, file_name, link, replaces_id, note",
    );
  if (error) throw new Error(`Could not load policies: ${error.message}`);
  return documentRows.parse(data).map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    version: row.version,
    effectiveOn: row.effective_on,
    isCommissionScheme: row.is_commission_scheme,
    fileName: row.file_name,
    link: row.link,
    replacesId: row.replaces_id,
    note: row.note,
  }));
}

export type ExtraRule = {
  id: string;
  startsOn: string;
  rule: string;
  addedBy: string;
};

const ruleRows = z.array(
  z.object({
    id: z.uuid(),
    starts_on: z.iso.date(),
    rule: z.string(),
    added_by: z.uuid(),
  }),
);

/** The rules added after the appendix, newest first. */
export async function loadExtraRules(): Promise<ExtraRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_extra_rules")
    .select("id, starts_on, rule, added_by")
    .order("starts_on", { ascending: false })
    .order("added_at", { ascending: false });
  if (error)
    throw new Error(`Could not load the extra rules: ${error.message}`);
  return ruleRows.parse(data).map((row) => ({
    id: row.id,
    startsOn: row.starts_on,
    rule: row.rule,
    addedBy: row.added_by,
  }));
}

export type SchemeGrade = {
  grade: string;
  basic: number | null;
  annualTarget: number;
  description: string;
};

const gradeRows = z.array(
  z.object({
    grade: z.string(),
    basic: z.coerce.number().nullable(),
    annual_target: z.coerce.number(),
    description: z.string(),
  }),
);

/** The grades J1 to M2 in promotion order. */
export async function loadSchemeGrades(): Promise<SchemeGrade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_grades")
    .select("grade, basic, annual_target, description")
    .order("position");
  if (error) throw new Error(`Could not load the grades: ${error.message}`);
  return gradeRows.parse(data).map((row) => ({
    grade: row.grade,
    basic: row.basic,
    annualTarget: row.annual_target,
    description: row.description,
  }));
}

/** Everything the Policies & schemes view shows, read together. */
export async function loadPoliciesData() {
  const [documents, rules, grades, commission, leaveSetup] = await Promise.all([
    loadPolicyDocuments(),
    loadExtraRules(),
    loadSchemeGrades(),
    loadCommissionSettings(),
    loadLeaveSetup(),
  ]);
  return {
    documents,
    rules,
    grades,
    commission,
    leaveDays: {
      annual: leaveSetup.policy.annualDays,
      mc: leaveSetup.policy.mcDays,
    },
  };
}
