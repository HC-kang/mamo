import { describe, expect, it } from 'vitest';
import {
  addEmbedLine,
  duplicateEmbedAt,
  getEmbedReferences,
  insertEmbedAtLine,
  moveEmbedLine,
  parseMetaDocument,
  removeEmbedAt,
  removeLastEmbedPath,
  reorderEmbeds,
  setMetaTitle
} from './embedParser';

describe('parseMetaDocument', () => {
  it('parses supported file-level embeds and preserves markdown text', () => {
    const segments = parseMetaDocument(['# Design', '', '![[problem.md]]', '', '## Decision', '![[notes/decision.markdown]]'].join('\n'));

    expect(segments.map((segment) => segment.type)).toEqual(['text', 'embed', 'text', 'embed']);
    expect(segments[0]).toMatchObject({ type: 'text', content: '# Design\n' });
    expect(segments[1]).toMatchObject({ type: 'embed', path: 'problem.md', line: 3, index: 0 });
    expect(segments[3]).toMatchObject({ type: 'embed', path: 'notes/decision.markdown', line: 6, index: 1 });
  });

  it('marks empty, heading, alias, and non-markdown embeds as unsupported', () => {
    const segments = parseMetaDocument(['![[]]', '![[a.md#Heading]]', '![[a.md|Alias]]', '![[image.png]]'].join('\n'));

    expect(segments).toHaveLength(4);
    expect(segments.every((segment) => segment.type === 'unsupported')).toBe(true);
    expect(segments.map((segment) => (segment.type === 'unsupported' ? segment.reason : ''))).toEqual([
      'Empty embed target',
      'Heading or block embeds are not supported',
      'Embed aliases are not supported',
      'Only Markdown file embeds are supported'
    ]);
  });
});

describe('meta source transforms', () => {
  it('adds, removes, duplicates, reorders, and retitles embeds', () => {
    let source = '# Old\n';
    source = setMetaTitle(source, 'New');
    source = addEmbedLine(source, 'a.md');
    source = addEmbedLine(source, 'b.md');
    source = duplicateEmbedAt(source, 0);
    source = reorderEmbeds(source, 2, 0);
    source = removeEmbedAt(source, 1);

    expect(source).toContain('# New');
    expect(getEmbedReferences(source).map((ref) => ref.path)).toEqual(['b.md', 'a.md']);
  });

  it('removes the latest matching path reference', () => {
    const source = ['# Root', '', '![[a.md]]', '![[b.md]]', '![[a.md]]'].join('\n');

    expect(removeLastEmbedPath(source, 'a.md')).toBe(['# Root', '', '![[a.md]]', '![[b.md]]'].join('\n'));
  });

  it('inserts an embed at an arbitrary line index', () => {
    expect(insertEmbedAtLine(['# Root', 'Middle', 'Tail'].join('\n'), 'a.md', 2)).toBe(
      ['# Root', 'Middle', '![[a.md]]', 'Tail'].join('\n')
    );
  });

  it('moves a specific embed line to an arbitrary line index in the same document', () => {
    expect(moveEmbedLine(['# Root', '![[a.md]]', 'Middle', 'Tail'].join('\n'), 'a.md', 2, 4)).toBe(
      ['# Root', 'Middle', 'Tail', '![[a.md]]'].join('\n')
    );
  });
});
