"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { type ReviewLine, reviewKey } from "@/lib/domain/claim-review";
import { fromCents, sumRm, toCents } from "@/lib/format/money";

type LineKind = ReviewLine["kind"];

type ReviewState = {
  /** What was stored when the page loaded, by line. */
  stored: Readonly<Record<string, number>>;
  amountOf: (kind: LineKind, id: string) => string;
  setAmount: (kind: LineKind, id: string, value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  remark: string;
  setRemark: (value: string) => void;
  originalReceiptsReceived: boolean;
  setOriginalReceiptsReceived: (value: boolean) => void;
  /** Typed amounts that differ from the stored ones, to the sen. */
  changedLines: { kind: LineKind; id: string; amount: number }[];
  /** The claim's total with what is typed now. */
  total: number;
};

const ReviewContext = createContext<ReviewState | null>(null);

export function useClaimReview(): ReviewState {
  const state = useContext(ReviewContext);
  if (!state) throw new Error("useClaimReview needs a ClaimReviewProvider");
  return state;
}

const parseAmount = (text: string): number | null => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * What the MD or HR & Accounts is typing on a claim: line amounts, the reason, the remark and
 * the original-receipts tick. The sections around it are server-rendered and reach this state
 * through their amount cells and the footer.
 */
export function ClaimReviewProvider({
  stored,
  remark: initialRemark,
  originalReceiptsReceived: initialReceived,
  children,
}: {
  stored: Record<string, number>;
  remark: string;
  originalReceiptsReceived: boolean;
  children: ReactNode;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(stored).map(([key, amount]) => [key, amount.toFixed(2)]),
    ),
  );
  const [reason, setReason] = useState("");
  const [remark, setRemark] = useState(initialRemark);
  const [received, setReceived] = useState(initialReceived);

  const value = useMemo<ReviewState>(() => {
    const typed = (key: string) =>
      parseAmount(amounts[key] ?? "") ?? stored[key];
    const changedLines = Object.keys(stored).flatMap((key) => {
      const amount = parseAmount(amounts[key] ?? "");
      if (amount === null || toCents(amount) === toCents(stored[key]))
        return [];
      const [kind, id] = key.split(":") as [LineKind, string];
      return [{ kind, id, amount }];
    });
    return {
      stored,
      amountOf: (kind, id) => amounts[reviewKey(kind, id)] ?? "",
      setAmount: (kind, id, text) =>
        setAmounts((current) => ({ ...current, [reviewKey(kind, id)]: text })),
      reason,
      setReason,
      remark,
      setRemark,
      originalReceiptsReceived: received,
      setOriginalReceiptsReceived: setReceived,
      changedLines,
      total: sumRm(
        Object.keys(stored).map((key) => fromCents(toCents(typed(key)))),
      ),
    };
  }, [amounts, stored, reason, remark, received]);

  return (
    <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
  );
}

/** The amount box on a line the checker may change. */
export function ClaimAmountInput({
  kind,
  id,
  label,
}: {
  kind: LineKind;
  id: string;
  label: string;
}) {
  const { amountOf, setAmount } = useClaimReview();
  return (
    <Input
      type="number"
      inputMode="decimal"
      min="0"
      step="0.01"
      aria-label={label}
      value={amountOf(kind, id)}
      onChange={(event) => setAmount(kind, id, event.target.value)}
      className="ml-auto w-28 text-right font-mono tabular-nums"
    />
  );
}
