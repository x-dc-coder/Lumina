import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'

import { Button } from '@lumina/components/ui/button'
import type { Session } from '#/components/interact/types'
import type { SessionItem } from '#/lib/models/response/qa-admin'
import { DetailPanel } from '#/components/interact/detail-panel'
import { groupHistoryDesc } from '#/components/interact/group-history'
import { HistoryCard } from '#/components/interact/history-card'
import { LobbyView } from '#/components/interact/lobby-view'
import { QuestionCard } from '#/components/interact/question-card'
import { MobileSessionDrawer } from '#/components/interact/session-drawer'
import { SessionSidebarCompact } from '#/components/interact/session-sidebar-compact'
import { EmptyState, LoadingState } from '#/components/interact/primitives'
import { ScrollArea } from '@lumina/components/ui/scroll-area'
import {
  Splitter,
  SplitterPanel,
  SplitterHandle,
} from '@lumina/components/ui/splitter'
import { computeSessionProgress } from '#/components/interact/session-progress'
import { useQaSession } from '#/hooks/useQaSession'
import { useSidebarOpen } from '#/hooks/useSidebarOpen'
import { getSessionByHash, getSessionList } from '#/lib/apis/qa-admin'
import {
  getQaSplitterRatio,
  setQaSplitterRatio,
  QA_SPLITTER_DEFAULT_RATIO,
  QA_SPLITTER_MIN_RATIO,
  QA_SPLITTER_MAX_RATIO,
} from '#/lib/cookie'

interface InteractSearch {
  session?: string
}

export const Route = createFileRoute('/interact/')({
  validateSearch: (search: Record<string, unknown>): InteractSearch => {
    return {
      session: typeof search.session === 'string' ? search.session : undefined,
    }
  },
  component: InteractPage,
})

function InteractPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sessionHash, setSessionHash] = useState<string>('')
  const [sessionError, setSessionError] = useState<
    'not_found' | 'expired' | null
  >(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [splitterRatio, setSplitterRatio] = useState<number>(() => {
    return getQaSplitterRatio() ?? QA_SPLITTER_DEFAULT_RATIO
  })

  const handleSplitterResizeEnd = (sizes: number[]) => {
    if (sizes.length > 0 && typeof sizes[0] === 'number') {
      const ratio = Math.round(sizes[0])
      setSplitterRatio(ratio)
      setQaSplitterRatio(ratio)
    }
  }

  const { setProgress } = useSidebarOpen()

  const search = useSearch({ from: '/interact/' })
  const navigate = useNavigate()
  const hashParam = search.session

  const isConnected = !!sessionHash

  // URL 有 hash → 加载会话详情
  useEffect(() => {
    if (!hashParam) {
      setSessionHash('')
      setSelectedSessionId('')
      setSessionError(null)
      return
    }

    setSessionError(null)
    setIsLoading(true)
    ;(async () => {
      try {
        const res = await getSessionByHash(hashParam)
        const sessionData = (res.data?.items || [])[0] as
          SessionItem | undefined
        if (!sessionData) {
          setSessionError('not_found')
          setSessionHash('')
          setSelectedSessionId('')
        } else if (sessionData.status !== 'active') {
          setSessionError('expired')
          setSessionHash('')
          setSelectedSessionId('')
        } else {
          const mappedSession: Session = {
            id: sessionData.id,
            hash: sessionData.hash,
            title: sessionData.title,
            agent: sessionData.agent,
            type: sessionData.type,
            status: sessionData.status,
            onlineDevices: sessionData.online_devices,
            owner: '',
            questions: [],
            updatedAt: sessionData.updated_at || sessionData.created_at,
            expiresAt: sessionData.expires_at || '',
            projectId:
              sessionData.project_id && sessionData.project_id !== '0'
                ? sessionData.project_id
                : undefined,
            projectName: sessionData.project_name || undefined,
          }
          setSessions((prev) => {
            const idx = prev.findIndex((s) => s.id === mappedSession.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = {
                ...next[idx],
                ...mappedSession,
                questions: next[idx].questions,
              }
              return next
            }
            return [mappedSession, ...prev]
          })
          setSelectedSessionId(sessionData.id)
          setSessionHash(hashParam)
        }
      } catch (e) {
        console.error('Failed to load session info:', e)
        setSessionError('not_found')
        setSessionHash('')
        setSelectedSessionId('')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [hashParam])

  useEffect(() => {
    sessionStorage.setItem('qa_page_active', '1')
    return () => {
      sessionStorage.removeItem('qa_page_active')
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getSessionList({
          status: 'active',
          size: 50,
        })
        const apiSessions = res.data?.items || []

        const mapped: Session[] = apiSessions.map((item) => ({
          id: item.id,
          hash: item.hash,
          title: item.title,
          agent: item.agent,
          type: item.type,
          status: item.status,
          onlineDevices: item.online_devices,
          owner: '',
          questions: [],
          updatedAt: item.updated_at || item.created_at,
          expiresAt: item.expires_at || '',
          projectId:
            item.project_id && item.project_id !== '0'
              ? item.project_id
              : undefined,
          projectName: item.project_name || undefined,
        }))

        setSessions(mapped)
      } catch (e) {
        console.error('Failed to load sessions:', e)
      }
    })()
  }, [])

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id)
    const target = sessions.find((s) => s.id === id)
    if (target?.hash) {
      setSessionError(null)
      setSessionHash(target.hash)
      navigate({
        to: '/interact',
        search: { session: target.hash },
        replace: true,
      })
    }
  }

  const {
    questions,
    activeSupplement,
    session: currentSession,
    submitAnswer,
    skipQuestion,
    requestSupplement,
    viewOptionDetail,
    backToQuestionDetail,
    isSupplementLoading,
    dismissSupplementLoading,
  } = useQaSession({
    sessionHash: sessionHash || null,
    onSessionEnd: () => {
      setSessionHash('')
      setSelectedSessionId('')
      navigate({ to: '/interact/thank', replace: true })
    },
    onReject: () => {
      setSessionHash('')
      setSelectedSessionId('')
      setSessionError((prev) => prev ?? 'expired')
    },
  })

  useEffect(() => {
    if (currentSession) {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === currentSession.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = {
            ...next[idx],
            ...currentSession,
            projectId: currentSession.projectId || next[idx].projectId,
            projectName: currentSession.projectName || next[idx].projectName,
          }
          return next
        }
        return [...prev, currentSession]
      })
    }
  }, [currentSession])

  const activeQuestion = questions.find((q) => q.status === 'pending')
  // 已回答 / 已取消进入历史区，按事件时间 DESC（最新问答在最上方）。
  const groupedHistory = groupHistoryDesc(questions)

  // 详情面板内容：底层=当前待答问题级 supplement，上层=选项级 supplement
  const questionSupp = activeQuestion?.supplements?.find(
    (s) => s.target_type === 'question',
  )
  const isViewingOption = activeSupplement?.target_type === 'option'
  const activeDetailSupp = isViewingOption
    ? activeSupplement
    : activeSupplement?.target_type === 'question'
      ? activeSupplement
      : questionSupp

  // 只要存在活跃选项 supplement 或当前待答题目自带问题级 supplement，即展开右侧详情
  const hasDetailContent = activeDetailSupp != null

  // 当前激活的选项 ID（用于 OptionDetailLabel 的 isActive 状态）
  const activeOptionId = isViewingOption
    ? activeSupplement.target_id
    : undefined

  const questionContent = isViewingOption
    ? (questionSupp?.content ?? '')
    : (activeDetailSupp?.content ?? '')
  const questionContentType = isViewingOption
    ? (questionSupp?.content_type ?? 'markdown')
    : (activeDetailSupp?.content_type ?? 'markdown')
  const optionContent = isViewingOption ? activeSupplement.content : ''
  const optionContentType = isViewingOption
    ? activeSupplement.content_type
    : 'markdown'

  const current = sessions.find((s) => s.id === selectedSessionId)

  // 进度以 WebSocket 推送的 questions 为准；列表接口的 session.questions 恒为空。
  useEffect(() => {
    if (!sessionHash) {
      setProgress(null)
      return
    }
    setProgress(computeSessionProgress(questions))
  }, [sessionHash, questions, setProgress])

  if (sessionError) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center justify-center p-4">
          <div className="w-full max-w-lg border border-line bg-surface p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-amber-500/10">
                <AlertCircle className="size-8 text-amber-500" aria-hidden />
              </div>

              <h1 className="text-xl font-bold tracking-tight text-sea-ink">
                {sessionError === 'not_found'
                  ? '会话不存在或链接已失效'
                  : '会话已过期或已归档'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-sea-ink-soft">
                {sessionError === 'not_found'
                  ? '未找到对应的问答会话，请检查链接是否正确，或返回交互大厅选择活跃会话。'
                  : '该问答会话已结束或超过有效期，无法继续交互。请返回交互大厅选择其他活跃会话。'}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => {
                  setSessionError(null)
                  navigate({ to: '/interact', replace: true })
                }}
                className="w-full bg-sea-ink text-foam hover:bg-lagoon-deep"
              >
                返回交互大厅
                <ArrowRight className="ml-1.5 size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: '/console/qa', replace: true })}
                className="w-full text-xs text-sea-ink-soft"
              >
                前往问答管理
              </Button>
            </div>
          </div>
        </div>

        <SessionSidebarCompact
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={handleSelectSession}
        />

        <div className="xl:hidden">
          <MobileSessionDrawer
            sessions={sessions}
            selectedId={selectedSessionId}
            onSelect={handleSelectSession}
          />
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex min-w-0 flex-1 items-center justify-center p-4">
            <LoadingState text="正在准备会话…" />
          </div>
        ) : (
          <LobbyView sessions={sessions} />
        )}

        <SessionSidebarCompact
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={handleSelectSession}
        />

        <div className="xl:hidden">
          <MobileSessionDrawer
            sessions={sessions}
            selectedId={selectedSessionId}
            onSelect={handleSelectSession}
          />
        </div>
      </div>
    )
  }

  const questionPanelNode = (
    <aside className="relative flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <ScrollArea className="min-h-0 flex-1 pt-2" hideScrollbar>
        <div className="space-y-4">
          {isLoading ? (
            <LoadingState text="正在准备会话…" />
          ) : activeQuestion ? (
            <QuestionCard
              question={activeQuestion}
              agent={current?.agent}
              onSubmit={(answer) => submitAnswer(activeQuestion.id, answer)}
              onSkip={() => skipQuestion(activeQuestion.id)}
              onRequestSupplement={(payload) => requestSupplement(payload)}
              onViewOptionDetail={(optId) => viewOptionDetail(optId)}
              isSupplementLoading={isSupplementLoading}
              onDismissSupplementLoading={dismissSupplementLoading}
              activeOptionId={activeOptionId}
            />
          ) : (
            <EmptyState
              text={
                selectedSessionId ? '等待问题推送…' : '请在右侧选择一个会话'
              }
            />
          )}

          <HistoryCard groupedHistory={groupedHistory} />
        </div>
      </ScrollArea>
    </aside>
  )

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* 第一/二列：问答区 + 详情面板 */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {hasDetailContent ? (
          <Splitter
            direction="horizontal"
            className="h-full w-full min-w-0 flex-1"
            onResizeEnd={handleSplitterResizeEnd}
          >
            <SplitterPanel
              defaultSize={splitterRatio}
              minSize={QA_SPLITTER_MIN_RATIO}
              maxSize={QA_SPLITTER_MAX_RATIO}
              className="relative flex h-full min-h-0 flex-col overflow-hidden"
            >
              {questionPanelNode}
            </SplitterPanel>

            <SplitterHandle />

            <SplitterPanel
              minSize={30}
              className="relative flex h-full min-h-0 flex-col overflow-hidden"
            >
              <DetailPanel
                visible={hasDetailContent}
                activeOption={{ label: activeDetailSupp.content_type }}
                isMotionDemo={false}
                questionContent={questionContent}
                questionContentType={questionContentType}
                optionContent={optionContent}
                optionContentType={optionContentType}
                optionId={activeDetailSupp.id}
                onBack={() => backToQuestionDetail()}
              />
            </SplitterPanel>
          </Splitter>
        ) : (
          <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden">
            {questionPanelNode}
          </div>
        )}
      </div>

      {/* 第三列：会话列表（≥xl · 真 flex 子列，宽度过渡） */}
      <SessionSidebarCompact
        sessions={sessions}
        selectedId={selectedSessionId}
        onSelect={handleSelectSession}
      />

      <div className="xl:hidden">
        <MobileSessionDrawer
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={handleSelectSession}
        />
      </div>
    </div>
  )
}
