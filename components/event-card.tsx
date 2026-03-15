"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { RotateCcw, ChevronRight } from "lucide-react"
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

  // Extract preview text from metadata
  const preview = event.metadata?.recipient || 
    event.metadata?.subject || 
    event.metadata?.channel ||
    event.metadata?.title ||
    event.intent ||
    ""

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.05,
        ease: "easeOut"
      }}
    >
      <Link
        href={`/event/${event.id}/diff`}
        className={cn(
          "group flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-all duration-200",
          isRolledBack && "opacity-60"
        )}
      >
        <AppIcon app={event.app} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground">
              {ACTION_LABELS[event.action_type] || event.action_type}
            </span>
            <RiskBadge level={event.risk_level} />
            {isRolledBack && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded bg-muted text-muted-foreground">
                <RotateCcw className="h-3 w-3" />
                Rolled back
              </span>
            )}
          </div>

          {preview && (
            <p className="text-sm text-muted-foreground truncate">
              {truncate(String(preview), 60)}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(event.created_at)}
            </span>
            {agentName && (
              <span className="text-xs font-mono text-muted-foreground">
                via {agentName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canRollback && (
            <Link
              href={`/event/${event.id}/rollback`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Rollback
            </Link>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// Skeleton loader for EventCard
export function EventCardSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
      <div className="h-8 w-8 rounded-md skeleton" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 skeleton rounded" />
          <div className="h-4 w-12 skeleton rounded" />
        </div>
        <div className="h-3 w-48 skeleton rounded" />
        <div className="h-3 w-20 skeleton rounded" />
      </div>
    </div>
  )
}
