import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";

export type Colleague = { id: string; name: string };

/** Ticked colleagues post as `inviteeId`; the activity gets them as pending invitations. */
export function InviteePicker({ colleagues }: { colleagues: Colleague[] }) {
  if (colleagues.length === 0) return null;
  return (
    <Field>
      <FieldLabel>Invite a colleague to go with you (optional)</FieldLabel>
      <p className="text-sm text-muted-foreground">
        It goes into their calendar when they accept.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border p-2">
        {colleagues.map((colleague) => (
          <Label key={colleague.id} className="gap-2 font-normal">
            <Checkbox name="inviteeId" value={colleague.id} />
            {colleague.name}
          </Label>
        ))}
      </div>
    </Field>
  );
}
