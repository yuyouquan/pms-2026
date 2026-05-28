import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const fieldFile = path.join(root, 'src/constants/projectBasicFields.ts')
const containerFile = path.join(root, 'src/containers/ProjectSpaceContainer.tsx')

const expectedBasicLabels = [
  '项目名',
  '主板名',
  '市场名',
  '产品类型',
  '安卓版本',
  'tOS版本',
  '研发模式',
  '合作形式',
  '品牌',
  '产品线',
  '市场',
  '项目定级',
]

const expectedHardwareLabels = [
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

function assertSameLabels(actual, expected, name) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  if (actualText !== expectedText) {
    fail(`${name} labels mismatch\nexpected: ${expected.join('、')}\nactual:   ${actual.join('、')}`)
  }
}

if (!fs.existsSync(fieldFile)) fail('Missing src/constants/projectBasicFields.ts')

const fieldsSource = fs.readFileSync(fieldFile, 'utf8')
const containerSource = fs.readFileSync(containerFile, 'utf8')

assertSameLabels(extractLabels(fieldsSource, 'WHOLE_MACHINE_BASIC_INFO_FIELDS'), expectedBasicLabels, 'WHOLE_MACHINE_BASIC_INFO_FIELDS')
assertSameLabels(extractLabels(fieldsSource, 'WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS'), expectedHardwareLabels, 'WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS')

for (const symbol of ['WHOLE_MACHINE_BASIC_INFO_FIELDS', 'WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS']) {
  if (!containerSource.includes(symbol)) fail(`ProjectSpaceContainer.tsx does not use ${symbol}`)
}

console.log('Whole-machine project field configuration is correct.')
