# Custom Break Nodes Specification

## 1. Goal

Add editor support for three structural insertions:

* Line break
* Horizontal divider
* Page break

These controls must appear in the editor toolbar.

The existing inactive `Divider` button should be wired to insert a horizontal rule.

---

# 2. Toolbar Buttons

Add or fix the following toolbar buttons:

```text
Line Break
Divider
Page Break
```

## Behavior

```text
Line Break  → inserts a hard line break
Divider     → inserts a horizontal rule
Page Break  → inserts a custom page break marker
```

---

# 3. Markdown Representation

## 3.1 Line Break

Markdown output:

```md
Line one  
Line two
```

or equivalent supported hard break serialization.

Tiptap has an official HardBreak extension for `<br>` behavior. ([Tiptap][2])

---

## 3.2 Horizontal Divider

Markdown output:

```md
---
```

Tiptap has an official HorizontalRule extension that renders `<hr>` and can be triggered from Markdown using `---`. ([Tiptap][1])

---

## 3.3 Page Break

Use a custom Markdown tag.

Recommended syntax:

```md
{{page-break}}
```

Rules:

* must remain intact in Markdown exports;
* must render visually in the editor;
* must be ignored in HTML export;
* must become an actual page break in DOCX export.

---

# 4. Editor Visual Representation

## 4.1 Page Break Visual

In the editor, the page break should appear as a full-width gray divider.

Visual description:

```text
──────────────── Page Break ────────────────
```

Style:

* horizontal line;
* top and bottom border;
* gray text in the center;
* non-editable atom node;
* selectable as a single block.

Suggested CSS:

```css
.page-break-node {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  color: #888;
  font-size: 12px;
  text-transform: uppercase;
  user-select: none;
}

.page-break-node::before,
.page-break-node::after {
  content: "";
  flex: 1;
  border-top: 1px solid #aaa;
  border-bottom: 1px solid #ddd;
  height: 3px;
}

.page-break-node-label {
  white-space: nowrap;
}
```

---

# 5. Tiptap Extension Requirements

## 5.1 Required Extensions

Ensure the editor includes:

```ts
import HardBreak from "@tiptap/extension-hard-break";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
```

If `StarterKit` already includes them, either:

* use StarterKit defaults; or
* disable them in StarterKit and register explicitly.

Example:

```ts
StarterKit.configure({
  horizontalRule: false,
  hardBreak: false,
}),
HardBreak,
HorizontalRule,
PageBreak,
```

---

## 5.2 Custom PageBreak Node

Create a custom Tiptap node:

```ts
PageBreak
```

Recommended schema:

```ts
Node.create({
  name: "pageBreak",

  group: "block",

  atom: true,

  selectable: true,

  draggable: false,

  parseHTML() {
    return [
      {
        tag: "div[data-type='page-break']",
      },
    ];
  },

  renderHTML() {
    return [
      "div",
      {
        "data-type": "page-break",
        class: "page-break-node",
      },
      ["span", { class: "page-break-node-label" }, "Page Break"],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          });
        },
    };
  },
});
```

Tiptap custom nodes are installed through the editor extension array like any other extension. ([Tiptap][3])

---

# 6. Toolbar Command Mapping

## 6.1 Line Break Button

```ts
editor.chain().focus().setHardBreak().run();
```

## 6.2 Divider Button

```ts
editor.chain().focus().setHorizontalRule().run();
```

This fixes the currently inactive `Divider` button.

## 6.3 Page Break Button

```ts
editor.chain().focus().setPageBreak().run();
```

---

# 7. Markdown Serialization

## 7.1 Requirement

The page break node must serialize to:

```md
{{page-break}}
```

The Markdown export must preserve this marker exactly.

Tiptap’s Markdown support allows custom serialization through its Markdown system, but this area is marked beta in the official docs. Implement behind a compatibility check if needed. ([Tiptap][4])

---

## 7.2 Fallback Strategy

If native Tiptap Markdown serialization is not stable enough:

Use a post-processing step when saving Markdown:

```text
Tiptap JSON
  ↓
custom serializer
  ↓
Markdown string
```

The custom serializer must map:

```ts
pageBreak node → "{{page-break}}"
```

---

# 8. Markdown Parsing

When loading Markdown, the editor must parse:

```md
{{page-break}}
```

into the custom `pageBreak` node.

## Accepted Forms

MVP supports only:

```md
{{page-break}}
```

Optional future aliases:

```md
<!-- page-break -->
[page-break]
```

But avoid multiple syntaxes in MVP.

---

# 9. Export Behavior

## 9.1 DOCX Export

When DOCX exporter encounters:

```md
{{page-break}}
```

or internal AST node:

```ts
{ type: "pageBreak" }
```

It must emit a real DOCX page break.

Expected behavior:

```text
content before
[DOCX page break]
content after starts on next page
```

---

## 9.2 HTML Export

HTML export must ignore page break nodes.

Behavior:

```text
{{page-break}} → nothing
```

No visible output.

---

## 9.3 Markdown Export

Markdown export must preserve the custom tag.

Behavior:

```text
{{page-break}} → {{page-break}}
```

---

## 9.4 PDF Export

If PDF export is generated from HTML, page breaks may later become:

```html
<div style="break-after: page;"></div>
```

For now, this is optional.

---

# 10. Internal Export Model Update

Add block type:

```ts
type ExportBlock =
  | ...
  | {
      type: "pageBreak";
    };
```

Markdown AST normalization should detect:

```md
{{page-break}}
```

and convert it to:

```ts
{ type: "pageBreak" }
```

---

# 11. Editor Constraints

The feature should only be implemented if:

* `HardBreak` can be enabled;
* `HorizontalRule` can be enabled;
* custom block node can be registered;
* Markdown load/save can preserve the custom page break marker.

If any of these are not true, do not implement the page break button yet.

---

# 12. Acceptance Criteria

The feature is complete when:

* toolbar shows Line Break, Divider, and Page Break;
* Line Break inserts a real hard break;
* Divider inserts a visible horizontal rule;
* existing Divider button works;
* Page Break inserts a visual gray page break block;
* Markdown save preserves `{{page-break}}`;
* Markdown load restores `{{page-break}}` as a page break node;
* DOCX export converts page break into an actual page break;
* HTML export omits page break;
* Markdown export keeps the tag unchanged;
* no raw page break tag is shown in the rich editor.

[1]: https://tiptap.dev/docs/editor/extensions/nodes/horizontal-rule?utm_source=chatgpt.com "HorizontalRule extension | Tiptap Editor Docs"
[2]: https://tiptap.dev/docs/editor/extensions/nodes/hard-break?utm_source=chatgpt.com "HardBreak extension | Tiptap Editor Docs"
[3]: https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node?utm_source=chatgpt.com "Node API - Editor"
[4]: https://tiptap.dev/docs/editor/markdown/advanced-usage/custom-serializing?utm_source=chatgpt.com "Custom Markdown Serializing | Tiptap Editor Docs"
