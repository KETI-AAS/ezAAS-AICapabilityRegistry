"use client"

import {
  ArrowLeft,
  CircleCheck,
  CircleDashed,
  LoaderCircle,
  Play,
  Square,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GPU_OPTIONS,
  LEARNING_RATE_OPTIONS,
  TRAINING_LOG_LINES,
  TRAINING_METHODS,
} from "@/lib/training-data"
import { cn } from "@/lib/utils"

export type TrainingStatus = "idle" | "running" | "complete"

export interface TrainingConfig {
  method: string
  epoch: string
  batchSize: string
  learningRate: string
  gpu: string
}

export function TrainingRunStep({
  config,
  onConfigChange,
  status,
  progress,
  logIndex,
  onBack,
  onStart,
  onStop,
}: {
  config: TrainingConfig
  onConfigChange: (next: TrainingConfig) => void
  status: TrainingStatus
  progress: number
  logIndex: number
  onBack: () => void
  onStart: () => void
  onStop: () => void
}) {
  const disabled = status === "running"

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-2">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            5
          </span>
          <div>
            <h2 className="text-lg font-semibold">AI Training</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              모델 추가 학습을 실행합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Config */}
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold">학습 설정</h3>

            <Field label="학습 방식">
              <Select
                value={config.method}
                onValueChange={(v) => onConfigChange({ ...config, method: v ?? config.method })}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Epoch">
                <Input
                  type="number"
                  value={config.epoch}
                  onChange={(e) =>
                    onConfigChange({ ...config, epoch: e.target.value })
                  }
                  disabled={disabled}
                  className="h-9"
                />
              </Field>
              <Field label="Batch Size">
                <Input
                  type="number"
                  value={config.batchSize}
                  onChange={(e) =>
                    onConfigChange({ ...config, batchSize: e.target.value })
                  }
                  disabled={disabled}
                  className="h-9"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Learning Rate">
                <Select
                  value={config.learningRate}
                  onValueChange={(v) =>
                    onConfigChange({ ...config, learningRate: v ?? config.learningRate })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEARNING_RATE_OPTIONS.map((lr) => (
                      <SelectItem key={lr} value={lr}>
                        {lr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="GPU">
                <Select
                  value={config.gpu}
                  onValueChange={(v) => onConfigChange({ ...config, gpu: v ?? config.gpu })}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GPU_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* Progress */}
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold">학습 진행 상황</h3>

            {status === "idle" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Play className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">
                  학습을 시작하면 진행 상황이 여기에 표시됩니다.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {status === "complete" ? "학습이 완료되었습니다" : "학습이 진행 중입니다..."}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="flex-1 rounded-xl border border-border bg-muted/20 p-4">
                  <ol className="flex flex-col gap-2.5">
                    {TRAINING_LOG_LINES.map((line, index) => {
                      const done = index < logIndex
                      const active =
                        index === logIndex && status === "running"
                      return (
                        <li
                          key={line}
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
                                  : "text-muted-foreground",
                            )}
                          >
                            {line}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack} disabled={status === "running"}>
            <ArrowLeft />
            이전 단계
          </Button>
          {status === "running" ? (
            <Button variant="destructive" onClick={onStop}>
              <Square />
              학습 중지
            </Button>
          ) : (
            <Button size="lg" onClick={onStart} disabled={status === "complete"}>
              <Play />
              AI Training 시작
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
