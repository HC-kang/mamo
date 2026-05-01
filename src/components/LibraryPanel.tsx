import { useRef, useState, type CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  Download,
  FilePenLine,
  FilePlus2,
  FileText,
  Folder,
  GripVertical,
  Link2,
  Search,
  Unlink2,
  Upload
} from 'lucide-react';
import type { MarkdownFile } from '../types';
import { getEmbedReferences } from '../lib/embedParser';
import { LIBRARY_DROP_ID, getLibraryFileDropId } from '../lib/dnd';
import { downloadMarkdown } from '../lib/importExport';
import { selectMetaTitle, useWorkbenchStore } from '../store/workbenchStore';

interface LibraryPanelProps {
  activeDragPath?: string | null;
  onImportClick: () => void;
  onCreateNote: () => void;
}

interface RootDocumentFile {
  id: string;
  path: string;
  name: string;
  content: string;
  title: string;
}

type ExplorerFile = { type: 'document'; file: RootDocumentFile } | { type: 'markdown'; file: MarkdownFile };

type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

interface FileTreeFolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: FileTreeNode[];
}

interface FileTreeFileNode {
  type: 'file';
  name: string;
  path: string;
  file: ExplorerFile;
}

export function LibraryPanel({ activeDragPath = null, onImportClick, onCreateNote }: LibraryPanelProps) {
  const files = useWorkbenchStore((state) => state.files);
  const metaSource = useWorkbenchStore((state) => state.metaSource);
  const setMetaSource = useWorkbenchStore((state) => state.setMetaSource);
  const importFiles = useWorkbenchStore((state) => state.importFiles);
  const addEmbed = useWorkbenchStore((state) => state.addEmbed);
  const removeLastEmbedPath = useWorkbenchStore((state) => state.removeLastEmbedPath);
  const updateFileContent = useWorkbenchStore((state) => state.updateFileContent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isFileDragging, setIsFileDragging] = useState(false);
  const { setNodeRef: setLibraryDropRef, isOver: isLibraryDropOver } = useDroppable({ id: LIBRARY_DROP_ID });
  const dragDepthRef = useRef(0);
  const documentFile = {
    id: 'document',
    path: 'document.md',
    name: 'document.md',
    content: metaSource,
    title: selectMetaTitle(metaSource)
  };
  const visibleFileCount = files.length + 1;
  const normalizedQuery = query.trim().toLowerCase();
  const documentMatches =
    normalizedQuery.length === 0 ||
    documentFile.path.toLowerCase().includes(normalizedQuery) ||
    documentFile.title.toLowerCase().includes(normalizedQuery) ||
    documentFile.content.toLowerCase().includes(normalizedQuery);
  const filteredFiles = files.filter((file) => {
    const normalizedQuery = query.trim().toLowerCase();
    return (
      normalizedQuery.length === 0 ||
      file.path.toLowerCase().includes(normalizedQuery) ||
      file.content.toLowerCase().includes(normalizedQuery)
    );
  });
  const orderedFiles = orderFilesByDocument(filteredFiles, metaSource);
  const sortableFileIds = orderedFiles.map((file) => getLibraryFileDropId(file.id));
  const referenceCounts = countEmbedReferencesByPath(metaSource);
  const treeFiles: ExplorerFile[] = [
    ...(documentMatches ? [{ type: 'document' as const, file: documentFile }] : []),
    ...orderedFiles.map((file) => ({ type: 'markdown' as const, file }))
  ];
  const tree = buildFileTree(treeFiles);
  const toggleEditing = (id: string) => setEditingId((current) => (current === id ? null : id));

  const handleDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (!isFileTransfer(event)) {
      return;
    }

    dragDepthRef.current += 1;
    setIsFileDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (!isFileTransfer(event)) {
      return;
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsFileDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!isFileTransfer(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsFileDragging(false);
    await importFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <section
      ref={setLibraryDropRef}
      className={`panel library-panel ${isFileDragging ? 'is-file-dragging' : ''} ${
        isLibraryDropOver ? 'is-dnd-over' : ''
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="panel-header">
        <div>
          <h2>Explorer</h2>
          <span>{formatFileCount(visibleFileCount)}</span>
        </div>
        <div className="panel-actions">
          <button type="button" className="icon-only" onClick={onImportClick} title="Open Markdown">
            <Upload aria-hidden="true" />
          </button>
          <button type="button" className="icon-only" onClick={onCreateNote} title="New quick note">
            <FilePlus2 aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="panel-toolbar">
        <div className="search-field">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files" />
        </div>
        <button type="button" className="compact-action" onClick={onImportClick}>
          Open
        </button>
      </div>

      <div className="file-list" aria-label="Markdown file library">
        {tree.length > 0 ? (
          <SortableContext items={sortableFileIds} strategy={verticalListSortingStrategy}>
            <div className="file-tree" role="tree">
              {tree.map((node) => (
                <FileTreeNodeView
                  key={getTreeNodeKey(node)}
                  node={node}
                  depth={0}
                  activeDragPath={activeDragPath}
                  editingId={editingId}
                  onEdit={toggleEditing}
                  onAdd={addEmbed}
                  onRemoveReference={removeLastEmbedPath}
                  referenceCounts={referenceCounts}
                  onUpdateDocument={setMetaSource}
                  onUpdateFile={updateFileContent}
                />
              ))}
            </div>
          </SortableContext>
        ) : (
          <p className="empty-state">No files match the filter.</p>
        )}
      </div>
    </section>
  );
}

function isFileTransfer(event: React.DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function formatFileCount(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}

interface FileTreeNodeViewProps {
  node: FileTreeNode;
  depth: number;
  activeDragPath: string | null;
  editingId: string | null;
  onEdit: (id: string) => void;
  onAdd: (path: string) => void;
  onRemoveReference: (path: string) => void;
  referenceCounts: Map<string, number>;
  onUpdateDocument: (content: string) => void;
  onUpdateFile: (id: string, content: string) => void;
}

function FileTreeNodeView({
  node,
  depth,
  activeDragPath,
  editingId,
  onEdit,
  onAdd,
  onRemoveReference,
  referenceCounts,
  onUpdateDocument,
  onUpdateFile
}: FileTreeNodeViewProps) {
  if (node.type === 'folder') {
    return (
      <div className="tree-folder" role="group">
        <div className="tree-folder-row" role="treeitem" style={getTreeDepthStyle(depth)}>
          <ChevronDown className="tree-toggle-icon" aria-hidden="true" />
          <Folder className="tree-folder-icon" aria-hidden="true" />
          <span>{node.name}</span>
        </div>
        {node.children.map((child) => (
          <FileTreeNodeView
            key={getTreeNodeKey(child)}
            node={child}
            depth={depth + 1}
            activeDragPath={activeDragPath}
            editingId={editingId}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemoveReference={onRemoveReference}
            referenceCounts={referenceCounts}
            onUpdateDocument={onUpdateDocument}
            onUpdateFile={onUpdateFile}
          />
        ))}
      </div>
    );
  }

  if (node.file.type === 'document') {
    return (
      <DocumentTreeFileItem
        file={node.file.file}
        depth={depth}
        isEditing={editingId === node.file.file.id}
        onEdit={() => onEdit(node.file.file.id)}
        onUpdate={onUpdateDocument}
      />
    );
  }

  return (
    <LibraryTreeFileItem
      file={node.file.file}
      depth={depth}
      isActiveDrag={activeDragPath === node.file.file.path}
      isEditing={editingId === node.file.file.id}
      referenceCount={referenceCounts.get(node.file.file.path) ?? 0}
      onAdd={() => onAdd(node.file.file.path)}
      onRemoveReference={() => onRemoveReference(node.file.file.path)}
      onEdit={() => onEdit(node.file.file.id)}
      onUpdate={(content) => onUpdateFile(node.file.file.id, content)}
    />
  );
}

interface DocumentTreeFileItemProps {
  file: RootDocumentFile;
  depth: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (content: string) => void;
}

function DocumentTreeFileItem({ file, depth, isEditing, onEdit, onUpdate }: DocumentTreeFileItemProps) {
  const snippet = getSnippet(file.content);

  return (
    <article className="tree-file-row is-root-file" role="treeitem">
      <div className="tree-file-main" style={getTreeDepthStyle(depth)}>
        <span className="file-kind-icon" aria-hidden="true">
          <FileText />
        </span>
        <div className="file-text tree-file-text">
          <div className="file-title-row">
            <strong>{file.name}</strong>
            <span className="badge">current</span>
          </div>
          <div className="tree-file-subline">
            <code>{file.path}</code>
          </div>
          {snippet ? <p>{snippet}</p> : <p className="muted">Empty file</p>}
        </div>
        <div className="tree-actions">
          <button type="button" className="icon-only" onClick={onEdit} title="Edit Markdown">
            <FilePenLine aria-hidden="true" />
          </button>
          <button type="button" className="icon-only" onClick={() => downloadMarkdown(file.name, file.content)} title="Export file">
            <Download aria-hidden="true" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="tree-file-editor" style={getTreeEditorStyle(depth)}>
          <textarea
            className="file-editor"
            aria-label={`Edit ${file.path}`}
            value={file.content}
            onChange={(event) => onUpdate(event.target.value)}
          />
        </div>
      ) : null}
    </article>
  );
}

interface LibraryTreeFileItemProps {
  file: MarkdownFile;
  depth: number;
  isActiveDrag: boolean;
  isEditing: boolean;
  referenceCount: number;
  onAdd: () => void;
  onRemoveReference: () => void;
  onEdit: () => void;
  onUpdate: (content: string) => void;
}

function LibraryTreeFileItem({
  file,
  depth,
  isActiveDrag,
  isEditing,
  referenceCount,
  onAdd,
  onRemoveReference,
  onEdit,
  onUpdate
}: LibraryTreeFileItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: getLibraryFileDropId(file.id),
    data: { type: 'library-file', origin: 'library', path: file.path, fileId: file.id }
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const snippet = getSnippet(file.content);

  return (
    <article
      ref={setNodeRef}
      className={`tree-file-row ${isDragging ? 'is-dragging' : ''} ${isOver ? 'is-drop-target' : ''} ${
        isActiveDrag ? 'is-active-drag' : ''
      }`}
      style={style}
      role="treeitem"
    >
      <div className="tree-file-main" style={getTreeDepthStyle(depth)}>
        <button type="button" className="drag-handle" title="Drag or reorder document" {...listeners} {...attributes}>
          <GripVertical aria-hidden="true" />
        </button>
        <div className="file-text tree-file-text">
          <div className="file-title-row">
            <strong>{file.name}</strong>
            {file.dirty ? <span className="badge">dirty</span> : null}
          </div>
          <div className="tree-file-subline">
            <code>{file.path}</code>
            <span>{file.source}</span>
            {file.dirty ? <span className="dirty-dot">Unsaved</span> : null}
            {file.duplicateIndex ? <span>duplicate {file.duplicateIndex}</span> : null}
          </div>
          {snippet ? <p>{snippet}</p> : <p className="muted">Empty file</p>}
        </div>
        <div className="tree-actions">
          <button
            type="button"
            className="icon-only reference-action"
            onClick={onAdd}
            title="Insert shared reference into document"
          >
            <Link2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-only reference-remove-action"
            onClick={onRemoveReference}
            disabled={referenceCount === 0}
            title={referenceCount > 0 ? 'Remove latest reference from document' : 'No document reference to remove'}
          >
            <Unlink2 aria-hidden="true" />
          </button>
          <button type="button" className="icon-only" onClick={onEdit} title="Edit Markdown">
            <FilePenLine aria-hidden="true" />
          </button>
          <button type="button" className="icon-only" onClick={() => downloadMarkdown(file.name, file.content)} title="Export file">
            <Download aria-hidden="true" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="tree-file-editor" style={getTreeEditorStyle(depth)}>
          <textarea
            className="file-editor"
            aria-label={`Edit ${file.path}`}
            value={file.content}
            onChange={(event) => onUpdate(event.target.value)}
          />
        </div>
      ) : null}
    </article>
  );
}

function buildFileTree(files: ExplorerFile[]): FileTreeNode[] {
  const root: FileTreeFolderNode = { type: 'folder', name: '', path: '', children: [] };
  const folders = new Map<string, FileTreeFolderNode>();

  files.forEach((file) => {
    const path = getExplorerFilePath(file);
    const segments = path.split('/').filter(Boolean);
    const name = getExplorerFileName(file);
    let children = root.children;
    let folderPath = '';

    segments.slice(0, -1).forEach((segment) => {
      folderPath = folderPath.length > 0 ? `${folderPath}/${segment}` : segment;
      let folder = folders.get(folderPath);

      if (!folder) {
        folder = { type: 'folder', name: segment, path: folderPath, children: [] };
        folders.set(folderPath, folder);
        children.push(folder);
      }

      children = folder.children;
    });

    children.push({ type: 'file', name, path, file });
  });

  return root.children;
}

function getExplorerFilePath(file: ExplorerFile): string {
  return file.file.path;
}

function getExplorerFileName(file: ExplorerFile): string {
  return file.file.name;
}

function getTreeNodeKey(node: FileTreeNode): string {
  return `${node.type}:${node.path}`;
}

function getTreeDepthStyle(depth: number): CSSProperties {
  return { paddingLeft: 8 + depth * 16 };
}

function getTreeEditorStyle(depth: number): CSSProperties {
  return { marginLeft: 38 + depth * 16 };
}

function getSnippet(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function orderFilesByDocument(files: MarkdownFile[], source: string): MarkdownFile[] {
  const originalIndex = new Map(files.map((file, index) => [file.path, index]));
  const documentOrder = new Map<string, number>();

  getEmbedReferences(source).forEach((ref, index) => {
    if (!documentOrder.has(ref.path)) {
      documentOrder.set(ref.path, index);
    }
  });

  return [...files].sort((left, right) => {
    const leftOrder = documentOrder.get(left.path);
    const rightOrder = documentOrder.get(right.path);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) {
      return -1;
    }

    if (rightOrder !== undefined) {
      return 1;
    }

    return (originalIndex.get(left.path) ?? 0) - (originalIndex.get(right.path) ?? 0);
  });
}

function countEmbedReferencesByPath(source: string): Map<string, number> {
  const counts = new Map<string, number>();

  getEmbedReferences(source).forEach((ref) => {
    counts.set(ref.path, (counts.get(ref.path) ?? 0) + 1);
  });

  return counts;
}
