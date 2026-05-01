import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryPanel } from './LibraryPanel';
import { initialMetaSource, useWorkbenchStore } from '../store/workbenchStore';
import type { MarkdownFile } from '../types';

function file(path: string, content: string): MarkdownFile {
  return {
    id: path,
    path,
    name: path.split('/').at(-1) ?? path,
    content,
    source: 'generated',
    dirty: true
  };
}

describe('LibraryPanel', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({ files: [], metaSource: initialMetaSource, currentMetaPath: null });
  });

  it('shows the current root document even before external files are opened', () => {
    render(<LibraryPanel onImportClick={() => undefined} onCreateNote={() => undefined} />);

    expect(screen.getAllByText('document.md')).toHaveLength(2);
    expect(screen.getByText('1 file')).toBeInTheDocument();
    expect(screen.queryByText('No Markdown files open.')).not.toBeInTheDocument();
  });

  it('groups markdown files into a path tree', () => {
    useWorkbenchStore.setState({
      files: [file('document/child.md', '# Child'), file('notes/deep/idea.md', '# Idea')],
      metaSource: initialMetaSource,
      currentMetaPath: null
    });

    render(<LibraryPanel onImportClick={() => undefined} onCreateNote={() => undefined} />);

    expect(screen.getByText('document')).toBeInTheDocument();
    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('deep')).toBeInTheDocument();
    expect(screen.getByText('child.md')).toBeInTheDocument();
    expect(screen.getByText('idea.md')).toBeInTheDocument();
  });

  it('removes the latest document reference from the explorer row without deleting the file', () => {
    useWorkbenchStore.setState({
      files: [file('document/child.md', '# Child')],
      metaSource: '# Root\n\n![[document/child.md]]\n![[document/child.md]]',
      currentMetaPath: null
    });

    render(<LibraryPanel onImportClick={() => undefined} onCreateNote={() => undefined} />);

    fireEvent.click(screen.getByTitle('Remove latest reference from document'));

    const state = useWorkbenchStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.metaSource).toBe('# Root\n\n![[document/child.md]]');
  });
});
