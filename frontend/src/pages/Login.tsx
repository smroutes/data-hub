import { useState } from "react"
import type { FormEvent } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2, LogIn, ShieldCheck } from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function Login() {
  const { session, signIn } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? "/search"
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
      await signIn(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-xl">
            DataHub
            <span className="h-8 w-px bg-border" />
            <span className="flex flex-col justify-center">
              <span className="text-xs leading-tight font-medium">পান্ডবেশ্বর</span>
              <span className="text-xs leading-tight font-medium">বিধানসভা</span>
            </span>
          </CardTitle>
          <CardDescription>Sign in with your office username and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              autoFocus
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Sign in
            </Button>
          </form>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" />
            Need an account? Ask your office administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
