# Folder Structure Specification — Notes, Lore, and Entities

## 1. Goal

Add folder and subfolder organization for:

* Notes
* Lore documents
* Entities
* Characters
* Locations
* Events
* Factions
* Items
* Concepts

The goal is to reduce visual clutter as projects grow.

This feature should be simple to implement and should not introduce a complex folder system.

---

# 2. Core Idea

Use the existing data model with a simple parent relationship.

A folder is represented as a lightweight record with:

* `id`
* `title`
* `type`
* `parent_id`
* `is_folder`

If `parent_id` is `null`, the item is shown at the root level.

---

# 3. Documents / Notes / Lore

## 3.1 documents Table Update

Add:

```sql
ALTER TABLE documents ADD COLUMN parent_id TEXT;
ALTER TABLE documents ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0;
```

Recommended index:

```sql
CREATE INDEX idx_documents_parent_id
ON documents(parent_id);
```

---

## 3.2 Document Folder Behavior

A document folder:

```text
is_folder = 1
type = "folder"
```

A regular document:

```text
is_folder = 0
type = "note" | "lore" | "chapter" | "scene"
```

For MVP, folders should be allowed mainly for:

```text
notes
lore
```

Chapters may remain organized by volumes.

---

# 4. Entities

## 4.1 entities Table Update

Add:

```sql
ALTER TABLE entities ADD COLUMN parent_id TEXT;
ALTER TABLE entities ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0;
```

Recommended index:

```sql
CREATE INDEX idx_entities_parent_id
ON entities(parent_id);
```

---

## 4.2 Entity Folder Behavior

An entity folder is an entity-like record used only for organization.

Example:

```text
id: folder-main-cast
title/name: Main Cast
type: character
is_folder: 1
parent_id: null
```

A regular entity inside it:

```text
id: entity-luna
name: Luna
type: character
is_folder: 0
parent_id: folder-main-cast
```

This allows folders per entity type.

Example:

```text
Characters
 ├── Main Cast
 │    ├── Luna
 │    └── Kael
 ├── Villains
 │    └── Arcturus
 └── Supporting Cast
```

---

# 5. Root Behavior

If `parent_id` is `null`, the item appears at root.

Example:

```text
Characters
 ├── Luna
 ├── Main Cast/
 └── Villains/
```

---

# 6. Nesting

Folders may contain:

* folders
* documents
* entities of the same section/type

MVP recommended limit:

```text
Maximum nesting depth: 5
```

This prevents confusing deeply nested trees.

---

# 7. UI Requirements

## 7.1 Notes/Lore Tree

The Notes and Lore section should display a tree view.

Example:

```text
Notes
 ├── Magic System
 │    ├── Mana.md
 │    └── Curses.md
 ├── Kingdoms
 │    ├── North Empire.md
 │    └── South Isles.md
 └── Random Ideas.md
```

---

## 7.2 Entity Tree

Entity sections should display folders.

Example:

```text
Entities
 ├── Characters
 │    ├── Main Cast
 │    │    ├── Luna
 │    │    └── Kael
 │    ├── Villains
 │    │    └── Arcturus
 │    └── Supporting Cast
 ├── Locations
 │    ├── Kingdoms
 │    └── Dungeons
 └── Items
      ├── Weapons
      └── Relics
```

---

# 8. Folder Actions

The UI must support:

```text
Create folder
Rename folder
Delete empty folder
Move item to folder
Move folder to folder
Move item to root
```

---

## 8.1 Delete Rules

For MVP:

```text
Only empty folders can be deleted.
```

If folder is not empty:

```text
This folder contains items. Move or delete them before deleting the folder.
```

This avoids accidental mass deletion.

---

## 8.2 Move Rules

When moving folders:

* prevent moving a folder into itself;
* prevent moving a folder into its own descendant;
* prevent invalid cross-section moves if type does not match.

Example:

```text
A Character folder cannot be moved under Locations.
```

---

# 9. Entity Type Rules

Entity folders should preserve type boundaries.

Allowed:

```text
Character folder → contains character folders/entities
Location folder → contains location folders/entities
Item folder → contains item folders/entities
```

Not allowed:

```text
Character folder → Location entity
Location folder → Character entity
```

This keeps the UI predictable.

---

# 10. Sorting

Each table should support manual ordering.

Add:

```sql
ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entities ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
```

Recommended indexes:

```sql
CREATE INDEX idx_documents_parent_sort
ON documents(parent_id, sort_order);

CREATE INDEX idx_entities_parent_sort
ON entities(parent_id, sort_order);
```

Default sorting:

```text
folders first
then items
sort_order ascending
title/name ascending
```

---

# 11. Database Migration

Create a migration:

```text
Add folder hierarchy support
```

Migration should:

* add `parent_id`;
* add `is_folder`;
* add `sort_order`;
* create indexes;
* preserve all existing records at root.

Existing records should get:

```text
parent_id = null
is_folder = 0
sort_order = 0
```

---

# 12. Suggested TypeScript Types

```ts
type TreeItemKind = "folder" | "document" | "entity";

type TreeItem = {
  id: string;
  title: string;
  kind: TreeItemKind;
  type: string;
  parentId: string | null;
  sortOrder: number;
  children?: TreeItem[];
};
```

---

```ts
type CreateFolderRequest = {
  title: string;
  section: "notes" | "lore" | "entities";
  entityType?: "character" | "location" | "event" | "faction" | "item" | "concept";
  parentId?: string | null;
};
```

---

```ts
type MoveTreeItemRequest = {
  itemId: string;
  itemKind: "document" | "entity";
  newParentId: string | null;
  newSortOrder?: number;
};
```

---

# 13. Tree Building

The UI should build trees from flat lists.

Algorithm:

```text
1. Load all items for section/type.
2. Create map by id.
3. Attach each item to its parent.
4. Items with parent_id = null become root items.
5. Sort children.
6. Render tree.
```

---

# 14. Search Behavior

Search should remain global.

Folders are organizational only.

Search results should show full path.

Example:

```text
Luna
Characters / Main Cast / Luna
```

---

# 15. Export Behavior

Folders should not affect export content unless explicitly selected.

For notes/lore export:

* selecting a folder exports all child documents;
* selecting a single note exports only that note.

For manuscript export:

* unchanged for MVP.

---

# 16. Acceptance Criteria

The feature is complete when:

* users can create folders under Notes/Lore;
* users can create folders under entity sections;
* users can nest folders;
* users can move notes/entities into folders;
* root items still work normally;
* folders are shown in sidebar/tree views;
* empty folders can be deleted;
* non-empty folders cannot be deleted;
* existing projects migrate without losing data;
* search results show folder paths;
* invalid folder moves are prevented.
