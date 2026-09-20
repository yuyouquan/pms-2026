#!/usr/bin/env node
// Reproducible browser coverage of the September 20 Figma baseline. No store injection.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3024'
const output = path.resolve(process.env.PMS_BROWSER_OUTPUT || 'output/playwright/figma-ui/final')
const selected = process.env.PMS_UI_SUITES?.split(',')
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 30000,
  executablePath: process.env.PMS_CHROME_EXECUTABLE || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
let page
const results = [], failures = [], errors = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const text = () => page.$eval('body', e => e.innerText)
const visibleText = async expected => assert.ok((await text()).includes(expected), `content includes ${expected}`)
const click = async (label, selector = 'button,[role="menuitem"],.ant-segmented-item-label,[role="tab"]') => {
  await page.waitForFunction(({ label, selector }) => [...document.querySelectorAll(selector)].some(e => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden' && e.textContent.replace(/\s+/g, '') === label.replace(/\s+/g, '')), { timeout: 7000 }, { label, selector })
  await page.evaluate(({ label, selector }) => {
    const e = [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden' && e.textContent.replace(/\s+/g, '') === label.replace(/\s+/g, ''))
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); e.click()
  }, { label, selector }); await wait(300)
}
const press = async selector => {
  await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(e => {
    const target=e.closest('.ant-radio-button-wrapper') || e
    return target.getBoundingClientRect().height > 0 && getComputedStyle(target).visibility !== 'hidden'
  }), {timeout:7000}, selector)
  await page.evaluate(selector => {
    const target=[...document.querySelectorAll(selector)].map(e=>e.closest('.ant-radio-button-wrapper') || e)
      .find(e=>e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden')
    target.scrollIntoView({block:'nearest',inline:'nearest'}); target.click()
  }, selector)
  await wait(300)
}
const closeModal = async () => {
  await press('.ant-modal:not([style*="display: none"]) .ant-modal-close')
  await page.waitForFunction(() => ![...document.querySelectorAll('.ant-modal')].some(e => e.getBoundingClientRect().height && getComputedStyle(e).visibility !== 'hidden'))
}
const capture = async (name, { screenshot = true, normalRows = false } = {}) => {
  await wait(250)
  const metrics = await page.evaluate(() => {
    const visible = e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden'
    const measure = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { text: e.innerText?.trim().slice(0, 70), x:r.x, y:r.y, width:r.width, height:r.height, font:s.fontSize, line:s.lineHeight, padding:s.padding, margin:s.margin, rowSpan:e.rowSpan || 1 } }
    const all = selector => [...document.querySelectorAll(selector)].filter(visible).map(measure)
    return { viewport:{width:innerWidth,height:innerHeight}, overflow:document.documentElement.scrollWidth-innerWidth,
      body:getComputedStyle(document.body).fontSize, headers:all('.pms-topbar'),
      mainPadding: document.querySelector('.pms-main-content') ? getComputedStyle(document.querySelector('.pms-main-content')).padding : null,
      controls:all('.ant-btn-primary:not(.ant-btn-icon-only),.ant-select-single,.ant-picker'),
      tags:all('.ant-tag'), cells:all('.ant-table-tbody tr:not(.ant-table-measure-row) > td,.pms-level1-horizontal-table tbody td,table[aria-label="一级计划横版"] tbody td').slice(0,150),tableHeaders:all('.ant-table-thead th,.pms-level1-horizontal-table th,table[aria-label="一级计划横版"] th'),
      rows:all('.ant-table-tbody tr:not(.ant-table-measure-row)').slice(0,100), ganttRows:all('.gantt_row'),
      wrappedCells:[...document.querySelectorAll('.ant-table-tbody tr:not(.ant-table-measure-row) > td')].filter(visible).flatMap(e=>[...e.children].filter(c=>c.getBoundingClientRect().height>32).map(c=>({text:c.textContent?.slice(0,70),contentHeight:c.getBoundingClientRect().height,rowHeight:e.getBoundingClientRect().height}))).slice(0,50),
      measureRows:[...document.querySelectorAll('.ant-table-measure-row')].map(measure) }
  })
  results.push({ name, ...metrics })
  if (screenshot) await page.screenshot({ path:path.join(output, `${name}.png`), captureBeyondViewport:false })
  assert.ok(metrics.overflow <= 1, `${name}: document overflow ${metrics.overflow}px`)
  assert.equal(metrics.body, '14px', `${name}: body14`)
  for (const h of metrics.headers) { assert.equal(h.height, 50, `${name}: header50`); assert.equal(h.padding.split(' ')[1], '32px', `${name}: header gutter32`) }
  if(metrics.mainPadding) assert.equal(metrics.mainPadding.split(' ')[1], '32px', `${name}: main gutter32`)
  for (const c of metrics.controls) assert.ok(Math.abs(c.height-32)<1, `${name}: control ${c.text} height ${c.height}`)
  for (const tag of metrics.tags) { assert.equal(tag.font, '12px', `${name}: tag font`); assert.equal(tag.height, 24, `${name}: tag ${tag.text} height`) }
  for (const header of metrics.tableHeaders) assert.equal(header.font,'14px',`${name}: table header14`);
  for (const cell of metrics.cells) assert.equal(cell.font, '14px', `${name}: table body ${cell.text}`)
  for (const row of metrics.rows) assert.ok(row.height>=40,`${name}: data rows at least40px`);
  for (const row of metrics.measureRows) assert.equal(row.height, 0, `${name}: sizing row stays0`)
  if (normalRows) assert.ok(metrics.rows.some(r => Math.abs(r.height-40)<1), `${name}: normal rows include40px`)
  console.log(`PASS ${name}: ${metrics.cells.length} cells, ${metrics.tags.length} tags, overflow ${metrics.overflow}`)
}
const form = async (name, {lowHeight=false}={}) => {
  await page.waitForFunction(()=>[...document.querySelectorAll('.ant-modal .ant-modal-body')].some(e=>e.getBoundingClientRect().height && getComputedStyle(e).visibility!=='hidden'))
  await capture(name)
  const m = await page.evaluate(() => {
    const modal=[...document.querySelectorAll('.ant-modal')].find(e=>e.getBoundingClientRect().height && getComputedStyle(e).visibility!=='hidden')
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}}
    const body=modal.querySelector('.ant-modal-body'),footer=modal.querySelector('.ant-modal-footer')
    return {footer:footer&&{...rect(footer),padding:getComputedStyle(footer).padding,gap:getComputedStyle(footer).gap},body:{...rect(body),padding:getComputedStyle(body).padding,paddingLeft:getComputedStyle(body).paddingLeft,paddingRight:getComputedStyle(body).paddingRight,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,overflow:getComputedStyle(body).overflowY},
      items:[...modal.querySelectorAll('.ant-form-item')].filter(e=>e.getBoundingClientRect().height && !e.parentElement.closest('.ant-form-item')).map(e=>({label:e.querySelector('label')?.textContent,margin:getComputedStyle(e).marginBottom,labelPadding:e.querySelector('.ant-form-item-label')&&getComputedStyle(e.querySelector('.ant-form-item-label')).paddingBottom,...rect(e),error:e.querySelector('.ant-form-item-explain-error')&&rect(e.querySelector('.ant-form-item-explain-error'))})),
      nativeMonthFields:[...modal.querySelectorAll('label')].filter(e=>/年.*月/.test(e.textContent) && e.parentElement.querySelector(':scope > .ant-input-number')).map(e=>({label:rect(e),control:rect(e.parentElement.querySelector(':scope > .ant-input-number'))})),
      grids:[...modal.querySelectorAll('.pms-project-info-form-grid,.pms-hr-version-form')].map(e=>({columns:getComputedStyle(e).gridTemplateColumns,gap:getComputedStyle(e).columnGap})),
      rows:[...modal.querySelectorAll('.ant-row')].map(e=>({gap:getComputedStyle(e).rowGap,columnGap:getComputedStyle(e).columnGap})), height:innerHeight}
  })
  results.push({name:`${name}-form`,...m})
  assert.ok(m.footer,`${name}: footer present`); assert.equal(m.footer.height,64,`${name}: footer64`)
  assert.equal(m.footer.gap,'16px',`${name}: footer gap16`); assert.equal(m.body.paddingLeft,'24px',`${name}: body left inset24px`); assert.equal(m.body.paddingRight,'24px',`${name}: body right inset24px`)
  for(const item of m.items) { assert.equal(item.margin,'12px',`${name}: ${item.label} margin12`); if(item.labelPadding) assert.equal(item.labelPadding,'4px',`${name}: label padding4`) }
  if(name.endsWith('monthly-edit') && !name.includes('capability')) assert.ok(m.nativeMonthFields.length>1,`${name}: native month fields measured`);
  for(const [index,field] of m.nativeMonthFields.entries()){ assert.equal(field.control.y-field.label.bottom,4,`${name}: month label gap4`); if(index>0) assert.equal(field.control.x-(m.nativeMonthFields[index-1].control.x+m.nativeMonthFields[index-1].control.width),16,`${name}: month horizontal gap16`) }
  for(const grid of m.grids) assert.equal(grid.gap,'16px',`${name}: horizontal form gap16`);
  if(lowHeight) { assert.ok(m.footer.bottom<=m.height,`${name}: footer in viewport`); assert.ok(m.body.scrollHeight>m.body.clientHeight,`${name}: long form scrolls internally`); assert.equal(m.body.overflow,'auto') }
  return m
}
const openProject = async (category,id) => {
  await click('项目管理','[role="menuitem"]')
  await page.waitForSelector('[aria-label="项目分类筛选"]')
  const found=await page.evaluate(category=>{const b=[...document.querySelectorAll('[aria-label="项目分类筛选"] button')].find(e=>e.textContent.trim().startsWith(category));b?.click();return !!b},category)
  assert.ok(found,`project category ${category}`); await wait(250)
  await press('[aria-label="卡片视图"]'); await press(`[aria-label="打开项目 ${id}"]`)
  await page.waitForSelector('[aria-label="项目空间导航"]')
}
const suite = async (name, run) => {
  if(selected && !selected.includes(name)) return
  const context=await browser.createBrowserContext(); page=await context.newPage(); await page.setViewport({width:1440,height:900,deviceScaleFactor:1}); page.setDefaultTimeout(10000)
  page.on('pageerror',e=>errors.push({suite:name,type:'pageerror',message:e.message}))
  page.on('console',e=>{if(e.type()==='error')errors.push({suite:name,type:'console',message:e.text()})})
  page.on('response',r=>{if(r.status()>=400)errors.push({suite:name,type:'http',status:r.status(),url:r.url()})})
  try { await page.goto(baseUrl,{waitUntil:'networkidle0'}); await run(); console.log(`SUITE PASS ${name}`) }
  catch(error) { failures.push({suite:name,error:error.message,body:await text().catch(()=>null)}); await page.screenshot({path:path.join(output,`FAIL-${name}.png`)}).catch(()=>{}); console.error(`SUITE FAIL ${name}: ${error.message}`) }
  finally { await context.close(); fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({baseUrl,results,failures,errors},null,2)) }
}
try {
  await suite('workbench',async()=>{ await visibleText('工作台'); await capture('workbench'); await press('[aria-label^="转维，"]'); await capture('workbench-transfer'); await click('项目组合管理','[role="menuitem"]'); await capture('portfolio') })
  await suite('project-management',async()=>{
    await click('项目管理','[role="menuitem"]'); await capture('project-list',{normalRows:true})
    for(const [w,h] of [[1280,800],[1920,1080],[1440,900]]) { await page.setViewport({width:w,height:h}); await capture(`project-list-${w}`,{normalRows:true}) }
    await press('[aria-label="卡片视图"]'); await capture('project-cards'); await press('[aria-label="日历视图"]'); await capture('project-calendar')
    await click('项目配置','.ant-segmented-item-label'); await visibleText('新项目'); await capture('project-config')
    const firstProject=await page.$eval('.pms-project-config tr[data-row-key]',e=>e.getAttribute('data-row-key'))
    await press('.pms-project-config .ant-pagination-next:not(.ant-pagination-disabled)')
    assert.notEqual(await page.$eval('.pms-project-config tr[data-row-key]',e=>e.getAttribute('data-row-key')),firstProject,'pagination changes visible projects')
    await capture('project-config-page2'); await press('.pms-project-config .ant-pagination-prev:not(.ant-pagination-disabled)')
    await page.type('input[aria-label="筛选项目名称"]','示例整机-独立跨年预算')
    await page.waitForFunction(()=>document.querySelectorAll('.pms-project-config tr[data-row-key]').length===1)
    await visibleText('示例整机-独立跨年预算');await capture('project-config-filtered');await click('清空筛选')
    await page.waitForFunction(()=>document.querySelectorAll('.pms-project-config tr[data-row-key]').length>1)
    await click('新项目'); await page.keyboard.press('Tab'); assert.ok(await page.evaluate(()=>!!document.activeElement?.closest('.ant-modal')),'keyboard focus is in modal'); const normal=await form('project-new'); assert.ok(normal.items.length>=4,'project formal form fields')
    await click('确认','.ant-modal-footer button'); await visibleText('请至少选择一位责任人'); const invalid=await form('project-new-errors')
    const gaps=invalid.items.filter(i=>i.error).map(i=>{const next=invalid.items.find(n=>n.y>i.y+1);return next?next.y-i.error.bottom:null}).filter(x=>x!==null)
    assert.ok(gaps.length>0,'validation errors measured'); for(const gap of gaps)assert.equal(gap,12,'error to next label12px')
    await closeModal()
  })
  for(const [category,id,key] of [['整机产品项目','1','machine'],['tOS版本项目','2','tos'],['技术项目','mock-tech-aios-v3','technical']]) await suite(`project-${key}`,async()=>{
    await openProject(category,id); await visibleText('基础信息'); await capture(`${key}-basic`)
    if(key==='machine') { await click('编辑'); await form('project-edit'); await page.setViewport({width:1280,height:800}); await form('project-edit-lowheight',{lowHeight:true}); await closeModal(); await page.setViewport({width:1440,height:900}) }
    await click('计划','[role="menuitem"]'); await capture(`${key}-plan-horizontal`)
    await press('[aria-label="竖版表格"]'); await capture(`${key}-plan-vertical`)
    await press('[aria-label="甘特图"]'); await page.waitForSelector('.gantt_grid_head_cell',{visible:true}); await capture(`${key}-plan-gantt`)
    await click('权限配置','[role="menuitem"]'); await visibleText('角色'); await capture(`${key}-permissions`)
  })
  await suite('plan-validation',async()=>{await openProject('整机产品项目','1');await click('计划','[role="menuitem"]');await press('[aria-label="竖版表格"]');const selector='input[aria-label="planEndDate STR4"]';await page.waitForSelector(selector,{visible:true});await page.$eval(selector,e=>{e.focus();e.select()});await page.keyboard.type('2020-01-01');await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Escape');await page.waitForSelector('.pms-cell-invalid',{visible:true});assert.equal(await page.$eval(selector,e=>e.value),'2020-01-01','invalid edited date stays visible');await capture('plan-invalid-date');const state=await page.$eval('.pms-cell-invalid',e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor}));results.push({name:'plan-invalid-style',...state});assert.notEqual(state.background,'rgba(0, 0, 0, 0)','invalid cell has visible background')})
  await suite('resources',async()=>{ await openProject('整机产品项目','1'); await click('资源','[role="menuitem"]'); await visibleText('项目资源看板'); await capture('resources-dashboard'); for(const label of ['年度预算','项目概算','项目预算','项目核算']) { await click(label); await capture(`resources-${label}`); await visibleText(label); if(label==='项目概算'){await click('新建版本');await form('resource-new-version');await click('创建版本','.ant-modal-footer button');await page.waitForSelector('.ant-form-item-explain-error',{visible:true});await form('resource-new-version-errors');await closeModal()} } })
  for(const [label,key] of [['整机产品项目','machine'],['tOS项目','tos'],['技术项目','technical'],['能力建设项目','capability']]) await suite(`hr-${key}`,async()=>{
    await click('人力资源管道','[role="menuitem"]'); await click(label,'.pms-hr-sidebar-leaf'); await visibleText('新建项目'); await capture(`hr-${key}-projects`)
    await click('新建项目'); await visibleText('项目配置'); await click('新项目'); await form(`hr-${key}-new-project`); await closeModal(); await click('人力资源管道','[role="menuitem"]'); await click(label,'.pms-hr-sidebar-leaf')
    await click('项目预估投入空间','.ant-segmented-item-label'); await visibleText('新增版本'); await capture(`hr-${key}-versions`); assert.ok(await page.$('.ant-table-tbody tr[data-row-key]'),'seeded HR versions rendered')
    await click('新增版本'); await form(`hr-${key}-new-version`); await closeModal()
    await press(key==='machine'?'button[aria-label="编辑版本"]':'button[aria-label="编辑"]'); await form(`hr-${key}-edit-version`); await closeModal()
    await click('项目月度预估投入','.ant-segmented-item-label'); await capture(`hr-${key}-monthly`); assert.ok(await page.$('.ant-table-tbody tr[data-row-key]'),'seeded HR monthly rows rendered')
    await press('.ant-table-tbody button:not([disabled]):has(.anticon-edit)'); await form(`hr-${key}-monthly-edit`); await closeModal()
  })
  await suite('hr-config',async()=>{await click('人力资源管道','[role="menuitem"]'); for(const [i,label] of ['tOS阶段投入比','品牌&产品线分摊比','模块与部门','TMG及技术领域','技术阶段投入比'].entries()){await click(label,'.pms-hr-sidebar-leaf');await capture(`hr-config-${i}`);await visibleText('新增')} await click('新增');await form('hr-config-new');await closeModal()})
  await suite('roadmap',async()=>{await click('tOS路标','[role="menuitem"]');await capture('roadmap');await click('版本演进视图');await capture('roadmap-evolution');await click('表单视图');await click('筛选');await page.waitForSelector('[aria-label="关闭筛选"]',{visible:true});await capture('roadmap-filter');await press('[aria-label="关闭筛选"]')})
  await suite('config',async()=>{await click('配置中心','[role="menuitem"]');await capture('config-template');await click('转维材料模板配置','.pms-config-navigation [role="menuitem"]');await click('转维材料','.pms-config-navigation [role="menuitem"]');await visibleText('交接资料');await capture('config-transfer');await click('枚举值配置','.pms-config-navigation [role="menuitem"]');await click('项目分类','.pms-config-navigation [role="menuitem"]');await visibleText('IPM项目分类');await capture('config-enums');await click('人力资源管道','.pms-config-navigation [role="menuitem"]');for(const [i,label] of ['整机人力模型','非人力资源科目','费率'].entries()){await click(label,'.pms-config-navigation [role="menuitem"]');await capture(`config-hr-${i}`);if(label==='费率'){await page.waitForSelector('input[role="spinbutton"]',{visible:true});assert.equal(await page.$eval('.ant-input-number',e=>e.getBoundingClientRect().height),32,'fee rate inline control32')}else{await visibleText('新增');if(label==='非人力资源科目'){await click('新增');await form('config-nonlabor-new');await closeModal()}}}})
  await suite('nonadmin',async()=>{await press('[aria-label="切换当前用户"]');await click('演示用户02','.pms-user-menu__name');await page.waitForFunction(()=>document.querySelector('[aria-label="切换当前用户"]')?.getAttribute('data-current-user')==='演示用户02');await openProject('整机产品项目','1');assert.equal(await page.$$eval('button',es=>es.find(e=>e.textContent.trim()==='编辑')?.disabled),true,'nonadmin basic edit denied');await capture('nonadmin-basic')})
  await suite('standalone',async()=>{await page.goto(`${baseUrl}/share/plan?projectId=mock-tech-aios-v3&technical=1&kind=tdt`,{waitUntil:'networkidle0'});await visibleText('TDR1');await capture('share-technical');await click('横版表格');await capture('share-horizontal');await click('甘特图');await page.waitForSelector('.gantt_grid_head_cell',{visible:true});await capture('share-gantt');for(const route of ['level1-template','level2-template']){await page.goto(`${baseUrl}/config/${route}`,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="配置菜单"]');await visibleText('计划模板配置');await capture(`standalone-${route}`)}})
} finally { await browser.close() }
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({baseUrl,results,failures,errors},null,2))
assert.deepEqual(failures.map(f=>({suite:f.suite,error:f.error})),[],'all selected suites pass')
assert.deepEqual(errors,[],'no browser runtime, console or HTTP errors')
console.log(`PASS ${results.length} Figma UI observations. Evidence: ${output}`)
