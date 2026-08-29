import { DEFAULT_MR_TEMPLATE_ACTIVITIES } from '@/data/mrVersionPlanMocks'
import type { MrTemplateActivity, MrTemplateVersion } from '@/types/mrVersionPlan'

export { DEFAULT_MR_TEMPLATE_ACTIVITIES }

const cloneVersion = (version: MrTemplateVersion): MrTemplateVersion => ({
  ...version,
  activities: cloneMrTemplateSnapshot(version.activities),
})

function getMrTemplateStructureErrors(rows: readonly MrTemplateActivity[]): string[] {
  const errors: string[] = []
  const knownIds = new Map<string, MrTemplateActivity>()
  const duplicateIds = new Set<string>()

  rows.forEach(row => {
    const id = row.id.trim()
    if (!id) {
      errors.push('活动 ID 不能为空')
    } else if (knownIds.has(row.id)) {
      if (!duplicateIds.has(row.id)) errors.push(`活动 ID 重复：${row.id}`)
      duplicateIds.add(row.id)
    } else {
      knownIds.set(row.id, row)
    }

    if (!row.activityName.trim()) errors.push('活动名称不能为空')
  })

  rows.forEach(row => {
    if (row.parentId === null) return
    const parent = knownIds.get(row.parentId)
    if (!parent) {
      errors.push(`父活动不存在：${row.parentId}`)
    } else if (parent.parentId !== null) {
      errors.push('最多支持两级活动')
    }
  })

  return [...new Set(errors)]
}

function sortByOrder(rows: readonly MrTemplateActivity[]): MrTemplateActivity[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => left.row.order - right.row.order || left.index - right.index)
    .map(({ row }) => row)
}

function reindexActivityBlocks(blocks: readonly MrTemplateActivity[][]): MrTemplateActivity[] {
  return blocks.flatMap((block, parentOrder) => block.map((row, index) => ({
    ...row,
    order: index === 0 ? parentOrder : index - 1,
  })))
}

function getNumericMrTemplateVersion(versionNo: string): number | undefined {
  const match = /^V(\d+)$/.exec(versionNo)
  return match ? Number(match[1]) : undefined
}

export function normalizeMrTemplateActivities(rows: readonly MrTemplateActivity[]): MrTemplateActivity[] {
  const errors = getMrTemplateStructureErrors(rows)
  if (errors.length > 0) throw new Error(errors[0])

  const childrenByParent = new Map<string, MrTemplateActivity[]>()
  rows.forEach(row => {
    if (row.parentId === null) return
    const children = childrenByParent.get(row.parentId) ?? []
    children.push(row)
    childrenByParent.set(row.parentId, children)
  })

  return sortByOrder(rows.filter(row => row.parentId === null)).flatMap((parent, parentOrder) => [
    { ...parent, order: parentOrder },
    ...sortByOrder(childrenByParent.get(parent.id) ?? []).map((child, childOrder) => ({ ...child, order: childOrder })),
  ])
}

export function numberMrTemplateActivities(
  rows: readonly MrTemplateActivity[],
): Array<MrTemplateActivity & { number: string; depth: 0 | 1 }> {
  const normalized = normalizeMrTemplateActivities(rows)
  const parentNumbers = new Map(
    normalized.filter(row => row.parentId === null).map((row, index) => [row.id, index + 1]),
  )
  const childNumbers = new Map<string, number>()

  return normalized.map(row => {
    if (row.parentId === null) {
      return { ...row, number: String(parentNumbers.get(row.id)), depth: 0 }
    }

    const childNumber = (childNumbers.get(row.parentId) ?? 0) + 1
    childNumbers.set(row.parentId, childNumber)
    return { ...row, number: `${parentNumbers.get(row.parentId)}.${childNumber}`, depth: 1 }
  })
}

export function validateMrTemplateForPublish(rows: readonly MrTemplateActivity[]): string[] {
  const errors = getMrTemplateStructureErrors(rows)
  const activityNames = new Map<string, number>()

  rows.forEach(row => {
    const name = row.activityName.trim()
    if (name) activityNames.set(name, (activityNames.get(name) ?? 0) + 1)
  })

  activityNames.forEach((count, name) => {
    if (count > 1) errors.push(`活动名称重复：${name}`)
  })

  return [...new Set(errors)]
}

export function cloneMrTemplateSnapshot(rows: readonly MrTemplateActivity[]): MrTemplateActivity[] {
  return rows.map(row => ({ ...row }))
}

export function createMrTemplateRevision(
  versions: readonly MrTemplateVersion[],
  actor: string,
  now: string,
): MrTemplateVersion[] {
  if (versions.some(version => version.status === '修订中')) throw new Error('已存在修订版本')

  const publishedVersions = versions.filter(version => version.status === '已发布')
  const latestPublished = publishedVersions.reduce<MrTemplateVersion | undefined>((latest, version) => {
    const versionNumber = getNumericMrTemplateVersion(version.versionNo)
    if (versionNumber === undefined) return latest
    const latestNumber = latest ? getNumericMrTemplateVersion(latest.versionNo) : undefined
    return latestNumber === undefined || versionNumber > latestNumber ? version : latest
  }, undefined)
  if (!latestPublished) throw new Error('不存在已发布版本')

  const nextNumber = getNumericMrTemplateVersion(latestPublished.versionNo)! + 1
  return [
    ...versions.map(cloneVersion),
    {
      id: `mr-template-v${nextNumber}`,
      versionNo: `V${nextNumber}`,
      status: '修订中',
      activities: cloneMrTemplateSnapshot(latestPublished.activities),
      createdBy: actor,
      createdAt: now,
    },
  ]
}

export function publishMrTemplateRevision(
  versions: readonly MrTemplateVersion[],
  revisionId: string,
  actor: string,
  now: string,
): MrTemplateVersion[] {
  const revision = versions.find(version => version.id === revisionId)
  if (!revision) throw new Error('修订版本不存在')
  if (revision.status !== '修订中') throw new Error('仅可发布修订版本')

  const errors = validateMrTemplateForPublish(revision.activities)
  if (errors.length > 0) throw new Error(errors.join('；'))
  void actor

  return versions.map(version => version.id === revisionId
    ? { ...cloneVersion(version), status: '已发布', publishedAt: now }
    : cloneVersion(version))
}

export function cancelMrTemplateRevision(
  versions: readonly MrTemplateVersion[],
  revisionId: string,
): MrTemplateVersion[] {
  const revision = versions.find(version => version.id === revisionId)
  if (!revision) throw new Error('修订版本不存在')
  if (revision.status !== '修订中') throw new Error('仅可取消修订版本')
  return versions.filter(version => version.id !== revisionId).map(cloneVersion)
}

export function moveMrTemplateActivity(
  rows: readonly MrTemplateActivity[],
  activeId: string,
  overId: string,
): MrTemplateActivity[] {
  const normalized = normalizeMrTemplateActivities(rows)
  if (activeId === overId) return normalized

  const active = normalized.find(row => row.id === activeId)
  const over = normalized.find(row => row.id === overId)
  if (!active || !over || active.parentId !== over.parentId) return normalized

  const parents = normalized.filter(row => row.parentId === null)
  const blocks = parents.map(parent => [parent, ...normalized.filter(row => row.parentId === parent.id)])

  if (active.parentId === null) {
    const activeIndex = blocks.findIndex(block => block[0].id === activeId)
    const overIndex = blocks.findIndex(block => block[0].id === overId)
    if (activeIndex < 0 || overIndex < 0) return normalized
    const nextBlocks = [...blocks]
    const [activeBlock] = nextBlocks.splice(activeIndex, 1)
    nextBlocks.splice(overIndex, 0, activeBlock)
    return normalizeMrTemplateActivities(reindexActivityBlocks(nextBlocks))
  }

  const parentIndex = blocks.findIndex(block => block[0].id === active.parentId)
  if (parentIndex < 0) return normalized
  const nextBlocks = blocks.map(block => [...block])
  const children = nextBlocks[parentIndex].slice(1)
  const activeIndex = children.findIndex(row => row.id === activeId)
  const overIndex = children.findIndex(row => row.id === overId)
  if (activeIndex < 0 || overIndex < 0) return normalized
  const [activeChild] = children.splice(activeIndex, 1)
  children.splice(overIndex, 0, activeChild)
  nextBlocks[parentIndex] = [nextBlocks[parentIndex][0], ...children]
  return normalizeMrTemplateActivities(reindexActivityBlocks(nextBlocks))
}
