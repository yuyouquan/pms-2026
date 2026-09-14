import { formatProjectInfoValue } from '@/lib/projectInfoValues'
import { formatJiraProjectTag, getJiraProjectUrl, normalizeJiraProjectRows } from '@/lib/jiraProject'
import type { ProjectSummaryRow } from '@/lib/projectSummary'
import type { ProjectInfoValue } from '@/types/app'

/** Export complete values, independently of cell truncation and collapsed grouping rows. */
export function getProjectListExportValue(key: string, row: ProjectSummaryRow): string | number {
  if (key === 'jiraProjects') return normalizeJiraProjectRows(row.__jiraProjects).map(item => `${formatJiraProjectTag(item)} (${getJiraProjectUrl(item)})`).join('\n') || '-'
  if (key === 'fanTrialEnabled' && row.__fanTrialEnabled === '是') return formatProjectInfoValue(row.__fanTrialCountries as ProjectInfoValue)
  const value = row[key]
  return typeof value === 'number' ? value : typeof value === 'string' ? value : formatProjectInfoValue(value as ProjectInfoValue)
}
