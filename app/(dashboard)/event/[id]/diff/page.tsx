"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import { ArrowLeft, RotateCcw, Clock, FileCode2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppIcon } from "@/components/app-icon"
import { RiskBadge } from "@/components/risk-badge"
import { RollbackModal } from "@/components/rollback-modal"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import type { Event, Snapshot, Agent } from "@/lib/types"
import { ACTION_LABELS } from "@/lib/types"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EventDiffPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRollback, setShowRollback] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single()

      if (eventData) {
        setEvent(eventData)

        if (eventData.agent_id) {
          const { data: agentData } = await supabase
            .from("agents")
            .select("*")
            .eq("id", eventData.agent_id)
            .single()
          setAgent(agentData)
        }
      }

      const { data: snapshotData } = await supabase
        .from("snapshots")
        .select("*")
        .eq("event_id", id)
        .order("captured_at", { ascending: true })

      setSnapshots(snapshotData || [])
      setLoading(false)
    }

    fetchData()
  }, [id, supabase])

  const beforeSnapshot = snapshots.find((s) => s.snapshot_type === "before")
  const afterSnapshot  = snapshots.find((s) => s.snapshot_type === "after")

  const getSnapshotContent = (snapshot: Snapshot | undefined): string => {
    if (!snapshot?.content) return ""
    if (typeof snapshot.content === "string") return snapshot.content
    if (snapshot.content.body)    return String(snapshot.content.body)
    if (snapshot.content.text)    return String(snapshot.content.text)
    if (snapshot.content.content) return String(snapshot.content.content)
    return JSON.stringify(snapshot.content, null, 2)
  }

  const canRollback  = event?.rollback_status === "available"
  const isRolledBack = event?.status === "rolled_back"

  if (loading) {
    return (
      <div className="min-h-screen">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-xl sticky top-0 z-20"
        >
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="h-8 w-8 skeleton rounded-lg" />
            <div className="h-10 w-10 skeleton rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 skeleton rounded-md" />
              <div className="h-4 w-32 skeleton rounded-md" />
            </div>
          </div>
        </motion.header>
        <div className="p-6 space-y-4">
          <div className="h-16 skeleton rounded-lg" />
          <div className="h-96 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">Event not found</h2>
          <Link href="/timeline" className="text-sm text-[var(--accent)] hover:underline">
            Back to Timeline
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-20"   // pb for sticky bar
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-xl sticky top-0 z-20"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => router.back()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-[var(--text-muted)]
                         hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                         border border-[var(--border)] transition-all duration-150"
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>

            <motion.div whileHover={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.3 }}>
              <AppIcon app={event.app} size="md" />
            </motion.div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                  {ACTION_LABELS[event.action_type] || event.action_type}
                </h1>
                <RiskBadge
                  level={event.risk_level}
                  score={event.risk_score ?? undefined}
                  reasons={event.risk_reasons ?? undefined}
                />
                {isRolledBack && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full
                               bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Rolled back
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(event.created_at)}
                </span>
                {agent && (
                  <span className="font-mono px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-xs">
                    via {agent.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Metadata strip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]/50 backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Event ID:</span>
            <span className="font-mono text-[var(--text-primary)] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">
              {event.id.slice(0, 8)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Created: </span>
            <span className="text-[var(--text-primary)]">{formatDate(event.created_at)}</span>
          </div>
          {event.metadata?.recipient != null && (
            <div>
              <span className="text-[var(--text-muted)]">Recipient: </span>
              <span className="text-[var(--text-primary)]">{String(event.metadata.recipient)}</span>
            </div>
          )}
          {event.metadata?.subject != null && (
            <div>
              <span className="text-[var(--text-muted)]">Subject: </span>
              <span className="text-[var(--text-primary)]">{String(event.metadata.subject)}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Diff View */}
      <div className="p-6">
        {snapshots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.3 }}
            className="flex flex-col items-center justify-center py-20 text-center
                       border border-[var(--border)] rounded-xl bg-[var(--bg-surface)]"
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-elevated)]
                         border border-[var(--border)] mb-6"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <FileCode2 className="h-8 w-8 text-[var(--text-muted)]" />
            </motion.div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              No content snapshot available
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm">
              This event does not have before/after snapshots recorded.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-[var(--border)] overflow-hidden shadow-2xl shadow-black/40"
          >
            <div className="grid grid-cols-2 text-sm font-medium border-b border-[var(--border)] bg-[var(--bg-surface)]">
              <div className="px-4 py-3 border-r border-[var(--border)] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Before
              </div>
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                After
              </div>
            </div>
            <div className="diff-viewer-wrapper">
              <ReactDiffViewer
                oldValue={getSnapshotContent(beforeSnapshot)}
                newValue={getSnapshotContent(afterSnapshot)}
                splitView={true}
                compareMethod={DiffMethod.WORDS}
                useDarkTheme={true}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: "#09090b",
                      diffViewerColor: "#fafafa",
                      addedBackground: "#10b98115",
                      addedColor: "#10b981",
                      removedBackground: "#ef444415",
                      removedColor: "#ef4444",
                      wordAddedBackground: "#10b98130",
                      wordRemovedBackground: "#ef444430",
                      addedGutterBackground: "#10b98110",
                      removedGutterBackground: "#ef444410",
                      gutterBackground: "#09090b",
                      gutterBackgroundDark: "#09090b",
                      highlightBackground: "#2a2a3020",
                      highlightGutterBackground: "#2a2a30",
                      codeFoldGutterBackground: "#09090b",
                      codeFoldBackground: "#09090b",
                      emptyLineBackground: "#09090b",
                      codeFoldContentColor: "#71717a",
                    },
                  },
                  contentText: {
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "13px",
                    lineHeight: "1.7",
                  },
                  gutter: { minWidth: "48px", padding: "0 12px" },
                }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Risk Analysis */}
      {event.risk_reasons && event.risk_reasons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-6 pb-6"
        >
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Risk Analysis</h3>
                <ul className="space-y-2">
                  {event.risk_reasons.map((reason, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="flex items-start gap-2 text-sm text-[var(--text-muted)]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      {reason}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Sticky bottom rollback CTA bar ───────────────────── */}
      <AnimatePresence>
        {(canRollback || isRolledBack) && (
          <motion.div
            key="sticky-bar"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            className="fixed bottom-0 left-0 right-0 md:left-60 z-30
                       border-t border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-xl
                       px-6 py-4 flex items-center justify-between gap-4"
          >
            <p className="text-sm text-[var(--text-muted)]">
              {canRollback
                ? "This action can be reversed."
                : "This action has already been reversed."}
            </p>

            <motion.button
              onClick={() => canRollback && setShowRollback(true)}
              disabled={!canRollback}
              whileHover={canRollback ? { scale: 1.03 } : {}}
              whileTap={canRollback ? { scale: 0.97 } : {}}
              className={
                canRollback
                  ? "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl " +
                    "text-white bg-red-600 hover:bg-red-500 " +
                    "shadow-lg shadow-red-500/30 transition-all duration-200"
                  : "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl " +
                    "text-[var(--text-muted)] bg-[var(--bg-elevated)] cursor-not-allowed " +
                    "border border-[var(--border)]"
              }
            >
              <RotateCcw className="h-4 w-4" />
              {canRollback ? "Rollback this action" : "Already rolled back"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rollback Modal */}
      {event && (
        <RollbackModal
          event={event}
          open={showRollback}
          onClose={() => setShowRollback(false)}
          onSuccess={() => {
            setShowRollback(false)
            setEvent((prev) => prev ? { ...prev, status: "rolled_back", rollback_status: "executed" } : null)
          }}
        />
      )}
    </motion.div>
  )
}
