# Scriptorium — User Guide

Scriptorium is a desktop writing application for long-form fiction. It keeps your manuscript, research notes, lore, and world-building entities in one place and can export your work to Markdown, HTML, or professional DOCX formats.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Manuscript](#2-manuscript)
3. [Notes & Lore](#3-notes--lore)
4. [Entities](#4-entities)
5. [The Editor](#5-the-editor)
6. [Draft / Final Workflow](#6-draft--final-workflow)
7. [Exporting](#7-exporting)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)

---

## 1. Getting Started

### Creating a Project

Launch Scriptorium and choose **New Project**. Pick a folder on your machine — Scriptorium will store everything (manuscript files, notes, assets, and its database) inside that folder.

### Opening an Existing Project

Choose **Open Project** and navigate to the project folder. Scriptorium remembers the last open project and restores it automatically on next launch.

### Project Layout

```
my-novel/
  chapters/        manuscript .md files
  notes/           notes and lore .md files
  entities/        entity body .md files
  assets/          images used in the project
  exports/         generated export files
  project.db       SQLite database (metadata, word counts, relations)
  project.json     project name and settings
```

---

## 2. Manuscript

The **Manuscript** section in the left sidebar organises your story into Volumes, Chapters, and Scenes.

### Volumes

Volumes let you group chapters into books or parts of a series.

| Action | How |
|--------|-----|
| Create a volume | Click **+** at the top of the Manuscript section |
| Rename a volume | Hover the volume → click the pencil icon |
| Reorder volumes | Hover → click **↑** / **↓** |
| Delete a volume | Hover → click the trash icon (chapters become unassigned) |
| Collapse / expand | Click the chevron beside the volume name |

### Chapters

Chapters live inside a volume or in the **Unassigned** section at the bottom.

| Action | How |
|--------|-----|
| Create a chapter | Hover a volume → click **+** |
| Rename | Hover the chapter → pencil icon |
| Reorder | Hover → **↑** / **↓** |
| Delete | Hover → trash icon |
| Open in editor | Click the chapter title |

### Scenes

Scenes are sub-documents nested under a chapter.

| Action | How |
|--------|-----|
| Create a scene | Hover a chapter → click **+** |
| Rename | Hover the scene → pencil icon |
| Reorder | Hover → **↑** / **↓** |
| Delete | Hover → trash icon |
| Open in editor | Click the scene title |

### Status Indicators

Each chapter and scene row shows a small icon to its right:

- **Green checkmark** — the document is marked **Completed**
- **Amber pen** — the document is in **Draft** mode (not yet finalised)

No icon means the document is in Final mode but not yet marked complete.

---

## 3. Notes & Lore

The **Notes** section holds free-form research notes. The **Lore** section is for world-building entries (history, rules, cosmology, etc.). Both work identically and support folders for organisation.

### Creating Items

- Click **+** at the top of the Notes or Lore section to add a root-level item.
- To add inside a folder, hover the folder → click **+**.

### Folders

Folders help you group related notes.

| Action | How |
|--------|-----|
| Create a folder | Click the folder-plus icon in the section header |
| Create a subfolder | Hover a folder → folder-plus icon |
| Rename | Hover → pencil icon |
| Expand / collapse | Click the chevron |
| Move to another folder | Hover → move icon → pick destination in the picker |
| Delete | Hover → trash icon (folder must be empty) |

### Managing Notes / Lore Items

| Action | How |
|--------|-----|
| Rename | Hover → pencil icon |
| Move to a folder | Hover → move icon → pick destination |
| Reorder within parent | Hover → **↑** / **↓** |
| Delete | Hover → trash icon |
| Open in editor | Click the item title |

---

## 4. Entities

Entities are named elements in your world — characters, places, groups, and so on. Scriptorium tracks six types:

| Type | Colour |
|------|--------|
| Character | Blue |
| Location | Green |
| Event | Orange |
| Faction | Purple |
| Item | Yellow |
| Concept | Pink |

### Creating an Entity

Click **+** in the Entities section. Fill in:

- **Name** (required)
- **Type** — one of the six types above
- **Summary** — a short one-line description shown in lists
- **Tags** and **Aliases** — optional alternate names or labels

### Browsing Entities

Use the type filter buttons at the top of the Entities panel (**All**, **Character**, **Location**, …) to narrow the list. Each type appears as a collapsible section.

### Entity Inspector

Clicking an entity opens the **Inspector panel** on the right side of the screen. The inspector shows the entity's full details and its body (a free-form notes area you can write in).

### Folders for Entities

Each entity type supports folders, exactly like Notes:

- Create, rename, move, reorder, and delete folders per type.
- Folders only appear within their own type section.
- Deleting a non-empty folder is blocked until it is empty.

### Mentioning Entities in the Editor

Type `@` in the editor to open the mention picker. Start typing a name to filter. Selecting an entity inserts a **mention link** (`[[Entity Name]]`) styled inline. Clicking a mention in the editor opens that entity in the Inspector.

### Entity Relations

Entities can be linked to each other. From the inspector, use the **Relations** section to add connections (e.g. "Alice **is the sister of** Bob"). Relations are bidirectional and visible on both entity pages.

---

## 5. The Editor

Opening any manuscript chapter, scene, note, or lore item loads it in the central editor.

### Toolbar Overview

```
Undo  Redo  |  H1  H2  H3  |  Bold  Italic  Strike  |
List  Ordered  Quote  Rule  Line-break  Page-break  |
Insert-image  |  [Draft / Final]  [Completed ✓]  [Copy →]  [← Copy]
```

### Text Formatting

| Format | Toolbar | Keyboard |
|--------|---------|----------|
| Bold | **B** | Ctrl+B |
| Italic | *I* | Ctrl+I |
| Strikethrough | S̶ | — |
| Heading 1 | H1 | — |
| Heading 2 | H2 | — |
| Heading 3 | H3 | — |
| Bullet list | ☰ | — |
| Numbered list | 1. | — |
| Blockquote | " | — |

### Structural Inserts

| Insert | Toolbar button | What it does |
|--------|---------------|--------------|
| Horizontal Rule | `—` (Minus) | Inserts a `<hr>` divider — useful as a scene break |
| Line Break | `↵` (CornerDownLeft) | Inserts a `<br>` within the current paragraph |
| Page Break | `⊟` (SeparatorHorizontal) | Inserts a page break node — becomes a real Word page break in DOCX export |

Page breaks appear in the editor as a labelled grey bar reading **"Page Break"**. They are stripped from HTML exports and converted to `{{page-break}}` markers in Markdown exports.

### Images

Click **Insert image** (camera-plus icon) to open the asset picker. Assets are images you have added to your project's `assets/` folder. Select one and optionally set width/height before inserting.

You can also **drag and drop** an image file directly onto the editor surface.

### Auto-save

The editor saves automatically two seconds after you stop typing. The status bar shows **Saving…** while the save is in flight and the last-saved timestamp afterwards.

### Word Count

The word count for the current document is displayed in the status bar at the bottom right.

---

## 6. Draft / Final Workflow

Chapters and scenes have two parallel versions: a **Draft** and a **Final**. This lets you write freely in the draft without touching the clean final version you use for export.

### Modes

| Mode | Badge colour | When to use |
|------|-------------|-------------|
| Draft | Amber | Active writing and revision |
| Final | Green | Polished, export-ready text |

### Switching Modes

Use the **Draft / Final** segmented button in the toolbar. Scriptorium saves the current content before switching, then loads the other version.

The mode badge next to the document title also reflects the current mode.

### Marking as Completed

Check the **Completed** checkbox in the toolbar. Scriptorium will:

1. Save the current draft content.
2. Switch to **Final** mode automatically.
3. Mark the document complete (green checkmark in the sidebar).

Unchecking **Completed** switches back to Draft mode.

### Copying Between Draft and Final

| Button | Icon | What it does |
|--------|------|-------------|
| Copy Draft → Final | CopyCheck | Overwrites the final file with the current draft content |
| Copy Final → Draft | ClipboardCopy | Overwrites the draft file with the current final content |

Both actions ask for confirmation before overwriting.

### Export and Draft/Final

All export paths (**Markdown, HTML, DOCX**) always read from the **Final** file, regardless of which mode is active in the editor. This ensures exported content is always the polished version.

---

## 7. Exporting

Open the **Export** dialog from the top menu or sidebar.

### DOCX Export

DOCX export produces a Microsoft Word–compatible `.docx` file.

**Profiles**

| Profile | Paper | Spacing | Font |
|---------|-------|---------|------|
| Draft | A4 | 1.5× | Calibri 11 |
| Editor Review | A4 | Double | Calibri 12 + metadata page |
| Manuscript | Letter | Double | Times New Roman 12 |

**Options**

- **Scope** — Full project, a single volume, or selected documents.
- **Include title page** — prepends a title/author page.
- **Chapter numbering** — auto-numbers chapters (Chapter 1, Chapter 2 …) replacing any existing heading.

**Page breaks** inserted in the editor become real Word page breaks in the output.

**Images** are embedded from your project's `assets/` folder using the stored file paths.

### Markdown & HTML Export

**Scope options**

- Full project
- Single volume (select from dropdown)
- Specific document IDs

**Content options**

| Option | Effect |
|--------|--------|
| Include title | Keeps chapter `<h1>` / `# ` headings |
| Chapter numbering | Replaces chapter headings with "Chapter N" |
| Language | Export a translation instead of the original |
| Fallback to original | Include untranslated sections as original-language text |

**Output**

- HTML: a self-contained `.html` file with embedded styles (readable in any browser).
- Markdown: a `.md` file with chapters separated by `---` dividers.

Both formats strip page-break nodes and `@mention` syntax from the output.

### Translation Export

If you have configured translations, the Language dropdown will show available locales. Choosing one exports the translated text. The **Fallback to original** option includes chapters that have not been translated yet, marked with an italic note.

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Save (also auto-saves) |
| `@` in editor | Open entity mention picker |

---

## Tips

- **Folders are for organisation only.** Moving a note into a folder does not change how it exports or appears in the editor.
- **Reordering is local.** The up/down arrows move an item one step among its siblings; drag-and-drop is not yet supported.
- **Empty folders can be deleted.** Folders with items inside are protected — move or delete the contents first.
- **The Inspector stays open.** Once the inspector panel is open it stays visible until you close it, letting you reference an entity while writing.
- **Mentions are searchable.** Every `@mention` you insert is indexed. The entity inspector shows which documents reference that entity.
- **Draft mode protects your final text.** Work in Draft freely; only copy to Final when you're happy with a passage.
