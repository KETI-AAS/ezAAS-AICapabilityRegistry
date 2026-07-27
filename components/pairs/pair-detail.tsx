"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  Building2,
  CalendarRange,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Gauge,
  Heart,
  HelpCircle,
  Layers,
  Link2,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  SplitSquareHorizontal,
  Target,
  Timer,
  Workflow,
  Zap,
} from "lucide-react"

import { TaskBadge } from "@/components/registry/task-badge"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTaskThumbnail, type AssetPair } from "@/lib/registry-data"
import { cn } from "@/lib/utils"

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

/* ------------------------------------------------------------------ */
/* Derived, deterministic detail content (no extra data model needed) */
/* ------------------------------------------------------------------ */

function trainingInfo(pair: AssetPair) {
  const { model, dataset } = pair
  const seed = model.name.length + dataset.classCount
  const epochs = 80 + (seed % 40)
  const bestEpoch = Math.max(1, epochs - 6 - (seed % 8))
  return [
    { icon: CalendarRange, label: "학습 기간", value: `${dataset.createdAt} ~ ${model.version} 릴리스` },
    {
      icon: SplitSquareHorizontal,
      label: "데이터 분할",
      value: `Train ${dataset.splitRatio[0]} / Val ${dataset.splitRatio[1]} / Test ${dataset.splitRatio[2]}`,
    },
    { icon: Repeat, label: "Epoch", value: `${epochs} epochs` },
    { icon: Layers, label: "Batch Size", value: `${16 + (seed % 4) * 8}` },
    { icon: SlidersHorizontal, label: "Learning Rate", value: "1e-3 (cosine decay)" },
    { icon: Gauge, label: "Optimizer", value: "AdamW (weight decay 0.05)" },
    { icon: Target, label: "Best Epoch", value: `Epoch ${bestEpoch}` },
    { icon: Workflow, label: "학습 파이프라인", value: `${dataset.name} → ${model.framework} 학습 → AAS 등록` },
  ]
}

function performanceMetrics(pair: AssetPair) {
  const { model } = pair
  return [
    { label: pair.metric.label, value: pair.metric.value },
    { label: "mAP@50-95", value: (model.accuracy / 100 - 0.16).toFixed(3) },
    { label: "Precision", value: (model.precision / 100).toFixed(3) },
    { label: "Recall", value: (model.recall / 100).toFixed(3) },
  ]
}

const scopeByTask: Record<AssetPair["task"], string[]> = {
  "Object Detection": ["완성차 생산 라인", "출고 품질 검사", "외관 결함 자동 검출", "스마트 팩토리 비전 시스템"],
  Segmentation: ["정밀 결함 영역 분석", "표면 품질 측정", "자동 마스킹 검사", "공정 품질 모니터링"],
  Classification: ["양·불 판정 자동화", "제품 등급 분류", "라인 품질 선별", "검사 리포트 자동화"],
  OCR: ["부품 각인 판독", "라벨·시리얼 인식", "문서 자동화", "생산 이력 추적"],
  "Anomaly Detection": ["설비 이상 조기 감지", "예지 보전", "센서 이상 탐지", "라인 다운타임 예방"],
}

function applicationContext(pair: AssetPair) {
  const { dataset, model } = pair
  return {
    environment: `실제 산업 현장에서는 ${dataset.name}를 기반으로 한 검사·분석 작업을 빠르고 일관되게 수행해 품질을 보장하고 생산 효율을 높여야 합니다.`,
    background:
      "수작업 기반 검수는 시간과 비용이 많이 소요되고, 작업자별 편차로 인해 검출 누락이나 오탐이 발생할 수 있습니다.",
    purpose: model.purpose,
    strength:
      "다양한 조명·각도·노이즈 환경에 강건하며, 고속 추론을 통해 생산라인 속도 요구사항을 만족합니다.",
    scope: scopeByTask[pair.task],
  }
}

/** Illustrative NxN confusion matrix derived from class labels + accuracy. */
function confusionMatrix(pair: AssetPair) {
  const labels = pair.dataset.distribution.slice(0, 5).map((d) => d.label)
  const acc = pair.model.accuracy / 100
  const rows = labels.map((_, i) => {
    const total = 900 + ((i * 137 + pair.dataset.classCount * 53) % 500)
    const correct = Math.round(total * Math.max(0.86, acc - i * 0.01))
    return labels.map((__, j) => {
      if (i === j) return correct
      return (((i + 1) * (j + 2) * 7) % 13) + 1
    })
  })
  return { labels, rows }
}

function ioSummary(pair: AssetPair) {
  const { model, dataset } = pair
  const input = model.inputs[0]
  const output = model.outputs[0]
  return {
    input: {
      type: "이미지",
      format: dataset.storage.fileType,
      shape: input?.shape ?? "640 × 640 × 3",
      description: input?.description ?? model.input,
    },
    output: {
      type: model.resultType,
      format: output?.shape ?? output?.type ?? "-",
      classes: pair.dataset.classCount,
      description: output?.description ?? model.output,
    },
    labels: pair.dataset.distribution.map((d) => d.label),
  }
}

/* ------------------------------------------------------------------ */
/* Overview asset node                                                 */
/* ------------------------------------------------------------------ */

function AssetNode({ kind, pair }: { kind: "dataset" | "model"; pair: AssetPair }) {
  const isDataset = kind === "dataset"
  const Icon = isDataset ? Database : Cpu
  const image = getTaskThumbnail(isDataset ? pair.dataset.task : pair.model.task)
  const name = isDataset ? pair.dataset.name : pair.model.name
  const meta = isDataset
    ? [pair.dataset.labelType, `${pair.dataset.totalSamples} 장`, `${pair.dataset.classCount}종 라벨`, pair.dataset.storage.fileType]
    : [pair.model.framework, pair.model.version, pair.model.task]

  return (
    <div className="flex flex-1 items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <span className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
        <Image src={image || "/placeholder.svg"} alt={`${name} 미리보기`} fill className="object-cover" sizes="64px" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
            isDataset ? "bg-chart-3/10 text-chart-3" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-3.5" />
          {isDataset ? "AI Dataset" : "AI Model"}
        </span>
        <span className="truncate whitespace-nowrap text-lg font-semibold leading-tight" title={name}>
          {name}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {meta.map((m, i) => (
            <span key={m} className="flex items-center gap-2">
              {i > 0 && <span className="text-border">|</span>}
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function PairDetail({ pair }: { pair: AssetPair }) {
  const isValidated = pair.validation === "Validated"
  const training = trainingInfo(pair)
  const metrics = performanceMetrics(pair)
  const ctx = applicationContext(pair)
  const matrix = confusionMatrix(pair)
  const io = ioSummary(pair)
  const samples = pair.dataset.sampleImages?.length
    ? pair.dataset.sampleImages
    : [pair.dataset.image]
  const totalNum = Number.parseInt(pair.dataset.totalSamples.replace(/[^0-9]/g, ""), 10) || samples.length

  const headerStats = [
    { icon: Target, label: pair.metric.label, value: pair.metric.value },
    { icon: Download, label: "다운로드", value: formatCompact(pair.downloads) },
    { icon: Heart, label: "즐겨찾기", value: formatCompact(pair.stars) },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/pairs" />}>AI Asset Pairs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>페어 상세</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header: title (left) + quick stats (right) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TaskBadge task={pair.task} />
            {isValidated && (
              <Badge variant="secondary" className="gap-1 text-primary">
                <CheckCircle2 className="size-3.5" />
                AAS 검증 완료
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className="min-w-0 text-2xl font-semibold tracking-tight md:truncate md:whitespace-nowrap md:text-3xl"
              title={pair.title}
            >
              {pair.title}
            </h1>
            <Badge variant="secondary" className="gap-1.5">
              <Link2 className="size-3.5 text-primary" />
              Pair {pair.version}
            </Badge>
          </div>
        </div>

        <div className="flex items-stretch gap-2 sm:gap-4">
          {headerStats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex min-w-[92px] flex-col items-center gap-1 rounded-2xl px-4 py-2">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {label}
              </span>
              <span className="text-2xl font-semibold tabular-nums text-primary">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 1. Pair Overview — Dataset → Used for Training → Model */}
      <Card className="ring-1 ring-primary/10">
        <CardContent className="flex flex-col items-stretch gap-4 p-6 lg:flex-row lg:items-center">
          <AssetNode kind="dataset" pair={pair} />

          {/* Center relationship connector */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-2 px-2 lg:w-48">
            <div className="flex w-full items-center gap-2">
              <span className="hidden h-px flex-1 border-t border-dashed border-primary/40 lg:block" />
              <span className="flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary">
                <Link2 className="size-5" />
              </span>
              <span className="hidden h-px flex-1 border-t border-dashed border-primary/40 lg:block">
                <ArrowRight className="ml-auto -mt-2 size-4 text-primary/60" />
              </span>
            </div>
            <span className="text-sm font-semibold text-primary">Used for Training</span>
          </div>

          <AssetNode kind="model" pair={pair} />
        </CardContent>
      </Card>

      {/* 2. Application Context & Background */}
      <Card>
        <CardContent className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {/* Main heading + environment */}
          <div className="flex flex-col gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <h2 className="text-base font-semibold text-pretty">적용 환경 및 배경</h2>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{ctx.environment}</p>
          </div>

          <ContextBlock icon={HelpCircle} title="등장 배경" body={ctx.background} />
          <ContextBlock icon={Target} title="이 페어의 목적" body={ctx.purpose} />
          <ContextBlock icon={Zap} title="핵심 강점" body={ctx.strength} />

          {/* Scope tags */}
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              주요 활용 범위
            </span>
            <div className="flex flex-wrap gap-2">
              {ctx.scope.map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Details: Training / Performance / I-O Summary */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">세부 사항</h2>
        <Card>
          <CardContent className="grid gap-0 p-0 lg:grid-cols-3">
            {/* Training Information */}
            <div className="flex flex-col gap-4 p-6">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Timer className="size-4 text-primary" />
                학습 정보 (Training Information)
              </span>
              <div className="flex flex-col divide-y divide-border/60">
                {training.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {label}
                      </span>
                      <span
                        className="min-w-0 truncate whitespace-nowrap text-right text-sm font-medium"
                        title={value}
                      >
                        {value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Results */}
            <div className="flex flex-col gap-4 border-t border-border p-6 lg:border-l lg:border-t-0">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Gauge className="size-4 text-primary" />
                성능 결과 (Performance Results)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map((m) => (
                  <div key={m.label} className="flex flex-col gap-0.5 rounded-xl border border-border p-3">
                    <span className="text-xs text-muted-foreground text-pretty">{m.label}</span>
                    <span className="text-xl font-semibold tabular-nums text-primary">{m.value}</span>
                  </div>
                ))}
              </div>
              <ConfusionMatrix matrix={matrix} />
              <Link
                href={`/models/${pair.model.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                전체 평가 리포트 보기
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {/* Input / Output Summary */}
            <div className="flex flex-col gap-4 border-t border-border p-6 lg:border-l lg:border-t-0">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="size-4 text-primary" />
                입출력 요약 (I/O Summary)
              </span>

              <div className="flex items-stretch gap-2">
                {/* Input */}
                <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                  <span className="text-xs font-semibold text-primary">Input</span>
                  <span className="text-sm font-medium">{io.input.type}</span>
                  <IoRow label="형식" value={io.input.format} />
                  <IoRow label="크기" value={io.input.shape} />
                  <IoRow label="설명" value={io.input.description} />
                </div>

                <span className="flex items-center text-muted-foreground">
                  <ArrowRight className="size-5" />
                </span>

                {/* Output */}
                <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                  <span className="text-xs font-semibold text-chart-3">Output</span>
                  <span className="text-sm font-medium">{io.output.type}</span>
                  <IoRow label="형식" value={io.output.format} />
                  <IoRow label="클래스 수" value={`${io.output.classes}`} />
                  <IoRow label="설명" value={io.output.description} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  라벨 클래스 ({io.labels.length}종)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {io.labels.map((l) => (
                    <Badge key={l} variant="outline" className="font-normal">
                      {l}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Dataset preview / Model preview */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dataset Preview — light blue */}
        <Card className="border-chart-3/20 bg-chart-3/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-chart-3" />
              AI Dataset 상세보기
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  <Image src={getTaskThumbnail(pair.dataset.task)} alt={pair.dataset.name} fill className="object-cover" sizes="56px" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold leading-tight text-pretty">{pair.dataset.name}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{pair.dataset.labelType}</span>
                    <span className="text-border">|</span>
                    <span>{pair.dataset.totalSamples} 장</span>
                    <span className="text-border">|</span>
                    <span>{pair.dataset.classCount}종 라벨</span>
                    <span className="text-border">|</span>
                    <span>{pair.dataset.version}</span>
                  </div>
                </div>
              </div>
              <ImageGrid images={samples} cols={2} max={4} total={totalNum} />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {pair.dataset.description}
            </p>
            <Link
              href={`/datasets/${pair.dataset.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full bg-card")}
            >
              <Database data-icon="inline-start" />
              Dataset 상세 페이지로 이동
              <ArrowRight data-icon="inline-end" />
            </Link>
          </CardContent>
        </Card>

        {/* Model Preview — indigo */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4 text-primary" />
              AI Model 상세보기
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  <Image src={getTaskThumbnail(pair.model.task)} alt={pair.model.name} fill className="object-cover" sizes="56px" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold leading-tight text-pretty">{pair.model.name}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{pair.model.framework}</span>
                    <span className="text-border">|</span>
                    <span>{pair.model.version}</span>
                    <span className="text-border">|</span>
                    <span>{pair.model.task}</span>
                  </div>
                </div>
              </div>
              <ImageGrid
                images={[pair.model.resultImage, ...samples].filter(Boolean)}
                cols={3}
                max={6}
                total={totalNum}
              />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {pair.model.description}
            </p>
            <Link
              href={`/models/${pair.model.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full bg-card")}
            >
              <Cpu data-icon="inline-start" />
              Model 상세 페이지로 이동
              <ArrowRight data-icon="inline-end" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ContextBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof HelpCircle
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-primary" />
        {title}
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{body}</p>
    </div>
  )
}

function IoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2 text-xs">
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{label}</span>
      <span
        className="min-w-0 truncate whitespace-nowrap text-right font-medium"
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

function ImageGrid({
  images,
  cols,
  max,
  total,
}: {
  images: string[]
  cols: number
  max: number
  total: number
}) {
  const shown = images.slice(0, max)
  const hasMore = total > shown.length
  const extra = Math.max(0, total - shown.length)
  return (
    <div
      className={cn("grid w-40 shrink-0 gap-1", cols === 3 ? "grid-cols-3" : "grid-cols-2")}
    >
      {shown.map((src, i) => {
        const isLast = i === shown.length - 1 && hasMore
        return (
          <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
            <Image src={src || "/placeholder.svg"} alt={`샘플 ${i + 1}`} fill className="object-cover" sizes="60px" />
            {isLast && (
              <span className="absolute inset-0 flex items-center justify-center bg-foreground/60 text-xs font-semibold text-background">
                +{extra.toLocaleString()}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Labeled confusion matrix table using class labels. */
function ConfusionMatrix({
  matrix,
}: {
  matrix: { labels: string[]; rows: number[][] }
}) {
  const { labels, rows } = matrix
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
      <span className="text-xs font-medium text-muted-foreground">Confusion Matrix (Test Set)</span>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="p-1 text-left font-medium text-muted-foreground" />
              {labels.map((l) => (
                <th key={l} className="p-1 text-center font-medium text-muted-foreground">
                  <span className="line-clamp-1">{l}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={labels[i]}>
                <th className="whitespace-nowrap p-1 text-left font-medium text-muted-foreground">
                  {labels[i]}
                </th>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "p-1 text-center tabular-nums",
                      i === j ? "rounded bg-primary/15 font-semibold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {v.toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
