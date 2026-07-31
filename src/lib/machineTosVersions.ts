export type MachineTosErrorReason =
  | 'missing-new-product'
  | 'duplicate-new-product'
  | 'invalid-version'

export interface MachineTosProjectLike {
  id: string
  name: string
  kind?: 'new' | 'legacy'
  productType?: string
  firstSaleTosVersionId?: unknown
  firstSaleTosVersion?: unknown
  currentTosVersionId?: unknown
  currentTosVersion?: unknown
  tosVersionName?: unknown
  tosVersion?: unknown
  fieldValues?: Record<string, unknown>
  [key: string]: unknown
}

export interface MachineTosProjectUpdate {
  id: string
  currentTosVersion: string
}

export type MachineTosResolution<T extends MachineTosProjectLike = MachineTosProjectLike> =
  | {
      ok: true
      candidate: T & {
        firstSaleTosVersion: string
        currentTosVersion: string
      }
      updates: MachineTosProjectUpdate[]
    }
  | {
      ok: false
      reason: MachineTosErrorReason
    }

const THREE_PART_VERSION_PATTERN = /^\d+\.\d+\.\d+$/

export const normalizeMachineFamilyName = (name: unknown): string => (
  typeof name === 'string' ? name.trim() : ''
)

const normalizeThreePartVersion = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^tOS\s*/i, '').replace(/（已停用）$/, '').trim()
}

const parseThreePartVersion = (value: unknown): [number, number, number] | null => {
  const normalized = normalizeThreePartVersion(value)
  if (!THREE_PART_VERSION_PATTERN.test(normalized)) return null
  const parts = normalized.split('.').map(Number)
  return parts.every(Number.isSafeInteger)
    ? parts as [number, number, number]
    : null
}

export const compareThreePartVersions = (left: unknown, right: unknown): number => {
  const leftParts = parseThreePartVersion(left)
  const rightParts = parseThreePartVersion(right)
  if (!leftParts || !rightParts) return Number.NaN
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index]
  }
  return 0
}

const getMachineKind = (project: MachineTosProjectLike): 'new' | 'legacy' | null => {
  if (project.kind === 'new' || project.productType === '新品') return 'new'
  if (project.kind === 'legacy' || project.productType === '老品') return 'legacy'
  return null
}

const getFirstSaleVersion = (project: MachineTosProjectLike): string => normalizeThreePartVersion(
  project.firstSaleTosVersionId
  || project.firstSaleTosVersion
  || project.fieldValues?.firstSaleTosVersion
  || project.tosVersionName,
)

const getCurrentVersion = (project: MachineTosProjectLike): string => normalizeThreePartVersion(
  project.currentTosVersionId
  || project.currentTosVersion
  || project.fieldValues?.currentTosVersion
  || project.tosVersion,
)

const isValidVersion = (version: string) => parseThreePartVersion(version) !== null

const maximumVersion = (versions: string[]): string | null => {
  if (!versions.length || versions.some(version => !isValidVersion(version))) return null
  return versions.reduce((maximum, version) => (
    compareThreePartVersions(version, maximum) > 0 ? version : maximum
  ))
}

const replaceCandidate = <T extends MachineTosProjectLike>(projects: T[], candidate: T): T[] => {
  const existingIndex = projects.findIndex(project => project.id === candidate.id)
  if (existingIndex < 0) return [...projects, candidate]
  return projects.map((project, index) => index === existingIndex ? candidate : project)
}

const newProjectsInFamily = <T extends MachineTosProjectLike>(projects: T[], familyName: string) => (
  projects.filter(project => (
    getMachineKind(project) === 'new'
    && normalizeMachineFamilyName(project.name) === familyName
  ))
)

const legacyCurrentVersionsInFamily = <T extends MachineTosProjectLike>(projects: T[], familyName: string) => (
  projects
    .filter(project => (
      getMachineKind(project) === 'legacy'
      && normalizeMachineFamilyName(project.name) === familyName
    ))
    .map(getCurrentVersion)
)

export const resolveMachineTosUpdate = <T extends MachineTosProjectLike>(
  projects: T[],
  candidate: T,
): MachineTosResolution<T> => {
  const kind = getMachineKind(candidate)
  const familyName = normalizeMachineFamilyName(candidate.name)
  if (!kind || !familyName) return { ok: false, reason: 'invalid-version' }

  const previous = projects.find(project => project.id === candidate.id)

  if (kind === 'new') {
    const firstSaleTosVersion = getFirstSaleVersion(candidate)
    if (!isValidVersion(firstSaleTosVersion)) return { ok: false, reason: 'invalid-version' }
    const hypotheticalProjects = replaceCandidate(projects, {
      ...candidate,
      firstSaleTosVersion,
      currentTosVersion: firstSaleTosVersion,
    })
    const legacyVersions = legacyCurrentVersionsInFamily(hypotheticalProjects, familyName)
    const currentTosVersion = legacyVersions.length
      ? maximumVersion(legacyVersions)
      : firstSaleTosVersion
    if (!currentTosVersion) return { ok: false, reason: 'invalid-version' }
    return {
      ok: true,
      candidate: { ...candidate, firstSaleTosVersion, currentTosVersion },
      updates: [],
    }
  }

  const matchingNewProjects = newProjectsInFamily(projects, familyName)
    .filter(project => project.id !== candidate.id)
  if (matchingNewProjects.length === 0) return { ok: false, reason: 'missing-new-product' }
  if (matchingNewProjects.length > 1) return { ok: false, reason: 'duplicate-new-product' }

  const firstSaleTosVersion = getFirstSaleVersion(matchingNewProjects[0])
  const currentTosVersion = getCurrentVersion(candidate)
  if (!isValidVersion(firstSaleTosVersion) || !isValidVersion(currentTosVersion)) {
    return { ok: false, reason: 'invalid-version' }
  }

  const resolvedCandidate = { ...candidate, firstSaleTosVersion, currentTosVersion }
  const hypotheticalProjects = replaceCandidate(projects, resolvedCandidate)
  const affectedFamilyNames = new Set<string>()
  if (previous && getMachineKind(previous) === 'legacy') {
    affectedFamilyNames.add(normalizeMachineFamilyName(previous.name))
  }
  affectedFamilyNames.add(familyName)

  const updates: MachineTosProjectUpdate[] = []
  for (const affectedFamilyName of affectedFamilyNames) {
    const newProjects = newProjectsInFamily(hypotheticalProjects, affectedFamilyName)
      .filter(project => project.id !== candidate.id)
    const legacyVersions = legacyCurrentVersionsInFamily(hypotheticalProjects, affectedFamilyName)
    const maximumLegacyVersion = legacyVersions.length ? maximumVersion(legacyVersions) : null
    if (legacyVersions.length && !maximumLegacyVersion) return { ok: false, reason: 'invalid-version' }
    for (const newProject of newProjects) {
      const newFirstSaleVersion = getFirstSaleVersion(newProject)
      if (!isValidVersion(newFirstSaleVersion)) return { ok: false, reason: 'invalid-version' }
      updates.push({
        id: newProject.id,
        currentTosVersion: maximumLegacyVersion || newFirstSaleVersion,
      })
    }
  }

  return { ok: true, candidate: resolvedCandidate, updates }
}
