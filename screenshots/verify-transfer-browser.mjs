import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3017'
const output = path.resolve('output/audit-20260907/transfer-browser')
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 20000, executablePath: process.env.PMS_CHROME_EXECUTABLE || process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
const page = await browser.newPage()
await page.bringToFront()
await page.setViewport({ width: 1512, height: 1050, deviceScaleFactor: 1 })
page.setDefaultTimeout(30000)
const errors = []
const observations = []
page.on('pageerror', error => errors.push(error.message))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const clickText = async (text, selector = 'button') => {
  const found = await page.evaluate(({ text, selector }) => {
    const element = [...document.querySelectorAll(selector)].find(element => element.getBoundingClientRect().height && element.textContent?.replace(/\s+/g,'') === text.replace(/\s+/g,''))
    element?.click()
    return Boolean(element)
  }, { text, selector })
  assert.ok(found, `visible ${text}`)
  await wait(180)
}
const clickRowAction = async (id, text) => {
  const success = await page.evaluate(({id,text}) => {
    const row = [...document.querySelectorAll('#section-transfer tr[data-row-key]')].find(row => row.getAttribute('data-row-key') === id)
    const button = [...row.querySelectorAll('button')].find(button => button.textContent?.replace(/\s+/g,'') === text.replace(/\s+/g,''))
    button?.click(); return Boolean(button)
  }, {id,text})
  assert.ok(success, `${id} ${text}`)
  await wait(200)
}
const chooseTeamMember = async (side, role, name) => {
  const inputId = await page.evaluate(({side,role}) => {
    const card = [...document.querySelectorAll('.ant-card')].find(card => card.textContent?.trim().startsWith(side))
    const row = [...card.querySelectorAll(':scope > .ant-card-body > div')].find(row => row.querySelector('.ant-tag')?.textContent?.trim() === role)
    const input = row?.querySelector('input[role="combobox"]')
    input?.focus(); input?.click(); return input?.id
  }, {side,role})
  assert.ok(inputId, `${side} ${role} selector`)
  await page.keyboard.press('ArrowDown')
  await wait(120)
  const controls = await page.evaluate(id=>document.getElementById(id)?.getAttribute('aria-controls'),inputId)
  assert.ok(controls,'team selector controls a listbox')
  await page.waitForFunction(({controls,name}) => [...(document.getElementById(controls)?.closest('.ant-select-dropdown')?.querySelectorAll('.ant-select-item-option-content') || [])].some(element=>element.textContent?.trim()===name), {polling:100}, {controls,name})
  await page.evaluate(({controls,name}) => [...document.getElementById(controls).closest('.ant-select-dropdown').querySelectorAll('.ant-select-item-option-content')].find(element=>element.textContent?.trim()===name)?.click(),{controls,name})
  await page.mouse.click(100,85)
  await wait(250)
  const selected=await page.evaluate(({side,role,name})=>{
    const card=[...document.querySelectorAll('.ant-card')].find(card=>card.textContent?.trim().startsWith(side))
    const row=[...card.querySelectorAll(':scope > .ant-card-body > div')].find(row=>row.querySelector('.ant-tag')?.textContent?.trim()===role)
    return row?.textContent.includes(name)
  },{side,role,name})
  assert.ok(selected,`${side} ${role} selected ${name}`)
  console.log('Selected',side,role,name)

}
let screenshotsAvailable = process.env.PMS_BROWSER_SCREENSHOTS === '1'
const screenshot = async name => { if (!screenshotsAvailable) return; console.log('Screenshot',name); try { await page.screenshot({ path: path.join(output,`${name}.png`), captureBeyondViewport: false }); observations.push({ screenshot:`${name}.png` }) } catch(error) { screenshotsAvailable = false; observations.push({screenshotError:name,message:error.message}); console.error('Screenshot failed',name,error.message) } }
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle0' })
  await clickText('项目列表','[role="menuitem"]')
  await page.waitForSelector('[aria-label="卡片视图"]')
  await page.$eval('[aria-label="卡片视图"]', element => element.click())
  await page.waitForSelector('[aria-label="打开项目 1"]')
  await page.$eval('[aria-label="打开项目 1"]', element => element.click())
  await page.waitForSelector('[aria-label="项目空间导航"]')
  await clickText('基础信息','[role="menuitem"]')
  await page.waitForSelector('#section-transfer')
  observations.push({ initialRows: await page.$$eval('#section-transfer tr[data-row-key]', rows => rows.map(row=>({id:row.getAttribute('data-row-key'),text:row.textContent}))) })
  await clickText('申请转维')
  await page.waitForSelector('input[type="date"]')
  await page.$eval('input[type="date"]', input => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'2026-09-09'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})) })
  for (const [side,role,name] of [
    ['在研团队','SPM','演示用户01'],['在研团队','TPM','演示用户04'],['在研团队','SQA','演示用户07'],['在研团队','底软','演示用户08'],['在研团队','系统','演示外协03'],
    ['维护团队','SPM','演示用户02'],['维护团队','TPM','演示用户05'],['维护团队','底软','演示外协01'],['维护团队','系统','演示外协04'],
  ]) await chooseTeamMember(side,role,name)
  const chosenTeams = await page.$$eval('.ant-card',cards=>cards.filter(card=>['在研团队','维护团队'].some(side=>card.textContent.trim().startsWith(side))).map(card=>card.innerText))
  observations.push({chosenTeams})
  assert.ok(chosenTeams[1].includes('演示用户02') && chosenTeams[1].includes('演示用户05'),'maintenance team selections persisted in correct side')
  console.log('Team assignment ready')
  await clickText('提交申请')
  await page.waitForSelector('#section-transfer tr[data-row-key^="app-new-"]')
  const id = await page.$eval('#section-transfer tr[data-row-key^="app-new-"]', row=>row.getAttribute('data-row-key'))
  assert.equal(await page.$$eval('#section-transfer tr[data-row-key]',rows=>rows.filter(row=>row.getAttribute('data-row-key')?.startsWith('app-new-')).length),1)
  observations.push({applicationId:id,createdViaUI:true}); console.log('Application created',id)
  await clickRowAction(id,'详情')
  await page.waitForSelector(`tr[data-row-key^="cl_${id}_"]`)
  const checklistCount=await page.$$eval(`tr[data-row-key^="cl_${id}_"]`,rows=>rows.length)
  const reviewCount=await page.$$eval(`tr[data-row-key^="re_${id}_"]`,rows=>rows.length)
  assert.ok(checklistCount>0 && reviewCount>0,'new application has both sets of material rows')
  const firstRow=await page.$eval(`tr[data-row-key^="cl_${id}_"]`,row=>row.textContent)
  assert.ok(firstRow.includes('演示用户01') && firstRow.includes('未录入'), 'new material shows its assigned entry owner and empty state')
  assert.ok((await page.$eval('body',body=>body.innerText)).includes('转维负责人\n演示用户02'), 'detail project summary shows selected maintenance SPM')
  observations.push({checklistCount,reviewCount,firstRow})
  await page.$eval('#section-checklist',element=>element.scrollIntoView({block:'start'}))
  await screenshot('02-new-application-materials')
  await clickText('返回')
  await page.waitForSelector('#section-transfer')
  await clickRowAction(id,'录入')
  await page.waitForFunction(()=>document.body.textContent.includes('资料录入'),{polling:100})
  const roleActions = await page.$$eval('.ant-table-tbody tr[data-row-key]', rows => rows.map(row=>({role:row.cells[3]?.textContent,entry: [...row.querySelectorAll('button')].some(button=>button.textContent.trim()==='录入')})))
  assert.ok(roleActions.some(row=>row.role==='SPM' && row.entry))
  assert.ok(roleActions.every(row=>!row.entry || row.role==='SPM'),'only assigned SPM rows allow current actor to enter')
  observations.push({roleActions})
  await clickText('录入')
  await page.waitForSelector('.ant-modal textarea')
  await page.type('.ant-modal textarea','浏览器验证资料：本次申请独立录入。')
  await clickText('确认提交')
  await page.waitForFunction(()=>!document.querySelector('.ant-modal-wrap:not([style*="display: none"]) textarea'),{polling:100})
  const savedRow=await page.$eval(`tr[data-row-key^="cl_${id}_"]`,row=>row.textContent)
  assert.ok(savedRow.includes('浏览器验证资料：本次申请独立录入。') && savedRow.includes('已录入') && savedRow.includes('通过'), 'UI row shows saved content and successful entry/AI states')
  observations.push({entrySubmittedViaUI:true,savedRow})
  const style=await page.evaluate(()=>{
    const cell=document.querySelector('.ant-table-tbody td'),header=document.querySelector('.ant-table-thead th'),button=[...document.querySelectorAll('button')].find(element=>element.textContent.trim()==='返回')
    const tag=[...document.querySelectorAll('.ant-tag')].find(tag=>tag.textContent.trim()==='SPM');
    return {bodyFont:cell&&getComputedStyle(cell).fontSize,headerFont:header&&getComputedStyle(header).fontSize,buttonHeight:button&&button.getBoundingClientRect().height,pageOverflow:document.documentElement.scrollWidth>innerWidth,roleTag:tag&&{foreground:getComputedStyle(tag).color,background:getComputedStyle(tag).backgroundColor}}
  })
  observations.push({style})
  console.log('Assigned entry saved',style)
  await clickText('返回')
  await page.waitForSelector('#section-transfer')
  await clickRowAction(id,'关闭')
  await page.waitForSelector('.ant-modal textarea')
  await page.type('.ant-modal textarea','浏览器验证完成，关闭本次模拟申请。')
  await screenshot('04-close-confirmation')
  await page.$eval('.ant-modal-footer .ant-btn-primary',button=>button.click())
  await page.waitForFunction(id=>document.querySelector(`#section-transfer tr[data-row-key="${id}"]`)?.textContent.includes('已关闭'),{polling:100},id)
  observations.push({closedViaUI:true})
  await page.$eval('#section-transfer',element=>element.scrollIntoView({block:'start'}))
  await screenshot('05-closed-application')
  assert.deepEqual(errors,[])
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({baseUrl,observations,errors},null,2))
  console.log(JSON.stringify({passed:true,output,observations,errors},null,2))
} catch(error) {
  console.error('Transfer browser failure',error.message)
  await screenshot('failure').catch(()=>{})
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({baseUrl,error:error.message,observations,errors,body:await page.$eval('body',body=>body.innerText).catch(()=>null),teamDOM:await page.$$eval('.ant-card',cards=>cards.filter(card=>card.textContent.trim().startsWith('在研团队')).map(card=>card.outerHTML.slice(0,7500))).catch(()=>null)},null,2))
  throw error
} finally { await browser.close() }
