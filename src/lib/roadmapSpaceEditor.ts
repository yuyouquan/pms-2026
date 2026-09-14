import { projectRegistryToPlanned } from '@/lib/roadmapProjectAdapter'
import { getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { changedManualInfoValues } from '@/lib/manualProjectCompletion'
import { getProjectResponsiblePersons } from '@/lib/projectResponsibility'
import type { ProjectInfoValues, ProjectItem } from '@/types/app'
import type { ChipMappingRow } from '@/types/enums'
import type { PlannedRoadmapProjectInput } from '@/types/roadmap'

const INFO_KEYS = {
  androidVersion: 'androidVersion', productType: 'productType', firstSaleTosVersionId: 'firstSaleTosVersion',
  brand: 'brand', productLine: 'productLine', productSeries: 'productSeries', marketName: 'marketName',
  chipCode: 'chipCode', startRam: 'startingRam', versionType: 'versionType', developMode: 'developmentMode',
  str5Date: 'str5Date', launchDate: 'launchDate', str5Estimated: 'str5Estimated', launchEstimated: 'launchEstimated', remark: 'remark',
} as const

export function toRoadmapSpaceFormProject(project: ProjectItem) {
  const record = projectRegistryToPlanned(project)
  const source = project as unknown as ProjectInfoProject
  for (const [formKey, infoKey] of Object.entries(INFO_KEYS)) {
    const value = getProjectInfoValue(source, infoKey)
    if (value !== undefined && value !== null) Object.assign(record, { [formKey]: value })
  }
  // The former create form called the project name projectCode; registry identity is separate now.
  return { ...record, projectCode: project.name }
}

export function buildRoadmapSpaceEditPayload(project: ProjectItem, input: PlannedRoadmapProjectInput, chipMappings: readonly ChipMappingRow[] = []) {
  const toInfoValues = (values: PlannedRoadmapProjectInput): ProjectInfoValues => Object.fromEntries(
    Object.entries(INFO_KEYS).map(([formKey, infoKey]) => [infoKey, values[formKey as keyof typeof INFO_KEYS] ?? '']),
  )
  const infoValues = changedManualInfoValues(toInfoValues(input), toInfoValues(toRoadmapSpaceFormProject(project)))
  if (Object.hasOwn(infoValues, 'chipCode')) {
    const chip = chipMappings.find(row => row.chipCode.trim() === input.chipCode.trim())
    if (chip) Object.assign(infoValues, { chipModel: chip.chipModel, chipPlatform: chip.chipPlatform })
  }
  return {
    projectName: project.name,
    projectType: project.type,
    projectSecondaryCategory: input.machineProjectType,
    responsiblePersons: getProjectResponsiblePersons(project),
    healthStatus: project.healthStatus,
    projectStatus: project.status,
    infoValues,
    sourceValues: {},
  }
}
