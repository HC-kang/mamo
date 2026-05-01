# Markdown Composition Workbench PRD & MVP Spec

> Browser-only Markdown composition workspace where each `.md` file is treated as one composable document element.

Generated: 2026-04-28

---

## 1. Product Summary

Markdown Composition Workbench is a lightweight browser-based tool for composing many Markdown files into a larger document without introducing a database, backend server, custom document format, or block editor.

The core idea is simple:

```text
one .md file = one movable document element
one meta .md file = a composite document made from embedded .md files
rendered document = derived preview/export output
```

The app should let a user import multiple Markdown files, create quick notes as Markdown files, drag Markdown files into a composer, reorder them, preview the composed result, and export either the meta document or the fully rendered Markdown.

The design priority is:

```text
1. Simplicity
2. Practicality
3. Elegance
```

This is not a full PKM system, Notion-like block editor, graph database, Git client, or AI memory app. It is a small Markdown file composition workbench.

---

## 2. Product Positioning

### 2.1 What this product is

A browser-only Markdown composition workbench.

It helps users:

- collect small Markdown notes,
- treat each note file as one composable unit,
- compose those files into larger documents,
- preview the result,
- export both the composition source and the rendered output.

### 2.2 What this product is not

It is not:

- a full knowledge base manager,
- a graph visualization system,
- a semantic backlink system,
- a WYSIWYG editor,
- a collaborative editor,
- a Git interface,
- an AI workspace,
- a database-backed document system,
- a replacement for Obsidian, Logseq, Notion, or Tolaria.

### 2.3 Differentiation

Existing tools commonly solve adjacent problems:

- Markdown vault managers manage many Markdown files.
- PKM tools manage links, backlinks, metadata, and graph relationships.
- AI memory tools capture work context into Markdown.
- Static site generators render Markdown collections into websites.

This MVP focuses only on this narrower workflow:

```text
import md files → arrange md files → preview composite document → export md
```

The unique product boundary is:

```text
Markdown file as the minimum draggable/composable unit.
```

---

## 3. Core User Problem

Users often create fragmented Markdown notes:

- quick timestamped notes,
- meeting fragments,
- incident timeline entries,
- design snippets,
- decision notes,
- release note fragments,
- research notes,
- draft sections.

Later, they need to assemble these fragments into a coherent document.

Existing options are usually poor:

1. Copy/paste fragments into one large file.
2. Manually reorder content in a long document.
3. Use a heavyweight PKM/editor system.
4. Use a static site generator or document build system.
5. Maintain metadata separately in JSON/YAML.

This MVP should provide a lighter path:

```text
Keep every note as a Markdown file.
Use another Markdown file as the composition layer.
Drag file-level elements to create or update the composition.
Preview/export the result when needed.
```

---

## 4. Core Design Principles

### 4.1 Markdown-native

Both content and composition should be represented as Markdown.

No mandatory JSON/YAML composition file should be introduced for the MVP.

### 4.2 File-level granularity

The minimum manipulation unit is a Markdown file.

Do not split files into Markdown blocks, paragraphs, headings, or AST fragments for user manipulation.

```text
Allowed: move note-a.md as one card
Not allowed: move only paragraph 3 inside note-a.md
```

### 4.3 Source and rendered output are separate

The app should preserve this distinction:

```text
source note files       = original .md files
meta document           = .md file containing embeds
rendered document       = derived output generated from the meta document
```

The rendered document must not become the source of truth.

### 4.4 Drag-and-drop changes composition, not file location

Dragging a Markdown file into a composite document should not physically move the file.

It should add or reorder an embed reference in the meta document.

### 4.5 Lazy embed rendering

Large composite documents must remain usable.

Embedded Markdown files should be lazily loaded/rendered in preview mode. The app should not eagerly expand every embedded file into the DOM.

### 4.6 Browser-only

The MVP should run as a static web app.

No backend server, authentication, database, sync service, or network call is required.

### 4.7 Explicit import/export as source of truth

Browser storage may be used as a convenience cache, but explicit exported files are the durable source of truth.

---

## 5. Target Users

### 5.1 Primary user

A technical user who writes many Markdown notes and wants a lightweight way to assemble them into larger documents.

Typical examples:

- backend developers,
- SREs,
- technical writers,
- engineering managers,
- researchers,
- people who already use Markdown and local files.

### 5.2 Expected user knowledge

The user is expected to understand:

- Markdown files,
- file paths,
- import/export workflows,
- Markdown preview,
- basic document composition.

The app does not need to hide these concepts.

---

## 6. Primary Use Cases

### 6.1 Compose a design document from notes

A user imports:

```text
problem.md
constraints.md
options.md
decision.md
rollout.md
```

Then creates a meta document:

```md
# Deployment Design

![[problem.md]]
![[constraints.md]]
![[options.md]]
![[decision.md]]
![[rollout.md]]
```

The app previews the expanded document and exports either the meta document or the rendered Markdown.

### 6.2 Capture quick notes and later organize them

A user quickly creates timestamped Markdown notes in the app:

```text
inbox/2026-04-28-101530.md
inbox/2026-04-28-104012.md
inbox/2026-04-28-110240.md
```

Later, the user drags selected notes into a composite document.

### 6.3 Use nested meta documents

A meta document may include another meta document:

```md
# Article

![[section-introduction.md]]
![[section-architecture.md]]
![[section-rollout.md]]
```

Each section file may itself include other Markdown files.

### 6.4 Preview huge composite documents without loading everything

A user imports a meta document that embeds hundreds of Markdown files.

The app should initially show lightweight placeholders and render each embedded file only when needed.

---

## 7. Document Model

### 7.1 Markdown file

A Markdown file is the base document unit.

Conceptual model:

```text
MarkdownFile
  id: internal runtime id
  path: virtual path
  name: filename
  content: string, possibly unloaded until needed
  source: imported | generated
  dirty: boolean
```

Implementation may choose a different internal representation, but the product-level behavior should match this model.

### 7.2 Meta document

A meta document is a Markdown file containing embed directives.

Example:

```md
# Incident Review

![[timeline.md]]
![[impact.md]]
![[root-cause.md]]
![[actions.md]]
```

A meta document is not a separate file type. It is just Markdown with embed syntax.

### 7.3 Embed node

Each embed directive represents a file-level composition edge.

Conceptual model:

```text
EmbedNode
  targetPath: string
  status: idle | loading | loaded | missing | circular | error
  expanded: boolean
  rendered: boolean
```

The app should treat each embed as a lazy boundary.

### 7.4 Rendered document

The rendered document is produced by resolving a meta document.

Example source:

```md
# Design

![[problem.md]]
![[solution.md]]
```

Rendered Markdown export:

```md
# Design

<!-- Begin embed: problem.md -->

...problem.md content...

<!-- End embed: problem.md -->

<!-- Begin embed: solution.md -->

...solution.md content...

<!-- End embed: solution.md -->
```

The exact boundary comments may be adjusted, but rendered export should make embedded sections understandable.

---

## 8. Embed Syntax

### 8.1 Preferred syntax

The MVP should use Obsidian-compatible file embed syntax:

```md
![[path/to/file.md]]
```

Examples:

```md
![[problem.md]]
![[notes/context.md]]
![[sections/architecture.md]]
```

Rationale:

- It is already familiar to many Markdown/PKM users.
- It keeps meta documents readable.
- It avoids inventing a completely custom syntax.
- It remains easy to parse for MVP scope.

### 8.2 Supported MVP syntax

Support only file-level Markdown embeds:

```md
![[file.md]]
![[folder/file.md]]
```

### 8.3 Unsupported embed variants

Do not implement these in MVP:

```md
![[file.md#Heading]]
![[file.md#^block-id]]
![[file.md|Alias]]
![[image.png]]
![[pdf-file.pdf]]
```

No heading-level, block-level, alias, image, PDF, or binary embeds are required.

### 8.4 Optional backwards-compatible include syntax

The parser may optionally recognize:

```md
@include ./file.md
```

However, the app should export new meta documents using only the preferred syntax:

```md
![[file.md]]
```

If supporting both syntaxes increases complexity, omit `@include` entirely.

---

## 9. File Import Requirements

### 9.1 Import modes

The app should support importing Markdown files using:

- file picker,
- multiple file selection,
- drag-and-drop file import.

Folder import is desirable but not mandatory if it complicates browser compatibility.

### 9.2 Supported file type

MVP supports:

```text
.md
.markdown optional if easy
```

Non-Markdown files should be ignored or shown as unsupported.

### 9.3 Virtual path

Since browser apps may not have stable access to native filesystem paths, imported files should receive a virtual path.

Path resolution priority:

```text
1. Use browser-provided relative path when available.
2. Otherwise use filename.
3. If duplicate, disambiguate visibly.
```

Examples:

```text
notes/problem.md
problem.md
problem (2).md
```

### 9.4 Duplicate path handling

If multiple imported files resolve to the same path, the app must not crash.

Acceptable MVP behavior:

- rename duplicate virtual paths with suffixes,
- show a duplicate warning,
- allow the user to distinguish them in the library.

---

## 10. Quick Note Requirements

### 10.1 Create quick note

The app should allow a user to create a Markdown note inside the browser.

Fields:

- optional title,
- Markdown body.

### 10.2 Default filename

If the user does not provide a filename, generate one using timestamp.

Example:

```text
inbox/2026-04-28-143012.md
```

### 10.3 Quick note behavior

A quick note should behave exactly like an imported Markdown file:

- appears in Library,
- can be dragged into Composer,
- can be previewed,
- can be exported as `.md`,
- can be embedded in a meta document.

---

## 11. UI Requirements

### 11.1 Basic layout

Use a simple three-zone layout:

```text
[ Library ] [ Composer ] [ Preview ]
```

A responsive layout may stack these zones on smaller screens.

### 11.2 Library panel

Library shows imported and generated Markdown files.

Each file should appear as a card or list item containing:

- title or filename,
- virtual path,
- short snippet if available,
- status if missing/dirty/duplicate.

Required actions:

- drag file into Composer,
- open/edit file content if implemented simply,
- export individual file.

### 11.3 Composer panel

Composer represents the current meta document.

It should show:

- meta document title,
- ordered list of embedded files,
- draggable embed items,
- missing/circular/error states if known.

Required actions:

- add embed by drag-and-drop from Library,
- reorder embeds,
- remove embed reference,
- duplicate embed reference,
- edit meta document title.

Important:

```text
Duplicating an embed reference does not duplicate the file itself.
```

### 11.4 Preview panel

Preview renders the current meta document.

It should:

- render normal Markdown text in the meta document,
- show embedded Markdown files in order,
- lazy-render embedded files,
- show placeholders for unloaded embeds,
- show warnings for missing/circular/invalid embeds.

### 11.5 Compose/Preview modes

The app may use either:

- simultaneous Composer + Preview panels, or
- toggle between Compose and Preview mode.

Prefer the simpler implementation.

---

## 12. Drag-and-Drop Behavior

### 12.1 Add file to composition

Dragging a Library item into Composer adds an embed directive to the meta document.

Example result:

```md
![[notes/problem.md]]
```

### 12.2 Reorder composition

Dragging items inside Composer changes embed order.

### 12.3 Remove from composition

Removing an item from Composer removes only the embed reference.

It does not delete the underlying Markdown file.

### 12.4 Duplicate reference

The same file may be embedded multiple times.

Example:

```md
![[summary.md]]
![[details.md]]
![[summary.md]]
```

This is valid. The app should not forcibly deduplicate embeds.

### 12.5 No physical file move

Drag-and-drop must not change virtual file paths or physically move files.

---

## 13. Lazy Embed Rendering

### 13.1 Goal

The app should remain usable even when a meta document embeds many Markdown files.

Preview should not eagerly load, parse, render, and mount every embedded file.

### 13.2 Lazy boundary

Each embedded Markdown file is a lazy boundary.

```text
One embed directive = one lazy render unit
```

Do not implement paragraph-level or heading-level lazy rendering.

### 13.3 Lazy states

Each embed should support states similar to:

```text
idle       = known but not loaded/rendered
loading    = currently loading content
loaded     = content loaded
rendered   = rendered and mounted
missing    = target file unavailable
circular   = circular include detected
error      = failed to load or render
```

Implementation may simplify this state model if behavior remains clear.

### 13.4 Loading triggers

An embed may be loaded/rendered when:

1. the embed is visible or near-visible in the preview viewport,
2. the user explicitly expands the embed,
3. the app needs to generate rendered Markdown export.

### 13.5 Placeholder behavior

Before rendering, an embed should appear as a lightweight placeholder.

Example:

```text
[Embedded file: notes/problem.md]
```

If collapsed:

```text
▶ notes/problem.md
```

If expanded and loaded:

```text
▼ notes/problem.md

...rendered Markdown content...
```

### 13.6 DOM mount strategy

The app should avoid mounting a very large rendered document all at once.

Recommended behavior:

- render visible or near-visible embeds,
- keep far-away embeds as placeholders,
- optionally unmount distant rendered embeds if implementation remains simple.

Do not build a custom layout engine.

### 13.7 Nested embeds

Nested embeds should follow the same lazy policy.

Example:

```text
article.md
  section-a.md loaded
    note-1.md placeholder
    note-2.md placeholder
  section-b.md placeholder
```

Do not fully expand nested documents eagerly.

### 13.8 Preview vs export

Lazy rendering applies to preview.

Rendered Markdown export must resolve the full include tree.

```text
Preview = lazy
Rendered export = full traversal
```

---

## 14. Include Resolution and Cycle Handling

### 14.1 Resolution model

When rendering or exporting, the app resolves embed directives by matching the target path against imported/generated Markdown files.

### 14.2 Missing target

If an embedded file is not available, show a placeholder.

Example preview output:

```md
> Missing embed: notes/missing.md
```

Rendered Markdown export should include a similar placeholder.

### 14.3 Invalid embed syntax

Invalid embed lines should not crash the app.

Example:

```md
![[]]
```

or unsupported:

```md
![[file.md#Heading]]
```

The app may either ignore unsupported syntax or show a warning.

### 14.4 Cycle detection

Circular embeds must be detected.

Example:

```text
A.md embeds B.md
B.md embeds C.md
C.md embeds A.md
```

The app must not recurse infinitely.

### 14.5 MVP cycle policy

When a cycle is detected:

- stop resolving that branch,
- insert a circular embed placeholder,
- keep the app stable.

Example:

```md
> Circular embed detected: A.md → B.md → C.md → A.md
```

### 14.6 Resolution stack

MVP can detect cycles using the current resolution stack.

It does not need to precompute the entire graph.

### 14.7 Max depth

Add a maximum embed depth as a safety guard.

Recommended default:

```text
maxDepth = 20
```

If exceeded:

```md
> Max embed depth exceeded: path/to/file.md
```

---

## 15. Markdown Rendering Requirements

### 15.1 Basic Markdown preview

The app should render standard Markdown sufficiently for reading.

Required minimum:

- headings,
- paragraphs,
- lists,
- links,
- code blocks,
- inline code,
- blockquotes.

Advanced Markdown extensions are optional.

### 15.2 Raw embed line rendering

In source/meta view, embed lines should remain visible as Markdown syntax.

In preview, embed lines should be replaced by embedded content or placeholders.

### 15.3 Security

If Markdown is rendered to HTML, sanitize rendered HTML or avoid unsafe HTML execution.

Do not execute scripts from imported Markdown.

MVP should prefer safe rendering over full Markdown feature coverage.

---

## 16. Editing Requirements

### 16.1 Meta document editing

The app should allow editing the current meta document indirectly through Composer operations.

Minimum operations:

- change title,
- add embed,
- remove embed,
- reorder embed,
- duplicate embed.

Direct raw Markdown editing of the meta document is optional.

### 16.2 Note editing

Editing imported/generated note content is optional for MVP but useful.

If implemented, keep it simple:

- plain textarea,
- save to in-memory state,
- mark as dirty,
- export modified file explicitly.

Do not implement WYSIWYG editing.

### 16.3 Rendered document editing

Do not allow editing the fully rendered composite document as the source of truth.

Rendered output is derived.

---

## 17. Export Requirements

### 17.1 Export individual Markdown file

The user can export an individual imported/generated Markdown file.

### 17.2 Export meta document

The user can export the current composition as a meta Markdown document.

Example:

```md
# Deployment Design

![[problem.md]]
![[constraints.md]]
![[decision.md]]
```

### 17.3 Export rendered Markdown

The user can export the fully resolved composite document as one Markdown file.

This operation must resolve the full embed tree, not just visible embeds.

### 17.4 Rendered export boundary markers

Rendered export should optionally include boundary markers for embedded files.

Example:

```md
<!-- Begin embed: problem.md -->

...content...

<!-- End embed: problem.md -->
```

This helps preserve traceability without introducing complex metadata.

### 17.5 Unsupported exports

MVP does not require:

- PDF export,
- HTML export,
- ZIP bundle export,
- Git commit export,
- filesystem write-back.

---

## 18. Importing Existing Meta Documents

### 18.1 Detect meta documents

When importing a Markdown file containing supported embed syntax, the app should be able to treat it as a meta document.

Example:

```md
# My Composite Document

![[a.md]]
![[b.md]]
```

### 18.2 Reconstruct Composer

If the user selects this file as the current meta document, Composer should show:

```text
a.md
b.md
```

### 18.3 Missing files

If embedded files are not imported, show missing placeholders.

Do not require all referenced files to be present before opening the meta document.

---

## 19. Persistence Requirements

### 19.1 No backend persistence

The app does not need backend persistence.

### 19.2 Optional browser cache

The app may use browser storage to preserve session state.

Acceptable storage:

- localStorage,
- IndexedDB,
- in-memory state.

But this must remain a convenience feature.

### 19.3 Source of truth

The durable source of truth is explicit import/export of Markdown files.

The app should communicate unsaved changes clearly.

### 19.4 Unsaved changes

If a meta document or quick note has been changed but not exported, show an unsaved indicator.

Example:

```text
Unsaved changes
```

---

## 20. Error Handling Requirements

### 20.1 General rule

The app should degrade gracefully.

Bad input should produce warnings/placeholders, not crashes.

### 20.2 Missing embed

```md
> Missing embed: path/to/file.md
```

### 20.3 Circular embed

```md
> Circular embed detected: A.md → B.md → A.md
```

### 20.4 Max depth exceeded

```md
> Max embed depth exceeded: path/to/file.md
```

### 20.5 Unsupported embed syntax

```md
> Unsupported embed syntax: file.md#Heading
```

### 20.6 Duplicate virtual path

Show a warning or disambiguate paths.

---

## 21. Performance Requirements

### 21.1 Baseline target

The app should handle a composite document with many embedded Markdown files without freezing the UI at initial preview load.

Reasonable MVP target:

```text
100 imported md files
50 embedded files in one meta document
nested embeds up to depth 5
```

This is not a hard benchmark, but a design sanity check.

### 21.2 Avoid eager full expansion in preview

Preview must not eagerly render all embeds when a meta document is opened.

### 21.3 Export may be heavier

Rendered Markdown export may perform a full traversal because it needs the complete output.

It should still avoid infinite recursion and should report missing/circular embeds.

### 21.4 Web Worker optional

Web Worker-based Markdown rendering is optional.

Do not add it unless the simpler lazy rendering strategy is insufficient.

Implementation preference:

```text
1. Lazy embed rendering
2. Viewport-based rendering/mounting
3. Optional worker optimization later
```

---

## 22. Accessibility and Usability

MVP should include basic usability expectations:

- clear file names and paths,
- visible drag handles or obvious draggable cards,
- keyboard-accessible remove action where practical,
- readable missing/circular warnings,
- no hidden destructive operations.

The app should avoid surprise file deletion or silent data loss.

---

## 23. Non-Goals

Explicitly do not implement in MVP:

```text
- Markdown paragraph/block-level manipulation
- block IDs
- block references
- heading-level embeds
- AST-level editing
- WYSIWYG editor
- visual canvas
- graph visualization
- backlink system
- global full-text search
- custom metadata schema system
- YAML view files
- JSON composition files
- Git integration
- Git diff visualization
- filesystem watcher
- automatic local file write-back
- collaborative editing
- authentication
- cloud sync
- AI features
- plugin system
- PDF export
- HTML export
- ZIP export
- custom CSS cascade
- virtual DOM diff engine beyond normal framework usage
- custom browser-like layout engine
```

The MVP should resist becoming a full PKM or document management system.

---

## 24. Acceptance Criteria

### Scenario 1: Import and compose Markdown files

Given the user imports:

```text
problem.md
context.md
decision.md
```

When the user creates a new meta document and drags the three files into Composer,

Then Composer shows the files in the selected order,

And Preview shows them as one composed document,

And exporting the meta document produces:

```md
# Untitled Document

![[problem.md]]
![[context.md]]
![[decision.md]]
```

### Scenario 2: Reorder embeds

Given a meta document contains:

```md
![[a.md]]
![[b.md]]
![[c.md]]
```

When the user drags `c.md` above `a.md`,

Then the meta document export becomes:

```md
![[c.md]]
![[a.md]]
![[b.md]]
```

### Scenario 3: Quick note composition

Given the user creates a quick note,

When the user saves it,

Then it appears as a Markdown file in Library,

And the user can drag it into Composer,

And it can be exported as an individual `.md` file.

### Scenario 4: Import existing meta document

Given the user imports:

```md
# Existing Document

![[a.md]]
![[b.md]]
```

And `a.md` and `b.md` are also imported,

When the user opens the meta document,

Then Composer shows `a.md` and `b.md`,

And Preview renders their content.

### Scenario 5: Missing embed

Given a meta document contains:

```md
![[missing.md]]
```

And `missing.md` has not been imported,

Then Preview shows a missing embed placeholder,

And the app does not crash.

### Scenario 6: Nested meta document

Given:

```md
# section.md
![[note-a.md]]
![[note-b.md]]
```

And:

```md
# article.md
![[section.md]]
![[note-c.md]]
```

When Preview opens `article.md`,

Then the app shows `section.md` and its nested embeds in order,

And nested embeds follow the same lazy rendering behavior.

### Scenario 7: Circular embed

Given:

```text
A.md embeds B.md
B.md embeds A.md
```

When Preview or rendered export resolves `A.md`,

Then the app inserts a circular embed warning,

And does not recurse infinitely.

### Scenario 8: Lazy preview

Given a meta document embeds 50 Markdown files,

When the user opens Preview,

Then the app does not eagerly render all 50 full contents into the DOM,

And off-screen embeds are represented by placeholders until needed.

### Scenario 9: Rendered Markdown export

Given a meta document with nested embeds,

When the user exports rendered Markdown,

Then the app resolves the full embed tree,

Includes available embedded content,

Inserts placeholders for missing/circular embeds,

And produces a single `.md` file.

---

## 25. Recommended MVP Implementation Boundaries

Implementation details are intentionally left flexible, but the following boundaries should guide decisions.

### 25.1 Keep parser simple

Embed detection can be line-based.

MVP does not require a full Markdown AST transformation pipeline.

### 25.2 Keep UI state simple

Do not introduce complex document mutation models.

Composition state can be derived from the current meta Markdown and Composer operations.

### 25.3 Keep lazy rendering simple

Use file-level placeholders and viewport/expand triggers.

Do not implement a custom document layout engine.

### 25.4 Keep storage simple

Use explicit download/export for durable results.

Browser storage is optional.

### 25.5 Prefer fewer features with clear behavior

If a feature makes semantics ambiguous, exclude it from MVP.

Examples:

- aliases,
- heading embeds,
- automatic write-back,
- cross-file rename tracking,
- block-level references.

---

## 26. Open Questions

These are intentionally deferred and should not block MVP.

### 26.1 Should meta documents allow normal Markdown content between embeds?

Recommended MVP answer: yes.

Example:

```md
# Design Document

This document is assembled from several notes.

## Problem

![[problem.md]]

## Decision

![[decision.md]]
```

Composer may only manipulate embed rows, while raw Markdown text remains in the meta document.

If this complicates the Composer, initially allow meta documents to be mostly title + embed list.

### 26.2 Should the app support direct raw meta Markdown editing?

Optional.

Useful but not required.

If implemented, raw edits should update Composer after parsing.

### 26.3 Should rendered export include source boundary comments?

Recommended: yes, because it preserves traceability while remaining plain Markdown.

### 26.4 Should File System Access API be used?

Optional.

MVP should work without requiring it, because browser support varies.

Explicit import/export is enough.

---

## 27. Final Product Definition

Markdown Composition Workbench is a browser-only static web app that treats each Markdown file as one composable document element. Users can import or create Markdown files, arrange them through a meta Markdown document using `![[file.md]]` embeds, preview the composed result with lazy embed rendering, and export either the meta source document or the fully rendered Markdown output.

The app should stay deliberately small: no backend, no database, no block editor, no graph system, no Git integration, and no custom document format.
