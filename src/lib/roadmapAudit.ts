import type {
  RoadmapAuditField,
  RoadmapAuditSnapshot,
  RoadmapFieldChange,
  RoadmapProjectFields,
  TosVersionConfig,
} from '@/types/roadmap'
import { buildRoadmapDisplayName, formatRoadmapTosValue } from '@/lib/roadmapValidation'

export const ROADMAP_AUDIT_FIELDS: readonly RoadmapAuditField[] = [
  'firstSaleTosVersionId',
  'brand',
  'productLine',
  'marketName',
  'projectCode',
  'productType',
  'chipCode',
  'startRam',
  'versionType',
  'str5Date',
  'launchDate',
  'developMode',
  'remark',
]

export const ROADMAP_AUDIT_FIELD_LABELS: Record<RoadmapAuditField, string> = {
  firstSaleTosVersionId: 'tOS版本',
  brand: '品牌',
  productLine: '产品线',
  marketName: '市场名',
  projectCode: '项目名',
  productType: '产品类型',
  chipCode: '芯片编码',
  startRam: '起步RAM',
  versionType: '版本类型',
  str5Date: 'STR5时间',
  launchDate: '上市时间',
  developMode: '开发模式',
  remark: '备注',
}

function resolveAuditValue(
  field: RoadmapAuditField,
  value: RoadmapProjectFields[RoadmapAuditField],
  versions: readonly TosVersionConfig[],
): string {
  if (field !== 'firstSaleTosVersionId') return String(value ?? '')
  return versions.find(version => version.id === value)?.name ?? formatRoadmapTosValue(String(value ?? ''))
}

export function diffRoadmapProjectFields(
  before: RoadmapProjectFields,
  after: RoadmapProjectFields,
  versions: readonly TosVersionConfig[],
): RoadmapFieldChange[] {
  return ROADMAP_AUDIT_FIELDS.flatMap(field => {
    const beforeValue = resolveAuditValue(field, before[field], versions)
    const afterValue = resolveAuditValue(field, after[field], versions)
    if (beforeValue === afterValue) return []
    return [{
      field,
      before: field === 'projectCode'
        ? buildRoadmapDisplayName(before.projectCode, before.androidVersion, before.productType)
        : beforeValue,
      after: field === 'projectCode'
        ? buildRoadmapDisplayName(after.projectCode, after.androidVersion, after.productType)
        : afterValue,
    }]
  })
}

export function createRoadmapAuditSnapshot(
  fields: RoadmapProjectFields,
  versions: readonly TosVersionConfig[],
): RoadmapAuditSnapshot {
  return Object.fromEntries(
    ROADMAP_AUDIT_FIELDS.map(field => [field, resolveAuditValue(field, fields[field], versions)]),
  ) as RoadmapAuditSnapshot
}
