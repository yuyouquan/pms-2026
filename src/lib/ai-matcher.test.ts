import { describe, it, expect } from 'vitest'
import { matchScenario, normalize, extractProjectName } from './ai-matcher'
import type { ScenarioConfig } from '@/types/ai'

// Fixture: minimal scenario configs for testing
const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'project-basic-info', name: '基本信息',
    keywords: [['基本情况'], ['信息'], ['详情'], ['负责人']],
    requiresProject: true, priority: 5,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'project-plans', name: '计划',
    keywords: [['计划'], ['任务'], ['排期']],
    requiresProject: true, priority: 5,
    modifiers: {
      ownership: ['我', '我的', '我负责', '自己'],
      planType: ['版本', '需求', '开发', '测试'],
    },
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'requirement-status', name: '需求状态',
    keywords: [['需求', '进展'], ['需求', '状态']],
    requiresProject: true, priority: 5,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'transfer-status', name: '转维',
    keywords: [['转维']],
    requiresProject: true, priority: 5,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'fallback', name: '兜底',
    keywords: [], requiresProject: false, priority: 0,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
]

const PROJECTS = [
  { id: '1', name: 'MR V2.3' },
  { id: '2', name: 'DS V1.0' },
  { id: '3', name: 'X6877-D8400_H991' },
]

describe('normalize', () => {
  it('converts uppercase English to lowercase', () => {
    expect(normalize('Hello WORLD')).toContain('hello world')
  })
  it('trims spaces', () => {
    expect(normalize('  foo  bar  ')).toBe('foo bar')
  })
})

describe('extractProjectName', () => {
  it('finds project name by exact match', () => {
    expect(extractProjectName('查询 MR V2.3 的信息', PROJECTS)).toBe('MR V2.3')
  })
  it('finds project name with whitespace variations (fuzzy)', () => {
    expect(extractProjectName('MR2.3 进度', PROJECTS)).toBe('MR V2.3')
  })
  it('prefers longest match when names overlap', () => {
    expect(extractProjectName('X6877-D8400_H991 状态', PROJECTS)).toBe('X6877-D8400_H991')
  })
  it('returns null when no project name present', () => {
    expect(extractProjectName('今天天气不错', PROJECTS)).toBeNull()
  })
})

describe('matchScenario', () => {
  const ctx = { projects: PROJECTS, currentProject: null, scenarios: SCENARIOS }

  it('matches project-basic-info by keyword + project name', () => {
    const r = matchScenario('MR V2.3 的基本情况', ctx)
    expect(r.scenarioId).toBe('project-basic-info')
    expect(r.variables.projectName).toBe('MR V2.3')
  })

  it('matches project-plans with ownership modifier', () => {
    const r = matchScenario('我在 MR V2.3 负责的计划', ctx)
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.ownership).toBe('mine')
  })

  it('matches project-plans with planType modifier', () => {
    const r = matchScenario('MR V2.3 的版本计划', ctx)
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.planType).toBe('版本')
  })

  it('defaults ownership to all when no "我" modifier', () => {
    const r = matchScenario('MR V2.3 的所有计划', ctx)
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.ownership).toBe('all')
  })

  it('matches requirement-status with AND-grouped keywords', () => {
    const r = matchScenario('MR V2.3 需求状态如何', ctx)
    expect(r.scenarioId).toBe('requirement-status')
  })

  it('matches transfer-status', () => {
    const r = matchScenario('MR V2.3 转维到哪一步了', ctx)
    expect(r.scenarioId).toBe('transfer-status')
  })

  it('falls back to current project context when no name in input', () => {
    const r = matchScenario('计划怎么样', { ...ctx, currentProject: 'DS V1.0' })
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.projectName).toBe('DS V1.0')
  })

  it('returns fallback when no scenario matches', () => {
    const r = matchScenario('今天天气怎么样', ctx)
    expect(r.scenarioId).toBe('fallback')
  })

  it('returns fallback when scenario matches but no project identified', () => {
    const r = matchScenario('基本情况是什么', ctx)
    expect(r.scenarioId).toBe('fallback')
  })
})
