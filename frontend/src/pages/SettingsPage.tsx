import { useEffect, useState } from "react"
import { Loader2, ShieldCheck, ShieldOff, KeyRound } from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import { useDocumentTitle } from "@/lib/useDocumentTitle"
import { getTotpFactor, enrollTotp, confirmTotpEnrollment, disableTotp } from "@/lib/mfaApi"
import type { TotpFactor } from "@/lib/mfaApi"

type Step = "loading" | "off" | "enrolling" | "on" | "disabling"

export function SettingsPage() {
  useDocumentTitle("Settings")
  const { session, updateSession } = useAuth()
  const [step, setStep] = useState<Step>("loading")
  const [factor, setFactor] = useState<TotpFactor | null>(null)
  const [qrSvg, setQrSvg] = useState("")
  const [secret, setSecret] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) return
    getTotpFactor(session)
      .then((f) => {
        setFactor(f)
        setStep(f?.status === "verified" ? "on" : "off")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
  }, [session])

  async function handleStartEnroll() {
    if (!session) return
    setBusy(true)
    setError("")
    try {
      const { factorId, qrSvg: svg, secret: s } = await enrollTotp(session)
      setFactor({ id: factorId, status: "unverified" })
      setQrSvg(svg)
      setSecret(s)
      setCode("")
      setStep("enrolling")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start enrollment.")
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmEnroll() {
    if (!session || !factor || !code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const s = await confirmTotpEnrollment(session, factor.id, code.trim())
      updateSession(s)
      setFactor({ id: factor.id, status: "verified" })
      setStep("on")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code -- try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    if (!session || !factor || !code.trim()) {
      setError("Enter the 6-digit code from your authenticator app to confirm.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const s = await disableTotp(session, factor.id, code.trim())
      updateSession(s)
      setFactor(null)
      setCode("")
      setStep("off")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code -- try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Manage your account security.</p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Two-factor authentication</CardTitle>
            <CardDescription>
              Require a code from an authenticator app (Google Authenticator, Microsoft
              Authenticator, etc.) in addition to your password when signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "loading" && (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {step === "off" && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldOff className="size-4" />
                  Not enabled
                </div>
                <Button onClick={handleStartEnroll} disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Set up two-factor authentication
                </Button>
              </div>
            )}

            {step === "enrolling" && (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="rounded-md border bg-card p-3 [&_svg]:size-44"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <p className="text-center text-xs text-muted-foreground">
                  Scan with your authenticator app, or enter this key manually:
                </p>
                <code className="rounded bg-muted px-2 py-1 text-xs break-all select-all">{secret}</code>

                <div className="w-full max-w-xs">
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      autoFocus
                      className="pl-9 text-center tracking-widest"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("off")} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmEnroll} disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            {step === "on" && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Enabled
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCode("")
                    setError("")
                    setStep("disabling")
                  }}
                >
                  Disable
                </Button>
              </div>
            )}

            {step === "disabling" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Enter a current code from your authenticator app to confirm disabling
                  two-factor authentication.
                </p>
                <div className="relative max-w-xs">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoFocus
                    className="pl-9 tracking-widest"
                  />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("on")} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={handleDisable} disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Confirm disable
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
