import { NextResponse } from "next/server"
import dbConnect from "@/lib/dbConnect"
import MyResource from "@/models/MyResource"
import {
  buildAuthErrorResponse,
  getAuthenticatedAccount,
  syncAccountProgress,
} from "@/lib/accountAuth"

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const cycleNumber = Number(body?.cycleNumber)
    const tapNumber = Number(body?.tapNumber)

    if (!Number.isFinite(cycleNumber) || cycleNumber <= 0) {
      return NextResponse.json(
        { message: "Valid cycle number is required." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(tapNumber) || tapNumber <= 0) {
      return NextResponse.json(
        { message: "Valid tap number is required." },
        { status: 400 }
      )
    }

    await dbConnect()

    const auth = await getAuthenticatedAccount(
      req,
      "ownerId expireAt status resources activity"
    )

    if (!auth.ok) {
      return buildAuthErrorResponse(auth)
    }

    const account = auth.account
    const sync = syncAccountProgress(account)

    if (sync.changed) {
      await account.save()
    }

    const drops = Array.isArray(account.activity?.timeline)
      ? account.activity.timeline
      : []

    const targetIndex = drops.findIndex(
      (item) =>
        Number(item.cycleNumber) === cycleNumber &&
        Number(item.tapNumber) === tapNumber
    )

    if (targetIndex === -1) {
      return NextResponse.json(
        { message: "Reward not found." },
        { status: 404 }
      )
    }

    const drop = drops[targetIndex]

    if (drop.claim) {
      return NextResponse.json(
        { message: "This reward is already collected." },
        { status: 409 }
      )
    }

    drop.claim = true
    drop.claimedAt = new Date()
    account.activity.progress.claimedDrops =
      Number(account.activity?.progress?.claimedDrops || 0) + 1

    const resourceIndex = Array.isArray(account.resources)
      ? account.resources.findIndex(
          (item) => item.resourceName === drop.resourceName
        )
      : -1

    if (resourceIndex >= 0) {
      account.resources[resourceIndex].claimedQuantity =
        Number(account.resources[resourceIndex].claimedQuantity || 0) +
        Number(drop.quantity || 1)
    }

    await account.save()

    let myResourceDoc = await MyResource.findOne({ userId: account.ownerId })

    if (!myResourceDoc) {
      myResourceDoc = new MyResource({
        userId: account.ownerId,
        resources: [],
      })
    }

    const myResourceIndex = Array.isArray(myResourceDoc.resources)
      ? myResourceDoc.resources.findIndex(
          (item) => item.name === drop.resourceName
        )
      : -1

    if (myResourceIndex >= 0) {
      myResourceDoc.resources[myResourceIndex].stock =
        Number(myResourceDoc.resources[myResourceIndex].stock || 0) +
        Number(drop.quantity || 1)

      if (!myResourceDoc.resources[myResourceIndex].fileName && drop.fileName) {
        myResourceDoc.resources[myResourceIndex].fileName = drop.fileName
      }
    } else {
      myResourceDoc.resources.push({
        name: drop.resourceName,
        fileName: drop.fileName || "",
        stock: Number(drop.quantity || 1),
      })
    }

    await myResourceDoc.save()

    return NextResponse.json(
      {
        message: `${drop.resourceName} collected successfully.`,
        reward: {
          cycleNumber: Number(drop.cycleNumber || 0),
          tapNumber: Number(drop.tapNumber || 0),
          resourceName: drop.resourceName,
          fileName: drop.fileName || "",
          quantity: Number(drop.quantity || 1),
        },
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    )
  }
}