"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import { ArrowLeft, RotateCcw, Clock, ExternalLink } from "lucide-react"
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
      // Fetch event
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single()

      if (eventData) {
        setEvent(eventData)

        // Fetch agent if exists
        if (eventData.agent_id) {
          const { data: agentData } = await supabase
            .from("agents")
            .select("*")
            .eq("id", eventData.agent_id)
            .single()
          setAgent(agentData)
        }
      }

      // Fetch snapshots
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
    // Handle different content types
    if (typeof snapshot.content === "string") return snapshot.content
    if (snapshot.content.body) return String(snapshot.content.body)
    if (snapshot.content.text) return String(snapshot.content.text)
    if (snapshot.content.content) return String(snapshot.content.content)
    return JSON.stringify(snapshot.content, null, 2)
  }

  const canRollback = event?.status === "completed"

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="h-8 w-8 skeleton rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 skeleton rounded" />
              <div className="h-4 w-32 skeleton rounded" />
            </div>
          </div>
        </header>
        <div className="p-6">
          <div className="h-96 skeleton rounded-lg" />
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground mb-2">
            Event not found
          </h2>
          <Link
            href="/timeline"
            className="text-sm text-primary hover:underline"
          >
            Back to Timeline
          </Link>
        </div>
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <AppIcon app={event.app} size="md" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  {ACTION_LABELS[event.action_type] || event.action_type}
                </h1>
                <RiskBadge level={event.risk_level} />
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(event.created_at)}
                </span>
                {agent && (
                  <span className="font-mono">via {agent.name}</span>
                )}
              </div>
            </div>
          </div>

          {canRollback && (
            <Link
              href={`/event/${event.id}/rollback`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Rollback this action
            </Link>
          )}
        </div>
      </header>

      {/* Metadata */}
      <div className="px-6 py-4 border-b border-border bg-card/30">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Event ID: </span>
            <span className="font-mono text-foreground">{event.id.slice(0, 8)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created: </span>
            <span className="text-foreground">{formatDate(event.created_at)}</span>
          </div>
          {event.metadata?.recipient && (
            <div>
              <span className="text-muted-foreground">Recipient: </span>
              <span className="text-foreground">{String(event.metadata.recipient)}</span>
            </div>
          )}
          {event.metadata?.subject && (
            <div>
              <span className="text-muted-foreground">Subject: </span>
              <span className="text-foreground">{String(event.metadata.subject)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Diff View */}
      <div className="p-6">
        {snapshots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-lg bg-card"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <ExternalLink className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No content snapshot available
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              This event does not have before/after snapshots recorded.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border overflow-hidden"
          >
            <div className="grid grid-cols-2 text-sm font-medium text-muted-foreground border-b border-border bg-card">
              <div className="px-4 py-2 border-r border-border">Before</div>
              <div className="px-4 py-2">After</div>
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
                      diffViewerBackground: "#18181c",
                      diffViewerColor: "#f0f0f2",
                      addedBackground: "#10b98120",
                      addedColor: "#10b981",
                      removedBackground: "#ef444420",
                      removedColor: "#ef4444",
                      wordAddedBackground: "#10b98140",
                      wordRemovedBackground: "#ef444440",
                      addedGutterBackground: "#10b98115",
                      removedGutterBackground: "#ef444415",
                      gutterBackground: "#0e0e10",
                      gutterBackgroundDark: "#0e0e10",
                      highlightBackground: "#2a2a3020",
                      highlightGutterBackground: "#2a2a30",
                      codeFoldGutterBackground: "#18181c",
                      codeFoldBackground: "#18181c",
                      emptyLineBackground: "#18181c",
                      codeFoldContentColor: "#7a7a85",
                    },
                  },
                  contentText: {
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "13px",
                    lineHeight: "1.6",
                  },
                  gutter: {
                    minWidth: "40px",
                    padding: "0 8px",
                  },
                }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Risk Analysis */}
      {event.risk_reasons && event.risk_reasons.length > 0 && (
        <div className="px-6 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-border bg-card p-4"
          >
            <h3 className="text-sm font-medium text-foreground mb-3">
              Risk Analysis
            </h3>
            <ul className="space-y-2">
              {event.risk_reasons.map((reason, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                  {reason}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
