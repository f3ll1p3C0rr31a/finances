import { cn } from "@/lib/utils"

/**
 * Simplified Pix logomark (the arrow-diamond knot), inheriting
 * currentColor unless a className sets it. Rendered inline next to
 * anything Pix-related.
 */
export function PixIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block size-4 shrink-0 text-[#32BCAD]", className)}
      role="img"
      aria-label="Pix"
    >
      <path
        d="M17.63 17.35a3.06 3.06 0 0 1-2.18-.9l-2.62-2.62a.6.6 0 0 0-.83 0l-2.64 2.63a3.06 3.06 0 0 1-2.18.9h-.51l3.32 3.32a2.66 2.66 0 0 0 3.76 0l3.33-3.33h-.45ZM7.18 6.62c.82 0 1.6.32 2.18.9l2.64 2.64a.59.59 0 0 0 .83 0l2.62-2.63a3.06 3.06 0 0 1 2.18-.9h.45L14.75 3.3a2.66 2.66 0 0 0-3.76 0L7.67 6.62h-.5Z"
        fill="currentColor"
      />
      <path
        d="m20.68 10.1-2.01-2.01h-1.04c-.57 0-1.12.23-1.52.63l-2.62 2.62c-.3.3-.7.45-1.09.45-.4 0-.79-.15-1.09-.45L8.67 8.7c-.4-.4-.95-.63-1.52-.63H5.9L3.9 10.1a2.66 2.66 0 0 0 0 3.76l2 2.01h1.25c.57 0 1.12-.23 1.52-.63l2.64-2.64c.6-.6 1.58-.6 2.18 0l2.62 2.62c.4.4.95.63 1.52.63h1.04l2.01-2a2.66 2.66 0 0 0 0-3.75Z"
        fill="currentColor"
      />
    </svg>
  )
}
