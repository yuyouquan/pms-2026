'use client'

import TechnicalProjectInformationView from '@/components/technical-project/TechnicalProjectInformationView'
import type { ProjectItem } from '@/types/app'

type ProjectRole = { name: string; members: string[]; isFixed?: boolean }

/**
 * Compatibility adapter for callers outside the project-space container.
 * Information ownership lives in TechnicalProjectInformationView.
 */
export interface TechnicalProjectOverviewProps {
  project: ProjectItem
  stage: string
  customRoles?: readonly ProjectRole[]
  preProjectName?: string
  onEdit?: () => void
  canEdit?: boolean
}

export default function TechnicalProjectOverview(props: TechnicalProjectOverviewProps) {
  return <TechnicalProjectInformationView {...props} />
}
