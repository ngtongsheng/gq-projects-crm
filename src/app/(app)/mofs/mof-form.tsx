"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orderTotal } from "@/lib/domain/mof-totals";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatRm, parseRm } from "@/lib/format/money";
import { AccountType, AccountTypeLabel } from "../customers/schemas";
import { saveMof } from "./actions";
import {
  NONE,
  type Option,
  OptionalSelect,
  Row,
  Section,
  TextField,
} from "./mof-form-fields";
import { type LineDraft, MofLinesEditor } from "./mof-lines-editor";
import {
  JobScope,
  JobScopeLabel,
  MofStage,
  MofStageLabel,
  PreProceedCheckLabel,
} from "./schemas";

/** The form's starting values; `id` is blank for a new MOF. Blank text is "". */
export type MofDraft = {
  id: string;
  mofNo: string;
  loaDate: string;
  salespersonId: string;
  secondSalespersonId: string;
  projectId: string;
  companyName: string;
  projectName: string;
  loaNo: string;
  quoteNo: string;
  siteAddress: string;
  siteContactName: string;
  siteContactMobile: string;
  officePicId: string;
  customerContact: string;
  accountsContact: string;
  scope: JobScope;
  installerName: string;
  contractSum: number | null;
  voAmount: number;
  retentionPct: number;
  invoiceNo: string;
  invoiceDate: string;
  commissionType: AccountType;
  deliveryDate: string;
  stage: MofStage;
  latestUpdate: string;
  paymentChecked: boolean;
  approvalsInWriting: boolean;
  artworkSignedOff: boolean;
  dosPreApproved: boolean;
  lines: LineDraft[];
};

type MofFormProps = {
  draft: MofDraft;
  team: Option[];
  /** Awarded projects without an MOF, offered when registering a new one. */
  awardedProjects: Option[];
  canEdit: boolean;
  /** Present only for managers; the page never loads cost for anyone else. */
  cost?: number | null;
};

const amountText = (amount: number | null) =>
  amount === null || amount === 0 ? "" : String(amount);

export function MofForm({
  draft,
  team,
  awardedProjects,
  canEdit,
  cost,
}: MofFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contractSum, setContractSum] = useState(amountText(draft.contractSum));
  const [voAmount, setVoAmount] = useState(amountText(draft.voAmount));
  const editing = draft.id !== "";

  const typedContract = parseRm(contractSum || "0");
  const typedVo = parseRm(voAmount || "0");
  const total =
    typedContract === null || typedVo === null
      ? null
      : orderTotal({ contractSum: typedContract, voAmount: typedVo });
  // The database needs a reason for any change to the contract sum or VO.
  const totalChanged =
    editing &&
    (typedContract !== draft.contractSum || typedVo !== draft.voAmount);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveMof(formData);
      setError(result.error);
      if (result.error) return;
      if (editing) {
        toast.success("MOF saved.");
      } else {
        toast.success(`${draft.mofNo || "MOF"} registered.`);
        router.push(`/mofs/${result.mofId}`);
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      {editing && <input type="hidden" name="mofId" value={draft.id} />}
      <fieldset disabled={!canEdit || pending} className="flex flex-col gap-4">
        <Section title="Order">
          {!editing && (
            <Field>
              <FieldLabel htmlFor="projectPicker">From project</FieldLabel>
              <input type="hidden" name="projectId" value={draft.projectId} />
              <Select
                value={draft.projectId || NONE}
                onValueChange={(value) =>
                  router.push(
                    value === NONE ? "/mofs/new" : `/mofs/new?project=${value}`,
                  )
                }
              >
                <SelectTrigger id="projectPicker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    New project, not in the pipeline
                  </SelectItem>
                  {awardedProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Awarded projects fill in the customer, salesperson and value.
              </FieldDescription>
            </Field>
          )}
          {editing && (
            <input type="hidden" name="projectId" value={draft.projectId} />
          )}
          <Row>
            <TextField
              name="mofNo"
              label="MOF no."
              defaultValue={draft.mofNo}
              placeholder="e.g. MOF-2611"
              maxLength={50}
              required
            />
            <TextField
              name="loaDate"
              label="LOA / PO date"
              type="date"
              defaultValue={draft.loaDate}
              required
            />
          </Row>
          <Row>
            <Field>
              <FieldLabel htmlFor="salespersonId">Salesperson</FieldLabel>
              <Select
                name="salespersonId"
                defaultValue={draft.salespersonId || undefined}
              >
                <SelectTrigger id="salespersonId">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="secondSalespersonId">
                Second salesperson
              </FieldLabel>
              <OptionalSelect
                id="secondSalespersonId"
                name="secondSalespersonId"
                defaultValue={draft.secondSalespersonId}
                options={team}
                noneLabel="None"
              />
            </Field>
          </Row>
          <Row>
            <TextField
              name="companyName"
              label="Company"
              defaultValue={draft.companyName}
              required
            />
            <TextField
              name="projectName"
              label="Project"
              defaultValue={draft.projectName}
              required
            />
          </Row>
          <Row>
            <TextField
              name="loaNo"
              label="LOA / PO no."
              defaultValue={draft.loaNo}
              maxLength={100}
            />
            <TextField
              name="quoteNo"
              label="Quotation no."
              defaultValue={draft.quoteNo}
              maxLength={100}
            />
          </Row>
        </Section>

        <Section title="Site and contacts">
          <TextField
            name="siteAddress"
            label="Site address"
            defaultValue={draft.siteAddress}
            maxLength={500}
          />
          <Row>
            <TextField
              name="siteContactName"
              label="Site contact"
              defaultValue={draft.siteContactName}
              placeholder="Name"
            />
            <TextField
              name="siteContactMobile"
              label="Site contact no."
              defaultValue={draft.siteContactMobile}
              maxLength={50}
            />
          </Row>
          <Row>
            <TextField
              name="customerContact"
              label="Customer contact"
              defaultValue={draft.customerContact}
              placeholder="Name (mobile)"
            />
            <TextField
              name="accountsContact"
              label="Accounts contact"
              defaultValue={draft.accountsContact}
            />
          </Row>
          <Row>
            <Field>
              <FieldLabel htmlFor="officePicId">Office PIC</FieldLabel>
              <OptionalSelect
                id="officePicId"
                name="officePicId"
                defaultValue={draft.officePicId}
                options={team}
                noneLabel="Not set"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="scope">Job scope</FieldLabel>
              <Select name="scope" defaultValue={draft.scope}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JobScope.options.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {JobScopeLabel[scope]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Row>
          <Row>
            <TextField
              name="installerName"
              label="Installer"
              defaultValue={draft.installerName}
              placeholder="e.g. Leong"
              maxLength={100}
            />
            <span />
          </Row>
        </Section>

        <Section title="Products in this MOF">
          <FieldDescription>
            One line per product, each with its own stock type and supplier.
          </FieldDescription>
          <MofLinesEditor initialLines={draft.lines} disabled={!canEdit} />
        </Section>

        <Section title="Money">
          <Row>
            <Field>
              <FieldLabel htmlFor="contractSum">
                Contract sum (LOA) (RM)
              </FieldLabel>
              <Input
                id="contractSum"
                name="contractSum"
                inputMode="decimal"
                className="font-mono tabular-nums"
                placeholder="0.00"
                value={contractSum}
                onChange={(event) => setContractSum(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="voAmount">
                Variation orders / (omissions) (RM)
              </FieldLabel>
              <Input
                id="voAmount"
                name="voAmount"
                inputMode="decimal"
                className="font-mono tabular-nums"
                placeholder="Negative for an omission or credit note"
                value={voAmount}
                onChange={(event) => setVoAmount(event.target.value)}
              />
            </Field>
          </Row>
          <p className="text-sm">
            Order total (contract + VO):{" "}
            <span className="font-mono font-semibold tabular-nums">
              {total === null ? "–" : formatRm(total)}
            </span>
          </p>
          {totalChanged && (
            <Field>
              <FieldLabel htmlFor="reason">
                Reason for the change in order total
              </FieldLabel>
              <Input
                id="reason"
                name="reason"
                placeholder="e.g. CN-0412: 40 m² returned, quantity dispute"
                maxLength={300}
                required
              />
              <FieldDescription>
                Was{" "}
                {formatRm(
                  orderTotal({
                    contractSum: draft.contractSum ?? 0,
                    voAmount: draft.voAmount,
                  }),
                )}
                . The change and reason are kept in the history below.
              </FieldDescription>
            </Field>
          )}
          <Row>
            <Field>
              <FieldLabel htmlFor="retentionPct">Retention %</FieldLabel>
              <Input
                id="retentionPct"
                name="retentionPct"
                inputMode="decimal"
                className="font-mono tabular-nums"
                placeholder="0"
                defaultValue={amountText(draft.retentionPct)}
              />
            </Field>
            {cost !== undefined ? (
              <Field>
                <FieldLabel htmlFor="cost">Cost (RM) · internal</FieldLabel>
                <Input
                  id="cost"
                  name="cost"
                  inputMode="decimal"
                  className="font-mono tabular-nums"
                  placeholder="0.00"
                  defaultValue={cost === null ? "" : String(cost)}
                />
                <FieldDescription>
                  Seen only by the MD, Sales Director and HR & Accounts.
                </FieldDescription>
              </Field>
            ) : (
              <span />
            )}
          </Row>
          <Row>
            <TextField
              name="invoiceNo"
              label="Invoice no."
              defaultValue={draft.invoiceNo}
              maxLength={100}
            />
            <TextField
              name="invoiceDate"
              label="Invoice date"
              type="date"
              defaultValue={draft.invoiceDate}
            />
          </Row>
          <Row>
            <Field>
              <FieldLabel htmlFor="commissionType">Commission type</FieldLabel>
              <Select name="commissionType" defaultValue={draft.commissionType}>
                <SelectTrigger id="commissionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AccountType.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {AccountTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField
              name="deliveryDate"
              label="Delivery date"
              type="date"
              defaultValue={draft.deliveryDate}
            />
          </Row>
        </Section>

        <Section title="Progress">
          <Row>
            <Field>
              <FieldLabel htmlFor="stage">Project stage</FieldLabel>
              <Select name="stage" defaultValue={draft.stage}>
                <SelectTrigger id="stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MofStage.options.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {MofStageLabel[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField
              name="latestUpdate"
              label="Latest update"
              defaultValue={draft.latestUpdate}
              placeholder="e.g. PO issued to Unijoy, ETA 3 weeks"
              maxLength={300}
            />
          </Row>
          <p className="text-sm font-medium">
            Before proceeding · tick when done
          </p>
          {(
            Object.keys(
              PreProceedCheckLabel,
            ) as (keyof typeof PreProceedCheckLabel)[]
          ).map((check, index) => (
            <Field key={check} orientation="horizontal">
              <Checkbox id={check} name={check} defaultChecked={draft[check]} />
              <FieldLabel htmlFor={check} className="font-normal">
                {index + 1}. {PreProceedCheckLabel[check]}
              </FieldLabel>
            </Field>
          ))}
        </Section>

        {error && <FieldError>{error}</FieldError>}
        {canEdit && (
          <div>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Register MOF"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
