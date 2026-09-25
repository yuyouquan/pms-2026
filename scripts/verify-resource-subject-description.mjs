import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage=createCurrentDatasetStorage()
globalThis.window=new EventTarget()
window.localStorage=localStorage
const load=createTypeScriptModuleLoader()
const rules=load('src/lib/nonLaborInvestment.ts')
const sheet=load('src/lib/nonLaborSpreadsheet.ts')
const subjects=[{id:'s',secondarySubject:'差旅',tertiarySubject:'机票',description:'航空交通费用\n含项目差旅'}]
const departments=[{id:'d1',primaryDepartment:'中心A',secondaryDepartment:'软件',tertiaryDepartment:'开发'},{id:'d2',primaryDepartment:'中心B',secondaryDepartment:'软件',tertiaryDepartment:'开发'}]
const range={startMonth:'2026-09',endMonth:'2026-09'}
const row={id:'r',primaryDepartment:'中心A',secondaryDepartment:'软件',tertiaryDepartment:'开发',subjectId:'s',secondarySubject:'差旅',tertiarySubject:'机票',subjectDescription:'已保存说明',monthlyAmounts:{'2026-09':12345.67}}
const value={...range,items:[row]}
assert.equal(rules.nonLaborDepartmentPairs(departments).length,2,'same secondary/tertiary names under different parents remain distinct')
assert.equal(rules.validateNonLaborInvestment({...value,items:[row,{...row,id:'b',primaryDepartment:'中心B'}]},subjects,undefined,departments).items.length,2)
assert.throws(()=>rules.validateNonLaborInvestment({...value,items:[{...row,primaryDepartment:'无效'}]},subjects,undefined,departments),/部门/)
assert.throws(()=>rules.validateNonLaborInvestment({...value,items:[row,{...row,id:'dup'}]},subjects,undefined,departments),/重复/)
const legacy={...range,items:[{...row,primaryDepartment:undefined}]}
assert.deepEqual(rules.validateNonLaborInvestment(legacy,subjects,legacy,departments),legacy,'legacy saved rows can keep their amounts without guessed parents')
assert.equal(rules.nonLaborSubjectDescription(row,subjects),'航空交通费用\n含项目差旅')
assert.equal(rules.nonLaborSubjectDescription(row,[]),'已保存说明')
assert.equal(rules.nonLaborSubjectDescription(row,[{...subjects[0],description:''}]),'暂无科目说明')
const header=sheet.nonLaborSpreadsheetColumns(range).map(c=>c.title)
const imported=sheet.parseNonLaborInvestmentRows([header,['中心A','软件','开发','差旅','机票',12345.67]],range,subjects,departments)
assert.equal(imported.items[0].primaryDepartment,'中心A')
assert.equal(imported.items[0].subjectDescription,subjects[0].description)
assert.equal(imported.items[0].monthlyAmounts['2026-09'],12345.67)
assert.throws(()=>sheet.parseNonLaborInvestmentRows([header,['','软件','开发','差旅','机票',1]],range,subjects,departments),/一级部门/)
const oldSheet=[header.slice(1),['软件','开发','差旅','机票',123.45]]
assert.throws(()=>sheet.parseNonLaborInvestmentRows(oldSheet,range,subjects,departments),/归属不唯一/)
assert.equal(sheet.parseNonLaborInvestmentRows(oldSheet,range,subjects,departments.slice(0,1)).items[0].primaryDepartment,'中心A')
const {validateInlineNonLabor}=load('src/lib/resourceInlineEditing.ts')
const cfg={nonLaborSubject:subjects,techModuleDept:departments}
for(const partial of [{primaryDepartment:'中心A',secondaryDepartment:'',tertiaryDepartment:''},{primaryDepartment:'中心A',secondaryDepartment:'软件',tertiaryDepartment:''}]) {
 assert.doesNotThrow(()=>validateInlineNonLabor({...value,items:[{...row,...partial}]},undefined,cfg))
}
assert.throws(()=>validateInlineNonLabor({...value,items:[{...row,primaryDepartment:'未知'}]},value,cfg),/部门/)
const {useHrConfigStore:config}=load('src/stores/hrConfig.ts')
const {useProjectStore:project}=load('src/stores/project.ts')
project.setState({currentLoginUser:'演示用户01'})
config.getState().addRecord('nonLaborSubject',{secondarySubject:'测试',tertiarySubject:'说明持久化',description:'  第一行\n第二行  '})
const saved=config.getState().data.nonLaborSubject.find(x=>x.tertiarySubject==='说明持久化')
assert.equal(saved.description,'第一行\n第二行')
config.getState().updateRecord('nonLaborSubject',saved.id,{description:'更新说明'})
assert.throws(()=>config.getState().updateRecord('nonLaborSubject',saved.id,{description:'字'.repeat(501)}),/500/)
const reloaded=createTypeScriptModuleLoader()('src/stores/hrConfig.ts').useHrConfigStore
assert.equal(reloaded.getState().data.nonLaborSubject.find(x=>x.id===saved.id).description,'更新说明')
project.setState({currentLoginUser:'演示用户02'})
config.getState().updateRecord('nonLaborSubject',saved.id,{description:'无权修改'})
assert.equal(config.getState().data.nonLaborSubject.find(x=>x.id===saved.id).description,'更新说明')
console.log('PASS parent-scoped duplicates, legacy preservation, cascading partial writes, description fallback, new/legacy imports, persistence and RBAC')
// Explicit expense parent must override a secondary-name fallback in both analyses.
const {buildDashboardAnalysis}=load('src/components/project-resources/resourceDashboardData.ts')
const {buildCumulativeEstimate}=load('src/components/project-resources/cumulativeEstimateData.ts')
const source={owner:{id:'p'},version:{id:'v',budgetType:'projectBudget',isActive:true,versionNumber:'V1',estimatedInvestment:0,projectStartTime:'2026-09-01',projectEndTime:'2026-09-30',departmentInvestments:[],nonLaborInvestment:value}}
const filter={primary:'中心A',department:'软件',departmentParents:{软件:'中心B'}}
assert.equal(buildDashboardAnalysis('capability',source,[],5,filter).nonLaborYuan,12345.67)
assert.equal(buildDashboardAnalysis('capability',source,[],5,{...filter,primary:'中心B'}).nonLaborYuan,0)
const cumulative=buildCumulativeEstimate('capability',[source],5,filter,'2026-09-30',[],'2026-09-01')
assert.equal(cumulative.cost,1.234567)
assert.equal(cumulative.rows[0].primary,'中心A')
const oldPrior={...range,items:[{...row,primaryDepartment:undefined,monthlyAmounts:{'2026-08':99,'2026-09':1}}]}
const upgrade=sheet.parseNonLaborInvestmentRows(oldSheet,range,subjects,departments.slice(0,1),oldPrior)
assert.equal(upgrade.items[0].id,row.id)
assert.equal(upgrade.items[0].monthlyAmounts['2026-08'],99)
console.log('PASS explicit parent attribution in overview/cumulative costs and legacy import hidden-month retention')
