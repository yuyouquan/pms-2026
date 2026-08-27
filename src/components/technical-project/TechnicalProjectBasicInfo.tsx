'use client'

import { useMemo } from 'react'
import { Typography } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import CollapsibleInformationSection from '@/components/project-info/CollapsibleInformationSection'
import { useSingleEnumOptions } from '@/hooks/useEnumOptions'
import type { TechnicalSubproject } from '@/types/technicalProject'

const { Text } = Typography

export interface TechnicalProjectBasicInfoProps {
  subproject: TechnicalSubproject
  machineName: (projectId: string) => string
  readOnly: boolean
}

const configuredValue = (value: string) => value || <Text type="secondary">待配置</Text>

export default function TechnicalProjectBasicInfo({
  subproject,
  machineName,
  readOnly,
}: TechnicalProjectBasicInfoProps) {
  const coreHistory = useMemo(() => subproject.configuration.coreValue ? [subproject.configuration.coreValue] : [], [subproject.configuration.coreValue])
  const developmentHistory = useMemo(() => subproject.configuration.developmentMode ? [subproject.configuration.developmentMode] : [], [subproject.configuration.developmentMode])
  const tosHistory = useMemo(() => subproject.configuration.firstTosVersion ? [subproject.configuration.firstTosVersion] : [], [subproject.configuration.firstTosVersion])
  const coreOptions = useSingleEnumOptions('core-value', coreHistory)
  const developmentOptions = useSingleEnumOptions('technical-development-mode', developmentHistory)
  const tosOptions = useSingleEnumOptions('first-sale-tos', tosHistory)
  const configuredLabel = (value: string, options: Array<{ value: string; label: string }>) => (
    options.find(option => option.value === value)?.label || configuredValue(value)
  )
  return (
    <CollapsibleInformationSection title="基础信息" icon={<InfoCircleOutlined />} variant="basic" count={4}>
      <div aria-label={`${subproject.name}基础信息`} aria-readonly={readOnly}>
        <div className="pms-project-info-display-rows">
          <div className="pms-project-info-display-grid pms-project-info-display-grid--technical-basic">
            {[
              { label: '核心价值', value: configuredLabel(subproject.configuration.coreValue, coreOptions) },
              { label: '开发模式', value: configuredLabel(subproject.configuration.developmentMode, developmentOptions) },
              { label: '首导tOS', value: configuredLabel(subproject.configuration.firstTosVersion, tosOptions) },
              { label: '首导整机产品', value: machineName(subproject.configuration.firstMachineProjectId) },
            ].map(item => (
              <div className="pms-project-info-display-item" key={item.label}>
                <div className="pms-project-info-display-label">{item.label}</div>
                <div className="pms-project-info-display-value">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleInformationSection>
  )
}
