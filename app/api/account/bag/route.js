import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import dbConnect from "@/lib/dbConnect"
import Account from "@/models/Account"

export async function GET() {
  try {
    if (!process.env.JWT_SECRET) return NextResponse.json({ message: "Server misconfigured." }, { status: 500 })

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value
    if (!token) return NextResponse.json({ message: "Unauthorized." }, { status: 401 })

    let payload
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 })
    }

    const accountId = payload?.accountId
    if (!accountId) return NextResponse.json({ message: "Unauthorized." }, { status: 401 })

    await dbConnect()
    const account = await Account.findById(accountId).select("bag").lean()
    if (!account) return NextResponse.json({ message: "Account not found." }, { status: 404 })

    const bag = account?.bag || {}
    return NextResponse.json(
      { bag: { silver: Number(bag.silver || 0), gold: Number(bag.gold || 0), diamond: Number(bag.diamond || 0) } },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ message: "Internal server error." }, { status: 500 })
  }
}
