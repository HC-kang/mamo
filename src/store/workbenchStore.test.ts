import { beforeEach, describe, expect, it } from 'vitest';
import { getEmbedReferences } from '../lib/embedParser';
import { initialMetaSource, useWorkbenchStore } from './workbenchStore';

describe('workbench store', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({ files: [], metaSource: initialMetaSource, currentMetaPath: null });
  });

  it('creates quick notes as generated dirty markdown files', () => {
    const note = useWorkbenchStore.getState().createQuickNote({
      title: 'Incident note',
      filename: 'inbox/incident',
      body: 'Body'
    });

    expect(note.path).toBe('inbox/incident.md');
    expect(note.content).toBe('# Incident note\n\nBody');
    expect(note.source).toBe('generated');
    expect(note.dirty).toBe(true);
  });

  it('creates generated document block files', () => {
    const block = useWorkbenchStore.getState().createDocumentBlock('# Block');

    expect(block.path).toMatch(/^document\/\d{8}-\d{6}-\d{3}\.md$/);
    expect(block.content).toBe('# Block');
    expect(block.source).toBe('generated');
    expect(block.dirty).toBe(true);
    expect(useWorkbenchStore.getState().files).toHaveLength(1);
  });

  it('keeps embed operations reflected in meta source', () => {
    const store = useWorkbenchStore.getState();
    store.addEmbed('a.md');
    store.addEmbed('b.md');
    store.addEmbed('c.md');
    useWorkbenchStore.getState().reorderEmbed(2, 0);
    useWorkbenchStore.getState().duplicateEmbed(1);
    useWorkbenchStore.getState().removeEmbed(2);

    expect(getEmbedReferences(useWorkbenchStore.getState().metaSource).map((ref) => ref.path)).toEqual([
      'c.md',
      'a.md',
      'b.md'
    ]);
  });

  it('moves an embedded file by path for explorer handle reordering', () => {
    useWorkbenchStore.setState({ files: [], metaSource: '# Root\n\n![[a.md]]\n![[b.md]]\n![[c.md]]', currentMetaPath: null });

    useWorkbenchStore.getState().moveEmbedPath('a.md', 'c.md');

    expect(getEmbedReferences(useWorkbenchStore.getState().metaSource).map((ref) => ref.path)).toEqual([
      'b.md',
      'c.md',
      'a.md'
    ]);
  });

  it('removes the latest root reference without deleting the markdown file', () => {
    useWorkbenchStore.setState({
      files: [
        {
          id: 'a',
          path: 'a.md',
          name: 'a.md',
          content: '# A',
          source: 'generated',
          dirty: false
        }
      ],
      metaSource: '# Root\n\n![[a.md]]\n![[a.md]]',
      currentMetaPath: null
    });

    useWorkbenchStore.getState().removeLastEmbedPath('a.md');

    const state = useWorkbenchStore.getState();
    expect(state.files).toHaveLength(1);
    expect(getEmbedReferences(state.metaSource).map((ref) => ref.path)).toEqual(['a.md']);
  });

  it('moves an exact embed reference to an arbitrary line in the same owner document', () => {
    useWorkbenchStore.setState({
      files: [],
      metaSource: '# Root\n![[a.md]]\nMiddle\nTail',
      currentMetaPath: null
    });

    useWorkbenchStore.getState().moveEmbedReference({
      path: 'a.md',
      fromOwnerPath: 'document.md',
      fromLine: 2,
      toOwnerPath: 'document.md',
      insertAtLineIndex: 4
    });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Root\nMiddle\nTail\n![[a.md]]');
  });

  it('moves an embed reference from the root document into a child document', () => {
    useWorkbenchStore.setState({
      files: [
        {
          id: 'parent',
          path: 'parent.md',
          name: 'parent.md',
          content: '# Parent\nTail',
          source: 'generated',
          dirty: false
        },
        {
          id: 'child',
          path: 'child.md',
          name: 'child.md',
          content: '# Child',
          source: 'generated',
          dirty: false
        }
      ],
      metaSource: '# Root\n![[child.md]]\n![[parent.md]]',
      currentMetaPath: null
    });

    useWorkbenchStore.getState().moveEmbedReference({
      path: 'child.md',
      fromOwnerPath: 'document.md',
      fromLine: 2,
      toOwnerPath: 'parent.md',
      insertAtLineIndex: 1
    });

    const state = useWorkbenchStore.getState();
    expect(state.metaSource).toBe('# Root\n![[parent.md]]');
    expect(state.files.find((file) => file.path === 'parent.md')?.content).toBe('# Parent\n![[child.md]]\nTail');
  });

  it('renames a markdown file and updates all embed references to that file', () => {
    useWorkbenchStore.setState({
      files: [
        {
          id: 'a',
          path: 'a.md',
          name: 'a.md',
          content: '# A\n\n![[b.md]]',
          source: 'generated',
          dirty: false
        },
        {
          id: 'b',
          path: 'b.md',
          name: 'b.md',
          content: '# B',
          source: 'generated',
          dirty: false
        }
      ],
      metaSource: '# Root\n\n![[a.md]]\n![[b.md]]',
      currentMetaPath: null
    });

    useWorkbenchStore.getState().renameFilePath('b', 'notes/renamed');

    const state = useWorkbenchStore.getState();
    expect(state.files.find((file) => file.id === 'b')?.path).toBe('notes/renamed.md');
    expect(state.files.find((file) => file.id === 'a')?.content).toBe('# A\n\n![[notes/renamed.md]]');
    expect(getEmbedReferences(state.metaSource).map((ref) => ref.path)).toEqual(['a.md', 'notes/renamed.md']);
  });
});
