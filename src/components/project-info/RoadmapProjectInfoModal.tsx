'use client'

import { useMemo } from 'react'
import { useEnumStore } from '@/stores/enums'
import PlannedProjectModal from '@/components/roadmap/PlannedProjectModal'
import { buildRoadmapSpaceEditPayload, toRoadmapSpaceFormProject } from '@/lib/roadmapSpaceEditor'
import type { ProjectInfoSubmitPayload } from '@/components/project-info/ProjectInfoModal'
import type { ProjectItem } from '@/types/app'

export default function RoadmapProjectInfoModal({ open, project, currentUser, canEdit, onCancel, onSubmit }: {
  open: boolean
  project: ProjectItem
  currentUser: string
  canEdit: boolean
  onCancel: () => void
  onSubmit: (payload: ProjectInfoSubmitPayload) => Promise<boolean | void>
}) {
  const editingProject = useMemo(() => toRoadmapSpaceFormProject(project), [project])
  return (
    <PlannedProjectModal
      open={open}
      editingProject={editingProject}
      projectSpace
      allRows={[]}
      tosVersions={[]}
      currentUser={currentUser}
      canEdit={canEdit}
      onCancel={onCancel}
      onSaveProject={async input => (await onSubmit(buildRoadmapSpaceEditPayload(project, input, useEnumStore.getState().rowsByType['chip-mapping']))) === true}
    />
  )
}
