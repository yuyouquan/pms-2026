import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const { resolveResourceDashboardContext, cockpitResourceFilter, resourceDashboardDepartmentParents } = get('src/components/project-resources/resourceDashboardContext.ts')
const data = get('src/components/cockpit/cockpitData.ts')
const { collectCockpitInputs } = get('src/components/cockpit/cockpitSources.ts')
const { buildResourceDepartmentDetails } = get('src/components/project-resources/cumulativeEstimateData.ts')
const { buildDashboardAnalysis } = get('src/components/project-resources/resourceDashboardData.ts')
const { buildAccountingAnalysis } = get('src/components/project-resources/resourceAccounting.ts')
const { useProjectStore } = get('src/stores/project.ts')
const { usePermissionStore } = get('src/stores/permission.ts')
const { useUiStore } = get('src/stores/ui.ts')
usePermissionStore.getState().ensurePermissionCenter()
const stores = Object.fromEntries(['Machine', 'Tos', 'Technical', 'Capability'].map(kind => [kind.toLowerCase(), get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]]))
Object.values(stores).forEach(store => store.getState().refreshFormalProjects())
const actor = useProjectStore.getState().currentLoginUser
const inputs = collectCockpitInputs(useProjectStore.getState().projects, Object.fromEntries(Object.entries(stores).map(([key, store]) => [key, store.getState()])), actor)
const today = '2026-10-10'
const context = { actor, projectId: inputs[0].project.id, dates: ['2026-01-01','2026-12-31'], scope: 'all', departments: [], mode: 'cost' }
assert.equal(resolveResourceDashboardContext(context, 'another-actor', context.projectId), undefined)
assert.equal(resolveResourceDashboardContext(context, actor, 'another-project'), undefined)
assert.equal(resolveResourceDashboardContext({...context, dates:['2026-02-30','2026-12-31']}, actor, context.projectId), undefined)
useUiStore.getState().enterProjectSpace({ module:'hrPipeline', resourceContext:context })
assert.deepEqual(useUiStore.getState().projectSpaceOrigin.resourceContext, context)
useUiStore.getState().clearResourceDashboardContext()
assert.equal(resolveResourceDashboardContext(useUiStore.getState().projectSpaceOrigin.resourceContext, actor, context.projectId), undefined, 'remounted overview must not restore cleared filters')
assert.equal(useUiStore.getState().projectSpaceOrigin.module, 'hrPipeline', 'full cycle preserves cockpit return path')
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().projectSpaceOrigin, null)
// Legacy expenses can omit a parent. Match cockpit source attribution without changing ordinary project defaults.
const legacyInput = inputs.find(input=>input.sources[0])
const legacySource = structuredClone(legacyInput.sources[0])
legacySource.version.nonLaborInvestment = { startMonth:'2026-10', endMonth:'2026-10', items:[{
  id:'legacy-expense-only', secondaryDepartment:'独立费用部', tertiaryDepartment:'组', subjectId:'test',
  secondarySubject:'费用', tertiarySubject:'费用', monthlyAmounts:{'2026-10':10000},
}] }
const legacy = {...legacyInput,sources:[legacySource,undefined,undefined],monthly:[],dataset:undefined}
const legacyDates = ['2026-10-01','2026-10-31']
const legacyContext = {...context,projectId:legacy.project.id,dates:legacyDates,scope:'software',departments:['独立费用部']}
const legacyExpected = data.summarizeCockpit(data.filterCockpitFacts(data.buildCockpitFacts([legacy],{startDate:legacyDates[0],endDate:legacyDates[1]},5,today,()=>true),legacyContext))
const legacyFilter = cockpitResourceFilter(legacyContext,legacyDates,today,()=>true)
const fallback = {'独立费用部':'软件工程部'}
const inheritedParents = resourceDashboardDepartmentParents([],fallback,true)
assert.equal(inheritedParents['独立费用部'],undefined,'inherited attribution never invents source parents from config')
const inheritedLegacy = buildResourceDepartmentDetails(legacy.category,legacy.sources,[],5,undefined,{...legacyFilter,departmentParents:inheritedParents},today,legacy.project.planStartDate)
assert.ok((inheritedLegacy.total.annual?.cost??0)===(legacyExpected.annual?.cost??0))
const ordinaryParents = resourceDashboardDepartmentParents([],fallback,false)
assert.equal(ordinaryParents['独立费用部'],'软件工程部','ordinary entry retains config fallback')
const ordinaryLegacy = buildResourceDepartmentDetails(legacy.category,legacy.sources,[],5,undefined,{...legacyFilter,departmentParents:ordinaryParents},today,legacy.project.planStartDate)
assert.equal(ordinaryLegacy.total.annual.cost,1,'fixture catches the attribution difference')
let comparisons=0
for (const input of inputs) {
  for (const [dates, scope, departments] of [
    [context.dates,'all',[]], [['2026-04-08','2026-07-19'],'all',['软件部','产品部']],
    [context.dates,'software',[]], [['2027-01-01','2027-02-01'],'all',[]],
  ]) {
    const ctx = {...context, projectId:input.project.id, dates, scope, departments}
    const allow = (primary, secondary) => secondary !== '结构部'
    const facts = data.filterCockpitFacts(data.buildCockpitFacts([input], {startDate:dates[0],endDate:dates[1]},5,today,(_input,p,s)=>allow(p,s)), {scope,departments})
    const expected = data.summarizeCockpit(facts)
    const filter = cockpitResourceFilter(ctx, dates, today, allow)
    const details = buildResourceDepartmentDetails(input.category,input.sources,input.monthly,5,input.dataset,filter,today,input.project.planStartDate)
    for (const key of ['annual','estimate','budget','actual','cumulative']) {
      for (const mode of ['labor','cost']) {
        const value = details.total[key]?.[mode], other = expected[key]?.[mode]
        // No matching department facts means the cockpit omits the project. The project view must stay empty/zero.
        if (!facts.length) { assert.ok(value === undefined || value === 0, `${key}: no widening empty selection`); continue }
        if (other === undefined) assert.ok(value === undefined || value === 0, `${key}: missing source`)
        else assert.ok(Math.abs(value-other)<0.00002, `${input.category} ${key} ${mode}: ${value} != ${other}`)
        comparisons++
      }
    }
    const actual = buildAccountingAnalysis(input.dataset,5,filter)
    assert.ok(!actual || actual.worklogs.every(row=>row.date<=today && allow(row.primaryDepartment,row.secondaryDepartment)))
    const revoked = cockpitResourceFilter(ctx,dates,today,()=>false)
    assert.equal((buildAccountingAnalysis(input.dataset,5,revoked)?.worklogs.length ?? 0),0,'live revocation closes inherited scope')
    for (const source of input.sources.filter(Boolean)) {
      const revokedBudget = buildDashboardAnalysis(input.category,source,input.monthly,5,revoked)
      assert.equal(revokedBudget.target,0,'source metadata respects the live department boundary')
      assert.equal(revokedBudget.issues.some(issue=>issue.key==='missing-detail'),false,'no out-of-scope source total in export checks')
    }
  }
}
console.log(`PASS cockpit drilldown: ${comparisons} source comparisons, partial/future ranges, multiple departments, user/project isolation, navigation lifecycle and revocation`)
