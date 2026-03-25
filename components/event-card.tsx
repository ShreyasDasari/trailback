"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { RotateCcw, ChevronRight, Sparkles } from "lucide-react"
import { cn, formatRelativeTime, truncate } from "@/lib/utils"
import { AppIcon } from "@/components/app-icon"
import { RiskBadge } from "@/components/risk-badge"
import type { Event } from "@/lib/types"
import { ACTION_LABELS } from "@/lib/types"

// App colour accent map for left-border
const APP_ACCENT: Record<string, string> = {
  gmail:  "#ef4444",   // red
  gdocs:  "#3b82f6",   // blue
  slack:  "#a855f7",   // purple
  notion: "#71717a",
  github: "#6b7280",
}

interface EventCardProps {
  event: Event
  index?: number
  agentName?: string
}

export function EventCard({ event, index = 0, agentName }: EventCardProps) {
  const isRolledBack = event.status === "rolled_back"
  const canRollback  = event.status === "completed" && !isRolledBack
  const isNew        = Date.now() - new Date(event.created_at).getTime() < 5000

  const preview =
    event.metadata?.recipient ||
    event.metadata?.subject   ||
    event.metadata?.channel   ||
    event.metadata?.title     ||
    event.intent              ||
    ""

  const accentColor = APP_ACCENT[event.app] ?? "#6ee7b7"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.97 }}
      className="relative"
    >
      {/* New event indicator */}
      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -left-1 -top-1 z-10"
        >
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]" />
          </span>
        </motion.div>
      )}

      <Link
        href={`/event/${event.id}/diff`}
        className={cn(
          "group relative flex items-start gap-4 p-4 rounded-xl border",
          "bg-[var(--bg-surface)] transition-all duration-200",
          "hover:bg-[var(--bg-elevated)] hover:shadow-xl hover:shadow-black/30",
          isRolledBack && "opacity-40",
          isNew && "border-[var(--accent)]/30 bg-[var(--accent-dim)]"
        )}
        style={{
          borderColor: isNew ? undefined : "var(--border)",
          // Subtle app-color left glow on hover via box-shadow handled in CSS
        }}
      >
        {/* App-colored left accent border */}
        <div
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full opacity-70"
          style={{ backgroundColor: accentColor }}
        />

        {/* Hover gradient overlay */}
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${accentColor}08 0%, transparent 60%)` }}
        />

        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
        >
          <AppIcon app={event.app} size="md" />
        </motion.div>

        <div className="flex-1 min-w-0 relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-medium text-[var(--text-primary)]">
              {ACTION_LABELS[event.action_type] || event.action_type}
            </span>
            <RiskBadge level={event.risk_level} />
            {isRolledBack && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full
                           bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]"
              >
                <RotateCcw className="h-3 w-3" />
                Rolled back
              </motion.span>
            )}
            {isNew && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
                           bg-[var(--accent-dim)] text-[var(--accent)]"
              >
                <Sparkles className="h-3 w-3" />
                New
              </motion.span>
            )}
          </div>

          {preview && (
            <p className="text-sm text-[var(--text-muted)] truncate group-hover:text-[var(--text-secondary)] transition-colors">
              {truncate(String(preview), 60)}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-[var(--text-muted)]">
              {formatRelativeTime(event.created_at)}
            </span>
            {agentName && (
              <span className="text-xs font-mono text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">
                via {agentName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          {canRollback && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href={`/event/${event.id}/rollback`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                           text-[var(--accent)] bg-[var(--accent-dim)] rounded-lg
                           hover:bg-[var(--accent)]/20 transition-all duration-200
                           border border-[var(--accent)]/20"
              >
                <RotateCcw className="h-3 w-3" />
                Rollback
              </Link>
            </motion.div>
          )}
          <motion.div
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-200" />
          </motion.div>
        </div>
      </Link>
    </motion.div>
  )
}

// Skeleton loader using .skeleton CSS class
export function EventCardSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="h-10 w-10 rounded-lg skeleton" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-28 skeleton rounded-md" />
          <div className="h-5 w-14 skeleton rounded-full" />
        </div>
        <div className="h-3.5 w-52 skeleton rounded-md" />
        <div className="h-3 w-24 skeleton rounded-md" />
      </div>
      <div className="h-8 w-20 skeleton rounded-lg" />
    </div>
  )
}
