import { create } from 'zustand'
import { initialProjects } from '@/data/projects'
import { MOCK_IPM_TEAMS_BY_BID, MOCK_LEGACY_IPM_TEAMS_BY_PROJECT_ID } from '@/mock/projectTeam'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import type { ProjectTeamProjectRef, ProjectTeamSnapshot } from '@/types/projectTeam'

interface ProjectTeamState {
  teamsByProjectId: Record<string, ProjectTeamSnapshot>
  scopeByProjectId: Record<string, string>
  projects: readonly ProjectTeamProjectRef[]
  syncProjects: (projects: readonly ProjectTeamProjectRef[]) => void
  refreshMock: () => void
}

function buildSnapshot(projects: readonly ProjectTeamProjectRef[]) {
  const ids = new Set(projects.map(project => project.id))
  const rootsById = new Map(projects.map(project => [project.id, project]))
  const refs = [...projects, ...useTechnicalProjectStore.getState().subprojects.filter(child => ids.has(child.parentProjectId))]
  const teamsByProjectId: Record<string, ProjectTeamSnapshot> = {}
  const scopeByProjectId: Record<string, string> = {}
  for (const project of refs) {
    const scope = project.parentProjectId && ids.has(project.parentProjectId) ? project.parentProjectId : project.id
    scopeByProjectId[project.id] = scope
    const root = rootsById.get(scope)
    const source = root && (!root.projectAttribute || root.projectAttribute === 'formal')
      ? root.sourceBid && root.nameInferredSourceBid !== root.sourceBid
        ? MOCK_IPM_TEAMS_BY_BID[root.sourceBid]
        : root.mockTeamSourceId === `legacy:${scope}`
          ? MOCK_LEGACY_IPM_TEAMS_BY_PROJECT_ID[scope]
          : undefined
      : undefined
    if (source) teamsByProjectId[project.id] = { ...source, projectId: project.id, members: source.members.map(member => ({ ...member, roles: [...member.roles] })) }
  }
  return { teamsByProjectId, scopeByProjectId }
}

function preserveSourceRemoval(previous: readonly ProjectTeamProjectRef[], incoming: readonly ProjectTeamProjectRef[]) {
  const before = new Map(previous.map(project => [project.id, project]))
  return incoming.map(project => {
    const earlier = before.get(project.id)
    if (!earlier) return project
    if ((earlier.sourceBid || '') !== (project.sourceBid || '') || earlier.mockTeamSourceId === null) {
      return { ...project, mockTeamSourceId: null }
    }
    return project
  })
}

export const useProjectTeamStore = create<ProjectTeamState>((set, get) => ({
  projects: initialProjects,
  ...buildSnapshot(initialProjects),
  syncProjects: projects => set(state => {
    const next = preserveSourceRemoval(state.projects, projects)
    return { projects: next, ...buildSnapshot(next) }
  }),
  refreshMock: () => set(buildSnapshot(get().projects)),
}))

useTechnicalProjectStore.subscribe((state, previous) => {
  if (state.subprojects !== previous.subprojects) useProjectTeamStore.getState().refreshMock()
})
