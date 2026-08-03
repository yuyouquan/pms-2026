'use client'

import { Alert, Descriptions, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
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
    <CollapsibleInformationSection title="基础信息" icon={<SettingOutlined />}>
      <div aria-label={`${subproject.name}基础信息`} aria-readonly={readOnly}>
        {readOnly && (
          <Alert
            showIcon
            type="info"
            message="该子任务已停用，仅可查看历史基础信息"
            style={{ margin: '12px 16px 0' }}
          />
        )}
        <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} style={{ padding: 16 }}>
          <Descriptions.Item label="核心价值">{configuredValue(subproject.configuration.coreValue)}</Descriptions.Item>
          <Descriptions.Item label="开发模式">{configuredValue(subproject.configuration.developmentMode)}</Descriptions.Item>
          <Descriptions.Item label="首导tOS">{subproject.configuration.firstTosVersion || '-'}</Descriptions.Item>
          <Descriptions.Item label="首导整机产品">{machineName(subproject.configuration.firstMachineProjectId)}</Descriptions.Item>
        </Descriptions>
      </div>
    </CollapsibleInformationSection>
  )
}
