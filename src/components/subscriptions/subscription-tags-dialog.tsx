"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setSubscriptionTags } from "@/lib/actions/tags"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function SubscriptionTagsDialog({
  subscriptionId,
  currentTagIds,
  allTags,
}: {
  subscriptionId: string
  currentTagIds: string[]
  allTags: TagOption[]
}) {
  const [open, setOpen] = useState(false)
  const [tagIds, setTagIds] = useState(currentTagIds)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await setSubscriptionTags(subscriptionId, tagIds)
        toast.success("Etiquetas atualizadas.")
        setOpen(false)
      } catch {
        toast.error("Não foi possível atualizar as etiquetas.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>Etiquetas</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etiquetas da assinatura</DialogTitle>
        </DialogHeader>
        <TagMultiSelect allTags={allTags} selectedIds={tagIds} onChange={setTagIds} />
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
