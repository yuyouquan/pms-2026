# Liquid glass UI refresh browser evidence

Captured from the local Next.js development server at `http://localhost:3004` on 2026-08-06.

## Viewport coverage

- Workbench: 1024x768, 1440x900, and 1920x1080.
- Project list, whole-machine project basic information, editable level-1 plan, tOS roadmap, config center, level-1 template, level-2 template, and shared plan: 1440x900.

## Runtime checks

- The approved header gradient computed as `linear-gradient(106deg, rgb(93, 73, 246) 0%, rgb(117, 98, 255) 50%, rgb(173, 152, 238) 100%)`.
- Structured glass tool surfaces computed with a translucent white fill and `blur(14px) saturate(1.45)`.
- Dense tables and form/data surfaces retained solid white backgrounds.
- Document width matched the viewport at 1024, 1440, and 1920 for the checked main surfaces.
- Editable plan rows retained `data-row-key`, confirming Ant Design row props still pass through the sortable-row wrapper.
- Standalone level-1, level-2, and shared-plan routes rendered their theme root and data table.
- Browser console contained only existing Ant Design `Divider.type` and `Space.split` deprecation warnings; no new runtime exception was observed.

The screenshots are visual evidence only. Source-contract scripts and the production build remain the release gates.
