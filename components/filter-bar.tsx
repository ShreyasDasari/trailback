"use client"

import { cn } from "@/lib/utils"
import type { AppType, RiskLevel, TimelineFilters } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"
import { Filter, X } from "lucide-react"

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

const riskOptions: { value: RiskLevel | "all"; label: string; color?: string }[] = [
  { value: "all", label: "All Risks" },
  { value: "low", label: "Low", color: "bg-gray-400" },
  { value: "medium", label: "Medium", color: "bg-amber-400" },
  { value: "high", label: "High", color: "bg-orange-400" },
  { value: "critical", label: "Critical", color: "bg-red-400" },
]

function FilterChip({
  label,
  isActive,
  onClick,
  color,
  layoutId,
}: {
  label: string
  isActive: boolean
  onClick: () => void
  color?: string
  layoutId: string
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId={layoutId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10 flex items-center gap-1.5">
        {color && isActive && (
          <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
        )}
        {label}
      </span>
    </motion.button>
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
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
        {label}
      </span>
      <div className="flex items-center gap-0.5 bg-secondary/30 rounded-lg p-0.5 border border-border/50">
        {children}
      </div>
    </div>
  )
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const hasActiveFilters = filters.app !== "all" || filters.riskLevel !== "all"

  const clearFilters = () => {
    onFiltersChange({ app: "all", riskLevel: "all", dateRange: { from: null, to: null } })
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-4 px-6 py-3 border-b border-border bg-card/30 backdrop-blur-sm"
    >
      {/* Filter icon */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-xs font-medium hidden sm:inline">Filters</span>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      <FilterGroup label="App">
        {appOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            isActive={filters.app === option.value}
            onClick={() => onFiltersChange({ ...filters, app: option.value })}
            layoutId="filter-app-bg"
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
            color={option.color}
            layoutId="filter-risk-bg"
          />
        ))}
      </FilterGroup>

      {/* Clear filters button */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-all duration-200"
          >
            <X className="h-3 w-3" />
            Clear
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
