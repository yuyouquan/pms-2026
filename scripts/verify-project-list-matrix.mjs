#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => {
  const file = path.join(root, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}
const requireContract = (file, pattern, message) => assert.match(read(file), pattern, message)
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matrix = 'src/lib/projectListMatrix.ts'
const variants = {
  machine: ['产品系列', '项目名称', '品牌', '芯片编码', '版本类型', '首销tOS版本', '项目状态', 'SPM', 'SPM部门'],
  tos: ['tOS版本', '版本类型', '项目状态', 'SPM'],
  'technical-tdt': ['TDT项目名称', '技术赛道', 'TMG及技术领域', '子领域', '技术项目负责人', '技术项目经理', '项目阶段'],
  'technical-subproject': ['子任务名称', '所属TDT项目名称', '核心价值', '开发模式', '首导tOS', '首导整机产品', '项目阶段', '第1版转测', '第2版转测', '第X版转测', 'TDR3'],
}

for (const [variant, labels] of Object.entries(variants)) {
  requireContract(matrix, new RegExp(`['"]${escape(variant)}['"]`), `Matrix must define the ${variant} variant.`)
  for (const label of labels) {
    requireContract(matrix, new RegExp(`label\\s*:\\s*['"]${escape(label)}['"][\\s\\S]{0,180}?required\\s*:\\s*true[\\s\\S]{0,180}?hideable\\s*:\\s*false[\\s\\S]{0,180}?sortable\\s*:\\s*true`), `${variant} must always show ${label}, while allowing column reordering.`)
  }
}

requireContract(matrix, /machine[\s\S]*?latestPublishedMachineLevel1Milestones/, 'Machine lists must append milestones from the latest published whole-machine L1 template.')
requireContract(matrix, /tos[\s\S]*?latestPublishedTosLevel1Milestones/, 'tOS lists must append milestones from the latest published tOS L1 template.')
requireContract(matrix, /technical-tdt[\s\S]*?tdtTemplateStages[\s\S]*?directLevel2Nodes/, 'TDT lists must expose template stages and direct level-two nodes.')

console.log('project list matrix contract passed')
