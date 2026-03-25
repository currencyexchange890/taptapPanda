import { NextResponse } from "next/server"
import { clearAccountCookie } from "@/lib/accountAuth"

export async function POST() {
  const response = NextResponse.json(
    { message: "Sign out successful." },
    { status: 200 }
  )

  clearAccountCookie(response)

  return response
}