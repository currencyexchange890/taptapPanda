"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-BD");
}

function formatDuration(ms) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}


function getResourceImage(resource) {
  const imageUrl =
    typeof resource === "string"
      ? resource
      : String(resource?.imageUrl || "").trim();

  if (imageUrl) return imageUrl;

  const fileName =
    typeof resource === "string" ? "" : String(resource?.fileName || "").trim();

  if (!fileName) return "/assets/images/silver.png";
  if (/^https?:\/\//i.test(fileName)) return fileName;

  return `/image/${encodeURIComponent(fileName)}`;
}

function resolveUpcomingRewardPreview(data) {
  return (
    data?.nextReward ||
    data?.rewardPreview ||
    data?.activity?.nextReward ||
    data?.activity?.rewardPreview ||
    null
  );
}

function preloadRewardImage(resource) {
  if (typeof window === "undefined") return;
  const src = getResourceImage(resource);
  if (!src) return;
  const image = new window.Image();
  image.src = src;
}

function isSameReward(first, second) {
  if (!first || !second) return false;

  return (
    Number(first?.cycleNumber || 0) === Number(second?.cycleNumber || 0) &&
    Number(first?.tapNumber || 0) === Number(second?.tapNumber || 0)
  );
}

function isRewardUnlocked(activity, reward) {
  const currentCycle = Number(activity?.currentCycle || 0);
  const currentTapInCycle = Number(activity?.currentTapInCycle || 0);
  const rewardCycle = Number(reward?.cycleNumber || 0);
  const rewardTap = Number(reward?.tapNumber || 0);

  return (
    currentCycle > rewardCycle ||
    (currentCycle === rewardCycle && currentTapInCycle >= rewardTap)
  );
}

function getRandomRewardPosition() {
  if (typeof window === "undefined") {
    return { top: 112, left: 16 };
  }

  const margin = 14;
  const size = Math.min(258, window.innerWidth - margin * 2);
  const maxLeft = Math.max(margin, window.innerWidth - size - margin);
  const maxTop = Math.max(84, window.innerHeight - size - margin);

  const left =
    maxLeft <= margin
      ? Math.max(margin, (window.innerWidth - size) / 2)
      : margin + Math.random() * (maxLeft - margin);

  const top =
    maxTop <= 84
      ? Math.max(84, (window.innerHeight - size) / 2)
      : 84 + Math.random() * (maxTop - 84);

  return {
    top: Math.round(top),
    left: Math.round(left),
  };
}

export default function TapTapPandaPage() {
  const router = useRouter();
  const wrapRef = useRef(null);
  const nextId = useRef(1);
  const cooldownRef = useRef(null);
  const activeTapSyncRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pops, setPops] = useState([]);
  const [session, setSession] = useState(null);
  const [reward, setReward] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rewardPosition, setRewardPosition] = useState({ top: 112, left: 16 });
  const [preparedRewardPosition, setPreparedRewardPosition] = useState({
    top: 112,
    left: 16,
  });
  const [preparedRewardPreview, setPreparedRewardPreview] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [liveTapCount, setLiveTapCount] = useState(0);
  const [liveCurrentTapInCycle, setLiveCurrentTapInCycle] = useState(0);
  const [liveCurrentCycle, setLiveCurrentCycle] = useState(1);
  const [nextSyncTap, setNextSyncTap] = useState(1);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const applySessionData = (data) => {
    setSession(data);
    setLiveTapCount(Number(data?.account?.clickCount || 0));
    setLiveCurrentTapInCycle(Number(data?.activity?.currentTapInCycle || 0));
    setLiveCurrentCycle(Number(data?.activity?.currentCycle || 1));
    setNextSyncTap(
      Number(data?.activity?.nextSyncTap || data?.activity?.tapsPerCycle || 1),
    );
    setPreparedRewardPreview(resolveUpcomingRewardPreview(data));
    setHasPendingSync(false);
  };

  const applyTapResponse = (data) => {
    setSession((prev) => ({
      ...prev,
      account: {
        ...prev?.account,
        clickCount: data?.tapCount ?? prev?.account?.clickCount ?? 0,
        tapCount: data?.tapCount ?? prev?.account?.tapCount ?? 0,
      },
      activity: {
        ...prev?.activity,
        currentCycle: data?.currentCycle ?? prev?.activity?.currentCycle,
        currentTapInCycle:
          data?.currentTapInCycle ?? prev?.activity?.currentTapInCycle,
        tapsPerCycle: data?.tapsPerCycle ?? prev?.activity?.tapsPerCycle,
        totalCycles: data?.totalCycles ?? prev?.activity?.totalCycles,
        coolDownUntil: data?.coolDownUntil ?? null,
        completed: !!data?.completed,
        nextRewardTap: data?.nextRewardTap ?? null,
        nextSyncTap:
          data?.nextSyncTap ??
          prev?.activity?.nextSyncTap ??
          prev?.activity?.tapsPerCycle,
      },
      nextReward:
        data?.nextReward ??
        data?.rewardPreview ??
        data?.activity?.nextReward ??
        data?.activity?.rewardPreview ??
        prev?.nextReward,
    }));

    setLiveTapCount(Number(data?.tapCount || 0));
    setLiveCurrentTapInCycle(Number(data?.currentTapInCycle || 0));
    setLiveCurrentCycle(Number(data?.currentCycle || 1));
    setNextSyncTap(Number(data?.nextSyncTap || data?.tapsPerCycle || 1));
    setPreparedRewardPreview(resolveUpcomingRewardPreview(data));
    setHasPendingSync(false);
  };

  const openRewardModal = (nextReward, position = preparedRewardPosition) => {
    if (!nextReward) return;

    preloadRewardImage(nextReward);
    setRewardPosition(position);
    setPreparedRewardPosition(getRandomRewardPosition());
    setReward(nextReward);
    setModalOpen(true);
  };

  useEffect(() => {
    setPreparedRewardPosition(getRandomRewardPosition());
    loadSession();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!preparedRewardPreview?.imageUrl && !preparedRewardPreview?.fileName) return;
    preloadRewardImage(preparedRewardPreview);
  }, [preparedRewardPreview?.imageUrl, preparedRewardPreview?.fileName]);

  const expireAtMs = new Date(session?.account?.expireAt || 0).getTime();
  const coolDownUntilMs = new Date(
    session?.activity?.coolDownUntil || 0,
  ).getTime();

  const remainingValidity =
    expireAtMs && expireAtMs > now
      ? formatDuration(expireAtMs - now)
      : "00:00:00";

  const remainingCooldownMs =
    coolDownUntilMs && coolDownUntilMs > now ? coolDownUntilMs - now : 0;

  const remainingCooldown =
    remainingCooldownMs > 0 ? formatDuration(remainingCooldownMs) : null;

  async function loadSession({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);

      const res = await fetch("/api/account/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        toast.error(data?.message || "Session expired.");
        router.replace("/signin");
        return;
      }

      if (!res.ok) {
        toast.error(data?.message || "Failed to load account.");
        return;
      }

      applySessionData(data);
    } catch {
      toast.error("Failed to load account.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!remainingCooldownMs) {
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }

    if (cooldownRef.current) {
      clearTimeout(cooldownRef.current);
    }

    cooldownRef.current = setTimeout(() => {
      loadSession({ silent: true });
    }, remainingCooldownMs + 400);

    return () => {
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [remainingCooldownMs]);

  const flushTapProgress = async ({
    targetCycle = liveCurrentCycle,
    targetTapInCycle = liveCurrentTapInCycle,
    keepalive = false,
    silent = false,
    allowWhileModalOpen = false,
  } = {}) => {
    if (!session) return false;

    const serverCycle = Number(session?.activity?.currentCycle || 1);
    const serverTap = Number(session?.activity?.currentTapInCycle || 0);

    if (targetCycle === serverCycle && targetTapInCycle <= serverTap) {
      setHasPendingSync(false);
      return false;
    }

    if (!keepalive && activeTapSyncRef.current) {
      return activeTapSyncRef.current;
    }

    const runRequest = async () => {
      if (!keepalive) {
        if (modalOpen && !allowWhileModalOpen) return false;
        setSyncing(true);
      }

      try {
        const res = await fetch("/api/tap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive,
          body: JSON.stringify({
            currentCycle: targetCycle,
            targetTapInCycle,
          }),
        });

        if (keepalive) {
          return true;
        }

        const data = await res.json().catch(() => ({}));

        if (res.status === 401 || res.status === 403) {
          if (data?.completed) {
            applyTapResponse(data);
            toast.error(data?.message || "All tap cycles are completed.");
            return false;
          }

          toast.error(data?.message || "Session expired.");
          router.replace("/signin");
          return false;
        }

        if (res.status === 429) {
          applyTapResponse(data);
          return false;
        }

        if (!res.ok) {
          if (!silent) {
            toast.error(data?.message || "Tap sync failed.");
          }
          return false;
        }

        applyTapResponse(data);

        if (data?.reward) {
          const responseReward = data.reward;
          const hasSameOpenReward = modalOpen && isSameReward(reward, responseReward);

          if (!hasSameOpenReward) {
            openRewardModal(responseReward);
          }
        }

        return true;
      } catch {
        if (!keepalive && !silent) {
          toast.error("Network error. Please try again.");
        }
        return false;
      } finally {
        if (!keepalive) {
          setSyncing(false);
        }
      }
    };

    if (keepalive) {
      return runRequest();
    }

    activeTapSyncRef.current = runRequest().finally(() => {
      activeTapSyncRef.current = null;
    });

    return activeTapSyncRef.current;
  };

  useEffect(() => {
    if (!hasPendingSync || !session || syncing || modalOpen || claiming) return;

    const interval = setTimeout(() => {
      flushTapProgress({ silent: true });
    }, 5000);

    return () => clearTimeout(interval);
  }, [
    hasPendingSync,
    session,
    syncing,
    modalOpen,
    claiming,
    liveCurrentCycle,
    liveCurrentTapInCycle,
  ]);

  useEffect(() => {
    const flushBeforeLeave = () => {
      if (
        hasPendingSync &&
        session &&
        !syncing &&
        !modalOpen &&
        !claiming &&
        !remainingCooldown
      ) {
        flushTapProgress({ keepalive: true, silent: true });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushBeforeLeave();
      }
    };

    window.addEventListener("pagehide", flushBeforeLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushBeforeLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    hasPendingSync,
    session,
    syncing,
    modalOpen,
    claiming,
    remainingCooldown,
    liveCurrentCycle,
    liveCurrentTapInCycle,
  ]);

  const spawn = (clientX, clientY) => {
    const id = nextId.current++;
    const rect = wrapRef.current?.getBoundingClientRect();
    const x = rect ? clientX - rect.left : 200;
    const y = rect ? clientY - rect.top : 260;
    const dx = Number((Math.random() * 50 - 25).toFixed(2));
    const dy = Number((-(78 + Math.random() * 55)).toFixed(2));
    const r = Number((Math.random() * 14 - 7).toFixed(2));

    setPops((prev) => [...prev, { id, x, y, dx, dy, r }]);
    setTimeout(() => {
      setPops((prev) => prev.filter((item) => item.id !== id));
    }, 850);
  };

  const signOut = async () => {
    if (signingOut) return;

    try {
      setSigningOut(true);

      if (hasPendingSync && !syncing) {
        await flushTapProgress({ silent: true });
      }

      const res = await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.message || "Sign out failed.");
        setSigningOut(false);
        return;
      }

      toast.success(data?.message || "Signed out.");
      router.replace("/signin");
    } catch {
      toast.error("Network error. Please try again.");
      setSigningOut(false);
    }
  };

  const handleTap = async (e) => {
    if (
      loading ||
      syncing ||
      modalOpen ||
      claiming ||
      !session ||
      remainingCooldown
    ) {
      return;
    }

    if (expireAtMs && expireAtMs <= Date.now()) {
      toast.error("Your account has expired.");
      router.replace("/signin");
      return;
    }

    try {
      e.preventDefault();
      spawn(e.clientX, e.clientY);
      setPressed(true);
      setTimeout(() => setPressed(false), 110);

      const tapsPerCycle = Math.max(
        1,
        Number(session?.activity?.tapsPerCycle || 1),
      );
      const nextRewardTap = Number(session?.activity?.nextRewardTap || 0);
      const nextTapCount = liveTapCount + 1;
      const nextTapInCycle = Math.min(tapsPerCycle, liveCurrentTapInCycle + 1);
      const syncBoundary = Math.max(1, Number(nextSyncTap || tapsPerCycle));
      const preparedRewardReady =
        nextRewardTap > 0 &&
        nextTapInCycle === nextRewardTap &&
        Number(preparedRewardPreview?.cycleNumber || 0) === liveCurrentCycle &&
        Number(preparedRewardPreview?.tapNumber || 0) === nextRewardTap;

      setLiveTapCount(nextTapCount);
      setLiveCurrentTapInCycle(nextTapInCycle);
      setHasPendingSync(true);

      if (preparedRewardReady) {
        openRewardModal(preparedRewardPreview);
        void flushTapProgress({
          targetCycle: liveCurrentCycle,
          targetTapInCycle: nextTapInCycle,
          silent: true,
          allowWhileModalOpen: true,
        });
        return;
      }

      if (nextTapInCycle >= syncBoundary || nextTapInCycle >= tapsPerCycle) {
        await flushTapProgress({
          targetCycle: liveCurrentCycle,
          targetTapInCycle: nextTapInCycle,
          silent: true,
        });
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  };

  const collectReward = async () => {
    if (!reward || claiming) return;

    try {
      setClaiming(true);

      if (activeTapSyncRef.current) {
        await activeTapSyncRef.current;
      }

      if (!isRewardUnlocked(session?.activity, reward) || hasPendingSync) {
        await flushTapProgress({
          targetCycle: Number(reward?.cycleNumber || liveCurrentCycle),
          targetTapInCycle: Number(reward?.tapNumber || liveCurrentTapInCycle),
          silent: true,
          allowWhileModalOpen: true,
        });
      }

      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cycleNumber: reward.cycleNumber,
          tapNumber: reward.tapNumber,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        toast.error(data?.message || "Session expired.");
        router.replace("/signin");
        return;
      }

      if (!res.ok) {
        toast.error(data?.message || "Claim failed.");
        setClaiming(false);
        return;
      }

      toast.success(data?.message || "Reward collected.");
      setModalOpen(false);
      setReward(null);
      setClaiming(false);
      setPreparedRewardPosition(getRandomRewardPosition());
      await loadSession({ silent: true });
    } catch {
      toast.error("Network error. Please try again.");
      setClaiming(false);
    }
  };

  const cycleProgress = Math.min(
    Math.max(1, Number(session?.activity?.tapsPerCycle || 1)),
    liveCurrentTapInCycle,
  );
  const tapsPerCycle = Math.max(
    1,
    Number(session?.activity?.tapsPerCycle || 1),
  );
  const cycleProgressPct = Math.min(100, (cycleProgress / tapsPerCycle) * 100);
  const displayResources = Array.isArray(session?.resources)
    ? session.resources
    : [];

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0610] px-6 text-white">
        <div className="rounded-[18px] border border-white/10 bg-[#120816]/80 px-6 py-5 text-center shadow-[0_24px_90px_rgba(0,0,0,.58)] backdrop-blur-xl">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#ff3b57]" />
          <p className="text-sm text-white/75">Loading panda account...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={wrapRef}
      className="relative min-h-screen overflow-hidden bg-[#0b0610] px-4 py-6 text-white"
      style={{
        backgroundImage:
          "radial-gradient(900px 520px at 50% -10%, rgba(244,63,94,.22), transparent 58%), radial-gradient(820px 520px at 10% 75%, rgba(255,94,94,.18), transparent 62%)",
      }}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 1400,
          style: {
            background: "rgba(16,8,18,.96)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,.10)",
          },
        }}
      />

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Fugaz+One&display=swap");
        html,
        body {
          height: 100%;
          overscroll-behavior: none;
          touch-action: manipulation;
        }
        * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
        }
        @keyframes popFloat {
          0% {
            transform: translate3d(0, 0, 0) scale(0.92) rotate(0);
            opacity: 0;
          }
          12% {
            opacity: 1;
            transform: translate3d(0, -6px, 0) scale(1.02) rotate(0);
          }
          100% {
            transform: translate3d(var(--dx), var(--dy), 0) scale(1.18)
              rotate(var(--r));
            opacity: 0;
          }
        }
        @keyframes punch {
          0% {
            transform: translateZ(0) scale(1);
          }
          35% {
            transform: translateZ(0) scale(0.985);
          }
          100% {
            transform: translateZ(0) scale(1);
          }
        }
        @keyframes modalIn {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes spinSlow {
          0% {
            transform: rotate(0);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[460px]">
        <div className="rounded-[18px] border border-white/10 bg-[#120816]/70 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,.52)] backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="flex h-10 w-full items-center justify-center rounded-[12px] border border-white/10 bg-[linear-gradient(135deg,#22c55e,#16a34a)] px-3 text-sm font-bold tracking-[0.04em] text-white shadow-[0_14px_34px_rgba(34,197,94,.18)]">
                <span className="tabular-nums">{remainingValidity}</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex h-10 w-full items-center justify-center rounded-[12px] border border-white/10 bg-[linear-gradient(135deg,#7c3aed,#a855f7)] px-3 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(168,85,247,.18)]">
                {liveCurrentCycle}/{Number(session?.activity?.totalCycles || 1)}
              </div>
            </div>

            <div className="min-w-0">
              <button
                onClick={signOut}
                disabled={signingOut}
                className="flex h-10 w-full items-center justify-center rounded-[12px] border border-white/10 bg-[linear-gradient(135deg,#ff7a18,#ff5e3a)] px-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(255,122,24,.18)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {displayResources.length > 0 ? (
                displayResources.map((item) => (
                  <ResourceChip
                    key={item.resourceId || `${item.name}-${item.fileName}-${item.imageUrl || ""}`}
                    name={item.name}
                    fileName={item.fileName}
                    imageUrl={item.imageUrl}
                    stock={item.stock}
                  />
                ))
              ) : (
                <ZeroResourceChip />
              )}
            </div>
          </div>
        </div>

        <section className="mt-5 overflow-hidden rounded-[18px] border border-white/10 bg-[#120816]/85 shadow-[0_26px_90px_rgba(0,0,0,.62)] backdrop-blur-xl">
          <div className="space-y-4 px-5 pb-5 pt-5">
            <div className="rounded-[22px] border border-white/10 bg-[#0f0710]/70 p-4">
              <div className="relative mx-auto grid aspect-square w-full max-w-[420px] place-items-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#ff3b57]/22 to-transparent blur-2xl" />
                <div className="absolute inset-[5%] rounded-full border-8 border-[#ff3b57]/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]" />
                <div className="absolute inset-[12%] rounded-full border border-white/10 bg-gradient-to-b from-white/8 to-white/0" />

                <button
                  onPointerDown={handleTap}
                  disabled={
                    syncing ||
                    !!remainingCooldown ||
                    !!session?.activity?.completed ||
                    modalOpen ||
                    claiming
                  }
                  className={[
                    "relative grid h-[82%] w-[82%] place-items-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-b from-[#1b0b14] to-[#120816] shadow-[0_32px_90px_rgba(0,0,0,.68)] transition",
                    pressed ? "animate-[punch_180ms_ease-out]" : "",
                    syncing ||
                    remainingCooldown ||
                    session?.activity?.completed ||
                    modalOpen ||
                    claiming
                      ? "cursor-not-allowed opacity-85"
                      : "active:scale-[0.992]",
                  ].join(" ")}
                  aria-label="Tap panda"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#ff3b57]/18 to-transparent" />
                  <div className="relative grid place-items-center">
                    <div className="relative h-36 w-36 sm:h-44 sm:w-44">
                      <Image
                        src="/assets/images/panda1.png"
                        alt="Panda"
                        fill
                        sizes="176px"
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>
                </button>

                {pops.map((item) => (
                  <Pop
                    key={item.id}
                    x={item.x}
                    y={item.y}
                    dx={item.dx}
                    dy={item.dy}
                    r={item.r}
                    text="1+"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <span className="font-medium text-white/72">Tap Progress</span>
                <span className="font-semibold tabular-nums text-white/88">
                  {formatNumber(cycleProgress)} / {formatNumber(tapsPerCycle)}{" "}
                  taps
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-[#22c55e]"
                  style={{ width: `${cycleProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {modalOpen && reward ? (
          <RewardModal
            reward={reward}
            onCollect={collectReward}
            claiming={claiming}
            position={rewardPosition}
          />
        ) : null}

        {remainingCooldown ? <CooldownModal time={remainingCooldown} /> : null}
      </div>
    </main>
  );
}

function Pop({ x, y, dx, dy, r, text }) {
  return (
    <div
      className="pointer-events-none absolute text-lg font-extrabold drop-shadow-[0_12px_34px_rgba(0,0,0,.75)] sm:text-xl"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%,-50%)",
        "--dx": `${dx}px`,
        "--dy": `${dy}px`,
        "--r": `${r}deg`,
        animation: "popFloat 850ms ease-out forwards",
      }}
    >
      <span className="bg-gradient-to-r from-[#ff3b57] to-[#ff6b6b] bg-clip-text text-transparent">
        {text}
      </span>
    </div>
  );
}

function RewardModal({ reward, onCollect, claiming, position }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" />

      <div
        className="fixed z-[51] w-[calc(100vw-28px)] max-w-[258px] aspect-square overflow-hidden rounded-[16px] border border-white/12 bg-[#120816]/94 shadow-[0_28px_110px_rgba(0,0,0,.72)] backdrop-blur-xl"
        style={{
          top: position?.top ?? 112,
          left: position?.left ?? 14,
          animation: "modalIn 140ms ease-out both",
        }}
      >
        <div className="absolute -right-24 -top-24 h-52 w-52 rounded-full bg-gradient-to-b from-[#ff3b57]/18 to-transparent blur-3xl" />

        <div className="relative flex h-full flex-col p-3">
          <div className="border-b border-white/10 pb-2">
            <div
              className="text-[10px] text-white/55"
              style={{ fontFamily: '"Fugaz One", system-ui' }}
            >
              REWARD
            </div>
            <div
              className="mt-1 text-[16px] leading-none"
              style={{ fontFamily: '"Fugaz One", system-ui' }}
            >
              {reward.resourceName}
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="grid w-full place-items-center rounded-[14px] border border-white/10 bg-white/5 px-3 py-3">
              <div className="relative h-[92px] w-[92px]">
                <Image
                  src={getResourceImage(reward)}
                  alt={reward.resourceName}
                  fill
                  sizes="92px"
                  className="object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,.55)]"
                  priority
                />
              </div>

              <div className="mt-2 text-xs text-white/72">
                Quantity: {reward.quantity}
              </div>
            </div>
          </div>

          <button
            onClick={onCollect}
            disabled={claiming}
            className={[
              "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[linear-gradient(135deg,#ff3b57,#ff6b6b)] px-4 text-black shadow-[0_18px_45px_rgba(244,63,94,.22)] transition",
              claiming
                ? "cursor-not-allowed opacity-70"
                : "hover:brightness-110 active:scale-[0.99]",
            ].join(" ")}
            type="button"
            style={{ fontFamily: '"Fugaz One", system-ui' }}
          >
            {claiming ? (
              <>
                <span
                  className="inline-block h-4 w-4 rounded-full border-2 border-black/30 border-t-black/80"
                  style={{ animation: "spinSlow 700ms linear infinite" }}
                />
                <span>Processing...</span>
              </>
            ) : (
              <>Collect</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CooldownModal({ time }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[320px] rounded-[18px] border border-white/10 bg-[#120816]/96 px-5 py-5 text-center shadow-[0_30px_120px_rgba(0,0,0,.72)]"
        style={{ animation: "modalIn 220ms ease-out both" }}
      >
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
          Cooldown
        </div>

        <div className="mt-3 text-[30px] font-black tabular-nums text-white">
          {time}
        </div>

        <p className="mt-2 text-xs leading-5 text-white/58">
          Please wait for the next cycle.
        </p>
      </div>
    </div>
  );
}

function ResourceChip({ name, fileName, imageUrl, stock }) {
  return (
    <span className="inline-flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-[14px] border border-white/10 bg-white/5 px-3 py-2">
      <span className="relative h-9 w-9 shrink-0">
        <Image
          src={getResourceImage({ imageUrl, fileName })}
          alt={name || "Resource"}
          fill
          sizes="36px"
          className="object-contain"
        />
      </span>
      <span className="text-sm font-bold tabular-nums text-white/90">
        {formatNumber(stock)}
      </span>
    </span>
  );
}

function ZeroResourceChip() {
  return (
    <span className="inline-flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-[14px] border border-white/10 bg-white/5 px-3 py-2">
      <span className="relative h-9 w-9 shrink-0">
        <Image
          src="/assets/images/silver.png"
          alt="Resource"
          fill
          sizes="36px"
          className="object-contain opacity-60"
        />
      </span>
      <span className="text-sm font-bold tabular-nums text-white/65">0</span>
    </span>
  );
}
