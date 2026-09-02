#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const fieldFile = path.join(root, 'src/constants/projectBasicFields.ts')
const jiraLibFile = path.join(root, 'src/lib/jiraProject.ts')

const expectedBasicLabels = [
  '项目名称',
  '项目名',
  '主板名',
  '市场名',
  '产品系列',
  '产品类型',
  '安卓版本',
  'tOS版本',
  '首销 tOS 版本',
  '起步RAM',
  'STR5时间',
  '上市时间',
  '研发模式',
  '合作形式',
  '品牌',
  '产品线',
  '市场',
  '项目定级',
  '安卓大版本升级',
  '系统类型',
  '是否为GO',
  '是否二段式',
  '是否为Slim版本',
  '是否外研mini版本',
  '备注',
  '项目描述',
  'Jira项目',
]

const expectedHardwareLabels = [
  '市场项目名',
  '平台',
  '芯片平台',
  '芯片型号',
  '版本类型',
  'Bom',
  '内存',
  '屏幕',
  '屏幕形态',
  '屏幕类型',
  '前摄像头',
  '后摄像头',
  '网络模式',
  'kernel版本',
  '灯效',
  '人脸',
  '音效',
  'SIM卡',
  '马达',
  '指纹',
  '红外',
  '编译选项',
  '编译市场',
]

const expectedBuildOptions = [
  'lj8',
  'lj7',
  'co7_h8110',
  'cl9',
  'cl8',
  'co7',
  'x6886',
  'x6885',
  'x6871_h962',
  'x6853_h895',
  'x6850b',
  'x6850',
  'x6850b_h895',
  'x6850_h895',
]

const expectedBuildMarkets = [
  'tocc',
  'ins2',
  'rwat',
  'n/a',
  'cn',
  'gl',
  'injo',
  'oppj',
  'mxop',
  'pkgp',
  'gldc',
  'bwor',
  'op',
  'in',
  'qttg',
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

function extractLabels(source, exportName) {
  const start = `export const ${exportName} = [`
  const startIndex = source.indexOf(start)
  if (startIndex === -1) fail(`Missing export: ${exportName}`)
  const afterStart = source.slice(startIndex + start.length)
  const endIndex = afterStart.indexOf('] as const')
  if (endIndex === -1) fail(`Missing export terminator: ${exportName}`)
  return [...afterStart.slice(0, endIndex).matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1])
}

function extractMappedStringOptions(source, exportName) {
  const start = `export const ${exportName} = [`
  const startIndex = source.indexOf(start)
  if (startIndex === -1) fail(`Missing export: ${exportName}`)
  const afterStart = source.slice(startIndex + start.length)
  const endIndex = afterStart.indexOf('].map')
  if (endIndex === -1) fail(`Missing mapped export terminator: ${exportName}`)
  return [...afterStart.slice(0, endIndex).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function assertSameLabels(actual, expected, name) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  if (actualText !== expectedText) {
    fail(`${name} labels mismatch\nexpected: ${expected.join('、')}\nactual:   ${actual.join('、')}`)
  }
}

if (!fs.existsSync(fieldFile)) fail('Missing src/constants/projectBasicFields.ts')
if (!fs.existsSync(jiraLibFile)) fail('Missing src/lib/jiraProject.ts')

const fieldsSource = fs.readFileSync(fieldFile, 'utf8')
const containerSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const fieldInputSource = readSource(root, 'src/components/project-info/ProjectInfoFieldInput.tsx')
const projectInfoSectionsSource = readSource(root, 'src/components/project-info/ProjectInfoSections.tsx')
const jiraEditorSource = readSource(root, 'src/components/project-info/JiraProjectEditor.tsx')
const jiraLibSource = readSource(root, 'src/lib/jiraProject.ts')
const projectDataSource = readSource(root, 'src/data/projects.ts')

assertSameLabels(extractLabels(fieldsSource, 'WHOLE_MACHINE_BASIC_INFO_FIELDS'), expectedBasicLabels, 'WHOLE_MACHINE_BASIC_INFO_FIELDS')
assertSameLabels(extractLabels(fieldsSource, 'WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS'), expectedHardwareLabels, 'WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS')
assertSameLabels(extractMappedStringOptions(jiraLibSource, 'SPUG_BUILD_OPTION_OPTIONS'), expectedBuildOptions, 'SPUG_BUILD_OPTION_OPTIONS')
assertSameLabels(extractMappedStringOptions(jiraLibSource, 'SPUG_BUILD_MARKET_OPTIONS'), expectedBuildMarkets, 'SPUG_BUILD_MARKET_OPTIONS')

for (const symbol of ['WHOLE_MACHINE_BASIC_INFO_FIELDS']) {
  if (!containerSource.includes(symbol)) fail(`ProjectSpaceContainer.tsx does not use ${symbol}`)
}

if (!jiraEditorSource) fail('Missing shared component: src/components/project-info/JiraProjectEditor.tsx')
assert.match(jiraEditorSource, /JiraProjectEditor/, 'shared JIRA editor must define JiraProjectEditor')
assert.match(fieldInputSource, /JiraProjectEditor/, 'ProjectInfoFieldInput must use JiraProjectEditor')
assert.match(containerSource, /JiraProjectEditor/, 'ProjectSpaceContainer must use JiraProjectEditor')

const jiraHeaders = ['JIRA服务器', 'JIRA库名', '类型', '共库', 'Affect Projects', '操作']
const headerRows = [...jiraEditorSource.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
  .map(match => match[1])
  .filter(row => jiraHeaders.every(header => row.includes(header)))
assert.equal(headerRows.length, 1, 'shared JIRA editor must have one header row containing all six headers')
const headerRow = headerRows[0] || ''
assert.equal((headerRow.match(/<th\b/g) || []).length, jiraHeaders.length, 'JIRA header row must contain exactly six header cells')
const headerPositions = jiraHeaders.map(header => headerRow.indexOf(header))
assert.deepEqual([...headerPositions].sort((a, b) => a - b), headerPositions, 'JIRA header cells must be ordered exactly as specified')
assert.match(projectInfoSectionsSource, /pms-project-info-jira-horizontal/, 'JIRA display must use its dedicated horizontal layout class')

for (const forbiddenMarker of [
  'renderJiraProjectInlineEditor',
  'normalizeJiraProjectRows',
  'updateJiraProjectRows',
  'updateJiraProjectRow',
  'addJiraProjectRow',
  'copyJiraProjectRow',
  'removeJiraProjectRow',
]) {
  if (containerSource.includes(forbiddenMarker)) fail(`ProjectSpaceContainer.tsx should not contain duplicated JIRA row helper: ${forbiddenMarker}`)
}

for (const marker of [
  'getJiraRegionLabel',
  'jira.transsion.com',
  'jira-ex.transsion.com:6001',
  "'sw'",
  "'monkey'",
  '软件库',
  'monkey库',
  'formatJiraProjectTag',
  'getJiraProjectUrl',
  'JIRA_AFFECT_PROJECT_OPTIONS',
  'getMarketProjectName',
]) {
  if (!jiraLibSource.includes(marker)) fail(`src/lib/jiraProject.ts missing marker: ${marker}`)
}

for (const marker of [
  'androidMajorUpgrade',
  'systemType',
  'isGo',
  'isTwoStage',
  'isSlimVersion',
  'isOutsourcedMini',
  'projectDescription',
  'jiraProjects',
  'buildOption',
  'buildMarket',
]) {
  if (!projectDataSource.includes(marker)) fail(`src/data/projects.ts missing mock field: ${marker}`)
}

console.log('Whole-machine project field configuration is correct.')
