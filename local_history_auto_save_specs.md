# Local History & Autosave Specification

## 1. Overview

The application must provide a local history system that protects user work from accidental loss and allows previous versions of documents/entities to be reviewed or restored.

The system should be writer-friendly, reliable, and simple.

Core principle:

> Autosave protects the current work. History protects previous work.

---

# 2. Goals

## Primary Goals

* Prevent accidental data loss.
* Allow users to recover older versions.
* Track meaningful document changes.
* Provide visual comparison between versions.
* Avoid excessive storage growth.
* Keep the system simple and reliable.

## Non-Goals for MVP

The MVP will not implement:

* Git-like branching.
* Merge conflict resolution.
* Collaborative history.
* Cloud backup.
* Patch-only storage as the primary mechanism.
* Full project-wide version snapshots.

---

# 3. Core Concepts

## 3.1 Autosave

Autosave writes the current state to the active document/entity.

Autosave is frequent and safety-oriented.

Examples:

* user stops typing;
* user changes screen;
* app loses focus;
* app is closing.

Autosave should not necessarily create a history revision.

---

## 3.2 History Revision

A history revision is a recoverable saved version of a document/entity at a point in time.

History revisions are less frequent than autosaves.

They are used for:

* restore;
* compare;
* rollback;
* recovery.

---

## 3.3 Manual Snapshot

A manual snapshot is explicitly created by the user.

Manual snapshots should be preserved longer than automatic revisions.

Example use cases:

* before rewriting a chapter;
* before major edits;
* before sending to an editor;
* after finishing a chapter.

---

# 4. Save Triggers

The system must support the following save triggers:

```ts
type SaveTrigger =
  | "typing-idle"
  | "screen-change"
  | "manual-save"
  | "app-blur"
  | "app-close"
  | "before-export"
  | "before-destructive-action";
```

---

# 5. Save Policy

Each content type may define a different save policy.

```ts
type SavePolicy = {
  autosaveEnabled: boolean;
  autosaveDelayMs: number;
  createHistoryOnManualSave: boolean;
  createHistoryOnScreenChange: boolean;
  createHistoryBeforeExport: boolean;
  createHistoryBeforeDestructiveAction: boolean;
  minSnapshotIntervalMs: number;
  minChangeSizeForSnapshot: number;
};
```

---

## 5.1 Default Policies

### Chapters

```ts
{
  autosaveEnabled: true,
  autosaveDelayMs: 3000,
  createHistoryOnManualSave: true,
  createHistoryOnScreenChange: false,
  createHistoryBeforeExport: true,
  createHistoryBeforeDestructiveAction: true,
  minSnapshotIntervalMs: 300000,
  minChangeSizeForSnapshot: 250
}
```

---

### Notes

```ts
{
  autosaveEnabled: true,
  autosaveDelayMs: 5000,
  createHistoryOnManualSave: true,
  createHistoryOnScreenChange: false,
  createHistoryBeforeExport: false,
  createHistoryBeforeDestructiveAction: true,
  minSnapshotIntervalMs: 600000,
  minChangeSizeForSnapshot: 250
}
```

---

### Entities

```ts
{
  autosaveEnabled: true,
  autosaveDelayMs: 8000,
  createHistoryOnManualSave: true,
  createHistoryOnScreenChange: true,
  createHistoryBeforeExport: false,
  createHistoryBeforeDestructiveAction: true,
  minSnapshotIntervalMs: 600000,
  minChangeSizeForSnapshot: 100
}
```

---

# 6. Save Behavior

## 6.1 Typing Idle

When the user stops typing for the configured delay:

```text
dirty content
  ↓
autosave current state
  ↓
optionally create history revision if policy allows
```

By default, typing idle autosave should not create a revision unless enough time and change size have passed.

---

## 6.2 Screen Change

When the user navigates away from an edited item:

```text
save current state immediately
```

For entities, screen change may create a history revision because entity edits are often structured and intentional.

---

## 6.3 Manual Save

When the user clicks Save or presses Ctrl/Cmd+S:

```text
save current state
create history revision if enabled
show saved indicator
```

Manual save should usually create a revision.

---

## 6.4 Before Export

Before exporting a chapter, volume, or project:

```text
save dirty documents
create pre-export revision if enabled
continue export
```

This allows the user to return to the exact exported state.

---

## 6.5 Before Destructive Action

Before destructive operations, always create a history revision.

Examples:

* delete document;
* rename document;
* split chapter;
* merge scenes;
* bulk replace;
* migration affecting content;
* AI rewrite operation, future.

---

# 7. History Storage Strategy

## 7.1 MVP Strategy

Use compressed full snapshots.

Do not use patch chains as the primary storage mechanism in MVP.

Reason:

* simpler;
* safer;
* easier to restore;
* less risk of corruption;
* easier debugging;
* Markdown compresses well.

---

## 7.2 Compression

Snapshots should be compressed before storage.

Recommended:

```text
gzip or brotli
```

Node options:

```ts
import { gzipSync, gunzipSync } from "zlib";
```

or:

```ts
import { brotliCompressSync, brotliDecompressSync } from "zlib";
```

---

## 7.3 Storage Location

Recommended hybrid approach:

* SQLite stores metadata.
* Snapshot payload may be stored in SQLite or filesystem.

For MVP, SQLite is acceptable.

---

# 8. Database Schema

## 8.1 document_revisions

```sql
CREATE TABLE document_revisions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  document_path TEXT NOT NULL,
  document_type TEXT NOT NULL,

  revision_type TEXT NOT NULL,
  save_trigger TEXT NOT NULL,

  created_at TEXT NOT NULL,

  content_hash TEXT NOT NULL,
  previous_content_hash TEXT,

  compressed_content BLOB NOT NULL,
  compression TEXT NOT NULL,

  content_size_bytes INTEGER NOT NULL,
  compressed_size_bytes INTEGER NOT NULL,

  message TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,

  app_version TEXT,
  metadata_json TEXT
);
```

---

## 8.2 Revision Types

```ts
type RevisionType =
  | "autosave"
  | "manual"
  | "before-export"
  | "before-destructive-action"
  | "milestone";
```

---

## 8.3 Optional Cleanup Indexes

```sql
CREATE INDEX idx_document_revisions_document_id
ON document_revisions(document_id);

CREATE INDEX idx_document_revisions_created_at
ON document_revisions(created_at);

CREATE INDEX idx_document_revisions_type
ON document_revisions(revision_type);

CREATE INDEX idx_document_revisions_pinned
ON document_revisions(is_pinned);
```

---

# 9. Hashing

Every saved revision must store a content hash.

Recommended:

```text
SHA-256
```

Use hash to:

* avoid duplicate revisions;
* detect unchanged content;
* compare versions;
* validate restore integrity.

Rules:

* do not create revision if content hash equals latest revision hash;
* store previous content hash when available.

---

# 10. Retention Policy

## 10.1 Goal

Allow users to control how much history is kept.

The policy should balance safety and disk usage.

---

## 10.2 User Settings

```ts
type HistoryRetentionPolicy = {
  enabled: boolean;
  keepForDays: number | "forever";
  maxStorageMb?: number;
  cleanupFrequency: "onProjectOpen" | "daily" | "weekly";
  preserveManualSnapshots: boolean;
  preserveMilestones: boolean;
  minRevisionsPerDocument: number;
};
```

---

## 10.3 Default Retention

```ts
{
  enabled: true,
  keepForDays: 90,
  maxStorageMb: 500,
  cleanupFrequency: "onProjectOpen",
  preserveManualSnapshots: true,
  preserveMilestones: true,
  minRevisionsPerDocument: 10
}
```

---

# 11. Cleanup Rules

Cleanup must be conservative.

Delete candidates in this order:

1. old autosave revisions;
2. old before-export revisions;
3. old before-destructive-action revisions;
4. old manual revisions only if preservation is disabled;
5. never delete pinned revisions;
6. never delete milestone revisions if preservation is enabled.

---

## 11.1 Time-Based Cleanup

If `keepForDays` is not `"forever"`:

```text
delete unprotected revisions older than keepForDays
```

But only if doing so does not violate:

```text
minRevisionsPerDocument
```

---

## 11.2 Size-Based Cleanup

If total history size exceeds `maxStorageMb`:

```text
delete oldest unprotected revisions until below limit
```

Again, preserve:

* pinned revisions;
* milestones;
* minimum revisions per document.

---

# 12. Local History UI

## 12.1 History Panel

Each document/entity should expose a History panel.

Example:

```text
History
 ├── Today 14:35 — Manual save
 ├── Today 14:10 — Autosave
 ├── Yesterday 22:04 — Before export
 └── May 24 18:20 — Milestone: Finished chapter
```

Each revision should display:

* date/time;
* revision type;
* save trigger;
* optional message;
* size;
* pinned status.

---

## 12.2 Revision Actions

Available actions:

```text
View
Compare with current
Compare with previous
Restore as current
Restore as copy
Pin / Unpin
Delete revision
```

---

# 13. Restore Behavior

## 13.1 Restore as Current

When restoring a revision as current:

1. create a safety revision of the current content;
2. replace current content with restored content;
3. save the document/entity;
4. show success notification.

This prevents accidental overwrite.

---

## 13.2 Restore as Copy

Creates a new document using the restored content.

Example:

```text
chapter-012-restored-2026-05-27.md
```

This is safer and should be the default suggested action.

---

# 14. Diff / Compare

## 14.1 Recommended Library

Use `jsdiff`.

Purpose:

* compare current content with revision;
* compare two revisions;
* render added/removed text.

Use cases:

```text
Current vs previous
Current vs selected revision
Revision A vs Revision B
```

---

## 14.2 MVP Diff Types

Support:

* line diff;
* word diff.

Recommended:

```text
Line diff for chapters
Word diff for paragraphs or selected text
```

---

## 14.3 Patch Support

`jsdiff` may be used to generate patches in the future.

For MVP:

```text
Do not depend on patches for storage or restore.
```

Patch support should be considered post-MVP optimization only.

---

# 15. Status Indicators

The editor should show save state.

Possible states:

```ts
type SaveState =
  | "saved"
  | "dirty"
  | "saving"
  | "save-failed"
  | "offline-cache-only";
```

Suggested labels:

```text
Saved
Unsaved changes
Saving...
Save failed
Recovered draft
```

---

# 16. Entity Draft Safety

Entities may still have an explicit Save button.

However, to avoid data loss, entity edits should also be autosaved as drafts.

## 16.1 Entity Draft Flow

```text
user edits entity
  ↓
draft autosaves periodically
  ↓
user clicks Save
  ↓
draft becomes official entity state
```

If the app closes before official save:

```text
show recovered draft next time entity opens
```

---

## 16.2 Cancel Behavior

If user cancels entity edits:

```text
discard draft
keep official entity unchanged
```

---

# 17. Project Metadata Integration

The project metadata file should include history settings.

Example:

```json
{
  "history": {
    "enabled": true,
    "keepForDays": 90,
    "maxStorageMb": 500,
    "cleanupFrequency": "onProjectOpen",
    "preserveManualSnapshots": true,
    "preserveMilestones": true,
    "minRevisionsPerDocument": 10
  }
}
```

These settings are stable project-level preferences.

---

# 18. Performance Requirements

The system should:

* avoid blocking typing;
* debounce autosave;
* compress snapshots off the main UI thread when possible;
* avoid creating duplicate revisions;
* batch cleanup operations;
* keep restore operations transactional.

---

# 19. Failure Handling

## 19.1 Save Failure

If autosave fails:

* keep content in memory;
* show save failed indicator;
* retry if possible;
* do not mark content as saved.

---

## 19.2 History Failure

If history revision creation fails but main save succeeds:

* do not block writing;
* show non-critical warning;
* log error.

Main content safety has priority.

---

## 19.3 Restore Failure

If restore fails:

* do not modify current document;
* show error;
* keep revision intact.

---

# 20. Recommended Implementation Phases

## Phase 1 — Autosave Foundation

* dirty state tracking;
* idle autosave;
* save on screen change;
* save indicators;
* manual save behavior.

---

## Phase 2 — Snapshot History

* compressed full snapshots;
* revision database table;
* manual revisions;
* autosave revisions with throttling.

---

## Phase 3 — History UI

* history panel;
* view revision;
* restore as copy;
* restore as current.

---

## Phase 4 — Diff Viewer

* integrate `jsdiff`;
* compare current vs revision;
* compare two revisions.

---

## Phase 5 — Retention Policy

* project-level history settings;
* cleanup by age;
* cleanup by storage size;
* pinned/milestone preservation.

---

# 21. Acceptance Criteria

The feature is complete when:

* edited chapters autosave after idle delay;
* switching documents saves dirty content;
* manual Save creates a history revision;
* history revisions are compressed and stored;
* duplicate revisions are not created;
* users can view previous versions;
* users can restore a previous version safely;
* restore creates a safety revision first;
* users can compare current content with a previous revision;
* history retention deletes old unprotected revisions;
* pinned/manual revisions are preserved according to settings;
* save failures are visible to the user;
* normal typing remains smooth.
