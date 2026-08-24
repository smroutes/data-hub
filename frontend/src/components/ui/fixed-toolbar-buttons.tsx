"use client"

import { BaselineIcon, BoldIcon, Code2Icon, HighlighterIcon, ItalicIcon, PaintBucketIcon, StrikethroughIcon, UnderlineIcon } from "lucide-react"
import { KEYS } from "platejs"

import { AlignToolbarButton } from "@/components/ui/align-toolbar-button"
import { EmojiToolbarButton } from "@/components/ui/emoji-toolbar-button"
import { FontColorToolbarButton } from "@/components/ui/font-color-toolbar-button"
import { FontSizeToolbarButton } from "@/components/ui/font-size-toolbar-button"
import { RedoToolbarButton, UndoToolbarButton } from "@/components/ui/history-toolbar-button"
import { IndentToolbarButton, OutdentToolbarButton } from "@/components/ui/indent-toolbar-button"
import { InsertToolbarButton } from "@/components/ui/insert-toolbar-button"
import { LineHeightToolbarButton } from "@/components/ui/line-height-toolbar-button"
import { LinkToolbarButton } from "@/components/ui/link-toolbar-button"
import { BulletedListToolbarButton, NumberedListToolbarButton, TodoListToolbarButton } from "@/components/ui/list-toolbar-button"
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button"
import { TableToolbarButton } from "@/components/ui/table-toolbar-button"
import { ToolbarGroup } from "@/components/ui/toolbar"
import { TurnIntoToolbarButton } from "@/components/ui/turn-into-toolbar-button"

// Trimmed from Plate's generated version -- deliberately excludes the AI
// wand (needs its own streaming backend route we don't have), export/
// import (docx/pdf -- we already have lighter Copy/Download buttons above
// the canvas), media upload (needs file storage credentials), and
// comments/mode-toggle (no collaboration backend, and theme is already
// handled by the rest of the app). Everything kept here is pure
// client-side, matching only the block/mark types actually registered on
// this editor (see plugins/*-kit.tsx).
export function FixedToolbarButtons() {
  return (
    <div className="flex w-full flex-wrap">
      <ToolbarGroup>
        <UndoToolbarButton />
        <RedoToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <InsertToolbarButton />
        <TurnIntoToolbarButton />
        <FontSizeToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
          <BoldIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
          <ItalicIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline (⌘+U)">
          <UnderlineIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough (⌘+⇧+M)">
          <StrikethroughIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
          <Code2Icon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <HighlighterIcon />
        </MarkToolbarButton>
        <FontColorToolbarButton nodeType={KEYS.color} tooltip="Text color">
          <BaselineIcon />
        </FontColorToolbarButton>
        <FontColorToolbarButton nodeType={KEYS.backgroundColor} tooltip="Background color">
          <PaintBucketIcon />
        </FontColorToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <AlignToolbarButton />
        <NumberedListToolbarButton />
        <BulletedListToolbarButton />
        <TodoListToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <LinkToolbarButton />
        <TableToolbarButton />
        <EmojiToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <LineHeightToolbarButton />
        <OutdentToolbarButton />
        <IndentToolbarButton />
      </ToolbarGroup>
    </div>
  )
}
