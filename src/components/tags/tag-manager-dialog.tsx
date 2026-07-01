"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteTag } from "@/lib/actions/tags"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function TagManagerDialog({ tags }: { tags: TagOption[] }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(tags)
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteTag(id)
        setItems((prev) => prev.filter((t) => t.id !== id))
        toast.success("Etiqueta removida.")
      } catch {
        toast.error("Não foi possível remover a etiqueta.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Gerenciar etiquetas
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etiquetas</DialogTitle>
          <DialogDescription>Remova etiquetas que não usa mais.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
          ) : (
            items.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="gap-1.5">
                {tag.name}
                <button
                  type="button"
                  aria-label={`Remover ${tag.name}`}
                  disabled={pending}
                  onClick={() => remove(tag.id)}
                  className="cursor-pointer opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </Badge>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
