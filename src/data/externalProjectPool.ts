// src/data/externalProjectPool.ts
// Mock for the "external system" project enumeration. Real impl would
// be replaced with an async fetch keyed by `bid`.

export interface ExternalProjectEntry {
  bid: string
  name: string
  spm: string
  ipmProjectCategoryName: string
  ipmStatus?: string
  technicalTrack?: string
  subprojects?: Array<{
    id: string
    name: string
    ipmOrder: number
  }>
}

export const EXTERNAL_PROJECT_POOL: ExternalProjectEntry[] = [
  { bid: 'EXT-014', name: '示例整机-资料待完善', spm: '演示用户02', ipmProjectCategoryName: '整机产品-基线IPD', ipmStatus: '筹备中' },
  { bid: 'EXT-001', name: 'DEMO021-DEMOCHIP003_DEMOBOARD003', spm: '演示用户07', ipmProjectCategoryName: '整机产品-基线IPD' },
  { bid: 'EXT-002', name: 'DEMO022-DEMOCHIP004_DEMOBOARD004', spm: '演示用户01', ipmProjectCategoryName: '整机产品-模块化IPD' },
  { bid: 'EXT-003', name: 'tOS19.0', spm: '演示用户02', ipmProjectCategoryName: '软件产品项目', ipmStatus: '进行中' },
  { bid: 'EXT-004', name: 'tOS19.1', spm: '演示用户03', ipmProjectCategoryName: '软件产品项目', ipmStatus: '维护期' },
  { bid: 'EXT-005', name: 'DEMO023_DEMOBOARD005', spm: '演示用户04', ipmProjectCategoryName: '其他-平板--整机产品项目' },
  {
    bid: 'EXT-006', name: 'DEMO-TECH-V3', spm: '演示用户01', ipmProjectCategoryName: '研发级-基础研究-重点项目', technicalTrack: '示例智能技术',
    subprojects: [
      { id: 'IPM-AI-001', name: '示例推理子项目', ipmOrder: 1 },
      { id: 'IPM-AI-002', name: '示例多模态子项目', ipmOrder: 2 },
      // The same stable ID exists as inactive in the PMS seed, so a sync
      // demonstrates lossless reactivation rather than creating a new child.
      { id: 'IPM-AI-003', name: '示例训练子项目', ipmOrder: 3 },
    ],
  },
  { bid: 'EXT-007', name: 'DEMO024-DEMOCHIP005_DEMOBOARD006', spm: '演示用户07', ipmProjectCategoryName: '整机产品-非IPD' },
  { bid: 'EXT-008', name: 'DEMO-CI-V2', spm: '演示用户05', ipmProjectCategoryName: '公司级能力建设' },
  { bid: 'EXT-009', name: 'DEMO-APP-V2', spm: '演示用户03', ipmProjectCategoryName: '部门级-技术研发', technicalTrack: '系统体验' },
  { bid: 'EXT-010', name: 'DEMO014', spm: '演示用户07', ipmProjectCategoryName: '整机产品-基线IPD' },
  { bid: 'EXT-011', name: 'DEMO014', spm: '演示用户07', ipmProjectCategoryName: '手机整机产品-大版本升级' },
  { bid: 'EXT-012', name: 'DEMO014', spm: '演示用户07', ipmProjectCategoryName: '手机整机产品-大版本升级' },
  { bid: 'EXT-013', name: 'DEMO-TECH-PRE', spm: '演示用户04', ipmProjectCategoryName: '技术项目前置工作', ipmStatus: '筹备中', technicalTrack: '示例智能技术' },
]

export interface FetchByBidResult {
  productLine?: string
  productSeries?: string
  brand?: string
  marketName?: string
  tosVersion?: string
  androidVersion?: string
  chipPlatform?: string
  chipCode?: string
  chipModel?: string
  memorySize?: string
  mainboardName?: string
  researchMode?: string
  androidMajorUpgrade?: string
  confidentialityLevel?: string
  launchDate?: string
  productionForbiddenDate?: string
  targetMarkets?: string
  planStartDate?: string
  planEndDate?: string
  projectCode?: string
  platform?: string
  productType?: '新品' | '老品'
  startRam?: '2GB' | '3GB' | '4GB' | '6GB' | '8GB' | '12GB' | '16GB'
  versionType?: 'Full' | 'Slim' | 'Go'
  str5Date?: string
  developMode?: '自研' | 'ODC' | 'ITD-ODC' | 'ODM' | '纯外研'
  remark?: string
}

// Mocked "external system" fetch. Returns supplementary fields, keyed by bid.
export function fetchByBid(bid: string): FetchByBidResult {
  const map: Record<string, FetchByBidResult> = {
    'EXT-014': { remark: '已建档来源，品牌、产品线、市场名和项目编码待补充。' },
    'EXT-001': { productLine: '示例系列A', productSeries: '示例系列A 60', marketName: '示例系列A 60 Pro', brand: '示例品牌A', androidVersion: 'Android 17', chipPlatform: '示例平台A', chipCode: 'DEMOCHIP003', chipModel: 'DEMOSOC007', memorySize: '8GB+256GB', mainboardName: 'DEMOBOARD003', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR,RU', planStartDate: '2026-06-01', planEndDate: '2026-12-31', projectCode: 'DEMO021', platform: 'DEMOCHIP003', productType: '新品', startRam: '8GB', versionType: 'Full', str5Date: '2026-12-15', launchDate: '2027-01-15', developMode: '自研', remark: '外部项目池同步的整机项目。' },
    'EXT-002': { productLine: '示例系列A', productSeries: '示例系列A 60', marketName: '示例系列A 60', brand: '示例品牌A', androidVersion: 'Android 17', chipPlatform: '示例平台A', chipCode: 'DEMOCHIP004', chipModel: 'DEMOSOC005', memorySize: '8GB+128GB', mainboardName: 'DEMOBOARD004', researchMode: '外研', androidMajorUpgrade: '否', confidentialityLevel: '机密', targetMarkets: 'OP,IN', planStartDate: '2026-07-01', planEndDate: '2027-01-31', projectCode: 'DEMO022', platform: 'DEMOCHIP004', productType: '新品', startRam: '8GB', versionType: 'Slim', str5Date: '2027-01-15', launchDate: '2027-02-15', developMode: 'ODC', remark: '外部项目池同步的整机项目。' },
    'EXT-003': { productLine: 'tOS', tosVersion: 'tOS16.1', androidVersion: 'Android 17', chipPlatform: '示例平台A', planStartDate: '2026-06-01', planEndDate: '2026-11-30' },
    'EXT-004': { productLine: 'tOS', tosVersion: 'tOS16.3', androidVersion: 'Android 17', chipPlatform: '示例平台B', planStartDate: '2026-08-01', planEndDate: '2027-02-28' },
    'EXT-005': { productLine: '示例系列B', productSeries: '示例系列B 40', marketName: '示例系列B 40 Pro', brand: '示例品牌A', androidVersion: 'Android 17', chipPlatform: '示例平台A', chipCode: 'DEMO023', chipModel: 'DEMOSOC004', memorySize: '6GB+128GB', mainboardName: 'DEMOBOARD005', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2026-06-15', planEndDate: '2026-12-15', projectCode: 'DEMO023', platform: 'DEMOBOARD005', productType: '新品', startRam: '6GB', versionType: 'Full', str5Date: '2026-11-30', launchDate: '2027-01-01', developMode: 'ODM', remark: '外部项目池同步的整机项目。' },
    'EXT-006': { productLine: 'AI引擎', androidVersion: 'Android 17', chipPlatform: '示例平台A', planStartDate: '2026-05-15', planEndDate: '2026-10-31' },
    'EXT-007': { productLine: '示例系列D', productSeries: '示例系列D 50', marketName: '示例系列D 50 Premier', brand: '示例品牌A', androidVersion: 'Android 17', chipPlatform: '示例平台B', chipCode: 'DEMOCHIP005', chipModel: 'DEMOSOC011', memorySize: '12GB+256GB', mainboardName: 'DEMOBOARD006', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '绝密', targetMarkets: 'OP,RU,EU', planStartDate: '2026-07-15', planEndDate: '2027-03-31', projectCode: 'DEMO024', platform: 'DEMOCHIP005', productType: '新品', startRam: '12GB', versionType: 'Full', str5Date: '2027-03-15', launchDate: '2027-04-15', developMode: 'ITD-ODC', remark: '外部项目池同步的整机项目。' },
    'EXT-008': { productLine: '工程效率', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    'EXT-009': { productLine: '示例应用领域', tosVersion: 'tOS16.1', androidVersion: 'Android 16', chipPlatform: '示例平台A', planStartDate: '2026-06-10', planEndDate: '2026-12-10' },
    'EXT-010': { productLine: '示例系列A', productSeries: '示例系列A 60', marketName: 'DEMO014', brand: '示例品牌A', tosVersion: 'tOS14.0.0', androidVersion: 'Android 17', chipPlatform: '示例平台A', chipCode: 'DEMOCHIP003', chipModel: 'DEMOSOC007', memorySize: '8GB+256GB', mainboardName: 'DEMOBOARD003', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2026-06-01', planEndDate: '2026-12-31', projectCode: 'DEMO014', platform: 'DEMOCHIP003', productType: '新品', startRam: '8GB', versionType: 'Full', str5Date: '2026-12-15', launchDate: '2027-01-15', developMode: '自研', remark: 'DEMO014 新品联动验证。' },
    'EXT-011': { productLine: '示例系列A', productSeries: '示例系列A 60', marketName: 'DEMO014', brand: '示例品牌A', tosVersion: 'tOS15.0.0', androidVersion: 'Android 18', chipPlatform: '示例平台A', chipCode: 'DEMOCHIP003', chipModel: 'DEMOSOC007', memorySize: '8GB+256GB', mainboardName: 'DEMOBOARD003', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2027-01-01', planEndDate: '2027-06-30', projectCode: 'DEMO014', platform: 'DEMOCHIP003', productType: '老品', startRam: '8GB', versionType: 'Full', str5Date: '2027-05-15', launchDate: '2027-07-15', developMode: '自研', remark: 'DEMO014 老品 15.0.0 联动验证。' },
    'EXT-012': { productLine: '示例系列A', productSeries: '示例系列A 60', marketName: 'DEMO014', brand: '示例品牌A', tosVersion: 'tOS17.10.0', androidVersion: 'Android 18', chipPlatform: '示例平台A', chipCode: 'DEMOCHIP003', chipModel: 'DEMOSOC007', memorySize: '8GB+256GB', mainboardName: 'DEMOBOARD003', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2027-03-01', planEndDate: '2027-09-30', projectCode: 'DEMO014', platform: 'DEMOCHIP003', productType: '老品', startRam: '8GB', versionType: 'Full', str5Date: '2027-08-15', launchDate: '2027-10-15', developMode: '自研', remark: 'DEMO014 老品 17.10.0 联动验证。' },
    'EXT-013': { productLine: '示例应用领域', planStartDate: '2026-08-01', planEndDate: '2026-12-31' },
  }
  return map[bid] ?? {}
}
