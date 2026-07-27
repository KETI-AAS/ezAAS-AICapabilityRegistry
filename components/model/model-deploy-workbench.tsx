"use client"

import {
  Activity,
  Check,
  Clock3,
  Code2,
  Copy,
  FileUp,
  LoaderCircle,
  Play,
  Power,
  RotateCcw,
  Server,
  Sparkles,
  SquareTerminal,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDataset, getTaskThumbnail, type Model } from "@/lib/registry-data"

type InstanceStatus = "provisioning" | "running" | "expired"
type InferenceStatus = "idle" | "running" | "complete"

const SESSION_SECONDS = 30 * 60

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

export function ModelDeployWorkbench({ model }: { model: Model }) {
  const dataset = getDataset(model.datasetId)
  const exampleImage =
    dataset?.sampleImages?.[0] || getTaskThumbnail(model.task) || model.image
  const endpoint = `https://runtime.aas.ai/${model.id}/predict`

  const [instanceStatus, setInstanceStatus] =
    useState<InstanceStatus>("provisioning")
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_SECONDS)
  const [selectedFile, setSelectedFile] = useState("")
  const [useExample, setUseExample] = useState(true)
  const [inferenceStatus, setInferenceStatus] =
    useState<InferenceStatus>("idle")
  const [progress, setProgress] = useState(0)
  const inferenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      if (inferenceTimer.current) window.clearTimeout(inferenceTimer.current)
    }
  }, [])

  const runInference = () => {
    if (instanceStatus !== "running") return

    setInferenceStatus("running")
    setProgress(38)

    inferenceTimer.current = setTimeout(() => {
      setProgress(100)
      setInferenceStatus("complete")
      toast.success("추론이 완료되었습니다")
    }, 1100)
  }

  const resetInference = () => {
    if (inferenceTimer.current) window.clearTimeout(inferenceTimer.current)
    setInferenceStatus("idle")
    setProgress(0)
    setSelectedFile("")
    setUseExample(true)
  }

  const terminateInstance = () => {
    setInstanceStatus("expired")
    setRemainingSeconds(0)
    toast.info("일회용 인스턴스가 종료되었습니다")
  }

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(endpoint)
    toast.success("Endpoint URL을 복사했습니다")
  }

  const isRunning = instanceStatus === "running"
  const isExpired = instanceStatus === "expired"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
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
        <Tabs defaultValue="playground" className="gap-5">
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles />
              Playground
            </TabsTrigger>
            <TabsTrigger value="api">
              <Code2 />
              API
            </TabsTrigger>
            <TabsTrigger value="logs">
              <SquareTerminal />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playground">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Input</CardTitle>
                  <CardDescription>{model.input}</CardDescription>
                  <CardAction>
                    <Badge variant="outline">{model.task}</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                    <Image
                      src={exampleImage}
                      alt="추론 예제 입력"
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    {useExample && (
                      <Badge className="absolute left-3 top-3">Example</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="deploy-input" className="text-sm font-medium">
                      입력 파일
                    </label>
                    <Input
                      id="deploy-input"
                      type="file"
                      accept="image/*,.csv,.json,.txt"
                      className="h-10"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0]?.name ?? "")
                        setUseExample(false)
                        setInferenceStatus("idle")
                        setProgress(0)
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {selectedFile || "예제 입력이 선택되어 있습니다."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="sm:flex-1"
                      onClick={() => {
                        setUseExample(true)
                        setSelectedFile("")
                      }}
                    >
                      <FileUp />
                      예제 입력 사용
                    </Button>
                    <Button
                      className="sm:flex-1"
                      onClick={runInference}
                      disabled={!isRunning || inferenceStatus === "running"}
                    >
                      {inferenceStatus === "running" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Play />
                      )}
                      {inferenceStatus === "running" ? "추론 중" : "Run"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Output</CardTitle>
                  <CardDescription>{model.output}</CardDescription>
                  {inferenceStatus === "complete" && (
                    <CardAction>
                      <Badge className="gap-1">
                        <Check />
                        Complete
                      </Badge>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent className="flex min-h-[440px] flex-col">
                  {inferenceStatus === "idle" && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 text-center">
                      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="size-5" />
                      </span>
                      <div>
                        <p className="font-medium">추론 결과가 여기에 표시됩니다</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          입력을 선택하고 Run 버튼을 눌러주세요.
                        </p>
                      </div>
                    </div>
                  )}

                  {inferenceStatus === "running" && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-5">
                      <LoaderCircle className="size-8 animate-spin text-primary" />
                      <div className="w-full max-w-sm">
                        <div className="mb-2 flex justify-between text-sm">
                          <span>모델 추론 중</span>
                          <span className="font-mono">{progress}%</span>
                        </div>
                        <Progress value={progress} />
                      </div>
                    </div>
                  )}

                  {inferenceStatus === "complete" && (
                    <div className="flex flex-1 flex-col gap-4">
                      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                        <Image
                          src={model.resultImage || getTaskThumbnail(model.task)}
                          alt="모델 추론 결과"
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border py-4 text-center">
                        <div>
                          <p className="font-mono text-lg font-semibold">
                            {model.accuracy}%
                          </p>
                          <p className="text-xs text-muted-foreground">Confidence</p>
                        </div>
                        <div>
                          <p className="font-mono text-lg font-semibold">42ms</p>
                          <p className="text-xs text-muted-foreground">Latency</p>
                        </div>
                        <div>
                          <p className="font-mono text-lg font-semibold">
                            {model.outputFormat}
                          </p>
                          <p className="text-xs text-muted-foreground">Format</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={resetInference}>
                        <RotateCcw />
                        다시 실행
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>REST API</CardTitle>
                <CardDescription>
                  이 Endpoint는 현재 일회용 세션이 유지되는 동안만 사용할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4">
                  <Badge>POST</Badge>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">
                    {endpoint}
                  </code>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Endpoint URL 복사"
                    onClick={copyEndpoint}
                  >
                    <Copy />
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-foreground p-5 text-xs leading-6 text-background">
                  <code>{`curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer <temporary-token>" \\
  -F "file=@sample.jpg"`}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Runtime Logs</CardTitle>
                <CardDescription>현재 세션에서 발생한 실행 로그입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 rounded-xl bg-foreground p-5 font-mono text-xs leading-6 text-background">
                  <p>[system] Temporary instance requested</p>
                  <p>[runtime] Loading {model.framework} runtime</p>
                  <p>[model] Loaded {model.id}@{model.version}</p>
                  {isRunning && <p>[health] Endpoint is ready</p>}
                  {inferenceStatus === "complete" && (
                    <p>[predict] 200 OK · latency=42ms</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Alert>
        <Server />
        <AlertTitle>일회용 배포 환경</AlertTitle>
        <AlertDescription>
          세션이 종료되면 업로드한 입력과 추론 결과가 삭제됩니다. 운영 배포 용도로는 사용할 수 없습니다.
        </AlertDescription>
      </Alert>
    </div>
  )
}
