import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentPath = resolve('src/components/shared/FloatingConfigPopover.tsx');

if (!existsSync(componentPath)) {
  throw new Error('missing FloatingConfigPopover');
}

const source = readFileSync(componentPath, 'utf8');
const requiredPatterns = [
  /Popover/,
  /placement="bottomRight"/,
  /onOpenChange/,
  /getPopupContainer/,
];

for (const pattern of requiredPatterns) {
  if (!pattern.test(source)) {
    throw new Error(`FloatingConfigPopover is missing ${pattern}`);
  }
}

if (/\bDrawer\b/.test(source)) {
  throw new Error('FloatingConfigPopover must not use Drawer');
}

console.log('FloatingConfigPopover source contract passed.');
