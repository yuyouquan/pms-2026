import type { StoreApi } from 'zustand'
import type { ResourceProject, ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import type { ResourceInlineActions } from '@/lib/resourceInlineEditing'
import { createInlineResourceVersion } from '@/lib/resourceInlineEditing'
import { appendResourceOperation, resourceVersionChanges } from '@/lib/resourceOperations'
import { getResourceFormalValidationErrors } from '@/lib/resourceRatios'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { canAccessHrProject, canEditHrInScope, getHrAllowedBudgetTypes } from '@/lib/hrProjectRegistry'
import { canCreateHrVersion, copyHrVersionSnapshot, isHrVersionEditable } from '@/lib/hrVersionRules'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useProjectStore } from '@/stores/project'
import { nonLaborMonths } from '@/lib/nonLaborInvestment'
import { withHrNonLaborRange } from '@/lib/hrNonLaborRange'

interface Monthly {
 id:string; projectId:string; versionId:string; versionNumber:string; versionLockState:string; primaryDepartment:string; secondaryDepartment:string
 estimatedTotal:number; monthlyData:Record<string,number>; isEdited:boolean; isArchived?:boolean; sourceRowId?:string
}
interface DomainState extends ResourceInlineActions { projects:ResourceProject[]; monthlyInvestments:Monthly[]; refreshFormalProjects:()=>void }
type AddedActions = 'createResourceVersion'|'updateResourceMonthlyInvestment'


/** Wrap action-local writes before Zustand persistence: audits and data share one transaction.
 * Background refresh, hydration and cross-tab setState never enter the user-action context.
 */
export function createResourceStoreState<S extends DomainState>(category:HrProjectCategory,rawSet:StoreApi<S>['setState'],get:()=>S,factory:(set:StoreApi<S>['setState'])=>Omit<S,AddedActions>,syncMonthly:(projects:S['projects'],rows:S['monthlyInvestments'])=>S['monthlyInvestments']):S {
 const actions:Record<string,string>={createResourceVersion:'创建版本',createVersionInline:'创建版本',addVersion:'创建版本',copyVersion:'复制版本',deleteVersion:'删除版本',updateVersion:'修改版本',updateVersionInline:'修改版本',updateVersionDepartmentInvestments:'修改部门人力投入',updateMonthlyInvestment:'修改月度人力投入',updateResourceMonthlyInvestment:'修改月度人力投入',setVersionLocked:'锁定状态',setVersionActive:'正式版本状态'}
 let action=''
 let targetProject=''
 let targetVersion=''
 let actionBefore:S|undefined
 const set=((partial: S|Partial<S>|((state:S)=>S|Partial<S>),replace?:boolean)=>rawSet(previous=>{
   const patch=typeof partial==='function'?partial(previous):partial
   if(!action || !actions[action]) return patch
   const next={...previous,...patch}
   const baseline=actionBefore??previous
   const projects=next.projects.map(project=>{
     if(project.id!==targetProject)return project
     const old=baseline.projects.find(item=>item.id===project.id)
     if(!old)return project
     let audited=project
     for(const id of new Set([...old.versions.map(v=>v.id),...project.versions.map(v=>v.id)])) {
       const before=old.versions.find(v=>v.id===id),after=project.versions.find(v=>v.id===id)
       const version=after??before
       if(!version)continue
       if(before && after && targetVersion && id!==targetVersion && action!=='setVersionActive')continue
       const changes=resourceVersionChanges(before,after)
       if(before && after) {
         for(const key of ['brand','productLine','marketName'] as const) {
           if(key in old && key in project && old[key as keyof typeof old]!==project[key as keyof typeof project]) changes.push({field:{brand:'品牌',productLine:'产品线',marketName:'市场名'}[key],before:String(old[key as keyof typeof old]??''),after:String(project[key as keyof typeof project]??'')})
         }
       }
       let label=actions[action]
       if(!before)label=version.copiedFromVersionId?'复制版本':'创建版本'
       else if(!after)label='删除版本'
       else if(action==='setVersionLocked')label=after.lockState==='locked'?'锁定版本':'解锁版本'
       else if(action==='setVersionActive')label=after.isActive?'设置为正式版本':'取消设置为正式版本'
       if(before && after && !changes.length && 'operationLogs' in before && 'operationLogs' in after) audited={...audited,versions:audited.versions.map(item=>item.id===id?{...item,operationLogs:before.operationLogs}:item)} as ResourceProject
       audited=appendResourceOperation(audited,version,label,changes)
     }
     if(action==='updateMonthlyInvestment' || action==='updateResourceMonthlyInvestment') {
       for(const row of next.monthlyInvestments.filter(row=>row.projectId===project.id)) {
         const oldRow=baseline.monthlyInvestments.find(item=>item.id===row.id)
         const version=project.versions.find(v=>v.id===row.versionId)
         if(!oldRow || !version)continue
         const changes=[...new Set([...Object.keys(oldRow.monthlyData),...Object.keys(row.monthlyData)])].filter(month=>oldRow.monthlyData[month]!==row.monthlyData[month]).map(month=>({field:`${row.primaryDepartment}/${row.secondaryDepartment} · ${month} 投入人月`,before:String(oldRow.monthlyData[month]??0),after:String(row.monthlyData[month]??0)}))
         audited=appendResourceOperation(audited,version,actions[action],changes)
       }
     }
     return audited
   })
   return {...patch,projects} as Partial<S>
 },replace)) as StoreApi<S>['setState']
 const result=factory(set) as S
 result.createResourceVersion=(projectId,budgetType,scopeId,options)=>{
   const state=get(),project=state.projects.find(item=>item.id===projectId)
   if(!project || !scopeId || !canEditHrInScope(project,scopeId) || !canCreateHrVersion(project,budgetType))throw new Error('当前项目不可创建版本')
   const input=options.versionNumber.trim().replace(/^V/i,'')
   if(!/^\d+(\.\d+)*$/.test(input))throw new Error('版本号仅支持数字和点分段，例如 0.3、1、1.2')
   const name=`V${input}`
   if(project.versions.some(version=>version.budgetType===budgetType && version.versionNumber===name))throw new Error('该预算分类已存在相同版本号')
   let projects:ResourceProject[],monthly:Monthly[],id:string
   if(options.sourceVersionId) {
     const source=project.versions.find(version=>version.id===options.sourceVersionId && version.budgetType===budgetType)
     if(!source)throw new Error('初始化来源版本不存在或不属于当前预算分类')
     const copied=copyHrVersionSnapshot(state.projects,state.monthlyInvestments,projectId,source.id,useProjectStore.getState().currentLoginUser)
     projects=copied.projects; monthly=copied.monthlyInvestments
     id=projects.find(item=>item.id===projectId)!.versions.at(-1)!.id
   } else {
     const version=createInlineResourceVersion(category,project,budgetType,scopeId,useHrConfigStore.getState().data,true)
     id=version.id;projects=state.projects.map(item=>item.id===projectId?{...item,versions:[...item.versions,version]} as ResourceProject:item);monthly=state.monthlyInvestments
   }
   projects=projects.map(item=>item.id===projectId?{...item,versions:item.versions.map(version=>version.id===id?{...version,versionNumber:name,customVersionNumber:true}:version)} as ResourceProject:item)
   monthly=monthly.map(row=>row.versionId===id?{...row,versionNumber:name}:row)
   set({projects,monthlyInvestments:syncMonthly(projects as S['projects'],monthly as S['monthlyInvestments'])} as Partial<S>)
   return id
 }
 result.updateResourceMonthlyInvestment=(projectId,versionId,rowId,month,value,scopeId)=>{
   const state=get(),project=state.projects.find(item=>item.id===projectId),version=project?.versions.find(item=>item.id===versionId)
   const row=state.monthlyInvestments.find(item=>item.id===rowId && item.projectId===projectId && item.versionId===versionId && !item.isArchived)
   if(!project || !version || !row || !scopeId || !canEditHrInScope(project,scopeId) || !isHrVersionEditable(project,version))throw new Error('当前月度投入不可编辑')
   validateMonthlyValue(category,version,month,value,row.monthlyData)
   value=Math.round(value*10)/10
   if((row.monthlyData[month]??0)===value)return
   set({monthlyInvestments:state.monthlyInvestments.map(item=>item.id===row.id?{...item,monthlyData:{...item.monthlyData,[month]:value},isEdited:true}:item)} as Partial<S>)
 }
 for(const name of Object.keys(actions)) {
   const original=(result as unknown as Record<string,unknown>)[name]
   if(typeof original!=='function')continue
   ;(result as unknown as Record<string,unknown>)[name]=(...args:unknown[])=>{
     const state=get(),projectId=name==='updateMonthlyInvestment'?state.monthlyInvestments.find(row=>row.id===args[0])?.projectId:String(args[0])
     const project=state.projects.find(item=>item.id===projectId)
     if(name==='setVersionActive' && args[2]===true && project && canAccessHrProject(project,true)) {
       const version=project.versions.find(item=>item.id===args[1])
       // Lifecycle eligibility is independent of project creation status (active/paused/cancelled).
       if(version && !version.isActive && getHrAllowedBudgetTypes(project).includes(version.budgetType)) {
         const errors=getResourceFormalValidationErrors(category,version,state.monthlyInvestments)
         if(errors.length)throw new Error(errors.join('；'))
       }
     }
     // Legacy bulk monthly API remains supported, with the same numeric/month contract.
     if(name==='updateMonthlyInvestment') {
       const row=state.monthlyInvestments.find(item=>item.id===args[0]),version=project?.versions.find(item=>item.id===row?.versionId)
       if(row && version && isHrVersionEditable(project,version))for(const [month,value] of Object.entries(args[1] as Record<string,number>))validateMonthlyValue(category,version,month,value,row.monthlyData)
     }
     const previousAction=action,previousProject=targetProject,previousVersion=targetVersion,previousBefore=actionBefore
     action=name;targetProject=projectId??'';targetVersion=['updateVersion','updateVersionInline','updateVersionDepartmentInvestments','setVersionLocked','setVersionActive'].includes(name)?String(args[1]):'';actionBefore=state
     try{return original(...args)}finally{action=previousAction;targetProject=previousProject;targetVersion=previousVersion;actionBefore=previousBefore}
   }
 }
 const refresh=result.refreshFormalProjects
 result.refreshFormalProjects=()=>{const previous=action;action='';try{return refresh()}finally{action=previous}}
 return result
}
function validateMonthlyValue(category:HrProjectCategory,version:ResourceVersion,month:string,value:number,saved:Record<string,number>) {
 if(!Number.isFinite(value)||value<0||Math.abs(value*10-Math.round(value*10))>0.000001)throw new Error('月度人力投入必须为非负数，最多保留一位小数')
 const range=withHrNonLaborRange(undefined,category,'milestones' in version?version.milestones:version)
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !nonLaborMonths(range).includes(month) && !Object.prototype.hasOwnProperty.call(saved,month))throw new Error('月份不在当前版本计划区间内')
}
