"use client"

import { useCallback } from "react"

import { ModelCard } from "@/components/registry/model-card"
import { RegistryExplorer, type SortOption } from "@/components/registry/registry-explorer"
import { models, type Model } from "@/lib/registry-data"
import { modelDate, modelFacetValues, modelFilterGroups, modelStats } from "@/lib/registry-facets"

const sortOptions: SortOption[] = [
  { key: "latest", label: "최신순" },
  { key: "performance", label: "성능순" },
  { key: "usage", label: "사용량순" },
]

export function ModelExplorer() {
  const getId = useCallback((m: Model) => m.id, [])
  const getFacetValues = useCallback((m: Model) => modelFacetValues(m), [])
  const getSearchText = useCallback(
    (m: Model) =>
      `${m.name} ${m.description} ${m.task} ${m.framework} ${m.architecture} ${m.tags.join(" ")}`,
    [],
  )
  const sortItems = useCallback((items: Model[], key: string) => {
    const sorted = [...items]
    switch (key) {
      case "performance":
        sorted.sort((a, b) => b.accuracy - a.accuracy)
        break
      case "usage":
        sorted.sort((a, b) => modelStats(b).usage - modelStats(a).usage)
        break
      default:
        sorted.sort((a, b) => modelDate(b).localeCompare(modelDate(a)))
    }
    return sorted
  }, [])
  const renderCard = useCallback((m: Model, i: number) => <ModelCard model={m} index={i} />, [])

  return (
    <RegistryExplorer<Model>
      title="AI Model"
      description="제조 현장의 문제를 해결하는 AI 모델 카탈로그입니다. Task, 프레임워크, 아키텍처, 성능 지표 등으로 원하는 모델을 탐색하세요."
      searchPlaceholder="모델 이름, Task, 프레임워크, 태그로 검색하세요"
      items={models}
      groups={modelFilterGroups}
      sortOptions={sortOptions}
      defaultSort="latest"
      countNoun="Model"
      getId={getId}
      getFacetValues={getFacetValues}
      getSearchText={getSearchText}
      sortItems={sortItems}
      renderCard={renderCard}
    />
  )
}
