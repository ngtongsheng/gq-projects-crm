"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Selection = {
  /** Sample ids ticked in the list, to fill a pickup form in. */
  ticked: readonly string[];
  toggle: (sampleId: string) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

/** Shared by the list (ticks) and the pickup form buttons in the header and the toolbar. */
export function SampleSelectionProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const toggle = useCallback(
    (sampleId: string) =>
      setTicked((current) =>
        current.includes(sampleId)
          ? current.filter((id) => id !== sampleId)
          : [...current, sampleId],
      ),
    [],
  );
  const clear = useCallback(() => setTicked([]), []);
  const value = useMemo(
    () => ({ ticked, toggle, clear }),
    [ticked, toggle, clear],
  );
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSampleSelection(): Selection {
  const selection = useContext(SelectionContext);
  if (!selection) {
    throw new Error("useSampleSelection needs a SampleSelectionProvider.");
  }
  return selection;
}
