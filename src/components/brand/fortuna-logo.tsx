import { cn } from "@/lib/utils"

/**
 * Fortuna, the Roman goddess of luck: the mark is an old gold coin —
 * beaded rim, embossed laurel wreath and a serif F — over the app's
 * emerald/violet halo.
 */
export function FortunaLogo({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-10 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-violet-500 to-fuchsia-500 p-[3px] shadow-lg shadow-violet-500/25">
        <svg
          aria-hidden="true"
          className="size-full drop-shadow-sm"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="fortuna-coin-face" cx="38%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#f8e08e" />
              <stop offset="45%" stopColor="#e3b94d" />
              <stop offset="80%" stopColor="#c2932e" />
              <stop offset="100%" stopColor="#9a7020" />
            </radialGradient>
            <linearGradient id="fortuna-coin-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8a6318" />
              <stop offset="50%" stopColor="#d9b355" />
              <stop offset="100%" stopColor="#7a5512" />
            </linearGradient>
          </defs>

          {/* coin body */}
          <circle cx="32" cy="32" r="30" fill="url(#fortuna-coin-edge)" />
          <circle cx="32" cy="32" r="27.5" fill="url(#fortuna-coin-face)" />

          {/* beaded rim, like a denarius */}
          <g fill="#8a6318" opacity="0.85">
            {Array.from({ length: 24 }, (_, i) => {
              const angle = (i * Math.PI * 2) / 24
              return (
                <circle
                  key={i}
                  cx={32 + Math.cos(angle) * 24.5}
                  cy={32 + Math.sin(angle) * 24.5}
                  r="1.4"
                />
              )
            })}
          </g>

          {/* laurel wreath */}
          <g stroke="#7a5512" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9">
            <path d="M15 40c-1.5-8 1-16 7-21" />
            <path d="M49 40c1.5-8-1-16-7-21" />
          </g>
          <g fill="#7a5512" opacity="0.85">
            <path d="M14.6 36.8c2.4-.3 4.3.7 5 2.6-2.3.6-4.3-.3-5-2.6Z" />
            <path d="M14.9 31.4c2.3-.6 4.3.1 5.4 1.9-2.2.9-4.4.2-5.4-1.9Z" />
            <path d="M16.5 26.2c2.3-.9 4.4-.5 5.7 1.1-2 1.2-4.3.8-5.7-1.1Z" />
            <path d="M19.6 21.6c2-1.3 4.2-1.3 5.8 0-1.7 1.6-4 1.6-5.8 0Z" />
            <path d="M49.4 36.8c-2.4-.3-4.3.7-5 2.6 2.3.6 4.3-.3 5-2.6Z" />
            <path d="M49.1 31.4c-2.3-.6-4.3.1-5.4 1.9 2.2.9 4.4.2 5.4-1.9Z" />
            <path d="M47.5 26.2c-2.3-.9-4.4-.5-5.7 1.1 2 1.2 4.3.8 5.7-1.1Z" />
            <path d="M44.4 21.6c-2-1.3-4.2-1.3-5.8 0 1.7 1.6 4 1.6 5.8 0Z" />
          </g>

          {/* embossed serif F */}
          <g>
            <path
              d="M27 20.5h13.5a1 1 0 0 1 1 1V25a1 1 0 0 1-1 1H31v6h7a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1h-7v8.1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-24a1 1 0 0 1 1-1Z"
              fill="#fdf3cf"
              opacity="0.55"
              transform="translate(-0.7 -0.7)"
            />
            <path
              d="M27 20.5h13.5a1 1 0 0 1 1 1V25a1 1 0 0 1-1 1H31v6h7a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1h-7v8.1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-24a1 1 0 0 1 1-1Z"
              fill="#7a5512"
            />
          </g>

          {/* glint */}
          <path
            d="M18 13c4-3.5 9-5 14-4.6"
            stroke="#fff6d8"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-lime-300 shadow-sm shadow-lime-300/70 ring-2 ring-background" />
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
