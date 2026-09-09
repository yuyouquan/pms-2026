#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'
const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/hrVersionRules.ts')
let checks = 0
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++ }
const versions = [
  { id: 'a2', budgetType: 'annual', minorVersion: 2, createdAt: '2026-09-01T01:00:00Z', departmentInvestments: [{ id: 'd1', primaryDepartment: '研发部', secondaryDepartment: '软件部', conceptPhase: 12 }] },
  { id: 'b1', budgetType: 'projectBudget', minorVersion: 1, createdAt: '2026-09-01T03:00:00Z', departmentInvestments: [{ id: 'd2', primaryDepartment: '研发部', secondaryDepartment: '硬件部', conceptPhase: 36 }] },
  { id: 'a1', budgetType: 'annual', minorVersion: 1, createdAt: '2026-09-01T02:00:00Z', departmentInvestments: [] },
]
eq(rules.getHrVersionSeed(versions, 'annual')?.id, 'a2', 'same budget selects latest version number before cross-budget dates')
eq(rules.getHrVersionSeed(versions, 'projectEstimate')?.id, 'b1', 'missing budget seeds newest created version across budgets')
eq(rules.getHrVersionSeed([], 'annual'), undefined, 'new project has no seed')
eq(rules.nextHrMinorVersion(versions, 'projectEstimate'), 1, 'cross-budget seed still creates V0.1')
eq(rules.nextHrMinorVersion(versions, 'annual'), 3, 'same-budget seed creates next number')
const project = { ipmProjectCode: 'FORMAL', versions }
const changes = { milestones: { conceptStart: '2031-01-01' }, projectStartTime: '2031-01-01', projectLevel: 'A', levelCoefficient: 1.25 }
eq(rules.allowedHrVersionUpdates(project, versions[0], changes), changes, 'bound annual latest allows manual dates and level')
eq(rules.allowedHrVersionUpdates(project, versions[1], changes), { levelCoefficient: 1.25 }, 'bound nonannual remains linked')
eq(rules.allowedHrVersionUpdates(project, versions[2], changes), {}, 'historical annual remains read only')
eq(rules.allowedHrVersionUpdates({ ...project, ipmProjectCode: null }, versions[1], changes), changes, 'unbound latest remains editable')
const config = loadTypeScriptModule(root, 'src/constants/hrConfig.ts')
const records = [
  { id: 'old', projectLevel: 'S', modelVersion: 'DISABLED', enabled: false },
  { id: 'new', projectLevel: 'A', modelVersion: 'ACTIVE', enabled: true },
]
eq(config.getAvailableHrModelSelection(records, { projectLevel: 'S', hrModelVersion: 'DISABLED' }), { projectLevel: 'A', hrModelVersion: 'ACTIVE' }, 'disabled seed falls back to an available level and model pair')
eq(config.getAvailableHrModelSelection(records, { projectLevel: 'A', hrModelVersion: 'DELETED' }), { projectLevel: 'A', hrModelVersion: 'ACTIVE' }, 'deleted seed uses an enabled model for the retained level')
eq(config.getAvailableHrModelSelection(records, { projectLevel: 'A', hrModelVersion: 'ACTIVE' }), { projectLevel: 'A', hrModelVersion: 'ACTIVE' }, 'enabled seed remains selected')
eq(config.getAvailableHrModelSelection([], { projectLevel: 'A', hrModelVersion: 'ACTIVE' }), { projectLevel: '', hrModelVersion: '' }, 'no enabled models requires a new selection')
eq(config.isHrModelAvailable(records, 'S', 'DISABLED'), false, 'disabled model cannot be submitted')
eq(config.isHrModelAvailable(records, 'S', 'ACTIVE'), false, 'model must contain the selected project level')
eq(config.isHrModelAvailable(records, 'A', 'ACTIVE'), true, 'available pair can be submitted even with zero phase values')
console.log(`HR version refinement: ${checks} assertions passed`)
