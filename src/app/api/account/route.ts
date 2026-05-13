import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerSupabase } from "@/lib/supabase/server"

export async function DELETE() {
  const cookieStore = await cookies()
  const supabase = await createServerSupabase(cookieStore)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    return NextResponse.json(
      {
        error:
          "Account deletion is not available. Add SUPABASE_SERVICE_ROLE_KEY to your server environment.",
      },
      { status: 503 },
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Failed to delete account" },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
