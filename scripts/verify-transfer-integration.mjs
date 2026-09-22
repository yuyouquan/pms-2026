import assert from 'node:assert/strict'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
const root = process.cwd()
const workflow = loadTypeScriptModule(root, 'src/lib/transferWorkflow.ts')
const mock = loadTypeScriptModule(root, 'src/mock/transfer-maintenance.ts')
const app = { ...structuredClone(mock.MOCK_TRANSFER_APPLICATIONS[0]), projectType: 'tOS版本项目' }
assert.equal(workflow.createTransferMaterials(app).reviewElements.length, 0, 'tOS applications must have CheckList only')
const config = loadTypeScriptModule(root, 'src/lib/transferConfig.ts')
const roles = config.getTransferRoleConfig('整机产品项目')
const templates = config.createTransferTemplateVersions()
assert.notEqual(templates['整机产品项目'].checklist, templates['tOS版本项目'].checklist)
assert.equal(config.getCurrentTransferTemplates('tOS版本项目', templates).reviewElements.length, 0)
const rows = config.parseTransferTemplateRows([
 ['序号','标准','类型','责任角色','资料录入-责任人','人工审核-责任人','智能检查规则'],
 ['A.01','资料归档','交付件','SPM','在研SPM','维护SPM','检查完整'],
 ['A.01','资料归档','检查项','测试','在研测试','维护测试','核对'],
], 'checklist', roles)
assert.equal(rows[0].seq, 'A.01')
assert.deepEqual(config.transferTemplateRowSpans(rows), [2,0])
assert.throws(() => config.parseTransferTemplateRows([['标准','类型'],['x','y']], 'checklist', roles), /表头/)
assert.throws(() => config.parseTransferTemplateRows([
 config.TRANSFER_TEMPLATE_HEADERS.checklist,
 ['1','标准','检查项','不存在','在研SPM','维护SPM','规则']
], 'checklist', roles), /角色/)
const renamed = roles.map(role => role.id === 'spm' ? {...role,roleName:'版本负责人',ipmRoleCode:'VERSION_PM'} : role)
const customApp = { ...app, projectType: '整机产品项目', finalReviewRole:'版本负责人', teamConfig:renamed,
 team: { research: [{id:'login-演示用户01',name:'演示用户01',role:'版本负责人'}],maintenance:[{id:'login-演示用户02',name:'演示用户02',role:'版本负责人'}] },
 pipeline:{...app.pipeline,dataEntry:'success',maintenanceReview:'success',maintenanceSpmReview:'in_progress',roleProgress:[{role:'版本负责人',entryStatus:'completed',reviewStatus:'completed'}]}}
const items = workflow.createTransferMaterials(customApp, {checklist:[{...rows[0],responsibleRole:'版本负责人',entryRole:'在研版本负责人',reviewRole:'维护版本负责人'}],reviewElements:[]})
assert.equal(items.checklist[0].entryPersonId,'login-演示用户01')
assert.equal(items.checklist[0].seq,'A.01')
const project={id:app.projectId,name:app.projectName}
const reviewer={id:'login-演示用户02',name:'演示用户02'}
assert.equal(workflow.getMaintenanceSpmReviewAccess(customApp,reviewer,project).canApprove,true)
assert.equal(workflow.canEditTransferLegacy(customApp,reviewer,project),true)
assert.equal(workflow.canEditTransferLegacy({...customApp,status:'completed'},reviewer,project),false)
assert.equal(workflow.getMaintenanceSpmReviewAccess(customApp,{id:'login-演示用户03',name:'演示用户03'},project).canApprove,false)
const rejected={...customApp,pipeline:{...customApp.pipeline,maintenanceReview:'in_progress',maintenanceSpmReview:'not_started',roleProgress:[{role:'版本负责人',entryStatus:'completed',reviewStatus:'rejected'}]}}
assert.equal(workflow.getMaintenanceSpmReviewAccess(rejected,reviewer,project).canReject,true)
assert.equal(workflow.getMaintenanceSpmReviewAccess(rejected,reviewer,project).canApprove,false)
const delegated={...items.checklist[0],delegatedTo:['login-演示用户03']}
const entering={...customApp,pipeline:{...customApp.pipeline,dataEntry:'in_progress',maintenanceReview:'not_started',maintenanceSpmReview:'not_started'}}
assert.equal(workflow.canEnterTransferItem(entering,delegated,{id:'login-演示用户03',name:'演示用户03'},project),true)
assert.equal(workflow.canEnterTransferItem(entering,delegated,{id:'login-演示用户04',name:'演示用户04'},project),false)
assert.equal(workflow.canEnterTransferItem(entering,delegated,{id:'login-演示用户03',name:'演示用户03'},{id:'other',name:'other'}),false)
console.log('Transfer integration: project separation, import/grouping, role mapping, delegated access and final-review guards passed')
const suffixRole = { id:'base', roleName:'底软开发代表', ipmRoleCode:'BASE' }
const suffixApp = {...customApp, teamConfig:[suffixRole], team:{ research:[{id:'login-演示用户01',name:'演示用户01',role:suffixRole.roleName,ipmRoleCode:'BASE'}], maintenance:[{id:'login-演示用户02',name:'演示用户02',role:suffixRole.roleName,ipmRoleCode:'BASE'}]}}
const suffixItems = workflow.createTransferMaterials(suffixApp, {checklist:[{...rows[0],responsibleRole:suffixRole.roleName,entryRole:'在研底软开发代表',reviewRole:'维护底软开发代表'}],reviewElements:[]})
assert.equal(suffixItems.checklist[0].entryPerson,'演示用户01','Configured full role names must not lose legacy suffixes')
const early = {...entering,applicantId:reviewer.id,applicant:reviewer.name,pipeline:{...entering.pipeline,roleProgress:[{role:'空角色',entryStatus:'completed',reviewStatus:'completed'}]}}
assert.equal(workflow.canCloseTransfer(early,reviewer,project,true),true,'Empty configured roles do not prevent early close')
assert.equal(workflow.canCloseTransfer({...early,pipeline:{...early.pipeline,maintenanceReview:'in_progress',roleProgress:[{role:'版本负责人',entryStatus:'completed',reviewStatus:'in_progress'}]}},reviewer,project,true),false)
assert.equal(workflow.canCloseTransfer(early,{id:'other',name:'other'},project,true),false)
const todo = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
const crossApp={...entering,team:{research:[{id:'login-演示用户03',name:'演示用户03',role:'版本负责人'}],maintenance:[{id:'login-演示用户04',name:'演示用户04',role:'版本负责人'}]},pipeline:{...entering.pipeline,roleProgress:[{role:'版本负责人',entryStatus:'in_progress',reviewStatus:'not_started'}]}}
const candidates=todo.buildTransferTodoCandidates({applications:[crossApp],projects:[project],items:items.checklist})
assert.ok(candidates.some(row=>row.activeOwner==='演示用户03'&&row.view==='entry'),'Role coordinator receives entry submit todo even with another material owner')
console.log('Exact role names, early close and cross-role coordinator todos passed')
assert.ok(config.validateTransferTeamConfig([...roles,{id:'qa',roleName:'TPM',ipmRoleCode:'QA'}]).some(error=>error.includes('其他角色')),'Cross-field role/code collisions must be rejected')
const repeatedReview = [{id:1,seq:'R.01',standard:'共同标准',type:'检查项',description:'第一条',remark:'',responsibleRole:'SPM',entryRole:'在研SPM',reviewRole:'维护SPM',aiCheckRule:''},{id:2,seq:'R.01',standard:'共同标准',type:'检查项',description:'第二条',remark:'',responsibleRole:'SPM',entryRole:'在研SPM',reviewRole:'维护SPM',aiCheckRule:''}]
assert.equal(config.compareTransferTemplates(repeatedReview,[{...repeatedReview[0],description:'第一条已更新'},repeatedReview[1]],'review').length,1)
assert.equal(config.compareTransferTemplates(repeatedReview,repeatedReview.map(row=>({...row,id:row.id+100})),'review').length,0,'Internal row IDs are not content differences')
console.log('Ambiguous role aliases and duplicate-group version diffs passed')
const originalTemplate = config.getCurrentTransferTemplates('整机产品项目',templates).checklist
const roundtrip = config.parseTransferTemplateRows([config.TRANSFER_TEMPLATE_HEADERS.checklist,...config.transferTemplateMatrix(originalTemplate,'checklist')],'checklist',roles)
assert.equal(config.compareTransferTemplates(originalTemplate,roundtrip,'checklist').length,0,'Export/import roundtrip must not invent changes from numeric vs string sequence')
console.log('Template export/import roundtrip diff passed')
// Existing legacy follow-up work remains actionable by its owner after final review or termination.
const legacyTask = { id:'legacy-owner',applicationId:customApp.id,description:'跟进遗留问题',responsiblePerson:reviewer.name,department:'项目团队',deadline:'2026-10-01',status:'open',createdAt:'2026-09-22' }
for (const status of ['in_progress','completed','failed','cancelled']) {
 const target = {...customApp,status,pipeline:{...customApp.pipeline,maintenanceSpmReview:'success'}}
 assert.equal(workflow.canResolveTransferLegacy(target,legacyTask,reviewer,project,true),true,`Task owner can resolve existing follow-up in ${status}`)
 assert.equal(workflow.canEditTransferLegacy(target,reviewer,project),false,'Resolving a follow-up does not reopen final-review editing')
}
assert.equal(workflow.canResolveTransferLegacy(customApp,legacyTask,reviewer,project,false),false)
assert.equal(workflow.canResolveTransferLegacy(customApp,legacyTask,{id:'login-演示用户01',name:'演示用户01',isAdmin:true},project,true),false,'Global admin is not the task owner')
assert.equal(workflow.canResolveTransferLegacy(customApp,{...legacyTask,status:'resolved'},reviewer,project,true),false)
assert.equal(workflow.canResolveTransferLegacy(customApp,{...legacyTask,applicationId:'another'},reviewer,project,true),false)
assert.equal(workflow.canResolveTransferLegacy(customApp,legacyTask,reviewer,{id:'other',name:'other'},true),false)
console.log('Legacy owner completion across transfer stages and task/project/permission guards passed')
// Delegation manages ownership metadata; it must not reopen approved material results.
const delegationApp = {...entering,pipeline:{...entering.pipeline,maintenanceReview:'in_progress'}}
const reviewedItem = {...items.checklist[0],entryStatus:'entered',aiCheckStatus:'passed',reviewStatus:'passed'}
assert.equal(workflow.canDelegateTransferItem(delegationApp,reviewedItem,reviewer,project,'review'),true)
assert.equal(workflow.canReviewTransferItem(delegationApp,reviewedItem,reviewer,project),false)
const entryOwner = {id:reviewedItem.entryPersonId,name:reviewedItem.entryPerson}
assert.equal(workflow.canDelegateTransferItem(delegationApp,{...reviewedItem,reviewStatus:'reviewing'},entryOwner,project,'entry'),true)
assert.equal(workflow.canEnterTransferItem(delegationApp,{...reviewedItem,reviewStatus:'reviewing'},entryOwner,project),false)
assert.equal(workflow.canDelegateTransferItem(delegationApp,reviewedItem,entryOwner,project,'entry'),false)
assert.equal(workflow.canDelegateTransferItem(delegationApp,reviewedItem,entryOwner,project,'review'),false)
assert.equal(workflow.canDelegateTransferItem(delegationApp,{...reviewedItem,applicationId:'other'},reviewer,project,'review'),false)
assert.equal(workflow.canDelegateTransferItem({...delegationApp,pipeline:{...delegationApp.pipeline,maintenanceSpmReview:'success'}},reviewedItem,reviewer,project,'review'),false)
console.log('Delegation metadata remains manageable without reopening approved results passed')
const { getTransferAiCheckResult } = loadTypeScriptModule(root, 'src/lib/transferAiCheck.ts')
assert.equal(getTransferAiCheckResult(0.1).aiCheckStatus,'failed')
assert.equal(getTransferAiCheckResult(0.11).aiCheckStatus,'passed')
assert.match(getTransferAiCheckResult(0).aiCheckResult,/不通过/)
const failedAi = {...reviewedItem,reviewStatus:'not_reviewed',...getTransferAiCheckResult(0)}
assert.equal(workflow.canEnterTransferItem(entering,failedAi,entryOwner,project),true,'Failed AI can be corrected by its owner')
const { getTransferRoleSubmission } = loadTypeScriptModule(root, 'src/components/transfer/transferInteraction.ts')
assert.equal(getTransferRoleSubmission(entering,failedAi.responsibleRole,[failedAi],entryOwner,project,true).canSubmit,false)
assert.equal(getTransferRoleSubmission(entering,failedAi.responsibleRole,[{...failedAi,...getTransferAiCheckResult(0.9)}],entryOwner,project,true).canSubmit,true)
console.log('AI failure blocks submission and correction permits retry passed')
const { inheritTransferMaterialContent } = loadTypeScriptModule(root, 'src/components/transfer/transferInteraction.ts')
const oldApplication = {...app,teamConfig:undefined}
const oldMaterial = {...mock.MOCK_CHECKLIST_ITEMS[0],applicationId:oldApplication.id,seq:37,responsibleRole:'SPM',entryContent:'历史资料第一条',entryStatus:'entered'}
const newMaterial = {...oldMaterial,id:'new-cl',applicationId:customApp.id,seq:'A.01',responsibleRole:'版本负责人',entryContent:undefined,entryStatus:'not_entered',deliverables:[]}
const oldInherited = inheritTransferMaterialContent(oldApplication,customApp,[newMaterial,{...newMaterial,id:'new-cl-2'}],[oldMaterial,{...oldMaterial,id:'old-cl-2',seq:38,entryContent:'历史资料第二条'}])
assert.deepEqual(oldInherited.map(row=>row.entryContent),['历史资料第一条','历史资料第二条'],'Legacy automatic sequence values must not discard matching materials on first reopen')
assert.equal(oldInherited[0].aiCheckStatus,'in_progress')
console.log('Legacy unconfigured role and automatic-sequence reopen compatibility passed')
