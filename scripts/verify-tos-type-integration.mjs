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
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveTosLevel1Type'],
  ['src/containers/ProjectSpaceContainer.tsx', 'scopedTosPlanType'],
  ['src/containers/ProjectSpaceContainer.tsx', 'currentTosTypeIsFollow'],
  ['src/containers/ProjectSpaceContainer.tsx', 'getTosTypeSummaryGroups'],
  ['src/containers/ProjectSpaceContainer.tsx', "visibleGroupKeys={isTosVersionProject ? ['team'] : undefined}"],
  ['src/containers/ProjectSpaceContainer.tsx', 'afterCore='],
  ['src/containers/ProjectSpaceContainer.tsx', 'summaryTosTypeGroups'],
  ['src/containers/ProjectSpaceContainer.tsx', "&& scopedPlanLevel === 'level1'\n    && isTosTypeLevel1ReadOnly"],
  ['src/containers/ProjectSpaceContainer.tsx', 'isFollowReadOnlyOverview'],
  ['src/containers/ProjectSpaceContainer.tsx', 'followedTosLevel1ReadOnly && (!isLevel2Custom || isFollowReadOnlyOverview)'],
  ['src/containers/ProjectSpaceContainer.tsx', 'readOnly={!isEditMode || followedTosLevel1ReadOnly || isFollowReadOnlyOverview}'],
  ['src/containers/ProjectSpaceContainer.tsx', 'canMaintainCurrentPlan'],
  ['src/containers/ProjectSpaceContainer.tsx', '当前类型跟随'],
  ['src/containers/ProjectSpaceContainer.tsx', '请切换到'],
  ['src/containers/ProjectSpaceContainer.tsx', 'isTosTypeLevel1ReadOnly'],
  ['src/containers/ProjectSpaceContainer.tsx', 'currentTosTypeData'],
  ['src/containers/ProjectSpaceContainer.tsx', 'getTosTypeVersions'],
  ['src/containers/ProjectSpaceContainer.tsx', 'getTosTypeSnapshotKey'],
  ['src/containers/ProjectSpaceContainer.tsx', 'TOS_VERSION_TRAIN_SNAPSHOT_LEVEL'],
  ['src/containers/ProjectSpaceContainer.tsx', 'versionTrainRecordsForCurrentVersion'],
  ['src/containers/ProjectSpaceContainer.tsx', 'canEditCurrentPlan'],
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveLevel2PlanTasks'],
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveCreatedLevel2Plans'],
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveLevel2PlanMeta'],
  ['src/containers/ProjectSpaceContainer.tsx', 'showTosTypeEditor'],
  ['src/containers/ProjectSpaceContainer.tsx', 'saveTosTypeConfig'],
  ['src/containers/ProjectSpaceContainer.tsx', 'TOS_TYPE_OPTIONS'],
  ['src/containers/ProjectSpaceContainer.tsx', '类型编辑'],
  ['src/containers/ProjectSpaceContainer.tsx', '是否主类型'],
  ['src/containers/ProjectSpaceContainer.tsx', '跟随主类型计划'],
  ['src/containers/ProjectSpaceContainer.tsx', 'checked={!record.isMain && record.followsMain}'],
  ['src/containers/ProjectSpaceContainer.tsx', 'normalizeTosTypeRows(nextRows, previousMainType)'],
  ['src/containers/ProjectSpaceContainer.tsx', 'normalizeTosTypeRows(filtered, previousMainType)'],
  ['src/containers/AppShell.tsx', 'setSelectedTosTypeTab'],
  ['src/containers/WorkspaceContainer.tsx', 'setSelectedTosTypeTab'],
  ['src/data/projects.ts', 'versionTypes:'],
  ['src/lib/tosTypeRules.ts', 'versionTrainRecords'],
  ['src/components/plans/VersionTrainPlan.tsx', 'onDataChange'],
  ['src/components/workspace/AddProjectModal.tsx', "versionTypes: projectType === PROJECT_TYPE_TOS_VERSION ? ['Full']"],
  ['screenshots/smoke-tos-type-plan.mjs', 'tOS type plan smoke passed.'],
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
