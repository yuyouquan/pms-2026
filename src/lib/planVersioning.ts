export type PlanRevisionKind = 'gray' | 'formal'

export interface PlanVersionLike {
  versionNo: string
  status?: string
  publishedAt?: string
}

export const formatPlanPublishedDate = (version: PlanVersionLike): string => {
  if (version.status === '修订中') return '修订中'
  if (!version.publishedAt) return '-'
  const publishedAt = new Date(version.publishedAt)
  if (!Number.isFinite(publishedAt.getTime())) return '-'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(publishedAt)
}

interface ParsedPlanVersion {
  major: number
  minor: number | null
}

export const parsePlanVersionNo = (versionNo: string): ParsedPlanVersion | null => {
  const match = /^V(\d+)(?:\.(\d+))?$/i.exec((versionNo || '').trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: match[2] === undefined ? null : Number(match[2]),
  }
}

export const comparePlanVersions = (a: PlanVersionLike, b: PlanVersionLike) => {
  const pa = parsePlanVersionNo(a.versionNo)
  const pb = parsePlanVersionNo(b.versionNo)
  if (!pa && !pb) return a.versionNo.localeCompare(b.versionNo)
  if (!pa) return -1
  if (!pb) return 1
  if (pa.major !== pb.major) return pa.major - pb.major
  return (pa.minor ?? 0) - (pb.minor ?? 0)
}

export const getPlanVersionId = (versionNo: string) => `v${versionNo.replace(/^V/i, '')}`

export const getNextPlanRevisionVersionNo = (
  versions: PlanVersionLike[],
  kind: PlanRevisionKind,
) => {
  const parsedVersions = versions
    .map(version => parsePlanVersionNo(version.versionNo))
    .filter((version): version is ParsedPlanVersion => !!version)

  if (kind === 'formal') {
    const maxFormalMajor = parsedVersions
      .filter(version => version.minor === null)
      .reduce((max, version) => Math.max(max, version.major), 0)
    return `V${maxFormalMajor + 1}`
  }

  const latestFormalMajor = parsedVersions
    .filter(version => version.minor === null && version.major > 0)
    .reduce((max, version) => Math.max(max, version.major), 0)
  const grayMajor = latestFormalMajor || 0
  const maxGrayMinor = parsedVersions
    .filter(version => version.major === grayMajor && version.minor !== null)
    .reduce((max, version) => Math.max(max, version.minor ?? 0), 0)

  return `V${grayMajor}.${maxGrayMinor + 1}`
}

export const getDisplayPlanVersionsForHorizontalPlan = <T extends PlanVersionLike>(
  versions: T[],
  options: { includeDraft?: boolean } = {},
): T[] => {
  const releasedVersions = versions
    .filter(version => !version.status || version.status === '已发布')
    .filter(version => parsePlanVersionNo(version.versionNo))
  const draftVersions = options.includeDraft
    ? versions.filter(version => version.status === '修订中' && parsePlanVersionNo(version.versionNo))
    : []

  const latestFormalMajor = releasedVersions
    .map(version => parsePlanVersionNo(version.versionNo))
    .filter((version): version is ParsedPlanVersion => !!version && version.minor === null && version.major > 0)
    .reduce((max, version) => Math.max(max, version.major), 0)

  if (latestFormalMajor === 0) {
    return [...releasedVersions, ...draftVersions].sort(comparePlanVersions)
  }

  const visibleReleasedVersions = releasedVersions
    .filter(version => {
      const parsed = parsePlanVersionNo(version.versionNo)
      if (!parsed) return false
      const isFormalVersion = parsed.minor === null && parsed.major > 0
      const isLatestFormalGray = parsed.major === latestFormalMajor && parsed.minor !== null
      return isFormalVersion || isLatestFormalGray
    })

  return [...visibleReleasedVersions, ...draftVersions].sort(comparePlanVersions)
}

export const getRevisionKindForLatestPublishedVersion = (
  versions: PlanVersionLike[],
): PlanRevisionKind | null => {
  const latestPublished = versions
    .filter(version => !version.status || version.status === '已发布')
    .filter(version => parsePlanVersionNo(version.versionNo))
    .sort((a, b) => comparePlanVersions(b, a))[0]

  if (!latestPublished) return null
  const parsed = parsePlanVersionNo(latestPublished.versionNo)
  if (!parsed) return null
  return parsed.minor === null ? 'formal' : 'gray'
}
