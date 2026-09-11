#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const load = file => loadTypeScriptModule(root, file)
const { initialProjects: projects } = load('src/data/projects.ts')
const external = load('src/data/externalProjectPool.ts')
const permission = load('src/stores/permission.ts')
const directory = load('src/constants/permissions.ts')
const project = load('src/stores/project.ts')
const roadmap = load('src/stores/roadmap.ts').createInitialRoadmapMockState()
const mr = load('src/data/mrVersionPlanMocks.ts').createInitialMrVersionPlanState()
const technical = load('src/stores/technicalProject.ts').INITIAL_TECHNICAL_SUBPROJECTS
const technicalPlans = load('src/stores/technicalPlan.ts').INITIAL_TECHNICAL_PLANS
const transfer = load('src/mock/transfer-maintenance.ts')
const transferState = load('src/stores/transfer.ts').useTransferStore.getState()
const transferRules = load('src/lib/transferWorkflow.ts')
const todos = load('src/lib/todoAggregation.ts')
const projectTypes = load('src/constants/projectTypes.ts')
const sharedSeeds = load('src/components/shared/PlanHelpers.tsx')
const projectById = new Map(projects.map(item => [item.id, item]))
const directoryUsers = new Set(directory.ALL_USERS)
const failures = []
let checks = 0
function check(label, run) {
  checks += 1
  try { run(); console.log(`PASS ${label}`) }
  catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error.message}`) }
}
function unique(items, key, label) {
  assert.ok(items.length > 0, `${label} has visible samples`)
  assert.equal(new Set(items.map(item => item[key])).size, items.length, `${label} has unique ${key}`)
}
function walk(value, visit, location = '') {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    const here = `${location}.${key}`
    visit(key, child, here)
    walk(child, visit, here)
  }
}
const splitPeople = value => Array.isArray(value) ? value.flatMap(splitPeople)
  : typeof value === 'string' ? value.split(/[,，、;；]/).map(item => item.trim()).filter(Boolean) : []
const isDemoPerson = value => /^演示(?:用户|成员|外协)\d{2}$/.test(value)
const systemActors = new Set(['系统', '系统管理员'])
const genericActorPlaceholders = new Set(['当前用户'])
const roleOwners = new Set([...directory.FIXED_ROLES, ...permission.TECHNICAL_FIXED_ROLES, ...permission.TOS_FIXED_ROLES, 'SPM', 'TPM'])
const peopleFields = new Set([
  'leader', 'spm', 'ppm', 'tpm', 'contact', 'responsible', 'responsiblePerson', 'responsiblePersons',
  'teamMembers', 'members', 'assignee', 'applicant', 'entryPerson', 'reviewPerson', 'actor',
  'createdBy', 'updatedBy', 'publishedBy', 'lockedBy', 'operator', 'currentLoginUser',
  ...Object.values(permission.TECHNICAL_TEAM_PERMISSION_MAPPING),
  ...Object.values(permission.TOS_TEAM_PERMISSION_MAPPING),
])
function validPersonField(key, value) {
  return splitPeople(value).every(name => isDemoPerson(name)
    || systemActors.has(name)
    || genericActorPlaceholders.has(name)
    || (key === 'responsible' && roleOwners.has(name)))
}
const isExampleHost = hostname => /^(?:[a-z0-9-]+\.)*example\.(?:com|org|net)$/i.test(hostname)
function safeSampleUrl(value) {
  if (!value || value.startsWith('#') || /^\/(?!\/)/.test(value)) return true
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return ['http:', 'https:'].includes(url.protocol) && isExampleHost(url.hostname)
      && !url.username && !url.password
  } catch { return false }
}
const samples = {
  hrResources: ['Machine', 'Tos', 'Technical', 'Capability'].map(name => load(`src/stores/hr${name}.ts`)[`useHr${name}Store`].getState()),
  projects,
  externalProjects: external.EXTERNAL_PROJECT_POOL.map(item => ({ ...item, details: external.fetchByBid(item.bid) })),
  roadmap, mr, technical, technicalPlans,
  permissions: permission.usePermissionStore.getState(),
  plan: load('src/stores/plan.ts').usePlanStore.getState(),
  transfer: Object.fromEntries(Object.entries(transfer).filter(([key]) => key.startsWith('MOCK_'))),
  transferState,
  notificationDirectory: sharedSeeds.MOCK_USER_MAP,
  sharedTodos: sharedSeeds.initialTodos,
}

check('all sample people use a fictional namespace, including generated records', () => {
  const invalid = []
  walk(samples, (key, value, at) => {
    if (peopleFields.has(key) && !validPersonField(key, value)) invalid.push(at)
  })
  assert.deepEqual(invalid, [], 'person fields outside the demo namespace')
})

check('login, permission, and transfer identities remain linked after renaming', () => {
  unique(directory.ALL_USERS.map(name => ({ name })), 'name', 'login directory')
  assert.ok(directory.ALL_USERS.every(name => /^演示用户\d{2}$/.test(name)))
  assert.ok(directoryUsers.has(project.DEFAULT_LOGIN_USER))
  for (const [projectId, members] of Object.entries(project.INITIAL_PROJECT_MEMBER_MAP)) {
    assert.ok(projectById.has(projectId), `member map references project ${projectId}`)
    assert.ok(members.every(name => directoryUsers.has(name)), `member map ${projectId} resolves all users`)
  }
  const permissions = permission.usePermissionStore.getState()
  for (const [projectId, roles] of Object.entries(permissions.rolesByProject)) {
    assert.ok(projectById.has(projectId), `permission project ${projectId} exists`)
    assert.ok(roles.every(role => role.members.every(name => directoryUsers.has(name))), `permission members for ${projectId} are login users`)
  }
  assert.ok(permissions.globalRoles.every(role => role.members.every(name => directoryUsers.has(name))))
  unique(transfer.MOCK_TM_USERS, 'id', 'transfer directory')
  unique(transfer.MOCK_TM_USERS, 'name', 'transfer directory names')
  for (const user of transfer.MOCK_TM_USERS) {
    assert.ok(isDemoPerson(user.name))
    assert.equal(todos.mapTransferOwnerToPmsUser(user.id, user.name), directoryUsers.has(user.name) ? user.name : undefined)
    const differentUser = directory.ALL_USERS.find(name => name !== user.name)
    assert.equal(todos.mapTransferOwnerToPmsUser(user.id, differentUser), undefined, 'an ID/name mismatch never grants a login identity')
  }
  for (const name of directory.ALL_USERS) {
    assert.equal(todos.mapTransferOwnerToPmsUser(`login-${name}`, name), name)
    assert.ok(sharedSeeds.MOCK_USER_MAP[name], 'login users have a mock notification identity')
  }
  for (const [name, recipient] of Object.entries(sharedSeeds.MOCK_USER_MAP)) {
    assert.ok(isDemoPerson(name))
    assert.equal(recipient.name, name)
    assert.match(recipient.openId, /^ou_mock_demo_/)
    assert.ok(isExampleHost(recipient.email.split('@')[1] || ''), 'mock notification mail uses a reserved domain')
  }
  assert.equal(todos.mapTransferOwnerToPmsUser('login-演示用户99', '演示用户99'), undefined)
})

check('projects and external pool use fictional brands and device identifiers', () => {
  unique(projects, 'id', 'projects')
  unique(external.EXTERNAL_PROJECT_POOL, 'bid', 'external projects')
  assert.ok(projects.length > 30, 'pagination still has multiple pages of seed data')
  for (const item of [...projects, ...external.EXTERNAL_PROJECT_POOL, ...technical]) {
    assert.match(item.name, /^(?:DEMO[A-Z0-9_-]+|示例.+|tOS\d+(?:\.\d+)*)$/, 'project names use explicit fictional namespaces or the tOS version label')
  }
  const invalid = []
  walk(samples, (key, value, at) => {
    if (typeof value !== 'string' || !value) return
    const historicalUnassignedBrand = /^\.roadmap\.changeLogs\.\d+\.snapshot\.brand$/.test(at) && value === '待定'
    if (key === 'brand' && !/^示例品牌[A-Z]$/.test(value) && !historicalUnassignedBrand) invalid.push(at)
    if (['projectCode', 'model', 'mainboard', 'mainboardName', 'chipCode', 'chipModel', 'cpu', 'platform'].includes(key)
      && !/^DEMO[A-Z0-9_-]+$/.test(value)) invalid.push(at)
  })
  assert.deepEqual(invalid, [], 'brand/device fields must use the example namespaces')
  for (const entry of external.EXTERNAL_PROJECT_POOL) {
    const details = external.fetchByBid(entry.bid)
    assert.ok(Object.keys(details).length > 0, `external project ${entry.bid} has supplementary data`)
    assert.ok(directoryUsers.has(entry.spm), `external owner ${entry.bid} is selectable`)
    if (details.projectCode) assert.ok(entry.name.includes(details.projectCode), `external project ${entry.bid} keeps its device code`)
    for (const child of entry.subprojects || []) {
      const seeded = technical.find(item => item.id === child.id)
      if (seeded) assert.equal(child.name, seeded.name, `external child ${child.id} keeps its renamed seed identity`)
    }
  }
})

check('roadmap planned projects and audit logs resolve to their source records', () => {
  unique(roadmap.plannedProjects, 'id', 'planned projects')
  unique(roadmap.tosVersions, 'id', 'roadmap version catalog')
  const plannedById = new Map(roadmap.plannedProjects.map(item => [item.id, item]))
  const versions = new Set(roadmap.tosVersions.map(item => item.id))
  for (const item of roadmap.plannedProjects) assert.ok(versions.has(item.firstSaleTosVersionId), `planned version for ${item.id} exists`)
  assert.ok(roadmap.changeLogs.length > 0, 'audit seed remains populated')
  for (const log of roadmap.changeLogs) {
    const source = (log.source === 'normal' ? projectById : plannedById).get(log.projectId)
    assert.ok(source, `audit ${log.id} resolves to a source project`)
    assert.equal(log.projectDisplayName, source.projectCode || source.displayName || source.name, `audit ${log.id} uses the current demo identity`)
  }
})

check('MR template, project, market, lock, and stop-release references remain valid', () => {
  unique(mr.templateVersions, 'id', 'MR templates')
  const templates = new Map(mr.templateVersions.map(item => [item.id, item]))
  assert.ok(templates.has(mr.currentTemplateVersionId))
  for (const [projectId, instances] of Object.entries(mr.tosInstancesByProjectId)) {
    assert.equal(projectById.get(projectId)?.type, projectTypes.PROJECT_TYPE_TOS_VERSION)
    unique(instances, 'tosVersion', `MR versions for ${projectId}`)
    for (const instance of instances) {
      assert.equal(instance.projectId, projectId)
      assert.ok(templates.has(instance.templateVersionId))
      const ids = new Set(instance.activities.map(item => item.id))
      assert.ok(instance.activities.every(item => item.parentId === null || ids.has(item.parentId)))
      assert.ok(Object.keys(instance.dates).every(id => ids.has(id)), 'MR dates reference an activity in their snapshot')
    }
  }
  for (const [key, plan] of Object.entries(mr.machinePlansByKey)) {
    assert.equal(key, `${plan.projectId}::${plan.tosVersion}`)
    assert.ok(projectTypes.isMachineProjectType(projectById.get(plan.projectId)?.type))
    assert.ok(mr.tosInstancesByProjectId[plan.tosProjectId]?.some(item => item.tosVersion === plan.tosVersion), `MR ${key} has a source tOS instance`)
  }
  for (const [key, override] of Object.entries(mr.marketOverridesByKey)) {
    assert.equal(key, `${override.projectId}::${override.tosVersion}::${override.market}`)
    assert.ok(mr.machinePlansByKey[`${override.projectId}::${override.tosVersion}`])
    const markets = projectById.get(override.projectId)?.markets || []
    assert.ok(markets.includes(override.market) && markets.includes(override.mainMarket))
  }
  for (const [key, lock] of Object.entries(mr.machineRowLocks)) {
    assert.equal(key, `${lock.projectId}::${lock.tosProjectId}::${lock.tosVersion}`)
    assert.equal(mr.machinePlansByKey[`${lock.projectId}::${lock.tosVersion}`]?.tosProjectId, lock.tosProjectId)
  }
  for (const record of mr.stopReleaseRecords) assert.equal(record.projectName, projectById.get(record.projectId)?.name)
})

check('technical project children and plan scopes preserve their references', () => {
  unique(technical, 'id', 'technical children')
  for (const child of technical) {
    assert.ok(projectById.has(child.parentProjectId), `technical parent ${child.parentProjectId} exists`)
    const machineId = child.configuration.firstMachineProjectId
    if (machineId) assert.ok(projectTypes.isMachineProjectType(projectById.get(machineId)?.type))
  }
  for (const [key, plan] of Object.entries(technicalPlans)) {
    const [parentId, kind, childId] = key.split(':')
    assert.ok(projectById.has(parentId), `technical plan parent ${parentId} exists`)
    if (kind === 'subproject') assert.ok(technical.some(child => child.id === childId && child.parentProjectId === parentId))
    assert.equal(plan.planKey, key)
    assert.ok(plan.versions.some(version => version.id === plan.currentVersionId))
    for (const version of plan.versions) {
      unique(version.tasks, 'id', `tasks in ${version.id}`)
      const taskIds = new Set(version.tasks.map(task => task.id))
      assert.ok(version.tasks.every(task => !task.parentId || taskIds.has(task.parentId)))
    }
  }
})

check('transfer applications, teams, materials, and todos resolve consistently', () => {
  const applications = transferState.transferApplications
  unique(applications, 'id', 'transfer applications')
  const users = new Map(transfer.MOCK_TM_USERS.map(user => [user.id, user]))
  const apps = new Map(applications.map(app => [app.id, app]))
  for (const app of applications) {
    assert.equal(projects.filter(candidate => transferRules.matchesTransferProject(app, candidate)).length, 1, `transfer ${app.id} matches exactly one project`)
    assert.equal(users.get(app.applicantId)?.name, app.applicant)
    for (const side of ['research', 'maintenance']) {
      assert.ok(app.team[side].every(member => users.get(member.id)?.name === member.name), `team identities in ${app.id}/${side} match their directory`)
    }
  }
  for (const rows of [transferState.tmChecklistItems, transferState.tmReviewElements]) {
    unique(rows, 'id', 'transfer materials')
    for (const item of rows) {
      const app = apps.get(item.applicationId)
      assert.ok(app)
      const role = item.responsibleRole === '测试' ? 'TPM' : item.responsibleRole
      for (const [side, idKey, nameKey] of [['research', 'entryPersonId', 'entryPerson'], ['maintenance', 'reviewPersonId', 'reviewPerson']]) {
        const owner = app.team[side].find(member => member.role === role)
        assert.equal(item[idKey], owner?.id || '', `${item.id} uses its own ${side} owner ID`)
        assert.equal(item[nameKey], owner?.name || '', `${item.id} uses its own ${side} owner name`)
      }
    }
    assert.ok(applications.every(app => rows.some(item => item.applicationId === app.id)), 'every application has its own materials')
  }
  for (const record of [...transferState.tmBlockTasks, ...transferState.tmLegacyTasks, ...transfer.MOCK_HISTORY]) assert.ok(apps.has(record.applicationId))
  const candidates = todos.buildTransferTodoCandidates({ applications, projects })
  assert.ok(candidates.length > 0, 'renaming does not empty transfer todos')
  assert.ok(candidates.every(item => directoryUsers.has(item.activeOwner) && projectById.has(item.projectId)))
})

check('sample links resolve only to reserved example domains or local anchors', () => {
  const invalid = []
  walk(samples, (key, value, at) => {
    if (typeof value !== 'string') return
    if (['url', 'href', 'server', 'buildAddress', 'jenkinsUrl'].includes(key) && !safeSampleUrl(value)) invalid.push(at)
    if (key === 'email' && !isExampleHost(value.split('@')[1] || '')) invalid.push(at)
    for (const [url] of value.matchAll(/https?:\/\/[^\s<>"'`））]+/g)) if (!safeSampleUrl(url)) invalid.push(at)
  })
  assert.deepEqual(invalid, [], 'sample URL fields and embedded links stay in reserved domains')
})

// Generic network rules only: no customer names, old seed values, or private hostnames
// are embedded in this regression. Data people/brands are checked by namespace above.
const privateIpv4 = /(?<![\w.])(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2})(?![\w.])/g
const internalDomain = /\b(?:[a-z0-9-]+\.)+(?:internal|intranet|corp|lan|local)\b/gi
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss', '.svg', '.html', '.txt', '.md', '.xml', '.csv'])
function sourceFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) return []
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directoryPath, entry.name)
    return entry.isDirectory() ? sourceFiles(file) : entry.isFile() && textExtensions.has(path.extname(file)) ? [file] : []
  })
}
check('source and public text contain no private network endpoints or non-example sample URLs', () => {
  const invalid = []
  const files = [...sourceFiles(path.join(root, 'src')), ...sourceFiles(path.join(root, 'public'))]
  assert.ok(files.length > 0)
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const relative = path.relative(root, file)
    for (const pattern of [privateIpv4, internalDomain]) {
      pattern.lastIndex = 0
      for (const match of source.matchAll(pattern)) invalid.push(`${relative}:${source.slice(0, match.index).split('\n').length} private network literal`)
    }
    for (const match of source.matchAll(/[\w.+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})/gi)) {
      if (!isExampleHost(match[1])) invalid.push(`${relative}:${source.slice(0, match.index).split('\n').length} non-example email`)
    }
    const urlTexts = []
    if (/\.[cm]?[jt]sx?$/.test(file)) {
      const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true)
      const visit = node => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) urlTexts.push(node.text)
        ts.forEachChild(node, visit)
      }
      visit(syntax)
    } else urlTexts.push(source)
    // Documentation comments are scanned for private endpoints above, while only
    // runtime string literals are required to use the reserved sample domains.
    for (const match of urlTexts.join('\n').matchAll(/https?:\/\/[a-z0-9][a-z0-9.-]*(?::\d+)?/gi)) {
      // The XML namespace is metadata required by SVG, not a sample destination.
      if (match[0] === 'http://www.w3.org' && /\.svg$/.test(file)) continue
      if (!safeSampleUrl(match[0])) invalid.push(`${relative} non-example runtime URL`)
    }
  }
  assert.deepEqual(invalid, [], 'source/public text network scan')
  console.log(`Scanned ${files.length} source/public text files`)
})

check('inline sample person fields remain fictional in component-local data', () => {
  const invalid = []
  const files = sourceFiles(path.join(root, 'src')).filter(file => /\.tsx?$/.test(file))
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true)
    const visit = node => {
      if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
        const key = node.name.getText(source).replace(/^['"]|['"]$/g, '')
        // Requiring a record ID distinguishes seed records from UI field-label maps.
        const propertyNames = node.parent.properties.filter(property => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)).map(property => property.name.getText(source))
        const isRecord = propertyNames.some(name => ['id', 'projectId', 'applicationId'].includes(name))
        const isFilterOperator = key === 'operator' && propertyNames.includes('field')
        if (isRecord && !isFilterOperator && peopleFields.has(key) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
          if (!validPersonField(key, node.initializer.text)) invalid.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${key}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.deepEqual(invalid, [], 'inline seed people use demo namespaces')
})

check('hygiene guards reject plausible accidental real-data substitutions', () => {
  assert.equal(validPersonField('createdBy', '当前用户'), true)
  assert.equal(validPersonField('createdBy', '当前用户,普通姓名'), false)
  assert.equal(validPersonField('updatedBy', '普通姓名'), false)
  assert.equal(validPersonField('responsible', '演示用户01,普通姓名'), false)
  for (const value of ['https://example.com.invalid/path', 'https://notexample.com', 'https://192.168.1.8', 'https://service.internal', 'https://user:password@example.com', 'javascript:alert(1)']) {
    assert.equal(safeSampleUrl(value), false)
  }
  for (const value of ['#', '/share/plan', 'https://jira.example.com/demo', 'build.example.org']) assert.equal(safeSampleUrl(value), true)
})

if (failures.length) throw new Error(`${failures.length}/${checks} mock data hygiene checks failed: ${failures.join('; ')}`)
console.log(`Mock data hygiene verified: ${checks} checks, ${projects.length} projects, ${technical.length} technical children, ${transferState.transferApplications.length} transfer applications`)
