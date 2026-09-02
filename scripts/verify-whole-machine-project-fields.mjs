#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
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
const getJsxTagName = (node, ast) => {
  const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName
  return tagName.getText(ast)
}
const hasJiraEditorJsx = source => {
  const ast = ts.createSourceFile('consumer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found = false
  const visit = node => {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && getJsxTagName(node, ast) === 'JiraProjectEditor') found = true
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}
const importsJiraEditor = source => {
  const ast = ts.createSourceFile('consumer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return ast.statements.some(statement => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@/components/project-info/JiraProjectEditor') return false
    const clause = statement.importClause
    if (!clause) return false
    if (clause.name?.text === 'JiraProjectEditor') return true
    return !!clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some(element => (element.propertyName || element.name).text === 'JiraProjectEditor' && element.name.text === 'JiraProjectEditor')
  })
}
assert.ok(importsJiraEditor(fieldInputSource), 'ProjectInfoFieldInput must import JiraProjectEditor from the shared component')
assert.ok(importsJiraEditor(containerSource), 'ProjectSpaceContainer must import JiraProjectEditor from the shared component')
assert.ok(hasJiraEditorJsx(fieldInputSource), 'ProjectInfoFieldInput must render JiraProjectEditor')
assert.ok(hasJiraEditorJsx(containerSource), 'ProjectSpaceContainer must render JiraProjectEditor')

const jiraHeaders = ['JIRA服务器', 'JIRA库名', '类型', '共库', 'Affect Projects', '操作']
const expectedColumnKeys = ['server', 'projectKey', 'type', 'shared', 'affectProjects', 'actions']
const editorAst = ts.createSourceFile('JiraProjectEditor.tsx', jiraEditorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let columnEntries = []
const isExported = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
const unwrapExpression = expression => {
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression))) expression = expression.expression
  return expression
}
const visitEditorAst = node => {
  if (ts.isVariableStatement(node) && isExported(node)) {
    const declaration = node.declarationList.declarations.find(item => item.name.getText(editorAst) === 'JIRA_PROJECT_EDITOR_COLUMNS')
    const initializer = declaration && unwrapExpression(declaration.initializer)
    if (initializer && ts.isArrayLiteralExpression(initializer)) columnEntries = initializer.elements.map(element => {
      if (!ts.isObjectLiteralExpression(element)) return null
      const readString = propertyName => {
        const property = element.properties.find(item => item.name?.getText(editorAst) === propertyName)
        return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer) ? property.initializer.text : null
      }
      return { key: readString('key'), label: readString('label') }
    })
  }
  ts.forEachChild(node, visitEditorAst)
}
visitEditorAst(editorAst)
assert.equal(columnEntries.length, jiraHeaders.length, 'shared JIRA editor must export one six-entry JIRA project column definition')
assert.deepEqual(columnEntries.map(entry => entry?.key), expectedColumnKeys, 'JIRA column definition must contain exactly six keys in order')
assert.deepEqual(columnEntries.map(entry => entry?.label), jiraHeaders, 'JIRA column definition must contain exactly six labels in order')
let mapsColumns = false
const componentBodies = []
const visitComponentAst = node => {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'JiraProjectEditor' && isExported(node) && node.body) componentBodies.push(node.body)
  if (ts.isVariableStatement(node) && isExported(node)) {
    const declaration = node.declarationList.declarations.find(item => item.name.getText(editorAst) === 'JiraProjectEditor')
    const initializer = declaration && unwrapExpression(declaration.initializer)
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) && initializer.body) componentBodies.push(initializer.body)
  }
  ts.forEachChild(node, visitComponentAst)
}
visitComponentAst(editorAst)
assert.ok(componentBodies.length > 0, 'shared JIRA editor must export JiraProjectEditor')
const visitMapAst = node => {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map' && node.expression.expression.getText(editorAst) === 'JIRA_PROJECT_EDITOR_COLUMNS') mapsColumns = true
  ts.forEachChild(node, visitMapAst)
}
componentBodies.forEach(body => visitMapAst(body))
assert.ok(mapsColumns, 'JIRA editor must render from the authoritative column definition')
assert.match(projectInfoSectionsSource, /pms-project-info-jira-horizontal/, 'JIRA display must use its dedicated horizontal layout class')

for (const forbiddenMarker of [
  'renderJiraProjectInlineEditor',
  'updateJiraProjectRows',
  'updateJiraProjectRow',
  'addJiraProjectRow',
  'copyJiraProjectRow',
  'removeJiraProjectRow',
]) {
  if (containerSource.includes(forbiddenMarker)) fail(`ProjectSpaceContainer.tsx should not contain duplicated JIRA row helper: ${forbiddenMarker}`)
}
assert.doesNotMatch(containerSource, /(?:function\s+normalizeJiraProjectRows\s*\(|(?:const|let)\s+normalizeJiraProjectRows\s*=)/, 'ProjectSpaceContainer.tsx must not declare a duplicate JIRA normalizer')

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
