export type JiraProjectType = 'sw' | 'monkey'

export interface JiraProjectConfig {
  id: string
  server: string
  projectKey: string
  type: JiraProjectType
  shared: boolean
  affectProjects: string
}

export class JiraProjectValidationError extends Error {
  readonly rowId: string
  readonly rowIndex: number
  readonly fieldKey: string

  constructor(rowId: string, rowIndex: number, fieldKey: string, message: string) {
    super(message)
    this.name = 'JiraProjectValidationError'
    this.rowId = rowId
    this.rowIndex = rowIndex
    this.fieldKey = fieldKey
  }
}

type JiraProjectConfigInput = Partial<JiraProjectConfig> & Record<string, unknown>

const jiraProjectCopySequence = { value: 0 }

const createUniqueJiraProjectId = () => {
  jiraProjectCopySequence.value += 1
  return `jira-${Date.now()}-${jiraProjectCopySequence.value}-${Math.random().toString(16).slice(2)}`
}

export const normalizeJiraProjectConfig = (input: JiraProjectConfigInput): JiraProjectConfig => {
  const shared = input.shared === undefined || input.shared === null ? false : Boolean(input.shared)
  return {
    id: typeof input.id === 'string' ? input.id.trim() : '',
    server: typeof input.server === 'string' ? input.server.trim() : '',
    projectKey: typeof input.projectKey === 'string' ? input.projectKey.trim() : '',
    type: typeof input.type === 'string' ? input.type.trim() as JiraProjectType : 'sw',
    shared,
    affectProjects: shared && typeof input.affectProjects === 'string' ? input.affectProjects.trim() : '',
  }
}

export const normalizeJiraProjectRows = (rows: unknown): JiraProjectConfig[] => (
  Array.isArray(rows) ? rows.map(row => normalizeJiraProjectConfig((row && typeof row === 'object' ? row : {}) as JiraProjectConfigInput)) : []
)

export const patchJiraProjectConfig = (
  config: JiraProjectConfig,
  patch: Partial<JiraProjectConfig>,
): JiraProjectConfig => normalizeJiraProjectConfig({ ...config, ...patch } as JiraProjectConfigInput)

export const copyJiraProjectConfig = (config: JiraProjectConfig): JiraProjectConfig => ({
  ...normalizeJiraProjectConfig(config as JiraProjectConfigInput),
  id: createUniqueJiraProjectId(),
})

const JIRA_REQUIRED_FIELDS: Array<{ key: 'server' | 'projectKey' | 'type'; label: string }> = [
  { key: 'server', label: 'JIRA服务器' },
  { key: 'projectKey', label: 'JIRA项目' },
  { key: 'type', label: 'JIRA类型' },
]

export const validateJiraProjectRows = (rows: unknown): JiraProjectValidationError[] => {
  if (!Array.isArray(rows)) return []
  const errors: JiraProjectValidationError[] = []
  rows.forEach((rawRow, rowIndex) => {
    const row = normalizeJiraProjectConfig((rawRow && typeof rawRow === 'object' ? rawRow : {}) as JiraProjectConfigInput)
    const rowId = row.id || `row-${rowIndex}`
    JIRA_REQUIRED_FIELDS.forEach(({ key, label }) => {
      if (!row[key]) errors.push(new JiraProjectValidationError(rowId, rowIndex, key, `请填写${label}`))
    })
    if (row.shared && !row.affectProjects) {
      errors.push(new JiraProjectValidationError(rowId, rowIndex, 'affectProjects', '共享JIRA项目请填写影响项目'))
    }
  })
  return errors
}

export const JIRA_SERVER_OPTIONS = [
  { label: 'jira.transsion.com', value: 'jira.transsion.com' },
  { label: 'jira-ex.transsion.com:6001', value: 'jira-ex.transsion.com:6001' },
]

export const JIRA_PROJECT_TYPE_OPTIONS: { label: string; value: JiraProjectType }[] = [
  { label: 'sw', value: 'sw' },
  { label: 'monkey', value: 'monkey' },
]

export const JIRA_PROJECT_NAME_OPTIONS = [
  'KN3-tOS15',
  'KN3-tOS15-Aee',
  'KN3-tOS15-HW',
  'KN4-tOS16',
  'KN4-tOS16-Aee',
  'KN4-tOS16.2-Aee',
  'KN4n-tOS16-Aee',
  'KN5-tOS16',
]

export const JIRA_AFFECT_PROJECT_OPTIONS = ['KN4', 'KN5', 'X6877', 'X6855', 'X6890'].map(value => ({
  label: value,
  value,
}))

export const SPUG_BUILD_OPTION_OPTIONS = [
  'lj8',
  'lj7',
  'co7_h8110',
  'cl9',
  'cl8',
  'co7',
  'x6886',
  'x6885',
  'x6871_h962',
  'x6853_h895',
  'x6850b',
  'x6850',
  'x6850b_h895',
  'x6850_h895',
].map(value => ({
  label: value,
  value,
}))

export const SPUG_BUILD_MARKET_OPTIONS = [
  'tocc',
  'ins2',
  'rwat',
  'n/a',
  'cn',
  'gl',
  'injo',
  'oppj',
  'mxop',
  'pkgp',
  'gldc',
  'bwor',
  'op',
  'in',
  'qttg',
].map(value => ({
  label: value,
  value,
}))

export const getJiraRegionLabel = (server: string) =>
  server.includes('jira-ex.transsion.com') ? '海外' : '国内'

export const getJiraTypeLabel = (type: string) => {
  if (type === 'sw') return '软件库'
  if (type === 'monkey') return 'monkey库'
  return type || '未知库'
}

export const formatJiraProjectTag = (project: JiraProjectConfig) =>
  `${getJiraRegionLabel(project.server)}${getJiraTypeLabel(project.type)}${project.projectKey || '-'}`

export const getJiraProjectUrl = (project: JiraProjectConfig) => {
  const server = project.server || JIRA_SERVER_OPTIONS[0].value
  const baseUrl = server.startsWith('http') ? server : `https://${server}`
  return project.projectKey ? `${baseUrl}/projects/${encodeURIComponent(project.projectKey)}` : baseUrl
}

export const getMarketProjectName = (projectName: string, market: string) =>
  market ? `${projectName}-${market}` : projectName

export const createJiraProjectConfig = (): JiraProjectConfig => ({
  id: createUniqueJiraProjectId(),
  server: JIRA_SERVER_OPTIONS[0].value,
  projectKey: '',
  type: 'sw',
  shared: true,
  affectProjects: '',
})
