import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import dbConnect from "@/lib/dbConnect"
import Account from "@/models/Account"

export async function POST(req) {

  
  try {
    const body = await req.json().catch(() => ({}))
    const username = String(body?.username || "").trim().toLowerCase()
    const password = String(body?.password || "").trim()

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required." },
        { status: 400 }
      )
    }

    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        { message: "Server misconfigured." },
        { status: 500 }
      )
    }

    await dbConnect()

    const account = await Account.findOne({ username })
      .select("username password status expireAt packageName")
      .lean()

    if (!account) {
      return NextResponse.json(
        { message: "Username not found." },
        { status: 401 }
      )
    }

    if (String(account.password) !== password) {
      return NextResponse.json(
        { message: "Incorrect password." },
        { status: 401 }
      )
    }

    const expireAtMs = new Date(account.expireAt || 0).getTime()

    if (
      !account.status ||
      !expireAtMs ||
      Number.isNaN(expireAtMs) ||
      expireAtMs <= Date.now()
    ) {
      return NextResponse.json(
        { message: "This account is inactive or expired." },
        { status: 403 }
      )
    }

    const token = jwt.sign(
      { accountId: String(account._id) },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )

    const response = NextResponse.json(
      {
        message: "Login successful.",
        username: account.username,
        packageName: account.packageName,
        expireAt: account.expireAt,
      },
      { status: 200 }
    )

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    return response
  } catch {
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    )
  }
}