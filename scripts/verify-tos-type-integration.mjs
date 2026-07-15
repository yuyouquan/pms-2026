import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const required = [
  ['src/stores/project.ts', 'selectedTosTypeTab'],
  ['src/stores/project.ts', 'tosTypeConfigsByProjectId'],
  ['src/stores/project.ts', 'setTosTypeConfigForProject'],
  ['src/stores/plan.ts', 'tosTypePlanDataByProjectId'],
  ['src/stores/plan.ts', 'tosTypeVersionsByKey'],
  ['src/stores/plan.ts', 'tosTypeCurrentVersionByKey'],
  ['src/types/index.ts', 'versionTypes?'],
  ['src/types/app.ts', 'versionTypes'],
  ['src/containers/ProjectSpaceContainer.tsx', 'isTosTypeScoped'],
  ['src/containers/ProjectSpaceContainer.tsx', 'currentTosTypeData'],
  ['src/containers/ProjectSpaceContainer.tsx', 'getTosTypeVersions'],
  ['src/containers/ProjectSpaceContainer.tsx', 'getTosTypeSnapshotKey'],
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveLevel2PlanTasks'],
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveCreatedLevel2Plans'],
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveLevel2PlanMeta'],
  ['src/containers/ProjectSpaceContainer.tsx', 'showTosTypeEditor'],
  ['src/containers/ProjectSpaceContainer.tsx', 'saveTosTypeConfig'],
  ['src/containers/ProjectSpaceContainer.tsx', 'TOS_TYPE_OPTIONS'],
  ['src/containers/ProjectSpaceContainer.tsx', '类型编辑'],
  ['src/containers/ProjectSpaceContainer.tsx', '是否主类型'],
  ['src/containers/AppShell.tsx', 'setSelectedTosTypeTab'],
  ['src/containers/WorkspaceContainer.tsx', 'setSelectedTosTypeTab'],
  ['src/data/projects.ts', 'versionTypes:'],
]

const failures = required.flatMap(([file, token]) => (
  read(file).includes(token) ? [] : [`${file} is missing ${token}`]
))

if (failures.length > 0) {
  console.error('tOS type integration verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('tOS type integration verification passed.')
