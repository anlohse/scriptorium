# Local Spell Check Specification

## 1. Overview

Add local spell checking to the editor.

The feature must run entirely on the user's machine and must not send document content to external services.

The spell checker should detect unknown words, underline them in the editor, and provide correction suggestions when available.

This feature applies to:

* chapters;
* scenes;
* notes;
* lore documents;
* entity Markdown descriptions;
* translations.

---

# 2. Goals

## Primary Goals

* Detect spelling errors locally.
* Support multiple languages.
* Underline spelling issues in the Tiptap editor.
* Provide spelling suggestions.
* Allow users to ignore words.
* Allow users to add custom words to the project dictionary.
* Preserve writing performance.

## Non-Goals

The MVP will not include:

* grammar checking;
* style suggestions;
* AI review;
* cloud-based review;
* sentence-level correction;
* rewriting suggestions;
* collaborative dictionaries.

---

# 3. Recommended Stack

Use:

```bash
npm install nspell
```

Recommended dictionary format:

```text
Hunspell .aff + .dic
```

Initial supported locales:

```text
pt-BR
en-US
```

Future locales:

```text
es-ES
fr-FR
de-DE
it-IT
ja-JP, optional/not recommended for Hunspell workflow
```

---

# 4. Dictionary Storage

## 4.1 Application Dictionaries

Bundled dictionaries should be stored with the app.

Example:

```text
/resources/dictionaries
  /pt-BR
    pt_BR.aff
    pt_BR.dic
  /en-US
    en_US.aff
    en_US.dic
```

---

## 4.2 Project Custom Dictionaries

Each project may define custom dictionary files.

Example:

```text
/project/.scriptorium/dictionaries
  custom-pt-BR.txt
  custom-en-US.txt
```

Each file contains one word per line:

```text
Kael
Luna
Arcturus
manacore
```

This is preferred over SQLite because it is:

* Git-friendly;
* human-readable;
* easy to backup;
* easy to edit manually.

---

# 5. Project Metadata Configuration

Add spell check settings to the project metadata file.

```json
{
  "spellCheck": {
    "enabled": true,
    "defaultLocale": "pt-BR",
    "enabledLocales": ["pt-BR", "en-US"],
    "customDictionaryPath": ".scriptorium/dictionaries",
    "checkDelayMs": 750,
    "maxSuggestions": 5
  }
}
```

---

# 6. Document Locale Resolution

The spell checker must decide which locale to use.

Priority order:

```text
1. Document-specific locale
2. Translation locale
3. Project defaultLocale
4. App default locale
```

Example:

```ts
type LocaleResolutionInput = {
  documentId: string;
  documentLocale?: string;
  translationLocale?: string;
  projectDefaultLocale: string;
  appDefaultLocale: string;
};
```

---

# 7. Spell Check Flow

```text
User edits content
  ↓
Debounce spell check
  ↓
Extract text segments from Tiptap document
  ↓
Tokenize words
  ↓
Check each word with selected dictionary
  ↓
Generate spelling issues
  ↓
Render decorations in editor
```

---

# 8. Performance Rules

Spell check must not block typing.

Requirements:

* debounce checks;
* skip unchanged text segments when possible;
* cache dictionary instances;
* cache known valid words;
* cache ignored words;
* avoid checking huge documents on every keystroke;
* limit suggestions until requested if needed.

Recommended debounce:

```text
750ms
```

For long documents:

```text
check visible viewport first
or
check active paragraph first
```

Full-document checking can run after idle.

---

# 9. Text Extraction

Do not rely only on:

```ts
editor.getText()
```

because it loses positional mapping.

The spell checker must extract text with ProseMirror document positions.

```ts
type TextSegment = {
  text: string;
  from: number;
  to: number;
  nodeType: string;
};
```

Only check editable textual nodes:

* paragraph;
* heading;
* blockquote;
* list item;
* table cell;
* entity description text.

Do not check:

* code blocks;
* inline code;
* URLs;
* image alt text for MVP;
* page-break nodes;
* horizontal rule nodes;
* frontmatter;
* raw HTML blocks.

---

# 10. Tokenization

Tokenization must support:

* Unicode letters;
* accents;
* apostrophes;
* hyphenated words;
* fictional names.

Recommended word pattern:

```ts
const WORD_REGEX = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
```

Examples recognized as one token:

```text
não
você
d'água
anti-herói
well-known
```

---

# 11. Ignored Words

The user may ignore a word.

## 11.1 Ignore Once

Applies only to the current visible issue.

Not persisted.

## 11.2 Ignore in Document

Applies to the current document.

Optional MVP.

## 11.3 Add to Project Dictionary

Persists word to:

```text
/project/.scriptorium/dictionaries/custom-<locale>.txt
```

After adding, all matching issues should disappear.

---

# 12. Issue Model

```ts
type SpellIssue = {
  id: string;
  type: "spelling";
  locale: string;
  word: string;
  from: number;
  to: number;
  suggestions: string[];
  severity: "warning";
  source: "local";
};
```

Issue ID can be generated from:

```text
documentId + locale + word + from + to + contentHash
```

---

# 13. Visual Rendering

Use ProseMirror Decorations to underline misspelled words.

CSS:

```css
.spell-error {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-color: #e05252;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 2px;
}
```

Decorations must update when:

* document content changes;
* locale changes;
* spell check is disabled/enabled;
* custom dictionary changes;
* ignored words change.

---

# 14. Suggestions UI

When user right-clicks or clicks on an underlined word, show a context menu.

Menu:

```text
Suggestions
- suggestion 1
- suggestion 2
- suggestion 3

Actions
- Ignore once
- Add to project dictionary
- Disable spell check
```

If no suggestions exist:

```text
No suggestions
```

Selecting a suggestion replaces the misspelled range.

---

# 15. Replacement Rules

When applying a suggestion:

* replace only the issue range;
* preserve surrounding marks if possible;
* preserve capitalization when reasonable.

Examples:

```text
luna → Luna
LUNA → LUNA
```

MVP may directly apply the suggestion without advanced capitalization logic.

---

# 16. Dictionary Loader

Create a dictionary loader service.

```ts
type DictionaryInstance = {
  locale: string;
  spell: (word: string) => boolean;
  suggest: (word: string) => string[];
};

type DictionaryLoader = {
  load(locale: string): Promise<DictionaryInstance>;
  reload(locale: string): Promise<DictionaryInstance>;
};
```

Rules:

* dictionaries are loaded lazily;
* loaded dictionaries are cached;
* custom project words are added after base dictionary load;
* missing dictionary disables spell check for that locale with warning.

---

# 17. Spell Check Service

```ts
type SpellCheckRequest = {
  documentId: string;
  locale: string;
  segments: TextSegment[];
  maxSuggestions: number;
  ignoredWords: Set<string>;
};

type SpellCheckResult = {
  issues: SpellIssue[];
  checkedAt: string;
};
```

---

# 18. Tiptap Integration

Create a Tiptap extension/plugin:

```ts
LocalSpellCheckExtension
```

Responsibilities:

* listen to document updates;
* debounce spell checking;
* maintain `DecorationSet`;
* expose commands;
* handle context menu metadata.

Commands:

```ts
editor.commands.setSpellCheckEnabled(true);
editor.commands.setSpellCheckLocale("pt-BR");
editor.commands.ignoreSpellIssue(issueId);
editor.commands.addWordToDictionary(word);
```

---

# 19. User Settings

Project-level settings:

```text
Enable spell check
Default language
Enabled languages
Custom dictionary path
Check delay
Max suggestions
```

Optional editor toolbar:

```text
Spell Check: On/Off
Language: pt-BR / en-US
```

---

# 20. Search and Export Behavior

Spell check annotations are editor-only.

They must not affect:

* Markdown files;
* DOCX export;
* HTML export;
* EPUB export;
* PDF export;
* search index.

No spell check markup should be written to Markdown.

---

# 21. Failure Handling

If dictionary cannot load:

```text
Spell check unavailable for pt-BR.
```

If custom dictionary cannot be written:

```text
Could not add word to project dictionary.
```

If spell check crashes:

* disable current check run;
* keep editor usable;
* log error;
* do not block saving.

---

# 22. Implementation Phases

## Phase 1 — Basic Underline

* load pt-BR dictionary;
* tokenize text;
* detect misspellings;
* underline with decorations;
* no suggestions menu yet.

## Phase 2 — Suggestions

* show suggestions;
* replace word with selected suggestion.

## Phase 3 — Custom Dictionary

* add word to project dictionary;
* reload issues after adding.

## Phase 4 — Multi-Language

* support en-US;
* locale selector;
* translation locale integration.

---

# 23. Acceptance Criteria

The feature is complete when:

* spell check runs locally;
* misspelled words are underlined in the editor;
* typing remains smooth;
* code blocks and inline code are ignored;
* page breaks and dividers are ignored;
* suggestions are shown when available;
* selecting a suggestion replaces the word;
* user can add a word to the project dictionary;
* custom dictionary words are no longer flagged;
* spell check can be disabled;
* spell check locale can be changed;
* no spell check data is written into Markdown files.
