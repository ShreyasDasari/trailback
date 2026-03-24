"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/types"

interface RiskBadgeProps {
  level: RiskLevel
  className?: string
  showPulse?: boolean
}

const riskConfig: Record<RiskLevel, { 
  label: string
  className: string
  dotClassName: string
  glowColor: string
}> = {
  low: {
    label: "Low",
    className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    dotClassName: "bg-gray-400",
    glowColor: "rgba(156, 163, 175, 0.3)",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotClassName: "bg-amber-400",
    glowColor: "rgba(251, 191, 36, 0.3)",
  },
  high: {
    label: "High",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dotClassName: "bg-orange-400",
    glowColor: "rgba(251, 146, 60, 0.4)",
  },
  critical: {
    label: "Critical",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    dotClassName: "bg-red-400",
    glowColor: "rgba(248, 113, 113, 0.5)",
  },
}

export function RiskBadge({ level, className, showPulse = true }: RiskBadgeProps) {
  const config = riskConfig[level]
  const isCritical = level === "critical"
  const isHighRisk = level === "high" || level === "critical"

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium rounded-full border",
        config.className,
        className
      )}
      style={{
        boxShadow: isHighRisk ? `0 0 12px ${config.glowColor}` : undefined,
      }}
    >
      {/* Animated dot */}
      <span className="relative flex h-1.5 w-1.5">
        {showPulse && isCritical && (
          <motion.span 
            className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", config.dotClassName)}
            animate={{ scale: [1, 1.5, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", config.dotClassName)} />
      </span>
      
      {config.label}
      
      {/* Subtle glow effect for critical */}
      {isCritical && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ 
            boxShadow: [
              `0 0 8px ${config.glowColor}`,
              `0 0 16px ${config.glowColor}`,
              `0 0 8px ${config.glowColor}`,
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ pointerEvents: "none" }}
        />
      )}
    </motion.span>
  )
}
