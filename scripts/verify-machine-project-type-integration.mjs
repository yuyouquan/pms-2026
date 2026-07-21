import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const read = file => readFileSync(file, 'utf8')
const required = [
  ['src/app/page.tsx', 'isMachineProjectType(project.type)'],
  ['src/app/config/level1-template/page.tsx', 'PROJECT_TEMPLATE_TYPES'],
  ['src/app/config/level2-template/page.tsx', 'PROJECT_TEMPLATE_TYPES'],
  ['src/components/project-info/TargetProjectInformationView.tsx', 'isMachineProjectType'],
  ['src/components/project-info/ProjectInfoModal.tsx', 'isMachineProjectType(item.type)'],
  ['src/lib/projectInfoRules.ts', 'isMachineProjectType(project.type)'],
  ['src/lib/projectInfoValues.ts', 'isMachineProjectType'],
  ['src/containers/ProjectSpaceContainer.tsx', 'isMachineProjectType(selectedProject?.type)'],
  ['src/stores/project.ts', 'isMachineProjectType(project.type)'],
  ['src/app/share/plan/page.tsx', 'isMachineProjectType(project?.type)'],
  ['src/components/plan/PlanModule.tsx', 'isMachineProjectType(selectedProject?.type)'],
  ['src/components/workspace/WorkspaceModule.tsx', 'matchesProjectTypeColumn(p.type, col.key)'],
  ['src/containers/WorkspaceContainer.tsx', 'PROJECT_TYPE_MACHINE_LAPTOP'],
  ['src/components/roadmap/utils.ts', 'isMachineProjectType'],
  ['src/components/roadmap/MilestoneView.tsx', 'isMachineProjectType'],
  ['src/components/roadmap/ProjectPlanSummaryBoard.tsx', 'isMachineProjectType'],
  ['src/components/roadmap/MRTrainView.tsx', 'isMachineProjectType'],
  ['src/stores/plan.ts', 'PROJECT_TEMPLATE_TYPES'],
  ['src/stores/plan.ts', 'getProjectTypeFamilyKey'],
  ['src/containers/ConfigContainer.tsx', 'PROJECT_TEMPLATE_TYPES'],
  ['src/containers/ProjectSpaceContainer.tsx', 'getProjectTypeFamilyKey(selectedProject?.type || selectedPlanType)'],
]

for (const [file, token] of required) {
  assert.equal(read(file).includes(token), true, `${file} must use ${token}`)
}

const projectTypesFilename = 'src/constants/projectTypes.ts'
const projectTypesOutput = ts.transpileModule(read(projectTypesFilename), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const projectTypesModule = { exports: {} }
vm.runInNewContext(
  projectTypesOutput,
  { module: projectTypesModule, exports: projectTypesModule.exports },
  { filename: projectTypesFilename },
)
const {
  LEGACY_PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_MACHINE_LAPTOP,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_PHONE,
  matchesProjectTypeColumn,
} = projectTypesModule.exports

assert.equal(typeof matchesProjectTypeColumn, 'function', 'workspace project-type matching helper must be exported')
assert.equal(matchesProjectTypeColumn(LEGACY_PROJECT_TYPE_MACHINE, PROJECT_TYPE_MACHINE_PHONE), true)
assert.equal(matchesProjectTypeColumn(PROJECT_TYPE_MACHINE_PHONE, PROJECT_TYPE_MACHINE_PHONE), true)
assert.equal(matchesProjectTypeColumn(PROJECT_TYPE_MACHINE_PAD, PROJECT_TYPE_MACHINE_PAD), true)
assert.equal(matchesProjectTypeColumn(PROJECT_TYPE_MACHINE_LAPTOP, PROJECT_TYPE_MACHINE_LAPTOP), true)
assert.equal(matchesProjectTypeColumn(PROJECT_TYPE_MACHINE_PAD, PROJECT_TYPE_MACHINE_PHONE), false)
assert.equal(matchesProjectTypeColumn('tOS版本项目', PROJECT_TYPE_MACHINE_PHONE), false)

const directComparisonFiles = [
  'src/app/page.tsx',
  'src/app/share/plan/page.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/project-info/ProjectInfoModal.tsx',
  'src/components/project-info/TargetProjectInformationView.tsx',
  'src/components/workspace/WorkspaceModule.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
  'src/containers/WorkspaceContainer.tsx',
  'src/stores/project.ts',
]

const directComparisonPattern = /(?:===|!==)\s*['"]整机产品项目['"]|['"]整机产品项目['"]\s*(?:===|!==)/

for (const file of directComparisonFiles) {
  assert.doesNotMatch(
    read(file),
    directComparisonPattern,
    `${file} must not branch on the legacy machine string`,
  )
}

const sourceFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name)
  if (entry.isDirectory()) return sourceFiles(path)
  return /\.tsx?$/.test(entry.name) ? [path] : []
})

for (const file of sourceFiles('src')) {
  assert.doesNotMatch(
    read(file),
    directComparisonPattern,
    `${file} must not branch on the legacy machine string`,
  )
}

console.log('Machine project type integration verification passed.')
