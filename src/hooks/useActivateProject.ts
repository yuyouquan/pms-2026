'use client'

import { useCallback } from 'react'
import { useProjectStore, type ProjectState } from '@/stores/project'
import { useTransferStore } from '@/stores/transfer'
import { PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { buildTosTypeRows, getMainTosType } from '@/lib/tosTypeRules'

type ActivatableProject = ProjectState['projects'][number]

interface ActivateProjectOptions {
  market?: string
  tosType?: string
}

export function useActivateProject() {
  const {
    setSelectedProject,
    setSelectedMarketTab,
    setSelectedTosTypeTab,
    tosTypeConfigsByProjectId,
  } = useProjectStore()
  const setTransferView = useTransferStore(state => state.setTransferView)

  return useCallback((project: ActivatableProject, options: ActivateProjectOptions = {}) => {
    setTransferView(null)
    setSelectedProject(project)

    const projectMarkets: readonly string[] = project.markets || []
    if (projectMarkets.length) {
      const selectedMarket = options.market && projectMarkets.includes(options.market)
        ? options.market
        : projectMarkets[0]
      setSelectedMarketTab(selectedMarket)
    }

    if (project.type === PROJECT_TYPE_TOS_VERSION) {
      const typeRows = buildTosTypeRows(
        project.versionTypes || [],
        project.versionType || '',
        tosTypeConfigsByProjectId[project.id],
      )
      const requestedType = options.tosType && typeRows.some(row => row.type === options.tosType)
        ? options.tosType
        : undefined
      setSelectedTosTypeTab(requestedType || getMainTosType(typeRows) || typeRows[0]?.type || 'Full')
    }
  }, [
    setSelectedMarketTab,
    setSelectedProject,
    setSelectedTosTypeTab,
    setTransferView,
    tosTypeConfigsByProjectId,
  ])
}
