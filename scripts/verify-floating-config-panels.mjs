import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentPath = resolve('src/components/shared/FloatingConfigPopover.tsx');
const sortableColumnSettingsPath = resolve('src/components/shared/SortableColumnSettings.tsx');
const roadmapFilterPath = resolve('src/components/roadmap/RoadmapFilterDrawer.tsx');
const projectRoadmapModulePath = resolve('src/components/roadmap/ProjectRoadmapModule.tsx');
const stylesPath = resolve('src/styles/globals.css');
const sortableColumnSettingsCallers = [
  'src/app/share/plan/page.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/plans/RequirementDevPlan.tsx',
  'src/components/plans/VersionTrainPlan.tsx',
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/components/roadmap/RoadmapColumnSettingsDrawer.tsx',
  'src/containers/ConfigContainer.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
];

if (!existsSync(componentPath)) {
  throw new Error('missing FloatingConfigPopover');
}

const source = readFileSync(componentPath, 'utf8');
const styles = readFileSync(stylesPath, 'utf8');
const requiredPatterns = [
  /Popover/,
  /placement="bottomRight"/,
  /onOpenChange/,
  /getPopupContainer/,
  /\bariaLabel\b/,
  /aria-label=\{ariaLabel\s*\?\?/,
  /<section\s+className="pms-floating-config-panel"/,
  /<header\s+className="pms-floating-config-header">/,
  /<div\s+className="pms-floating-config-body">/,
  /<footer\s+className="pms-floating-config-footer">/,
];

for (const pattern of requiredPatterns) {
  if (!pattern.test(source)) {
    throw new Error(`FloatingConfigPopover is missing ${pattern}`);
  }
}

if (/\bDrawer\b/.test(source)) {
  throw new Error('FloatingConfigPopover must not use Drawer');
}

const sortableColumnSettingsSource = readFileSync(sortableColumnSettingsPath, 'utf8');
if (!/FloatingConfigPopover/.test(sortableColumnSettingsSource)) {
  throw new Error('SortableColumnSettings must use FloatingConfigPopover');
}
if (!/ariaLabel="列设置"/.test(sortableColumnSettingsSource)) {
  throw new Error('SortableColumnSettings must provide an accessible panel label');
}
if (/<Drawer\b/.test(sortableColumnSettingsSource)) {
  throw new Error('SortableColumnSettings must not render Drawer');
}

const roadmapFilterSource = readFileSync(roadmapFilterPath, 'utf8');
if (!/FloatingFilterPanel/.test(roadmapFilterSource)) {
  throw new Error('RoadmapFilterDrawer must use FloatingFilterPanel');
}
if (/\bDrawer\b/.test(roadmapFilterSource)) {
  throw new Error('RoadmapFilterDrawer must not use Drawer');
}

const projectRoadmapModuleSource = readFileSync(projectRoadmapModulePath, 'utf8');
if (!/onOpenFilters=\{\(\) => \{[\s\S]*?setColumnDrawerOpen\(false\)[\s\S]*?setFilterDrawerOpen\(true\)[\s\S]*?\}\}/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule must close column settings before opening filters');
}
if (!/onOpenColumnSettings=\{\(\) => \{[\s\S]*?setFilterDrawerOpen\(false\)[\s\S]*?setColumnDrawerOpen\(true\)[\s\S]*?\}\}/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule must close filters before opening column settings');
}
if (!/const getRoadmapPopupContainer = useCallback/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule must provide a stable roadmap popup container callback');
}
if (!/data-roadmap-shell/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule must mark the roadmap shell for popup lookup');
}
for (const componentName of ['RoadmapFilterDrawer', 'RoadmapColumnSettingsDrawer']) {
  const componentPattern = new RegExp(
    `<${componentName}\\b[\\s\\S]*?getPopupContainer=\\{getRoadmapPopupContainer\\}`,
  );
  if (!componentPattern.test(projectRoadmapModuleSource)) {
    throw new Error(`ProjectRoadmapModule must pass getPopupContainer to ${componentName}`);
  }
}

for (const callerPath of sortableColumnSettingsCallers) {
  const callerSource = readFileSync(resolve(callerPath), 'utf8');
  if (!/<SortableColumnSettings\b/.test(callerSource)) {
    throw new Error(`${callerPath} must render SortableColumnSettings`);
  }
  if (!/\btrigger=/.test(callerSource)) {
    throw new Error(`${callerPath} must pass the column-settings trigger`);
  }
  if (/<Tooltip\b[^>]*>\s*<SortableColumnSettings\b/s.test(callerSource)) {
    throw new Error(`${callerPath} must not wrap SortableColumnSettings directly in Tooltip`);
  }
}

const requiredStylePatterns = [
  /\.pms-floating-config-panel\s*\{[^}]*background:\s*#fff;/s,
  /\.pms-floating-config-header\s*\{[^}]*border-bottom:\s*1px solid #eef2f7;/s,
  /\.pms-floating-config-footer\s*\{[^}]*border-top:\s*1px solid #eef2f7;/s,
  /\.pms-floating-config-body\s*\{/,
];

for (const pattern of requiredStylePatterns) {
  if (!pattern.test(styles)) {
    throw new Error(`FloatingConfigPopover styles are missing ${pattern}`);
  }
}

console.log('FloatingConfigPopover source contract passed.');
