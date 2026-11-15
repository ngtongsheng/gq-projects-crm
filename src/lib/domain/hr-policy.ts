// Values mirror the check constraint on hr_policy_documents.category (the demo's HR_CATS).
export const POLICY_CATEGORIES = [
  "commission_target",
  "claims_expenses",
  "leave",
  "employment",
  "others",
] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_CATEGORY_LABEL: Record<PolicyCategory, string> = {
  commission_target: "Commission & sales target",
  claims_expenses: "Claims & expenses",
  leave: "Leave",
  employment: "Employment",
  others: "Others",
};

export type PolicyDocument = {
  id: string;
  category: PolicyCategory;
  title: string;
  version: string;
  effectiveOn: string;
  isCommissionScheme: boolean;
  /** The PDF is in storage; the file's own name is for display. */
  fileName: string | null;
  link: string | null;
  replacesId: string | null;
  note: string;
};

const newestFirst = (a: PolicyDocument, b: PolicyDocument) =>
  b.effectiveOn.localeCompare(a.effectiveOn) || a.title.localeCompare(b.title);

/**
 * Current and Older are not stored: a document is Older once another one names it as the one it
 * replaces (loop 16 D7). Newest effective date first.
 */
export function splitPolicies(documents: readonly PolicyDocument[]): {
  current: PolicyDocument[];
  older: PolicyDocument[];
} {
  const replaced = new Set(documents.map((document) => document.replacesId));
  return {
    current: documents
      .filter((document) => !replaced.has(document.id))
      .sort(newestFirst),
    older: documents
      .filter((document) => replaced.has(document.id))
      .sort(newestFirst),
  };
}

/** The Sales Target & Commission Scheme appendix HR summarises, from the current documents. */
export const currentScheme = (
  current: readonly PolicyDocument[],
): PolicyDocument | undefined =>
  current.find((document) => document.isCommissionScheme);
