import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import MyResource from "@/models/MyResource";
import {
  buildAuthErrorResponse,
  getAuthenticatedAccount,
  getTapSyncMeta,
  syncAccountProgress,
} from "@/lib/accountAuth";

export async function GET(req) {
  try {
    await dbConnect();

    const auth = await getAuthenticatedAccount(
      req,
      "ownerId username packageName clickCount expireAt resources activity status",
    );

    if (!auth.ok) {
      return buildAuthErrorResponse(auth);
    }

    const account = auth.account;
    const sync = syncAccountProgress(account);

    if (sync.changed) {
      await account.save();
    }

    const tapMeta = getTapSyncMeta(account);

    const myResourceDoc = await MyResource.findOne({ userId: account.ownerId })
      .select("resources")
      .lean();

    const collectedMap = new Map();

    if (Array.isArray(myResourceDoc?.resources)) {
      for (const item of myResourceDoc.resources) {
        const key = String(item?.name || "").trim().toLowerCase();
        if (!key) continue;

        collectedMap.set(key, {
          name: item.name,
          fileName: item.fileName || "",
          stock: Number(item.stock || 0),
        });
      }
    }

    const resourceList = Array.isArray(account.resources)
      ? account.resources.map((item) => {
          const key = String(item?.resourceName || "").trim().toLowerCase();
          const matched = collectedMap.get(key);

          return {
            name: item.resourceName,
            fileName: matched?.fileName || item.fileName || "",
            stock: Number(matched?.stock || 0),
            totalQuantity: Number(item.quantity || 0),
            claimedQuantity: Number(item.claimedQuantity || 0),
          };
        })
      : [];

    return NextResponse.json(
      {
        account: {
          username: account.username,
          packageName: account.packageName,
          expireAt: account.expireAt,
          clickCount: Number(account.clickCount || 0),
          status: !!account.status,
        },
        activity: {
          currentCycle: Number(account.activity?.progress?.currentCycle || 1),
          currentTapInCycle: Number(
            account.activity?.progress?.currentTapInCycle || 0,
          ),
          claimedDrops: Number(account.activity?.progress?.claimedDrops || 0),
          coolDownUntil: account.activity?.progress?.coolDownUntil || null,
          coolDownMinutes: Number(account.activity?.coolDownMinutes || 0),
          tapsPerCycle: Number(account.activity?.tapsPerCycle || 1),
          totalCycles: Number(account.activity?.totalCycles || 1),
          totalDrops: Number(account.activity?.totalDrops || 0),
          completed: sync.completed,
          nextRewardTap: tapMeta.nextRewardTap,
          nextSyncTap: tapMeta.nextSyncTap,
        },
        resources: resourceList,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}