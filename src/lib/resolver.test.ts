import { describe, expect, it } from 'vitest';
import type { MarkdownFile } from '../types';
import { resolveRenderedMarkdown } from './resolver';

function file(path: string, content: string): MarkdownFile {
  return {
    id: path,
    path,
    name: path.split('/').at(-1) ?? path,
    content,
    source: 'imported',
    dirty: false
  };
}

describe('resolveRenderedMarkdown', () => {
  it('resolves nested embeds with boundary comments', () => {
    const files = new Map([
      ['section.md', file('section.md', '# Section\n\n![[note.md]]')],
      ['note.md', file('note.md', 'Note body')]
    ]);

    const rendered = resolveRenderedMarkdown('# Article\n\n![[section.md]]', files, { rootPath: 'article.md' });

    expect(rendered).toContain('<!-- Begin embed: section.md -->');
    expect(rendered).toContain('# Section');
    expect(rendered).toContain('<!-- Begin embed: note.md -->');
    expect(rendered).toContain('Note body');
  });

  it('keeps duplicate references in rendered output', () => {
    const files = new Map([['summary.md', file('summary.md', 'Summary')]]);
    const rendered = resolveRenderedMarkdown('![[summary.md]]\n![[summary.md]]', files);

    expect(rendered.match(/Begin embed: summary\.md/g)).toHaveLength(2);
  });

  it('reports missing, circular, unsupported, and max-depth embeds without crashing', () => {
    const circularFiles = new Map([
      ['a.md', file('a.md', '![[b.md]]')],
      ['b.md', file('b.md', '![[a.md]]')]
    ]);

    expect(resolveRenderedMarkdown('![[missing.md]]', new Map())).toContain('Missing embed: missing.md');
    expect(resolveRenderedMarkdown('![[a.md#Heading]]', new Map())).toContain('Unsupported embed syntax: a.md#Heading');
    expect(resolveRenderedMarkdown('![[a.md]]', circularFiles, { rootPath: 'root.md' })).toContain(
      'Circular embed detected: root.md -> a.md -> b.md -> a.md'
    );
    expect(resolveRenderedMarkdown('![[a.md]]', circularFiles, { maxDepth: 1 })).toContain('Max embed depth exceeded: b.md');
  });
});
