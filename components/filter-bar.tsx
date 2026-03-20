"use client"

import { cn } from "@/lib/utils"
import type { AppType, RiskLevel, TimelineFilters } from "@/lib/types"
import { motion } from "framer-motion"

interface FilterBarProps {
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
}

const appOptions: { value: AppType | "all"; label: string }[] = [
  { value: "all", label: "All Apps" },
  { value: "gmail", label: "Gmail" },
  { value: "gdocs", label: "Docs" },
  { value: "slack", label: "Slack" },
]

const riskOptions: { value: RiskLevel | "all"; label: string }[] = [
  { value: "all", label: "All Risks" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
]

function FilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="filter-chip-bg"
          className="absolute inset-0 bg-primary/10 rounded-full border border-primary/20"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  )
}

function FilterGroup({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-2 font-mono">{label}:</span>
      <div className="flex items-center gap-0.5 bg-secondary/50 rounded-full p-0.5">
        {children}
      </div>
    </div>
  )
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-4 p-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10"
    >
      <FilterGroup label="App">
        {appOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            isActive={filters.app === option.value}
            onClick={() => onFiltersChange({ ...filters, app: option.value })}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Risk">
        {riskOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            isActive={filters.riskLevel === option.value}
            onClick={() => onFiltersChange({ ...filters, riskLevel: option.value })}
          />
        ))}
      </FilterGroup>
    </motion.div>
  )
}
