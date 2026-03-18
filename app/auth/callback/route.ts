import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/timeline"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Store OAuth tokens in backend for rollback to work
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.provider_token) {
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        }

        await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/connectors/upsert`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              app: "gmail",
              oauth_token: session.provider_token,
              refresh_token: session.provider_refresh_token ?? null,
              scopes: ["https://www.googleapis.com/auth/gmail.modify"],
            }),
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/connectors/upsert`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              app: "gdocs",
              oauth_token: session.provider_token,
              refresh_token: session.provider_refresh_token ?? null,
              scopes: ["https://www.googleapis.com/auth/drive.file"],
            }),
          }),
        ])
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`)
}
