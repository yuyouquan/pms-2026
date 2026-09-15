import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3048'
const session = process.env.PMS_BROWSER_SESSION || 'plan-audit-final'
const cli = process.env.PMS_PLAYWRIGHT_CLI || path.join(os.homedir(), '.codex/skills/playwright/scripts/playwright_cli.sh')
const output = path.resolve(process.env.PMS_BROWSER_OUTPUT || 'output/playwright/plan-roadmap-audit')
fs.mkdirSync(output, { recursive: true })
const results = []
const invoke = (name, args) => {
  const run = spawnSync(cli, ['--session', session, ...args], { encoding: 'utf8', timeout: 180000 })
  const log = `${run.stdout || ''}${run.stderr || ''}`
  fs.writeFileSync(path.join(output, `${name}.log`), log)
  if (run.error || run.status !== 0 || log.includes('### Error')) throw new Error(`${name} failed: ${run.error?.message || log}`)
  const match = log.match(/### Result\n([\s\S]*?)\n### Ran/)
  results.push({ name, result: match ? JSON.parse(match[1]) : 'passed' })
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ baseUrl, session, results }, null, 2))
  console.log(`PASS ${name}`)
}
const helpers = `
  const check = (value, message) => { if (!value) throw new Error(message) };
  const view = name => page.getByRole('radio', { name: new RegExp(name + '$') }).locator('xpath=ancestor::label').click();
  const openPlan = async (category, id) => {
    await page.getByRole('menuitem', { name: '项目管理', exact: true }).click();
    await view('卡片视图');
    await page.getByRole('button', { name: new RegExp('^' + category) }).click();
    await page.getByRole('button', { name: '打开项目 ' + id, exact: true }).click();
    await page.getByRole('menuitem', { name: 'calendar 计划', exact: true }).click();
  };
  const comparePlan = async (name, expectedStages) => {
    await view('竖版表格');
    const headers = await page.locator('.ant-table-thead th').allTextContents();
    const rows = await page.locator('.ant-table-tbody tr[data-row-key]').evaluateAll(els => els.map(e => [...e.querySelectorAll('td')].map(c => c.querySelector('input')?.value || c.innerText.trim() || '-')));
    check(headers.length === 9, name + ' must expose nine core columns');
    if (expectedStages) check(rows.filter(row => row[1].endsWith('阶段')).length === expectedStages, name + ' stage count');
    await view('甘特图');
    const ganttHeaders = await page.locator('.gantt_grid_head_cell').allTextContents();
    check(JSON.stringify(headers) === JSON.stringify(ganttHeaders), name + ' column parity');
    if (await page.locator('.gantt_ver_scroll').count()) await page.locator('.gantt_ver_scroll').evaluate(element => { element.scrollTop = 0 });
    await page.waitForFunction(firstId => [...document.querySelectorAll('.gantt_row')].some(row => row.querySelector('.gantt_cell')?.textContent.trim() === firstId), rows[0][0]);
    const observed = new Map();
    for (let scroll = 0; scroll < 2; scroll++) {
      const visible = await page.locator('.gantt_row').evaluateAll(els => els.map(e => [...e.querySelectorAll('.gantt_cell')].map(c => c.textContent.trim())));
      for (const row of visible) {
        check(JSON.stringify(rows.find(item => item[0] === row[0])) === JSON.stringify(row), name + ' row parity ' + JSON.stringify(row));
        observed.set(row[0], row);
      }
      if (await page.locator('.gantt_ver_scroll').count()) await page.locator('.gantt_ver_scroll').evaluate(element => { element.scrollTop = element.scrollHeight });
      await page.waitForFunction(lastId => [...document.querySelectorAll('.gantt_row')].some(row => row.querySelector('.gantt_cell')?.textContent.trim() === lastId), rows.at(-1)[0]);
    }
    check(observed.size === rows.length, name + ' all rows remain reachable');
    return { name, headers, rowCount: rows.length, firstRows: rows.slice(0, 3) };
  };
`
const step = (name, body) => invoke(name, ['run-code', `async (page) => { ${helpers}\n${body}\n}`])
invoke('open', ['open', baseUrl, '--headed'])
step('machine-columns-and-resize', `
  page.__pmsPlanAuditErrors = [];
  page.on('pageerror', error => page.__pmsPlanAuditErrors.push(error.message));
  await openPlan('整机产品项目', '1');
  const result = await comparePlan('machine', 5);
  const separator = page.getByRole('separator', { name: '调整计划表格与甘特图宽度' });
  const before = await page.locator('.gantt_task').boundingBox();
  const box = await separator.boundingBox();
  await page.mouse.move(box.x + 3, box.y + 100); await page.mouse.down();
  await page.mouse.move(box.x - 200, box.y + 100, { steps: 10 }); await page.mouse.up();
  const after = await page.locator('.gantt_task').boundingBox();
  check(after.width > before.width + 150, 'separator must expose more timeline');
  await page.screenshot({ path: ${JSON.stringify(path.join(output, 'machine-gantt.png'))} });
  return { ...result, timelineBefore: before.width, timelineAfter: after.width };
`)
step('draft-validation-and-autosave', `
  await view('竖版表格');
  const date = page.getByRole('textbox', { name: 'planEndDate 概念启动', exact: true });
  const original = await date.inputValue();
  await date.fill('2027-12-31'); await date.press('Enter');
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.getByText('任务校验不通过，无法发布', { exact: true }).waitFor();
  check(await date.inputValue() === '2027-12-31', 'failed publish retains draft input');
  await date.fill(original); await date.press('Enter');
  await page.getByRole('button', { name: 'left 返回项目管理', exact: true }).click();
  await page.getByRole('button', { name: '打开项目 1', exact: true }).click();
  await page.getByRole('menuitem', { name: 'calendar 计划', exact: true }).click();
  await view('竖版表格');
  check(await date.inputValue() === original, 'autosaved draft survives navigation');
  check(await page.getByRole('dialog').count() === 0, 'autosaved draft does not trigger an unsaved-form warning');
  return { invalidPublishBlocked: true, restoredDate: original, autosavedNavigation: true };
`)
step('tos-six-stages', `
  await page.getByRole('button', { name: 'left 返回项目管理', exact: true }).click();
  await openPlan('tOS版本项目', '2');
  const result = await comparePlan('tos', 6);
  check(result.firstRows.map(row => row[1]).join(',') === '规划阶段,规划KO,CDCP', 'tOS planning mock precedes concept');
  return result;
`)
step('technical-two-scopes', `
  await page.getByRole('button', { name: 'left 返回项目管理', exact: true }).click();
  await openPlan('技术项目', '9');
  const results = [await comparePlan('tdt', 5)];
  await page.getByRole('tab', { name: /^示例推理子项目计划/ }).click();
  results.push(await comparePlan('technical-subproject'));
  return results;
`)
step('roadmap-filters-and-navigation', `
  await page.getByRole('button', { name: 'left 返回项目管理', exact: true }).click();
  await page.getByRole('menuitem', { name: 'tOS路标', exact: true }).click();
  await view('表单视图'); await view('示例品牌B'); await view('老品');
  const rows = await page.locator('.ant-table-tbody tr[data-row-key]').allTextContents();
  check(rows.length === 1 && rows[0].includes('DEMO010'), 'form combines brand and product-type filters');
  await view('版本演进视图');
  check(await page.getByRole('article').count() === 1, 'evolution reuses form filters');
  await page.getByRole('article', { name: /DEMO010/ }).click();
  await page.getByRole('dialog').waitFor();
  check((await page.getByRole('dialog').innerText()).includes('DEMO010'), 'evolution project detail matches card');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await view('表单视图');
  await page.locator('.roadmap-table-project-name').filter({ hasText: 'DEMO010' }).click();
  await page.getByRole('button', { name: /返回tOS路标/ }).waitFor();
  check((await page.locator('body').innerText()).includes('DEMO010'), 'roadmap opens the corresponding project');
  return { matchedProject: 'DEMO010', bothViewFilters: true, projectNavigation: true };
`)
step('published-share-readonly', `
  await page.goto(${JSON.stringify(baseUrl)});
  await openPlan('整机产品项目', '1');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '分享计划', exact: true }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  check(url.includes('/share/plan?projectId=1&level=level1'), 'share copies the current project link');
  await page.goto(url);
  await page.getByText('已发布', { exact: true }).waitFor();
  check(!(await page.locator('body').innerText()).includes('修订中'), 'share hides draft versions');
  const columns = await page.locator('.ant-table-thead th').allTextContents();
  check(columns.length === 9, 'share uses current nine core columns');
  check(await page.getByText('点击填写', { exact: true }).count() === 0, 'shared dates never offer editing');
  check(await page.locator('.ant-picker').count() === 0, 'share contains no date editor');
  const cells = await page.locator('.ant-table-tbody td').allTextContents();
  check(!cells.includes('天'), 'missing durations never render only a unit');
  await view('甘特图');
  check(JSON.stringify(columns) === JSON.stringify(await page.locator('.gantt_grid_head_cell').allTextContents()), 'share list and Gantt columns match');
  check(await page.locator('.gantt_task_line.pms-gantt-task-editable').count() === 0, 'shared Gantt is readonly');
  await page.screenshot({ path: ${JSON.stringify(path.join(output, 'published-share.png'))} });
  const errors = page.__pmsPlanAuditErrors || [];
  check(errors.length === 0, 'browser runtime errors: ' + JSON.stringify(errors));
  return { url, columns, readonly: true, runtimeErrors: errors };
`)
console.log(JSON.stringify({ passed: true, output, steps: results.length }, null, 2))
