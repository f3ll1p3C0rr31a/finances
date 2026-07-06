"use client"

import { useActionState } from "react"

import { login } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FortunaLogo } from "@/components/brand/fortuna-logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined)

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm border-violet-500/20 bg-card/90 shadow-2xl shadow-violet-500/10">
        <CardHeader>
          <FortunaLogo />
          <CardTitle className="pt-3">Sua sorte, mas com planilha.</CardTitle>
          <CardDescription>Entre para planejar entradas, saídas e cartões.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Usuário</Label>
              <Input id="email" name="email" autoComplete="username" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
