import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/timeline"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // Get tokens directly from exchangeCodeForSession response
      const provider_token = data.session.provider_token
      const provider_refresh_token = data.session.provider_refresh_token
      const access_token = data.session.access_token

      if (provider_token) {
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`,
        }

        await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/connectors/upsert`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              app: "gmail",
              oauth_token: provider_token,
              refresh_token: provider_refresh_token ?? null,
              scopes: ["https://www.googleapis.com/auth/gmail.modify"],
            }),
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/connectors/upsert`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              app: "gdocs",
              oauth_token: provider_token,
              refresh_token: provider_refresh_token ?? null,
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
