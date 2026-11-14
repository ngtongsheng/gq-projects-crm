import { formatRm } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";
import type { ClientLine, ClientOption } from "../../quote-client-view";

/** A figure without the RM prefix; the sheet says "Prices in Ringgit Malaysia". */
const figure = (amount: number): string =>
  formatRm(amount).replace(/^(-?)RM /, "$1");

const th =
  "border border-[#242e38] bg-[#eef1f4] px-1.5 py-1 text-[10px] font-bold uppercase";
const td = "border border-[#c9d0d6] px-1.5 py-1 align-top";
const num = "text-right tabular-nums";

function SingleOption({ option }: { option: ClientOption }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          <th className={`${th} w-10 text-left`}>S.No</th>
          <th className={`${th} text-left`}>Item</th>
          <th className={`${th} w-24 text-right`}>Qty</th>
          <th className={`${th} w-24 text-right`}>Rate</th>
          <th className={`${th} w-28 text-right`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {option.lines.map((line) => (
          <tr key={line.no} className="break-inside-avoid">
            <td className={td}>{line.no}</td>
            <td className={td}>
              <div className="font-bold">{line.product}</div>
              {line.detail.map((part) => (
                <div key={part} className="text-[10px] text-[#7a8691]">
                  {part}
                </div>
              ))}
            </td>
            <td className={`${td} ${num}`}>
              {formatQuantity(line.qty)}
              <div className="text-[10px] text-[#7a8691]">{line.unit}</div>
            </td>
            <td className={`${td} ${num}`}>{figure(line.rate)}</td>
            <td className={`${td} ${num}`}>{figure(line.amount)}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} className={`${td} ${num} uppercase`}>
            Total
          </td>
          <td className={`${td} ${num} font-bold`}>{formatRm(option.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function CompareCell({ line }: { line: ClientLine | undefined }) {
  if (!line) return <td colSpan={4} className={`${td} border-l-[#242e38]`} />;
  return (
    <>
      <td className={`${td} border-l-[#242e38]`}>{line.product}</td>
      <td className={`${td} ${num} whitespace-nowrap`}>
        {formatQuantity(line.qty)} {line.unit}
      </td>
      <td className={`${td} ${num}`}>{figure(line.rate)}</td>
      <td className={`${td} ${num}`}>{figure(line.amount)}</td>
    </>
  );
}

function CompareOptions({ options }: { options: ClientOption[] }) {
  const base = options[0];
  // Rows are positions, not records: lines of different options do not match up.
  const rows = Array.from(
    { length: Math.max(...options.map((option) => option.lines.length)) },
    (_, index) => index + 1,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {options.map((option) => (
          <div
            key={option.key}
            className="flex-1 break-inside-avoid border border-[#242e38] px-2 py-1.5"
          >
            <div className="text-[10px] font-bold uppercase">
              Option {option.key}
              {option.label && ` · ${option.label}`}
            </div>
            <div className="text-sm font-bold tabular-nums">
              {formatRm(option.total)}
            </div>
            <div className="text-[10px] text-[#7a8691]">
              {option === base
                ? "Base option"
                : `${option.total >= base.total ? "+" : "-"} ${formatRm(Math.abs(option.total - base.total))} vs Option ${base.key}`}
            </div>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th rowSpan={2} className={`${th} text-left`}>
              S.No
            </th>
            {options.map((option) => (
              <th key={option.key} colSpan={4} className={`${th} text-center`}>
                Option {option.key}
                {option.label && ` · ${option.label}`}
              </th>
            ))}
          </tr>
          <tr>
            {options.map((option) => (
              <PartHeads key={option.key} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((no) => (
            <tr key={no} className="break-inside-avoid">
              <td className={td}>{no}</td>
              {options.map((option) => (
                <CompareCell key={option.key} line={option.lines[no - 1]} />
              ))}
            </tr>
          ))}
          <tr>
            <td className={`${td} font-bold uppercase`}>Total</td>
            {options.map((option) => (
              <td
                key={option.key}
                colSpan={4}
                className={`${td} ${num} border-l-[#242e38] font-bold`}
              >
                {figure(option.total)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PartHeads() {
  return (
    <>
      <th className={`${th} text-left`}>Product</th>
      <th className={`${th} text-right`}>Qty</th>
      <th className={`${th} text-right`}>Rate (RM)</th>
      <th className={`${th} text-right`}>Amount (RM)</th>
    </>
  );
}

/** The body of the client quote: one option as a full table, or every option side by side. */
export function QuoteSheet({ options }: { options: ClientOption[] }) {
  const [only] = options;
  return (
    <>
      {options.length === 1 && only ? (
        <SingleOption option={only} />
      ) : (
        <CompareOptions options={options} />
      )}
      <p className="mt-2 text-[10px] text-[#7a8691]">
        Prices in Ringgit Malaysia.
      </p>
    </>
  );
}
