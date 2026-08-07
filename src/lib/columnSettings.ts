import type { ReactNode } from 'react'

export interface SortableColumnDefinition<Key extends string = string> {
  key: Key
  title: ReactNode
  accessibilityLabel?: string
  defaultVisible: boolean
  hideable?: boolean
  fixed?: 'left'
  disabledReason?: string
}

export interface SortableColumnSettingsValue<Key extends string = string> {
  order: Key[]
  visible: Key[]
}

export function getColumnDefinitionSignature<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
): string {
  return JSON.stringify(definitions.map(definition => [
    definition.key,
    definition.defaultVisible,
    definition.hideable !== false,
    definition.fixed === 'left',
  ]))
}

function collectAccessibilityText(node: ReactNode): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    const text = String(node).trim()
    return text ? [text] : []
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectAccessibilityText)
  }
  if (!node || typeof node !== 'object' || !('props' in node)) return []

  const props = node.props
  if (!props || typeof props !== 'object' || !('children' in props)) return []
  return collectAccessibilityText(props.children as ReactNode)
}

export function getSortableColumnAccessibilityLabel<Key extends string>(
  definition: SortableColumnDefinition<Key>,
): string {
  const explicitLabel = definition.accessibilityLabel?.trim()
  if (explicitLabel) return explicitLabel

  const derivedLabel = collectAccessibilityText(definition.title)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return derivedLabel || '字段'
}

function normalizeOrder<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  order: readonly Key[] | undefined,
): Key[] {
  const knownKeys = new Set(definitions.map(definition => definition.key))
  const defaultFixedKeys = definitions
    .filter(definition => definition.fixed === 'left')
    .map(definition => definition.key)
  const fixedKeySet = new Set(defaultFixedKeys)
  const requestedFixedKeys = (order ?? [])
    .filter((key, index, source) => fixedKeySet.has(key) && source.indexOf(key) === index)
  const requestedFixedKeySet = new Set(requestedFixedKeys)
  const fixedKeys = [
    ...requestedFixedKeys,
    ...defaultFixedKeys.filter(key => !requestedFixedKeySet.has(key)),
  ]
  const normalizedNonFixed: Key[] = []
  const seen = new Set<Key>()

  for (const key of order ?? []) {
    if (!knownKeys.has(key) || fixedKeySet.has(key) || seen.has(key)) continue
    normalizedNonFixed.push(key)
    seen.add(key)
  }

  for (const definition of definitions) {
    if (fixedKeySet.has(definition.key) || seen.has(definition.key)) continue
    normalizedNonFixed.push(definition.key)
    seen.add(definition.key)
  }

  return [...fixedKeys, ...normalizedNonFixed]
}

export function getDefaultColumnSettings<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
): SortableColumnSettingsValue<Key> {
  const order = normalizeOrder(definitions, definitions.map(definition => definition.key))
  const defaultVisible = new Set(
    definitions
      .filter(definition => definition.defaultVisible || definition.hideable === false)
      .map(definition => definition.key),
  )

  return {
    order,
    visible: order.filter(key => defaultVisible.has(key)),
  }
}

export function normalizeColumnSettings<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  value?: Partial<SortableColumnSettingsValue<Key>> | readonly Key[] | null,
): SortableColumnSettingsValue<Key> {
  if (definitions.length === 0) return { order: [], visible: [] }
  if (value == null) return getDefaultColumnSettings(definitions)

  const isLegacyValue = Array.isArray(value)
  const requestedOrder = isLegacyValue
    ? undefined
    : (value as Partial<SortableColumnSettingsValue<Key>>).order
  const requestedVisible = isLegacyValue
    ? value as readonly Key[]
    : (value as Partial<SortableColumnSettingsValue<Key>>).visible
  const order = normalizeOrder(definitions, requestedOrder)
  const knownKeys = new Set(order)
  const forcedVisible = new Set(
    definitions
      .filter(definition => definition.hideable === false)
      .map(definition => definition.key),
  )
  const hideableKeys = new Set(
    definitions
      .filter(definition => definition.hideable !== false)
      .map(definition => definition.key),
  )
  const requestedVisibleSet = new Set(
    (requestedVisible ?? [])
      .filter(key => knownKeys.has(key)),
  )
  const hasOptionalBusinessField = [...requestedVisibleSet]
    .some(key => hideableKeys.has(key))

  if (!hasOptionalBusinessField) {
    return {
      order,
      visible: getDefaultColumnSettings(definitions).visible,
    }
  }

  const visibleSet = new Set([...forcedVisible, ...requestedVisibleSet])
  return {
    order,
    visible: definitions
      .map(definition => definition.key)
      .filter(key => visibleSet.has(key)),
  }
}

export function moveColumnSetting<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  order: readonly Key[],
  activeKey: Key,
  overKey: Key,
): Key[] {
  const normalizedOrder = normalizeOrder(definitions, order)
  const definitionByKey = new Map(
    definitions.map(definition => [definition.key, definition] as const),
  )
  const activeDefinition = definitionByKey.get(activeKey)
  const overDefinition = definitionByKey.get(overKey)

  if (!activeDefinition || !overDefinition) {
    return normalizedOrder
  }

  const activeIndex = normalizedOrder.indexOf(activeKey)
  const overIndex = normalizedOrder.indexOf(overKey)
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return normalizedOrder
  }

  const fixedCount = definitions.filter(definition => definition.fixed === 'left').length
  const nextOrder = [...normalizedOrder]
  nextOrder.splice(activeIndex, 1)

  if (activeDefinition.fixed === 'left') {
    if (overDefinition.fixed !== 'left') return normalizedOrder
    const targetIndex = nextOrder.indexOf(overKey)
    nextOrder.splice(Math.max(0, targetIndex + (activeIndex < overIndex ? 1 : 0)), 0, activeKey)
    return normalizeOrder(definitions, nextOrder)
  }

  if (overDefinition.fixed === 'left') {
    nextOrder.splice(fixedCount, 0, activeKey)
    return nextOrder
  }

  const targetIndex = nextOrder.indexOf(overKey)
  nextOrder.splice(targetIndex + (activeIndex < overIndex ? 1 : 0), 0, activeKey)
  return nextOrder
}

export function orderVisibleDefinitions<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  value: SortableColumnSettingsValue<Key>,
): SortableColumnDefinition<Key>[] {
  const normalized = normalizeColumnSettings(definitions, value)
  const definitionByKey = new Map(
    definitions.map(definition => [definition.key, definition] as const),
  )
  const visibleKeys = new Set(normalized.visible)

  return normalized.order
    .filter(key => visibleKeys.has(key))
    .map(key => definitionByKey.get(key))
    .filter((definition): definition is SortableColumnDefinition<Key> => Boolean(definition))
}
