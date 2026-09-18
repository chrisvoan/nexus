"use client"

import Link from "next/link"
import { useActionState } from "react"

import { login, register, type AuthState } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AuthFormProps = {
  mode: "login" | "register"
  configured: boolean
}

const copy = {
  login: {
    title: "Welcome back",
    description: "Sign in to your Nexus workspace.",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "Don't have an account?",
    switchLabel: "Create one",
    switchHref: "/register",
  },
  register: {
    title: "Create your account",
    description: "Join your company's Nexus workspace.",
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
}

export function AuthForm({ mode, configured }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : register,
    undefined
  )
  const text = copy[mode]

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          {!configured && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Supabase isn&apos;t configured yet. Add your keys to{" "}
              <code className="font-mono">.env.local</code> and restart the dev
              server.
            </p>
          )}
          {mode === "register" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                name="displayName"
                autoComplete="name"
                placeholder="Ada Lovelace"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? 8 : undefined}
              required
            />
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state?.message && (
            <p role="status" className="text-sm text-muted-foreground">
              {state.message}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={pending || !configured}
          >
            {pending ? text.pending : text.submit}
          </Button>
          <p className="text-sm text-muted-foreground">
            {text.switchText}{" "}
            <Link
              href={text.switchHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {text.switchLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
