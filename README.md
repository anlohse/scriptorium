# Scriptorium

A desktop-first writing platform for long-form fiction. Built with Electron, React, and SQLite — your project lives as plain files on disk, never locked in a cloud service.

---

## Features

### Writing

- **Rich text editor** powered by Tiptap — bold, italic, strikethrough, headings (H1–H3), blockquotes, ordered and unordered lists, horizontal rules, and images
- **Manuscript tree** — organise chapters into volumes, with nested scenes; drag handles are replaced by up/down reorder buttons directly in the sidebar
- **Notes and Lore** — separate document types for research notes and world-building lore, independently reorderable
- **Autosave** — every document is saved automatically 2 seconds after the last keystroke; a dot in the titlebar indicates unsaved changes
- **Word count** — live word count per document and per editor session

### World Building

- **Entity system** — six entity types: Character, Location, Event, Faction, Item, Concept
- **Inline mentions** — type `@` anywhere in the editor to mention an entity; mentions are tracked across the whole project
- **Entity inspector** — three-tab panel: rendered Markdown view, editable Markdown with `[[EntityName]]` wikilinks, and a Metadata panel showing aliases, relations, and everywhere the entity appears in the manuscript
- **Pinned entities** — pin an entity to keep its inspector open while you write

### Assets

- **Image library** — import character art, maps, concept art, covers, moodboards, or other images into the project
- **Insert from assets** — toolbar button to pick an image from the library and insert it in the editor with optional width, height, and alt text

### Translation

- **Multi-language projects** — configure any number of locale codes (en-US, pt-BR, ja-JP, etc.) per project
- **Side-by-side editor** — translate any chapter or note with the original on the left and a Markdown editor on the right; both panes scroll in sync
- **Translation status** — track each translation as Untranslated, Draft, In Progress, Completed, or Outdated
- **Coverage dashboard** — per-language progress bar in the sidebar; outdated translations are flagged automatically when the source document changes

### Export

- **HTML and Markdown** — export the full project, a single volume, or individual chapters
- **Translation export** — choose which language to export; optionally fall back to the original for untranslated sections
- **Chapter numbering** — auto-numbered chapter headings on or off
- **Include/exclude titles** — document titles can be included or stripped

### Project Management

- **Metadata file** — every project has a `<folder-name>.json` metadata file that identifies it, stores the schema version, creation date, app version, and language settings; Git-friendly and human-readable
- **Schema migrations** — database migrations run automatically on open; projects created with an older version are upgraded transparently; projects from a newer version are blocked with a clear message
- **Resizable panels** — sidebar and inspector widths are draggable and remembered between sessions

### Search

- **Full-text search** — searches across all documents and entities using SQLite FTS5; open with `Ctrl+F`

---

## Technology

| Layer | Choice |
|-------|--------|
| Shell | Electron 35 |
| Build | electron-vite + Vite 6 |
| Packaging | electron-builder |
| UI | React 18 + Tailwind CSS 3 |
| Editor | Tiptap 2 (ProseMirror) |
| Database | better-sqlite3 (SQLite, WAL mode) |
| State | Zustand |
| Icons | Lucide React |
| Markdown | marked |

---

## Project Structure

```
<project-folder>/
  <project-name>.json   # project metadata and schema version
  novel.db              # SQLite database (documents, entities, assets, …)
  manuscript/           # chapter and scene files (.md)
    <volume-slug>/
      <chapter-slug>.md
  notes/                # notes and lore files (.md)
  entities/             # entity body files (.md)
  assets/               # imported images
    characters/
    locations/
    items/
    covers/
  translations/         # translation files
    <locale>/
      manuscript/…
  exports/              # generated export files
```

Document content is stored as HTML in `.md` files; entity bodies and translations are plain Markdown. Everything is version-control-friendly.

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm 10 or later

### Install

```bash
git clone https://github.com/alanlohse/scriptorium
cd scriptorium
npm install
```

### Development

```bash
npm run dev
```

Starts the Electron app with hot-reload for the renderer process.

### Build

```bash
npm run build
```

Compiles TypeScript and bundles the renderer with Vite. Output goes to `out/`.

### Package

```bash
# Windows installer (NSIS)
npm run build:win

# Linux AppImage
npm run build:linux
```

Packaged artifacts land in `dist/`.

---

## Releases

The GitHub Actions workflow at `.github/workflows/release.yml` builds and publishes releases automatically.

**Tag-triggered:**

```bash
# Ensure package.json version matches the tag
npm version 1.0.0
git push --follow-tags
```

The workflow builds Windows (NSIS `.exe`) and Linux (`.AppImage`) installers in parallel and attaches them to a GitHub Release. A version string containing `-` (e.g. `v1.0.0-beta.1`) is marked as a pre-release automatically.

**Manual trigger:** the workflow can also be dispatched manually from the Actions tab with an optional version override.

---

## Database Schema Versioning

The current schema version is **1**. When a project is opened:

1. The `<project-name>.json` metadata file is read and `databaseSchemaVersion` is compared against the app's `CURRENT_SCHEMA_VERSION`.
2. If the project is older, all pending migrations run sequentially inside transactions; the metadata is updated only after every migration succeeds.
3. If the project was created with a newer version of the app, it is refused with an error.

To add a future migration, append a new entry to the `migrations` array in `src/main/db/migrations.ts`:

```ts
{
  version: 2,
  name: 'add_bookmarks_table',
  up: (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS bookmarks (...)`)
  }
}
```

Increment `CURRENT_SCHEMA_VERSION` in the same file.

---

## License

MIT
