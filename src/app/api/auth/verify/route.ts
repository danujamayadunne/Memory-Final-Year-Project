import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }
    
    return NextResponse.json({ 
      valid: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split('@')[0]
      }
    })
    
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
