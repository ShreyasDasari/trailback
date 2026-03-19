import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/timeline"

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error("Auth callback error:", error)
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  const session = data.session
  const provider_token = session.provider_token
  const provider_refresh_token = session.provider_refresh_token ?? null
  const access_token = session.access_token
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  // Debug logs
  console.log("provider_token present:", !!session.provider_token)
  console.log("provider_token preview:", session.provider_token?.substring(0, 20))

  if (provider_token && API_URL) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    }

    await Promise.allSettled([
      fetch(`${API_URL}/api/v1/connectors/upsert`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          app: "gmail",
          oauth_token: provider_token,
          refresh_token: provider_refresh_token,
          scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
          ],
        }),
      }),
      fetch(`${API_URL}/api/v1/connectors/upsert`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          app: "gdocs",
          oauth_token: provider_token,
          refresh_token: provider_refresh_token,
          scopes: [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/documents",
          ],
        }),
      }),
    ])
  } else {
    console.warn("provider_token missing — connectors not stored. Token:", provider_token)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
