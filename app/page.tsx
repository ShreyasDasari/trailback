"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { Menu, X, Github, Clock, Shield, RotateCcw, FileText, Users, Download, Zap, Link2, Eye } from "lucide-react"
import { TrailbackLogoMark } from "@/components/trailback-logo"

// Navbar Component
function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { name: "Home", href: "#" },
    { name: "Features", href: "#features" },
    { name: "About", href: "#about" },
    { name: "Pricing", href: "#pricing" },
  ]

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[#0e0e10]/80 backdrop-blur-lg border-b border-[#2a2a30]"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <TrailbackLogoMark size={64} />
            <span className="font-mono text-xl tracking-tight hidden sm:block">
              <span className="text-[#f0f0f2]">trail</span>
              <span className="text-[#6ee7b7]">back</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-[#7a7a85] hover:text-[#f0f0f2] transition-colors text-sm"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 border border-[#2a2a30] rounded-md text-[#7a7a85] hover:text-[#f0f0f2] hover:border-[#3a3a40] transition-all text-sm"
            >
              <Github className="w-4 h-4" />
              <span className="font-mono">248</span>
            </a>
            <Link
              href="/login"
              className="text-[#7a7a85] hover:text-[#f0f0f2] transition-colors text-sm px-3 py-1.5"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="bg-[#6ee7b7] text-[#0e0e10] px-4 py-1.5 rounded-md text-sm font-medium hover:bg-[#5dd9a8] transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-[#f0f0f2]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-4 space-y-4 border-t border-[#2a2a30]">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="block text-[#7a7a85] hover:text-[#f0f0f2] transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                <div className="flex flex-col gap-2 pt-4 border-t border-[#2a2a30]">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#7a7a85]"
                  >
                    <Github className="w-4 h-4" />
                    <span className="font-mono">Star on GitHub (248)</span>
                  </a>
                  <Link href="/login" className="text-[#7a7a85]">
                    Log in
                  </Link>
                  <Link
                    href="/login"
                    className="bg-[#6ee7b7] text-[#0e0e10] px-4 py-2 rounded-md text-sm font-medium text-center"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

// Hero Terminal Animation
function HeroTerminal() {
  const events = [
    { app: "gmail", action: "email.send", risk: "MEDIUM", time: "2s ago", color: "#eab308" },
    { app: "gdocs", action: "doc.edit", risk: "HIGH", time: "14s ago", color: "#f97316" },
    { app: "slack", action: "message.post", risk: "LOW", time: "1m ago", color: "#6ee7b7" },
    { app: "gmail", action: "email.send", risk: "CRITICAL", time: "just now", color: "#ef4444", pulse: true },
  ]

  return (
    <motion.div
      className="bg-[#18181c] border border-[#2a2a30] rounded-lg p-4 font-mono text-sm w-full max-w-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2a2a30]">
        <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
        <div className="w-3 h-3 rounded-full bg-[#eab308]" />
        <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
        <span className="ml-2 text-[#7a7a85] text-xs">live event stream</span>
      </div>
      <div className="space-y-2">
        {events.map((event, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-3 text-xs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + index * 0.2, duration: 0.4 }}
          >
            <span className={`w-2 h-2 rounded-full ${event.pulse ? "animate-pulse-slow" : ""}`} style={{ backgroundColor: event.color }} />
            <span className="text-[#7a7a85] w-12">{event.app}</span>
            <span className="text-[#f0f0f2] w-24">{event.action}</span>
            <span className="w-16" style={{ color: event.color }}>{event.risk}</span>
            <span className="text-[#7a7a85]">{event.time}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#6ee7b7] rounded-full opacity-[0.03] blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.p
              className="font-mono text-[#6ee7b7] text-sm mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {"// AI agent oversight"}
            </motion.p>
            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#f0f0f2] leading-tight mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              Every agent action, recorded and reversible.
            </motion.h1>
            <motion.p
              className="text-lg text-[#7a7a85] mb-8 max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Full visibility and one-click rollback over every action your AI agents take across Gmail, Google Docs, and Slack. Built for teams that move fast and can't afford mistakes.
            </motion.p>
            <motion.div
              className="flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Link
                href="/login"
                className="bg-[#6ee7b7] text-[#0e0e10] px-6 py-3 rounded-md font-medium hover:bg-[#5dd9a8] transition-colors"
              >
                Get Started Free
              </Link>
              <button className="border border-[#2a2a30] text-[#f0f0f2] px-6 py-3 rounded-md font-medium hover:border-[#6ee7b7] hover:text-[#6ee7b7] transition-colors">
                View Demo
              </button>
            </motion.div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroTerminal />
          </div>
        </div>
      </div>
    </section>
  )
}

// Social Proof Bar
function SocialProofBar() {
  const agents = ["claude", "gpt-4", "gemini", "cursor", "devin", "copilot"]

  return (
    <motion.section
      className="border-y border-[#2a2a30] py-8"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[#7a7a85] text-sm mb-6">
          Trusted by teams building with Claude, GPT-4, Gemini, and more
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {agents.map((agent) => (
            <span
              key={agent}
              className="font-mono text-sm text-[#7a7a85] bg-[#18181c] px-4 py-2 rounded-full border border-[#2a2a30]"
            >
              {agent}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// Feature Card
function FeatureCard({ icon: Icon, title, description, delay }: { icon: React.ElementType; title: string; description: string; delay: number }) {
  return (
    <motion.div
      className="bg-[#18181c] border border-[#2a2a30] rounded-lg p-6 hover:border-[#6ee7b7] transition-all duration-300 group"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -4 }}
    >
      <div className="w-10 h-10 bg-[#6ee7b7]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#6ee7b7]/20 transition-colors">
        <Icon className="w-5 h-5 text-[#6ee7b7]" />
      </div>
      <h3 className="text-lg font-semibold text-[#f0f0f2] mb-2">{title}</h3>
      <p className="text-[#7a7a85] text-sm leading-relaxed">{description}</p>
    </motion.div>
  )
}

// Features Section
function FeaturesSection() {
  const features = [
    { icon: Clock, title: "Real-time Timeline", description: "Every agent action logged the moment it happens. Gmail, Docs, Slack — all in one feed." },
    { icon: Shield, title: "Risk Scoring", description: "Automatic risk classification on every action. Low, medium, high, critical — color-coded and explained in plain English." },
    { icon: RotateCcw, title: "One-Click Rollback", description: "Undo any agent action instantly. Move emails to trash, restore document revisions, delete Slack messages." },
    { icon: FileText, title: "Diff Viewer", description: "See exactly what changed. Before and after snapshots for every document edit your agent makes." },
    { icon: Users, title: "Agent Registry", description: "Register your agents and track their trust score over time. Know which agents to trust and which to watch." },
    { icon: Download, title: "Audit Trail", description: "Full exportable CSV audit log with date range filtering. Always know what happened and when." },
  ]

  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          className="font-mono text-[#6ee7b7] text-sm mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {"// features"}
        </motion.p>
        <motion.h2
          className="text-3xl sm:text-4xl font-bold text-[#f0f0f2] mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Everything you need to trust your agents
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} delay={index * 0.1} />
          ))}
        </div>
      </div>
    </section>
  )
}

// How It Works Section
function HowItWorksSection() {
  const steps = [
    { icon: Zap, title: "Install the extension", description: "Add Trailback to Chrome. It silently monitors your agent's API calls in real-time." },
    { icon: Link2, title: "Connect your apps", description: "Authorize Gmail, Google Docs, and Slack with one click. We only request the permissions we need." },
    { icon: Eye, title: "Watch and respond", description: "Every action appears in your dashboard instantly. Roll back anything with a single click." },
  ]

  return (
    <section className="py-24 border-t border-[#2a2a30]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          className="font-mono text-[#6ee7b7] text-sm mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {"// how it works"}
        </motion.p>
        <motion.h2
          className="text-3xl sm:text-4xl font-bold text-[#f0f0f2] mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Set up in minutes. Running in seconds.
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-[#2a2a30]" />
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="relative text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
            >
              <div className="w-24 h-24 bg-[#18181c] border border-[#2a2a30] rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                <step.icon className="w-10 h-10 text-[#6ee7b7]" />
              </div>
              <h3 className="text-lg font-semibold text-[#f0f0f2] mb-2">{step.title}</h3>
              <p className="text-[#7a7a85] text-sm max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Pricing Card
function PricingCard({ name, price, features, cta, popular, delay }: { name: string; price: string; features: string; cta: string; popular?: boolean; delay: number }) {
  return (
    <motion.div
      className={`bg-[#18181c] border rounded-lg p-6 relative ${popular ? "border-[#6ee7b7]" : "border-[#2a2a30] hover:border-[#6ee7b7]"} transition-colors`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6ee7b7] text-[#0e0e10] text-xs font-medium px-3 py-1 rounded-full">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-semibold text-[#f0f0f2] mb-2">{name}</h3>
      <p className="text-3xl font-bold text-[#f0f0f2] mb-4">
        {price}
        <span className="text-sm font-normal text-[#7a7a85]">/mo</span>
      </p>
      <p className="text-[#7a7a85] text-sm mb-6">{features}</p>
      <Link
        href="/login"
        className={`block text-center py-2 rounded-md font-medium transition-colors ${
          popular
            ? "bg-[#6ee7b7] text-[#0e0e10] hover:bg-[#5dd9a8]"
            : "border border-[#2a2a30] text-[#f0f0f2] hover:border-[#6ee7b7]"
        }`}
      >
        {cta}
      </Link>
    </motion.div>
  )
}

// Pricing Section
function PricingSection() {
  const plans = [
    { name: "Free", price: "$0", features: "1 agent, 7-day log retention, Gmail + Docs", cta: "Get Started" },
    { name: "Pro", price: "$19", features: "5 agents, 30-day retention, Gmail + Docs + Slack, CSV export", cta: "Get Started", popular: true },
    { name: "Team", price: "$49", features: "Unlimited agents, 90-day retention, all connectors, priority support", cta: "Contact Us" },
  ]

  return (
    <section id="pricing" className="py-24 border-t border-[#2a2a30]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          className="font-mono text-[#6ee7b7] text-sm mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {"// pricing"}
        </motion.p>
        <motion.h2
          className="text-3xl sm:text-4xl font-bold text-[#f0f0f2] mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Simple, transparent pricing
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <PricingCard key={plan.name} {...plan} delay={index * 0.1} />
          ))}
        </div>
      </div>
    </section>
  )
}

// About Section
function AboutSection() {
  const stats = [
    { value: "3", label: "apps supported" },
    { value: "< 5ms", label: "risk scoring" },
    { value: "1-click", label: "rollback" },
  ]

  return (
    <section id="about" className="py-24 border-t border-[#2a2a30]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          className="font-mono text-[#6ee7b7] text-sm mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {"// about"}
        </motion.p>
        <motion.h2
          className="text-3xl sm:text-4xl font-bold text-[#f0f0f2] mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Built by developers, for developers
        </motion.h2>
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <motion.p
            className="text-[#7a7a85] text-lg leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            AI agents are getting powerful fast. Trailback exists because we believe every autonomous action should be observable, auditable, and reversible. We're a small team building the oversight layer that AI-powered teams need.
          </motion.p>
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="bg-[#18181c] border border-[#2a2a30] rounded-lg p-4 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <p className="text-2xl font-bold text-[#6ee7b7] mb-1">{stat.value}</p>
                <p className="text-[#7a7a85] text-xs">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Animated Logo Section
function LogoAnimationSection() {
  return (
    <section className="py-24 border-t border-[#2a2a30] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {/* Animated Logo Mark */}
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <svg width="200" height="200" viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg">
              {/* Outer pulse ring */}
              <motion.circle
                cx="340"
                cy="340"
                r="280"
                fill="none"
                stroke="#6ee7b7"
                strokeWidth="1"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.2, 1.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.circle
                cx="340"
                cy="340"
                r="240"
                fill="none"
                stroke="#6ee7b7"
                strokeWidth="1"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.2, 0], scale: [0.8, 1.1, 1.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
              />
              
              <g transform="translate(340, 340)">
                {/* Static outer circle */}
                <circle cx="0" cy="0" r="130" fill="none" stroke="#6ee7b7" strokeWidth="2" opacity="0.15" />
                
                {/* Connecting line */}
                <motion.line 
                  x1="-90" 
                  y1="0" 
                  x2="60" 
                  y2="0" 
                  stroke="#2a2a30" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
                
                {/* Animated dots - staggered appearance */}
                <motion.circle 
                  cx="-90" 
                  cy="0" 
                  r="11" 
                  fill="#1D9E75" 
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 0.18, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                />
                <motion.circle 
                  cx="-36" 
                  cy="0" 
                  r="11" 
                  fill="#1D9E75"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 0.42, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                />
                <motion.circle 
                  cx="18" 
                  cy="0" 
                  r="11" 
                  fill="#1D9E75"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 0.7, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.9 }}
                />
                
                {/* Main bright dot with pulse */}
                <motion.circle 
                  cx="70" 
                  cy="0" 
                  r="11" 
                  fill="#6ee7b7"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 1.1 }}
                />
                <motion.circle 
                  cx="70" 
                  cy="0" 
                  r="24" 
                  fill="none" 
                  stroke="#6ee7b7" 
                  strokeWidth="2.5"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0.4, 0.1, 0.4], scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </g>
            </svg>
          </motion.div>
          
          {/* Animated wordmark */}
          <motion.div
            className="mt-8 font-mono text-4xl tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.3, duration: 0.5 }}
          >
            <span className="text-[#f0f0f2]">trail</span>
            <span className="text-[#6ee7b7]">back</span>
          </motion.div>
          
          <motion.p
            className="mt-4 text-[#7a7a85] text-center max-w-md"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            Every action recorded. Every step reversible.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}

// CTA Section
function CTASection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="bg-[#18181c] border border-[#6ee7b7] rounded-lg p-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold text-[#f0f0f2] mb-4">
            Ready to take control of your agents?
          </h2>
          <p className="text-[#7a7a85] mb-8">
            Start monitoring in under 5 minutes. No credit card required.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#6ee7b7] text-[#0e0e10] px-8 py-3 rounded-md font-medium hover:bg-[#5dd9a8] transition-colors"
          >
            Get Started Free
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  const links = [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "About", href: "#about" },
    { name: "GitHub", href: "https://github.com" },
    { name: "Privacy", href: "#" },
    { name: "Terms", href: "#" },
  ]

  return (
    <footer className="border-t border-[#2a2a30] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/" className="font-mono text-xl tracking-tight">
            <span className="text-[#f0f0f2]">trail</span>
            <span className="text-[#6ee7b7]">back</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-6">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-[#7a7a85] hover:text-[#f0f0f2] transition-colors text-sm"
              >
                {link.name}
              </a>
            ))}
          </div>
          <p className="text-[#7a7a85] text-sm">
            Built with <span className="text-[#ef4444]">♥</span> by the Trailback team
          </p>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0e0e10]">
      <Navbar />
      <HeroSection />
      <SocialProofBar />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <AboutSection />
      <LogoAnimationSection />
      <CTASection />
      <Footer />
    </main>
  )
}
