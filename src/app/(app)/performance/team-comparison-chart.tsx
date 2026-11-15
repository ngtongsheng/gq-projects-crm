import { formatRm } from "@/lib/format/money";

export type ChartTeam = { name: string; months: readonly number[] };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Theme chart tokens in the order they were checked to stay apart for colour-blind readers.
const FILL = [
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-1",
  "fill-chart-4",
  "fill-chart-5",
];
const SWATCH = [
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-1",
  "bg-chart-4",
  "bg-chart-5",
];

const WIDTH = 720;
const HEIGHT = 240;
const LEFT = 44;
const TOP = 16;
const BOTTOM = 24;
const GAP = 2;
const MAX_BAR = 24;
const ROUND = 4;

const compact = (value: number) =>
  Math.abs(value) >= 10_000
    ? `${Math.round(value / 1000).toLocaleString("en-MY")}K`
    : value.toLocaleString("en-MY");

/** A round step (1, 2 or 5 times a power of ten) that puts about four gridlines in the range. */
function niceStep(range: number): number {
  const rough = range / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

/** A column with its free end rounded and its baseline end square. */
function column(x: number, y: number, w: number, h: number, up: boolean) {
  const r = Math.min(ROUND, w / 2, h);
  return up
    ? `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
    : `M${x} ${y}V${y + h - r}Q${x} ${y + h} ${x + r} ${y + h}H${x + w - r}Q${x + w} ${y + h} ${x + w} ${y + h - r}V${y}Z`;
}

/**
 * Sales by month, one column per team in each month. Plain SVG on the theme's chart tokens; the
 * table next to it carries the same numbers, and each month's hover lists every team's value.
 */
export function TeamComparisonChart({
  teams,
  year,
}: {
  teams: readonly ChartTeam[];
  year: number;
}) {
  const values = teams.flatMap((team) => team.months);
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const step = niceStep(Math.max(top - bottom, 1));
  const max = Math.ceil(top / step) * step;
  const min = Math.floor(bottom / step) * step;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const y = (value: number) =>
    TOP + ((max - value) / (max - min || 1)) * plotHeight;
  const zero = y(0);
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, index) => min + index * step,
  );

  const slot = (WIDTH - LEFT) / 12;
  const bar = Math.min(
    MAX_BAR,
    (slot * 0.8 - GAP * (teams.length - 1)) / teams.length,
  );
  const groupWidth = bar * teams.length + GAP * (teams.length - 1);
  const highest = Math.max(...values);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {teams.map((team, index) => (
          <li key={team.name} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-2.5 rounded-xs ${SWATCH[index % SWATCH.length]}`}
            />
            {team.name}
          </li>
        ))}
      </ul>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Sales by month in ${year}, by team`}
        className="h-auto w-full"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={LEFT}
              x2={WIDTH}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={LEFT - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {compact(tick)}
            </text>
          </g>
        ))}
        {MONTHS.map((month, monthIndex) => {
          const left = LEFT + monthIndex * slot;
          const start = left + (slot - groupWidth) / 2;
          return (
            <g key={month}>
              <title>
                {`${month}: ${teams
                  .map(
                    (team) =>
                      `${team.name} ${formatRm(team.months[monthIndex])}`,
                  )
                  .join(" · ")}`}
              </title>
              <rect
                x={left}
                y={TOP}
                width={slot}
                height={plotHeight}
                className="fill-transparent hover:fill-sunk"
              />
              {teams.map((team, teamIndex) => {
                const value = team.months[monthIndex];
                if (value === 0) return null;
                const x = start + teamIndex * (bar + GAP);
                const h = Math.max(Math.abs(y(value) - zero), 2);
                const up = value > 0;
                return (
                  <g key={team.name}>
                    <path
                      d={column(x, up ? zero - h : zero, bar, h, up)}
                      className={FILL[teamIndex % FILL.length]}
                    />
                    {value === highest && (
                      <text
                        x={x + bar / 2}
                        y={zero - h - 4}
                        textAnchor="middle"
                        className="fill-foreground font-mono text-[10px]"
                      >
                        {compact(value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={left + slot / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {month}
              </text>
            </g>
          );
        })}
        <line
          x1={LEFT}
          x2={WIDTH}
          y1={zero}
          y2={zero}
          className="stroke-muted-foreground"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
