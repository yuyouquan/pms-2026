# Permission center execution record

Plan: docs/superpowers/plans/2026-09-28-permission-center.md
Base: f531a96071465253038ef8499bdc3cabfe865d3c
User authorized execution, full test/fix cycle, then feature commit on 2026-09-28.

Preflight:
| Tasks | Shared contract | Check |
| --- | --- | --- |
| 1 / 2 | Policy store, catalogue, role mutation | UI starts after final domain signatures are recorded |
| 1 / 3 | Menu checks and row/field projection | Consumers must use operation-specific grants |
| 2 / 3 | Header/page routing | Business integration preserves UI role management boundaries |
| 1 | Pure authorization + persistence | Behaviour tests cover invalid/multi-role input |
| 2 | UI and realtime updates | No save buttons; incomplete filters do not overwrite policies |
| 3 | Policy consumers | Filtering precedes aggregation/export; project RBAC stays |
| 4 | Verification and commit | User requested no commit until checks/fixes are complete |

Task 1: implemented. Controller reran `node scripts/verify-permission-center.mjs` successfully. Implementer also reports typecheck, global/project permission matrices, resource defaults and four project-type resource permissions passing. Consumer API recorded in `2026-09-28-permission-center-api.md`.

Task 2: UI/navigation implementation in progress. Browser baseline at localhost:3016 verified Header had no permission-center entry before changes.

Task 3: roadmap and project consumers being connected to the stable domain contract. Remaining global consumers (configuration/HR/legacy routes) follow the same menu catalogue.

Task 4: pending complete implementation. Do not infer final acceptance from partial checks.

Integration review items to resolve:
- Hydration must derive the legacy admin membership from the stable builtin role whenever the new model exists, matching mutation synchronization. Legacy read-only project-space consumers must not retain an independently stale admin slot.
- Align catalogue actions to live controls: joint plan currently has no export; transfer template and HR configuration tables have import/export controls. Preserve existing HR config edit and export access in explicit migration policies.
- Configuration actions must check their exact leaf, not any sibling through a broad legacy key.

Task 3 global-consumer implementation (2026-09-28):
- Config and HR navigation filter exact leaves in expanded/collapsed states, suppress revoked content, and choose an accessible fallback. Plan/MR, enum, HR configuration and transfer configuration actions check their actual leaf; async imports and confirmations re-check latest identity/authorization. HR and transfer configuration stores enforce final mutation authorization. Shared-plan links check project access and L1 viewing permission.
- Catalogue matches live controls (joint plan has no export; roadmap has no live baseline/share; transfer templates have import/export; HR tables have edit/import/export). Visible compatibility migration preserves previously public exports/HR edits, fee-rate legacy rights, and designated registry manager view/create/edit only. Persisted new models synchronize the legacy admin slot; malformed nested policies are dropped without broadening and structurally valid dynamic fields remain available for later registration.
- Numeric/date list conditions are accepted and typed comparisons preserve missing numeric data as missing. Enum full-reset takes an optional execution-time authorization callback and checks again after any pending hydration.
- Verified: `npx tsc --noEmit`; `node scripts/verify-permission-center.mjs`; `node scripts/verify-permission-center-global.mjs`; `npm run verify:transfer`; `npm run verify:hr-model` (26 assertions); `npm run verify:enum-config`; `npm run verify:enum-status`; `git diff --check`.
- Updated obsolete enum source-contract assertions to exact leaf/live authorization. Full branch regression, build and browser acceptance remain controller-owned. No commit.

## 最终收尾

最终产品代码类型检查、生产构建、浏览器验收及独立复审完成。全量171脚本中169首轮通过；两处测试合同修正后的完整脚本复测通过（路标142断言、资源默认权限9组），未解决失败为0。详细结果及浏览器场景见同目录 `2026-09-28-permission-center.md`；汇总JSON及最终截图保存在assets目录。依据用户授权提交feature，保持工作树，不推送、合并或部署。
