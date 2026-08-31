import {
  PROJECT_TYPE_TOS_VERSION,
  isMachineProjectType,
} from '@/constants/projectTypes'

export function shouldShowLatestPublishedLevel1Summary(projectType: string): boolean {
  return !isMachineProjectType(projectType) && projectType !== PROJECT_TYPE_TOS_VERSION
}
