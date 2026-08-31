import type {
  SortableColumnDefinition,
  SortableColumnSettingsValue,
} from '@/lib/columnSettings'

export const PROJECT_LIST_MILESTONE_UNIT_KEY = 'milestone' as const

export interface ProjectListLeafColumnDefinition
  extends SortableColumnDefinition<string> {
  source: 'system' | 'projectInfo' | 'templateTask'
}

export interface ProjectListColumnUnitDefinition
  extends SortableColumnDefinition<string> {
  leafKeys: string[]
  kind: 'field' | 'milestone'
}

const isLegacyMilestoneKey = (key: string) => (
  key === PROJECT_LIST_MILESTONE_UNIT_KEY
  || key.startsWith('milestone::')
  || key.startsWith('templateTask::')
)

export function buildProjectListColumnUnits(
  definitions: readonly ProjectListLeafColumnDefinition[],
): ProjectListColumnUnitDefinition[] {
  const milestoneLeaves = definitions.filter(definition => definition.source === 'templateTask')
  const units: ProjectListColumnUnitDefinition[] = []
  let milestoneAdded = false

  definitions.forEach(definition => {
    if (definition.source !== 'templateTask') {
      units.push({
        ...definition,
        leafKeys: [definition.key],
        kind: 'field' as const,
      })
      return
    }
    if (milestoneAdded) return
    milestoneAdded = true
    units.push({
      key: PROJECT_LIST_MILESTONE_UNIT_KEY,
      title: '里程碑',
      accessibilityLabel: '里程碑',
      defaultVisible: milestoneLeaves.some(leaf => leaf.defaultVisible),
      hideable: true,
      leafKeys: milestoneLeaves.map(leaf => leaf.key),
      kind: 'milestone' as const,
    })
  })
  return units
}

export function getProjectListUnitLeafKeys(
  units: readonly ProjectListColumnUnitDefinition[],
  unitKey: string,
): string[] {
  return [...(units.find(unit => unit.key === unitKey)?.leafKeys ?? [])]
}

export function canDropProjectListUnit(
  units: readonly ProjectListColumnUnitDefinition[],
  activeUnitKey: string,
  overUnitKey: string,
): boolean {
  if (!activeUnitKey || !overUnitKey || activeUnitKey === overUnitKey) return false
  const activeUnit = units.find(unit => unit.key === activeUnitKey)
  const overUnit = units.find(unit => unit.key === overUnitKey)
  return Boolean(activeUnit && overUnit && activeUnit.fixed !== 'left' && overUnit.fixed !== 'left')
}

const getUnitKey = (
  units: readonly ProjectListColumnUnitDefinition[],
  requestedKey: string,
) => {
  const direct = units.find(unit => unit.key === requestedKey)
  if (direct) return direct.key
  const owner = units.find(unit => unit.leafKeys.includes(requestedKey))
  if (owner) return owner.key
  if (
    units.some(unit => unit.key === PROJECT_LIST_MILESTONE_UNIT_KEY)
    && isLegacyMilestoneKey(requestedKey)
  ) {
    return PROJECT_LIST_MILESTONE_UNIT_KEY
  }
  return undefined
}

const normalizeUnitOrder = (
  units: readonly ProjectListColumnUnitDefinition[],
  requestedOrder?: readonly string[],
) => {
  const fixedKeys = units
    .filter(unit => unit.fixed === 'left')
    .map(unit => unit.key)
  const fixedKeySet = new Set(fixedKeys)
  const requested: string[] = []
  const seen = new Set<string>()

  for (const key of requestedOrder ?? []) {
    const unitKey = getUnitKey(units, key)
    if (!unitKey || seen.has(unitKey)) continue
    requested.push(unitKey)
    seen.add(unitKey)
  }
  for (const unit of units) {
    if (seen.has(unit.key)) continue
    requested.push(unit.key)
    seen.add(unit.key)
  }

  return [
    ...fixedKeys,
    ...requested.filter(key => !fixedKeySet.has(key)),
  ]
}

export function normalizeProjectListUnitSettings(
  units: readonly ProjectListColumnUnitDefinition[],
  stored?: Partial<SortableColumnSettingsValue<string>> | readonly string[] | null,
): SortableColumnSettingsValue<string> {
  if (units.length === 0) return { order: [], visible: [] }

  const legacyVisibleOnly = Array.isArray(stored)
  const storedValue = stored as Partial<SortableColumnSettingsValue<string>> | undefined
  const requestedOrder = legacyVisibleOnly ? undefined : storedValue?.order
  const requestedVisible = legacyVisibleOnly ? stored : storedValue?.visible
  const order = normalizeUnitOrder(units, requestedOrder)

  const visibleUnitKeys = new Set<string>()
  if (stored == null || requestedVisible === undefined) {
    units.forEach(unit => {
      if (unit.defaultVisible || unit.hideable === false) visibleUnitKeys.add(unit.key)
    })
  } else {
    requestedVisible.forEach(key => {
      const unitKey = getUnitKey(units, key)
      if (unitKey) visibleUnitKeys.add(unitKey)
    })
    units.forEach(unit => {
      if (unit.hideable === false) visibleUnitKeys.add(unit.key)
    })
  }

  return {
    order,
    visible: units.map(unit => unit.key).filter(key => visibleUnitKeys.has(key)),
  }
}

export function expandProjectListUnitSettings(
  units: readonly ProjectListColumnUnitDefinition[],
  settings: SortableColumnSettingsValue<string>,
): SortableColumnSettingsValue<string> {
  const normalized = normalizeProjectListUnitSettings(units, settings)
  const unitByKey = new Map(units.map(unit => [unit.key, unit] as const))
  const visibleUnits = new Set(normalized.visible)

  return {
    order: normalized.order.flatMap(key => unitByKey.get(key)?.leafKeys ?? []),
    visible: units.flatMap(unit => (
      visibleUnits.has(unit.key) ? unit.leafKeys : []
    )),
  }
}
