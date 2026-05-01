import { describe, expect, it } from 'vitest';
import {
  createQuickNotePath,
  createVirtualPath,
  disambiguateVirtualPath,
  importMarkdownFiles,
  isMarkdownFile
} from './importExport';

describe('import/export helpers', () => {
  it('creates virtual paths from browser relative paths before filenames', () => {
    expect(createVirtualPath({ name: 'note.md', webkitRelativePath: 'folder/note.md' })).toBe('folder/note.md');
    expect(createVirtualPath({ name: 'note.md' })).toBe('note.md');
  });

  it('supports markdown extensions and disambiguates duplicate paths', () => {
    expect(isMarkdownFile('a.md')).toBe(true);
    expect(isMarkdownFile('a.markdown')).toBe(true);
    expect(isMarkdownFile('a.png')).toBe(false);

    const used = new Set(['notes/a.md', 'notes/a (2).md']);
    expect(disambiguateVirtualPath('notes/a.md', used)).toEqual({ path: 'notes/a (3).md', duplicateIndex: 3 });
  });

  it('imports only markdown files with unique virtual paths', async () => {
    const files = [
      new File(['A'], 'a.md', { type: 'text/markdown' }),
      new File(['B'], 'a.md', { type: 'text/markdown' }),
      new File(['PNG'], 'image.png', { type: 'image/png' })
    ];

    const imported = await importMarkdownFiles(files);

    expect(imported.map((file) => file.path)).toEqual(['a.md', 'a (2).md']);
    expect(imported.map((file) => file.content)).toEqual(['A', 'B']);
  });

  it('generates timestamped quick note paths', () => {
    expect(createQuickNotePath(new Date('2026-04-28T14:30:12'))).toBe('inbox/2026-04-28-143012.md');
  });
});
