# Project creation permissions and completion reminders

**Goal:** Apply the requested project-attribute/type creation and registry-edit matrix, initialize space roles from the selected responsible people, and show persistent simulated Feishu completion reminders.

**Architecture:** Keep registry authority separate from project-space RBAC. A pure policy supplies UI options and mutation checks; formal creation authorizes the IPM-mapped category. Store a simulated notification snapshot with the successful creation audit, in the same project transaction. Existing histories are not backfilled with fictional sends.

**Stack:** Next.js, React, Ant Design, Zustand, TypeScript; existing Node behavioral verification scripts.

## Implementation and checks

- [x] Add `scripts/verify-project-creation-rules.mjs`; run it against the old implementation and observe a named manager's permitted creation fail. Cover all six scopes, wrong scopes, direct store calls, source-type spoofing, role initialization, unchanged space editing, notification recipients, failed creation, edits, and persistence.
- [x] Add `src/lib/projectRegistryPermissions.ts`: formal machine → 乔永峰/徐如秀（大圆）, tOS → 孙仁海/游进, technical → 邓伟俊/陈佩玲, capability → 游进; budget → 游进; roadmap → 王健（Jim）; global 管理组 bypass for valid scopes. Preserve delete/export and space permissions.
- [x] Apply the policy in `src/lib/projectRegistry.ts` and `src/stores/project.ts`. Filter project attributes, types and IPM source options in `NewProjectModal.tsx`; show project configuration to named managers in `ProjectManagementContainer.tsx`; check each row's edit scope in `ProjectConfiguration.tsx`. Add policy identities to the prototype switcher and creation selector, without changing fictional seed people.
- [x] Reuse existing responsible-person initialization and verify every selected person receives space 系统管理员 and the correct type role. The operator receives no implicit space membership.
- [x] Add `src/lib/projectCreationNotification.ts`; snapshot `status: 'simulated'`, recipient names, subject, body and creation time only for successful creations. Formal machine/tOS/technical target their initialized owner roles, budget targets 游进, roadmap targets 王健（Jim）. Capability has no reminder under this contract. Show the receipt after creation and inside project history.
- [x] Run `node scripts/verify-project-creation-rules.mjs`, existing registry/access/role/resource checks, `npx tsc --noEmit`, and `npm run build`. Manually create under named managers, confirm receipts and roles, test denied scopes and unchanged space access, and reload history.
- [ ] Review the diff; commit and push feature, merge/push dev then master, verify remote tree parity and Vercel's deployed commit, then exercise the deployed flow and check runtime errors.

User confirmed: selected form responsible people own the space roles; notifications are simulated and show recipient/content. No real Feishu requests are made.
