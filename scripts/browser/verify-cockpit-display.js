// Pass this async function to playwright-cli run-code against the local cockpit preview.
async page => {
  const issues = [], results = [], runtimeErrors = [], consoleErrors = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  const check = (condition, label, evidence) => { if (!condition) issues.push({ label, evidence }) }
  await page.setViewportSize({ width: 1512, height: 982 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:3038/')
  await page.getByRole('menuitem', { name: '驾驶舱', exact: true }).click()
  await page.locator('.cockpit-trend-panel .cockpit-echart svg').waitFor()
  const settle = () => page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'))
  const close = async () => { const dialog = page.getByRole('dialog').filter({ visible: true }); await dialog.getByRole('button', { name: '关闭', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }) }
  const metrics = ['年度预算', '项目概算', '项目预算', '累至今日预估投入', '项目核算', '概算 → 预算偏差', '累至今日预算执行率', '全年执行率']
  for (const width of [1920, 1512, 1280, 1024, 768, 530, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 }); await settle()
    const main = await page.getByRole('main', { name: '驾驶舱', exact: true }).evaluate(el => {
      const textRect = element => { const range = document.createRange(); range.selectNodeContents(element); return range.getBoundingClientRect() }
      const pairs = [['.cockpit-donut-center strong', '.cockpit-donut-center span'], ['.cockpit-ranking-total > span', '.cockpit-ranking-total b']]
      return { overflow: el.scrollWidth - el.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
        gaps: pairs.map(([first, second]) => ({ first, gap: textRect(el.querySelector(second)).top - textRect(el.querySelector(first)).bottom })),
        clipped: [...el.querySelectorAll('.cockpit-metric')].flatMap(card => {
          const value = card.querySelector('.cockpit-metric-value'), bounds = textRect(value), outer = card.getBoundingClientRect()
          return bounds.left < outer.left || bounds.right > outer.right ? [card.textContent] : []
        }) }
    })
    check(main.overflow < 2 && main.pageOverflow < 2, `${width}: page contained`, main)
    check(main.clipped.length === 0, `${width}: headline text contained`, main.clipped)
    main.gaps.forEach(pair => check(pair.gap >= 4, `${width}: text breathing room ${pair.first}`, pair.gap))
    results.push({ width, main })
    if (![1512, 530, 320, 768].includes(width)) continue
    for (const mode of ['人月', '万元']) {
      await page.getByRole('radiogroup', { name: '统计单位', exact: true }).getByText(mode, { exact: true }).click()
      for (const metric of width === 768 ? ['累至今日预估投入', '累至今日预算执行率'] : metrics) {
        await page.getByRole('button', { name: `查看${metric}来源明细`, exact: true }).click(); await settle()
        const detail = await page.getByRole('dialog').filter({ visible: true }).evaluate(el => {
          const textRect = element => { const range = document.createRange(); range.selectNodeContents(element); return range.getBoundingClientRect() }
          const summary = el.querySelector('.cockpit-detail-summary'), group = summary.firstElementChild, label = textRect(group.querySelector('span')), value = textRect(group.querySelector('strong'))
          const sumBox = summary.getBoundingClientRect(), mainBox = group.getBoundingClientRect(), metaBox = summary.lastElementChild.getBoundingClientRect()
          const basis = [...el.querySelectorAll('.cockpit-detail-basis > span')].map(item => {
            const range = document.createRange(); range.selectNode(item.firstChild)
            return textRect(item.querySelector('b')).top - range.getBoundingClientRect().bottom
          })
          return { gap: value.top - label.bottom, valueContained: value.left >= sumBox.left + 10 && value.right <= sumBox.right - 10 && value.bottom <= sumBox.bottom - 10,
            groupsSeparate: mainBox.right <= metaBox.left || mainBox.bottom <= metaBox.top, overflow: el.querySelector('.ant-drawer-body').scrollWidth - el.querySelector('.ant-drawer-body').clientWidth, basis }
        })
        check(detail.gap >= 6, `${width}/${mode}/${metric}: summary label/value gap`, detail)
        check(detail.valueContained && detail.groupsSeparate && detail.overflow < 2, `${width}/${mode}/${metric}: detail contained`, detail)
        detail.basis.forEach(gap => check(gap >= 4, `${width}/${mode}/${metric}: ratio basis gap`, gap))
        results.push({ width, mode, metric, detail })
        if (mode === '人月' && metric === '累至今日预估投入' && [1512, 530, 320].includes(width)) await page.screenshot({ path: `output/playwright/cockpit-display-source-${width}.png` })
        await close()
      }
    }
  }
  for (const width of [1512, 768, 530, 390, 320]) {
    await page.setViewportSize({ width, height: 982 })
    await page.getByRole('button', { name: /^资源总览明细/ }).click(); await settle()
    await page.getByRole('tab', { name: '项目总览', exact: true }).click()
    const overview = await page.getByRole('dialog').filter({ visible: true }).evaluate(el => {
      const outer = el.getBoundingClientRect(), body = el.querySelector('.ant-drawer-body')
      return { overflow: body.scrollWidth - body.clientWidth, searchWidth: el.querySelector('.cockpit-project-search').getBoundingClientRect().width,
        clipped: [...el.querySelectorAll('.cockpit-tabs button,.cockpit-panel-tools .ant-select,.cockpit-project-lens .ant-segmented-item')].flatMap(control => {
          const rect = control.getBoundingClientRect(); return rect.right > outer.right - 8 || rect.left < outer.left + 8 ? [control.textContent] : []
        }) }
    })
    check(overview.overflow < 2 && !overview.clipped.length && overview.searchWidth >= 160, `${width}: overview controls readable`, overview)
    await page.screenshot({ path: `output/playwright/cockpit-display-overview-${width}.png` }); await close()
    await page.getByRole('button', { name: /^月度明细/ }).click(); await settle()
    const monthly = await page.getByRole('dialog').filter({ visible: true }).evaluate(el => {
      const body = el.querySelector('.ant-drawer-body'), table = el.querySelector('.cockpit-table-scroll')
      return { overflow: body.scrollWidth - body.clientWidth, tableScroll: table.scrollWidth > table.clientWidth }
    })
    check(monthly.overflow < 2 && monthly.tableScroll, `${width}: monthly ledger scroll stays local`, monthly)
    results.push({ width, overview, monthly }); await close()
  }
  await page.setViewportSize({ width: 1512, height: 982 }); await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.evaluate(() => window.scrollTo(0, 0))
  check(runtimeErrors.length === 0, 'runtime errors', runtimeErrors); check(consoleErrors.length === 0, 'console errors', consoleErrors)
  if (issues.length) throw new Error(JSON.stringify({ status: 'FAIL', issues, runtimeErrors, consoleErrors }))
  return { status: 'PASS', issues, results, runtimeErrors, consoleErrors }
}
