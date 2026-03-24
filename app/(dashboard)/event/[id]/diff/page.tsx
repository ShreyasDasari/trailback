"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import { ArrowLeft, RotateCcw, Clock, ExternalLink, FileCode2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppIcon } from "@/components/app-icon"
import { RiskBadge } from "@/components/risk-badge"
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
  const afterSnapshot = snapshots.find((s) => s.snapshot_type === "after")

  const getSnapshotContent = (snapshot: Snapshot | undefined): string => {
    if (!snapshot?.content) return ""
    if (typeof snapshot.content === "string") return snapshot.content
    if (snapshot.content.body) return String(snapshot.content.body)
    if (snapshot.content.text) return String(snapshot.content.text)
    if (snapshot.content.content) return String(snapshot.content.content)
    return JSON.stringify(snapshot.content, null, 2)
  }

  const canRollback = event?.status === "completed"
  const isRolledBack = event?.status === "rolled_back"

  if (loading) {
    return (
      <div className="min-h-screen">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20"
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
          <h2 className="text-lg font-medium text-foreground mb-2">
            Event not found
          </h2>
          <Link
            href="/timeline"
            className="text-sm text-primary hover:underline"
          >
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
      className="min-h-screen"
    >
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => router.back()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>

            <motion.div
              whileHover={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.3 }}
            >
              <AppIcon app={event.app} size="md" />
            </motion.div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  {ACTION_LABELS[event.action_type] || event.action_type}
                </h1>
                <RiskBadge level={event.risk_level} />
                {isRolledBack && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full bg-muted text-muted-foreground border border-border"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Rolled back
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(event.created_at)}
                </span>
                {agent && (
                  <span className="font-mono px-1.5 py-0.5 rounded bg-muted/50 text-xs">
                    via {agent.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {canRollback && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Link
                  href={`/event/${event.id}/rollback`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20"
                >
                  <RotateCcw className="h-4 w-4" />
                  Rollback this action
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Metadata */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 py-4 border-b border-border bg-card/30 backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Event ID:</span>
            <span className="font-mono text-foreground px-1.5 py-0.5 rounded bg-muted/50">
              {event.id.slice(0, 8)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Created: </span>
            <span className="text-foreground">{formatDate(event.created_at)}</span>
          </div>
          {event.metadata?.recipient != null && (
            <div>
              <span className="text-muted-foreground">Recipient: </span>
              <span className="text-foreground">{String(event.metadata.recipient)}</span>
            </div>
          )}
          {event.metadata?.subject != null && (
            <div>
              <span className="text-muted-foreground">Subject: </span>
              <span className="text-foreground">{String(event.metadata.subject)}</span>
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
            className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-xl bg-card"
          >
            <motion.div 
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border mb-6"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <FileCode2 className="h-8 w-8 text-muted-foreground" />
            </motion.div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No content snapshot available
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              This event does not have before/after snapshots recorded.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border overflow-hidden shadow-lg"
          >
            <div className="grid grid-cols-2 text-sm font-medium border-b border-border bg-card">
              <div className="px-4 py-3 border-r border-border flex items-center gap-2">
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
                      diffViewerBackground: "#0a0a0c",
                      diffViewerColor: "#f0f0f2",
                      addedBackground: "#10b98115",
                      addedColor: "#10b981",
                      removedBackground: "#ef444415",
                      removedColor: "#ef4444",
                      wordAddedBackground: "#10b98130",
                      wordRemovedBackground: "#ef444430",
                      addedGutterBackground: "#10b98110",
                      removedGutterBackground: "#ef444410",
                      gutterBackground: "#0a0a0c",
                      gutterBackgroundDark: "#0a0a0c",
                      highlightBackground: "#2a2a3020",
                      highlightGutterBackground: "#2a2a30",
                      codeFoldGutterBackground: "#0a0a0c",
                      codeFoldBackground: "#0a0a0c",
                      emptyLineBackground: "#0a0a0c",
                      codeFoldContentColor: "#7a7a85",
                    },
                  },
                  contentText: {
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "13px",
                    lineHeight: "1.7",
                  },
                  gutter: {
                    minWidth: "48px",
                    padding: "0 12px",
                  },
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
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Risk Analysis
                </h3>
                <ul className="space-y-2">
                  {event.risk_reasons.map((reason, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
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
    </motion.div>
  )
}
