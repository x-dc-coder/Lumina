import { Bot, Check, Clock, Users } from 'lucide-react'

import type { Session } from './types'

/**
 * 会话列表项 —— 被 session-panel（桌面第三列/移动抽屉）复用。
 */
export function SessionItem({
  session,
  isActive,
  onSelect,
}: {
  session: Session
  isActive: boolean
  onSelect: (id: string) => void
}) {
  const pending = session.questions.filter((q) => !q.answered).length

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      className={`group flex w-full cursor-pointer flex-col gap-1.5 rounded-chip px-3 py-2.5 text-left transition-colors duration-150 ${
        isActive
          ? 'bg-lagoon/10 text-sea-ink'
          : 'text-sea-ink-soft hover:bg-lagoon/5 hover:text-sea-ink'
      }`}
      aria-label={`会话：${session.title}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="display-title text-sm font-medium leading-tight truncate">
          {session.title}
        </span>
        <span
          className={`shrink-0 px-1 py-0.2 text-[9px] font-mono border ${
            session.type === 'permanent'
              ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
              : 'border-line bg-sand/60 text-sea-ink-soft'
          }`}
        >
          {session.type === 'permanent' ? '永久' : '临时'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {session.projectName && (
          <span className="font-mono text-sea-ink bg-sand/60 px-1 py-0.2 border border-line text-[10px]">
            {session.projectName}
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Bot className="size-3" aria-hidden />
          {session.agent}
        </span>
        <span className="flex items-center gap-0.5">
          <Users className="size-3" aria-hidden />
          {session.onlineDevices}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-0.5 text-[10px]">
          <Clock className="size-2.5" aria-hidden />
          {session.updatedAt}
        </span>
        {pending > 0 ? (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-lagoon text-[9px] font-bold text-white">
            {pending}
          </span>
        ) : (
          <Check className="size-3.5 text-lagoon" aria-hidden />
        )}
      </div>
    </button>
  )
}
