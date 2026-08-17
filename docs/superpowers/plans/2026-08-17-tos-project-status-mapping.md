# tOS Project Status Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify tOS project statuses across creation, the project list, and project-space basic information using the approved IPM-to-PMS mapping.

**Architecture:** Put the tOS mapping and status options in one focused library module. Creation maps source data before persistence, while list and basic-information controls consume the same PMS option set without changing other project categories.

**Tech Stack:** TypeScript, React 18, Next.js 14, Ant Design 6, Node verification scripts

---

### Task 1: Specify the tOS status contract

**Files:**
- Create: `scripts/verify-tos-project-status.mjs`
- Create: `src/lib/projectStatus.ts`

- [ ] Write a failing verification for the five mapping rows and the four PMS status options.
- [ ] Run `node scripts/verify-tos-project-status.mjs` and confirm it fails because the status module does not exist.
- [ ] Implement the minimal mapping and exported option constants.
- [ ] Re-run the verification and confirm the mapping assertions pass.

### Task 2: Connect creation, list, and basic information

**Files:**
- Modify: `src/data/externalProjectPool.ts`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/data/projects.ts`
- Test: `scripts/verify-tos-project-status.mjs`

- [ ] Extend the failing verification to require source-status mapping, tOS direct list filters, and the shared basic-information options.
- [ ] Run the verification and confirm the integration assertions fail.
- [ ] Map the selected IPM entry status into the create form and persist the mapped status.
- [ ] Replace the tOS aggregate list filters with direct PMS status filters.
- [ ] Use the shared tOS options in project-space basic information and normalize tOS Mock records.
- [ ] Re-run the verification and the existing workbench-list verification.

### Task 3: Full verification

**Files:**
- Modify: `package.json`

- [ ] Add `verify:tos-project-status` for repeatable verification.
- [ ] Run `npm run verify:tos-project-status` and `npm run verify:workbench-list`.
- [ ] Run `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- [ ] Inspect the final diff to confirm unrelated local changes remain untouched.
