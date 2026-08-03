"use client"

import { ArrowLeft, ArrowRight, Check, CircleCheck } from "lucide-react"
import { Bar, BarChart, XAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  DISTRIBUTION_SERIES,
  VALIDATION_ITEMS,
  type DistributionSeries,
} from "@/lib/training-data"

const histogramConfig = {
  count: { label: "빈도", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ValidationStep({
  onBack,
  onNext,
}: {
  onBack: () => void
  onNext: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-2">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            4
          </span>
          <div>
            <h2 className="text-lg font-semibold">데이터 검증</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              업로드한 데이터가 추가 학습에 적합한지 검증합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Validation results */}
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold">검증 결과</h3>
            <ul className="flex flex-col gap-3">
              {VALIDATION_ITEMS.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                      <Check className="size-3.5" />
                    </span>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Distribution */}
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold">데이터 분포</h3>
            <div className="grid grid-cols-2 gap-4">
              {DISTRIBUTION_SERIES.map((series) => (
                <Histogram key={series.title} series={series} />
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CircleCheck className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              검증 완료
            </p>
            <p className="mt-0.5 text-sm text-emerald-700/80 dark:text-emerald-400/80">
              데이터가 추가 학습에 적합합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft />
            이전 단계
          </Button>
          <Button onClick={onNext}>
            다음: AI Training
            <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Histogram({ series }: { series: DistributionSeries }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-xs font-medium">{series.title}</span>
        <span className="text-[10px] text-muted-foreground">{series.unit}</span>
      </figcaption>
      <ChartContainer config={histogramConfig} className="h-[96px] w-full">
        <BarChart data={series.bins} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="bin"
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            fontSize={9}
            interval={0}
          />
          <Bar dataKey="count" fill="var(--color-count)" radius={2} />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
