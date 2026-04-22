'use client'
import { Button } from 'antd'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'

type Props = { data: { text: string; href: string; module?: string; projectId?: string } }

export function LinkCard({ data }: Props) {
  const { setSelectedProject, projects } = useProjectStore()
  const { setActiveModule } = useUiStore()

  const onClick = () => {
    if (data.module === 'projectSpace' && data.projectId) {
      const p = projects.find(x => x.id === data.projectId)
      if (p) {
        setSelectedProject(p)
        setActiveModule('projectSpace')
      }
      return
    }
    if (data.module === 'transfer') {
      setActiveModule('projects')
      // Demo: just navigate to main workspace
      return
    }
  }

  return (
    <Button type="link" onClick={onClick} style={{ paddingLeft: 0 }}>
      {data.text}
    </Button>
  )
}
