import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentPath = resolve('src/components/shared/FloatingConfigPopover.tsx');
const stylesPath = resolve('src/styles/globals.css');

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
