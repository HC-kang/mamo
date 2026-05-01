import { useMemo, useRef, useState } from 'react';
import {
  type CollisionDetection,
  DndContext,
  type DragCancelEvent,
  DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  BoxSelect,
  Command,
  Download,
  Eye,
  FilePlus2,
  Files,
  FolderOpen
} from 'lucide-react';
import { LibraryPanel } from './components/LibraryPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { QuickNoteDialog } from './components/QuickNoteDialog';
import {
  DOCUMENT_DROP_ID,
  LIBRARY_FILE_DROP_PREFIX,
  isEditorDocumentDropId,
  isFileReorderDropId,
  isLibraryFileDropId
} from './lib/dnd';
import { moveEmbedPath } from './lib/embedParser';
import { downloadMarkdown } from './lib/importExport';
import { resolveRenderedMarkdown } from './lib/resolver';
import { selectFileMap, selectMetaTitle, useWorkbenchStore } from './store/workbenchStore';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragPreviewSource, setDragPreviewSource] = useState<string | null>(null);
  const files = useWorkbenchStore((state) => state.files);
  const metaSource = useWorkbenchStore((state) => state.metaSource);
  const importFiles = useWorkbenchStore((state) => state.importFiles);
  const addEmbed = useWorkbenchStore((state) => state.addEmbed);
  const insertEmbedReference = useWorkbenchStore((state) => state.insertEmbedReference);
  const moveEmbedReference = useWorkbenchStore((state) => state.moveEmbedReference);
  const moveEmbed = useWorkbenchStore((state) => state.moveEmbedPath);
  const fileMap = useMemo(() => selectFileMap(files), [files]);
  const metaTitle = selectMetaTitle(metaSource);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files;

    if (selected) {
      await importFiles(Array.from(selected));
      event.currentTarget.value = '';
    }
  };

  const handleExportRendered = () => {
    const rendered = resolveRenderedMarkdown(metaSource, fileMap, {
      rootPath: `${slugify(metaTitle)}.md`,
      includeBoundaryMarkers: true
    });
    downloadMarkdown(`${slugify(metaTitle)}.rendered.md`, rendered);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedPath(getActiveLibraryPath(event.active));
    setDragPreviewSource(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setDraggedPath(getActiveLibraryPath(event.active));
    setDragPreviewSource(getActiveLibraryOrigin(event.active) === 'editor' ? null : getLibraryReorderPreviewSource(metaSource, event));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    setDraggedPath(getActiveLibraryPath(event.active));
  };

  const resetDragState = (_event?: DragCancelEvent | DragEndEvent) => {
    setDraggedPath(null);
    setDragPreviewSource(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const placement = getDocumentPlacementDrop(event);

    if (placement) {
      if (placement.origin === 'editor') {
        moveEmbedReference({
          path: placement.path,
          fromOwnerPath: placement.fromOwnerPath,
          fromLine: placement.fromLine,
          toOwnerPath: placement.ownerPath,
          insertAtLineIndex: placement.insertAtLineIndex
        });
      } else {
        insertEmbedReference(placement.ownerPath, placement.path, placement.insertAtLineIndex);
      }

      resetDragState(event);
      return;
    }

    const reorder = getLibraryReorderDrop(event);

    if (reorder) {
      moveEmbed(reorder.movingPath, reorder.targetPath);
      resetDragState(event);
      return;
    }

    const path = getDocumentDropPath(event);

    if (path) {
      addEmbed(path);
    }

    resetDragState(event);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={workbenchCollisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragCancel={resetDragState}
      onDragEnd={handleDragEnd}
    >
      <div className="app-shell">
        <header className="titlebar">
          <div className="window-controls" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="workspace-brand">
            <BoxSelect aria-hidden="true" />
            <div>
              <p className="eyebrow">Markdown Workbench</p>
              <h1>{metaTitle}</h1>
            </div>
          </div>
          <div className="command-bar" aria-label="Current workspace command bar">
            <Command aria-hidden="true" />
            <span>Edit many Markdown files as one document</span>
          </div>
          <div className="titlebar-actions">
            <button type="button" className="tool-button" onClick={() => fileInputRef.current?.click()} title="Open Markdown">
              <FolderOpen aria-hidden="true" />
              <span>Open</span>
            </button>
            <button type="button" className="tool-button" onClick={() => setQuickNoteOpen(true)} title="New quick note">
              <FilePlus2 aria-hidden="true" />
              <span>Note</span>
            </button>
            <button type="button" className="tool-button primary" onClick={handleExportRendered} title="Export rendered Markdown">
              <Download aria-hidden="true" />
              <span>Export</span>
            </button>
          </div>
        </header>

        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".md,.markdown,text/markdown"
          multiple
          onChange={handleFileInput}
        />

        <div className="workbench-frame">
          <aside className="activity-rail" aria-label="Workbench sections">
            <button type="button" className="activity-button is-active" title="Explorer">
              <Files aria-hidden="true" />
            </button>
            <button type="button" className="activity-button" title="Document">
              <Eye aria-hidden="true" />
            </button>
          </aside>

          <main className="workbench-grid">
            <LibraryPanel
              activeDragPath={draggedPath}
              onImportClick={() => fileInputRef.current?.click()}
              onCreateNote={() => setQuickNoteOpen(true)}
            />
            <PreviewPanel highlightPath={draggedPath} metaSourceOverride={dragPreviewSource} />
          </main>
        </div>

        <footer className="statusbar">
          <span>{formatFileCount(files.length + 1)}</span>
          <span>Seamless document</span>
          <span>Browser-only</span>
        </footer>

        {quickNoteOpen ? <QuickNoteDialog onClose={() => setQuickNoteOpen(false)} /> : null}
      </div>
    </DndContext>
  );
}

const workbenchCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  const documentDropCollisions = collisions.filter((collision) => isEditorDocumentDropId(collision.id));
  const libraryFileCollisions = collisions.filter((collision) => isLibraryFileDropId(collision.id));

  if (documentDropCollisions.length > 0) {
    return documentDropCollisions;
  }

  return libraryFileCollisions.length > 0 ? libraryFileCollisions : collisions;
};

interface DocumentPlacementDrop {
  origin: 'library' | 'editor';
  path: string;
  ownerPath: string;
  insertAtLineIndex: number;
  fromOwnerPath: string;
  fromLine: number;
}

export function getDocumentDropPath(event: Pick<DragEndEvent, 'active' | 'over'>): string | null {
  if (event.over?.id !== DOCUMENT_DROP_ID) {
    return null;
  }

  const activeData = event.active.data.current;

  if (activeData?.type !== 'library-file' || activeData.origin === 'editor' || typeof activeData.path !== 'string') {
    return null;
  }

  return activeData.path;
}

export function getLibraryReorderDrop(
  event: Pick<DragEndEvent | DragOverEvent, 'active' | 'over'>
): { movingPath: string; targetPath: string } | null {
  const movingPath = getActiveLibraryPath(event.active);
  const targetPath = getOverLibraryPath(event.over);

  if (!movingPath || !targetPath || movingPath === targetPath) {
    return null;
  }

  return { movingPath, targetPath };
}

export function getDocumentPlacementDrop(
  event: Pick<DragEndEvent | DragOverEvent, 'active' | 'over' | 'activatorEvent' | 'delta'>
): DocumentPlacementDrop | null {
  const activeData = event.active.data.current;

  if (activeData?.type !== 'library-file' || typeof activeData.path !== 'string') {
    return null;
  }

  const overData = event.over?.data.current;

  if (!overData || typeof overData.ownerPath !== 'string') {
    return null;
  }

  if (overData.ownerPath === activeData.path) {
    return null;
  }

  const insertAtLineIndex = getPlacementInsertAtLineIndex(overData, event);

  if (insertAtLineIndex === null) {
    return null;
  }

  if (activeData.origin === 'editor') {
    if (typeof activeData.sourceOwnerPath !== 'string' || typeof activeData.sourceLine !== 'number') {
      return null;
    }

    return {
      origin: 'editor',
      path: activeData.path,
      ownerPath: overData.ownerPath,
      insertAtLineIndex,
      fromOwnerPath: activeData.sourceOwnerPath,
      fromLine: activeData.sourceLine
    };
  }

  if (activeData.origin !== 'library') {
    return null;
  }

  return {
    origin: 'library',
    path: activeData.path,
    ownerPath: overData.ownerPath,
    insertAtLineIndex,
    fromOwnerPath: '',
    fromLine: 0
  };
}

export function getLibraryReorderPreviewSource(
  source: string,
  event: Pick<DragEndEvent | DragOverEvent, 'active' | 'over'>
): string | null {
  const reorder = getLibraryReorderDrop(event);

  if (!reorder) {
    return null;
  }

  const nextSource = moveEmbedPath(source, reorder.movingPath, reorder.targetPath);
  return nextSource === source ? null : nextSource;
}

function getActiveLibraryPath(active: Pick<DragEndEvent['active'], 'data'>): string | null {
  const activeData = active.data.current;

  if (activeData?.type !== 'library-file' || typeof activeData.path !== 'string') {
    return null;
  }

  return activeData.path;
}

function getActiveLibraryOrigin(active: Pick<DragEndEvent['active'], 'data'>): string | null {
  const activeData = active.data.current;
  return activeData?.type === 'library-file' && typeof activeData.origin === 'string' ? activeData.origin : null;
}

function getOverLibraryPath(over: Pick<NonNullable<DragEndEvent['over']>, 'id' | 'data'> | null): string | null {
  if (!over || !isFileReorderDropId(over.id)) {
    return null;
  }

  const overData = over.data.current;

  if (overData?.type === 'library-file' && typeof overData.path === 'string') {
    return overData.path;
  }

  const id = String(over.id);
  return id.startsWith(LIBRARY_FILE_DROP_PREFIX) ? id.slice(LIBRARY_FILE_DROP_PREFIX.length) : null;
}

function getPlacementInsertAtLineIndex(
  overData: NonNullable<DragEndEvent['over']>['data']['current'],
  event: Pick<DragEndEvent | DragOverEvent, 'activatorEvent' | 'delta'>
): number | null {
  if (overData?.type === 'document-insertion-target' && typeof overData.insertAtLineIndex === 'number') {
    return overData.insertAtLineIndex;
  }

  if (overData?.type === 'document-file-target' && typeof overData.line === 'number') {
    return overData.line - 1;
  }

  if (
    overData?.type === 'document-text-target' &&
    typeof overData.dropId === 'string' &&
    typeof overData.lineStart === 'number' &&
    typeof overData.lineEnd === 'number'
  ) {
    return getTextTargetInsertAtLineIndex(overData.dropId, overData.lineStart, overData.lineEnd, event);
  }

  return null;
}

function getTextTargetInsertAtLineIndex(
  dropId: string,
  lineStart: number,
  lineEnd: number,
  event: Pick<DragEndEvent | DragOverEvent, 'activatorEvent' | 'delta'>
): number {
  const element = document.querySelector<HTMLTextAreaElement>(`[data-text-drop-id="${CSS.escape(dropId)}"]`);
  const point = getDragPoint(event);
  const lineCount = Math.max(1, lineEnd - lineStart + 1);

  if (!element || !point) {
    return lineEnd;
  }

  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize) || 15;
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.62;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const relativeY = point.y - rect.top - paddingTop + element.scrollTop;
  const localLineIndex = Math.min(Math.max(Math.round(relativeY / lineHeight), 0), lineCount);

  return lineStart - 1 + localLineIndex;
}

function getDragPoint(event: Pick<DragEndEvent | DragOverEvent, 'activatorEvent' | 'delta'>): { x: number; y: number } | null {
  const activatorEvent = event.activatorEvent;

  if (
    'clientX' in activatorEvent &&
    'clientY' in activatorEvent &&
    typeof activatorEvent.clientX === 'number' &&
    typeof activatorEvent.clientY === 'number'
  ) {
    return {
      x: activatorEvent.clientX + event.delta.x,
      y: activatorEvent.clientY + event.delta.y
    };
  }

  return null;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug || 'untitled-document';
}

function formatFileCount(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}
