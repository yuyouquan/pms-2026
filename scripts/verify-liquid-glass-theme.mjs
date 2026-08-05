import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const BRAND_HEX_LITERALS = ['#5d49f6', '#7562ff', '#ad98ee', '#f5f3ff', '#dcd6ff']
const BRAND_HEX_PATTERN = new RegExp(`(?:${BRAND_HEX_LITERALS.join('|')})\\b`, 'gi')
const THEME_SOURCE = 'src/theme/pmsTheme.ts'
const CSS_SOURCE = 'src/styles/globals.css'

// Task 4 removes these migration-baseline exceptions when the roadmap is migrated.
const ROADMAP_BASELINE_EXCEPTIONS = {
  'src/components/roadmap/MilestoneView.tsx': { literal: '#f5f3ff', count: 1 },
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx': { literal: '#f5f3ff', count: 2 },
}

function read(file, root) {
  const target = path.join(root, file)
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
}

function normalizeRepoPath(file) {
  return file.replaceAll('\\', '/')
}

function sourceFiles(dir, root) {
  const target = path.join(root, dir)
  if (!fs.existsSync(target)) return []

  return fs.readdirSync(target, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = path.posix.join(normalizeRepoPath(dir), entry.name)
      if (entry.isDirectory()) return sourceFiles(relativePath, root)
      return /\.tsx?$/.test(entry.name) ? [relativePath] : []
    })
}

function rawBrandFailures(root) {
  const failures = []

  for (const file of sourceFiles('src', root)) {
    const normalizedFile = normalizeRepoPath(file)
    if (normalizedFile === THEME_SOURCE) continue

    const literals = [...read(normalizedFile, root).matchAll(BRAND_HEX_PATTERN)]
      .map((match) => match[0].toLowerCase())
    if (literals.length === 0) continue

    const uniqueLiterals = [...new Set(literals)]
    const exception = ROADMAP_BASELINE_EXCEPTIONS[normalizedFile]
    if (!exception) {
      failures.push(`${normalizedFile}: forbidden raw PMS brand literal(s): ${uniqueLiterals.join(', ')}`)
      continue
    }

    const invalidLiteral = uniqueLiterals.some((literal) => literal !== exception.literal)
    if (invalidLiteral || literals.length !== exception.count) {
      failures.push(
        `${normalizedFile}: baseline allows exactly ${exception.count} ${exception.literal}; found ${literals.length} (${uniqueLiterals.join(', ')})`,
      )
    }
  }

  return failures
}

function expectContentPatterns(failures, file, contents, expectations) {
  for (const { label, pattern } of expectations) {
    if (!pattern.test(contents)) {
      failures.push(`${file} is missing ${label}`)
    }
  }
}

function expectPatterns(failures, root, file, expectations) {
  expectContentPatterns(failures, file, read(file, root), expectations)
}

function expectNoMatches(failures, root, file, expectations) {
  const contents = read(file, root)
  for (const { label, pattern } of expectations) {
    if (pattern.test(contents)) {
      failures.push(`${file} must not include ${label}`)
    }
  }
}

function extractRootBlock(css) {
  let rootStart = -1
  let openingBrace = -1
  let quote = null
  let inComment = false

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (css.startsWith(':root', index)) {
      const rootDeclaration = /^:root\s*\{/.exec(css.slice(index))
      if (rootDeclaration) {
        rootStart = index
        openingBrace = index + rootDeclaration[0].lastIndexOf('{')
        break
      }
    }
  }

  if (rootStart === -1) {
    return { error: 'is missing a :root block' }
  }

  let depth = 0
  quote = null
  inComment = false

  for (let index = openingBrace; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          rootBlock: css.slice(rootStart, index + 1),
          outsideRoot: `${css.slice(0, rootStart)}${css.slice(index + 1)}`,
        }
      }
    }
  }

  return { error: 'has an unclosed :root block' }
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

const CSS_ROOT_EXPECTATIONS = [
  { label: '--pms-brand-strong token', pattern: /^\s*--pms-brand-strong:\s*#5d49f6;$/im },
  { label: '--pms-brand token', pattern: /^\s*--pms-brand:\s*#7562ff;$/im },
  { label: '--pms-brand-soft token', pattern: /^\s*--pms-brand-soft:\s*#ad98ee;$/im },
  { label: '--pms-brand-surface token', pattern: /^\s*--pms-brand-surface:\s*#f5f3ff;$/im },
  { label: '--pms-brand-border token', pattern: /^\s*--pms-brand-border:\s*#dcd6ff;$/im },
  { label: 'approved brand gradient', pattern: /^\s*--pms-gradient-brand:\s*linear-gradient\(106deg,\s*#5d49f6\s+0%,\s*#7562ff\s+50%,\s*#ad98ee\s+100%\);$/im },
  { label: '--pms-page token', pattern: /^\s*--pms-page:\s*#f4f6fb;$/im },
  { label: '--pms-surface-solid token', pattern: /^\s*--pms-surface-solid:\s*#fff;$/im },
  { label: '--pms-surface-glass token', pattern: /^\s*--pms-surface-glass:\s*rgb\(255\s+255\s+255\s*\/\s*76%\);$/im },
  { label: '--pms-text-primary token', pattern: /^\s*--pms-text-primary:\s*#27243a;$/im },
  { label: '--pms-text-secondary token', pattern: /^\s*--pms-text-secondary:\s*#625d70;$/im },
  { label: '--pms-text-tertiary token', pattern: /^\s*--pms-text-tertiary:\s*#817b90;$/im },
  { label: '--pms-border token', pattern: /^\s*--pms-border:\s*#e6e3ef;$/im },
  { label: '--pms-radius-control token', pattern: /^\s*--pms-radius-control:\s*8px;$/im },
  { label: '--pms-radius-surface token', pattern: /^\s*--pms-radius-surface:\s*12px;$/im },
  { label: '--pms-glass-filter token', pattern: /^\s*--pms-glass-filter:\s*blur\(14px\)\s+saturate\(145%\);$/im },
  { label: '--pms-shadow-glass token', pattern: /^\s*--pms-shadow-glass:\s*0\s+12px\s+32px\s+rgb\(75\s+59\s+148\s*\/\s*8%\);$/im },
  { label: '--pms-shadow-floating token', pattern: /^\s*--pms-shadow-floating:\s*0\s+22px\s+60px\s+rgb\(79\s+62\s+158\s*\/\s*12%\);$/im },
  { label: '--primary compatibility mapping', pattern: /^\s*--primary:\s*var\(--pms-brand-strong\);$/m },
  { label: '--accent compatibility mapping', pattern: /^\s*--accent:\s*var\(--pms-brand\);$/m },
  { label: '--text-primary compatibility mapping', pattern: /^\s*--text-primary:\s*var\(--pms-text-primary\);$/m },
  { label: '--bg-primary compatibility mapping', pattern: /^\s*--bg-primary:\s*var\(--pms-page\);$/m },
  { label: '--border compatibility mapping', pattern: /^\s*--border:\s*var\(--pms-border\);$/m },
  { label: '--radius-md compatibility mapping', pattern: /^\s*--radius-md:\s*var\(--pms-radius-control\);$/m },
  { label: '--shadow-md compatibility mapping', pattern: /^\s*--shadow-md:\s*var\(--pms-shadow-glass\);$/m },
]

function cssContractFailures(root) {
  const failures = []
  const extracted = extractRootBlock(read(CSS_SOURCE, root))

  if (extracted.error) {
    failures.push(`${CSS_SOURCE} ${extracted.error}`)
    return failures
  }

  expectContentPatterns(failures, CSS_SOURCE, stripCssComments(extracted.rootBlock), CSS_ROOT_EXPECTATIONS)

  const outsideLiterals = [...extracted.outsideRoot.matchAll(BRAND_HEX_PATTERN)]
    .map((match) => match[0].toLowerCase())
  if (outsideLiterals.length > 0) {
    failures.push(
      `${CSS_SOURCE}: raw PMS brand literal(s) outside :root: ${[...new Set(outsideLiterals)].join(', ')}`,
    )
  }

  return failures
}

function verifyContract(root) {
  const failures = [...rawBrandFailures(root), ...cssContractFailures(root)]

  expectPatterns(failures, root, 'src/theme/pmsTheme.ts', [
    { label: 'PMS_COLORS export', pattern: /^export const PMS_COLORS\s*=\s*{/m },
    { label: "brandStrong: '#5D49F6'", pattern: /^\s*brandStrong:\s*'#5D49F6',$/m },
    { label: "brandMain: '#7562FF'", pattern: /^\s*brandMain:\s*'#7562FF',$/m },
    { label: "brandSoft: '#AD98EE'", pattern: /^\s*brandSoft:\s*'#AD98EE',$/m },
    { label: "brandSurface: '#F5F3FF'", pattern: /^\s*brandSurface:\s*'#F5F3FF',$/m },
    { label: "brandBorder: '#DCD6FF'", pattern: /^\s*brandBorder:\s*'#DCD6FF',$/m },
    { label: "page: '#F4F6FB'", pattern: /^\s*page:\s*'#F4F6FB',$/m },
    { label: "textPrimary: '#27243A'", pattern: /^\s*textPrimary:\s*'#27243A',$/m },
    { label: "textSecondary: '#625D70'", pattern: /^\s*textSecondary:\s*'#625D70',$/m },
    { label: "textTertiary: '#817B90'", pattern: /^\s*textTertiary:\s*'#817B90',$/m },
    { label: "border: '#E6E3EF'", pattern: /^\s*border:\s*'#E6E3EF',$/m },
    { label: 'pmsTheme export', pattern: /^export const pmsTheme:\s*ThemeConfig\s*=\s*{/m },
    { label: 'colorPrimary brand mapping', pattern: /^\s*colorPrimary:\s*PMS_COLORS\.brandMain,$/m },
    { label: 'colorInfo brand mapping', pattern: /^\s*colorInfo:\s*PMS_COLORS\.brandMain,$/m },
    { label: "colorBgBase: '#FFFFFF'", pattern: /^\s*colorBgBase:\s*'#FFFFFF',$/m },
    { label: 'colorBgLayout page mapping', pattern: /^\s*colorBgLayout:\s*PMS_COLORS\.page,$/m },
    { label: 'colorText primary mapping', pattern: /^\s*colorText:\s*PMS_COLORS\.textPrimary,$/m },
    { label: 'colorTextSecondary mapping', pattern: /^\s*colorTextSecondary:\s*PMS_COLORS\.textSecondary,$/m },
    { label: 'colorTextTertiary mapping', pattern: /^\s*colorTextTertiary:\s*PMS_COLORS\.textTertiary,$/m },
    { label: 'colorBorder mapping', pattern: /^\s*colorBorder:\s*PMS_COLORS\.border,$/m },
    { label: "colorBorderSecondary: '#EFEDF4'", pattern: /^\s*colorBorderSecondary:\s*'#EFEDF4',$/m },
    { label: 'borderRadius: 8', pattern: /^\s*borderRadius:\s*8,$/m },
    { label: 'borderRadiusLG: 12', pattern: /^\s*borderRadiusLG:\s*12,$/m },
    { label: 'controlHeight: 32', pattern: /^\s*controlHeight:\s*32,$/m },
    { label: 'approved Chinese font stack', pattern: /^\s*fontFamily:\s*'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',$/m },
    { label: 'Button component mapping', pattern: /Button:\s*{\s*borderRadius:\s*8,\s*primaryShadow:\s*'0 5px 14px rgba\(96, 76, 226, \.22\)',\s*}/ },
    { label: 'Card component mapping', pattern: /Card:\s*{\s*borderRadiusLG:\s*12,\s*}/ },
    { label: 'Modal component mapping', pattern: /Modal:\s*{\s*borderRadiusLG:\s*16,\s*}/ },
    { label: 'Table component mapping', pattern: /Table:\s*{\s*headerBg:\s*PMS_COLORS\.brandSurface,\s*headerColor:\s*'#514A70',\s*rowHoverBg:\s*'#FAF9FF',\s*}/ },
    { label: 'Tabs component mapping', pattern: /Tabs:\s*{\s*inkBarColor:\s*PMS_COLORS\.brandMain,\s*itemSelectedColor:\s*PMS_COLORS\.brandStrong,\s*}/ },
  ])

  expectPatterns(failures, root, 'src/components/shared/PmsThemeProvider.tsx', [
    { label: "'use client'", pattern: /^'use client'$/m },
    { label: 'ConfigProvider import', pattern: /^import\s*{\s*ConfigProvider\s*}\s*from\s*'antd'$/m },
    { label: 'pmsTheme import', pattern: /^import\s*{\s*pmsTheme\s*}\s*from\s*'@\/theme\/pmsTheme'$/m },
    { label: 'ConfigProvider theme binding', pattern: /<ConfigProvider\s+theme=\{pmsTheme\}\s+button=\{\{\s*autoInsertSpace:\s*false\s*}}/ },
  ])

  expectPatterns(failures, root, 'src/app/layout.tsx', [
    { label: 'PmsThemeProvider import', pattern: /^import\s+PmsThemeProvider\s+from\s+'@\/components\/shared\/PmsThemeProvider'$/m },
    { label: 'Chinese document language', pattern: /<html\s+lang="zh-CN">/ },
    { label: 'root PmsThemeProvider wrapper', pattern: /<PmsThemeProvider>\{children\}<\/PmsThemeProvider>/ },
  ])

  expectNoMatches(failures, root, 'src/app/page.tsx', [
    { label: 'an Ant Design ConfigProvider import', pattern: /^\s*import[\s\S]{0,200}\bConfigProvider\b[\s\S]{0,200}\sfrom\s*['"]antd['"]/m },
    { label: 'a nested ConfigProvider render', pattern: /<ConfigProvider(?:\s|>)/ },
  ])

  return failures
}

function finish(failures, successMessage) {
  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exit(1)
  }

  console.log(successMessage)
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1]
}

const cssRoot = argumentValue('--css-root')
const scanRoot = argumentValue('--scan-root')

if (cssRoot !== null) {
  if (!cssRoot) {
    console.error('--css-root requires a directory')
    process.exit(1)
  }

  finish(cssContractFailures(path.resolve(cssRoot)), 'Liquid glass CSS contract passed')
} else if (scanRoot !== null) {
  if (!scanRoot) {
    console.error('--scan-root requires a directory')
    process.exit(1)
  }

  finish(rawBrandFailures(path.resolve(scanRoot)), 'Liquid glass raw-brand scanner passed')
} else {
  finish(verifyContract(process.cwd()), 'Liquid glass core theme contract passed')
}
