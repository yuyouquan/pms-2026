#!/usr/bin/env node
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = Number(process.env.PMS_BROWSER_TIMEOUT || 60_000)
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const clickExact = async (page, text, selector = 'button,[role="menuitem"],span') => {
  const clicked = await page.evaluate(({ text, selector }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const element = [...document.querySelectorAll(selector)]
      .find(candidate => visible(candidate) && candidate.textContent?.trim() === text)
    const target = element?.closest('button,[role="menuitem"],.ant-segmented-item') || element
    target?.click()
    return Boolean(target)
  }, { text, selector })
  assert.equal(clicked, true, `visible control ${text} exists`)
  await wait(250)
}

const switchUser = async (page, user) => {
  const optionIsVisible = () => page.evaluate(name => {
    const option = [...document.querySelectorAll('.pms-user-menu__name')]
      .find(element => element.textContent?.trim() === name)
    if (!option) return false
    const rect = option.getBoundingClientRect()
    const style = getComputedStyle(option)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }, user)
  for (let attempt = 0; attempt < 3 && !(await optionIsVisible()); attempt += 1) {
    await page.$eval('button[aria-label="切换当前用户"]', button => button.click())
    await wait(400)
  }
  assert.equal(await optionIsVisible(), true, `user selector opens for ${user}`)
  const clicked = await page.evaluate(name => {
    const option = [...document.querySelectorAll('.pms-user-menu__name')]
      .find(element => element.textContent?.trim() === name)
    option?.closest('[role="menuitem"]')?.click()
    return Boolean(option)
  }, user)
  assert.equal(clicked, true, `${user} appears in the shared user selector`)
  await page.waitForFunction(name => (
    document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === name
  ), { timeout: TIMEOUT }, user)
}

const getEnabled = async (page, selector) => page.$eval(selector, element => (
  !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true'
))

const openTargetProject = async page => {
  await page.waitForSelector('[aria-label="打开项目 1"]', { visible: true, timeout: TIMEOUT })
  assert.equal(await page.$eval('[aria-label="打开项目 1"]', element => element.getAttribute('aria-disabled')), 'false', 'target project is accessible')
  await page.locator('[aria-label="打开项目 1"]').click()
  await page.waitForSelector('[aria-label="项目空间导航"]', { visible: true, timeout: TIMEOUT })
  await page.waitForFunction(() => document.body.textContent?.includes('X6877-D8400_H991'), { timeout: TIMEOUT })
}

const assertProjectPermissions = async (page, expected) => {
  await clickExact(page, '基础信息', '[role="menuitem"]')
  await page.waitForFunction(() => [...document.querySelectorAll('.pms-project-info-core-actions button')].some(button => (
    button.textContent?.trim() === '编辑'
  )), { timeout: TIMEOUT })
  const canEditBasicInfo = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.pms-project-info-core-actions button')]
      .find(candidate => candidate.textContent?.trim() === '编辑')
    return Boolean(button && !button.disabled)
  })
  assert.equal(canEditBasicInfo, expected.canEditBasicInfo, `${expected.user} basic-info edit permission`)

  await clickExact(page, '计划', '[role="menuitem"]')
  await page.waitForSelector('button[aria-label="创建修订"]', { visible: true, timeout: TIMEOUT })
  assert.equal(await getEnabled(page, 'button[aria-label="创建修订"]'), expected.canMaintainLevel1, `${expected.user} level-one maintenance permission`)

  await clickExact(page, '权限配置', '[role="menuitem"]')
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => {
    const rect = button.getBoundingClientRect()
    const style = getComputedStyle(button)
    return button.textContent?.trim() === '新增角色'
      && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }), { timeout: TIMEOUT })
  const canManageRoles = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => {
      const rect = candidate.getBoundingClientRect()
      const style = getComputedStyle(candidate)
      return candidate.textContent?.trim() === '新增角色'
        && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    return Boolean(button && !button.disabled)
  })
  assert.equal(canManageRoles, expected.canManageRoles, `${expected.user} project-role management permission`)
}

const browser = await puppeteer.launch({
  headless: process.env.PMS_BROWSER_HEADFUL !== '1',
  executablePath: process.env.PMS_CHROME_EXECUTABLE || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  page.setDefaultTimeout(TIMEOUT)

  const errors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
  })
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`))
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      errors.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`)
    }
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT })
  await page.waitForFunction(() => (
    document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === '张三'
    && [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent?.trim() === '项目列表')
  ), { timeout: TIMEOUT })

  await switchUser(page, '钱九')
  await clickExact(page, '项目列表', '[role="menuitem"]')
  await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true, timeout: TIMEOUT })
  await clickExact(page, '卡片视图', '[aria-label="卡片视图"]')
  await openTargetProject(page)
  await assertProjectPermissions(page, {
    user: '钱九',
    canEditBasicInfo: true,
    canMaintainLevel1: true,
    canManageRoles: true,
  })

  await switchUser(page, '李四')
  await assertProjectPermissions(page, {
    user: '李四',
    canEditBasicInfo: false,
    canMaintainLevel1: false,
    canManageRoles: false,
  })

  await switchUser(page, '张三')
  assert.match(await page.$eval('button[aria-label="切换当前用户"]', element => element.textContent || ''), /管理组/, '张三 keeps the global administrator badge')
  await assertProjectPermissions(page, {
    user: '张三',
    canEditBasicInfo: true,
    canMaintainLevel1: true,
    canManageRoles: true,
  })

  await switchUser(page, '钱九')
  await clickExact(page, '返回项目列表', 'button')
  await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true, timeout: TIMEOUT })
  if (await page.$('[aria-label="切换为全部项目"]')) {
    await page.locator('[aria-label="切换为全部项目"]').click()
    await wait(250)
  }
  await page.waitForSelector('[aria-label="打开项目 3"]', { visible: true, timeout: TIMEOUT })
  assert.equal(await page.$eval('[aria-label="打开项目 3"]', element => element.getAttribute('aria-disabled')), 'true', '钱九 cannot enter a non-target project as project manager')

  assert.deepEqual(errors, [], `browser error gate remains clean:\n${errors.join('\n')}`)
  console.log('Project-manager browser permission matrix passed with console/page/request/HTTP errors = 0.')
} finally {
  await browser.close()
}
