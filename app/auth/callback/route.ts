import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /auth/callback
 *
 * Handles the OAuth code-exchange callback from Supabase.
 *
 * Design decisions:
 *   - We do NOT rely on provider_token here. Google returns it only
 *     on the very first consent screen; subsequent sign-ins omit it.
 *     Using it would cause intermittent connector failures.
 *   - Connector OAuth tokens (for Gmail/Docs/Slack rollback) are set up
 *     separately from /settings/connectors once the user is signed in.
 *   - All failure paths redirect to /auth/error with a reason param so
 *     the UI can display a helpful message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code  = searchParams.get("code")
  const error = searchParams.get("error")

  // ── Guard: Supabase sent an OAuth error ─────────────────────
  if (error) {
    console.error("[Trailback] Auth callback received error param:", error)
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error)}`
    )
  }

  // ── Guard: no authorization code ────────────────────────────
  if (!code) {
    console.error("[Trailback] Auth callback received no code")
    return NextResponse.redirect(`${origin}/auth/error?reason=no_code`)
  }

  // ── Exchange code for session ────────────────────────────────
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error("[Trailback] Code exchange failed:", exchangeError.message)
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`)
  }

  // ── Success: send user to the timeline dashboard ─────────────
  return NextResponse.redirect(`${origin}/timeline`)
}
