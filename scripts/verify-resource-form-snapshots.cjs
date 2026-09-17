const fs=require('node:fs'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const req=createRequire(process.cwd()+'/package.json');
const ts=req('typescript');
const source=fs.readFileSync('src/components/project-resources/HrVersionMilestones.tsx','utf8');
const manual={conceptStart:'2020-01-01',productLaunch:'2020-08-01'};
let formal=true;
const modules={
 react:{useState:()=>[manual,()=>{}],useEffect:()=>{}},
 '@/lib/hrProjectRegistry':{isHrFormalRecord:()=>formal},
 '@/lib/hrFormalProjectSource':{resolveHrFormalSource:()=>({milestones:{conceptStart:'2099-01-01'}})},
 '@/lib/hrMilestoneOwnership':{HR_MANUAL_MILESTONE_KEYS:{machine:['productLaunch']},mergeHrFormalMilestones:(_cat,live,manual)=>({...manual,...live})},
 '@/lib/hrVersionRules':{getHrVersionSeed:()=>null},
 '@/constants/hrMachine':{MILESTONE_FIELDS:[]},
 '@/constants/hrTos':{TOS_MILESTONE_FIELDS:[]},
 '@/constants/hrTechnical':{TECH_MILESTONE_FIELDS:[]},
 '@/lib/hrMachinePeriods':{withMachineDerivedMilestones:v=>v},
 '@/components/project-resources/HrReadonlyField':{HrReadonlyField:'readonly'}
};
const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(id=>modules[id]??req(id),mod,mod.exports);
const original={id:'v',budgetType:'projectEstimate',lockState:'unlocked',milestones:{conceptStart:'2020-01-01'}};
const values=v=>mod.exports.useHrVersionMilestones('machine',{id:'p',ipmProjectCode:null,versions:[v]},'projectEstimate',true,'v').values;
assert.equal(values({...original,copiedFromVersionId:'source'}).conceptStart,'2020-01-01','copied draft cannot overlay live formal dates');
assert.equal(values(original).conceptStart,'2099-01-01','normal unlocked formal version retains live-source behavior');
assert.equal(values({...original,lockState:'locked'}).conceptStart,'2020-01-01','locked original remains frozen');
const machine=fs.readFileSync('src/components/hr-machine/NewVersionModal.tsx','utf8');
const expr=machine.match(/const effectiveProjectLevel = ([^\n]+)/)[1];
const level=new Function('editingVersion','formal','resolveHrFormalSource','project','projectLevel',`return ${expr}`);
assert.equal(level({copiedFromVersionId:'source',projectLevel:'A'},true,()=>({projectLevel:'S'}),{},'A'),'A','copied model level stays saved despite live source changes');
assert.equal(level(undefined,true,()=>({projectLevel:'S'}),{},'A'),'S','new formal creation retains source level');
console.log('PASS copied draft source dates/model level retained, ordinary source/locked behavior preserved');
