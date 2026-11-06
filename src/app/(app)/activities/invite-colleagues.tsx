"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { type InviteOptions, loadInviteOptions } from "./invite-actions";

/**
 * Colleagues to take along, e.g. a senior to a big presentation. Posts each one ticked as
 * `attendeeIds`; the activity counts for them too and shows on their calendar.
 */
export function InviteColleagues({
  activityId,
}: {
  activityId: string | null;
}) {
  const [options, setOptions] = useState<InviteOptions | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadInviteOptions(activityId)
      .then((loaded) => {
        if (!cancelled) setOptions(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  // Without the list the form still saves; the invitations are left as they were.
  if (failed) {
    return (
      <FieldDescription>
        The list of colleagues could not be loaded, so invitations stay as they
        are.
      </FieldDescription>
    );
  }
  if (!options) {
    return <FieldDescription>Loading colleagues...</FieldDescription>;
  }
  if (options.colleagues.length === 0) return null;

  return (
    <Field>
      <FieldLabel>Invite colleagues</FieldLabel>
      <input type="hidden" name="invitesShown" value="yes" />
      <FieldGroup className="gap-2">
        {options.colleagues.map((colleague) => (
          <Field key={colleague.id} orientation="horizontal">
            <Checkbox
              id={`attendee-${colleague.id}`}
              name="attendeeIds"
              value={colleague.id}
              defaultChecked={options.invited.includes(colleague.id)}
            />
            <FieldLabel
              htmlFor={`attendee-${colleague.id}`}
              className="font-normal"
            >
              {colleague.name}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
      <FieldDescription>
        They see it on their calendar and it counts as their activity too.
      </FieldDescription>
    </Field>
  );
}
