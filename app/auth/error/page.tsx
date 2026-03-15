"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { AlertCircle, ArrowLeft } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mx-auto mb-6">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Authentication Error
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          There was a problem signing you in. This could be due to an expired
          link or a configuration issue.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
      </motion.div>
    </div>
  )
}
