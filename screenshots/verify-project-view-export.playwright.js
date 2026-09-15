// Run with playwright-cli run-code in an isolated browser session.
async page => {
  page.setDefaultTimeout(10000);
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (ok, name) => { if (!ok) throw Error(name); results.push(name); };
  await page.getByRole('menuitem',{name:'项目管理',exact:true}).click();
  await page.getByText('项目视图',{exact:true}).click();
  for (const type of ['整机产品项目','tOS版本项目','技术项目','能力建设项目']) {
    await page.locator('[aria-label="项目分类筛选"] button').filter({hasText:new RegExp('^'+type)}).click();
    await page.getByText('列表视图',{exact:true}).click();
    if (type === '能力建设项目') {
      check(await page.getByText('该项目分类暂未配置',{exact:true}).isVisible(), '能力建设项目保留既有列表待配置空态');
      continue;
    }
    await page.locator('.pms-project-summary-table').waitFor({state:'visible'});
    check(!(await page.locator('.pms-project-summary-table').innerText()).includes('关联年度预算'), `${type}列表仅显示正式项目`);
    const headers = await page.locator('.pms-project-summary-table thead th').allTextContents();
    check(headers.length > 5, `${type}列表展示类型对应字段`);
    for (const view of ['卡片视图','日历视图','列表视图']) {
      await page.getByText(view,{exact:true}).click();
      check(await page.getByRole('tabpanel',{name:'项目视图',exact:true}).isVisible(), `${type}${view}可切换`);
    }
  }
  await page.locator('[aria-label="项目分类筛选"] button').filter({hasText:/^整机产品项目/}).click();
  await page.getByRole('textbox',{name:'快捷筛选-项目名称',exact:true}).fill('DEMOP24');
  await page.locator('.pms-project-summary-table tbody').getByText(/DEMOP24/).first().waitFor();
  check(!(await page.locator('.pms-project-summary-table tbody').innerText()).includes('DEMOP25'), '名称模糊筛选排除其他项目');
  const downloads = [];
  for (const [label, filename] of [['导出当前','project-current.xlsx'],['导出全部','project-all.xlsx']]) {
    await page.getByRole('button',{name:'export 导出',exact:true}).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('menuitem',{name:label,exact:true}).click();
    const download = await pending;
    await download.saveAs('output/playwright/'+filename);
    check((await download.failure()) === null, `${label}成功下载XLSX`);
    downloads.push({label,path:'output/playwright/'+filename,name:download.suggestedFilename()});
  }
  await page.getByRole('textbox',{name:'快捷筛选-项目名称',exact:true}).fill('');
  check(errors.length === 0,'无浏览器运行时错误');
  return {checks:results.length, results, downloads, errors};
}
