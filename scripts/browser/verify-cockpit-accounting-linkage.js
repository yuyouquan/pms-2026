// Pass this async function to playwright-cli run-code against the local production preview.
async page => {
  const errors = [], consoleErrors = [], report = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  const check = (value, message) => { if (!value) throw new Error(message) }
  const number = text => Number(text.replace(/,/g, '').match(/-?[\d.]+/)?.[0])
  const closeEnough = (a, b, precision, message) => check(Math.abs(a - b) < precision, `${message}: ${a} / ${b}`)
  await page.setViewportSize({ width: 1512, height: 982 }); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('http://127.0.0.1:3038/')
  await page.getByRole('menuitem', { name: '驾驶舱', exact: true }).click()
  await page.getByRole('button', { name: '重置筛选', exact: true }).click()
  const ranking = page.getByRole('region', { name: '项目核算排行', exact: true })
  await ranking.getByRole('radiogroup', { name: '核算排行项目类型', exact: true }).getByText('全部项目', { exact: true }).click()
  const today = (await page.locator('.cockpit-context').innerText()).match(/截至 (\d{4}-\d{2}-\d{2})/)[1]
  const setDates = async label => {
    const inputs = page.getByRole('textbox', { name: label, exact: true })
    await inputs.nth(0).fill(`${today.slice(0, 4)}-01-01`); await inputs.nth(0).press('Tab')
    await inputs.nth(1).fill(today); await inputs.nth(1).press('Enter')
  }
  const unit = async name => { await page.getByRole('radiogroup', { name: '统计单位', exact: true }).getByText(name, { exact: true }).click() }
  const department = async (label, name) => {
    await page.getByRole('combobox', { name: label, exact: true }).click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(name, { exact: true }).click()
    await page.keyboard.press('Escape')
  }
  const captureRanking = async () => await ranking.locator('li').evaluateAll(rows => rows.map(row => ({
    name: row.querySelector('.cockpit-project-link span').textContent,
    value: Number(row.querySelector('.cockpit-rank-value').textContent.replace(/,/g, '').match(/[\d.]+/)[0]),
    width: parseFloat(row.querySelector('.cockpit-rank-bar').style.width),
  })))
  await setDates('统计日期')
  for (const scope of ['all', '软件部']) {
    if (scope !== 'all') await department('二级部门', scope)
    await unit('人月'); const labor = await captureRanking()
    await unit('万元'); const cost = await captureRanking()
    check(labor.length === 4 && new Set(labor.map(row => row.value)).size === 4, `${scope}: refreshed distinct projects`)
    check(labor[0].width === 100 && labor.at(-1).width < 80, `${scope}: truthful relative bars`)
    closeEnough(number(await ranking.locator('.cockpit-ranking-total b').innerText()), cost.reduce((sum, row) => sum + row.value, 0), .25, 'cost ranking reconciles with total')
    await unit('人月')
    for (const row of labor) {
      const expectedCost = cost.find(item => item.name === row.name).value
      await ranking.getByRole('button', { name: `查看 ${row.name} 的项目资源`, exact: true }).click()
      await page.getByRole('region', { name: '资源总览', exact: true }).waitFor()
      await setDates('看板日期范围')
      if (scope !== 'all') await department('看板二级部门', scope)
      const actual = page.locator('article[aria-label="项目核算指标"]')
      closeEnough(number(await actual.locator('.pms-dashboard-metric-value span').innerText()), row.value, .001, `${scope}/${row.name}: project/cockpit labor`)
      closeEnough(number(await actual.locator('.pms-dashboard-metric-cost').innerText()), expectedCost, .051, `${scope}/${row.name}: project/cockpit cost`)
      await page.getByRole('tab', { name: '工时投入明细', exact: true }).click()
      const ledger = page.locator('div[aria-label="工时投入明细"]'), summary = await ledger.locator('.pms-dashboard-panel-head').innerText()
      const laborSum = Number(summary.match(/\/ ([\d.]+) 人月/)[1])
      closeEnough(laborSum, row.value, .051, `${scope}/${row.name}: ledger/ranking labor`)
      const visibleRows = await ledger.locator('tbody tr.ant-table-row').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent)))
      check(visibleRows.length > 0, 'real worklog rows are visible')
      for (const cells of visibleRows) {
        check(cells[0] <= today && cells[0] >= `${today.slice(0, 4)}-01-01`, 'same accounting date range')
        if (scope !== 'all') check(cells[3] === scope, 'same accounting department')
        closeEnough(number(cells[4]) / number(cells[5]), number(cells[6]), .00051, 'source-calendar person-month conversion')
      }
      report.push({ scope, project: row.name, labor: row.value, cost: expectedCost, ledger: summary })
      if (scope === 'all' && row === labor[0]) await page.screenshot({ path: 'output/playwright/cockpit-rank-refresh-project-resource.png', fullPage: true })
      await page.getByRole('button', { name: 'left 返回驾驶舱', exact: true }).click()
      closeEnough((await captureRanking()).find(item => item.name === row.name).value, row.value, .001, 'return preserves cockpit date/department context')
    }
  }
  await page.getByRole('button', { name: '重置筛选', exact: true }).click(); await unit('人月')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1920, 1512, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth)
    const styles = await ranking.evaluate(el => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      bars: [...el.querySelectorAll('.cockpit-rank-track')].map(track => {
        const bar = track.querySelector('.cockpit-rank-bar'), rect = track.getBoundingClientRect(), fill = bar.getBoundingClientRect()
        return { height: rect.height, radius: getComputedStyle(track).borderRadius, background: getComputedStyle(bar).backgroundImage, contained: fill.left >= rect.left - 1 && fill.right <= rect.right + 1 }
      }), zeroTicks: el.querySelectorAll('.cockpit-rank-zero').length }))
    check(!styles.overflow && styles.zeroTicks === 0 && styles.bars.every(bar => bar.height === 8 && parseFloat(bar.radius) > 4 && bar.background === 'none' && bar.contained), `${width}: rounded ranking style ${JSON.stringify(styles)}`)
    if ([1512, 390].includes(width)) await ranking.screenshot({ path: `output/playwright/cockpit-rank-refresh-${width}.png` })
  }
  await page.setViewportSize({ width: 1512, height: 982 }); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('tab', { name: '项目分类投入趋势', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  check(!errors.length && !consoleErrors.length, `runtime errors ${JSON.stringify({ errors, consoleErrors })}`)
  return { status: 'PASS', today, report, errors, consoleErrors }
}
