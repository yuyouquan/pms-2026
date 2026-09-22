import { MOCK_CHECKLIST_TEMPLATES, MOCK_REVIEW_ELEMENT_TEMPLATES, type CheckListTemplate, type ReviewElementTemplate, type TMTeamMember } from '@/mock/transfer-maintenance'
import { resolveProjectClassification } from '@/constants/projectTypes'

export type TransferProjectType = '整机产品项目' | 'tOS版本项目'
export type TransferTemplateKind = 'checklist' | 'review'
export interface TransferTeamRole { id: string; roleName: string; ipmRoleCode: string }
export interface TransferTemplateSet { checklist: CheckListTemplate[]; reviewElements: ReviewElementTemplate[] }
export type TransferTemplateRow = CheckListTemplate | ReviewElementTemplate
export interface TransferTemplateSnapshot { id: string; version: string; date: string; createdBy: string; kind: TransferTemplateKind; rows: TransferTemplateRow[] }
export type TransferTemplateVersions = Record<TransferProjectType, Record<TransferTemplateKind, TransferTemplateSnapshot[]>>
export const TRANSFER_PROJECT_TYPES: TransferProjectType[] = ['整机产品项目', 'tOS版本项目']
export const TRANSFER_TEMPLATE_HEADERS = {
  checklist: ['序号', '标准', '类型', '责任角色', '资料录入-责任人', '人工审核-责任人', '智能检查规则'],
  review: ['序号', '评审要素', '类型', '说明', '备注', '责任角色', '资料录入-责任人', '人工审核-责任人', '智能检查规则'],
}
export function getTransferProjectType(project: string | { id?: string; type?: string; projectType?: string } | null | undefined): TransferProjectType {
  const raw = typeof project === 'string' ? project : project?.type ?? project?.projectType
  return resolveProjectClassification(raw).projectCategory === 'tOS版本项目' ? 'tOS版本项目' : '整机产品项目'
}
export function getTransferRoleConfig(kind: TransferProjectType): TransferTeamRole[] {
  if (kind === 'tOS版本项目') return [{ id: 'spm', roleName: 'SPM', ipmRoleCode: 'SPM' }, { id: 'test', roleName: 'TPM', ipmRoleCode: 'TPM' }]
  return [{ id: 'spm', roleName: 'SPM', ipmRoleCode: 'SPM' }, { id: 'test', roleName: '测试', ipmRoleCode: 'TPM' }, { id: 'base', roleName: '底软', ipmRoleCode: '底软' }, { id: 'system', roleName: '系统', ipmRoleCode: '系统' }, { id: 'camera', roleName: '影像', ipmRoleCode: '影像' }]
}
export function getTransferMember(team: readonly TMTeamMember[], role: string, config: readonly TransferTeamRole[] = []): TMTeamMember | undefined {
  const target = config.find(row => row.roleName === role || row.ipmRoleCode === role)
  return team.find(member => member.role === (target?.roleName ?? role))
    ?? team.find(member => member.ipmRoleCode === (target?.ipmRoleCode ?? role) || member.role === (target?.ipmRoleCode ?? (role === '测试' ? 'TPM' : role)))
}
export function validateTransferTeamConfig(roles: readonly TransferTeamRole[]): string[] {
  const errors: string[] = []
  if (!roles.some(role => role.id === 'spm')) errors.push('请保留维护SPM终审角色')
  if (roles.some(role => !role.roleName.trim() || !role.ipmRoleCode.trim())) errors.push('角色名和IPM角色Code不能为空')
  if (new Set(roles.map(role => role.roleName.trim())).size !== roles.length) errors.push('角色名不能重复')
  if (new Set(roles.map(role => role.ipmRoleCode.trim().toLowerCase())).size !== roles.length) errors.push('IPM角色Code不能重复')
  if (roles.some(role => roles.some(other => other.id !== role.id && role.roleName.trim().toLowerCase() === other.ipmRoleCode.trim().toLowerCase()))) errors.push('角色名不能与其他角色的IPM角色Code相同')
  return errors
}
export function createTransferTemplateVersions(): TransferTemplateVersions {
  const create = (project: TransferProjectType, kind: TransferTemplateKind): TransferTemplateSnapshot[] => {
    if (project === 'tOS版本项目' && kind === 'review') return []
    let sequence = 0, last = ''
    const roles = getTransferRoleConfig(project)
    const resolveRole = (role: string) => roles.find(candidate => candidate.roleName === role || candidate.ipmRoleCode === (role === '测试' ? 'TPM' : role))
    const rows: TransferTemplateRow[] = (kind === 'checklist' ? MOCK_CHECKLIST_TEMPLATES : MOCK_REVIEW_ELEMENT_TEMPLATES).filter(row => resolveRole(row.responsibleRole)).map(row => {
      const text = 'checkItem' in row ? row.checkItem : row.standard
      if (text !== last) { sequence++; last = text }
      const role = resolveRole(row.responsibleRole)!.roleName
      return { ...row, responsibleRole: role, entryRole: `在研${role}`, reviewRole: `维护${role}`, seq: row.seq ?? sequence, ...(!('checkItem' in row) ? { type: row.type ?? '检查项' } : {}) }
    })
    return [{ id: `${project}-${kind}-1`, version: 'v1.0', date: '2026-09-22', createdBy: '系统', kind, rows }]
  }
  return Object.fromEntries(TRANSFER_PROJECT_TYPES.map(project => [project, { checklist: create(project, 'checklist'), review: create(project, 'review') }])) as TransferTemplateVersions
}
export function getCurrentTransferTemplates(project: TransferProjectType, versions: TransferTemplateVersions): TransferTemplateSet {
  return { checklist: (versions[project].checklist.at(-1)?.rows ?? []) as CheckListTemplate[], reviewElements: project === 'tOS版本项目' ? [] : (versions[project].review.at(-1)?.rows ?? []) as ReviewElementTemplate[] }
}
export function transferTemplateRowSpans(rows: readonly TransferTemplateRow[]): number[] {
  const spans = rows.map(() => 0)
  for (let start = 0; start < rows.length;) {
    const row = rows[start], text = 'checkItem' in row ? row.checkItem : row.standard
    let end = start + 1
    while (end < rows.length && String(rows[end].seq) === String(row.seq) && ('checkItem' in rows[end] ? (rows[end] as CheckListTemplate).checkItem : (rows[end] as ReviewElementTemplate).standard) === text) end++
    spans[start] = end - start; start = end
  }
  return spans
}
/** Only explicit Excel merge ranges are expanded by the file reader. A blank sequence is an error. */
export function parseTransferTemplateRows(matrix: unknown[][], kind: TransferTemplateKind, roles: readonly TransferTeamRole[]): TransferTemplateRow[] {
  const headers = TRANSFER_TEMPLATE_HEADERS[kind]
  if (!matrix.length || headers.some((header, index) => String(matrix[0][index] ?? '').trim() !== header) || matrix[0].filter(value => String(value ?? '').trim()).length !== headers.length) throw new Error(`表头必须依次为：${headers.join('、')}`)
  const rows = matrix.slice(1).filter(row => row.some(value => String(value ?? '').trim()))
  if (!rows.length) throw new Error('模板不能为空')
  return rows.map((row, index) => {
    const values = headers.map((_, i) => String(row[i] ?? '').trim())
    const roleIndex = kind === 'checklist' ? 3 : 5
    if (!values[0] || !values[1] || !values[2]) throw new Error(`第${index + 2}行：序号、${kind === 'checklist' ? '标准' : '评审要素'}和类型不能为空`)
    const resolveRole = (value: string) => roles.find(role => role.roleName === value || role.ipmRoleCode === value)
    const role = resolveRole(values[roleIndex])
    if (!role) throw new Error(`第${index + 2}行：责任角色“${values[roleIndex]}”未在转维团队配置中定义`)
    const entry = resolveRole(values[roleIndex + 1].replace(/^在研/, ''))
    const review = resolveRole(values[roleIndex + 2].replace(/^维护/, ''))
    if (!entry || !review) throw new Error(`第${index + 2}行：资料录入/人工审核角色必须匹配团队角色名或IPM角色Code`)
    const common = { id: index + 1, seq: values[0], responsibleRole: role.roleName, entryRole: `在研${entry.roleName}`, reviewRole: `维护${review.roleName}`, aiCheckRule: values[roleIndex + 3] }
    return kind === 'checklist' ? { ...common, checkItem: values[1], type: values[2] } : { ...common, standard: values[1], type: values[2], description: values[3], remark: values[4] }
  })
}
export function transferTemplateMatrix(rows: readonly TransferTemplateRow[], kind: TransferTemplateKind): (string | number)[][] {
  return rows.map((row, index) => [row.seq ?? index + 1, ...('checkItem' in row ? [row.checkItem, row.type] : [row.standard, row.type ?? '检查项', row.description, row.remark]), row.responsibleRole, row.entryRole, row.reviewRole, row.aiCheckRule])
}

/** Occurrence suffixes retain every row in a merged group, including duplicate business keys. */
export function compareTransferTemplates(before: readonly TransferTemplateRow[], after: readonly TransferTemplateRow[], kind: TransferTemplateKind) {
  const index = (rows: readonly TransferTemplateRow[]) => {
    const counts = new Map<string, number>()
    return new Map(rows.map(row => {
      const base = JSON.stringify([String(row.seq), 'checkItem' in row ? row.checkItem : row.standard, row.responsibleRole, row.type])
      const count = counts.get(base) ?? 0
      counts.set(base, count + 1)
      return [`${base}:${count}`, row] as const
    }))
  }
  const left = index(before), right = index(after)
  return [...new Set([...left.keys(), ...right.keys()])].flatMap(id => {
    const old = left.get(id), next = right.get(id)
    const oldValues = old && transferTemplateMatrix([old], kind)[0].map(String), nextValues = next && transferTemplateMatrix([next], kind)[0].map(String)
    return JSON.stringify(oldValues) === JSON.stringify(nextValues) ? [] : [{ id, change: !old ? '新增' : !next ? '删除' : '修改', before: oldValues?.join(' / ') ?? '-', after: nextValues?.join(' / ') ?? '-' }]
  })
}
