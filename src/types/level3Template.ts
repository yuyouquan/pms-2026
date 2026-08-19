import type { Level3Activity, Level3Milestone } from '@/types/level3Plan'

export interface Level3TemplateActivity {
  id: string
  parentId: string | null
  order: number
  activityName: string
  milestoneId: string
  milestoneName: string
  source: 'template' | 'custom'
}

export interface NumberedLevel3TemplateActivity extends Level3TemplateActivity {
  number: string
  depth: 0 | 1
}

export interface Level3TemplateMaterializeContext {
  actor: string
  initializedAt: string
  projectMilestones: Level3Milestone[]
}

export interface Level3TemplateInitializationResult {
  initialized: boolean
  activities: Level3Activity[]
  reason?: string
}

export interface Level1TemplateTaskLike {
  id?: unknown
  stableId?: unknown
  parentId?: unknown
  taskName?: unknown
  order?: unknown
}
