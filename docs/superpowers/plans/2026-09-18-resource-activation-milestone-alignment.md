# Resource activation and milestone alignment follow-up

Base feature59a2ae7 (already released via master720c3cf). User reports activation/deactivation incorrect and requests milestone table values centered, then feature→dev→master→Vercel release. Existing protected dirty root must remain unchanged. Work only in dedicated feature-project-auto-scheduling worktree.

## Contract

- Per project and budget type, activating a version clears previous active version. Deactivation permits no active version. Viewing another tab never changes activation. Persist/rehydrate/cross-tab synchronization must preserve explicit deactivation. Locked business snapshots remain immutable; activation is a lifecycle control independent of data editability. Scope/RBAC remain enforced.
- Correct misleading/no-op UI behavior at the owning boundary after proving the reported failure; do not change intended activation semantics or reset data.
- Center screenshot milestone labels and dates, including displayed readonly values, whole-cell edit triggers and input dates. Preserve date validation, popup usability, existing hover/keyboard behavior, and resource investment table centering.

## Tasks

1. Independent agent investigates activation UI/store/sync/guard flow, establishes RED reproduction for concrete bug, implements smallest fix and focused tests. No CSS edits/build/server/browser/deployment; owns necessary lifecycle/UI logic and tests. Report to current SDD workspace. Clarification about exact user symptom remains pending; current expected contract above governs.
2. Controller fixes milestone center alignment CSS and verifies display/editor styles. No unnecessary implementation-mirroring test; existing render/date regression plus browser check if available.
3. Independent review; at least two rounds of logical/interaction verification, TypeScript/build. Browser via CUA only. Earlier Chrome automation was blocked by another extension UI; do not bypass/restart user browser or clear storage. If still blocked record exact missing live verification.
4. Commit/push feature, merge/push dev then master, verify trees and remote parity, wait exact master Vercel production READY and error checks, exercise live flow if tool resumes.
