import { formatEnumCellValue, normalizeTosValue } from '@/lib/enumValues'
import type {
  EnumRowByType,
  EnumRowsByType,
  EnumTypeKey,
  SingleEnumRow,
} from '@/types/enums'

export interface EnumOption {
  value: string
  label: string
  disabled?: boolean
}

export interface ProjectChipSnapshot {
  chipCode: string
  chipModel: string
  chipPlatform: string
}

export interface ChipOption extends EnumOption {
  /** Live options use their row ID; historical options use the reserved encoded value namespace. */
  historical?: true
}

export interface ProjectCategorySnapshot {
  pmsProjectCategory: string
  pmsSecondaryCategory: string
}

export interface TmgSubdomainState {
  options: EnumOption[]
  autoValue?: string
  disabled: boolean
}

export type SingleEnumTypeKey = {
  [K in EnumTypeKey]: EnumRowByType<K> extends SingleEnumRow ? K : never
}[EnumTypeKey]

const HISTORICAL_CHIP_PREFIX = '\u001fenum-chip-history:'

const historyOption = (value: string, label: string): EnumOption => ({
  value,
  label: `${label}（已停用）`,
  disabled: true,
})

const nonemptyString = (input: unknown): string => typeof input === 'string' ? input.trim() : ''

/** Project snapshots persist the tOS body; presentation owns the single prefix. */
export function normalizeTosSnapshot(input: unknown): string {
  return normalizeTosValue(input)
}

export function formatTosSnapshot(input: unknown): string {
  const value = normalizeTosSnapshot(input)
  return value ? `tOS${value}` : ''
}

export function currentTosSnapshotValues(configuredValues: readonly string[]): string[] {
  return [...new Set(configuredValues.map(normalizeTosSnapshot).filter(Boolean))]
}

export function resolveCurrentTosSnapshot(
  input: unknown,
  configuredValues: readonly string[],
): string | null {
  const value = normalizeTosSnapshot(input)
  return value && currentTosSnapshotValues(configuredValues).includes(value) ? value : null
}

export function getSingleEnumValues(
  rowsByType: EnumRowsByType,
  type: SingleEnumTypeKey,
): string[] {
  const normalize = type === 'first-sale-tos' || type === 'roadmap-tos'
    ? normalizeTosSnapshot
    : nonemptyString
  return rowsByType[type].map(row => normalize(row.value)).filter(Boolean)
}

export function buildEnumOptions(
  rowsByType: EnumRowsByType,
  type: SingleEnumTypeKey,
  historicalValues: readonly string[] = [],
): EnumOption[] {
  const currentValues = getSingleEnumValues(rowsByType, type)
  const options = currentValues.map(value => ({
    value,
    label: formatEnumCellValue(type, 'value', value),
  }))
  const seen = new Set(currentValues)
  const normalizeHistory = type === 'first-sale-tos' || type === 'roadmap-tos'
    ? normalizeTosSnapshot
    : nonemptyString

  for (const input of historicalValues) {
    const value = normalizeHistory(input)
    if (!value || seen.has(value)) continue
    seen.add(value)
    options.push(historyOption(value, formatEnumCellValue(type, 'value', value)))
  }

  return options
}

const chipSnapshotKey = (snapshot: ProjectChipSnapshot): string => JSON.stringify([
  snapshot.chipCode,
  snapshot.chipModel,
  snapshot.chipPlatform,
])

const chipLabel = (snapshot: ProjectChipSnapshot): string => [
  snapshot.chipCode,
  snapshot.chipModel,
  snapshot.chipPlatform,
].join(' / ')

export function encodeHistoricalChipOptionValue(snapshot: ProjectChipSnapshot): string {
  return `${HISTORICAL_CHIP_PREFIX}${encodeURIComponent(chipSnapshotKey(snapshot))}`
}

function parseHistoricalChipOptionValue(value: string): ProjectChipSnapshot | undefined {
  if (!value.startsWith(HISTORICAL_CHIP_PREFIX)) return undefined
  try {
    const encodedSnapshot = value
      .slice(HISTORICAL_CHIP_PREFIX.length)
      .replace(/:collision:\d+$/, '')
    const parsed: unknown = JSON.parse(decodeURIComponent(encodedSnapshot))
    if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every(item => typeof item === 'string')) {
      return undefined
    }
    const [chipCode, chipModel, chipPlatform] = parsed
    return { chipCode, chipModel, chipPlatform }
  } catch {
    return undefined
  }
}

export function decodeHistoricalChipOptionValue(
  rowsByType: EnumRowsByType,
  value: string,
): ProjectChipSnapshot | undefined {
  if (rowsByType['chip-mapping'].some(row => row.id === value)) return undefined
  return parseHistoricalChipOptionValue(value)
}

export function isHistoricalChipOptionValue(
  rowsByType: EnumRowsByType,
  value: string,
): boolean {
  return decodeHistoricalChipOptionValue(rowsByType, value) !== undefined
}

export function buildChipOptions(
  rowsByType: EnumRowsByType,
  historical: readonly ProjectChipSnapshot[] = [],
): ChipOption[] {
  const rows = rowsByType['chip-mapping']
  const options: ChipOption[] = rows.map(row => ({
    value: row.id,
    label: chipLabel(row),
  }))
  const seen = new Set(rows.map(chipSnapshotKey))
  const usedOptionValues = new Set(rows.map(row => row.id))

  for (const snapshot of historical) {
    const key = chipSnapshotKey(snapshot)
    if (seen.has(key)) continue
    seen.add(key)
    const defaultValue = encodeHistoricalChipOptionValue(snapshot)
    let value = defaultValue
    let collision = 1
    while (usedOptionValues.has(value)) {
      value = `${defaultValue}:collision:${collision}`
      collision += 1
    }
    usedOptionValues.add(value)
    options.push({
      ...historyOption(value, chipLabel(snapshot)),
      historical: true,
    })
  }

  return options
}

export function resolveChipRow(
  rowsByType: EnumRowsByType,
  rowId: string,
): ProjectChipSnapshot | undefined {
  const row = rowsByType['chip-mapping'].find(candidate => candidate.id === rowId)
  if (row) {
    return {
      chipCode: row.chipCode,
      chipModel: row.chipModel,
      chipPlatform: row.chipPlatform,
    }
  }
  if (isHistoricalChipOptionValue(rowsByType, rowId)) return undefined
  return undefined
}

export function findProjectCategoryMapping(
  rowsByType: EnumRowsByType,
  ipmCategory: string,
): ProjectCategorySnapshot | undefined {
  const category = ipmCategory.trim()
  if (!category) return undefined
  const row = rowsByType['project-category-mapping'].find(
    candidate => candidate.ipmProjectCategory.trim() === category,
  )
  if (!row) return undefined

  const pmsProjectCategory = row.pmsProjectCategory.trim()
  const pmsSecondaryCategory = row.pmsSecondaryCategory.trim()
  return {
    pmsProjectCategory,
    pmsSecondaryCategory: pmsProjectCategory === '整机产品项目' ? pmsSecondaryCategory : '',
  }
}

export function getTmgDomains(
  rowsByType: EnumRowsByType,
  historicalDomain?: string,
): EnumOption[] {
  const options: EnumOption[] = []
  const seen = new Set<string>()
  for (const row of rowsByType['tmg-subdomain-mapping']) {
    const domain = row.domain.trim()
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    options.push({ value: domain, label: domain })
  }

  const history = nonemptyString(historicalDomain)
  if (history && !seen.has(history)) options.push(historyOption(history, history))
  return options
}

export function getTmgSubdomainState(
  rowsByType: EnumRowsByType,
  domain: string,
  historicalSubdomain?: string,
  historicalDomain?: string,
): TmgSubdomainState {
  const selectedDomain = domain.trim()
  const liveSubdomains: string[] = []
  const seen = new Set<string>()
  for (const row of rowsByType['tmg-subdomain-mapping']) {
    const subdomain = row.subdomain.trim()
    if (row.domain.trim() !== selectedDomain || !subdomain || seen.has(subdomain)) continue
    seen.add(subdomain)
    liveSubdomains.push(subdomain)
  }

  const options = liveSubdomains.map(value => ({ value, label: value }))
  const history = nonemptyString(historicalSubdomain)
  const historyMatchesDomain = historicalDomain === undefined
    || selectedDomain === nonemptyString(historicalDomain)
  const hasOrphanSnapshot = Boolean(
    history
    && historyMatchesDomain
    && !seen.has(history),
  )
  if (hasOrphanSnapshot) options.push(historyOption(history, history))

  // This reports live configuration facts only. UI code must apply autoValue only after an
  // explicit domain change or when the field is empty, preserving nonempty edit snapshots.
  const onlyNone = liveSubdomains.length === 1
    && liveSubdomains[0] === '无'
  return {
    options,
    ...(onlyNone ? { autoValue: '无' } : {}),
    disabled: onlyNone,
  }
}
