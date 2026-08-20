import { useState } from "react"
import type { FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { Loader2, LogIn } from "lucide-react"
import { useCitizensAuth } from "@/lib/CitizensAuthContext"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function CitizensLogin() {
  const { session, signIn } = useCitizensAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/citizens" replace />

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
          <CardTitle className="text-xl">Citizen Records</CardTitle>
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
          <p className="mt-4 text-center text-xs text-muted-foreground">
            No public sign-up -- accounts are created by an administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
