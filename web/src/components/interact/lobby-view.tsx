import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bot, Clock, FolderOpen, Loader2, Plus, Users } from 'lucide-react'

import { Button } from '@lumina/components/ui/button'
import { ScrollArea } from '@lumina/components/ui/scroll-area'
import { createSession } from '#/lib/apis/qa-admin'
import { getProjectList } from '#/lib/apis/project'
import type { ProjectItem } from '#/lib/models/response/project'
import { useSidebarOpen } from '#/hooks/useSidebarOpen'

import { Kicker, PanelCard, LoadingState } from './primitives'
import type { Session } from './types'

/**
 * 未连接态大厅：项目选择 + 活跃会话列表。
 */
export function LobbyView({ sessions }: { sessions: Session[] }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getProjectList({ size: 100 })
        setProjects(res.data?.items || [])
      } catch (e) {
        console.error('Failed to load projects:', e)
      } finally {
        setLoadingProjects(false)
      }
    })()
  }, [])

  async function handleCreate(projectId: string) {
    setCreating(true)
    try {
      const createRes = await createSession({
        project_id: projectId,
        title: `临时问答 ${new Date().toLocaleString('zh-CN')}`,
        agent: 'web',
        type: 'temporary',
      })
      const newSession = createRes.data
      if (newSession?.hash) {
        navigate({
          to: '/interact',
          search: { session: newSession.hash },
          replace: true,
        })
      }
    } catch (e) {
      console.error('Failed to create session:', e)
    } finally {
      setCreating(false)
    }
  }

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || null
  const filteredSessions = selectedProjectId
    ? sessions.filter((s) => s.projectId === selectedProjectId)
    : sessions

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center gap-8 p-6">
      <div className="w-full max-w-sm space-y-4">
        <PanelCard
          flushHeader
          header={
            <div className="px-4 py-2.5">
              <Kicker>选择项目</Kicker>
            </div>
          }
        >
          {loadingProjects ? (
            <LoadingState text="加载项目中…" />
          ) : projects.length === 0 ? (
            <div className="py-8 text-center">
              <FolderOpen
                className="mx-auto mb-2 size-8 text-sea-ink-soft/30"
                aria-hidden
              />
              <p className="text-xs text-sea-ink-soft/50">暂无可用项目</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[460px]">
              <div className="divide-y divide-line/30">
                {projects.map((project) => {
                  const isSelected = selectedProjectId === project.id
                  const projectSessionCount = sessions.filter(
                    (s) => s.projectId === project.id,
                  ).length

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() =>
                        setSelectedProjectId((prev) =>
                          prev === project.id ? null : project.id,
                        )
                      }
                      className={`group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                        isSelected
                          ? 'bg-lagoon/10 text-sea-ink'
                          : 'hover:bg-lagoon/5 text-sea-ink'
                      }`}
                    >
                      <FolderOpen
                        className={`size-4 shrink-0 transition-colors ${
                          isSelected
                            ? 'text-lagoon'
                            : 'text-lagoon/70 group-hover:text-lagoon'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="truncate text-[11px] text-sea-ink-soft/60">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 text-[10px] font-mono border transition-colors ${
                          projectSessionCount > 0
                            ? 'border-lagoon/30 bg-lagoon/10 text-lagoon-deep font-semibold'
                            : 'border-line/40 bg-sand/40 text-sea-ink-soft/70'
                        }`}
                      >
                        {projectSessionCount} 会话
                      </span>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </PanelCard>
      </div>

      <ActiveSessionList
        sessions={filteredSessions}
        selectedProjectId={selectedProjectId}
        selectedProject={selectedProject}
        creating={creating}
        onCreateSession={handleCreate}
      />
    </div>
  )
}

function ActiveSessionList({
  sessions,
  selectedProjectId,
  selectedProject,
  creating,
  onCreateSession,
}: {
  sessions: Session[]
  selectedProjectId: string | null
  selectedProject: ProjectItem | null
  creating: boolean
  onCreateSession: (projectId: string) => void
}) {
  const navigate = useNavigate()
  const { setOpen } = useSidebarOpen()

  return (
    <div className="w-full max-w-sm space-y-4">
      <PanelCard
        flushHeader
        header={
          <div className="flex items-center justify-between px-4 py-2.5">
            <Kicker>
              {selectedProject
                ? `活跃会话 · ${selectedProject.name}`
                : '活跃会话'}
            </Kicker>
            {selectedProject && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={creating}
                onClick={() => onCreateSession(selectedProject.id)}
                className="h-6 text-[11px] px-2 rounded-none border-line text-sea-ink hover:bg-lagoon/10 hover:text-lagoon-deep"
              >
                {creating ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <Plus className="mr-1 size-3" />
                )}
                新建临时会话
              </Button>
            )}
          </div>
        }
        bodyClassName="p-0"
      >
        {sessions.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-xs text-sea-ink-soft">
              {selectedProject ? '该项目暂无活跃问答会话' : '暂无活跃问答会话'}
            </p>
            {selectedProject ? (
              <Button
                type="button"
                size="sm"
                disabled={creating}
                onClick={() => onCreateSession(selectedProject.id)}
                className="rounded-none bg-lagoon text-foam hover:bg-lagoon-deep text-xs"
              >
                {creating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-3.5" />
                )}
                在此项目下新建临时会话
              </Button>
            ) : (
              <p className="text-[11px] text-sea-ink-soft/70">
                请在左侧选择项目以新建会话，或等待 Agent 推送问题
              </p>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[460px]">
            <div className="space-y-1 p-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (session.hash) {
                      navigate({
                        to: '/interact',
                        search: { session: session.hash },
                        replace: true,
                      })
                    }
                  }}
                  className="group flex w-full cursor-pointer flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-lagoon/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium leading-tight text-sea-ink truncate">
                      {session.title}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-0.2 text-[10px] font-mono border ${
                        session.type === 'permanent'
                          ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
                          : 'border-line bg-sand/60 text-sea-ink-soft'
                      }`}
                    >
                      {session.type === 'permanent' ? '永久' : '临时'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-sea-ink-soft">
                    {!selectedProjectId && session.projectName && (
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
                    <span className="flex items-center gap-0.5">
                      <Clock className="size-2.5" aria-hidden />
                      {session.updatedAt}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PanelCard>
    </div>
  )
}
