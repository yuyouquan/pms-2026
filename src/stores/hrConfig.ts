import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConfigModuleKey, ConfigRecord, ConfigFormValues } from '@/types/hrConfig'
import { MOCK_CONFIG_DATA } from '@/constants/hrConfig'

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
        const newRecord: ConfigRecord = {
          id: `cfg-${moduleKey}-${Date.now()}`,
          ...values,
        }
        return {
          data: {
            ...s.data,
            [moduleKey]: [...(s.data[moduleKey] ?? []), newRecord],
          },
          showEditModal: false,
          editingId: null,
        }
      }),

      updateRecord: (moduleKey, recordId, values) => set((s) => ({
        data: {
          ...s.data,
          [moduleKey]: (s.data[moduleKey] ?? []).map(r =>
            r.id === recordId ? { ...r, ...values } : r,
          ),
        },
        showEditModal: false,
        editingId: null,
      })),

      deleteRecord: (moduleKey, recordId) => set((s) => ({
        data: {
          ...s.data,
          [moduleKey]: (s.data[moduleKey] ?? []).filter(r => r.id !== recordId),
        },
      })),

      importRecords: (moduleKey, records) => set((s) => ({
        data: {
          ...s.data,
          [moduleKey]: [...(s.data[moduleKey] ?? []), ...records],
        },
      })),

      getRecords: (moduleKey) => get().data[moduleKey] ?? [],

      setShowEditModal: (show) => set({ showEditModal: show }),
      setEditingId: (id) => set({ editingId: id }),
    }),
    { name: 'pms-hr-config', version: 2 },
  ),
)
