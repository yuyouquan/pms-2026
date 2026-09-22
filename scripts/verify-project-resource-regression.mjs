/** Full project/resource regression. Browser acceptance is documented separately. */
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const scripts = [
  "verify-budget-cross-tab.mjs",
  "verify-budget-milestone-scheduling.mjs",
  "verify-config-navigation.mjs",
  "verify-hr-config-serialization.mjs",
  "verify-hr-investment-audit.mjs",
  "verify-hr-investment.mjs",
  "verify-hr-model.mjs",
  "verify-hr-project-registry.mjs",
  "verify-hr-resource-regressions.mjs",
  "verify-hr-version-forms.mjs",
  "verify-hr-version-refinement.mjs",
  "verify-machine-stage-split.mjs",
  "verify-mock-data-hygiene.mjs",
  "verify-mock-dataset-storage.mjs",
  "verify-non-labor-import.mjs",
  "verify-non-labor-investment.mjs",
  "verify-non-labor-units.mjs",
  "verify-project-configuration-filters.mjs",
  "verify-project-core-layout.mjs",
  "verify-project-creation-draft.mjs",
  "verify-project-creation-rules.mjs",
  "verify-project-field-order-followup.mjs",
  "verify-project-field-preferences.mjs",
  "verify-project-info-followup-adjustments.mjs",
  "verify-project-info-frame-runtime.mjs",
  "verify-project-info-matrix-refresh.mjs",
  "verify-project-info-modal-jira-save.mjs",
  "verify-project-info-todos.mjs",
  "verify-project-list-fullscreen.mjs",
  "verify-project-list-header-reorder.mjs",
  "verify-project-list-matrix.mjs",
  "verify-project-list-refinement.mjs",
  "verify-project-management-access.mjs",
  "verify-project-management-navigation.mjs",
  "verify-project-management-reaudit.mjs",
  "verify-project-person-choices.mjs",
  "verify-project-registry-final-fixes.mjs",
  "verify-project-registry-transactions.mjs",
  "verify-project-registry.mjs",
  "verify-project-resource-fixtures.mjs",
  "verify-project-responsibility-sync.mjs",
  "verify-project-roadmap.mjs",
  "verify-project-role-sync.mjs",
  "verify-project-space-followup.mjs",
  "verify-project-space-permission-matrix.mjs",
  "verify-project-summary.mjs",
  "verify-project-surfaces-visual-refresh.mjs",
  "verify-project-template-compatibility.mjs",
  "verify-project-view-milestone-mock-rules.mjs",
  "verify-project-view-requirements.mjs",
  "verify-project-view-tos-mock-values.mjs",
  "verify-resource-activation-interactions.mjs",
  "verify-resource-cell-editing.mjs",
  "verify-resource-cross-tab-storage.mjs",
  "verify-resource-dashboard.mjs",
  "verify-resource-dashboard-business.mjs",
  "verify-resource-dataset-refresh.mjs",
  "verify-resource-empty-project-persistence.mjs",
  "verify-resource-expense-followup.mjs",
  "verify-resource-form-followup.mjs",
  "verify-resource-form-snapshots.cjs",
  "verify-resource-formal-domain.mjs",
  "verify-resource-formal-status.mjs",
  "verify-resource-inline-date.mjs",
  "verify-resource-inline-editing.mjs",
  "verify-resource-inline-editor.mjs",
  "verify-resource-inline-import.mjs",
  "verify-resource-inline-refresh.mjs",
  "verify-resource-inline-render.mjs",
  "verify-resource-legacy-startup.mjs",
  "verify-resource-log-dialog.mjs",
  "verify-resource-milestone-ownership.mjs",
  "verify-resource-mixed-version-storage.mjs",
  "verify-resource-model-selection.mjs",
  "verify-resource-monthly-cost.mjs",
  "verify-resource-monthly-presentation.mjs",
  "verify-resource-monthly-reallocation.mjs",
  "verify-resource-permission-defaults.mjs",
  "verify-resource-permission-ui.mjs",
  "verify-resource-permissions.mjs",
  "verify-resource-release-audit.mjs",
  "verify-resource-startup.mjs",
  "verify-resource-total-consumers.mjs",
  "verify-resource-total-editing.mjs",
  "verify-resource-version-lifecycle.mjs",
  "verify-resource-version-modal-save.mjs",
  "verify-resource-version-workspace.mjs",
  "verify-resource-workspace-integration.mjs",
  "verify-roadmap-mock-seeds.mjs",
  "verify-roadmap-registry.mjs",
  "verify-roadmap-space-editor.mjs",
  "verify-roadmap-view-cleared.mjs",
  "verify-technical-project.mjs",
  "verify-technical-resource-followup.mjs",
  "verify-template-interval-ui.mjs",
  "verify-template-intervals.mjs",
  "verify-todo-center.mjs",
  "verify-tos-project-status.mjs",
  "verify-tos-roadmap-fidelity-filter.mjs",
  "verify-tos-roadmap-single-entry.mjs",
  "verify-workbench-project-list.mjs",
  "verify-workbench-split.mjs"
]

const logDirectory = await mkdtemp(path.join(tmpdir(), 'pms-project-resource-regression-'))
const results = []
let next = 0
async function worker() {
  while (next < scripts.length) {
    const name = scripts[next++]
    const result = await new Promise(resolve => {
      let output = ''
      const child = spawn(process.execPath, [path.join('scripts', name)], { stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.on('data', chunk => { output += chunk })
      child.stderr.on('data', chunk => { output += chunk })
      const timeout = setTimeout(() => child.kill('SIGTERM'), 180000)
      child.on('error', error => { output += error.stack })
      child.on('close', (code, signal) => {
        clearTimeout(timeout)
        resolve({ name, code: code ?? 1, signal, output })
      })
    })
    await writeFile(path.join(logDirectory, `${name}.log`), result.output)
    results.push({ name, code: result.code, signal: result.signal })
    console.log(`${result.code === 0 ? 'PASS' : 'FAIL'} ${name}`)
    if (result.code !== 0) console.error(result.output.slice(-3000))
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
results.sort((a, b) => a.name.localeCompare(b.name))
await writeFile(path.join(logDirectory, 'summary.json'), JSON.stringify(results, null, 2))
const failed = results.filter(result => result.code !== 0)
console.log(`${results.length - failed.length}/${results.length} scripts passed; logs: ${logDirectory}`)
process.exitCode = failed.length ? 1 : 0
