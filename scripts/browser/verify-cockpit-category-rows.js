// Pass this async function to playwright-cli run-code against the cockpit preview.
async page => {
  const errors = [], consoleErrors = [], report = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  await page.setViewportSize({ width: 1512, height: 982 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:3038/')
  await page.getByRole('menuitem', { name: '驾驶舱', exact: true }).click()
  const category = page.getByRole('tab', { name: '项目分类投入趋势', exact: true })
  await category.click()
  const panel = page.locator('.cockpit-trend-panel'), plot = panel.locator('.cockpit-echart')
  const settle = async () => { await plot.locator('svg').waitFor(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
  const unit = async name => { await page.getByRole('radiogroup', { name: '统计单位', exact: true }).getByText(name, { exact: true }).click(); await settle() }
  const grain = async name => { await panel.getByRole('radiogroup', { name: '趋势粒度', exact: true }).getByText(name, { exact: true }).click(); await settle() }
  const names = ['整机产品项目', 'tOS项目', '技术项目', '能力建设项目']
  for (const width of [1920, 1512, 1280, 1024, 768, 530, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 })
    for (const mode of ['人月', '万元']) {
      await unit(mode)
      for (const period of ['月', '周']) {
        await grain(period)
        const geometry = await panel.evaluate(el => {
          const svg = el.querySelector('.cockpit-category-chart svg'), box = svg.getBoundingClientRect()
          const texts = [...svg.querySelectorAll('text')].filter(text => text.textContent.trim()).map(text => ({ label: text.textContent, box: text.getBoundingClientRect() }))
          const overlaps = texts.flatMap((a, index) => texts.slice(index + 1).filter(b => Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 && Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1).map(b => [a.label, b.label]))
          const rows = [...el.querySelectorAll('.cockpit-category-labels button')].map(button => button.getBoundingClientRect())
          const lines = [...el.querySelectorAll('.cockpit-category-divider')].map(line => line.getBoundingClientRect())
          return { overlaps, textClipped: texts.filter(text => text.box.left < box.left - 1 || text.box.right > box.right + 1 || text.box.top < box.top - 1 || text.box.bottom > box.bottom + 1).map(text => text.label),
            labels: rows.length, separators: lines.length, separated: lines.every((line, index) => line.top > rows[index].bottom && line.bottom < rows[index + 1].top),
            pageOverflow: document.documentElement.scrollWidth > innerWidth, scrollerWidth: el.querySelector('.cockpit-category-scroll').clientWidth }
        })
        check(geometry.labels === 4 && geometry.separators === 3 && geometry.separated, `${width}/${mode}/${period}: four separated rows ${JSON.stringify(geometry)}`)
        check(!geometry.pageOverflow && !geometry.overlaps.length && !geometry.textClipped.length, `${width}/${mode}/${period}: readable labels ${JSON.stringify(geometry)}`)
        report.push({ width, mode, period, geometry })
      }
    }
  }
  await page.setViewportSize({ width: 1512, height: 982 }); await unit('人月'); await grain('月')
  // Every row, including the lower three, must select the same month coordinates.
  for (let index = 0; index < names.length; index++) {
    const box = await plot.boundingBox(), row = await panel.getByRole('button', { name: `隐藏${names[index]}`, exact: true }).boundingBox()
    await page.mouse.click(box.x + 48 + (box.width - 72) * (index + 0.5) / 12, row.y + row.height / 2)
    check((await panel.locator('.cockpit-chart-readout strong').innerText()) === `2026-0${index + 1}`, `${names[index]} selects its clicked month`)
    const summary = await panel.locator('.cockpit-chart-readout').innerText()
    check(names.every(name => summary.includes(name)), 'selected period retains all categories')
    await plot.press('Escape')
  }
  for (const name of names) await panel.getByRole('button', { name: `隐藏${name}`, exact: true }).click()
  check(await panel.getByText('暂无选中系列', { exact: true }).isVisible(), 'all hidden is empty')
  await panel.getByRole('button', { name: '显示全部系列', exact: true }).click(); await settle()
  await plot.focus(); await plot.press('Home'); for (let index = 0; index < 10; index++) await plot.press('ArrowRight'); await plot.press('Enter')
  check((await panel.locator('.cockpit-chart-readout').innerText()).includes('—'), 'future month remains absent')
  await page.getByRole('button', { name: /查看该期间/ }).click()
  check((await page.getByRole('button', { name: '查看项目核算来源明细', exact: true }).innerText()).includes('—'), 'future drill stays empty')
  await page.getByRole('button', { name: /^返回上级日期 / }).click(); await settle()
  await grain('周'); await plot.focus(); await plot.press('End'); await plot.press('Enter')
  check((await panel.locator('.cockpit-chart-readout strong').innerText()) === '2026-12-28', 'keyboard reaches final week')
  await plot.locator('svg text').filter({ hasText: /^12-28$/ }).waitFor()
  const dates = await plot.locator('svg text').allTextContents()
  check(dates.includes('12-28') && dates.includes('10-12') && !dates.includes('12-29'), 'week window follows keyboard across all rows')
  const zoomedBox = await plot.boundingBox(), lastRow = await panel.getByRole('button', { name: '隐藏能力建设项目', exact: true }).boundingBox()
  await page.mouse.click(zoomedBox.x + 48 + (zoomedBox.width - 72) * 0.5 / 12, lastRow.y + lastRow.height / 2)
  check((await panel.locator('.cockpit-chart-readout strong').innerText()) === '2026-10-12', 'lower row click uses zoomed absolute week index')
  await plot.press('Escape'); await grain('月')
  // Return to the default overview before checking the baseline full-screen composition.
  const clearScope = page.getByRole('button', { name: '清除部门范围筛选，使用默认范围', exact: true })
  if (await clearScope.count()) await clearScope.click()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.getByRole('button', { name: '全屏展示', exact: true }).click(); await settle()
  await page.locator('.cockpit-screen').evaluate(el => { el.scrollTop = 0 })
  const fit = await page.locator('.cockpit-screen').evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }))
  check(fit.scroll <= fit.height + 1, `fullscreen fits ${JSON.stringify(fit)}`)
  await page.screenshot({ path: 'output/playwright/cockpit-category-rows-fullscreen.png' })
  await page.getByRole('button', { name: '退出全屏', exact: true }).click()
  await page.setViewportSize({ width: 1512, height: 982 }); await settle()
  await panel.screenshot({ path: 'output/playwright/cockpit-category-rows-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 }); await settle()
  const scroll = panel.locator('.cockpit-category-scroll')
  const before = await panel.locator('.cockpit-category-labels').boundingBox()
  await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth }); await settle()
  const after = await panel.locator('.cockpit-category-labels').boundingBox()
  check(before.x === after.x, 'category names stay fixed during local horizontal scroll')
  await panel.screenshot({ path: 'output/playwright/cockpit-category-rows-mobile.png' })
  await page.setViewportSize({ width: 1512, height: 982 }); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('tab', { name: '资源管道总趋势', exact: true }).click(); await settle()
  check(await panel.getByRole('button', { name: '项目预算', exact: true }).count() === 1, 'resource legend is unchanged')
  await category.click(); await settle(); await page.evaluate(() => window.scrollTo(0, 0))
  check(!errors.length && !consoleErrors.length, `runtime ${JSON.stringify({ errors, consoleErrors })}`)
  return { status: 'PASS', report, fit, errors, consoleErrors }
}
