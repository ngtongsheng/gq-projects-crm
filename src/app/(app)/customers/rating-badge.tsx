import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { RatingLabel } from "./schemas";

const ratingTone: Record<number, StatusTone> = {
  1: "bad",
  2: "warn",
  3: "neutral",
  4: "info",
  5: "good",
};

export function RatingBadge({ rating }: { rating: number }) {
  return (
    <StatusBadge tone={ratingTone[rating] ?? "neutral"}>
      {rating} · {RatingLabel[rating]}
    </StatusBadge>
  );
}
