import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { logout } from "@/lib/actions/auth"
import { Button, buttonVariants } from "@/components/ui/button"
import { FortunaLogo } from "@/components/brand/fortuna-logo"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cards", label: "Cartões" },
  { href: "/assinaturas", label: "Assinaturas" },
  { href: "/informacoes", label: "Informações" },
]

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-violet-950/10 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="shrink-0">
              <FortunaLogo />
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(buttonVariants({ variant: "ghost" }))}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={logout}>
            <Button variant="outline" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  )
}
