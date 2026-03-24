"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { RotateCcw, ChevronRight, Sparkles } from "lucide-react"
import { cn, formatRelativeTime, truncate } from "@/lib/utils"
import { AppIcon } from "@/components/app-icon"
import { RiskBadge } from "@/components/risk-badge"
import type { Event } from "@/lib/types"
import { ACTION_LABELS } from "@/lib/types"

interface EventCardProps {
  event: Event
  index?: number
  agentName?: string
}

export function EventCard({ event, index = 0, agentName }: EventCardProps) {
  const isRolledBack = event.status === "rolled_back"
  const canRollback = event.status === "completed" && !isRolledBack
  const isNew = Date.now() - new Date(event.created_at).getTime() < 5000

  // Extract preview text from metadata
  const preview = event.metadata?.recipient || 
    event.metadata?.subject || 
    event.metadata?.channel ||
    event.metadata?.title ||
    event.intent ||
    ""

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ scale: 1.01 }}
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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
        </motion.div>
      )}

      <Link
        href={`/event/${event.id}/diff`}
        className={cn(
          "group relative flex items-start gap-4 p-4 rounded-xl border bg-card transition-all duration-300",
          "hover:bg-card/80 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5",
          isRolledBack && "opacity-50",
          isNew && "border-primary/30 bg-primary/5"
        )}
      >
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
        >
          <AppIcon app={event.app} size="md" />
        </motion.div>

        <div className="flex-1 min-w-0 relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-medium text-foreground">
              {ACTION_LABELS[event.action_type] || event.action_type}
            </span>
            <RiskBadge level={event.risk_level} />
            {isRolledBack && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full bg-muted text-muted-foreground border border-border"
              >
                <RotateCcw className="h-3 w-3" />
                Rolled back
              </motion.span>
            )}
            {isNew && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary"
              >
                <Sparkles className="h-3 w-3" />
                New
              </motion.span>
            )}
          </div>

          {preview && (
            <p className="text-sm text-muted-foreground truncate group-hover:text-muted-foreground/80 transition-colors">
              {truncate(String(preview), 60)}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground/70">
              {formatRelativeTime(event.created_at)}
            </span>
            {agentName && (
              <span className="text-xs font-mono text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/50">
                via {agentName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          {canRollback && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href={`/event/${event.id}/rollback`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-all duration-200 border border-primary/20"
              >
                <RotateCcw className="h-3 w-3" />
                Rollback
              </Link>
            </motion.div>
          )}
          <motion.div
            initial={{ x: 0 }}
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
          </motion.div>
        </div>
      </Link>
    </motion.div>
  )
}

// Enhanced Skeleton loader for EventCard
export function EventCardSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card overflow-hidden">
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
