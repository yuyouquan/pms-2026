'use client'

import { Typography } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import CollapsibleInformationSection from '@/components/project-info/CollapsibleInformationSection'
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
  return (
    <CollapsibleInformationSection title="基础信息" icon={<InfoCircleOutlined />} variant="basic" count={4}>
      <div aria-label={`${subproject.name}基础信息`} aria-readonly={readOnly}>
        <div className="pms-project-info-display-rows">
          <div className="pms-project-info-display-grid pms-project-info-display-grid--technical-basic">
            {[
              { label: '核心价值', value: configuredValue(subproject.configuration.coreValue) },
              { label: '开发模式', value: configuredValue(subproject.configuration.developmentMode) },
              { label: '首导tOS', value: subproject.configuration.firstTosVersion || '-' },
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
