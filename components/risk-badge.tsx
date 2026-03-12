"use client"

import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/types"

interface RiskBadgeProps {
  level: RiskLevel
  className?: string
}

const riskConfig: Record<RiskLevel, { label: string; className: string; dotClassName: string }> = {
  low: {
    label: "Low",
    className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    dotClassName: "bg-gray-400",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotClassName: "bg-amber-400",
  },
  high: {
    label: "High",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dotClassName: "bg-orange-400",
  },
  critical: {
    label: "Critical",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    dotClassName: "bg-red-400 animate-pulse-slow",
  },
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = riskConfig[level]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded border",
        config.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
      {config.label}
    </span>
  )
}
