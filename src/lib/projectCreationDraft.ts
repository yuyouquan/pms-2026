export const PROJECT_CREATION_DRAFT_SCHEMA_VERSION = 1

export interface ProjectCreationDraft {
  schemaVersion: number
  ownerId: string
  values: Record<string, unknown>
  activeGroups: string[]
  updatedAt: string
}

export interface ProjectCreationDraftRepository {
  get(ownerId: string): Promise<ProjectCreationDraft | null>
  save(draft: ProjectCreationDraft): Promise<void>
  clear(ownerId: string): Promise<void>
}

export interface ProjectCreationDraftSession {
  generation: number
  ownerId: string
}

export const shouldClearSubmittedProjectCreationDraft = (
  submittedSession: ProjectCreationDraftSession,
  currentSession: ProjectCreationDraftSession | null,
) => !currentSession
  || currentSession.ownerId !== submittedSession.ownerId
  || currentSession.generation <= submittedSession.generation

interface ProjectCreationDraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type ProjectCreationDraftStorageFactory = () => ProjectCreationDraftStorage

const PROJECT_CREATION_DRAFT_STORAGE_KEY_PREFIX = 'pms:project-creation-draft:'

const getStorageKey = (ownerId: string) =>
  `${PROJECT_CREATION_DRAFT_STORAGE_KEY_PREFIX}${encodeURIComponent(ownerId)}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isValidDraft = (value: unknown, ownerId: string): value is ProjectCreationDraft => {
  if (!isRecord(value)) return false

  return value.schemaVersion === PROJECT_CREATION_DRAFT_SCHEMA_VERSION
    && value.ownerId === ownerId
    && isRecord(value.values)
    && Array.isArray(value.activeGroups)
    && value.activeGroups.every((group) => typeof group === 'string')
    && typeof value.updatedAt === 'string'
}

const getBrowserStorage: ProjectCreationDraftStorageFactory = () => {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is unavailable outside the browser')
  }

  return window.localStorage
}

export class LocalStorageProjectCreationDraftRepository implements ProjectCreationDraftRepository {
  constructor(private readonly getStorage: ProjectCreationDraftStorageFactory = getBrowserStorage) {}

  async get(ownerId: string): Promise<ProjectCreationDraft | null> {
    const storedDraft = this.getStorage().getItem(getStorageKey(ownerId))
    if (storedDraft === null) return null

    try {
      const parsedDraft: unknown = JSON.parse(storedDraft)
      return isValidDraft(parsedDraft, ownerId) ? parsedDraft : null
    } catch {
      return null
    }
  }

  async save(draft: ProjectCreationDraft): Promise<void> {
    this.getStorage().setItem(getStorageKey(draft.ownerId), JSON.stringify(draft))
  }

  async clear(ownerId: string): Promise<void> {
    this.getStorage().removeItem(getStorageKey(ownerId))
  }
}

export const defaultProjectCreationDraftRepository: ProjectCreationDraftRepository =
  new LocalStorageProjectCreationDraftRepository()

const isEmptyFieldValue = (value: unknown) =>
  value === undefined
  || value === null
  || value === ''
  || (Array.isArray(value) && value.length === 0)

export const isProjectCreationDraftEmpty = (values: Record<string, unknown>) =>
  Object.entries(values).every(([key, value]) => {
    if (key === 'healthStatus' && value === 'normal') return true
    if (key === 'status' && value === '待立项') return true
    return isEmptyFieldValue(value)
  })
