import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const { filterConfigurationProjects } = load('src/lib/projectManagementUi.ts')
const { createProjectConfigurationFilters } = load('src/types/projectRegistry.ts')
const { useUiStore: ui } = load('src/stores/ui.ts')
const rows = [
  { id:'f1', name:'Alpha 正式整机', type:'整机产品项目', projectAttribute:'formal', projectCode:'IPM-Ab12' },
  { id:'f2', name:'Beta 正式技术', type:'技术项目', projectAttribute:'formal', projectCode:'TECH-02' },
  { id:'b1', name:'Alpha 年度预算', type:'整机产品项目', projectAttribute:'budget', projectCode:'BD-Alpha', boundFormalProjectId:'f1' },
  { id:'b2', name:'Beta 年度预算', type:'技术项目', projectAttribute:'budget', projectCode:'BD-Beta', boundFormalProjectId:'f2' },
  { id:'r1', name:'Alpha 路标', type:'整机产品项目', projectAttribute:'roadmap', projectCode:'RD-Alpha', boundFormalProjectId:'f1' },
  { id:'empty', name:'未绑定预算', type:'能力建设项目', projectAttribute:'budget', projectCode:null },
  { id:'missing', name:'失效关联预算', type:'tOS版本项目', projectAttribute:'budget', boundFormalProjectId:'gone' },
  { id:'legacy', name:'旧正式整机', type:'整机-手机', projectCode:'OLD-01' },
]
let passed=0
function check(name, run) { run(); passed++; console.log('PASS '+name) }
const query = patch => filterConfigurationProjects(rows, {...createProjectConfigurationFilters(), ...patch}).map(row=>row.id)

check('empty filters preserve order and data; name/code matching trims whitespace and ignores case', () => {
  assert.equal(typeof filterConfigurationProjects,'function')
  const before=JSON.stringify(rows)
  assert.deepEqual(query({}),rows.map(row=>row.id))
  assert.deepEqual(query({name:'  aLPHa  '}),['f1','b1','r1'])
  assert.deepEqual(query({projectCode:'  Ab12 '}),['f1'])
  assert.deepEqual(query({name:'   ',projectCode:' '}),rows.map(row=>row.id))
  assert.equal(JSON.stringify(rows),before)
})
check('multiple choices are OR within a field and AND across different fields', () => {
  assert.deepEqual(query({projectTypes:['整机产品项目','技术项目'],projectAttributes:['budget','roadmap']}),['b1','b2','r1'])
  assert.deepEqual(query({name:'alpha',projectTypes:['整机产品项目'],projectAttributes:['budget'],projectCode:'BD-',boundFormalProjectName:'正式整机'}),['b1'])
  assert.deepEqual(query({name:'Alpha',projectAttributes:['budget'],projectCode:'Beta'}),[])
})
check('binding searches the current formal project name from the full registry, not IDs or codes', () => {
  assert.deepEqual(query({boundFormalProjectName:' ALPHA 正式 '}),['b1','r1'])
  assert.deepEqual(query({name:'年度预算',boundFormalProjectName:'Alpha 正式'}),['b1'])
  assert.deepEqual(query({boundFormalProjectName:'IPM-Ab12'}),[])
  assert.deepEqual(query({boundFormalProjectName:'gone'}),[])
  const renamed=rows.map(row=>row.id==='f1'?{...row,name:'Gamma 正式整机'}:row)
  assert.deepEqual(filterConfigurationProjects(renamed,{...createProjectConfigurationFilters(),boundFormalProjectName:'gamma'}).map(row=>row.id),['b1','r1'])
})
check('legacy formal attributes and machine subtypes follow registry category rules', () => {
  assert.deepEqual(query({projectTypes:['整机产品项目'],projectAttributes:['formal']}),['f1','legacy'])
  assert.deepEqual(query({projectCode:'BD'}),['b1','b2'])
})
check('changing filters resets pagination, keeps other fields and survives space/view navigation', () => {
  ui.setState({activeModule:'projectManagement',projectManagementTab:'configuration',projectConfigurationPage:4})
  ui.getState().setProjectConfigurationFilters({name:'Alpha'})
  assert.equal(ui.getState().projectConfigurationPage,1)
  ui.getState().setProjectConfigurationFilters({projectAttributes:['budget','roadmap']})
  assert.equal(ui.getState().projectConfigurationFilters.name,'Alpha')
  ui.getState().setProjectConfigurationPage(2)
  const before=structuredClone(ui.getState().projectConfigurationFilters)
  const viewFilters=structuredClone(ui.getState().projectListSummaryFilters)
  ui.getState().enterProjectSpace({module:'projectManagement',projectManagementTab:'configuration'})
  ui.getState().returnFromProjectSpace()
  ui.getState().setProjectManagementTab('view')
  ui.getState().setProjectManagementTab('configuration')
  assert.deepEqual(ui.getState().projectConfigurationFilters,before)
  assert.deepEqual(ui.getState().projectListSummaryFilters,viewFilters)
  assert.equal(ui.getState().projectConfigurationPage,2)
  ui.getState().resetProjectConfigurationFilters()
  assert.deepEqual(ui.getState().projectConfigurationFilters,createProjectConfigurationFilters())
  assert.equal(ui.getState().projectConfigurationPage,1)
})
console.log(`Project configuration filters: ${passed} groups passed`)
