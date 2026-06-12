# Release Notes from Git History — Specification

## Goal

Generate release notes automatically from Git commit history when publishing a GitHub Release.

The release notes should include commits between:

```text
previous release tag → current release tag
```

---

## Strategy

Use Git directly inside the `publish` job.

No extra dependency is required for MVP.

---

## Required Checkout

The `publish` job must checkout the repository with full history:

```yaml
- name: Checkout
  uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

---

## Determine Previous Tag

Add a step before creating the GitHub Release:

```yaml
- name: Generate release notes
  id: release_notes
  shell: bash
  run: |
    current="${{ needs.prepare.outputs.release_version }}"

    previous=$(git tag --sort=-v:refname | grep -v "^${current}$" | head -n 1 || true)

    if [ -z "$previous" ]; then
      range="$current"
      notes=$(git log --pretty=format:"- %s (%h)" "$current")
    else
      range="$previous..$current"
      notes=$(git log --pretty=format:"- %s (%h)" "$range")
    fi

    {
      echo "body<<EOF"
      echo "## Scriptorium $current"
      echo ""
      echo "Cross-platform release for Windows and Linux."
      echo ""
      echo "### Changes"
      echo ""
      if [ -z "$notes" ]; then
        echo "- No commit changes found."
      else
        echo "$notes"
      fi
      echo ""
      echo "### Installation"
      echo ""
      echo "| Platform | File | Notes |"
      echo "|----------|------|-------|"
      echo "| Windows  | \`.exe\` | NSIS installer — lets you choose install directory |"
      echo "| Linux    | \`.AppImage\` | \`chmod +x\` then run directly, no install needed |"
      echo "EOF"
    } >> "$GITHUB_OUTPUT"
```

---

## Update GitHub Release Step

Replace the fixed `body` with:

```yaml
body: ${{ steps.release_notes.outputs.body }}
```

---

## Optional Future Improvement

Later, if you want prettier categorized notes, use Conventional Commits and add:

```text
Features
Fixes
Refactors
Docs
Chores
```

But for now, Git log is enough and very practical.

## Acceptance Criteria

* Release notes are generated automatically.
* Notes include commits since the previous tag.
* First release still works.
* Existing Windows/Linux artifacts remain attached.
* Manual and tag-triggered releases both work.
