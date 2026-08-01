#!/usr/bin/env node

import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = 15_000
const ENUM_VALUE = '19.4.1'
const ENUM_LABEL = `tOS${ENUM_VALUE}`
const ENUM_STORAGE_KEY = 'pms-enum-values'
const PROJECT_STORAGE_KEY = 'pms-projects'
const PROJECT_NAME = 'Task5-Enum-History'
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const allowedWarnings = [
  'Warning: [antd: ConfigProvider] `autoInsertSpaceInButton` is deprecated. Please use `{ button: { autoInsertSpace: boolean }}` instead.',
  'Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.',
  'Warning: [antd: Drawer] `width` is deprecated. Please use `size` instead.',
]

const currentEnumEnvelope = includeThreePart => JSON.stringify({
  state: {
    valuesByType: {
      'tos-2-part': ['16.0', '17.2'],
      'tos-3-part': includeThreePart
        ? ['16.0.1', '17.2.0', ENUM_VALUE]
        : ['16.0.1', '17.2.0'],
    },
  },
  version: 1,
})

const historicalProjectEnvelope = JSON.stringify({
  state: {
    projects: [{
      id: '1', name: PROJECT_NAME, type: '整机产品项目', secondaryCategory: '整机-手机',
      status: '在研', progress: 65, leader: '张三', markets: ['OP'], androidVersion: 'Android 17',
      chipPlatform: 'MTK', spm: '张三', updatedAt: '刚刚', productLine: 'NOTE', productSeries: 'NOTE 60',
      marketName: 'NOTE 60', brand: 'TECNO', developMode: '自研', firstSaleTosVersionId: ENUM_VALUE,
      tosVersionName: ENUM_LABEL, tosVersion: ENUM_LABEL, projectCode: 'X6999', platform: 'D9999',
      productType: '新品', startRam: '8GB', versionType: 'Full', str5Date: '2027-01-01',
      launchDate: '2027-02-01', remark: '', healthStatus: 'normal', planStartDate: '', planEndDate: '',
      currentNode: 'STR2', fieldValues: { firstSaleTosVersion: ENUM_VALUE },
    }],
  },
  version: 3,
})

const seedStorage = async (page, { includeThreePart, includeHistoricalProject = false }) => {
  await page.evaluateOnNewDocument((enumKey, enumEnvelope, projectKey, projectEnvelope) => {
    localStorage.setItem(enumKey, enumEnvelope)
    if (projectEnvelope) localStorage.setItem(projectKey, projectEnvelope)
    else localStorage.removeItem(projectKey)
  }, ENUM_STORAGE_KEY, currentEnumEnvelope(includeThreePart), PROJECT_STORAGE_KEY, includeHistoricalProject ? historicalProjectEnvelope : '')
}

const clickExactText = async (page, selector, text) => {
  const clicked = await page.evaluate((candidateSelector, expected) => {
    const element = Array.from(document.querySelectorAll(candidateSelector))
      .find(candidate => {
        const rect = candidate.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (candidate.textContent || '').trim() === expected
      })
    if (!element) return false
    element.click()
    return true
  }, selector, text)
  if (!clicked) throw new Error(`missing visible ${selector} with text ${text}`)
  await wait(150)
}

const navigateMain = async (page, label) => {
  console.log(`  STEP navigate ${label}`)
  await clickExactText(page, '[role="menuitem"]', label)
}

const openFormSelect = async (page, label) => {
  console.log(`  STEP open form select ${label}`)
  const handle = await page.evaluateHandle(expected => {
    const item = Array.from(document.querySelectorAll('.ant-form-item'))
      .find(candidate => (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim() === expected)
    return item?.querySelector('input[role="combobox"]') || null
  }, label)
  const input = handle.asElement()
  if (!input) throw new Error(`missing form select for ${label}`)
  await input.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-select-item-option'))
    .some(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }))
}

const readVisibleOptions = async page => page.$$eval(
  '.ant-select-item-option',
  elements => elements.filter(element => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }).map(element => ({
    text: (element.textContent || '').trim(),
    disabled: element.classList.contains('ant-select-item-option-disabled')
      || element.getAttribute('aria-disabled') === 'true',
  })),
)

const selectVisibleOption = async (page, text) => {
  console.log(`  STEP select option ${text}`)
  const clicked = await page.evaluate(expected => {
    const option = Array.from(document.querySelectorAll(
      '.ant-select-item-option:not(.ant-select-item-option-disabled)',
    )).find(candidate => {
      const rect = candidate.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (candidate.textContent || '').trim() === expected
    })
    if (!option) return false
    option.click()
    return true
  }, text)
  if (!clicked) throw new Error(`missing selectable option ${text}`)
  await wait(200)
}

const openMachineCreateOptions = async page => {
  await navigateMain(page, '项目列表')
  console.log('  STEP open add-project modal')
  await clickExactText(page, 'button', '新增项目')
  await page.waitForFunction(() => {
    const modal = Array.from(document.querySelectorAll('.ant-modal'))
      .find(candidate => (candidate.textContent || '').includes('新增项目'))
    return Boolean(modal && !modal.querySelector('.ant-spin-spinning'))
  })
  await openFormSelect(page, '项目名')
  await selectVisibleOption(page, 'X6900-D8600_H1100（EXT-001）')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-form-item-label'))
    .some(element => (element.textContent || '').trim() === '首销 tOS 版本'))
  await openFormSelect(page, '首销 tOS 版本')
  return readVisibleOptions(page)
}

const openHistoricalEditOptions = async page => {
  await navigateMain(page, '项目列表')
  console.log(`  STEP open project ${PROJECT_NAME}`)
  const clicked = await page.evaluate(projectName => {
    const label = Array.from(document.querySelectorAll('*')).find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === projectName
    })
    let current = label
    while (current && current !== document.body) {
      if (getComputedStyle(current).cursor === 'pointer') {
        current.click()
        return true
      }
      current = current.parentElement
    }
    return false
  }, PROJECT_NAME)
  if (!clicked) throw new Error(`unable to open seeded project ${PROJECT_NAME}`)
  await page.waitForFunction(projectName => (document.body?.innerText || '').includes(projectName)
    && Array.from(document.querySelectorAll('button')).some(button => (button.textContent || '').trim() === '编辑'), {}, PROJECT_NAME)
  console.log('  STEP open project-info edit modal')
  await clickExactText(page, 'button', '编辑')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-modal-title'))
    .some(element => (element.textContent || '').trim() === '编辑项目信息'))
  await openFormSelect(page, '首销 tOS 版本')
  return readVisibleOptions(page)
}

const openRoadmapOptions = async page => {
  await navigateMain(page, '项目视图')
  console.log('  STEP open tOS roadmap')
  await clickExactText(page, 'button', 'tOS 路标视图')
  await page.waitForSelector('[aria-label="tOS 路标视图"]', { visible: true })
  console.log('  STEP open roadmap two-part select')
  const handle = await page.evaluateHandle(() => {
    const root = document.querySelector('[aria-label="表单视图 tOS 版本"]')
    return (root?.matches('input[role="combobox"]') ? root : root?.querySelector('input[role="combobox"]')) || null
  })
  const input = handle.asElement()
  if (!input) throw new Error('missing roadmap two-part combobox')
  await input.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-select-item-option'))
    .some(element => element.getBoundingClientRect().height > 0))
  return readVisibleOptions(page)
}

const runScenario = async (name, seed, exercise) => {
  console.log(`RUN ${name}`)
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const browserErrors = []
  page.setDefaultTimeout(TIMEOUT)
  page.setDefaultNavigationTimeout(TIMEOUT)
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error' && !allowedWarnings.includes(message.text())) {
      browserErrors.push(`console: ${message.text()}`)
    }
  })
  try {
    await seedStorage(page, seed)
    console.log('  STEP load app')
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT })
    await exercise(page)
    if (browserErrors.length) throw new Error(browserErrors.join('\n'))
    console.log(`PASS ${name}`)
  } catch (error) {
    const contextInfo = await page.evaluate(() => ({
      text: (document.body?.innerText || '').slice(0, 1600),
      url: location.href,
    })).catch(() => ({ text: 'unavailable', url: 'unavailable' }))
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}\nURL: ${contextInfo.url}\n${contextInfo.text}`)
  } finally {
    await context.close()
    await browser.close()
  }
}

try {
  await runScenario('A current three-part value appears in whole-machine create', {
    includeThreePart: true,
  }, async page => {
    const options = await openMachineCreateOptions(page)
    if (!options.some(option => option.text === ENUM_LABEL && !option.disabled)) {
      throw new Error(`current create option missing: ${JSON.stringify(options)}`)
    }
  })

  await runScenario('B deleted historical value stays disabled in project edit', {
    includeThreePart: false,
    includeHistoricalProject: true,
  }, async page => {
    const options = await openHistoricalEditOptions(page)
    const historical = options.find(option => option.text === `${ENUM_LABEL}（已停用）`)
    if (!historical?.disabled) throw new Error(`historical option missing or enabled: ${JSON.stringify(options)}`)
  })

  await runScenario('C deleted three-part value is absent from whole-machine create', {
    includeThreePart: false,
  }, async page => {
    const options = await openMachineCreateOptions(page)
    if (options.some(option => option.text.includes(ENUM_VALUE))) {
      throw new Error(`deleted create option remained: ${JSON.stringify(options)}`)
    }
  })

  await runScenario('D roadmap two-part choices ignore the three-part value', {
    includeThreePart: true,
  }, async page => {
    const options = await openRoadmapOptions(page)
    if (options.some(option => option.text.includes(ENUM_VALUE))) {
      throw new Error(`roadmap options were polluted: ${JSON.stringify(options)}`)
    }
  })

  console.log(`PASS task5 enum consumers browser (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL task5 enum consumers browser\n${error.stack || error}`)
  process.exitCode = 1
}
