import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  buildAuthErrorResponse,
  getAuthenticatedAccount,
  getTapSyncMeta,
  syncAccountProgress,
} from "@/lib/accountAuth";

function buildTapPayload(account, reward = null, extra = {}) {
  const progress = account.activity?.progress || {};
  const meta = getTapSyncMeta(account);

  return {
    message: reward ? "Reward unlocked." : "Tap synced.",
    tapCount: Number(account.clickCount || 0),
    currentCycle: Number(progress.currentCycle || 1),
    currentTapInCycle: Number(progress.currentTapInCycle || 0),
    tapsPerCycle: Number(account.activity?.tapsPerCycle || 1),
    totalCycles: Number(account.activity?.totalCycles || 1),
    coolDownUntil: progress.coolDownUntil || null,
    completed:
      Number(progress.currentCycle || 1) >=
        Number(account.activity?.totalCycles || 1) &&
      Number(progress.currentTapInCycle || 0) >=
        Number(account.activity?.tapsPerCycle || 1),
    nextRewardTap: meta.nextRewardTap,
    nextSyncTap: meta.nextSyncTap,
    reward,
    ...extra,
  };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    await dbConnect();

    const auth = await getAuthenticatedAccount(
      req,
      "clickCount expireAt status activity",
    );

    if (!auth.ok) {
      return buildAuthErrorResponse(auth);
    }

    const account = auth.account;
    const sync = syncAccountProgress(account);

    if (sync.changed) {
      await account.save();
    }

    const progress = account.activity?.progress || {};
    const coolDownUntil = progress.coolDownUntil
      ? new Date(progress.coolDownUntil)
      : null;

    if (coolDownUntil && coolDownUntil.getTime() > Date.now()) {
      return NextResponse.json(
        {
          message: "Cooldown is active.",
          coolDownActive: true,
          ...buildTapPayload(account),
        },
        { status: 429 },
      );
    }

    if (sync.completed) {
      return NextResponse.json(
        {
          message: "All tap cycles are completed.",
          ...buildTapPayload(account),
        },
        { status: 403 },
      );
    }

    const tapsPerCycle = Math.max(1, Number(account.activity?.tapsPerCycle || 1));
    const coolDownMinutes = Math.max(
      1,
      Number(account.activity?.coolDownMinutes || 30),
    );

    const currentCycle = Number(progress.currentCycle || 1);
    const savedTap = Number(progress.currentTapInCycle || 0);

    const requestedCycle = Number(body?.currentCycle);
    const requestedTargetTap = Number(body?.targetTapInCycle);

    if (
      Number.isFinite(requestedCycle) &&
      requestedCycle > 0 &&
      requestedCycle !== currentCycle
    ) {
      return NextResponse.json(
        buildTapPayload(account, null, {
          message: "Tap sync refreshed.",
          resync: true,
        }),
        { status: 200 },
      );
    }

    if (!Number.isFinite(requestedTargetTap) || requestedTargetTap <= savedTap) {
      return NextResponse.json(
        buildTapPayload(account, null, {
          message: "Nothing to sync.",
        }),
        { status: 200 },
      );
    }

    const requestedClampedTap = Math.min(
      tapsPerCycle,
      Math.max(savedTap, Math.floor(requestedTargetTap)),
    );

    if (requestedClampedTap <= savedTap) {
      return NextResponse.json(buildTapPayload(account), { status: 200 });
    }

    let reward = null;
    let effectiveTargetTap = requestedClampedTap;

    const timeline = Array.isArray(account.activity?.timeline)
      ? account.activity.timeline
      : [];

    for (const item of timeline) {
      const itemCycle = Number(item?.cycleNumber || 0);
      const itemTap = Number(item?.tapNumber || 0);

      if (itemCycle !== currentCycle) continue;
      if (item?.claim) continue;
      if (itemTap <= savedTap) continue;
      if (itemTap > requestedClampedTap) continue;

      reward = {
        cycleNumber: itemCycle,
        tapNumber: itemTap,
        resourceName: item.resourceName,
        fileName: item.fileName || "",
        quantity: Number(item.quantity || 1),
      };
      effectiveTargetTap = itemTap;
      break;
    }

    const delta = effectiveTargetTap - savedTap;

    account.clickCount = Number(account.clickCount || 0) + delta;
    account.activity.progress.currentTapInCycle = effectiveTargetTap;

    if (
      effectiveTargetTap >= tapsPerCycle &&
      currentCycle < Number(account.activity?.totalCycles || 1)
    ) {
      account.activity.progress.coolDownUntil = new Date(
        Date.now() + coolDownMinutes * 60 * 1000,
      );
    } else if (effectiveTargetTap >= tapsPerCycle) {
      account.activity.progress.coolDownUntil = null;
    }

    await account.save();

    return NextResponse.json(buildTapPayload(account, reward), { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}