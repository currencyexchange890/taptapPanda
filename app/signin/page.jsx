"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  HiOutlineLockClosed,
  HiOutlineUser,
  HiOutlineEye,
  HiOutlineEyeOff,
} from "react-icons/hi"

export default function SignInPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: index + 1,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.35}s`,
        duration: `${0.9 + Math.random() * 0.7}s`,
        rotate: `${Math.random() * 360}deg`,
      })),
    []
  )

  const onSubmit = async (e) => {
    e.preventDefault()

    if (loading) return

    const cleanUsername = username.trim()
    const cleanPassword = password.trim()

    if (!cleanUsername || !cleanPassword) {
      toast.error("Please enter username and password.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data?.message || "Login failed.")
        setLoading(false)
        return
      }

      setShowConfetti(true)
      toast.success(data?.message || "Login successful.")

      setTimeout(() => {
        router.push("/taptappanda")
      }, 1000)
    } catch {
      toast.error("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F0710] px-6 text-white">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 1600,
          style: {
            background: "rgba(16,8,18,.96)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,.10)",
          },
        }}
      />

      <style jsx global>{`
        @keyframes confettiDrop {
          0% {
            transform: translate3d(0, -120px, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 110vh, 0) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>

      <div className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(520px_320px_at_50%_0%,rgba(244,63,94,.65),transparent_62%),radial-gradient(520px_320px_at_0%_85%,rgba(139,92,246,.55),transparent_62%)]" />

      {showConfetti ? (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="absolute top-0 inline-block h-3 w-2 rounded-sm bg-[#f43f5e] odd:bg-[#facc15] even:bg-[#60a5fa]"
              style={{
                left: piece.left,
                animation: `confettiDrop ${piece.duration} linear ${piece.delay} forwards`,
                transform: `rotate(${piece.rotate})`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative z-20 w-full max-w-sm rounded-[28px] border border-white/10 bg-[#160A17]/85 p-7 shadow-[0_30px_90px_rgba(0,0,0,.65)] backdrop-blur-xl">
        <div className="text-3xl font-semibold tracking-tight">
          Panda <span className="text-[#f43f5e]">Login</span>
        </div>

        <p className="mt-2 text-sm text-white/55">
          Sign in with the username and password you received after purchasing an
          account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0F0710]/70 px-4 shadow-[0_0_0_1px_rgba(244,63,94,.0)] transition focus-within:shadow-[0_0_0_1px_rgba(244,63,94,.30)]">
            <HiOutlineUser className="text-lg text-white/45" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-white/35"
              placeholder="Username"
              type="text"
              autoComplete="username"
            />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0F0710]/70 px-4 shadow-[0_0_0_1px_rgba(139,92,246,.0)] transition focus-within:shadow-[0_0_0_1px_rgba(139,92,246,.30)]">
            <HiOutlineLockClosed className="text-lg text-white/45" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-white/35"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="grid h-9 w-9 place-items-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white"
            >
              {showPassword ? (
                <HiOutlineEyeOff className="text-lg" />
              ) : (
                <HiOutlineEye className="text-lg" />
              )}
            </button>
          </div>

          <button
            disabled={loading}
            className={[
              "h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#f43f5e,#8b5cf6)] font-semibold text-black shadow-[0_18px_45px_rgba(244,63,94,.20)] transition",
              loading
                ? "cursor-not-allowed opacity-70"
                : "active:brightness-95 hover:brightness-110",
            ].join(" ")}
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  )
}