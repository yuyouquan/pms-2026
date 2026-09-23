# 2026-09-23 转维模板 Mock 刷新验收

## 来源与映射

- 整机 CheckList：[飞书模板](https://transsioner.feishu.cn/wiki/Cm18w9qrfihvcgk5N9HcLoeNnnf?sheet=2GiwtP)，revision 550，A1:V200 完整读取，有效业务行 3–48，共 46 条，拆分后 51 条。
- tOS CheckList：[飞书模板](https://transsioner.feishu.cn/wiki/Cm18w9qrfihvcgk5N9HcLoeNnnf?sheet=C6sDbn)，revision 550，A1:U199 完整读取，有效业务行 3–28，共 26 条。
- 整机评审要素：[飞书模板](https://transsioner.feishu.cn/wiki/KyAWwCD1Qids59kazovcasCqnXc?sheet=zuUP66)，revision 2308，A1:V202 完整读取，有效业务行 3–14，共 12 条，拆分后 18 条。
- 依据源表明确的合并范围还原责任人：整机 G23:G35、G36:G43、G44:G46。未对普通空白单元格任意向下填充。
- CheckList 使用 A 序号、C 类型、D 评审要素→PMS 标准、G 责任人；评审要素使用 A 序号、C 类型、D 标准→PMS 评审要素、E 说明、H 责任人、J 备注。
- 多责任人按源顺序拆行，序号和标准不变。V-17 为测试、底软、系统三条。用户确认“开发”拆为底软、系统；tOS SPM/TPM 映射为 SPM/TPM。
- 保留源表 `V-013`；只裁剪字段首尾空白，保留内部换行与业务内容。源表没有 AI 检查规则，保持为空。
- 仅更新现有 PMS 模板字段；源表中已填写的项目交付件、自检结果和维护结论不冒充演示项目的实际资料。

## 更新范围

- 三份配置模板，以及 4 个整机演示申请的 CheckList、评审要素、人员分配、历史数量说明。
- 增加 tOS16.1 的专用演示申请，26 条 CheckList，无评审要素；仅 SPM/TPM。
- 配置与流程 Mock 共用模板源，申请创建、录入、维护审核、详情、终审、待办读取一致。
- 首次加载按上一发布版本完整数据指纹升级未修改的默认数据。手动导入保留为历史版本，新来源发布为当前版本；团队自定义、已编辑申请、草稿和历史均保留；不会清空 localStorage，不重复插入 tOS 申请。

## 自动验证

通过：
- `npx tsc --noEmit`
- `npm run build`
- `npm run verify:transfer`：业务/权限/委派/终审/导入导出与新模板检查。
- `node scripts/verify-transfer-template-refresh.mjs /tmp/pms-transfer-template-refresh/previous-state.json`：对本次修改前读取的实际旧状态检查完整升级、草稿与导入保护、幂等性。
- `node scripts/verify-mock-data-hygiene.mjs`：11 组；tOS 无评审要素的断言改为按项目类型验证。
- `npm run verify:todo-center`
- `git diff --check`

## 浏览器验收

生产构建运行于独立本地端口 3035，2026-09-23 使用内置浏览器：
- 整机配置 51 行；搜索“样机交接表”显示三责任人，序号和标准 rowspan=3，截图确认合并显示。
- 整机评审要素 18 行；V-013 rowspan=2；说明、备注与来源一致。
- tOS 配置 26 行，TPM 搜索显示 V-10/V-11/V-12 三项；tOS 菜单无评审要素。
- 从工作台转维待办打开 tOS16.1，SPM 录入页 23 项，SPM/TPM 角色状态完整，只有 CheckList。
- V-01 暂存实际输入，列表状态变为“暂存”；详情同步显示相同文本，右侧锚点无评审要素，转维页无左侧项目空间栏。
- 从待办打开整机维护审核，SPM CheckList 26 项、评审要素 6 项。对新增 V-12“评审结束后当天完成所有维护领域权限修改”执行审核通过并保存备注，行状态和备注正确更新。
- 以上操作浏览器 error 日志为空。本地 3027 已启动同一生产构建供用户查看。

补充回归：3027 的旧验收导入模板曾覆盖当前视图。现将新版来源发布为新的当前版本，原导入记录保留在版本历史；增加该状态的回归测试，避免“数据已改但用户仍看到旧模板”。
