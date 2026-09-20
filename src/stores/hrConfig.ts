import { validateNonLaborSubjects } from '@/lib/nonLaborInvestment'
import { hasGlobalPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { pmsLocalStorage } from '@/lib/mockDatasetStorage'
import type { ConfigModuleKey, ConfigRecord, ConfigFormValues } from '@/types/hrConfig'
import { MOCK_CONFIG_DATA, refreshMachineModelFixtures } from '@/constants/hrConfig'

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

export const canEditHrConfig = (moduleKey: ConfigModuleKey) => !['hrModel', 'nonLaborSubject', 'feeRate'].includes(moduleKey) || hasGlobalPermission(useProjectStore.getState().currentLoginUser, moduleKey !== 'nonLaborSubject' ? 'configCenter:hrModelEdit' : 'configCenter:nonLaborSubjectEdit')

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
  setFeeRate: (value: number) => void
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

      setFeeRate: value => {
        if (!canEditHrConfig('feeRate')) throw new Error('无费率编辑权限')
        if (!Number.isFinite(value) || value < 0) throw new Error('费率必须为非负数字')
        set(s => ({ data: { ...s.data, feeRate: [{ id: 'resource-fee-rate', value, enabled: true }] } }))
      },
      addRecord: (moduleKey, values) => set((s) => {
        if (!canEditHrConfig(moduleKey) || moduleKey === 'feeRate') return s
        const record: ConfigRecord = {
          id: `cfg-${moduleKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...values,
        }
        if (moduleKey === 'nonLaborSubject') {
          record.secondarySubject = String(record.secondarySubject ?? '').trim()
          record.tertiarySubject = String(record.tertiarySubject ?? '').trim()
          validateNonLaborSubjects([...(s.data.nonLaborSubject ?? []), record])
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
        if (!canEditHrConfig(moduleKey) || moduleKey === 'feeRate') return s
        const records = s.data[moduleKey] ?? []
        if (moduleKey === 'nonLaborSubject') {
          values = { ...values }
          if ('secondarySubject' in values) values.secondarySubject = String(values.secondarySubject ?? '').trim()
          if ('tertiarySubject' in values) values.tertiarySubject = String(values.tertiarySubject ?? '').trim()
          validateNonLaborSubjects(records.map(record => record.id === recordId ? { ...record, ...values } : record))
        }
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

      deleteRecord: (moduleKey, recordId) => set((s) => (!canEditHrConfig(moduleKey) || moduleKey === 'feeRate') ? s : ({
        data: {
          ...s.data,
          [moduleKey]: (s.data[moduleKey] ?? []).filter(r => r.id !== recordId),
        },
      })),

      toggleRecordStatus: (moduleKey, recordId, requestedEnabled) => set((s) => {
        if (!canEditHrConfig(moduleKey) || moduleKey === 'feeRate') return s
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
        if (!canEditHrConfig(moduleKey) || moduleKey === 'feeRate') return s
        const combined = [...(s.data[moduleKey] ?? [])]
        records.forEach(record => {
          const normalized = moduleKey === 'nonLaborSubject'
            ? { ...record, secondarySubject: String(record.secondarySubject ?? '').trim(), tertiarySubject: String(record.tertiarySubject ?? '').trim() } : record
          combined.push(moduleKey === 'hrModel' ? inheritModelVersionStatus(combined, normalized) : normalized)
        })
        if (moduleKey === 'nonLaborSubject') validateNonLaborSubjects(combined)
        return { data: { ...s.data, [moduleKey]: combined } }
      }),

      getRecords: (moduleKey) => get().data[moduleKey] ?? [],

      setShowEditModal: (show) => set({ showEditModal: show }),
      setEditingId: (id) => set({ editingId: id }),
    }),
    {
      storage: createJSONStorage(() => pmsLocalStorage),
      name: 'pms-hr-config', version: 2,
      partialize: state => ({ data: state.data }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<HrConfigState>
        const data = { ...current.data, ...saved.data }
        data.hrModel = refreshMachineModelFixtures(data.hrModel ?? [])
        return { ...current, data: JSON.stringify(data) === JSON.stringify(current.data) ? current.data : data }
      },
    },
  ),
)
