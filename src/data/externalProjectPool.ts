// src/data/externalProjectPool.ts
// Mock for the "external system" project enumeration. Real impl would
// be replaced with an async fetch keyed by `bid`.

export interface ExternalProjectEntry {
  bid: string
  name: string
  spm: string
}

export const EXTERNAL_PROJECT_POOL: ExternalProjectEntry[] = [
  { bid: 'EXT-001', name: 'X6900-D8600_H1100', spm: '李白' },
  { bid: 'EXT-002', name: 'X6901-D8700_H1102', spm: '张三' },
  { bid: 'EXT-003', name: 'tOS19.0', spm: '李四' },
  { bid: 'EXT-004', name: 'tOS19.1', spm: '王五' },
  { bid: 'EXT-005', name: 'X6912_H1208', spm: '赵六' },
  { bid: 'EXT-006', name: 'AI-Engine-V3', spm: '张三' },
  { bid: 'EXT-007', name: 'X6920-D8800_H1300', spm: '李白' },
  { bid: 'EXT-008', name: 'CI-Platform-V2', spm: '孙七' },
  { bid: 'EXT-009', name: 'HiOS-Launcher-V2', spm: '王五' },
]

export interface FetchByBidResult {
  productLine?: string
  brand?: string
  tosVersion?: string
  androidVersion?: string
  chipPlatform?: string
  planStartDate?: string
  planEndDate?: string
  projectCode?: string
  platform?: string
  productType?: '新品' | '老品'
  startRam?: '2GB' | '3GB' | '4GB' | '6GB' | '8GB' | '12GB' | '16GB'
  versionType?: 'Full' | 'Slim' | 'Go'
  str5Date?: string
  launchDate?: string
  developMode?: '自研' | 'ODC' | 'ITD-ODC' | 'ODM' | '纯外研'
  remark?: string
}

// Mocked "external system" fetch. Returns supplementary fields, keyed by bid.
export function fetchByBid(bid: string): FetchByBidResult {
  const map: Record<string, FetchByBidResult> = {
    'EXT-001': { productLine: 'NOTE', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-12-31', projectCode: 'X6900', platform: 'D8600', productType: '新品', startRam: '8GB', versionType: 'Full', str5Date: '2026-12-15', launchDate: '2027-01-15', developMode: '自研', remark: '外部项目池同步的整机项目。' },
    'EXT-002': { productLine: 'NOTE', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-07-01', planEndDate: '2027-01-31', projectCode: 'X6901', platform: 'D8700', productType: '新品', startRam: '8GB', versionType: 'Slim', str5Date: '2027-01-15', launchDate: '2027-02-15', developMode: 'ODC', remark: '外部项目池同步的整机项目。' },
    'EXT-003': { productLine: 'tOS', tosVersion: 'tOS16.1', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-11-30' },
    'EXT-004': { productLine: 'tOS', tosVersion: 'tOS16.3', androidVersion: 'Android 17', chipPlatform: 'QCOM', planStartDate: '2026-08-01', planEndDate: '2027-02-28' },
    'EXT-005': { productLine: 'SPARK', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-15', planEndDate: '2026-12-15', projectCode: 'X6912', platform: 'H1208', productType: '新品', startRam: '6GB', versionType: 'Full', str5Date: '2026-11-30', launchDate: '2027-01-01', developMode: 'ODM', remark: '外部项目池同步的整机项目。' },
    'EXT-006': { productLine: 'AI引擎', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-05-15', planEndDate: '2026-10-31' },
    'EXT-007': { productLine: 'CAMON', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'QCOM', planStartDate: '2026-07-15', planEndDate: '2027-03-31', projectCode: 'X6920', platform: 'D8800', productType: '新品', startRam: '12GB', versionType: 'Full', str5Date: '2027-03-15', launchDate: '2027-04-15', developMode: 'ITD-ODC', remark: '外部项目池同步的整机项目。' },
    'EXT-008': { productLine: '工程效率', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    'EXT-009': { productLine: '系统应用', tosVersion: 'tOS16.1', androidVersion: 'Android 16', chipPlatform: 'MTK', planStartDate: '2026-06-10', planEndDate: '2026-12-10' },
  }
  return map[bid] ?? {}
}
