# Draft Management Specification — Chapters and Scenes

## 1. Overview

Add draft/final content management for chapters and scenes.

Each chapter or scene may have two Markdown files:

```text
<content-name>_draft.md
<content-name>.md
```

The draft file is used for active writing.

The final file is used for export, publication, and completed manuscript compilation.

This feature applies only to:

* chapters;
* scenes.

It does not apply to:

* notes;
* lore;
* entities;
* assets.

---

# 2. Goals

## Primary Goals

* Allow writers to work on drafts without affecting final/exported text.
* Make draft editing the default writing mode.
* Keep final manuscript files clean.
* Prevent unfinished text from being exported accidentally.
* Keep implementation simple and filesystem-friendly.

## Non-Goals

The MVP will not include:

* multiple draft versions;
* branch-based drafts;
* automatic draft-to-final merging;
* review comments;
* approval workflows;
* per-paragraph draft/final state.

---

# 3. File Structure

For each chapter or scene:

```text
chapter-001_draft.md
chapter-001.md
```

Example:

```text
/manuscript/volume-1/
  chapter-001_draft.md
  chapter-001.md
  chapter-002_draft.md
  chapter-002.md
```

For scenes:

```text
/manuscript/volume-1/chapter-001/
  scene-001_draft.md
  scene-001.md
  scene-002_draft.md
  scene-002.md
```

---

# 4. Content Modes

Each chapter/scene has two content modes:

```ts
type ContentMode = "draft" | "final";
```

## Draft Mode

Uses:

```text
<name>_draft.md
```

Purpose:

* active writing;
* incomplete text;
* experiments;
* rough versions.

## Final Mode

Uses:

```text
<name>.md
```

Purpose:

* export;
* publication-ready content;
* review copy;
* stable manuscript.

---

# 5. Default Behavior

## 5.1 New Chapter

When creating a new chapter:

* create draft file;
* create final file;
* open draft by default;
* set `showDraft = true`;
* set `completed = false`.

Example:

```text
chapter-003_draft.md
chapter-003.md
```

The final file may initially be empty or copied from the draft depending on project setting.

Recommended MVP default:

```text
final file is empty
draft file contains initial template
```

---

## 5.2 New Scene

Same behavior as chapters:

* create draft file;
* create final file;
* open draft by default;
* set `showDraft = true`;
* set `completed = false`.

---

# 6. Toolbar Controls

The editor toolbar must include two checkboxes/toggles for chapters and scenes.

## 6.1 Show Draft

Label:

```text
Show Draft
```

Default:

```text
checked
```

Behavior:

* checked → editor loads draft file;
* unchecked → editor loads final file.

This controls only the current editor view.

---

## 6.2 Completed

Label:

```text
Completed
```

Default:

```text
unchecked
```

Behavior:

* marks the chapter/scene as completed;
* changes the default view for this chapter/scene;
* does not automatically copy draft to final;
* does not automatically export draft.

When checked:

```text
default view becomes final
```

When unchecked:

```text
default view becomes draft
```

Important:

```text
Completed changes default visualization only.
It does not alter content.
```

---

# 7. Default View Resolution

When opening a chapter or scene:

```ts
if (userExplicitlySelectedMode) {
  open selected mode;
} else if (content.completed) {
  open final;
} else {
  open draft;
}
```

---

# 8. Database Schema Changes

## 8.1 documents Table

Add:

```sql
ALTER TABLE documents ADD COLUMN draft_path TEXT;
ALTER TABLE documents ADD COLUMN final_path TEXT;
ALTER TABLE documents ADD COLUMN show_draft INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
```

Recommended indexes:

```sql
CREATE INDEX idx_documents_completed
ON documents(completed);

CREATE INDEX idx_documents_draft_path
ON documents(draft_path);

CREATE INDEX idx_documents_final_path
ON documents(final_path);
```

---

# 9. Existing `path` Field

If the current `documents.path` exists, keep it for compatibility.

Recommended meaning:

```text
documents.path = active/default path or legacy path
```

For new chapter/scene documents, prefer:

```text
draft_path
final_path
```

over:

```text
path
```

Eventually, `path` may represent the canonical final path.

Recommended MVP rule:

```text
path = final_path
```

---

# 10. Suggested TypeScript Model

```ts
type DraftableDocumentType = "chapter" | "scene";

type DraftableDocument = {
  id: string;
  title: string;
  type: DraftableDocumentType;

  draftPath: string;
  finalPath: string;

  showDraft: boolean;
  completed: boolean;

  activeMode: "draft" | "final";
};
```

---

```ts
type ResolveDocumentPathInput = {
  document: DraftableDocument;
  requestedMode?: "draft" | "final";
};

function resolveDocumentPath(input: ResolveDocumentPathInput): string {
  if (input.requestedMode === "draft") return input.document.draftPath;
  if (input.requestedMode === "final") return input.document.finalPath;

  return input.document.completed
    ? input.document.finalPath
    : input.document.draftPath;
}
```

---

# 11. Save Behavior

Saving must write only to the currently active mode.

Example:

```text
Show Draft checked
  → save chapter-001_draft.md

Show Draft unchecked
  → save chapter-001.md
```

Autosave must follow the same rule.

Manual save must follow the same rule.

---

# 12. Switching Between Draft and Final

When the user toggles `Show Draft`:

1. save current dirty content;
2. switch active file path;
3. load target file;
4. update editor content;
5. keep toolbar state synchronized.

If target file does not exist:

* create it;
* then load it.

---

# 13. Completed Toggle

When user toggles `Completed`:

```text
update documents.completed
```

If completed is checked:

```text
default open mode = final
```

If completed is unchecked:

```text
default open mode = draft
```

This action does not:

* copy draft to final;
* delete draft;
* change show draft content;
* modify export behavior.

---

# 14. Optional Copy Actions

Add explicit actions, not automatic behavior.

Recommended menu actions:

```text
Copy Draft to Final
Copy Final to Draft
Open Draft
Open Final
Compare Draft and Final
```

## 14.1 Copy Draft to Final

Before copying:

* save active file;
* create history snapshot of final file if local history exists;
* overwrite final file with draft content;
* keep user in current mode.

## 14.2 Copy Final to Draft

Useful when continuing from a finished version.

Before copying:

* save active file;
* create history snapshot of draft file if local history exists;
* overwrite draft file with final content.

---

# 15. Export Behavior

Exports must use only final files.

For chapters/scenes:

```text
use final_path
ignore draft_path
```

This applies to:

* Markdown export;
* HTML export;
* EPUB export;
* PDF export;
* DOCX export;
* ODT export.

Draft files are never exported unless a special debug/development export mode is added later.

---

# 16. Export Warnings

If exporting a volume/project and a chapter/scene has:

```text
completed = false
```

but a final file exists, export may proceed.

However, show warning:

```text
Chapter 3 is not marked as completed. Export will use the final version.
```

If final file is empty:

```text
Chapter 3 final file is empty.
```

Export should allow the user to continue or cancel.

---

# 17. Search Behavior

Search should support mode filters.

Options:

```text
Search final only
Search drafts only
Search both
```

Default:

```text
Search final only
```

Recommended for writer workflow:

```text
Global Search: both
Export Search: final only
```

Search results must show mode:

```text
Chapter 4 / Draft
Chapter 4 / Final
```

---

# 18. UI Tree Indicators

The project tree should show draft/completion state.

Examples:

```text
Chapter 1 ✅
Chapter 2 ✍️
Chapter 3 ⚠ final empty
```

Recommended states:

```ts
type DraftStatus =
  | "drafting"
  | "completed"
  | "final-empty"
  | "missing-draft"
  | "missing-final";
```

---

# 19. Migration Rules

Existing chapter/scene files must be migrated safely.

## 19.1 Existing Chapter

If existing document is:

```text
chapter-001.md
```

Migration should create:

```text
chapter-001_draft.md
chapter-001.md
```

Recommended behavior:

```text
copy existing content into draft
keep existing content as final
completed = false
show_draft = true
```

This preserves the current file and gives the user a draft copy.

---

## 19.2 Existing Scene

Same as chapter migration.

---

## 19.3 Notes/Lore/Entities

Do not migrate.

They keep single-file behavior.

---

# 20. File Naming Rules

Draft file naming:

```text
<base-name>_draft.md
```

Final file naming:

```text
<base-name>.md
```

If file name already ends with `_draft`:

```text
do not append another _draft
```

Invalid:

```text
chapter-001_draft_draft.md
```

---

# 21. Rename Behavior

When renaming a chapter/scene, rename both files.

Example:

```text
old:
chapter-001.md
chapter-001_draft.md

new:
chapter-001-new-title.md
chapter-001-new-title_draft.md
```

Rules:

* save active content first;
* check for collisions;
* rename both files atomically where possible;
* update `draft_path` and `final_path`.

---

# 22. Delete Behavior

When deleting a chapter/scene, both files are affected.

Recommended MVP behavior:

```text
move both files to project trash
```

If no trash system exists:

```text
ask confirmation before deleting both files
```

Message:

```text
This will delete both the draft and final version of this chapter.
```

---

# 23. Project Metadata Settings

Add draft behavior settings to project metadata.

Example:

```json
{
  "drafts": {
    "enabled": true,
    "createFinalFileOnNewChapter": true,
    "newFinalFileBehavior": "empty",
    "defaultOpenMode": "draft",
    "exportUses": "final"
  }
}
```

Allowed values:

```ts
type NewFinalFileBehavior = "empty" | "copy-draft-template";
type DefaultOpenMode = "draft" | "final-if-completed";
```

Recommended defaults:

```json
{
  "enabled": true,
  "createFinalFileOnNewChapter": true,
  "newFinalFileBehavior": "empty",
  "defaultOpenMode": "final-if-completed",
  "exportUses": "final"
}
```

---

# 24. Acceptance Criteria

The feature is complete when:

* new chapters create both draft and final files;
* new scenes create both draft and final files;
* draft opens by default;
* `Show Draft` toggles between draft and final content;
* autosave saves only the active mode;
* manual save saves only the active mode;
* `Completed` changes the default open mode;
* `Completed` does not copy or modify content;
* export uses only final files;
* export warns about incomplete or empty final files;
* existing chapters/scenes migrate safely;
* renaming updates both draft and final paths;
* deleting handles both files safely;
* search can distinguish draft and final results.
