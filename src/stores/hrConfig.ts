import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConfigModuleKey, ConfigRecord, ConfigFormValues } from '@/types/hrConfig'
import { MOCK_CONFIG_DATA } from '@/constants/hrConfig'

/** An empty version identifies only its own row, never an unnamed batch. */
export function getHrModelVersionGroup(records: ConfigRecord[], record: ConfigRecord): ConfigRecord[] {
  const version = record.modelVersion
  if ((typeof version !== 'string' && typeof version !== 'number') || !String(version).trim()) {
    return records.filter(item => item.id === record.id)
  }
  return records.filter(item => String(item.modelVersion ?? '') === String(version))
}

function inheritModelVersionStatus(records: ConfigRecord[], record: ConfigRecord): ConfigRecord {
  const group = getHrModelVersionGroup(records.filter(item => item.id !== record.id), record)
  return { ...record, enabled: (group[0] ?? record).enabled !== false }
}

/* ── State / Actions interfaces ────────────────────────────────────── */

export interface HrConfigState {
  /** 各模块数据，key = 模块类型 */
  data: Record<ConfigModuleKey, ConfigRecord[]>
  /** 当前编辑的记录 ID（null = 新建） */
  editingId: string | null
  /** 是否显示编辑弹窗 */
  showEditModal: boolean
}

export interface HrConfigActions {
  /** 新增记录 */
  addRecord: (moduleKey: ConfigModuleKey, values: ConfigFormValues) => void
  /** 更新记录 */
  updateRecord: (moduleKey: ConfigModuleKey, recordId: string, values: ConfigFormValues) => void
  /** 删除记录 */
  deleteRecord: (moduleKey: ConfigModuleKey, recordId: string) => void
  /** 启用/禁用记录；人力模型按非空版本号原子更新整组 */
  toggleRecordStatus: (moduleKey: ConfigModuleKey, recordId: string, enabled?: boolean) => void
  /** 批量导入（追加） */
  importRecords: (moduleKey: ConfigModuleKey, records: ConfigRecord[]) => void
  /** 获取模块数据 */
  getRecords: (moduleKey: ConfigModuleKey) => ConfigRecord[]
  /** 弹窗控制 */
  setShowEditModal: (show: boolean) => void
  setEditingId: (id: string | null) => void
}

/* ── Store ─────────────────────────────────────────────────────────── */

export const useHrConfigStore = create<HrConfigState & HrConfigActions>()(
  persist(
    (set, get) => ({
      data: { ...MOCK_CONFIG_DATA },
      editingId: null,
      showEditModal: false,

      addRecord: (moduleKey, values) => set((s) => {
        const record: ConfigRecord = {
          id: `cfg-${moduleKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...values,
        }
        const newRecord = moduleKey === 'hrModel'
          ? inheritModelVersionStatus(s.data.hrModel ?? [], record)
          : record
        return {
          data: {
            ...s.data,
            [moduleKey]: [...(s.data[moduleKey] ?? []), newRecord],
          },
          showEditModal: false,
          editingId: null,
        }
      }),

      updateRecord: (moduleKey, recordId, values) => set((s) => {
        const records = s.data[moduleKey] ?? []
        return {
          data: {
            ...s.data,
            [moduleKey]: records.map(record => {
              if (record.id !== recordId) return record
              const updated = { ...record, ...values }
              return moduleKey === 'hrModel' ? inheritModelVersionStatus(records, updated) : updated
            }),
          },
          showEditModal: false,
          editingId: null,
        }
      }),

      deleteRecord: (moduleKey, recordId) => set((s) => ({
        data: {
          ...s.data,
          [moduleKey]: (s.data[moduleKey] ?? []).filter(r => r.id !== recordId),
        },
      })),

      toggleRecordStatus: (moduleKey, recordId, requestedEnabled) => set((s) => {
        const records = s.data[moduleKey] ?? []
        const selected = records.find(record => record.id === recordId)
        if (!selected) return s
        const enabled = requestedEnabled ?? (selected.enabled === false)
        const affectedIds = new Set((moduleKey === 'hrModel'
          ? getHrModelVersionGroup(records, selected)
          : [selected]).map(record => record.id))
        return {
          data: {
            ...s.data,
            [moduleKey]: records.map(record => affectedIds.has(record.id) ? { ...record, enabled } : record),
          },
        }
      }),

      importRecords: (moduleKey, records) => set((s) => {
        const combined = [...(s.data[moduleKey] ?? [])]
        records.forEach(record => {
          combined.push(moduleKey === 'hrModel' ? inheritModelVersionStatus(combined, record) : record)
        })
        return { data: { ...s.data, [moduleKey]: combined } }
      }),

      getRecords: (moduleKey) => get().data[moduleKey] ?? [],

      setShowEditModal: (show) => set({ showEditModal: show }),
      setEditingId: (id) => set({ editingId: id }),
    }),
    { name: 'pms-hr-config', version: 2 },
  ),
)
