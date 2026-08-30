#!/usr/bin/env node
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = Number(process.env.PMS_BROWSER_TIMEOUT || 60_000)
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const TARGET_PROJECT = { projectId: '1', projectName: 'X6877-D8400_H991', category: '整机产品项目' }
const NON_TARGET_PROJECT = { projectId: '3', projectName: 'X6855_H8917', category: '整机产品项目' }
const PERMISSION_MATRIX = [
  { id: 'zhang-target', user: '张三', ...TARGET_PROJECT, accessible: true, canEditBasicInfo: true, canMaintainLevel1: true, canManageRoles: true },
  { id: 'zhang-non-target', user: '张三', ...NON_TARGET_PROJECT, accessible: true, canEditBasicInfo: true, canMaintainLevel1: true, canManageRoles: true },
  { id: 'qian-target', user: '钱九', ...TARGET_PROJECT, accessible: true, canEditBasicInfo: true, canMaintainLevel1: true, canManageRoles: true },
  { id: 'qian-non-target', user: '钱九', ...NON_TARGET_PROJECT, accessible: false, canEditBasicInfo: false, canMaintainLevel1: false, canManageRoles: false },
  { id: 'li-target', user: '李四', ...TARGET_PROJECT, accessible: true, canEditBasicInfo: false, canMaintainLevel1: false, canManageRoles: false },
  { id: 'li-non-target', user: '李四', ...NON_TARGET_PROJECT, accessible: false, canEditBasicInfo: false, canMaintainLevel1: false, canManageRoles: false },
]

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

const openMain = async (page, label) => {
  const deadline = Date.now() + TIMEOUT
  while (Date.now() < deadline) {
    const active = await page.evaluate(expected => (
      (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === expected
    ), label)
    if (active) return

    const clicked = await page.evaluate(expected => {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find(element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0
          && style.display !== 'none' && style.visibility !== 'hidden'
          && element.textContent?.trim() === expected
      })
      item?.click()
      return Boolean(item)
    }, label)
    if (clicked) {
      const activated = await page.waitForFunction(expected => (
        (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === expected
      ), { timeout: 900 }, label).then(() => true).catch(() => false)
      if (activated) return
    }
    await wait(120)
  }
  throw new Error(`main navigation did not activate ${label}`)
}

const returnToProjectList = async page => {
  const canReturn = await page.evaluate(() => [...document.querySelectorAll('button')].some(element => (
    element.getBoundingClientRect().height > 0 && element.textContent?.trim() === '返回项目列表'
  )))
  if (canReturn) await clickExact(page, '返回项目列表', 'button')
  else await openMain(page, '项目列表')
  await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true, timeout: TIMEOUT })
}

const selectProjectCategory = async (page, category) => {
  const clicked = await page.evaluate(expected => {
    const root = document.querySelector('[aria-label="项目分类筛选"]')
    const button = [...(root?.querySelectorAll('button') || [])].find(element => (
      element.getBoundingClientRect().height > 0 && element.textContent?.trim().startsWith(expected)
    ))
    button?.click()
    return Boolean(button)
  }, category)
  assert.equal(clicked, true, `project category ${category} exists`)
  await wait(250)
}

const prepareProjectCard = async (page, testCase, showAllProjects = false) => {
  await selectProjectCategory(page, testCase.category)
  await clickExact(page, '卡片视图', '[aria-label="卡片视图"]')
  if (showAllProjects) {
    const showAllButton = await page.$('[aria-label="切换为全部项目"]')
    if (showAllButton) {
      await showAllButton.click()
      await wait(250)
      await showAllButton.dispose()
    }
  }
  const selector = `[aria-label="打开项目 ${testCase.projectId}"]`
  await page.waitForSelector(selector, { visible: true, timeout: TIMEOUT })
  return selector
}

const openProject = async (page, testCase) => {
  const selector = await prepareProjectCard(page, testCase)
  assert.equal(await page.$eval(selector, element => element.getAttribute('aria-disabled')), 'false', `${testCase.id} project is accessible`)
  let entered = false
  for (let attempt = 0; attempt < 3 && !entered; attempt += 1) {
    await page.$eval(selector, element => element.click())
    entered = await page.waitForSelector('[aria-label="项目空间导航"]', { visible: true, timeout: 1_500 })
      .then(() => true)
      .catch(() => false)
  }
  assert.equal(entered, true, `${testCase.id} enters project space`)
  await page.waitForFunction(name => document.body.textContent?.includes(name), { timeout: TIMEOUT }, testCase.projectName)
}

const assertDeniedProject = async (page, testCase) => {
  const selector = await prepareProjectCard(page, testCase, true)
  assert.equal(await page.$eval(selector, element => element.getAttribute('aria-disabled')), 'true', `${testCase.id} project is inaccessible`)
  await page.$eval(selector, element => element.click())
  await wait(300)
  assert.equal(await page.$('[aria-label="项目空间导航"]'), null, `${testCase.id} cannot enter project space`)
  await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true, timeout: TIMEOUT })
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
  const errorCounts = { page: 0, console: 0, request: 0, http: 0 }
  page.on('pageerror', error => {
    errorCounts.page += 1
    errors.push(`pageerror: ${error.message}`)
  })
  page.on('console', message => {
    if (message.type() !== 'error') return
    errorCounts.console += 1
    errors.push(`console.error: ${message.text()}`)
  })
  page.on('requestfailed', request => {
    errorCounts.request += 1
    errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`)
  })
  page.on('response', response => {
    if (response.status() < 400) return
    errorCounts.http += 1
    errors.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`)
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT })
  await page.waitForFunction(() => (
    document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === '张三'
    && [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent?.trim() === '项目列表')
  ), { timeout: TIMEOUT })

  for (const testCase of PERMISSION_MATRIX) {
    console.log(`Running ${testCase.id}: ${testCase.user} / ${testCase.projectName}`)
    await returnToProjectList(page)
    await switchUser(page, testCase.user)
    if (testCase.user === '张三') {
      assert.match(await page.$eval('button[aria-label="切换当前用户"]', element => element.textContent || ''), /管理组/, `${testCase.id} keeps the global administrator badge`)
    }
    if (!testCase.accessible) {
      await assertDeniedProject(page, testCase)
      continue
    }
    await openProject(page, testCase)
    await assertProjectPermissions(page, testCase)
  }

  assert.deepEqual(errorCounts, { page: 0, console: 0, request: 0, http: 0 }, `raw browser error counts remain zero: ${JSON.stringify(errorCounts)}`)
  assert.deepEqual(errors, [], `browser error gate remains clean:\n${errors.join('\n')}`)
  console.log(`Project-manager browser permission matrix passed 6/6 with raw errors=${JSON.stringify(errorCounts)}.`)
} finally {
  await browser.close()
}
