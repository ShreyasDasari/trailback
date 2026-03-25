"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/types"

interface RiskBadgeProps {
  level: RiskLevel
  score?: number
  reasons?: string[]
  className?: string
  showPulse?: boolean
}

const riskConfig: Record<RiskLevel, {
  label: string
  color: string         // CSS var reference
  borderColor: string
  bgColor: string
  dotColor: string
}> = {
  low: {
    label:       "Low",
    color:       "var(--risk-low)",
    borderColor: "rgba(34,197,94,0.2)",
    bgColor:     "rgba(34,197,94,0.08)",
    dotColor:    "#22c55e",
  },
  medium: {
    label:       "Medium",
    color:       "var(--risk-medium)",
    borderColor: "rgba(245,158,11,0.2)",
    bgColor:     "rgba(245,158,11,0.08)",
    dotColor:    "#f59e0b",
  },
  high: {
    label:       "High",
    color:       "var(--risk-high)",
    borderColor: "rgba(249,115,22,0.25)",
    bgColor:     "rgba(249,115,22,0.08)",
    dotColor:    "#f97316",
  },
  critical: {
    label:       "Critical",
    color:       "var(--risk-critical)",
    borderColor: "rgba(239,68,68,0.3)",
    bgColor:     "rgba(239,68,68,0.1)",
    dotColor:    "#ef4444",
  },
}

export function RiskBadge({ level, score, reasons, className, showPulse = true }: RiskBadgeProps) {
  const config    = riskConfig[level]
  const isCritical = level === "critical"
  const [hovered, setHovered] = useState(false)

  return (
    <span className="relative inline-flex" style={{ isolation: "isolate" }}>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.97 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className={cn(
          "relative inline-flex items-center gap-1.5 px-2.5 py-0.5",
          "text-xs font-mono font-medium rounded-full border cursor-default select-none",
          isCritical && "risk-critical-glow",
          className
        )}
        style={{
          color:       config.color,
          borderColor: config.borderColor,
          background:  config.bgColor,
        }}
      >
        {/* Animated dot */}
        <span className="relative flex h-1.5 w-1.5">
          {showPulse && isCritical && (
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: config.dotColor }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.75, 0, 0.75] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: config.dotColor }}
          />
        </span>

        {config.label}
      </motion.span>

      {/* AnimatePresence tooltip showing score + reasons */}
      <AnimatePresence>
        {hovered && (score !== undefined || (reasons && reasons.length > 0)) && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[180px] max-w-[260px]
                       rounded-lg border bg-[var(--bg-elevated)] px-3 py-2 shadow-xl shadow-black/40
                       pointer-events-none"
            style={{ borderColor: config.borderColor }}
          >
            {/* Arrow */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `6px solid ${config.borderColor}`,
              }}
            />

            {score !== undefined && (
              <p className="text-xs font-mono mb-1.5" style={{ color: config.color }}>
                Risk score: <strong>{score}</strong>
              </p>
            )}

            {reasons && reasons.length > 0 && (
              <ul className="space-y-1">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span className="mt-1 h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: config.dotColor }} />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
