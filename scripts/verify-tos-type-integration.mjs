import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => {
  const absolutePath = path.join(root, relativePath)
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
}

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
  ['src/containers/ProjectSpaceContainer.tsx', '(followedTosLevel1ReadOnly || !hasDraftVersion)'],
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
  ['src/containers/ProjectSpaceContainer.tsx', '<TosTypeEditorModal'],
  ['src/containers/ProjectSpaceContainer.tsx', 'rows={tosTypeDraftRows}'],
  ['src/containers/ProjectSpaceContainer.tsx', 'canEdit={canEditBasicInfo}'],
  ['src/containers/ProjectSpaceContainer.tsx', 'onChange={setTosTypeDraftRows}'],
  ['src/containers/ProjectSpaceContainer.tsx', 'onSave={saveTosTypeConfig}'],
  ['src/containers/ProjectSpaceContainer.tsx', 'onCancel={() => setShowTosTypeEditor(false)}'],
  ['src/components/project-info/TosTypeEditorModal.tsx', "import DimensionMatrixEditor from '@/components/project-info/DimensionMatrixEditor'"],
  ['src/components/project-info/TosTypeEditorModal.tsx', '<DimensionMatrixEditor'],
  ['src/components/project-info/TosTypeEditorModal.tsx', "{ key: 'isMain', label: '主类型' },\n  { key: 'followsMain', label: '跟随主类型' }"],
  ['src/components/project-info/TosTypeEditorModal.tsx', 'targetRow?.isMain'],
  ['src/components/project-info/TosTypeEditorModal.tsx', '请先指定其他主类型后再删除'],
  ['src/components/project-info/TosTypeEditorModal.tsx', 'normalizeTosTypeRows(nextRows, previousMainType)'],
  ['src/components/project-info/TosTypeEditorModal.tsx', 'TOS_TYPE_OPTIONS.filter(type => !rows.some(row => row.type === type))'],
  ['src/components/project-info/TosTypeEditorModal.tsx', '<Radio'],
  ['src/components/project-info/TosTypeEditorModal.tsx', "case 'isMain':"],
  ['src/components/project-info/TosTypeEditorModal.tsx', '<Checkbox'],
  ['src/components/project-info/TosTypeEditorModal.tsx', "case 'followsMain':"],
  ['src/components/project-info/TosTypeEditorModal.tsx', 'checked={!row.isMain && row.followsMain}'],
  ['src/components/project-info/TosTypeEditorModal.tsx', 'disabled={row.isMain}'],
  ['src/components/project-info/TosTypeEditorModal.tsx', '跟随主类型计划'],
  ['src/components/project-info/TosTypeEditorModal.tsx', 'saveDisabled={!canEdit || rows.length === 0}'],
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

const removedInlineContainerTokens = [
  'updateTosTypeDraftRow',
  'addTosTypeDraftRow',
  'removeTosTypeDraftRow',
  'checked={!record.isMain && record.followsMain}',
]

removedInlineContainerTokens.forEach(token => {
  if (read('src/containers/ProjectSpaceContainer.tsx').includes(token)) {
    failures.push(`src/containers/ProjectSpaceContainer.tsx still contains inline tOS editor token ${token}`)
  }
})

if (failures.length > 0) {
  console.error('tOS type integration verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('tOS type integration verification passed.')
