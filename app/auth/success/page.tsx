"use client"

/**
 * /auth/success — legacy extension session bridge.
 * The Chrome extension is archived. This page is no longer reachable via any
 * active user flow. If someone lands here, redirect immediately to the dashboard.
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AuthSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/timeline")
  }, [router])

  return null
}
