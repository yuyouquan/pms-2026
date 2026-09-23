import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const require = createRequire(import.meta.url)
const React = load(require.resolve('react'))
const { renderToStaticMarkup } = load(require.resolve('react-dom/server'))
const rules = load(path.resolve('src/lib/mrVersionPlanRules.ts'))
const grid = load(path.resolve('src/components/plans/MrPlanGrid.tsx'))
assert.equal(typeof grid.MrVersionLabel, 'function', 'MR versions need an accessible source-date warning beside the version')
const base = {value:'16.1.0.125',label:'16.1.0.125',disabled:false}
for (const [start,end,missing] of [['','','计划开始时间和计划完成时间'],['2027-03-03','','计划完成时间'],['','2027-03-20','计划开始时间']]) {
  const access = rules.resolveTosMrInstanceDateAccess(base.value,[{...base,planStartDate:start,planEndDate:end}])
  assert.equal(access.canEdit,false,'either missing bound must block editing')
  assert.ok(access.reason.includes(`未填写${missing}`))
  const markup = renderToStaticMarkup(React.createElement(grid.MrVersionLabel,{row:{key:'2::125',version:base.value,activities:[],dates:{},versionWarning:access.reason}}))
  assert.match(markup,/pms-mr-version-warning/)
  assert.ok(markup.indexOf(base.value)<markup.indexOf('pms-mr-version-warning'),'warning appears after the version label')
  assert.match(markup,/tabindex="0"/,'warning supports keyboard focus')
}
assert.equal(rules.resolveTosMrInstanceDateAccess(base.value,[{...base,planStartDate:'2027-03-03',planEndDate:'2027-03-20'}]).canEdit,true)
assert.doesNotMatch(renderToStaticMarkup(React.createElement(grid.MrVersionLabel,{row:{key:'2::125',version:base.value,activities:[],dates:{}}})),/pms-mr-version-warning/)
const errors = rules.validateTosMrInstanceDates({projectId:'2',tosVersion:base.value,activities:[{id:'start',parentId:'parent',activityName:'修改点收集开始时间'}],dates:{start:'2027-03-01'}},{planStartDate:'2027-03-03',planEndDate:''})
assert.equal(errors.length,1,'an existing start boundary still validates saved dates while end is missing')
console.log('PASS source date gating and version warning rendering')
