/**
 * Converts a raw AAS Environment JSON object into a user-friendly AAS tree.
 *
 * This is intentionally a pure function with no React / DOM dependencies so it
 * can be reused across Register, AI Dataset Detail, AI Model Detail and Pair
 * Detail. It does NOT validate the AAS — it only reorganizes whatever it can
 * find into an intuitive hierarchy.
 */

import type {
  AasEnvironment,
  AasReference,
  AssetInformation,
  ConceptDescription,
  LangString,
  Submodel,
  SubmodelElement,
  TreeNode,
} from "./aas-types"

let uid = 0
function nextId(prefix: string): string {
  uid += 1
  return `${prefix}-${uid}`
}

/** Pick a readable string out of an AAS description (array of lang strings). */
function firstText(description?: LangString[]): string | undefined {
  if (!Array.isArray(description) || description.length === 0) return undefined
  const withText = description.find((d) => d?.text)
  return withText?.text ?? undefined
}

/** Resolve the last (most specific) key value of an AAS reference. */
function referenceValue(ref?: AasReference): string | undefined {
  if (!ref?.keys || ref.keys.length === 0) return undefined
  const last = ref.keys[ref.keys.length - 1]
  return last?.value
}

/** Convert a MultiLanguageProperty value into a readable string. */
function langValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((v) => v && typeof v === "object" && "text" in v) as
      | LangString
      | undefined
    return first?.text
  }
  return undefined
}

/** First language tag from a MultiLanguageProperty value. */
function langTag(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((v) => v && typeof v === "object" && "language" in v) as
      | LangString
      | undefined
    return first?.language
  }
  return undefined
}

/** Recursively map a single submodelElement into a TreeNode. */
function mapElement(el: SubmodelElement): TreeNode {
  const modelType = (el.modelType as string) || "Property"
  const label = el.idShort || modelType
  const description = firstText(el.description)
  const semanticId = el.semanticId

  switch (modelType) {
    case "SubmodelElementCollection":
    case "SubmodelElementList": {
      const items = Array.isArray(el.value)
        ? (el.value as SubmodelElement[])
        : []
      const children = items.map(mapElement)
      return {
        id: nextId("sme"),
        label,
        type: modelType,
        badge: children.length ? `${children.length}` : undefined,
        description,
        semanticId,
        children,
      }
    }
    case "MultiLanguageProperty": {
      return {
        id: nextId("sme"),
        label,
        type: "MultiLanguageProperty",
        value: langValue(el.value),
        language: langTag(el.value),
        description,
        semanticId,
      }
    }
    case "File":
    case "Blob": {
      const val =
        typeof el.value === "string" ? (el.value as string) : undefined
      return {
        id: nextId("sme"),
        label,
        type: modelType,
        value: val,
        badge: el.contentType,
        contentType: el.contentType,
        description,
        semanticId,
      }
    }
    case "Range": {
      const min = (el as Record<string, unknown>).min
      const max = (el as Record<string, unknown>).max
      return {
        id: nextId("sme"),
        label,
        type: "Range",
        value:
          min != null || max != null ? `${min ?? "—"} … ${max ?? "—"}` : undefined,
        badge: el.valueType,
        valueType: el.valueType,
        description,
        semanticId,
      }
    }
    case "ReferenceElement":
    case "RelationshipElement": {
      return {
        id: nextId("sme"),
        label,
        type: modelType,
        value: referenceValue(el.value as AasReference),
        description,
        semanticId,
      }
    }
    case "Entity": {
      const statements = Array.isArray((el as Record<string, unknown>).statements)
        ? ((el as Record<string, unknown>).statements as SubmodelElement[])
        : []
      return {
        id: nextId("sme"),
        label,
        type: "Entity",
        description,
        semanticId,
        children: statements.map(mapElement),
      }
    }
    case "Operation": {
      return { id: nextId("sme"), label, type: "Operation", description, semanticId }
    }
    default: {
      // Property and anything else we treat as a leaf value.
      const val =
        typeof el.value === "string" || typeof el.value === "number"
          ? String(el.value)
          : undefined
      return {
        id: nextId("sme"),
        label,
        type: "Property",
        value: val,
        badge: el.valueType,
        valueType: el.valueType,
        description,
        semanticId,
      }
    }
  }
}

/** Build a Submodel node with its recursively-mapped elements. */
function mapSubmodel(sm: Submodel): TreeNode {
  const elements = Array.isArray(sm.submodelElements) ? sm.submodelElements : []
  return {
    id: nextId("sm"),
    label: sm.idShort || sm.id || "Submodel",
    type: "Submodel",
    badge: elements.length ? `${elements.length}` : undefined,
    description: firstText(sm.description),
    semanticId: sm.semanticId,
    children: elements.map(mapElement),
  }
}

function mapAssetInformation(info: AssetInformation): TreeNode {
  const children: TreeNode[] = []
  if (info.assetKind) {
    children.push({
      id: nextId("attr"),
      label: "assetKind",
      type: "Attribute",
      value: info.assetKind,
    })
  }
  if (info.globalAssetId) {
    children.push({
      id: nextId("attr"),
      label: "globalAssetId",
      type: "Attribute",
      value: info.globalAssetId,
    })
  }
  return {
    id: nextId("asset"),
    label: "assetInformation",
    type: "AssetInformation",
    children,
  }
}

function mapConceptDescription(cd: ConceptDescription): TreeNode {
  return {
    id: nextId("cd"),
    label: cd.idShort || cd.id || "ConceptDescription",
    type: "ConceptDescription",
    value: firstText(cd.description),
  }
}

/**
 * Parse an AAS Environment object into a single root TreeNode.
 *
 * Accepts either a full Environment ({ assetAdministrationShells, submodels,
 * conceptDescriptions }) or a bare object; missing sections are skipped.
 */
export function parseAasTree(env: AasEnvironment): TreeNode {
  uid = 0

  const shells = Array.isArray(env.assetAdministrationShells)
    ? env.assetAdministrationShells
    : []
  const submodels = Array.isArray(env.submodels) ? env.submodels : []
  const conceptDescriptions = Array.isArray(env.conceptDescriptions)
    ? env.conceptDescriptions
    : []

  // Index submodels by id so shell references can be resolved.
  const submodelById = new Map<string, Submodel>()
  for (const sm of submodels) {
    if (sm.id) submodelById.set(sm.id, sm)
  }

  const rootChildren: TreeNode[] = []
  const referencedIds = new Set<string>()

  // Asset Administration Shells
  for (const shell of shells) {
    const shellChildren: TreeNode[] = []

    if (shell.idShort) {
      shellChildren.push({
        id: nextId("attr"),
        label: "idShort",
        type: "Attribute",
        value: shell.idShort,
      })
    }
    if (shell.id) {
      shellChildren.push({
        id: nextId("attr"),
        label: "id",
        type: "Attribute",
        value: shell.id,
      })
    }
    const desc = firstText(shell.description)
    if (desc) {
      shellChildren.push({
        id: nextId("attr"),
        label: "description",
        type: "Attribute",
        value: desc,
      })
    }
    if (shell.assetInformation) {
      shellChildren.push(mapAssetInformation(shell.assetInformation))
    }

    // Referenced submodels
    const refs = Array.isArray(shell.submodels) ? shell.submodels : []
    const referencedSubmodels: TreeNode[] = []
    for (const ref of refs) {
      const id = referenceValue(ref)
      if (id && submodelById.has(id)) {
        referencedIds.add(id)
        referencedSubmodels.push(mapSubmodel(submodelById.get(id)!))
      } else if (id) {
        // Reference points at a submodel we don't have; show it as a stub.
        referencedSubmodels.push({
          id: nextId("ref"),
          label: id,
          type: "Reference",
        })
      }
    }
    if (referencedSubmodels.length > 0) {
      shellChildren.push({
        id: nextId("group"),
        label: "Referenced Submodels",
        type: "Group",
        badge: `${referencedSubmodels.length}`,
        children: referencedSubmodels,
      })
    }

    rootChildren.push({
      id: nextId("aas"),
      label: shell.idShort || shell.id || "AssetAdministrationShell",
      type: "AssetAdministrationShell",
      children: shellChildren,
    })
  }

  // Submodels not referenced by any shell (or when there are no shells).
  const orphanSubmodels = submodels.filter(
    (sm) => !sm.id || !referencedIds.has(sm.id),
  )
  if (orphanSubmodels.length > 0) {
    rootChildren.push({
      id: nextId("group"),
      label: shells.length ? "Submodels" : "Submodels",
      type: "Group",
      badge: `${orphanSubmodels.length}`,
      children: orphanSubmodels.map(mapSubmodel),
    })
  }

  // Concept Descriptions
  if (conceptDescriptions.length > 0) {
    rootChildren.push({
      id: nextId("group"),
      label: "ConceptDescriptions",
      type: "Group",
      badge: `${conceptDescriptions.length}`,
      children: conceptDescriptions.map(mapConceptDescription),
    })
  }

  return {
    id: nextId("env"),
    label: "AAS Environment",
    type: "Environment",
    children: rootChildren,
  }
}
