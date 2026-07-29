"use client"

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  CircleDashed,
  Clock3,
  Copy,
  Database,
  Download,
  FileText,
  Info,
  Link2,
  LoaderCircle,
  Minus,
  Play,
  Power,
  RotateCcw,
  Server,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getTaskThumbnail, type Model } from "@/lib/registry-data"

type InstanceStatus = "provisioning" | "running" | "expired"
type InputType = "example" | "upload" | null
type MappingAction = "include" | "exclude" | "hold"
type MappingStatus = "auto" | "review" | "excluded"
type ExecutionStatus = "idle" | "running" | "complete"

type UploadedFileInfo = {
  name: string
  sizeLabel: string
  columns: string[]
  columnCount: number
  rowCount: number
  previewRows: string[][]
  uploadedAt: string
}

const SESSION_SECONDS = 30 * 60

const STEPS = [
  "입력 선택",
  "데이터 업로드",
  "Semantic Mapping",
  "테스트 실행",
  "결과 확인",
] as const

type MappingRow = {
  semanticId: string
  meaning: string
  column: string
  type: string
  confidence: number
  status: MappingStatus
}

const MAPPING_ROWS: MappingRow[] = [
  {
    semanticId: "IDTA:Property:temperature",
    meaning: "온도 (°C)",
    column: "TEMP_01",
    type: "float",
    confidence: 0.96,
    status: "auto",
  },
  {
    semanticId: "IDTA:Property:vibration.velocity",
    meaning: "진동 속도 (mm/s)",
    column: "VIB_VEL",
    type: "float",
    confidence: 0.94,
    status: "auto",
  },
  {
    semanticId: "IDTA:Property:spindle.rpm",
    meaning: "스핀들 회전수 (RPM)",
    column: "RPM_ACT",
    type: "int",
    confidence: 0.91,
    status: "auto",
  },
  {
    semanticId: "IDTA:Property:motor.current",
    meaning: "모터 전류 (A)",
    column: "MOTOR_A",
    type: "float",
    confidence: 0.62,
    status: "review",
  },
  {
    semanticId: "IDTA:Property:result.code",
    meaning: "결과 코드",
    column: "RESULT_CODE",
    type: "string",
    confidence: 0.98,
    status: "auto",
  },
  {
    semanticId: "IDTA:Property:air.pressure",
    meaning: "에어 압력 (bar)",
    column: "AIR_PRESS",
    type: "float",
    confidence: 0.58,
    status: "review",
  },
  {
    semanticId: "IDTA:Property:timestamp",
    meaning: "측정 시간",
    column: "TIMESTAMP",
    type: "datetime",
    confidence: 1.0,
    status: "auto",
  },
]

const PREVIEW_COLUMNS = [
  "TIMESTAMP",
  "MACHINE_ID",
  "TEMP_01",
  "VIB_VEL",
  "RPM_ACT",
  "MOTOR_A",
  "RESULT_CODE",
]

const PREVIEW_ROWS: string[][] = [
  ["2026-06-30 11:04:22", "CNC-PANGYO-014", "62.4", "3.12", "1492", "8.4", "NORMAL"],
  ["2026-06-30 11:04:23", "CNC-PANGYO-014", "62.8", "3.18", "1495", "8.6", "NORMAL"],
  ["2026-06-30 11:04:24", "CNC-PANGYO-014", "63.1", "7.84", "1521", "12.7", "WARNING"],
  ["2026-06-30 11:04:25", "CNC-PANGYO-007", "59.7", "2.94", "1480", "7.9", "NORMAL"],
  ["2026-06-30 11:04:26", "CNC-PANGYO-007", "60.2", "3.02", "1483", "8.1", "NORMAL"],
]

const PROCESS_STEPS = [
  { icon: Database, label: "AAS 스키마 로드" },
  { icon: Link2, label: "의미 기반 매칭" },
  { icon: SlidersHorizontal, label: "전처리 생성" },
  { icon: CircleCheck, label: "검증 및 검토" },
]

const PREPROCESSING_STEPS = [
  "데이터 타입 변환",
  "결측값 처리",
  "단위 정규화",
  "컬럼 순서 정렬",
  "Tensor 변환",
]

const EXECUTION_LOG = [
  "데이터 로드 완료",
  "Semantic Mapping 적용 완료",
  "자동 전처리 완료",
  "모델 입력 검증 완료",
  "모델 추론 중",
  "결과 생성 중",
  "완료",
]

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

function confidenceColor(value: number): string {
  if (value >= 0.8) return "bg-emerald-500"
  if (value >= 0.5) return "bg-amber-500"
  return "bg-red-500"
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatUploadedAt(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return { columns: [], rows: [] }
  const splitLine = (line: string) => line.split(",").map((cell) => cell.trim())
  return {
    columns: splitLine(lines[0]),
    rows: lines.slice(1).map(splitLine),
  }
}

/* ---------- Step indicator ---------- */

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <Card size="sm">
      <CardContent className="py-1">
        <ol className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((label, index) => {
            const stepNumber = index + 1
            const isComplete = stepNumber < currentStep
            const isCurrent = stepNumber === currentStep
            return (
              <li key={label} className="flex min-w-0 items-center gap-1">
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isComplete && "bg-primary text-primary-foreground",
                      isCurrent && "bg-primary text-primary-foreground",
                      !isComplete &&
                        !isCurrent &&
                        "border border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {isComplete ? <Check className="size-3.5" /> : stepNumber}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-sm",
                      isCurrent
                        ? "font-medium text-foreground"
                        : isComplete
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <Separator className="mx-2 hidden w-8 shrink-0 sm:block md:w-12" />
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

/* ---------- Status badge ---------- */

function StatusBadge({ status }: { status: MappingStatus }) {
  if (status === "auto") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
        자동 매핑
      </Badge>
    )
  }
  if (status === "review") {
    return (
      <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-500">
        검토 필요
      </Badge>
    )
  }
  return <Badge variant="secondary">제외됨</Badge>
}

/* ---------- Mapping action buttons ---------- */

function MappingActions({
  value,
  onChange,
}: {
  value: MappingAction
  onChange: (next: MappingAction) => void
}) {
  const base =
    "flex size-8 items-center justify-center rounded-md border transition-colors"
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={() => onChange("include")}
          className={cn(
            base,
            value === "include"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
          aria-label="모델 입력에 포함"
        >
          <Check className="size-4" />
        </TooltipTrigger>
        <TooltipContent>포함</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={() => onChange("hold")}
          className={cn(
            base,
            value === "hold"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
          aria-label="검토 후 결정 (보류)"
        >
          <Minus className="size-4" />
        </TooltipTrigger>
        <TooltipContent>보류</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={() => onChange("exclude")}
          className={cn(
            base,
            value === "exclude"
              ? "border-red-500 bg-red-500 text-white"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
          aria-label="모델 입력에서 제외"
        >
          <X className="size-4" />
        </TooltipTrigger>
        <TooltipContent>제외</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function ModelDeployWorkbench({ model }: { model: Model }) {
  const endpoint = `https://runtime.aas.ai/${model.id}/predict`

  const [instanceStatus, setInstanceStatus] =
    useState<InstanceStatus>("provisioning")
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_SECONDS)

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedInputType, setSelectedInputType] = useState<InputType>(null)
  const [fileInfo, setFileInfo] = useState<UploadedFileInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mappingActions, setMappingActions] = useState<
    Record<string, MappingAction>
  >(() =>
    Object.fromEntries(
      MAPPING_ROWS.map((row) => [
        row.semanticId,
        row.status === "review" ? "hold" : "include",
      ])
    )
  )

  const [executionStatus, setExecutionStatus] =
    useState<ExecutionStatus>("idle")
  const [logIndex, setLogIndex] = useState(-1)
  const logTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      setInstanceStatus("running")
    }, 1200)
    return () => window.clearTimeout(readyTimer)
  }, [])

  useEffect(() => {
    if (instanceStatus !== "running") return
    const countdown = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(countdown)
          setInstanceStatus("expired")
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(countdown)
  }, [instanceStatus])

  useEffect(() => {
    return () => {
      if (logTimer.current) window.clearInterval(logTimer.current)
    }
  }, [])

  const isRunning = instanceStatus === "running"
  const isExpired = instanceStatus === "expired"

  const terminateInstance = () => {
    setInstanceStatus("expired")
    setRemainingSeconds(0)
    toast.info("일회용 인스턴스가 종료되었습니다")
  }

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(endpoint)
    toast.success("Endpoint URL을 복사했습니다")
  }

  const uploaded = fileInfo !== null

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("CSV 파일만 업로드할 수 있습니다")
      return
    }
    try {
      const text = await file.text()
      const { columns, rows } = parseCsv(text)
      if (columns.length === 0) {
        toast.error("파일에서 컬럼을 읽지 못했습니다")
        return
      }
      setFileInfo({
        name: file.name,
        sizeLabel: formatBytes(file.size),
        columns,
        columnCount: columns.length,
        rowCount: rows.length,
        previewRows: rows.slice(0, 5),
        uploadedAt: formatUploadedAt(new Date()),
      })
      setSelectedInputType("upload")
      toast.success("CSV 파일 업로드가 완료되었습니다")
    } catch {
      toast.error("파일을 읽는 중 오류가 발생했습니다")
    }
  }

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) void processFile(file)
    event.target.value = ""
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  const canProceedFromUpload =
    selectedInputType === "example" ||
    (selectedInputType === "upload" && uploaded)

  const hasHold = Object.values(mappingActions).some((a) => a === "hold")
  const includedColumns = MAPPING_ROWS.filter(
    (row) => mappingActions[row.semanticId] === "include"
  )

  const runTest = () => {
    setExecutionStatus("running")
    setLogIndex(0)
    if (logTimer.current) window.clearInterval(logTimer.current)
    logTimer.current = setInterval(() => {
      setLogIndex((current) => {
        if (current >= EXECUTION_LOG.length - 1) {
          if (logTimer.current) window.clearInterval(logTimer.current)
          setExecutionStatus("complete")
          setCurrentStep(5)
          return current
        }
        return current + 1
      })
    }, 500)
  }

  const restart = () => {
    if (logTimer.current) window.clearInterval(logTimer.current)
    setCurrentStep(1)
    setSelectedInputType(null)
    setFileInfo(null)
    setExecutionStatus("idle")
    setLogIndex(-1)
    setMappingActions(
      Object.fromEntries(
        MAPPING_ROWS.map((row) => [
          row.semanticId,
          row.status === "review" ? "hold" : "include",
        ])
      )
    )
  }

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
        {/* Header */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative hidden size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted sm:block">
                <Image
                  src={getTaskThumbnail(model.task)}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Temporary Deploy</Badge>
                  <Badge variant="secondary" className="font-mono">
                    {model.version}
                  </Badge>
                </div>
                <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                  {model.name}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  모델을 설치하지 않고 브라우저에서 바로 테스트하는 일회용 추론 환경입니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/models/${model.id}`} />}
              >
                모델 상세
              </Button>
              <Button
                variant="destructive"
                onClick={terminateInstance}
                disabled={isExpired}
              >
                <Power />
                인스턴스 종료
              </Button>
            </div>
          </div>

          <Card size="sm">
            <CardContent className="flex flex-col gap-4 py-1 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {instanceStatus === "provisioning" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : isExpired ? (
                    <Power className="size-4" />
                  ) : (
                    <Activity className="size-4" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {instanceStatus === "provisioning"
                      ? "추론 환경을 준비하고 있습니다"
                      : isExpired
                        ? "인스턴스가 종료되었습니다"
                        : "인스턴스가 실행 중입니다"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {model.framework} · {model.architecture} · Shared GPU
                  </p>
                </div>
              </div>

              <Separator orientation="vertical" className="hidden h-9 lg:block" />

              <div className="flex items-center gap-3">
                <Clock3 className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {formatRemainingTime(remainingSeconds)}
                  </p>
                  <p className="text-xs text-muted-foreground">남은 사용 시간</p>
                </div>
              </div>

              <Separator orientation="vertical" className="hidden h-9 lg:block" />

              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {endpoint}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Endpoint URL 복사"
                  onClick={copyEndpoint}
                  disabled={!isRunning}
                >
                  <Copy />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {isExpired ? (
          <Alert>
            <Power />
            <AlertTitle>일회용 배포가 종료되었습니다</AlertTitle>
            <AlertDescription>
              모델 상세 화면에서 Deploy를 다시 눌러 새로운 세션을 시작할 수 있습니다.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <StepIndicator currentStep={currentStep} />

            {/* View 1: Input selection + Data upload */}
            {currentStep <= 2 && (
              <Card>
                <CardContent className="flex flex-col gap-8 py-2">
                  {/* Step 1 */}
                  <section className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">1. 입력 선택</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        테스트에 사용할 데이터를 선택해주세요.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputSourceCard
                        title="예제 데이터 사용"
                        description="등록된 연계 데이터셋의 샘플 데이터로 테스트를 진행합니다."
                        selected={selectedInputType === "example"}
                        onSelect={() => {
                          setSelectedInputType("example")
                          setFileInfo(null)
                        }}
                      />
                      <InputSourceCard
                        title="내 데이터 업로드"
                        description="CSV 파일을 직접 업로드하여 모델 적용 가능성을 검증합니다."
                        selected={selectedInputType === "upload"}
                        onSelect={() => setSelectedInputType("upload")}
                      />
                    </div>
                  </section>

                  {/* Example data path */}
                  {selectedInputType === "example" && (
                    <>
                      <Separator />
                      <section className="flex flex-col gap-4">
                        <div>
                          <h2 className="text-lg font-semibold">
                            2. 예제 데이터 확인
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            등록된 연계 데이터셋의 샘플이 이미 매핑되어 있어 별도의 업로드와 Semantic Mapping 없이 바로 테스트할 수 있습니다.
                          </p>
                        </div>
                        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Database className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              예제 데이터셋 · machine_sample.csv
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              7 컬럼 · 5,000 행 · Semantic Mapping 완료
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium">데이터 미리보기</h3>
                          <Badge variant="secondary">최대 5개 행</Badge>
                        </div>
                        <DataPreviewTable
                          columns={PREVIEW_COLUMNS}
                          rows={PREVIEW_ROWS}
                        />
                      </section>
                    </>
                  )}

                  {/* Upload data path */}
                  {selectedInputType === "upload" && (
                    <>
                      <Separator />
                      <section className="flex flex-col gap-4">
                        <div>
                          <h2 className="text-lg font-semibold">2. 데이터 업로드</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            내 컴퓨터에 있는 CSV 파일을 드래그하거나 클릭하여 업로드해주세요.
                          </p>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="sr-only"
                          onChange={handleFileInputChange}
                        />

                        {!uploaded ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={openFilePicker}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                openFilePicker()
                              }
                            }}
                            onDragOver={(event) => {
                              event.preventDefault()
                              setIsDragging(true)
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={cn(
                              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
                              isDragging
                                ? "border-primary bg-primary/5"
                                : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"
                            )}
                          >
                            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UploadCloud className="size-6" />
                            </span>
                            <div>
                              <p className="font-medium">
                                파일을 드래그하거나 클릭하여 업로드
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                CSV 파일만 업로드 가능합니다.
                              </p>
                            </div>
                          </div>
                        ) : (
                          fileInfo && (
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <FileText className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium">
                                      {fileInfo.name}
                                    </p>
                                    <Check className="size-4 shrink-0 text-emerald-500" />
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    CSV 파일 · {fileInfo.columnCount} 컬럼 ·{" "}
                                    {fileInfo.rowCount.toLocaleString()} 행 ·{" "}
                                    {fileInfo.sizeLabel}
                                  </p>
                                </div>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label="파일 삭제"
                                  onClick={() => setFileInfo(null)}
                                >
                                  <Trash2 />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 divide-border rounded-xl border border-border text-center sm:grid-cols-5 sm:divide-x">
                                <FileStat label="확장자" value="CSV" />
                                <FileStat
                                  label="컬럼 수"
                                  value={String(fileInfo.columnCount)}
                                />
                                <FileStat
                                  label="총 행수"
                                  value={fileInfo.rowCount.toLocaleString()}
                                />
                                <FileStat
                                  label="파일 크기"
                                  value={fileInfo.sizeLabel}
                                />
                                <FileStat
                                  label="업로드 일시"
                                  value={fileInfo.uploadedAt}
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium">
                                  데이터 미리보기
                                </h3>
                                <Badge variant="secondary">최대 5개 행</Badge>
                              </div>
                              <DataPreviewTable
                                columns={fileInfo.columns}
                                rows={fileInfo.previewRows}
                              />
                            </div>
                          )
                        )}
                      </section>
                    </>
                  )}

                  <Separator />

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/models/${model.id}`} />}
                    >
                      <ArrowLeft />
                      이전 단계
                    </Button>
                    {selectedInputType === "example" ? (
                      <Button onClick={() => setCurrentStep(4)}>
                        다음 단계: 테스트 실행
                        <ArrowRight />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setCurrentStep(3)}
                        disabled={!canProceedFromUpload}
                      >
                        다음 단계: Semantic Mapping 설정
                        <ArrowRight />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* View 2: Semantic Mapping */}
            {currentStep === 3 && (
              <SemanticMappingView
                mappingActions={mappingActions}
                onActionChange={(id, next) =>
                  setMappingActions((prev) => ({ ...prev, [id]: next }))
                }
                hasHold={hasHold}
                onBack={() => setCurrentStep(2)}
                onNext={() => setCurrentStep(4)}
              />
            )}

            {/* View 3: Test execution */}
            {currentStep === 4 && (
              <TestExecutionView
                includedCount={includedColumns.length}
                includedColumns={includedColumns.map((c) => c.column)}
                executionStatus={executionStatus}
                logIndex={logIndex}
                onBack={() =>
                  setCurrentStep(selectedInputType === "example" ? 1 : 3)
                }
                onRun={runTest}
              />
            )}

            {/* View 4: Result */}
            {currentStep === 5 && (
              <ResultView model={model} onRestart={restart} />
            )}
          </>
        )}

        <Alert>
          <Server />
          <AlertTitle>일회용 배포 환경</AlertTitle>
          <AlertDescription>
            세션이 종료되면 업로드한 입력과 추론 결과가 삭제됩니다. 운영 배포 용도로는 사용할 수 없습니다.
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  )
}

/* ---------- View 1 subcomponents ---------- */

function InputSourceCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground/40"
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  )
}

function FileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3">
      <p className="truncate font-mono text-sm font-semibold tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function DataPreviewTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: string[][]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-border last:border-0"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums",
                    cell === "WARNING"
                      ? "font-medium text-amber-600 dark:text-amber-500"
                      : "text-foreground"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- View 2: Semantic Mapping ---------- */

function SemanticMappingView({
  mappingActions,
  onActionChange,
  hasHold,
  onBack,
  onNext,
}: {
  mappingActions: Record<string, MappingAction>
  onActionChange: (id: string, next: MappingAction) => void
  hasHold: boolean
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-6 py-2">
          {/* Title row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                3
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  Semantic Mapping (자동 전처리)
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  모델 입력 스키마의 Semantic ID와 업로드한 데이터 컬럼을 자동으로 매핑합니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
                자동 매핑 9
              </Badge>
              <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-500">
                검토 필요 2
              </Badge>
              <Badge variant="secondary">제외됨 1</Badge>
            </div>
          </div>

          {/* Process summary */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            {PROCESS_STEPS.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                <span className="relative flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                  <step.icon className="size-4" />
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="size-2.5" />
                  </span>
                </span>
                <span className="text-sm font-medium">{step.label}</span>
                {index < PROCESS_STEPS.length - 1 && (
                  <Separator className="ml-2 hidden w-6 md:block" />
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-6 2xl:grid-cols-[1fr_300px]">
            {/* Mapping table */}
            <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">
                      모델 입력 스키마 (Semantic ID)
                    </th>
                    <th className="px-3 py-2.5 font-medium">의미</th>
                    <th className="px-3 py-2.5 font-medium">선택된 컬럼</th>
                    <th className="px-3 py-2.5 font-medium">타입</th>
                    <th className="px-3 py-2.5 font-medium">신뢰도</th>
                    <th className="px-3 py-2.5 font-medium">상태</th>
                    <th className="px-3 py-2.5 text-right font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {MAPPING_ROWS.map((row) => (
                    <tr
                      key={row.semanticId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3 font-mono text-xs">
                        {row.semanticId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                        {row.meaning}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {row.column}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {row.type}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex w-24 flex-col gap-1">
                          <span className="font-mono text-xs tabular-nums">
                            {row.confidence.toFixed(2)}
                          </span>
                          <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                confidenceColor(row.confidence)
                              )}
                              style={{ width: `${row.confidence * 100}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          <MappingActions
                            value={mappingActions[row.semanticId]}
                            onChange={(next) =>
                              onActionChange(row.semanticId, next)
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Guide panel */}
            <MappingGuidePanel />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-500" />
              포함: 모델 입력으로 사용
            </span>
            <span className="flex items-center gap-1.5">
              <X className="size-3.5 text-red-500" />
              제외: 모델 입력에서 제외
            </span>
            <span className="flex items-center gap-1.5">
              <Minus className="size-3.5 text-amber-500" />
              보류: 검토 후 결정
            </span>
          </div>

          {/* Excluded original columns */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              모델 입력에서 제외된 원본 컬럼 (1)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border bg-muted/20">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">컬럼명</th>
                    <th className="px-3 py-2.5 font-medium">데이터 타입</th>
                    <th className="px-3 py-2.5 font-medium">샘플 값</th>
                    <th className="px-3 py-2.5 font-medium">제외 이유</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-3 font-mono text-xs">MACHINE_ID</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      string
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      CNC-PANGYO-014
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      모델 입력 스키마에 정의되지 않은 식별자 컬럼
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <Separator />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft />
              취소하고 이전으로
            </Button>
            <Button onClick={onNext} disabled={hasHold}>
              전처리 결과로 이동
              <ArrowRight />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MappingGuidePanel() {
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Semantic Mapping 안내</h3>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        모델 학습에 사용된 데이터셋의 AAS 서브모델에서 Semantic ID와 의미 정보를 읽고, 업로드한 데이터 컬럼의 이름, 단위, 데이터 타입 및 값 분포를 비교하여 자동으로 매핑합니다.
      </p>
      <div>
        <p className="mb-2 text-xs font-medium">매핑 기준</p>
        <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {[
            "Semantic ID 의미",
            "컬럼명 유사도",
            "단위 일치",
            "데이터 타입",
            "값 분포 및 통계",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <Separator />
      <div>
        <p className="mb-2 text-xs font-medium">신뢰도 기준</p>
        <ul className="flex flex-col gap-1.5 text-xs">
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">
              0.80–1.00 매우 높음, 자동 매핑 권장
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">
              0.50–0.79 보통, 검토 권장
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">
              0.00–0.49 낮음, 검토 필요
            </span>
          </li>
        </ul>
      </div>
    </aside>
  )
}

/* ---------- View 3: Test execution ---------- */

function TestExecutionView({
  includedCount,
  includedColumns,
  executionStatus,
  logIndex,
  onBack,
  onRun,
}: {
  includedCount: number
  includedColumns: string[]
  executionStatus: ExecutionStatus
  logIndex: number
  onBack: () => void
  onRun: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-2">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            4
          </span>
          <div>
            <h2 className="text-lg font-semibold">테스트 실행</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              검토한 매핑과 자동 생성된 전처리를 적용하여 모델 테스트를 실행합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Preprocessing summary */}
          <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">전처리 요약</h3>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                선택된 입력 컬럼 ({includedColumns.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {includedColumns.map((col) => (
                  <Badge key={col} variant="outline" className="font-mono">
                    {col}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                제외된 컬럼
              </p>
              <Badge variant="secondary" className="font-mono">
                MACHINE_ID
              </Badge>
            </div>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                자동 생성된 전처리 단계
              </p>
              <ol className="flex flex-col gap-1.5">
                {PREPROCESSING_STEPS.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Validation + run */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
              <ValidationStat label="필수 입력" value={`${includedCount}`} />
              <ValidationStat label="포함된 입력" value={`${includedCount}`} />
              <ValidationStat label="검토 필요" value="0" />
              <div className="flex flex-col justify-center">
                <Badge className="w-fit gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Check className="size-3" />
                  Ready
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">검증 상태</p>
              </div>
            </div>

            {executionStatus === "idle" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  예상 소요 시간: 약 3초
                </p>
                <Button size="lg" onClick={onRun}>
                  <Play />
                  테스트 실행
                </Button>
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-border p-4">
                <p className="mb-3 text-sm font-semibold">실행 로그</p>
                <ol className="flex flex-col gap-2.5">
                  {EXECUTION_LOG.map((log, index) => {
                    const done = index < logIndex
                    const active =
                      index === logIndex && executionStatus === "running"
                    return (
                      <li
                        key={log}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        {done ? (
                          <CircleCheck className="size-4 text-emerald-500" />
                        ) : active ? (
                          <LoaderCircle className="size-4 animate-spin text-primary" />
                        ) : (
                          <CircleDashed className="size-4 text-muted-foreground/50" />
                        )}
                        <span
                          className={cn(
                            done
                              ? "text-foreground"
                              : active
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                          )}
                        >
                          {log}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex justify-start">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={executionStatus === "running"}
          >
            <ArrowLeft />
            이전 단계
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ValidationStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/* ---------- View 4: Result ---------- */

function ResultView({
  model,
  onRestart,
}: {
  model: Model
  onRestart: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              5
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">결과 확인</h2>
                <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Check className="size-3" />
                  완료
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                실행 시각 2026-06-30 11:05:12 · 입력 1,284,930행
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => toast.success("JSON을 다운로드했습니다")}>
              <Download />
              JSON 다운로드
            </Button>
            <Button variant="outline" onClick={() => toast.success("결과를 다운로드했습니다")}>
              <Download />
              결과 다운로드
            </Button>
            <Button onClick={onRestart}>
              <RotateCcw />
              다시 실행
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Visual result */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultImage
              src={getTaskThumbnail(model.task)}
              caption="원본 입력"
            />
            <ResultImage
              src={model.resultImage || getTaskThumbnail(model.task)}
              caption="추론 결과 (Bounding Box)"
              badge="Output"
            />
          </div>

          {/* Summary */}
          <aside className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">결과 요약</h3>
            <div className="grid grid-cols-2 gap-3">
              <ResultMetric label="평균 신뢰도" value="96.4%" />
              <ResultMetric label="Latency" value="42 ms" />
              <ResultMetric label="검출 객체" value="5" />
              <ResultMetric label="Format" value="JSON" />
            </div>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                검출 클래스
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Scratch", "Dent", "Paint Defect"].map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}

function ResultImage({
  src,
  caption,
  badge,
}: {
  src: string
  caption: string
  badge?: string
}) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
        <Image
          src={src || "/placeholder.svg"}
          alt={caption}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 40vw"
        />
        {badge && <Badge className="absolute left-3 top-3">{badge}</Badge>}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  )
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
