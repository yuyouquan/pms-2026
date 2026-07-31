#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const matrix = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/projectListMatrix.ts')
assert.equal(typeof matrix.getProjectListMatrix, 'function', 'missing getProjectListMatrix')
const expected = {
  machine: ['产品系列', '项目名称', '品牌', '芯片编码', '版本类型', '首销tOS版本', '项目状态', 'SPM', 'SPM部门'],
  tos: ['tOS版本', '版本类型', '项目状态', 'SPM'],
  'technical-tdt': ['TDT项目名称', '技术赛道', 'TMG及技术领域', '子领域', '技术项目负责人', '技术项目经理', '项目阶段'],
  'technical-subproject': ['子任务名称', '所属TDT项目名称', '核心价值', '开发模式', '首导tOS', '首导整机产品', '项目阶段', '第1版转测', '第2版转测', '第X版转测', 'TDR3'],
}
for (const [variant, labels] of Object.entries(expected)) {
  const columns = matrix.getProjectListMatrix(variant, { milestones: ['动态节点'] })
  assert.deepEqual(columns.slice(0, labels.length).map(column => column.label), labels, `${variant} labels`)
  columns.slice(0, labels.length).forEach(column => assert.deepEqual(
    { required: column.required, hideable: column.hideable, reorderable: column.reorderable },
    { required: true, hideable: false, reorderable: true },
  ))
}
assert.ok(matrix.getProjectListMatrix('machine', { milestones: ['最新一级模板节点'] }).some(column => column.label === '最新一级模板节点'), 'machine dynamic milestone column')
assert.ok(matrix.getProjectListMatrix('tos', { milestones: ['最新已发布一级模板节点'] }).some(column => column.label === '最新已发布一级模板节点'), 'tOS latest published L1 milestone column')
assert.ok(matrix.getProjectListMatrix('technical-tdt', { templateStages: ['阶段'], directLevel2Nodes: ['直属二级'] }).some(column => column.label === '直属二级'), 'TDT dynamic direct level-two column')
console.log('project list matrix contract passed')
