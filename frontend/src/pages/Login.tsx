import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Navigate, useLocation } from "react-router-dom"
import {
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useDocumentTitle } from "@/lib/useDocumentTitle"
import loginOffice from "@/assets/login-office.jpg"

const QUOTES = [
  {
    bn: "তোমরা আমাকে রক্ত দাও, আমি তোমাদের স্বাধীনতা দেব।",
    author: "নেতাজী সুভাষ চন্দ্র বসু",
  },
  {
    bn: "স্বাধীনতা কেউ ভিক্ষা দেয় না, স্বাধীনতা ছিনিয়ে নিতে হয়।",
    author: "নেতাজী সুভাষ চন্দ্র বসু",
  },
  {
    bn: "একটি আদর্শের জন্য মানুষ মরে যেতে পারে, কিন্তু সেই আদর্শ তার মৃত্যুর পরও হাজারো প্রাণে বেঁচে থাকে।",
    author: "নেতাজী সুভাষ চন্দ্র বসু",
  },
  {
    bn: "ওঠো, জাগো, লক্ষ্যে না পৌঁছানো পর্যন্ত থেমো না।",
    author: "স্বামী বিবেকানন্দ",
  },
]

const TYPE_SPEED_MS = 35
const HOLD_AFTER_TYPE_MS = 2800

export function Login() {
  useDocumentTitle("Sign In")
  const { session, signIn, completeMfaSignIn } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // Set only when signIn() reports the account has TOTP enabled -- switches
  // the form below to a code-entry step instead of completing login.
  const [mfa, setMfa] = useState<{ factorId: string; pendingAccessToken: string } | null>(null)
  const [code, setCode] = useState("")
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [typedText, setTypedText] = useState("")

  // Types out the current quote one character at a time, holds it on
  // screen once fully typed, then advances to the next one.
  useEffect(() => {
    const full = QUOTES[quoteIndex].bn
    setTypedText("")
    let i = 0
    const typeId = setInterval(() => {
      i++
      setTypedText(full.slice(0, i))
      if (i >= full.length) clearInterval(typeId)
    }, TYPE_SPEED_MS)

    const advanceId = setTimeout(
      () => setQuoteIndex((idx) => (idx + 1) % QUOTES.length),
      full.length * TYPE_SPEED_MS + HOLD_AFTER_TYPE_MS
    )

    return () => {
      clearInterval(typeId)
      clearTimeout(advanceId)
    }
  }, [quoteIndex])

  // No specific page requested (e.g. a fresh login, not bounced here from a
  // protected route) -- land on "/", which picks the first page this user
  // actually has access to instead of assuming Search.
  const from = (location.state as { from?: string } | null)?.from ?? "/"
  if (session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError("Enter your username and password.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await signIn(username, password, remember)
      if (result.mfaRequired) {
        setMfa({ factorId: result.factorId, pendingAccessToken: result.pendingAccessToken })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyMfa(e: FormEvent) {
    e.preventDefault()
    if (!mfa || !code.trim()) {
      setError("Enter the code from your authenticator app.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await completeMfaSignIn(mfa.pendingAccessToken, mfa.factorId, code.trim(), remember)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code -- try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="min-h-svh w-full lg:grid lg:grid-cols-[3fr_2fr]">
        {/* Desktop only -- mobile keeps a plain single-column form below. */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col">
          <img
            src={loginOffice}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/50" />

          <div className="relative p-10 2xl:p-14">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-orange-600 shadow-sm 2xl:size-11">
                <Database className="size-5 text-white 2xl:size-6" strokeWidth={2.25} />
              </span>
              <span className="text-2xl font-semibold tracking-tight text-white 2xl:text-3xl">
                DataHub
              </span>
              <span className="h-8 w-px bg-white/30" />
              <div className="flex flex-col justify-center">
                <span className="text-xs leading-tight font-medium text-white">পান্ডবেশ্বর</span>
                <span className="text-xs leading-tight font-medium text-white">বিধানসভা</span>
              </div>
            </div>

            <p className="mt-4 text-xl leading-snug font-medium text-white 2xl:text-2xl">
              মানুষের সাথে, মানুষের পাশে
            </p>
          </div>

          {/* Fixed height + full-bleed width so it doesn't grow/shrink with
              quote length or float as a card -- centered in the remaining
              space rather than pinned to the bottom edge. */}
          <div className="flex flex-1 items-center">
            <div className="relative flex h-52 w-full shrink-0 items-center bg-black/20 px-10 backdrop-blur-sm 2xl:h-60 2xl:px-14">
              <div className="w-full max-w-xl">
                <p className="min-h-20 text-2xl leading-snug font-light text-balance text-white 2xl:text-3xl">
                  &ldquo;{typedText}
                  <span className="animate-pulse">|</span>
                  &rdquo;
                </p>
                <p className="mt-3 text-sm font-medium text-white/80 2xl:text-base">
                  &mdash; {QUOTES[quoteIndex].author}
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex gap-1.5 p-10 2xl:p-14">
            {QUOTES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-500",
                  i === quoteIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
        </div>

        <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
          <div
            className="pointer-events-none absolute top-0 right-0 size-56 opacity-40"
            style={{
              backgroundImage: "radial-gradient(var(--border) 1.5px, transparent 1.5px)",
              backgroundSize: "16px 16px",
              maskImage: "radial-gradient(circle at top right, black, transparent 70%)",
            }}
          />

          <div className="relative w-full max-w-sm 2xl:max-w-md">
          <span className="text-sm font-semibold text-brand">Welcome back 👋</span>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {mfa ? (
              <>Two-factor code</>
            ) : (
              <>
                Sign in to <span className="text-brand">DataHub</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mfa
              ? "Enter the 6-digit code from your authenticator app."
              : "Internal tool for Pandabeswar office staff -- sign in with the username and password issued by your administrator."}
          </p>

          <div className="my-6 border-t" />

          {mfa ? (
            <form
              onSubmit={handleVerifyMfa}
              className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Authenticator code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="pl-9 tracking-widest"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                Verify &amp; sign in
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMfa(null)
                  setCode("")
                  setError("")
                }}
                className="cursor-pointer text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-9 pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
              <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
              Remember me
            </label>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Sign in
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <div
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground"
              )}
            >
              <ShieldCheck className="size-4 shrink-0" />
              <span>
                Need an account? <span className="text-foreground">Ask your office administrator.</span>
              </span>
            </div>
          </form>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" />
            Secure &bull; Reliable &bull; Citizen Focused
          </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} DataHub. All rights reserved.
              {import.meta.env.VITE_APP_VERSION && ` · ${import.meta.env.VITE_APP_VERSION}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
