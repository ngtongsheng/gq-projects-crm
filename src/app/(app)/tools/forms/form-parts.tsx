import type { ReactNode } from "react";

export const FORM_BORDER = "border border-[#242e38]";
const LABEL = `${FORM_BORDER} bg-[#eef1f4] px-1.5 py-1 text-left text-[10px] font-bold uppercase`;
const CELL = `${FORM_BORDER} px-1.5 py-1 align-top`;

/** A grey band naming a part of the form, drawn over the table below it. */
export function FormSection({ title }: { title: string }) {
  return (
    <div
      className={`${FORM_BORDER} mt-3 break-after-avoid border-b-0 bg-[#dfe4e9] px-2 py-1 font-bold`}
    >
      {title}
    </div>
  );
}

/** Label and value pairs, two to a row (demo fmPair). */
export function FormPairs({
  rows,
}: {
  rows: [string, string, string, string][];
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([labelA, valueA, labelB, valueB]) => (
          <tr key={labelA}>
            <th scope="row" className={`${LABEL} w-[20%]`}>
              {labelA}
            </th>
            <td className={`${CELL} w-[30%]`}>{valueA}</td>
            <th scope="row" className={`${LABEL} w-[20%]`}>
              {labelB}
            </th>
            <td className={CELL}>{valueB}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Pairs of tick boxes, two to a row. */
export function FormTickPairs({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([left, right]) => (
          <tr key={left}>
            <td className={`${CELL} w-1/2`}>☐ {left}</td>
            <td className={CELL}>☐ {right}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small print in a ruled box that joins the table above or below it. */
export function FormNote({
  children,
  top = true,
  bottom = true,
}: {
  children: ReactNode;
  top?: boolean;
  bottom?: boolean;
}) {
  return (
    <div
      className={`${FORM_BORDER} px-2 py-1.5 text-[11px] leading-[1.45] ${top ? "" : "border-t-0"} ${bottom ? "" : "border-b-0"}`}
    >
      {children}
    </div>
  );
}

/** An empty box for the person to write in, headed by its label. */
export function FormWritingBox({
  label,
  hint,
  minHeight,
}: {
  label: string;
  hint?: string;
  minHeight: string;
}) {
  return (
    <div className={`${FORM_BORDER} mt-3 px-2 py-1.5`} style={{ minHeight }}>
      <b>{label}</b>
      {hint ? ` ${hint}` : ""}
    </div>
  );
}

/** A ruled table with a header row; `widths` are the column widths, "" for the rest. */
export function FormGrid({
  heads,
  widths,
  rows,
  rowHeight,
}: {
  heads: string[];
  widths: string[];
  rows: { key: string; cells: ReactNode[] }[];
  rowHeight?: string;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {heads.map((head, index) => (
            <th
              key={head}
              className={`${LABEL} text-center`}
              style={{ width: widths[index] || undefined }}
            >
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} style={{ height: rowHeight }}>
            {row.cells.map((cell, index) => (
              <td
                key={heads[index]}
                className={`${CELL} ${index === 0 ? "text-center" : ""}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The two-column signature table of the demo's forms: a head row, a tall signature row, then name rows. */
export function FormSignatures({
  heads,
  signatureCaptions,
  rows,
  signatureHeight = "46px",
}: {
  heads: [string, string];
  signatureCaptions: [string, string];
  rows: { key: string; left: ReactNode; right: ReactNode }[];
  signatureHeight?: string;
}) {
  return (
    <table className="mt-3 w-full break-inside-avoid border-collapse">
      <thead>
        <tr>
          <th className={`${LABEL} w-1/2`}>{heads[0]}</th>
          <th className={LABEL}>{heads[1]}</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ height: signatureHeight }}>
          <td className={`${CELL} align-bottom`}>{signatureCaptions[0]}</td>
          <td className={`${CELL} align-bottom`}>{signatureCaptions[1]}</td>
        </tr>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className={CELL}>{row.left}</td>
            <td className={CELL}>{row.right}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A tick-box checklist; each line has a Yes / No answer column. */
export function FormChecklist({ items }: { items: string[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th colSpan={3} className={`${LABEL} bg-[#dfe4e9] text-center`}>
            Checklist
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item}>
            <td className={`${CELL} w-9 text-center`}>☐</td>
            <td className={CELL}>{item}</td>
            <td className={`${CELL} w-[90px] text-center`}>Yes / No</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FormFootnote({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-center text-[11px]">{children}</p>;
}
