import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import Account from "@/models/Account";
import { serializeResourceItem } from "@/lib/resourcePayload";

export function clearAccountCookie(response) {
  response.cookies.set({
    name: "token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export function buildAuthErrorResponse(auth) {
  const response = NextResponse.json(
    {
      message: auth?.message || "Unauthorized.",
      expired: !!auth?.expired,
      completed: !!auth?.completed,
    },
    { status: auth?.status || 401 },
  );

  if (auth?.clearCookie) {
    clearAccountCookie(response);
  }

  return response;
}

export async function getAuthenticatedAccount(req, select = "") {
  if (!process.env.JWT_SECRET) {
    return {
      ok: false,
      status: 500,
      message: "Server misconfigured.",
      clearCookie: false,
    };
  }

  const token = req.cookies.get("token")?.value;

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized.",
      clearCookie: true,
    };
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized.",
      clearCookie: true,
    };
  }

  const accountId = payload?.accountId;

  if (!accountId) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized.",
      clearCookie: true,
    };
  }

  let query = Account.findById(accountId);

  if (select) {
    query = query.select(select);
  }

  const account = await query;

  if (!account) {
    return {
      ok: false,
      status: 404,
      message: "Account not found.",
      clearCookie: true,
    };
  }

  const expireAtMs = new Date(account.expireAt || 0).getTime();

  if (!account.status) {
    return {
      ok: false,
      status: 403,
      message: "This account is inactive.",
      clearCookie: true,
      expired: true,
    };
  }

  if (!expireAtMs || Number.isNaN(expireAtMs) || expireAtMs <= Date.now()) {
    return {
      ok: false,
      status: 403,
      message: "Your account has expired.",
      clearCookie: true,
      expired: true,
    };
  }

  return {
    ok: true,
    account,
  };
}

export function syncAccountProgress(account) {
  const activity = account.activity || {};

  if (!activity.progress) {
    activity.progress = {
      currentCycle: 1,
      currentTapInCycle: 0,
      claimedDrops: 0,
      coolDownUntil: null,
      coolDownMinutes: Math.max(1, Number(activity.coolDownMinutes || 30)),
    };
  }

  const tapsPerCycle = Math.max(1, Number(activity.tapsPerCycle || 1));
  const totalCycles = Math.max(1, Number(activity.totalCycles || 1));

  let currentCycle = Math.max(1, Number(activity.progress.currentCycle || 1));
  let currentTapInCycle = Math.max(
    0,
    Number(activity.progress.currentTapInCycle || 0),
  );
  let coolDownUntil = activity.progress.coolDownUntil
    ? new Date(activity.progress.coolDownUntil)
    : null;
  let changed = false;

  if (currentTapInCycle > tapsPerCycle) {
    currentTapInCycle = tapsPerCycle;
    changed = true;
  }

  if (
    coolDownUntil &&
    !Number.isNaN(coolDownUntil.getTime()) &&
    coolDownUntil.getTime() <= Date.now() &&
    currentTapInCycle >= tapsPerCycle &&
    currentCycle < totalCycles
  ) {
    currentCycle += 1;
    currentTapInCycle = 0;
    coolDownUntil = null;
    changed = true;
  }

  activity.progress.currentCycle = currentCycle;
  activity.progress.currentTapInCycle = currentTapInCycle;
  activity.progress.coolDownUntil = coolDownUntil;

  account.activity = activity;

  const completed =
    currentCycle >= totalCycles && currentTapInCycle >= tapsPerCycle;

  return {
    changed,
    completed,
    currentCycle,
    currentTapInCycle,
    coolDownUntil,
    tapsPerCycle,
    totalCycles,
  };
}

export function getUpcomingReward(account, cycleNumber, afterTap = 0) {
  const timeline = Array.isArray(account?.activity?.timeline)
    ? account.activity.timeline
    : [];

  let nextRewardItem = null;

  for (const item of timeline) {
    const itemCycle = Number(item?.cycleNumber || 0);
    const itemTap = Number(item?.tapNumber || 0);

    if (itemCycle !== cycleNumber) continue;
    if (item?.claim) continue;
    if (itemTap <= afterTap) continue;

    if (
      !nextRewardItem ||
      itemTap < Number(nextRewardItem?.tapNumber || Number.MAX_SAFE_INTEGER)
    ) {
      nextRewardItem = item;
    }
  }

  if (!nextRewardItem) {
    return null;
  }

  return serializeResourceItem(nextRewardItem, {
    cycleNumber: Number(nextRewardItem.cycleNumber || 0),
    tapNumber: Number(nextRewardItem.tapNumber || 0),
    quantity: Number(nextRewardItem.quantity || 1),
  });
}

export function getNextRewardTap(account, cycleNumber, afterTap = 0) {
  return Number(getUpcomingReward(account, cycleNumber, afterTap)?.tapNumber || 0) || null;
}

export function getTapSyncMeta(account) {
  const currentCycle = Math.max(
    1,
    Number(account?.activity?.progress?.currentCycle || 1),
  );
  const currentTapInCycle = Math.max(
    0,
    Number(account?.activity?.progress?.currentTapInCycle || 0),
  );
  const tapsPerCycle = Math.max(1, Number(account?.activity?.tapsPerCycle || 1));
  const nextReward = getUpcomingReward(account, currentCycle, currentTapInCycle);
  const nextRewardTap = nextReward?.tapNumber ?? null;

  return {
    nextReward,
    nextRewardTap:
      typeof nextRewardTap === "number" && Number.isFinite(nextRewardTap)
        ? nextRewardTap
        : null,
    nextSyncTap:
      typeof nextRewardTap === "number" && Number.isFinite(nextRewardTap)
        ? nextRewardTap
        : tapsPerCycle,
  };
}
