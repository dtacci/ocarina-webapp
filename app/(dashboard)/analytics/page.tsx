import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { isEnabled } from "@/lib/features";
import { getAnalytics } from "@/lib/db/queries/analytics";
import { AnalyticsSummary } from "@/components/analytics/analytics-summary";
import { DailySessions } from "@/components/analytics/daily-sessions";
import { ModeBreakdown } from "@/components/analytics/mode-breakdown";
import { BarHistogram } from "@/components/analytics/bar-histogram";
import { HorizontalBars } from "@/components/analytics/horizontal-bars";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const RANGES = [30, 90, 180, 365] as const;
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AnalyticsPage({ searchParams }: Props) {
  if (!isEnabled("analyticsDashboard")) notFound();

  const raw = await searchParams;
  const rangeParam = typeof raw.range === "string" ? parseInt(raw.range, 10) : NaN;
  const rangeDays = (RANGES as readonly number[]).includes(rangeParam)
    ? rangeParam
    : 90;

  const data = await getAnalytics(rangeDays);

  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i % 3 === 0 ? `${i}` : ""
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Personal session aggregates over the last {rangeDays} days.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => {
            const active = r === rangeDays;
            return (
              <Link
                key={r}
                href={`/analytics?range=${r}`}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full border bg-primary text-primary-foreground px-3 py-1 text-xs"
                    : "rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                }
              >
                {r}d
              </Link>
            );
          })}
        </div>
      </div>

      {!data.hasData ? (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <BarChart2 className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No sessions in this range</p>
            <p className="text-xs text-muted-foreground">
              Play on your Ocarina or try a longer range above.
            </p>
          </div>
        </div>
      ) : (
        <>
          <AnalyticsSummary
            totalSessions={data.totalSessions}
            totalMinutes={data.totalMinutes}
            avgMinutesPerSession={data.avgMinutesPerSession}
            rangeDays={data.rangeDays}
          />

          <DailySessions days={data.sessionsPerDay} />

          <div className="grid gap-3 md:grid-cols-2">
            <ModeBreakdown counts={data.sessionsByMode} />
            <BarHistogram
              title="Day of week"
              values={data.sessionsByDayOfWeek}
              labels={DOW_LABELS}
              emphasize={(_, v) =>
                v === Math.max(...data.sessionsByDayOfWeek)
              }
            />
          </div>

          <BarHistogram
            title="Hour of day (UTC)"
            values={data.sessionsByHour}
            labels={hourLabels}
            emphasize={(_, v) => v === Math.max(...data.sessionsByHour)}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <HorizontalBars
              title="Top vibes"
              items={data.topVibes.map((v) => ({
                label: v.vibe,
                value: v.count,
              }))}
              emptyText="No vibes logged yet."
            />
            <HorizontalBars
              title="Top kits"
              items={data.topKits.map((k) => ({
                label: k.kitName ?? k.kitId ?? "unknown",
                value: k.count,
              }))}
              emptyText="No kits logged yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
