// Run this async function with playwright-cli run-code in an isolated browser session.
async page => {
  page.setDefaultTimeout(10000);
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const choose = async (input, label) => {
    await input.click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(label, {exact:true}).click();
  };
  const dialog = () => page.getByRole('dialog');
  const modalAction = async name => {
    await dialog().getByRole('button', {name, exact:true}).click();
    await dialog().waitFor({state:'hidden'});
  };
  await page.setViewportSize({width:1600, height:1000});
  await page.goto(page.url().split('/').slice(0,3).join('/') + '/');
  await page.getByRole('menuitem', {name:'工作台',exact:true}).click();
  const count = async () => Number((await page.getByRole('button', {name:/基础信息，/}).getAttribute('aria-label')).match(/\d+/)[0]);
  const before = await count();
  await page.getByRole('textbox', {name:'搜索待办'}).fill('示例整机-路标待补日期');
  const todoAction = page.getByRole('button', {name:'去填写 补全项目基础信息'});
  if (await todoAction.count()) {
    await todoAction.click();
    check((await dialog().innerText()).includes('编辑路标项目'), '路标待办打开原路标编辑弹窗');
    const required = await dialog().locator('.ant-form-item-required').count();
    check(required >= 10, '路标原创建字段标记为必填');
    for (const [id, value] of [['str5Date','2027-01-01'],['launchDate','2027-02-01']]) {
      await dialog().locator('#'+id).fill(value);
      await dialog().locator('#'+id).press('Enter');
      await dialog().getByText('时间与备注',{exact:true}).click();
    }
    await modalAction('保存修改');
    const nav = await page.getByRole('complementary',{name:'项目空间导航'}).innerText();
    check(nav.includes('基础信息') && nav.includes('权限配置') && !nav.includes('资源'), '路标空间只显示基础信息和权限配置');
    await page.getByRole('button',{name:'left 返回工作台'}).click();
    check(await count() === before-1, '路标补全保存后基础信息待办减一');
  }
  const expectedCount = await count();
  await page.getByRole('menuitem',{name:'项目管理',exact:true}).click();
  await page.getByText('项目配置',{exact:true}).click();
  const registry = page.getByRole('region',{name:'项目配置',exact:true});
  await registry.getByRole('button',{name:'plus 新项目'}).click();
  await choose(dialog().locator('#projectAttribute'),'预算项目');
  const name = `交互验收预算-${Date.now()}`, renamed = `${name}-已修改`;
  await dialog().locator('#name').fill(name);
  await choose(dialog().locator('#type'),'技术项目');
  await choose(dialog().locator('#responsiblePersons'),'演示用户01');
  await dialog().getByText('新增项目',{exact:true}).click();
  await modalAction('确认');
  await registry.getByRole('textbox',{name:'筛选项目名称',exact:true}).fill(name);
  await registry.getByRole('button',{name,exact:true}).waitFor();
  check((await registry.locator('tbody').innerText()).includes('技术项目'), '预算项目最小创建及项目名称模糊筛选');
  await page.getByRole('menuitem',{name:'工作台',exact:true}).click();
  check(await count() === expectedCount, '新建预算项目不生成基础信息待办');
  await page.getByRole('menuitem',{name:'项目管理',exact:true}).click();
  await page.getByText('项目配置',{exact:true}).click();
  const edit = async (projectName, field, value, confirm) => {
    await registry.getByRole('button',{name:`编辑${projectName}的${field}`,exact:true}).first().click();
    const input = registry.locator('input.pms-edit-input');
    await input.fill(value);
    await input.press('Tab');
    const text = await dialog().innerText();
    check(text.includes(projectName) && text.includes(field) && text.includes('修改前') && text.includes('修改后') && text.includes(value), `${field}失焦确认包含项目和前后值`);
    await modalAction(confirm ? '确认' : '取消');
  };
  await edit(name,'项目名称',renamed,false);
  check(await registry.getByRole('button',{name,exact:true}).count() === 1, '取消名称修改保留原值');
  await edit(name,'项目名称',renamed,true);
  await edit(renamed,'项目编码','QA-'+Date.now(),true);
  await registry.getByRole('button',{name:`编辑${renamed}的绑定正式项目`,exact:true}).first().click();
  await registry.locator('tbody').getByRole('combobox').click();
  const options = page.locator('.ant-select-dropdown:visible .ant-select-item-option');
  check(await options.count() > 0, '绑定选择器提供可用正式项目');
  const binding = await options.first().innerText();
  await options.first().click();
  await registry.getByRole('textbox',{name:'筛选项目名称',exact:true}).click();
  check((await dialog().innerText()).includes(binding), '绑定失焦确认展示目标正式项目名称');
  await modalAction('确认');
  await registry.getByRole('textbox',{name:'筛选绑定正式项目',exact:true}).fill(binding.slice(0,6));
  check(await registry.getByRole('button',{name:renamed,exact:true}).count() === 1, '绑定正式项目支持模糊筛选');
  await registry.getByRole('button',{name:'history 历史'}).click();
  const history = await dialog().innerText();
  check(history.includes('创建') && history.includes('项目名称') && history.includes('绑定'), '历史弹窗包含创建修改及绑定记录');
  await dialog().getByRole('button',{name:'Close'}).click();
  await dialog().waitFor({state:'hidden'});
  await registry.getByRole('button',{name:renamed,exact:true}).click();
  const budgetNav = await page.getByRole('complementary',{name:'项目空间导航'}).innerText();
  check(budgetNav.includes('资源') && budgetNav.includes('权限配置') && !budgetNav.includes('基础信息'), '预算空间只显示资源和权限配置');
  check(await page.getByText('项目预估投入',{exact:true}).count() > 0, '预算空间默认进入资源');
  check((await page.locator('[aria-label="项目属性"]').innerText()) === '预算项目', '项目空间头部展示项目属性');
  await page.getByRole('button',{name:'left 返回项目管理'}).click();
  await page.reload();
  await page.getByRole('menuitem',{name:'项目管理',exact:true}).click();
  await page.getByText('项目配置',{exact:true}).click();
  await registry.getByRole('textbox',{name:'筛选项目名称',exact:true}).fill(name);
  check(await registry.getByRole('button',{name:renamed,exact:true}).count() === 1, '刷新后保留新建名称编码及绑定记录');
  await registry.getByRole('button',{name:'delete 删除'}).click();
  check((await dialog().innerText()).includes(renamed), '删除确认包含项目名称');
  await modalAction('取消');
  check(await registry.getByRole('button',{name:renamed,exact:true}).count() === 1, '取消删除保留项目');
  await registry.getByRole('button',{name:'delete 删除'}).click();
  await modalAction('删除');
  check(await registry.getByRole('button',{name:renamed,exact:true}).count() === 0, '确认删除移除项目记录');
  await page.screenshot({path:'output/playwright/registry-workbench-complete.png'});
  check(errors.length === 0, '无浏览器运行时错误');
  return {checks:results.length, results, errors};
}
