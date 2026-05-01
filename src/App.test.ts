import { describe, expect, it } from 'vitest';
import { getDocumentDropPath, getDocumentPlacementDrop, getLibraryReorderDrop, getLibraryReorderPreviewSource } from './App';
import { DOCUMENT_DROP_ID, LIBRARY_DROP_ID, getEditorFileDropId, getLibraryFileDropId } from './lib/dnd';
import type { DragEndEvent } from '@dnd-kit/core';

function dragEnd(overId: string | null): Pick<DragEndEvent, 'active' | 'over'> {
  return {
    active: {
      data: {
        current: { type: 'library-file', origin: 'library', path: 'document/child.md' }
      }
    },
    over: overId ? { id: overId, data: { current: {} } } : null
  } as unknown as Pick<DragEndEvent, 'active' | 'over'>;
}

function reorderDragEnd(targetPath: string): Pick<DragEndEvent, 'active' | 'over'> {
  return {
    active: {
      data: {
        current: { type: 'library-file', origin: 'library', path: 'a.md' }
      }
    },
    over: {
      id: getLibraryFileDropId('b'),
      data: {
        current: { type: 'library-file', path: targetPath }
      }
    }
  } as unknown as Pick<DragEndEvent, 'active' | 'over'>;
}

function editorReorderDragEnd(targetPath: string): Pick<DragEndEvent, 'active' | 'over'> {
  return {
    active: {
      data: {
        current: { type: 'library-file', origin: 'editor', path: 'a.md' }
      }
    },
    over: {
      id: getEditorFileDropId('editor-b'),
      data: {
        current: { type: 'document-file-target', ownerPath: 'document.md', line: 4, path: targetPath }
      }
    }
  } as unknown as Pick<DragEndEvent, 'active' | 'over'>;
}

describe('getDocumentDropPath', () => {
  it('adds embeds only when a library file is dropped on the document surface', () => {
    expect(getDocumentDropPath(dragEnd(DOCUMENT_DROP_ID))).toBe('document/child.md');
  });

  it('ignores drops back onto the library surface', () => {
    expect(getDocumentDropPath(dragEnd(LIBRARY_DROP_ID))).toBeNull();
  });

  it('ignores drops without a target', () => {
    expect(getDocumentDropPath(dragEnd(null))).toBeNull();
  });

  it('does not add another reference when an editor title handle lands on the document surface', () => {
    expect(
      getDocumentDropPath({
        active: {
          data: {
            current: { type: 'library-file', origin: 'editor', path: 'document/child.md' }
          }
        },
        over: { id: DOCUMENT_DROP_ID, data: { current: {} } }
      } as unknown as Pick<DragEndEvent, 'active' | 'over'>)
    ).toBeNull();
  });

  it('detects sortable library-to-library drops', () => {
    expect(getLibraryReorderDrop(reorderDragEnd('b.md'))).toEqual({ movingPath: 'a.md', targetPath: 'b.md' });
  });

  it('previews the root document order while dragging over another library file', () => {
    expect(getLibraryReorderPreviewSource('![[a.md]]\n![[b.md]]\n![[c.md]]', reorderDragEnd('b.md'))).toBe(
      '![[b.md]]\n![[a.md]]\n![[c.md]]'
    );
  });

  it('does not treat editor title drops as live reorder preview targets', () => {
    expect(getLibraryReorderDrop(editorReorderDragEnd('b.md'))).toBeNull();
  });

  it('detects editor title drops as document placement targets', () => {
    expect(
      getDocumentPlacementDrop({
        active: {
          data: {
            current: { type: 'library-file', origin: 'editor', path: 'a.md', sourceOwnerPath: 'document.md', sourceLine: 2 }
          }
        },
        over: {
          id: getEditorFileDropId('editor-b'),
          data: {
            current: { type: 'document-file-target', ownerPath: 'document.md', line: 4, path: 'b.md' }
          }
        },
        activatorEvent: new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
        delta: { x: 0, y: 0 }
      } as unknown as Parameters<typeof getDocumentPlacementDrop>[0])
    ).toEqual({
      origin: 'editor',
      path: 'a.md',
      ownerPath: 'document.md',
      insertAtLineIndex: 3,
      fromOwnerPath: 'document.md',
      fromLine: 2
    });
  });

  it('detects insertion-line drops as arbitrary document placement targets', () => {
    expect(
      getDocumentPlacementDrop({
        active: {
          data: {
            current: { type: 'library-file', origin: 'library', path: 'a.md' }
          }
        },
        over: {
          id: 'editor-insert:document.md:2',
          data: {
            current: { type: 'document-insertion-target', ownerPath: 'document.md', insertAtLineIndex: 2 }
          }
        },
        activatorEvent: new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
        delta: { x: 0, y: 0 }
      } as unknown as Parameters<typeof getDocumentPlacementDrop>[0])
    ).toMatchObject({
      origin: 'library',
      path: 'a.md',
      ownerPath: 'document.md',
      insertAtLineIndex: 2
    });
  });
});
