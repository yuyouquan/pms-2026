import type { VersionRelease, ProductSpec, LeveledPlan } from '@/types/ai'

// ─── Versions — releases per project ───────────────────────────

export const MOCK_VERSIONS: VersionRelease[] = [
  // X6877-D8400_H991 — hero project, rich history
  { id: 'v-1', projectName: 'X6877-D8400_H991', versionNumber: 'V2.3.0', releaseDate: '2026-04-18', releaseType: 'MR2', status: 'success',
    buildUrl: 'https://build.example.com/X6877/V2.3.0', stabilityScore: 92, perfScore: 88, defectCount: 3,
    notes: '修复了内存泄漏问题，充电性能提升 5%' },
  { id: 'v-2', projectName: 'X6877-D8400_H991', versionNumber: 'V2.2.3', releaseDate: '2026-04-10', releaseType: 'MR1', status: 'success',
    buildUrl: 'https://build.example.com/X6877/V2.2.3', stabilityScore: 89, perfScore: 83, defectCount: 5 },
  { id: 'v-3', projectName: 'X6877-D8400_H991', versionNumber: 'V2.2.2', releaseDate: '2026-04-05', releaseType: 'Hotfix', status: 'failed',
    buildUrl: 'https://build.example.com/X6877/V2.2.2', stabilityScore: 0, perfScore: 0, defectCount: 12, notes: '构建失败：内核签名验证问题' },
  { id: 'v-4', projectName: 'X6877-D8400_H991', versionNumber: 'V2.2.1', releaseDate: '2026-04-02', releaseType: 'MR1', status: 'success',
    buildUrl: 'https://build.example.com/X6877/V2.2.1', stabilityScore: 87, perfScore: 82, defectCount: 7 },
  { id: 'v-5', projectName: 'X6877-D8400_H991', versionNumber: 'V2.2.0', releaseDate: '2026-03-28', releaseType: 'FR', status: 'success',
    buildUrl: 'https://build.example.com/X6877/V2.2.0', stabilityScore: 85, perfScore: 80, defectCount: 9 },
  // tOS16.0
  { id: 'v-10', projectName: 'tOS16.0', versionNumber: 'V1.5.2', releaseDate: '2026-04-20', releaseType: 'MR2', status: 'success',
    buildUrl: 'https://build.example.com/tOS/V1.5.2', stabilityScore: 94, perfScore: 91, defectCount: 2 },
  { id: 'v-11', projectName: 'tOS16.0', versionNumber: 'V1.5.1', releaseDate: '2026-04-15', releaseType: 'MR1', status: 'success',
    buildUrl: 'https://build.example.com/tOS/V1.5.1', stabilityScore: 93, perfScore: 90, defectCount: 3 },
  // X6873_H972
  { id: 'v-20', projectName: 'X6873_H972', versionNumber: 'V1.0.0', releaseDate: '2026-04-15', releaseType: 'FR', status: 'in-progress',
    buildUrl: 'https://build.example.com/X6873/V1.0.0', stabilityScore: 72, perfScore: 70, defectCount: 15 },
  { id: 'v-21', projectName: 'X6873_H972', versionNumber: 'V0.9.3', releaseDate: '2026-04-12', releaseType: 'Hotfix', status: 'failed',
    buildUrl: 'https://build.example.com/X6873/V0.9.3', stabilityScore: 0, perfScore: 0, defectCount: 0, notes: 'Camera HAL 适配问题未解决' },
  // X6890-D8500_H1001
  { id: 'v-30', projectName: 'X6890-D8500_H1001', versionNumber: 'V0.5.2', releaseDate: '2026-04-19', releaseType: 'MR1', status: 'success',
    buildUrl: 'https://build.example.com/X6890/V0.5.2', stabilityScore: 80, perfScore: 85, defectCount: 6 },
  // X6855_H8917
  { id: 'v-40', projectName: 'X6855_H8917', versionNumber: 'V1.1.0', releaseDate: '2026-04-16', releaseType: 'FR', status: 'success',
    buildUrl: 'https://build.example.com/X6855/V1.1.0', stabilityScore: 86, perfScore: 84, defectCount: 4 },
]

// ─── Products — detailed spec sheets ────────────────────────────

export const MOCK_PRODUCT_SPECS: Record<string, ProductSpec> = {
  'X6877-D8400_H991': {
    projectName: 'X6877-D8400_H991', codename: 'X6877', marketName: 'NOTE 50 Pro', brand: 'TECNO',
    cpu: 'MediaTek Dimensity 8400', memory: '8GB + 256GB', lcd: '6.78" FHD+ AMOLED 120Hz',
    frontCamera: '32MP', primaryCamera: '108MP + 8MP + 2MP',
    os: 'Android 16', tosVersion: 'tOS 16.3', markets: ['OP', 'TR', 'RU'],
    launchDate: '2026-06-15', productType: '新品', chipPlatform: 'MTK', projectLevel: 'A',
    currentStage: 'STR2', spm: '李白', tpm: '刘洋', ppm: '王明',
  },
  'X6873_H972': {
    projectName: 'X6873_H972', codename: 'X6873', marketName: 'CAMON 30 Lite', brand: 'TECNO',
    cpu: 'Helio G88', memory: '6GB + 128GB', lcd: '6.67" HD+',
    frontCamera: '8MP', primaryCamera: '50MP + 0.3MP',
    os: 'Android 14', tosVersion: 'tOS 15.0', markets: ['IN', 'SG'],
    launchDate: '2026-07-01', productType: '主力', chipPlatform: 'MTK', projectLevel: 'B',
    currentStage: 'STR1', spm: '周八', tpm: '李白', ppm: '李四',
  },
  'X6890-D8500_H1001': {
    projectName: 'X6890-D8500_H1001', codename: 'X6890', marketName: 'CAMON 30 Pro', brand: 'TECNO',
    cpu: 'Dimensity 8500', memory: '12GB + 512GB', lcd: '6.78" FHD+ LTPO 120Hz',
    frontCamera: '50MP', primaryCamera: '200MP + 50MP + 8MP',
    os: 'Android 17', tosVersion: 'tOS 17.0', markets: ['OP', 'AFR'],
    launchDate: '2026-08-20', productType: '旗舰', chipPlatform: 'MTK', projectLevel: 'A',
    currentStage: 'CP', spm: '李白', tpm: '张三', ppm: '王五',
  },
  'X6855_H8917': {
    projectName: 'X6855_H8917', codename: 'X6855', marketName: 'SPARK Go 2026', brand: 'TECNO',
    cpu: 'Unisoc T615', memory: '4GB + 64GB', lcd: '6.56" HD+',
    frontCamera: '5MP', primaryCamera: '13MP',
    os: 'Android 14 Go', tosVersion: 'tOS 14.0', markets: ['IN', 'AFR'],
    launchDate: '2026-05-30', productType: '入门', chipPlatform: '展锐', projectLevel: 'C',
    currentStage: 'PV', spm: '赵六', tpm: '孙七', ppm: '李四',
  },
  'X6876_H786': {
    projectName: 'X6876_H786', codename: 'X6876', marketName: 'POVA 7 Pro', brand: 'TECNO',
    cpu: 'Dimensity 7300', memory: '8GB + 128GB', lcd: '6.78" FHD+ 120Hz',
    frontCamera: '16MP', primaryCamera: '64MP + 2MP',
    os: 'Android 15', tosVersion: 'tOS 16.0', markets: ['IN', 'BR'],
    launchDate: '2026-06-30', productType: '主力', chipPlatform: 'MTK', projectLevel: 'B',
    currentStage: 'STR1', spm: '孙七', tpm: '李四', ppm: '张三',
  },
}

// ─── Plans at L1/L2/L3 ────────────────────────────────────────

export const MOCK_LEVELED_PLANS: LeveledPlan[] = [
  // === X6877-D8400_H991 — full hierarchy ===

  // L1 tree: phase roots (depth 1) + sub-milestones (depth 2)
  { id: 'l1-c', projectName: 'X6877-D8400_H991', level: 'L1', depth: 1,
    name: '概念阶段', owner: '王明', planDate: '2026-01-15', actualDate: '2026-01-16',
    progress: 100, status: '已完成', isRisk: false },
  { id: 'l1-c-1', projectName: 'X6877-D8400_H991', level: 'L1', depth: 2, parentId: 'l1-c',
    name: '概念评审', owner: '王明', planDate: '2026-01-15', actualDate: '2026-01-16',
    progress: 100, status: '已完成', isRisk: false },

  { id: 'l1-p', projectName: 'X6877-D8400_H991', level: 'L1', depth: 1,
    name: '立项阶段', owner: '王明', planDate: '2026-02-01', actualDate: '2026-02-03',
    progress: 100, status: '已完成', isRisk: false },
  { id: 'l1-p-1', projectName: 'X6877-D8400_H991', level: 'L1', depth: 2, parentId: 'l1-p',
    name: '立项评审', owner: '王明', planDate: '2026-02-01', actualDate: '2026-02-03',
    progress: 100, status: '已完成', isRisk: false },

  { id: 'l1-d', projectName: 'X6877-D8400_H991', level: 'L1', depth: 1,
    name: '开发阶段', owner: '刘洋', planDate: '2026-04-15',
    progress: 80, status: '进行中', isRisk: false },
  { id: 'l1-d-1', projectName: 'X6877-D8400_H991', level: 'L1', depth: 2, parentId: 'l1-d',
    name: 'DV 完成', owner: '刘洋', planDate: '2026-04-15', actualDate: '2026-04-15',
    progress: 100, status: '已完成', isRisk: false },
  { id: 'l1-d-2', projectName: 'X6877-D8400_H991', level: 'L1', depth: 2, parentId: 'l1-d',
    name: 'PV 完成', owner: '刘洋', planDate: '2026-05-10',
    progress: 60, status: '进行中', isRisk: true, description: '部分测试用例阻塞，关注风险' },

  { id: 'l1-l', projectName: 'X6877-D8400_H991', level: 'L1', depth: 1,
    name: '上市阶段', owner: '李白', planDate: '2026-05-28',
    progress: 10, status: '进行中', isRisk: false },
  { id: 'l1-l-1', projectName: 'X6877-D8400_H991', level: 'L1', depth: 2, parentId: 'l1-l',
    name: '量产', owner: '李白', planDate: '2026-05-28',
    progress: 20, status: '进行中', isRisk: false },
  { id: 'l1-l-2', projectName: 'X6877-D8400_H991', level: 'L1', depth: 2, parentId: 'l1-l',
    name: '首发上市', owner: '李白', planDate: '2026-06-15',
    progress: 0, status: '未开始', isRisk: false },

  // L2 tree — 需求开发: 3 domain roots (depth 1) → plans (depth 2) → breakdowns (depth 3)
  { id: 'l2r-pay', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '需求开发',
    name: '支付域', owner: '张三', planDate: '2026-05-10',
    progress: 65, status: '进行中', isRisk: true },
  { id: 'l2r-pay-refactor', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2r-pay', category: '需求开发',
    name: '支付流程重构', owner: '张三', planDate: '2026-04-20',
    progress: 70, status: '延期', isRisk: true },
  { id: 'l2r-pay-refactor-fe', projectName: 'X6877-D8400_H991', level: 'L3', depth: 3, parentId: 'l2r-pay-refactor', category: '需求开发',
    name: '支付前端改造', owner: '张三', department: '支付业务组', planDate: '2026-04-18',
    progress: 80, status: '延期', isRisk: true },
  { id: 'l2r-pay-refactor-be', projectName: 'X6877-D8400_H991', level: 'L3', depth: 3, parentId: 'l2r-pay-refactor', category: '需求开发',
    name: '支付后端适配', owner: '李思思', department: '支付业务组', planDate: '2026-04-20',
    progress: 60, status: '进行中', isRisk: true },
  { id: 'l2r-pay-refactor-test', projectName: 'X6877-D8400_H991', level: 'L3', depth: 3, parentId: 'l2r-pay-refactor', category: '需求开发',
    name: '支付回归测试', owner: '孙七', department: '测试部', planDate: '2026-04-22',
    progress: 0, status: '未开始', isRisk: false },

  { id: 'l2r-home', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '需求开发',
    name: '首页域', owner: '李四', planDate: '2026-05-12',
    progress: 45, status: '进行中', isRisk: false },
  { id: 'l2r-home-revamp', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2r-home', category: '需求开发',
    name: '首页信息流改版', owner: '李四', planDate: '2026-05-10',
    progress: 45, status: '进行中', isRisk: false },

  { id: 'l2r-ai', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '需求开发',
    name: 'AI 助手域', owner: '李白', planDate: '2026-05-20',
    progress: 30, status: '进行中', isRisk: false },
  { id: 'l2r-ai-integrate', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2r-ai', category: '需求开发',
    name: 'AI 助手接入', owner: '李白', planDate: '2026-05-15',
    progress: 30, status: '进行中', isRisk: false },

  // L2 tree — 版本火车
  { id: 'l2v-train', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '版本火车',
    name: 'V2.x 版本火车', owner: '王五', planDate: '2026-05-20',
    progress: 60, status: '进行中', isRisk: false },
  { id: 'l2v-mr1', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2v-train', category: '版本火车',
    name: 'MR1 - V2.2.3', owner: '王五', planDate: '2026-04-10', actualDate: '2026-04-10',
    progress: 100, status: '已完成', isRisk: false },
  { id: 'l2v-mr2', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2v-train', category: '版本火车',
    name: 'MR2 - V2.3.0', owner: '王五', planDate: '2026-04-25',
    progress: 80, status: '进行中', isRisk: false },
  { id: 'l2v-mr2-arch', projectName: 'X6877-D8400_H991', level: 'L3', depth: 3, parentId: 'l2v-mr2', category: '版本火车',
    name: '内核签名审计', owner: '王五', department: '架构部', planDate: '2026-04-22',
    progress: 100, status: '已完成', isRisk: false },
  { id: 'l2v-mr2-app', projectName: 'X6877-D8400_H991', level: 'L3', depth: 3, parentId: 'l2v-mr2', category: '版本火车',
    name: '应用适配', owner: '杜甫', department: '软件部', planDate: '2026-04-24',
    progress: 90, status: '进行中', isRisk: false },
  { id: 'l2v-mr2-test', projectName: 'X6877-D8400_H991', level: 'L3', depth: 3, parentId: 'l2v-mr2', category: '版本火车',
    name: 'MR2 构建验证', owner: '赵六', department: '测试部', planDate: '2026-04-25',
    progress: 50, status: '进行中', isRisk: false },
  { id: 'l2v-mr3', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2v-train', category: '版本火车',
    name: 'MR3 - V2.4.0', owner: '王五', planDate: '2026-05-20',
    progress: 10, status: '进行中', isRisk: false },

  // L2 tree — 独立应用
  { id: 'l2a-cam', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '独立应用',
    name: '相机域', owner: '周八', planDate: '2026-05-05',
    progress: 50, status: '进行中', isRisk: false },
  { id: 'l2a-cam-v3', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2a-cam', category: '独立应用',
    name: '相机独立应用 v3', owner: '周八', planDate: '2026-05-05',
    progress: 50, status: '进行中', isRisk: false },
  { id: 'l2a-br', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '独立应用',
    name: '浏览器域', owner: '杜甫', planDate: '2026-05-12',
    progress: 40, status: '进行中', isRisk: false },
  { id: 'l2a-br-v2', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2a-br', category: '独立应用',
    name: '浏览器独立应用 v2', owner: '杜甫', planDate: '2026-05-12',
    progress: 40, status: '进行中', isRisk: false },

  // L2 tree — 测试
  { id: 'l2t-auto', projectName: 'X6877-D8400_H991', level: 'L2', depth: 1, category: '测试',
    name: '自动化测试', owner: '赵六', planDate: '2026-05-10',
    progress: 40, status: '进行中', isRisk: false },
  { id: 'l2t-auto-e2e', projectName: 'X6877-D8400_H991', level: 'L2', depth: 2, parentId: 'l2t-auto', category: '测试',
    name: 'E2E 自动化扩充', owner: '赵六', planDate: '2026-05-10',
    progress: 40, status: '进行中', isRisk: false },

  // === tOS16.0 — L1 with 1 phase root + 2 sub-milestones ===
  { id: 'l1-tos-rc', projectName: 'tOS16.0', level: 'L1', depth: 1,
    name: '发布阶段', owner: '张三', planDate: '2026-04-28',
    progress: 50, status: '进行中', isRisk: false },
  { id: 'l1-tos-rc-1', projectName: 'tOS16.0', level: 'L1', depth: 2, parentId: 'l1-tos-rc',
    name: 'tOS 16.0 RC', owner: '张三', planDate: '2026-04-28',
    progress: 85, status: '进行中', isRisk: false },
  { id: 'l1-tos-rc-2', projectName: 'tOS16.0', level: 'L1', depth: 2, parentId: 'l1-tos-rc',
    name: 'tOS 16.0 正式发布', owner: '张三', planDate: '2026-05-15',
    progress: 0, status: '未开始', isRisk: false },

  // === X6873_H972 — L1 with risk + L2 needs dev nodes ===
  { id: 'l1-x73-d', projectName: 'X6873_H972', level: 'L1', depth: 1,
    name: '开发阶段', owner: '周八', planDate: '2026-04-24',
    progress: 30, status: '延期', isRisk: true, description: 'Camera HAL 适配阻塞' },
  { id: 'l1-x73-d-1', projectName: 'X6873_H972', level: 'L1', depth: 2, parentId: 'l1-x73-d',
    name: 'DV 完成', owner: '周八', planDate: '2026-04-24',
    progress: 30, status: '延期', isRisk: true },

  { id: 'l2x73-aod', projectName: 'X6873_H972', level: 'L2', depth: 1, category: '需求开发',
    name: '显示域', owner: '李白', planDate: '2026-04-25',
    progress: 25, status: '进行中', isRisk: true },
  { id: 'l2x73-aod-ui', projectName: 'X6873_H972', level: 'L2', depth: 2, parentId: 'l2x73-aod', category: '需求开发',
    name: 'AOD 界面', owner: '李白', planDate: '2026-04-23',
    progress: 20, status: '进行中', isRisk: true },

  { id: 'l2x73-cam', projectName: 'X6873_H972', level: 'L2', depth: 1, category: '需求开发',
    name: '相机域', owner: '周八', planDate: '2026-04-26',
    progress: 30, status: '延期', isRisk: true },
  { id: 'l2x73-cam-hal', projectName: 'X6873_H972', level: 'L2', depth: 2, parentId: 'l2x73-cam', category: '需求开发',
    name: 'Camera HAL 适配', owner: '周八', planDate: '2026-04-24',
    progress: 30, status: '延期', isRisk: true },
]

export const L1_MILESTONE_ORDER = ['概念阶段', '概念评审', '立项阶段', '立项评审', 'DV 完成', 'PV 完成', '量产', '首发上市', '发布阶段', 'tOS 16.0 RC', 'tOS 16.0 正式发布', '开发阶段']
