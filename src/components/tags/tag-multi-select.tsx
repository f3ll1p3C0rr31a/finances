"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createTag } from "@/lib/actions/tags"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type TagOption = { id: string; name: string }

export function TagMultiSelect({
  allTags,
  selectedIds,
  onChange,
}: {
  allTags: TagOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [tags, setTags] = useState(allTags)
  const [newTagName, setNewTagName] = useState("")
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
    )
  }

  function createNew() {
    const name = newTagName.trim()
    if (!name) return
    startTransition(async () => {
      try {
        const tag = await createTag(name)
        setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]))
        onChange(selectedIds.includes(tag.id) ? selectedIds : [...selectedIds, tag.id])
        setNewTagName("")
      } catch {
        toast.error("Não foi possível criar a etiqueta.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etiqueta ainda.</p>
        ) : (
          tags.map((tag) => (
            <Badge
              key={tag.id}
              variant={selectedIds.includes(tag.id) ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => toggle(tag.id)}
            >
              {tag.name}
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Nova etiqueta"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              createNew()
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={createNew} disabled={pending}>
          Criar
        </Button>
      </div>
    </div>
  )
}
