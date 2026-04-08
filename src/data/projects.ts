import { LEVEL1_TASKS, FIXED_LEVEL2_PLANS } from '@/components/plan/PlanModule'

// 项目类型选项
export const PROJECT_TYPES = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']

// 项目类型标签颜色
export const PROJECT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  '整机产品项目': { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  '产品项目': { bg: 'rgba(22,119,255,0.08)', color: '#1677ff' },
  '技术项目': { bg: 'rgba(250,173,20,0.08)', color: '#d48806' },
  '能力建设项目': { bg: 'rgba(82,196,26,0.08)', color: '#389e0d' },
}

// IPM状态 → PMS展示状态 映射
export const mapIpmStatus = (ipmStatus: string, projectType: string): string => {
  const mapping: Record<string, string> = {
    '筹备中': '待立项',
    '进行中': '进行中',
    '已完成': '已完成',
    '已取消': '已取消',
    '维护期': '维护',
  }
  if (projectType === '整机产品项目' && ipmStatus === '已上市') return '已上市'
  if (projectType === '技术项目' && ipmStatus === '待立议') return '待立议'
  if (projectType === '技术项目' && ipmStatus === '待验') return '待验'
  return mapping[ipmStatus] || ipmStatus
}

// 项目状态颜色配置
export const PROJECT_STATUS_CONFIG: Record<string, { color: string; tagColor: string }> = {
  '待立项': { color: '#faad14', tagColor: 'warning' },
  '待立议': { color: '#faad14', tagColor: 'warning' },
  '进行中': { color: '#1890ff', tagColor: 'processing' },
  '已完成': { color: '#52c41a', tagColor: 'success' },
  '已上市': { color: '#722ed1', tagColor: 'purple' },
  '维护': { color: '#13c2c2', tagColor: 'cyan' },
  '暂停': { color: '#d9d9d9', tagColor: 'default' },
  '已取消': { color: '#ff4d4f', tagColor: 'error' },
  '待验': { color: '#faad14', tagColor: 'warning' },
  '筹备中': { color: '#faad14', tagColor: 'warning' },
}

// 项目数据
export const initialProjects = [
  {
    id: '1', name: 'X6877-D8400_H991', type: '整机产品项目' as const,
    status: '进行中', progress: 65, leader: '张三',
    markets: ['OP', 'TR', 'RU'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '李白', updatedAt: '2小时前', productLine: 'NOTE', tosVersion: 'tOS 16.3',
    marketName: 'NOTE 50 Pro', brand: 'TECNO', developMode: 'ODC',
    planStartDate: '2026-01-01', planEndDate: '2026-06-30',
    developCycle: 120, healthStatus: 'normal' as const,
    model: 'X6877', mainboard: 'H991', born: 'B2026Q1',
    cpu: 'MT6877', memory: '8GB+256GB', lcd: '6.78" FHD+',
    frontCamera: '32MP', primaryCamera: '108MP+8MP+2MP',
    operatingSystem: 'Android 16', version: 'V1.0.0',
    buildAddress: 'https://build.example.com/X6877',
    productType: '新品', tosVersionName: 'tOS 16.3', versionType: 'Full',
    market: 'OP,TR,RU', ppm: '王明', tpm: '刘洋', projectLevel: 'A',
    currentNode: 'STR2', launchDate: '2026-06-15',
    screenShape: '直板', screenType: 'LCD', networkMode: '5G',
    kernelVersion: '5.15', lightEffect: '有', faceRecognition: '3D结构光',
    soundEffect: 'DTS', simCard: '双卡双待', motor: '线性马达',
    fingerprint: '侧边指纹', infrared: '有',
    branchInfo: 'main_dev_x6877', jenkinsUrl: 'https://jenkins.example.com/job/X6877',
  },
  {
    id: '3', name: 'X6855_H8917', type: '整机产品项目' as const,
    status: '进行中', progress: 45, leader: '王五',
    markets: ['OP', 'TR'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '赵六', updatedAt: '3天前', productLine: 'SPARK', tosVersion: 'tOS 16.3',
    marketName: 'SPARK 30 Pro', brand: 'TECNO', developMode: 'JDM',
    planStartDate: '2026-02-01', planEndDate: '2026-08-31',
    developCycle: 140, healthStatus: 'warning' as const,
    model: 'X6855', mainboard: 'H8917', born: 'B2026Q1',
    cpu: 'MT6855', memory: '6GB+128GB', lcd: '6.67" HD+',
    frontCamera: '16MP', primaryCamera: '64MP+2MP+2MP',
    operatingSystem: 'Android 16', version: 'V1.0.0',
    buildAddress: 'https://build.example.com/X6855',
    productType: '新品', tosVersionName: 'tOS 16.3', versionType: 'Slim',
    market: 'OP,TR,RU', ppm: '赵敏', tpm: '李刚', projectLevel: 'B',
    currentNode: 'STR1', launchDate: '2026-09-01',
    screenShape: '水滴屏', screenType: 'OLED', networkMode: '5G',
    kernelVersion: '5.15', lightEffect: '有', faceRecognition: '2D',
    soundEffect: 'DTS', simCard: '双卡双待', motor: '转子马达',
    fingerprint: '屏下指纹', infrared: '无',
    branchInfo: 'main_dev_x6855', jenkinsUrl: 'https://jenkins.example.com/job/X6855',
  },
  {
    id: '2', name: 'tOS16.0', type: '产品项目' as const,
    status: '进行中', progress: 55, leader: '李四',
    markets: [], androidVersion: 'Android 15', chipPlatform: 'MTK',
    spm: '张三', updatedAt: '1天前', productLine: 'tOS', tosVersion: 'tOS 16.0',
    planStartDate: '2026-01-15', planEndDate: '2026-05-30',
    developCycle: 95, healthStatus: 'normal' as const,
    operatingSystem: 'Android 15', version: 'tOS16.0-V2',
    buildAddress: 'https://build.example.com/tOS16',
    currentNode: 'STR3', versionType: 'Full',
    versionFiveRoles: { '版本规划代表': '张三', '版本经理': '李四', '版本SE': '王五', '版本测试代表': '赵六', '版本质量代表': '孙七' },
    branchInfo: 'main_dev_tos16', jenkinsUrl: 'https://jenkins.example.com/job/tOS16',
  },
  {
    id: '6', name: 'tOS17.1', type: '产品项目' as const,
    status: '筹备中', progress: 15, leader: '赵六',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '李四', updatedAt: '3小时前', productLine: 'tOS', tosVersion: 'tOS 17.1',
    planStartDate: '2026-03-01', planEndDate: '2026-09-30',
    developCycle: 140, healthStatus: 'normal' as const,
    operatingSystem: 'Android 16', version: 'tOS17.1-V1',
    buildAddress: 'https://build.example.com/tOS17',
    currentNode: 'STR1', versionType: 'Slim',
    versionFiveRoles: { '版本规划代表': '赵六', '版本经理': '孙七', '版本SE': '李四', '版本测试代表': '王五', '版本质量代表': '张三' },
    branchInfo: 'main_dev_tos17', jenkinsUrl: 'https://jenkins.example.com/job/tOS17',
  },
  {
    id: '4', name: 'X6876_H786', type: '技术项目' as const,
    status: '已完成', progress: 100, leader: '孙七',
    markets: [], androidVersion: 'Android 15', chipPlatform: 'QCOM',
    spm: '李四', updatedAt: '5天前', productLine: '平台技术', tosVersion: 'tOS 15.0',
    planStartDate: '2025-10-01', planEndDate: '2026-02-28',
    developCycle: 100, healthStatus: 'normal' as const,
    operatingSystem: 'Android 15',
    buildAddress: 'https://build.example.com/X6876',
    currentNode: 'STR5', projectDescription: '平台技术预研项目，探索新一代芯片平台的适配与优化方案',
    branchInfo: 'main_dev_x6876', jenkinsUrl: 'https://jenkins.example.com/job/X6876',
    teamMembers: '孙七,李四,张三',
  },
  {
    id: '5', name: 'X6873_H972', type: '能力建设项目' as const,
    status: '进行中', progress: 30, leader: '周八',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'UNISOC',
    spm: '王五', updatedAt: '1周前', productLine: '基础能力', tosVersion: 'tOS 16.2',
    planStartDate: '2026-02-15', planEndDate: '2026-07-31',
    developCycle: 110, healthStatus: 'risk' as const,
    operatingSystem: 'Android 16',
    buildAddress: 'https://build.example.com/X6873',
    projectDescription: '基础能力建设项目，提升团队自动化测试与CI/CD能力',
    teamMembers: '周八,王五,李白',
  },
  {
    id: '7', name: 'X6890-D8500_H1001', type: '整机产品项目' as const,
    status: '筹备中', progress: 10, leader: '李白',
    markets: ['OP', 'TR', 'RU', 'IN'], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '张三', updatedAt: '1天前', productLine: 'CAMON', tosVersion: 'tOS 16.5',
    marketName: 'CAMON 40 Pro', brand: 'TECNO', developMode: 'ODC',
    planStartDate: '2026-03-15', planEndDate: '2026-10-31',
    developCycle: 155, healthStatus: 'normal' as const,
    model: 'X6890', mainboard: 'H1001', born: 'B2026Q2',
    cpu: 'SD8Gen3', memory: '12GB+512GB', lcd: '6.9" AMOLED',
    frontCamera: '50MP', primaryCamera: '200MP+12MP+5MP',
    operatingSystem: 'Android 16', version: 'V0.1.0',
    buildAddress: 'https://build.example.com/X6890',
    productType: '新品', versionType: 'Go',
    market: 'OP,TR,RU,IN', ppm: '王明', tpm: '刘洋', projectLevel: 'S',
    currentNode: '概念启动', launchDate: '2026-11-15',
    screenShape: '曲面屏', screenType: 'AMOLED', networkMode: '5G',
    kernelVersion: '6.1', lightEffect: '有', faceRecognition: '3D结构光',
    soundEffect: 'Dolby Atmos', simCard: '双卡双待', motor: '线性马达',
    fingerprint: '屏下超声波指纹', infrared: '有',
    branchInfo: 'main_dev_x6890', jenkinsUrl: 'https://jenkins.example.com/job/X6890',
  },
  {
    id: '8', name: 'tOS18.0', type: '产品项目' as const,
    status: '筹备中', progress: 5, leader: '杜甫',
    markets: [], androidVersion: 'Android 17', chipPlatform: 'MTK',
    spm: '赵六', updatedAt: '2天前', productLine: 'tOS', tosVersion: 'tOS 18.0',
    planStartDate: '2026-04-01', planEndDate: '2026-12-31',
    developCycle: 180, healthStatus: 'normal' as const,
    operatingSystem: 'Android 17', version: 'tOS18.0-V1',
    buildAddress: 'https://build.example.com/tOS18',
    currentNode: '概念启动', versionType: 'Go', brand: 'TECNO',
    versionFiveRoles: { '版本规划代表': '杜甫', '版本经理': '李白', '版本SE': '张三', '版本测试代表': '李四', '版本质量代表': '王五' },
    branchInfo: 'main_dev_tos18', jenkinsUrl: 'https://jenkins.example.com/job/tOS18',
  },
  {
    id: '9', name: 'AI-Engine-V2', type: '技术项目' as const,
    status: '进行中', progress: 40, leader: '李四',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '张三', updatedAt: '4小时前', productLine: 'AI引擎', tosVersion: '',
    planStartDate: '2026-02-01', planEndDate: '2026-07-15',
    developCycle: 112, healthStatus: 'warning' as const,
    operatingSystem: 'Android 16',
    buildAddress: 'https://build.example.com/ai-engine-v2',
    currentNode: 'STR3', projectDescription: 'AI推理引擎V2版本，提升端侧大模型推理性能，支持多模态输入输出',
    branchInfo: 'main_dev_ai_engine_v2', jenkinsUrl: 'https://jenkins.example.com/job/ai-engine-v2',
    teamMembers: '李四,张三,赵六,孙七',
  },
  {
    id: '10', name: 'DevOps-Platform', type: '能力建设项目' as const,
    status: '进行中', progress: 55, leader: '孙七',
    markets: [], androidVersion: '', chipPlatform: '',
    spm: '李四', updatedAt: '6小时前', productLine: '工程效率', tosVersion: '',
    planStartDate: '2026-01-10', planEndDate: '2026-06-30',
    developCycle: 118, healthStatus: 'normal' as const,
    operatingSystem: '',
    buildAddress: '',
    projectDescription: 'DevOps平台建设，整合CI/CD流水线、自动化测试、代码质量门禁，提升研发交付效率',
    teamMembers: '孙七,周八,李白,杜甫,王五',
  },
]

// 构建市场计划数据
export function buildMarketPlanData(markets: string[]) {
  const data: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: { id: string, name: string, type: string }[] }> = {}
  markets.forEach(m => {
    data[m] = { tasks: [...LEVEL1_TASKS.map(t => ({ ...t }))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] }
  })
  return data
}
