"use client";

/** The demo's "Show sold out": changes the list as soon as it is ticked. */
export function ShowSoldOutToggle({ checked }: { checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="sold"
        value="1"
        defaultChecked={checked}
        className="size-4 accent-primary"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      />
      Show sold out
    </label>
  );
}
