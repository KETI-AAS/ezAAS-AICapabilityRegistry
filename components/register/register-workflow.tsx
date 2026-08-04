"use client"

import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  FileJson,
  Link2,
  Lock,
  Server,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AasViewer } from "@/components/registry/aas-viewer"
import type { AasEnvironment, TreeNode } from "@/lib/aas/aas-types"
import {
  analyzeAas,
  extractDatasetMeta,
  extractModelMeta,
  type AasAnalysis,
  type AssetKind,
} from "@/lib/aas/extract-metadata"
import { parseAasTree } from "@/lib/aas/parse-aas-tree"
import { sampleInstances, type SampleInstance } from "@/lib/aas/sample-instances"
import { taskTypes } from "@/lib/registry-data"
import { cn } from "@/lib/utils"

/** Result of loading an AAS environment (upload or external import). */
type AasUpload =
  | { status: "empty" }
  | { status: "error"; fileName: string; message: string }
  | {
      status: "parsed"
      fileName: string
      fileSize: number
      tree: TreeNode
      env: AasEnvironment
      source: "file" | "import"
    }

const steps = [
  { id: 1, label: "AAS 업로드", icon: Boxes },
  { id: 2, label: "추출 · 입력", icon: Sparkles },
  { id: 3, label: "등록 확인", icon: Check },
]

type DatasetForm = {
  title: string
  author: string
  version: string
  summary: string
  dataType: string
  task: string
  license: string
  keywords: string
}

type ModelForm = {
  title: string
  author: string
  version: string
  summary: string
  framework: string
  task: string
  license: string
  keywords: string
}

/** Registration exposes only two visibility-style licenses. */
const registrationLicenses = ["Public", "Internal"] as const

/** Keep the file-upload implementation available until the feature is released. */
const fileUploadEnabled = false

const hubInstances = sampleInstances.map((instance) => {
  const instanceAnalysis = analyzeAas(instance.env)
  const hasDataset = instanceAnalysis.submodels.some((submodel) => submodel.autoKind === "dataset")
  const hasModel = instanceAnalysis.submodels.some((submodel) => submodel.autoKind === "model")

  return { instance, canImport: hasDataset && hasModel }
})

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
  className,
  auto,
}: {
  label: string
  children: React.ReactNode
  className?: string
  auto?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {auto && (
          <Badge
            variant="secondary"
            className="h-5 gap-1 px-1.5 text-[10px] font-normal text-chart-2"
          >
            <Sparkles className="size-3" />
            자동 추출
          </Badge>
        )}
      </div>
      {children}
    </div>
  )
}

/** Read-only display for values extracted from the AAS template. */
function LockedBox({ value }: { value: string }) {
  return (
    <div
      className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
      title={value || undefined}
    >
      <Lock className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate whitespace-nowrap">{value || "—"}</span>
    </div>
  )
}

function GroupTitle({
  step,
  title,
  description,
}: {
  step?: string
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      {step && (
        <span className="text-xs font-medium uppercase tracking-wide text-primary">{step}</span>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
    </div>
  )
}

function UploadZone({
  upload,
  onFile,
  onClear,
}: {
  upload: AasUpload
  onFile: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    if (files && files.length > 0) onFile(files[0])
  }

  if (upload.status !== "empty") {
    const isError = upload.status === "error"
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-4",
          isError ? "border-destructive/40 bg-destructive/5" : "border-chart-2/40 bg-chart-2/5",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isError ? "bg-destructive/15 text-destructive" : "bg-chart-2/15 text-chart-2",
          )}
        >
          {isError ? <AlertCircle className="size-5" /> : <FileJson className="size-5" />}
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium">{upload.fileName}</span>
          {isError ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              JSON 파싱 실패
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-chart-2">
              <CheckCircle2 className="size-3.5" />
              {upload.source === "import" ? "ezAAS 허브에서 가져오기 완료" : "AAS 업로드 완료"}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="파일 제거" onClick={onClear}>
          <X data-icon="inline-start" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.xml,application/json,application/xml,text/xml"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="size-6" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            통합 AAS 파일을 끌어다 놓거나 클릭하여 업로드
          </span>
          <span className="text-xs text-muted-foreground">
            AI Dataset · AI ModelNameplate Submodel 포함 · JSON 형식
          </span>
        </span>
      </button>
    </>
  )
}

function ImportPanel({ onImport }: { onImport: (instance: SampleInstance) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Server className="size-3.5 text-primary" />
        ezAAS 허브에서 내 Instance를 선택해 가져옵니다.
      </div>
      {hubInstances.map(({ instance: inst, canImport }) => {
        return (
          <div
            key={inst.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Boxes className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{inst.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {inst.platform} · {inst.contains} · {inst.updatedAt}
              </span>
              {!canImport && (
                <span className="text-xs text-destructive">
                  AI Dataset과 AI ModelNameplate가 모두 필요합니다.
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!canImport}
              title={canImport ? undefined : "AI Dataset과 AI ModelNameplate가 모두 필요합니다."}
              onClick={() => onImport(inst)}
            >
              가져오기
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{label}</span>
      <span
        className="min-w-0 truncate whitespace-nowrap text-right font-medium"
        title={value || undefined}
      >
        {value || "—"}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main workflow                                                       */
/* ------------------------------------------------------------------ */

export function RegisterWorkflow() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(1)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [redirectCountdown, setRedirectCountdown] = useState(5)
  const [mode, setMode] = useState<"file" | "import">("import")
  const [upload, setUpload] = useState<AasUpload>({ status: "empty" })
  const [analysis, setAnalysis] = useState<AasAnalysis | null>(null)
  const [assignments, setAssignments] = useState<Record<string, AssetKind>>({})

  const [datasetInput, setDatasetInput] = useState<DatasetForm>({
    title: "",
    author: "",
    version: "v1.0",
    summary: "",
    dataType: "",
    task: "",
    license: "Internal",
    keywords: "",
  })
  const [modelInput, setModelInput] = useState<ModelForm>({
    title: "",
    author: "",
    version: "v1.0",
    summary: "",
    framework: "",
    task: "",
    license: "Internal",
    keywords: "",
  })

  useEffect(() => {
    if (!registrationComplete) return

    const countdownTimer = window.setInterval(() => {
      setRedirectCountdown((current) => Math.max(0, current - 1))
    }, 1000)
    const redirectTimer = window.setTimeout(() => {
      router.replace("/")
    }, 5000)

    return () => {
      window.clearInterval(countdownTimer)
      window.clearTimeout(redirectTimer)
    }
  }, [registrationComplete, router])

  function goTo(step: number) {
    setActiveStep(step)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  function completeRegistration() {
    setRedirectCountdown(5)
    setRegistrationComplete(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  /** Parse + analyze an AAS environment and seed the auto-classification. */
  function loadEnv(
    fileName: string,
    fileSize: number,
    env: AasEnvironment,
    source: "file" | "import",
  ) {
    const tree = parseAasTree(env)
    const result = analyzeAas(env)
    setUpload({ status: "parsed", fileName, fileSize, tree, env, source })
    setAnalysis(result)
    const init: Record<string, AssetKind> = {}
    for (const s of result.submodels) init[s.key] = s.autoKind
    setAssignments(init)
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text()
      const json = JSON.parse(text) as AasEnvironment
      loadEnv(file.name, file.size, json, "file")
    } catch {
      setUpload({
        status: "error",
        fileName: file.name,
        message:
          "AAS JSON 파일을 파싱할 수 없습니다. 올바른 JSON 형식인지 확인한 뒤 다시 업로드해 주세요.",
      })
      setAnalysis(null)
      setAssignments({})
    }
  }

  function handleImport(inst: SampleInstance) {
    const size = new Blob([JSON.stringify(inst.env)]).size
    loadEnv(`${inst.name}.json`, size, inst.env, "import")
  }

  function clearUpload() {
    setUpload({ status: "empty" })
    setAnalysis(null)
    setAssignments({})
  }

  /* Resolve the submodels currently assigned to each asset kind. */
  const datasetSm = useMemo(() => {
    if (!analysis) return undefined
    const hit = analysis.submodels.find((s) => assignments[s.key] === "dataset")
    return hit?.submodel
  }, [analysis, assignments])

  const modelSm = useMemo(() => {
    if (!analysis) return undefined
    const hit = analysis.submodels.find((s) => assignments[s.key] === "model")
    return hit?.submodel
  }, [analysis, assignments])

  const datasetMeta = useMemo(
    () => (datasetSm ? extractDatasetMeta(datasetSm) : {}),
    [datasetSm],
  )
  const modelMeta = useMemo(
    () => (modelSm ? extractModelMeta(modelSm) : {}),
    [modelSm],
  )

  const hasDataset = !!datasetSm
  const hasModel = !!modelSm

  /* AAS metadata is read-only; author comes from the signed-in capability account. */
  const dsMeta = datasetMeta as Record<string, string | undefined>
  const mdMeta = modelMeta as Record<string, string | undefined>
  const dsLocked = (f: keyof DatasetForm) => !!dsMeta[f]
  const mdLocked = (f: keyof ModelForm) => !!mdMeta[f]
  const capabilityAuthorEmail = "amrc@keti.re.kr"
  const dsVal = (f: keyof DatasetForm) => {
    if (f === "author") return capabilityAuthorEmail
    if (f === "task" || f === "license") return datasetInput[f]
    return dsMeta[f] ?? ""
  }
  const mdVal = (f: keyof ModelForm) => {
    if (f === "author") return capabilityAuthorEmail
    if (f === "task" || f === "license") return modelInput[f]
    return mdMeta[f] ?? ""
  }
  const dsVersion = datasetMeta.version || "v1.0"
  const mdVersion = modelMeta.version || "v1.0"

  const isParsed = upload.status === "parsed"

  if (registrationComplete) {
    return (
      <Card
        className="flex min-h-96 flex-col items-center justify-center gap-6 p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-chart-2/15 text-chart-2">
          <CheckCircle2 className="size-9" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">AI 자산 등록이 완료되었습니다</h2>
          <p className="text-sm text-muted-foreground">
            {redirectCountdown}초 후 홈으로 이동합니다.
          </p>
        </div>
        <Button onClick={() => router.replace("/")}>
          지금 홈으로 이동
          <ArrowRight data-icon="inline-end" />
        </Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Step indicator */}
      <div className="sticky top-16 z-10 -mx-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          {steps.map((s, i) => {
            const active = activeStep === s.id
            const done = activeStep > s.id
            const Icon = s.icon
            return (
              <div key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                      active && "border-primary bg-primary text-primary-foreground",
                      done && "border-chart-2 bg-chart-2 text-primary-foreground",
                      !active && !done && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Step {s.id}
                    </span>
                    <span
                      className={cn(
                        "truncate whitespace-nowrap text-sm font-medium",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <span className="mx-1 hidden h-px flex-1 bg-border sm:block" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1 – AAS import (file upload is temporarily hidden) */}
      {activeStep === 1 && (
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Boxes className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col">
                <h2 className="text-lg font-semibold">ezAAS 허브에서 모델 가져오기</h2>
                <p className="text-sm text-muted-foreground xl:whitespace-nowrap">
                  통합 AAS에서 AI Dataset과 AI ModelNameplate를 분류하고 메타데이터를 자동
                  추출합니다.
                </p>
              </div>
            </div>

            {/* File upload stays implemented but hidden until it is ready for release. */}
            {fileUploadEnabled && (
              <div className="inline-flex w-full max-w-xl gap-1 rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setMode("file")}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    mode === "file"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <UploadCloud className="size-4" />
                  파일 업로드
                </button>
                <button
                  type="button"
                  onClick={() => setMode("import")}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    mode === "import"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Server className="size-4" />
                  ezAAS 허브에서 모델 가져오기
                </button>
              </div>
            )}

            {mode === "file" ? (
              <UploadZone upload={upload} onFile={handleFile} onClear={clearUpload} />
            ) : isParsed ? (
              <UploadZone upload={upload} onFile={handleFile} onClear={clearUpload} />
            ) : (
              <ImportPanel onImport={handleImport} />
            )}

            {upload.status === "error" && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>AAS JSON을 읽을 수 없습니다</AlertTitle>
                <AlertDescription>{upload.message}</AlertDescription>
              </Alert>
            )}

            {isParsed && analysis && (
              <>
                {/* Auto-detection summary */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-4",
                      hasDataset
                        ? "border-chart-3/40 bg-chart-3/5"
                        : "border-border bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        hasDataset
                          ? "bg-chart-3/15 text-chart-3"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Database className="size-4" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">AI Dataset</span>
                      <span className="text-xs text-muted-foreground">
                        {hasDataset ? "Submodel 자동 감지됨" : "감지되지 않음"}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-4",
                      hasModel ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        hasModel ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Cpu className="size-4" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">AI ModelNameplate</span>
                      <span className="text-xs text-muted-foreground">
                        {hasModel ? "Submodel 자동 감지됨" : "감지되지 않음"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <AasViewer
                    fileName={upload.fileName}
                    fileSize={upload.fileSize}
                    tree={upload.tree}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => goTo(2)} disabled={!isParsed}>
                다음
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2 – Extraction review & input */}
      {activeStep === 2 && (
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold">메타데이터 확인 및 입력</h2>
                <p className="text-sm text-muted-foreground">
                  AAS에서 가져온 값을 확인하고 Task와 라이선스를 선택하세요.
                </p>
              </div>
            </div>

            {!analysis ? (
              <Alert>
                <AlertCircle />
                <AlertTitle>업로드된 AAS가 없습니다</AlertTitle>
                <AlertDescription>
                  이전 단계에서 ezAAS 허브의 모델을 가져와 주세요.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {!hasDataset && !hasModel && (
                  <Alert>
                    <AlertCircle />
                    <AlertTitle>분류된 자산이 없습니다</AlertTitle>
                    <AlertDescription>
                      불러온 AAS에서 AI Dataset 또는 AI ModelNameplate Submodel을 찾지 못했습니다.
                    </AlertDescription>
                  </Alert>
                )}

                {/* AI Dataset fields */}
                {hasDataset && (
                  <div className="flex flex-col gap-5">
                    <GroupTitle
                      title="AI Dataset"
                      description="AAS 메타데이터를 확인하고 Task와 라이선스를 선택하세요."
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="제목" auto={dsLocked("title")}>
                        <LockedBox value={dsVal("title")} />
                      </Field>
                      <Field label="작성자">
                        <LockedBox value={capabilityAuthorEmail} />
                      </Field>
                      <Field label="버전" auto={!!datasetMeta.version}>
                        <LockedBox value={dsVersion} />
                      </Field>
                      <Field label="데이터 유형" auto={dsLocked("dataType")}>
                        <LockedBox value={dsVal("dataType")} />
                      </Field>
                      <Field label="적용 Task">
                        <Select
                          value={datasetInput.task}
                          onValueChange={(v) =>
                            setDatasetInput({ ...datasetInput, task: v as string })
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-lg">
                            <SelectValue placeholder="Task 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {taskTypes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="라이선스">
                        <Select
                          value={datasetInput.license}
                          onValueChange={(v) =>
                            setDatasetInput({ ...datasetInput, license: v as string })
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-lg">
                            <SelectValue placeholder="라이선스 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {registrationLicenses.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="개요" className="md:col-span-2" auto={dsLocked("summary")}>
                        <LockedBox value={dsVal("summary")} />
                      </Field>
                      <Field label="키워드" className="md:col-span-2" auto={dsLocked("keywords")}>
                        <LockedBox value={dsVal("keywords")} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* AI ModelNameplate fields */}
                {hasModel && (
                  <div className="flex flex-col gap-5">
                    <GroupTitle
                      title="AI ModelNameplate"
                      description="AAS 메타데이터를 확인하고 Task와 라이선스를 선택하세요."
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="제목" auto={mdLocked("title")}>
                        <LockedBox value={mdVal("title")} />
                      </Field>
                      <Field label="작성자">
                        <LockedBox value={capabilityAuthorEmail} />
                      </Field>
                      <Field label="버전" auto={!!modelMeta.version}>
                        <LockedBox value={mdVersion} />
                      </Field>
                      <Field label="Framework" auto={mdLocked("framework")}>
                        <LockedBox value={mdVal("framework")} />
                      </Field>
                      <Field label="Task">
                        <Select
                          value={modelInput.task}
                          onValueChange={(v) =>
                            setModelInput({ ...modelInput, task: v as string })
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-lg">
                            <SelectValue placeholder="Task 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {taskTypes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="라이선스">
                        <Select
                          value={modelInput.license}
                          onValueChange={(v) =>
                            setModelInput({ ...modelInput, license: v as string })
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-lg">
                            <SelectValue placeholder="라이선스 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {registrationLicenses.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="개요" className="md:col-span-2" auto={mdLocked("summary")}>
                        <LockedBox value={mdVal("summary")} />
                      </Field>
                      <Field label="키워드" className="md:col-span-2" auto={mdLocked("keywords")}>
                        <LockedBox value={mdVal("keywords")} />
                      </Field>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => goTo(1)}>
                <ArrowLeft data-icon="inline-start" />
                이전
              </Button>
              <Button onClick={() => goTo(3)} disabled={!hasDataset && !hasModel}>
                다음
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3 – Review */}
      {activeStep === 3 && (
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Check className="size-5" />
              </span>
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold">등록 내용 확인</h2>
                <p className="text-sm text-muted-foreground">
                  자동 추출 및 입력한 내용을 확인한 뒤 등록하세요.
                </p>
              </div>
            </div>

            <div
              className={cn(
                "grid items-stretch gap-5",
                hasDataset && hasModel ? "lg:grid-cols-[1fr_auto_1fr]" : "max-w-xl",
              )}
            >
              {hasDataset && (
                <div className="flex flex-col gap-4 rounded-2xl border border-chart-3/30 bg-chart-3/5 p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-chart-3/15 text-chart-3">
                      <Database className="size-4" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-chart-3">
                      AI Dataset
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-border/60">
                    <SummaryRow label="제목" value={dsVal("title")} />
                    <SummaryRow label="작성자" value={dsVal("author")} />
                    <SummaryRow label="버전" value={dsVersion} />
                    <SummaryRow label="데이터 유형" value={dsVal("dataType")} />
                    <SummaryRow label="적용 Task" value={dsVal("task")} />
                    <SummaryRow label="라이선스" value={dsVal("license")} />
                  </div>
                </div>
              )}

              {hasDataset && hasModel && (
                <div className="flex flex-row items-center justify-center gap-3 lg:flex-col">
                  <span className="hidden text-xs font-medium text-muted-foreground lg:block">
                    <Database className="size-4 text-chart-3" />
                  </span>
                  <ArrowDown className="hidden size-4 text-muted-foreground lg:block" />
                  <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
                    <Link2 className="size-3.5 text-primary" />
                    Used for Training
                  </Badge>
                  <ArrowDown className="hidden size-4 text-muted-foreground lg:block" />
                  <span className="hidden text-xs font-medium text-muted-foreground lg:block">
                    <Cpu className="size-4 text-primary" />
                  </span>
                </div>
              )}

              {hasModel && (
                <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Cpu className="size-4" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-primary">
                      AI ModelNameplate
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-border/60">
                    <SummaryRow label="제목" value={mdVal("title")} />
                    <SummaryRow label="작성자" value={mdVal("author")} />
                    <SummaryRow label="버전" value={mdVersion} />
                    <SummaryRow label="Framework" value={mdVal("framework")} />
                    <SummaryRow label="Task" value={mdVal("task")} />
                    <SummaryRow label="라이선스" value={mdVal("license")} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => goTo(2)}>
                <ArrowLeft data-icon="inline-start" />
                이전
              </Button>
              <Button size="lg" onClick={completeRegistration}>
                <CheckCircle2 data-icon="inline-start" />
                등록 완료
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
