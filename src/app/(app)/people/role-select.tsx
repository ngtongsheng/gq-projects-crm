"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/lib/auth/current-profile";
import { changeRole } from "./actions";
import { roleSchema } from "./schemas";

type RoleSelectProps = { userId: string; role: Role; isSelf: boolean };

export function RoleSelect({ userId, role, isSelf }: RoleSelectProps) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const next = roleSchema.safeParse(value);
    if (!next.success) return;
    startTransition(async () => {
      const result = await changeRole({ userId, role: next.data });
      if (result.error) toast.error(result.error);
      else toast.success("Role updated.");
    });
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        size="sm"
        className="w-28"
        aria-label={isSelf ? "Your role" : "Role"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="staff">Staff</SelectItem>
      </SelectContent>
    </Select>
  );
}
