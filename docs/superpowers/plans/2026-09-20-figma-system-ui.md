# PMS Figma UI implementation plan

> For agentic workers: use superpowers:subagent-driven-development. User authorized implementation, testing and delivery on a new feature branch based on latest dev.

**Goal:** Apply the supplied Figma UI baseline across the existing PMS system while preserving business behavior.

**Architecture:** Retain Next.js 14, Ant Design 6, Zustand and existing routing. Update the owning theme and shared CSS, with scoped corrections to existing component styles. Portal content inherits tokens from the application root. Do not add another component library or change stores/data contracts.

**Spec:** `docs/design/figma-pms-20260920/UI规范.md` and `design-tokens.json`, copied unchanged from the referenced task 制定Figma系统UI规范.

## Global constraints

- Base: origin/dev at cf5706e5ab4adc8b790ece9f18c1a0e6ab5eff50. Branch: codex/feature-pms-figma-ui. Preserve the original dirty checkout.
- Exact sampled targets: primary #4D41FF; secondary #F0EFFF; white content surfaces; page gradient endpoints #F1EEFF/#ECF6FF; header 50px; desktop outer gutters 32px; main container padding/gap 12px, radius 16px; controls 32px, button radius 6px and padding-x 16px; data rows 40px; table cell padding-x 12px; tags 24px, 12px/16px, padding-x 8px; dialog footer 64px, padding-x 24px, gap 16px.
- Adopt sampled 14px table identifier/body scale for this refresh, superseding September 9's 12px table-body rule. Tags stay 12px, including inside tables. Single-line web body 14/20. Multi-line, merged cells and controls may grow rows without clipping. Sizing rows remain zero-height.
- New spec governs style conflicts. Preserve Chinese business labels, field names/order, permissions, edit guards, data and all domain behaviors. Do not mass-rewrite visible punctuation or mock identities to follow marketing-only skill rules.
- Figma source is light only. Keep a coherent light enterprise theme. Do not invent dark-mode designs, photography, marketing layouts or a new icon library.
- User follow-up: unify compact form spacing across all surfaces: field rows 12px, label/control 4px, related controls 8px, horizontal field gap 16px. Avoid doubled Form.Item margins plus Row gutters. Validation errors expand naturally.
- Unmeasured values are engineering proposals, not verified Figma values. Keep status semantics; use readable darker status text where measured borders would fail contrast.
- Cover main shell, workbench, project management/configuration, list/cards/calendar, project spaces and all plan modes, resources, HR, roadmap, permissions, transfer, standalone templates/share routes and overlays.
- No merge into dev/master and no production deployment in this task. Commit and push the feature branch after verification.

## Task 1: Shared visual system and page integration

**Files:** src/theme/pmsTheme.ts, src/styles/globals.css, src/app/layout.tsx, src/containers/AppShell.tsx; existing UI components with conflicting hardcoded visual styles; docs/prd/全系统UI规范.md; relevant existing visual contract scripts.

**Consumes:** sampled Figma values and existing PMS component APIs. **Produces:** unified PMS theme and existing CSS hooks with unchanged business APIs.

- [x] Audit existing token owners, density layers and component overrides; record old-to-new mapping and proposal decisions in docs/design/figma-pms-20260920/implementation.md.
- [x] Update owning tokens and Ant Design theme. Use `colorPrimary: PMS_COLORS.brandMain` with brandMain/brandStrong #4D41FF, card bodyPadding 12, button fontWeight 400, table cellFontSize 14 and body lineHeight 20/14. Scope html data-ui="figma-pms" for portal token inheritance if useful.
- [x] Correct shared controls, table text/tag exceptions and 40px data geometry. Keep fixed-column positioning, row spans, hidden sizing rows, error/edit backgrounds and Gantt timing geometry. Replace obsolete winning CSS rules instead of piling a parallel theme over them.
- [x] Integrate 50px header, matching sticky offsets, 32px gutters and 12px/16px white content containers. Apply main-container accent only to relevant outer surfaces; remove decorative lifting/glows from data containers and use restrained feedback on actual controls. Preserve source logo and navigation labels.
- [x] Normalize overlay footer and form group layout without resizing every dialog to 1199px. Keep low-height scroll and accessible focus. Normalize semantic tags with inset borders and 12px text.
- [x] Update old UI spec and existing visual-contract checks only where new requirements invalidate old style expectations; retain business assertions.
- [x] Run npx tsc --noEmit and targeted visual/logic scripts; inspect changes for unrelated modifications. Commit implementation and report exact commands/results and remaining concerns.

## Task 2: Browser verification and delivery

**Files:** screenshots/verify-figma-ui-browser.mjs, docs/reviews/2026-09-20-figma-ui.md, narrowly targeted fixes in task 1 files if verification finds defects.

**Consumes:** completed shared theme and unchanged UI navigation. **Produces:** reproducible browser evidence and completed feature branch.

- [x] Exercise real UI through visible navigation. Inspect workbench; project configuration/form validation, list/cards/calendar, filters/pagination/sorting; project information/plan horizontal/vertical/Gantt and editable invalid cells; project resources; HR configurations/versions/monthly views; roadmap/evolution; configuration and permission flows; transfer; share and standalone template routes.
- [x] At 1440x900 measure header 50px, gutters 32px, controls 32px, tags 24px/12px, normal single-line table data 40px, body 14px and no document overflow. Verify 1280x800 and 1920x1080 and a low-height modal. Preserve content-driven exceptions.
- [x] Capture screenshots and runtime/HTTP errors; visually inspect representative images. Check keyboard focus, cancel/close, error states and non-admin access.
- [x] Run npx tsc --noEmit, npm run build and relevant existing regressions. Fix failures from changed code; distinguish stale expectations and baseline defects using source evidence.
- [x] Obtain independent code review and resolve actionable findings. Update implementation and review evidence documents.
- [x] Commit final changes, push codex/feature-pms-figma-ui and verify remote SHA equals local HEAD. Report branch, commit, verification and unmeasured design differences.

## Acceptance record

Implementation through e951409, independent task and whole-branch reviews approved. Final production build and UI contracts pass;16 browser suites/122 observations,26 measured forms and complete transfer flow pass with no runtime errors. Detailed evidence and the two unchanged baseline audit incompatibilities: docs/reviews/2026-09-20-figma-ui.md. Delivery is the requested feature branch; no merge or production deployment.
