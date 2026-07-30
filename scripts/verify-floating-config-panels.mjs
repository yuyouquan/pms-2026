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
const inlineFilterCallers = [
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
];
const summaryFilterCallers = inlineFilterCallers.slice(0, 2);

function getFloatingFilterProp(source, propName, nextPropName, callerPath) {
  const panelStart = source.indexOf('<FloatingFilterPanel');
  const propStart = source.indexOf(`${propName}=`, panelStart);
  const propEnd = source.indexOf(`${nextPropName}=`, propStart);
  if (panelStart < 0 || propStart < 0 || propEnd < 0) {
    throw new Error(`${callerPath} must provide bounded ${propName} and ${nextPropName} props`);
  }
  return source.slice(propStart, propEnd);
}

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
if (/\bimport\s*\{[^}]*\bDrawer\b[^}]*\}\s*from\s*['"]antd['"]/.test(roadmapFilterSource)
  || /<Drawer\b/.test(roadmapFilterSource)) {
  throw new Error('RoadmapFilterDrawer must not import or render Drawer');
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
if (!/if \(shell\?\.matches\(':fullscreen'\)\) return shell/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule must keep fullscreen popovers inside the roadmap shell');
}
if (/return triggerNode\.parentElement/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule normal popovers must not use the clipping toolbar parent');
}
if (!/return document\.body/.test(projectRoadmapModuleSource)) {
  throw new Error('ProjectRoadmapModule normal popovers must render under document.body');
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

for (const callerPath of inlineFilterCallers) {
  const callerSource = readFileSync(resolve(callerPath), 'utf8');
  if (!/<FloatingFilterPanel\b/.test(callerSource)) {
    throw new Error(`${callerPath} must render FloatingFilterPanel`);
  }
  if (/<Drawer\b[\s\S]{0,240}title="筛选条件"|title="筛选条件"[\s\S]{0,240}<Drawer\b/.test(callerSource)) {
    throw new Error(`${callerPath} must not render the filter UI in a Drawer`);
  }
}

for (const callerPath of summaryFilterCallers) {
  const callerSource = readFileSync(resolve(callerPath), 'utf8');
  const resetProp = getFloatingFilterProp(callerSource, 'onReset', 'onClear', callerPath);
  const clearProp = getFloatingFilterProp(callerSource, 'onClear', 'onCancel', callerPath);
  for (const [propName, propSource] of [['onReset', resetProp], ['onClear', clearProp]]) {
    if (/setMilestoneDateRange|setSharedRowsOverride/.test(propSource)) {
      throw new Error(`${callerPath} ${propName} must only update the filter draft`);
    }
  }
  if (!/\{!isFullscreen\s*&&\s*renderCurrentView\(\)\}/.test(callerSource)) {
    throw new Error(`${callerPath} must hide the background view while fullscreen`);
  }
  if ((callerSource.match(/\{renderCurrentView\(\)\}/g) ?? []).length !== 1) {
    throw new Error(`${callerPath} fullscreen Modal must keep exactly one current-view render`);
  }
  if (!/icon=\{isFullscreen\s*\?\s*<FullscreenExitOutlined\s*\/>\s*:\s*<FullscreenOutlined\s*\/>\}[\s\S]{0,240}onClick=\{\(\)\s*=>\s*\{[\s\S]*?setShowFilterDrawer\(false\)[\s\S]*?setShowColumnDrawer\(false\)[\s\S]*?setIsFullscreen\(true\)[\s\S]*?\}\}/.test(callerSource)) {
    throw new Error(`${callerPath} must close floating panels before entering fullscreen`);
  }
  if (!/open=\{isFullscreen\}[\s\S]{0,240}onCancel=\{\(\)\s*=>\s*\{[\s\S]*?setShowFilterDrawer\(false\)[\s\S]*?setShowColumnDrawer\(false\)[\s\S]*?setIsFullscreen\(false\)[\s\S]*?\}\}/.test(callerSource)) {
    throw new Error(`${callerPath} must close floating panels before leaving fullscreen`);
  }
}

const projectSpaceSource = readFileSync(resolve('src/containers/ProjectSpaceContainer.tsx'), 'utf8');
const projectSpaceResetProp = getFloatingFilterProp(
  projectSpaceSource,
  'onReset',
  'onClear',
  'src/containers/ProjectSpaceContainer.tsx',
);
if (!/setTempLevel1PlanFilters\(\s*\[\s*createFilterCondition\(\)\s*\]\s*\)/.test(projectSpaceResetProp)) {
  throw new Error('ProjectSpaceContainer onReset must restore the default empty condition');
}
if (/\bimport\s*\{[^}]*\bDrawer\b[^}]*\}\s*from\s*['"]antd['"]/.test(projectSpaceSource)
  || /<Drawer\b/.test(projectSpaceSource)) {
  throw new Error('ProjectSpaceContainer must not import or render Drawer');
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
