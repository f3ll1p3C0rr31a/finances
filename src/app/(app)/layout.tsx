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
        {/* Em 360px o cabeçalho inteiro não cabe. Em vez de deixar a página
            rolar de lado — que desalinha tudo —, a marca perde o nome, o menu
            rola sozinho na horizontal e só o Sair fica fixo à direita. */}
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
          <Link href="/dashboard" className="shrink-0">
            <FortunaLogo showWordmark={false} className="sm:hidden" />
            <FortunaLogo className="hidden sm:inline-flex" />
          </Link>
          <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(buttonVariants({ variant: "ghost" }), "shrink-0")}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="shrink-0">
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
