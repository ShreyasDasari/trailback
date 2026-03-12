"use client"

import { cn } from "@/lib/utils"
import type { AppType } from "@/lib/types"
import { Mail, FileText, Hash, BookOpen, Github } from "lucide-react"

interface AppIconProps {
  app: AppType
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}

const appConfig: Record<AppType, { icon: typeof Mail; color: string; bgColor: string; label: string }> = {
  gmail: {
    icon: Mail,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Gmail",
  },
  google_docs: {
    icon: FileText,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Docs",
  },
  slack: {
    icon: Hash,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    label: "Slack",
  },
  notion: {
    icon: BookOpen,
    color: "text-foreground",
    bgColor: "bg-foreground/10",
    label: "Notion",
  },
  github: {
    icon: Github,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    label: "GitHub",
  },
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
}

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

export function AppIcon({ app, size = "md", showLabel = false, className }: AppIconProps) {
  const config = appConfig[app]
  const Icon = config.icon

  if (showLabel) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-medium",
          config.bgColor,
          config.color,
          sizeClasses[size],
          className
        )}
      >
        <Icon className={iconSizes[size]} />
        <span>{config.label}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </span>
  )
}
