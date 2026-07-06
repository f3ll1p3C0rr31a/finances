import { cn } from "@/lib/utils"

export function FortunaLogo({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 ring-1 ring-white/40">
        <svg
          aria-hidden="true"
          className="size-7"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="4" />
          <circle cx="32" cy="32" r="4" fill="currentColor" />
          <path d="M32 12v40M12 32h40M18 18l28 28M46 18 18 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M40 15c9 5 13 14 10 24"
            stroke="rgb(190 242 100)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M43 11c-3 5-1 10 4 13"
            stroke="rgb(190 242 100)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -right-1 -top-1 size-3 rounded-full bg-lime-300 shadow-sm shadow-lime-300/70" />
      </span>
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-black tracking-tight text-foreground">Fortuna</span>
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            finanças
          </span>
        </span>
      ) : null}
    </span>
  )
}
