"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock,
  LogOut,
  Plug,
  Bot,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { TrailbackLogoMark } from "@/components/trailback-logo"

const navItems = [
  { href: "/timeline",           label: "Timeline",   icon: Clock, description: "Real-time event feed" },
  { href: "/settings/connectors",label: "Connectors", icon: Plug,  description: "Manage app integrations" },
  { href: "/settings/agents",    label: "Agents",     icon: Bot,   description: "Configure AI agents" },
]

export function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = "/login"
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex fixed left-0 top-0 h-screen flex-col border-r border-[var(--border)]
                   bg-[var(--bg-surface)] z-40 overflow-hidden"
      >
        {/* Logo row + recording dot */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] shrink-0">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.35 }}>
              <TrailbackLogoMark size={32} />
            </motion.div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="wordmark"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-base tracking-tight whitespace-nowrap overflow-hidden"
                >
                  <span className="text-[var(--text-primary)]">trail</span>
                  <span className="text-[var(--accent)]">back</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Recording status dot */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                key="dot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-auto flex items-center gap-1.5"
                title="Recording"
              >
                <span className="recording-dot h-2 w-2 rounded-full bg-[var(--accent)] inline-block" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item, index) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07 }}
              >
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg",
                    "transition-colors duration-150 group overflow-hidden",
                    isActive
                      ? "text-[var(--accent)] bg-[var(--accent-dim)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  )}
                >
                  {/* Accent left border for active item */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-border"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--accent)] rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                    />
                  )}

                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.97 }}>
                    <item.icon className="h-4 w-4 shrink-0" />
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden whitespace-nowrap flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isActive && !collapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                    </motion.div>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </nav>

        {/* Bottom: sign out + collapse toggle */}
        <div className="px-2 py-3 border-t border-[var(--border)] space-y-1">
          <motion.button
            onClick={handleSignOut}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            title={collapsed ? "Sign Out" : undefined}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium
                       text-[var(--text-muted)] rounded-lg hover:text-[var(--text-primary)]
                       hover:bg-[var(--bg-elevated)] transition-colors duration-150"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="signout"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 px-3 py-2 text-xs text-[var(--text-muted)]
                       rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]
                       transition-colors duration-150"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose className={cn("h-4 w-4 shrink-0 transition-transform duration-200", collapsed && "rotate-180")} />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="collapse-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around
                      border-t border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-xl
                      py-2 px-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors duration-150",
                isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--accent)] rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
              <motion.div whileTap={{ scale: 0.9 }}>
                <item.icon className="h-5 w-5" />
              </motion.div>
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium text-[var(--text-muted)]"
        >
          <motion.div whileTap={{ scale: 0.9 }}>
            <LogOut className="h-5 w-5" />
          </motion.div>
          <span>Sign Out</span>
        </button>
      </nav>
    </>
  )
}
