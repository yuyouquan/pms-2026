import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const { MILESTONE_FIELDS } = get('src/constants/hrMachine.ts')
assert.deepEqual(MILESTONE_FIELDS.map(field => field.label), ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'STR5+6个月'])
const { withMachineDerivedMilestones } = get('src/lib/hrMachinePeriods.ts')
for (const [str5, expected] of [['2026-08-31', '2027-02-28'], ['2027-08-31', '2028-02-29'], ['2026-12-15', '2027-06-15'], [null, null], ['', null], ['bad-date', null]]) {
  assert.equal(withMachineDerivedMilestones({ str5, str5Plus6Months: '2099-01-01' }).str5Plus6Months, expected)
}
console.log('PASS: machine milestone fields and calendar-month derived endpoint')

const periods = get('src/lib/hrMachinePeriods.ts').MACHINE_INVESTMENT_PERIODS
const cfg = get('src/constants/hrConfig.ts')
assert.deepEqual(cfg.HR_MODEL_PHASE_FIELDS.map(f=>f.label), ['概念启动~STR1','STR1~STR2','STR2~STR3','STR3~STR4','STR4~STR4A','STR4A~STR5','STR5+6个月'])
const row = { id:'seven', enabled:true, projectLevel:'S', modelVersion:'SEVEN', primaryDepartment:'研发中心', secondaryDepartment:'软件部', ...Object.fromEntries(periods.map(f=>[f.key,10])) }
assert.equal(cfg.calcModelSum([row], 'S', 'SEVEN'), 70)
const details = cfg.calcMachineDepartmentInvestments([row], 'S', 'SEVEN', 1.5)[0]
assert.equal(details.estimatedTotal, 105)
for (const f of periods) assert.equal(details.phases[f.key],15)
const dates = {conceptStart:'2026-01-01',str1:'2026-02-01',str2:'2026-03-01',str3:'2026-04-01',str4:'2026-05-01',str4a:'2026-06-01',str5:'2026-08-31', productLaunch:'2099-01-01', lifecycleEnd:'2100-01-01',str5Plus6Months:'2099-01-01'}
for (const f of periods) {
  const isolated = {...row, ...Object.fromEntries(periods.map(p=>[p.key,p.key===f.key?10:0]))}
  const split = cfg.calcDepartmentMonthlySplit([isolated],'S','SEVEN',1,dates)[0]
  const keys=Object.keys(split.monthlyData).sort()
  assert.equal(keys[0],dates[f.startField].slice(0,7),f.label+' starts at its own boundary')
  assert.equal(keys.at(-1),f.key==='str5ToSixMonths'?'2027-02':dates[f.endField].slice(0,7),f.label+' ends at its own boundary')
  assert.equal(Math.round(Object.values(split.monthlyData).reduce((a,b)=>a+b,0)*10),100)
}
const noEnd=cfg.calcDepartmentMonthlySplit([{...row,...Object.fromEntries(periods.map(p=>[p.key,p.key==='str5ToSixMonths'?10:0]))}],'S','SEVEN',1,{...dates,str5:null})[0]
assert.deepEqual(noEnd.monthlyData,{})
assert.equal(noEnd.estimatedTotal,10)
const old=cfg.LEGACY_MOCK_HR_MODELS[0]
assert.equal(cfg.refreshMachineModelFixtures([old])[0].conceptToStr1,5)
const modified={...old,planningPhase:123}
assert.deepEqual(cfg.refreshMachineModelFixtures([modified]),[modified])
assert.equal(cfg.isHrModelAvailable([modified],'S','V2026.1'),false)
assert.equal(cfg.isHrModelAvailable(cfg.MOCK_CONFIG_DATA.hrModel,'S','V2026.1'),true)
assert.equal(cfg.calcModelSum(cfg.MOCK_CONFIG_DATA.hrModel,'S','V2026.1'),100)
assert.equal(get('src/lib/hrModelStatistics.ts').summarizeHrModels([row])[0].total,70)
console.log('PASS: seven-period totals, monthly split boundaries, calendar end, safe fixture refresh and old-model preservation')

assert.deepEqual(cfg.getTosConfigModelVersions(cfg.MOCK_CONFIG_DATA.tosPhaseRatio), ['V2026.1','V2025.4'])

const merged=get('src/lib/hrMilestoneOwnership.ts').mergeHrFormalMilestones('machine',{str5:'2026-08-31',productLaunch:null,lifecycleEnd:null},{productLaunch:'2027-01-01',lifecycleEnd:'2027-06-30'})
assert.equal(merged.productLaunch,'2027-01-01')
assert.equal(merged.lifecycleEnd,'2027-06-30')
assert.equal(merged.str5Plus6Months,'2027-02-28')
console.log('PASS: hidden original endpoints remain available to archived six-phase model calculations')

const fields=get('src/lib/hrMachinePeriods.ts').machinePhaseFields([modified,row])
assert.equal(fields.length,13)
assert.ok(fields.some(f=>f.key==='planningPhase'))
assert.ok(fields.some(f=>f.key==='str1ToStr2'))
console.log('PASS: mixed legacy/current models expose both schemas without relabeling or losing investments')

const ownership=get('src/lib/hrMilestoneOwnership.ts')
const oldDates={...dates,productLaunch:'2026-08-01'}
delete oldDates.lifecycleEnd
const legacyMerged=ownership.mergeHrFormalMilestones('machine',{...oldDates,lifecycleEnd:null},oldDates)
assert.equal(legacyMerged.lifecycleEnd,undefined)
assert.deepEqual(cfg.calcDepartmentMonthlySplit([modified],'S','V2026.1',1,legacyMerged),cfg.calcDepartmentMonthlySplit([modified],'S','V2026.1',1,oldDates))
console.log('PASS: legacy absent ending retains the original 180-day allocation after formal refresh')
