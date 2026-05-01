# Project Memory

## 2026-04-29 Markdown Composition Workbench MVP

- Implemented as a static Vite + React + TypeScript app with Bun package management; no backend or database.
- Core product boundary: one Markdown file is one composable unit, meta Markdown uses only file-level `![[path.md]]` embeds, rendered Markdown is derived output.
- Parser is intentionally line-based and marks heading, block, alias, empty, and non-Markdown embeds as unsupported instead of crashing.
- Preview uses file-level lazy placeholders with `IntersectionObserver`; rendered Markdown export always performs full traversal with missing/circular/max-depth placeholders.
- Build initially failed under TypeScript 6 because CSS side-effect imports and Vitest config types needed explicit declarations; keep `src/vite-env.d.ts` and `vitest/config` import.

## 2026-04-29 Meta-Inspired Design Pass

- Added `DESIGN.md` via `npx getdesign@latest add meta` and adapted the UI to Meta Store-inspired tokens: Meta Blue primary CTAs, white/soft-gray surfaces, pill buttons, 20px card/tool radii, and 8px-grid spacing.
- Keep stacked/mobile workbench layouts non-sticky for the topbar; sticky topbar consumed too much viewport height and obscured panel headers during browser QA.
- Verified visually in the Codex in-app browser at `http://127.0.0.1:5173/`; quick note creation, drag into Composer, lazy preview, and console warnings/errors were checked.

## 2026-04-29 Editor Workbench UX Pass

- Reworked the UI toward a VS Code/Figma-style editor: dark top chrome, activity rail, dense Explorer/Composition/Preview panels, command bar, and blue status bar.
- Library items now support direct `+` add-to-composition in addition to drag-and-drop; this avoids relying on a generic drop box as the primary workflow.
- At browser width around 1148px the 3-panel layout should remain active; breakpoint was lowered to 980px after QA showed premature stacking weakened the editor feel.

## 2026-04-29 Recursive Embedded Editing

- Embedded Markdown files must be editable at every hierarchy level, not only from the Library; Preview embed boundaries now expose source editors recursively.
- Composer rows also expose an embedded-file source editor for the referenced file while preserving the meta document as an embed list.
- Browser QA covered a parent `notes/section.md` embedding child `notes/detail.md`: editing the parent from Composer and the child from nested Preview both updated rendered output immediately.

## 2026-04-29 Seamless Preview

- Preview should read like one rendered Markdown file, not like a debug view of embed boundaries.
- Embed file names and card headers are hidden in Preview read mode; only a minimal hover/focus edit affordance remains for editing embedded files.
- Lazy placeholders must not expose `Embedded file: path` text in the visible reading flow.

## 2026-04-29 Remove Decorative Modes

- Do not show fake mode controls. `Source`, `Read`, and `Lazy` pills were removed because they were decorative and conflicted with the seamless-document product theme.
- Raw meta Markdown remains available only through a real `Meta source` toggle in Composer; it is hidden by default and should be treated as advanced/debug source access, not the primary workflow.
- User-facing language should emphasize editing many Markdown files as one document.

## 2026-04-29 Fully Seamless Default UI

- The visible app should no longer expose `Meta`, `Meta source`, raw embed syntax, `Source`, or `Composition` language; those remain internal implementation details only.
- Removed the Composer/meta-source panel from the default surface. The default layout is now Explorer plus one Document surface so multiple files feel like one document.
- Avoid large generic drop-box UI in Explorer. Keep file opening as compact `Open` actions and let the left file viewer be the main clue that the document spans multiple files.
- Do not show explicit `Import or drop` guidance. The Explorer panel itself should quietly accept dropped Markdown files, with only subtle visual feedback during drag-over.
- The Document panel must remain an actual editing surface, not preview-only. Root document text and every visible embedded file text segment should be editable inline without exposing meta/source terminology.
- Keep a real rendered Preview beside the Editor. The Editor can show subtle file wrappers (`document`, then embedded file paths) so users can distinguish physical Markdown files without exposing raw embed mechanics.
- A standalone `--doc--` line in an editor textarea creates a new generated Markdown block file under `document/*.md`, replaces the delimiter with an internal embed, and updates Explorer to show both `document.md` and generated files.
- Editor textareas should behave like one continuous document for vertical cursor movement: `ArrowDown` at a block bottom focuses the next file block, `ArrowUp` at a block top focuses the previous block, and `ArrowDown` at the final block creates a trailing blank line.
- For nested embeds, empty parent landing slots are required around child file wrappers. Arrow movement from an innermost block should land in the nearest parent wrapper, not skip to the root; moving down from a nested block bottom creates/uses parent trailing space outside the child file.

## 2026-04-29 Inline Nested Boundaries

- Nested generated documents should not visually split the parent into separate top/bottom cards. Keep the parent as one continuous document flow and show child file identity only as a thin inline boundary.
- Cursor landing slots around embeds are interaction scaffolding only. They should remain present for keyboard navigation but collapse to near-invisible 2px transparent space unless focused.
- Short editor text segments should not reserve large default heights; compact auto-height textareas make parent text, child embeds, and resumed parent text read as a single continuous document.

## 2026-04-29 Explorer Tree And Bottom Navigation

- Explorer should be a path tree, not flat cards. Root `document.md` remains at the top level; generated files under `document/*.md` appear inside a `document` folder with compact row actions.
- `ArrowDown` at the final editable block should not create a new blank line. Creating lines is Enter's job; bottom cursor movement should simply stop when there is no next editable block.
- Empty embed landing gaps can still appear when focused for navigation, but Backspace on an empty gap should collapse it by moving focus back to the previous editor without mutating document content.

## 2026-04-29 Parent Tail Collapse And IME Safety

- When the lower parent text segment after an embedded child becomes empty, remove that text segment from the source and move focus back to the previous child editor. Do not leave a visible or editable bottom parent gap behind.
- Custom ArrowUp/ArrowDown/Backspace behavior must ignore IME composition events (`isComposing`, `keyCode 229`, or `Process`) so partially composed Korean text is not carried across blocks or duplicated during vertical cursor movement.

## 2026-04-29 Slot To Text Focus Continuity

- When typing the first character into an empty parent gap slot, the slot is replaced by a real text segment. Capture the slot's editor index and caret before updating source, then restore focus to the new editor at the same index after render.
- Regression to avoid: first character appears, then focus is lost so following keystrokes are ignored until the user clicks the new lower-parent editor.

## 2026-04-29 Empty Lower Parent Collapse Threshold

- Correction to the previous lower-parent collapse behavior: deleting the last character should leave an empty text editor active so the user can immediately rewrite from blank.
- Collapse the lower parent segment only when the text editor is already empty and the user presses Backspace or Delete again. Selection deletion or normal change-to-empty should not collapse.

## 2026-04-29 Explorer Self-Drop Guard

- Explorer is now an explicit dnd-kit droppable (`library-drop`) so dragging a file handle and dropping it back into the left tree is absorbed by Explorer instead of adding another embed.
- Document embed insertion should only happen when `getDocumentDropPath` sees a `library-file` dropped on the dedicated `document-drop` surface.
- DnD collision detection is pointer-first (`pointerWithin` with `rectIntersection` fallback) so the drop target follows the cursor location, not a draggable rectangle overlapping the editor.

## 2026-04-29 Explorer Reorder And IME Slot Guard

- Explorer file handles are now sortable for root embed order. Dragging an embedded file over another embedded file previews `moveEmbedPath` order in the editor/preview and commits on drop.
- During a handle drag, the active Markdown file path should be highlighted in Explorer, its editor wrapper, and its rendered preview segment.
- `--앷--` is a supported document-block delimiter alongside `--doc--`.
- Empty slot editors defer source mutation until IME composition ends, then suppress a duplicate final change event so the first Korean syllable is not split or inserted twice.

## 2026-04-29 Synchronous Slot Focus For Korean IME

- Regression: after a slot converted into a real text editor, Korean second syllables could disappear because focus restoration waited for `requestAnimationFrame`.
- Fix pattern: when a slot commits text, wrap the source update in `flushSync` and focus the newly mounted textarea immediately at the original caret offset so the next IME composition starts in the real editor.

## 2026-04-29 Defer All IME Source Writes

- Korean input can still lose a middle syllable (`가나다` -> `가다`) if normal text editors write partial composition values such as `가ㄴ` back into the controlled source.
- Treat every `MarkdownTextEditor`, not only slots, as draft-controlled during IME composition: update local draft on change, defer source mutation until `compositionend`, and ignore the duplicate final change event.

## 2026-04-29 Uncontrolled Textareas For IME Stability

- React-controlled textarea values can still overwrite native Korean IME buffers during rapid composition, even when source writes are deferred.
- Document textareas should be uncontrolled (`defaultValue`) while focused; sync external source values imperatively only when the DOM value differs and IME composition is inactive.
- Keep delimiter expansion synced by allowing non-composing active textareas to be overwritten when their source value intentionally transforms, e.g. `--doc--` into embedded sections.

## 2026-04-29 Idle Slot Promotion For Korean IME

- The second Korean syllable can still disappear if an empty slot is promoted to a real text segment immediately after the first syllable; the next syllable may begin composition on the disappearing slot.
- Empty slots now keep their textarea mounted while the user is actively typing/composing and promote to a real text segment only after a short idle delay. This preserves multi-syllable Korean input such as `가나다` before source insertion.

## 2026-04-29 Editor Title Handles And Shared References

- Embedded editor file titles are now draggable reorder handles, not just labels. Use per-wrapper instance ids for editor title drop targets while carrying the file path in DnD data.
- Editor title drags should only reorder existing references. Mark drag origin as `editor` and block document-surface insertion so title handles cannot accidentally create another shared reference.
- Explorer's former `+` action was ambiguous because it inserted another shared embed reference, not a physical file copy. Keep the shared-reference model, but present it with a link/reference affordance instead of a duplicate-looking plus.
- Renaming an embedded Markdown file must update every `![[path]]` reference in the root document and in other Markdown files, because virtual paths are the durable identity used by embed resolution.

## 2026-04-30 Reference Removal UX

- If the UI can insert shared references, it also needs a matching removal affordance. Do not delete the Markdown file; remove only the embed reference.
- Explorer unlink removes the latest root-document reference for that file. Editor-wrapper unlink removes that exact embed instance, including nested parent-file references.

## 2026-04-30 Stable Editor Title Drag Placement

- Editor title drag must not use live rendered-source reordering as its preview. Re-rendering the dragged/target wrappers under the pointer can cause an oscillating swap loop.
- Move embedded documents by exact reference identity: `{path, sourceOwnerPath, sourceLine}` to `{targetOwnerPath, insertAtLineIndex}`. Path-only reorder is insufficient when the same file is referenced multiple times or inside nested parents.
- Parent documents expose thin insertion targets plus text-area line targets so a child document can be moved into the middle of parent content, not only before/after another child wrapper.
