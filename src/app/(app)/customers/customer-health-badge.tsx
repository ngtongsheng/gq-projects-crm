import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import {
  type CustomerHealth,
  CustomerHealthLabel,
} from "@/lib/domain/customer-health";

const healthTone: Record<CustomerHealth, StatusTone> = {
  new: "info",
  active: "good",
  quiet: "warn",
  no_activity: "bad",
};

export function CustomerHealthBadge({ health }: { health: CustomerHealth }) {
  return (
    <StatusBadge tone={healthTone[health]}>
      {CustomerHealthLabel[health]}
    </StatusBadge>
  );
}
