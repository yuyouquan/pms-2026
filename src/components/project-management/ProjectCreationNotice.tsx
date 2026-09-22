import { Tag } from 'antd'
import type { ProjectCreationNotification } from '@/types/projectRegistry'

export default function ProjectCreationNotice({ notice }: { notice: ProjectCreationNotification }) {
  return (
    <section className="pms-project-creation-notice" aria-label="项目创建模拟通知">
      <div className="pms-project-creation-notice__heading"><strong>飞书提醒</strong><Tag color="purple">模拟通知</Tag></div>
      <div className="pms-project-creation-notice__meta"><span>接收人</span><strong>{notice.recipients.join('、')}</strong></div>
      <div className="pms-project-creation-notice__meta"><span>生成时间</span><span>{new Date(notice.timestamp).toLocaleString('zh-CN', { hour12: false })}</span></div>
      <div className="pms-project-creation-notice__message"><strong>{notice.subject}</strong><p>{notice.body}</p></div>
      <div className="pms-project-creation-notice__hint">当前为模拟通知，未向飞书发送真实消息。可在项目历史中查看。</div>
    </section>
  )
}
