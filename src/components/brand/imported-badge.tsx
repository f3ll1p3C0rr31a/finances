import { RefreshCw } from "lucide-react"

/** Marks an entry that was created automatically by the bank sync. */
export function ImportedBadge({ label = "Importado" }: { label?: string }) {
  return (
    <span
      title="Lançamento importado automaticamente do banco"
      className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-1.5 py-0.5 text-[0.65rem] font-medium text-sky-700 dark:text-sky-300"
    >
      <RefreshCw className="size-2.5" />
      {label}
    </span>
  )
}
