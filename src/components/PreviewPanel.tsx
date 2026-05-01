import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode
} from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { flushSync } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { CircleAlert, FilePenLine, Unlink2 } from 'lucide-react';
import { getEditorFileDropId, getEditorInsertDropId, getEditorTextDropId } from '../lib/dnd';
import { parseMetaDocument } from '../lib/embedParser';
import { resolveRenderedMarkdown } from '../lib/resolver';
import { selectFileMap, useWorkbenchStore } from '../store/workbenchStore';
import type { MarkdownFile, MetaSegment, TextSegment } from '../types';

const MAX_DEPTH = 20;
const DOCUMENT_BLOCK_DELIMITER_RE = /^\s*--(?:doc|앷)--\s*$/i;
const SLOT_COMMIT_DELAY_MS = 400;

interface PreviewPanelProps {
  highlightPath?: string | null;
  metaSourceOverride?: string | null;
}

export function PreviewPanel({ highlightPath = null, metaSourceOverride = null }: PreviewPanelProps = {}) {
  const files = useWorkbenchStore((state) => state.files);
  const metaSource = useWorkbenchStore((state) => state.metaSource);
  const setMetaSource = useWorkbenchStore((state) => state.setMetaSource);
  const updateFileContent = useWorkbenchStore((state) => state.updateFileContent);
  const renameFilePath = useWorkbenchStore((state) => state.renameFilePath);
  const createDocumentBlock = useWorkbenchStore((state) => state.createDocumentBlock);
  const fileMap = useMemo(() => selectFileMap(files), [files]);
  const visibleMetaSource = metaSourceOverride ?? metaSource;
  const renderedMarkdown = useMemo(
    () =>
      resolveRenderedMarkdown(visibleMetaSource, fileMap, {
        rootPath: 'document.md',
        includeBoundaryMarkers: false
      }),
    [fileMap, visibleMetaSource]
  );
  const { setNodeRef, isOver } = useDroppable({ id: 'document-drop' });
  const handleRenameFile = (id: string, nextPath: string) => {
    renameFilePath(id, nextPath);
  };

  return (
    <section className={`panel preview-panel ${isOver ? 'is-over' : ''}`} ref={setNodeRef}>
      <div className="panel-header">
        <div>
          <h2>Document</h2>
          <span>Edit many Markdown files as one document</span>
        </div>
      </div>
      <div className="document-workspace">
        <section className="document-pane editor-pane" aria-label="Document editor">
          <div className="pane-title">Editor</div>
          <div className="preview-document">
            <FileEditorFrame label="document">
              <MarkdownSegments
                source={visibleMetaSource}
                ownerLabel="document"
                fileMap={fileMap}
                stack={['document.md']}
                instanceKey="document.md"
                depth={0}
                highlightPath={highlightPath}
                onUpdateSource={setMetaSource}
                onUpdateFileContent={updateFileContent}
                onRenameFile={handleRenameFile}
                onCreateDocumentBlock={createDocumentBlock}
              />
            </FileEditorFrame>
          </div>
        </section>
        <section className="document-pane render-pane" aria-label="Markdown preview">
          <div className="pane-title">Preview</div>
          <div className="rendered-document">
            <RenderedMarkdownSegments
              source={visibleMetaSource}
              fallbackMarkdown={renderedMarkdown}
              fileMap={fileMap}
              stack={['document.md']}
              depth={0}
              highlightPath={highlightPath}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

interface MarkdownSegmentsProps {
  source: string;
  ownerLabel: string;
  fileMap: Map<string, MarkdownFile>;
  stack: string[];
  instanceKey: string;
  depth: number;
  highlightPath: string | null;
  onUpdateSource: (source: string) => void;
  onUpdateFileContent: (id: string, content: string) => void;
  onRenameFile: (id: string, nextPath: string) => void;
  onCreateDocumentBlock: (content: string) => MarkdownFile;
}

function MarkdownSegments({
  source,
  ownerLabel,
  fileMap,
  stack,
  instanceKey,
  depth,
  highlightPath,
  onUpdateSource,
  onUpdateFileContent,
  onRenameFile,
  onCreateDocumentBlock
}: MarkdownSegmentsProps) {
  const segments = useMemo(() => parseMetaDocument(source), [source]);
  const items = useMemo(() => createEditableItems(segments), [segments]);
  const ownerPath = stack.at(-1) ?? 'document.md';

  return (
    <>
      {items.map((item, index) => {
        const insertAtLineIndex = getEditableItemInsertLineIndex(item);

        if (item.type === 'slot') {
          return (
            <FragmentWithDropZone
              key={`slot-${index}-${item.insertAtLineIndex}`}
              ownerPath={ownerPath}
              instanceKey={instanceKey}
              zoneKey={`before-slot-${index}`}
              insertAtLineIndex={insertAtLineIndex}
            >
              <MarkdownTextEditor
                label={`Edit ${ownerLabel} gap ${item.slotIndex}`}
                value=""
                variant="slot"
                dropTarget={{
                  id: getEditorTextDropId(`${instanceKey}:slot:${index}:${item.insertAtLineIndex}`),
                  ownerPath,
                  lineStart: item.insertAtLineIndex + 1,
                  lineEnd: item.insertAtLineIndex + 1
                }}
                onChange={(content, target) => {
                  if (content.length > 0) {
                    const editorIndex = getEditorIndex(target);
                    const selectionOffset = target.selectionStart;
                    flushSync(() => {
                      onUpdateSource(insertAtLine(source, item.insertAtLineIndex, expandDocumentBlocks(content, onCreateDocumentBlock)));
                    });
                    focusEditorAtIndex(editorIndex, selectionOffset);
                  }
                }}
              />
            </FragmentWithDropZone>
          );
        }

        return (
          <FragmentWithDropZone
            key={getSegmentKey(item.segment, index)}
            ownerPath={ownerPath}
            instanceKey={instanceKey}
            zoneKey={`before-segment-${index}`}
            insertAtLineIndex={insertAtLineIndex}
          >
            <SegmentView
              segment={item.segment}
              segmentIndex={index}
              source={source}
              ownerLabel={ownerLabel}
              fileMap={fileMap}
              stack={stack}
              instanceKey={instanceKey}
              depth={depth}
              highlightPath={highlightPath}
              onUpdateSource={onUpdateSource}
              onUpdateFileContent={onUpdateFileContent}
              onRenameFile={onRenameFile}
              onCreateDocumentBlock={onCreateDocumentBlock}
            />
          </FragmentWithDropZone>
        );
      })}
      <DocumentInsertionDropZone
        ownerPath={ownerPath}
        instanceKey={instanceKey}
        zoneKey="final"
        insertAtLineIndex={source.split(/\r?\n/).length}
      />
    </>
  );
}

type EditableItem =
  | { type: 'segment'; segment: MetaSegment }
  | { type: 'slot'; insertAtLineIndex: number; slotIndex: number };

function createEditableItems(segments: MetaSegment[]): EditableItem[] {
  const items: EditableItem[] = [];
  let slotIndex = 1;

  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    const next = segments[index + 1];

    if (segment.type === 'embed' && previous?.type !== 'text') {
      items.push({ type: 'slot', insertAtLineIndex: segment.line - 1, slotIndex });
      slotIndex += 1;
    }

    items.push({ type: 'segment', segment });

    if (segment.type === 'embed' && next?.type !== 'text') {
      items.push({ type: 'slot', insertAtLineIndex: segment.line, slotIndex });
      slotIndex += 1;
    }
  });

  return items;
}

function getSegmentKey(segment: MetaSegment, index: number): string {
  if (segment.type === 'embed') {
    return `embed-${index}-${segment.path}`;
  }

  if (segment.type === 'text') {
    return `text-${index}-${segment.lineStart}`;
  }

  return `unsupported-${index}-${segment.line}`;
}

function getEditableItemInsertLineIndex(item: EditableItem): number {
  if (item.type === 'slot') {
    return item.insertAtLineIndex;
  }

  if (item.segment.type === 'text') {
    return item.segment.lineStart - 1;
  }

  return item.segment.line - 1;
}

interface FragmentWithDropZoneProps {
  ownerPath: string;
  instanceKey: string;
  zoneKey: string;
  insertAtLineIndex: number;
  children: ReactNode;
}

function FragmentWithDropZone({ ownerPath, instanceKey, zoneKey, insertAtLineIndex, children }: FragmentWithDropZoneProps) {
  return (
    <>
      <DocumentInsertionDropZone
        ownerPath={ownerPath}
        instanceKey={instanceKey}
        zoneKey={zoneKey}
        insertAtLineIndex={insertAtLineIndex}
      />
      {children}
    </>
  );
}

interface DocumentInsertionDropZoneProps {
  ownerPath: string;
  instanceKey: string;
  zoneKey: string;
  insertAtLineIndex: number;
}

function DocumentInsertionDropZone({ ownerPath, instanceKey, zoneKey, insertAtLineIndex }: DocumentInsertionDropZoneProps) {
  const dropId = `${getEditorInsertDropId(instanceKey, insertAtLineIndex)}:${zoneKey}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { type: 'document-insertion-target', ownerPath, insertAtLineIndex }
  });

  return <div ref={setNodeRef} className={`document-insertion-target ${isOver ? 'is-over' : ''}`} aria-hidden="true" />;
}

interface SegmentViewProps {
  segment: MetaSegment;
  segmentIndex: number;
  source: string;
  ownerLabel: string;
  fileMap: Map<string, MarkdownFile>;
  stack: string[];
  instanceKey: string;
  depth: number;
  highlightPath: string | null;
  onUpdateSource: (source: string) => void;
  onUpdateFileContent: (id: string, content: string) => void;
  onRenameFile: (id: string, nextPath: string) => void;
  onCreateDocumentBlock: (content: string) => MarkdownFile;
}

function SegmentView({
  segment,
  segmentIndex,
  source,
  ownerLabel,
  fileMap,
  stack,
  instanceKey,
  depth,
  highlightPath,
  onUpdateSource,
  onUpdateFileContent,
  onRenameFile,
  onCreateDocumentBlock
}: SegmentViewProps) {
  if (segment.type === 'text') {
    return (
      <MarkdownTextEditor
        label={`Edit ${ownerLabel} section ${segmentIndex + 1}`}
        value={segment.content}
        collapseWhenEmpty={isTextSegmentAfterEmbed(source, segment)}
        dropTarget={{
          id: getEditorTextDropId(`${instanceKey}:text:${segmentIndex}:${segment.lineStart}-${segment.lineEnd}`),
          ownerPath: stack.at(-1) ?? 'document.md',
          lineStart: segment.lineStart,
          lineEnd: segment.lineEnd
        }}
        onCollapseEmpty={() => onUpdateSource(removeTextSegment(source, segment))}
        onChange={(content) =>
          onUpdateSource(replaceTextSegment(source, segment, expandDocumentBlocks(content, onCreateDocumentBlock)))
        }
      />
    );
  }

  if (segment.type === 'unsupported') {
    return <WarningBlock label={`Unsupported embed syntax: ${segment.value || segment.raw}`} />;
  }

  return (
    <LazyEmbed
      path={segment.path}
      fileMap={fileMap}
      stack={stack}
      depth={depth}
      instanceId={`${stack.join('>')}::${segmentIndex}::${segment.path}`}
      sourceOwnerPath={stack.at(-1) ?? 'document.md'}
      sourceLine={segment.line}
      highlightPath={highlightPath}
      onRemoveReference={() => onUpdateSource(removeEmbedSegment(source, segment))}
      onUpdateFileContent={onUpdateFileContent}
      onRenameFile={onRenameFile}
      onCreateDocumentBlock={onCreateDocumentBlock}
    />
  );
}

interface LazyEmbedProps {
  path: string;
  fileMap: Map<string, MarkdownFile>;
  stack: string[];
  depth: number;
  instanceId: string;
  sourceOwnerPath: string;
  sourceLine: number;
  highlightPath: string | null;
  onRemoveReference: () => void;
  onUpdateFileContent: (id: string, content: string) => void;
  onRenameFile: (id: string, nextPath: string) => void;
  onCreateDocumentBlock: (content: string) => MarkdownFile;
}

function LazyEmbed({
  path,
  fileMap,
  stack,
  depth,
  instanceId,
  sourceOwnerPath,
  sourceLine,
  highlightPath,
  onRemoveReference,
  onUpdateFileContent,
  onRenameFile,
  onCreateDocumentBlock
}: LazyEmbedProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const file = fileMap.get(path);
  const isCircular = stack.includes(path);
  const exceedsDepth = depth >= MAX_DEPTH;
  const isHighlighted = highlightPath === path;

  if (isCircular) {
    return <WarningBlock label={`Circular embed detected: ${[...stack, path].join(' -> ')}`} />;
  }

  if (exceedsDepth) {
    return <WarningBlock label={`Max embed depth exceeded: ${path}`} />;
  }

  if (!file) {
    return <WarningBlock label={`Missing embed: ${path}`} />;
  }

  return (
    <div className={`preview-embed-segment ${isHighlighted ? 'is-highlighted' : ''}`} ref={ref} data-embed-path={path}>
      <FileEditorFrame
        label={path}
        path={path}
        dragInstanceId={instanceId}
        sourceOwnerPath={sourceOwnerPath}
        sourceLine={sourceLine}
        highlighted={isHighlighted}
        onRemoveReference={onRemoveReference}
        onRename={(nextPath) => onRenameFile(file.id, nextPath)}
      >
        <MarkdownSegments
          source={file.content}
          ownerLabel={path}
          fileMap={fileMap}
          stack={[...stack, path]}
          instanceKey={instanceId}
          depth={depth + 1}
          highlightPath={highlightPath}
          onUpdateSource={(content) => onUpdateFileContent(file.id, content)}
          onUpdateFileContent={onUpdateFileContent}
          onRenameFile={onRenameFile}
          onCreateDocumentBlock={onCreateDocumentBlock}
        />
      </FileEditorFrame>
    </div>
  );
}

interface FileEditorFrameProps {
  label: string;
  path?: string;
  dragInstanceId?: string;
  sourceOwnerPath?: string;
  sourceLine?: number;
  highlighted?: boolean;
  onRemoveReference?: () => void;
  onRename?: (nextPath: string) => void;
  children: ReactNode;
}

function FileEditorFrame({
  label,
  path,
  dragInstanceId,
  sourceOwnerPath,
  sourceLine,
  highlighted = false,
  onRemoveReference,
  onRename,
  children
}: FileEditorFrameProps) {
  return (
    <section className={`file-editor-frame ${highlighted ? 'is-highlighted' : ''}`} aria-label={`${label} file section`}>
      <FileEditorFrameLabel
        label={label}
        path={path}
        dragInstanceId={dragInstanceId}
        sourceOwnerPath={sourceOwnerPath}
        sourceLine={sourceLine}
        onRemoveReference={onRemoveReference}
        onRename={onRename}
      />
      <div className="file-editor-frame-body">{children}</div>
    </section>
  );
}

interface FileEditorFrameLabelProps {
  label: string;
  path?: string;
  dragInstanceId?: string;
  sourceOwnerPath?: string;
  sourceLine?: number;
  onRemoveReference?: () => void;
  onRename?: (nextPath: string) => void;
}

function FileEditorFrameLabel({
  label,
  path,
  dragInstanceId,
  sourceOwnerPath,
  sourceLine,
  onRemoveReference,
  onRename
}: FileEditorFrameLabelProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(label);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const canDrag = Boolean(path && dragInstanceId && !isRenaming);
  const dropId = getEditorFileDropId(dragInstanceId ?? `static:${label}`);
  const dragId = `editor-title:${dragInstanceId ?? label}`;
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: dropId,
    data:
      canDrag && sourceOwnerPath && sourceLine
        ? { type: 'document-file-target', ownerPath: sourceOwnerPath, line: sourceLine, path }
        : { type: 'editor-file-label', path: null },
    disabled: !canDrag
  });
  const { attributes, listeners, setNodeRef: setDragNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data:
      canDrag && sourceOwnerPath && sourceLine
        ? { type: 'library-file', origin: 'editor', path, sourceOwnerPath, sourceLine }
        : { type: 'editor-file-label', path: null },
    disabled: !canDrag
  });
  const dragStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform)
  };
  const startRename = () => {
    setDraftName(label);
    setIsRenaming(true);
  };
  const cancelRename = () => {
    setDraftName(label);
    setIsRenaming(false);
  };
  const commitRename = () => {
    const nextName = draftName.trim();

    setIsRenaming(false);

    if (!nextName || nextName === label) {
      setDraftName(label);
      return;
    }

    onRename?.(nextName);
  };

  useEffect(() => {
    if (!isRenaming) {
      return;
    }

    const input = renameInputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(0, input.value.length);
  }, [isRenaming]);

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(label);
    }
  }, [isRenaming, label]);

  return (
    <div
      ref={setDropNodeRef}
      className={`file-editor-frame-label ${canDrag ? 'is-draggable' : ''} ${isOver ? 'is-drop-target' : ''}`}
    >
      {isRenaming ? (
        <input
          ref={renameInputRef}
          className="file-editor-title-input"
          aria-label={`Rename ${label}`}
          value={draftName}
          onChange={(event) => setDraftName(event.currentTarget.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitRename();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              cancelRename();
            }
          }}
        />
      ) : canDrag ? (
        <button
          ref={setDragNodeRef}
          type="button"
          className={`file-editor-title-handle ${isDragging ? 'is-dragging' : ''}`}
          style={dragStyle}
          title="Drag or reorder document"
          {...listeners}
          {...attributes}
        >
          {label}
        </button>
      ) : (
        <span className="file-editor-title-text">{label}</span>
      )}
      {onRename ? (
        <>
          {onRemoveReference ? (
            <button
              type="button"
              className="file-editor-title-action reference-remove-action"
              onClick={onRemoveReference}
              title="Remove this reference from document"
            >
              <Unlink2 aria-hidden="true" />
            </button>
          ) : null}
        <button type="button" className="file-editor-title-action" onClick={startRename} title="Rename file">
          <FilePenLine aria-hidden="true" />
        </button>
        </>
      ) : null}
    </div>
  );
}

interface RenderedMarkdownSegmentsProps {
  source: string;
  fallbackMarkdown: string;
  fileMap: Map<string, MarkdownFile>;
  stack: string[];
  depth: number;
  highlightPath: string | null;
}

function RenderedMarkdownSegments({
  source,
  fallbackMarkdown,
  fileMap,
  stack,
  depth,
  highlightPath
}: RenderedMarkdownSegmentsProps) {
  const segments = useMemo(() => parseMetaDocument(source), [source]);

  if (segments.length === 0) {
    return <RenderedMarkdownFragment content={fallbackMarkdown} />;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <RenderedMarkdownFragment key={`rendered-text-${index}-${segment.lineStart}`} content={segment.content} />;
        }

        if (segment.type === 'unsupported') {
          return <WarningBlock key={`rendered-unsupported-${index}-${segment.line}`} label={`Unsupported embed syntax: ${segment.value || segment.raw}`} />;
        }

        return (
          <RenderedEmbed
            key={`rendered-embed-${index}-${segment.path}`}
            path={segment.path}
            fileMap={fileMap}
            stack={stack}
            depth={depth}
            highlightPath={highlightPath}
          />
        );
      })}
    </>
  );
}

function RenderedMarkdownFragment({ content }: { content: string }) {
  if (content.length === 0) {
    return null;
  }

  return (
    <div className="rendered-markdown-fragment">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface RenderedEmbedProps {
  path: string;
  fileMap: Map<string, MarkdownFile>;
  stack: string[];
  depth: number;
  highlightPath: string | null;
}

function RenderedEmbed({ path, fileMap, stack, depth, highlightPath }: RenderedEmbedProps) {
  const file = fileMap.get(path);
  const isCircular = stack.includes(path);
  const exceedsDepth = depth >= MAX_DEPTH;

  if (isCircular) {
    return <WarningBlock label={`Circular embed detected: ${[...stack, path].join(' -> ')}`} />;
  }

  if (exceedsDepth) {
    return <WarningBlock label={`Max embed depth exceeded: ${path}`} />;
  }

  if (!file) {
    return <WarningBlock label={`Missing embed: ${path}`} />;
  }

  return (
    <div
      className={`rendered-embed-segment ${highlightPath === path ? 'is-highlighted' : ''}`}
      data-rendered-embed-path={path}
    >
      <RenderedMarkdownSegments
        source={file.content}
        fallbackMarkdown={file.content}
        fileMap={fileMap}
        stack={[...stack, path]}
        depth={depth + 1}
        highlightPath={highlightPath}
      />
    </div>
  );
}

interface MarkdownTextEditorProps {
  label: string;
  value: string;
  variant?: 'text' | 'slot';
  collapseWhenEmpty?: boolean;
  dropTarget?: {
    id: string;
    ownerPath: string;
    lineStart: number;
    lineEnd: number;
  };
  onCollapseEmpty?: () => void;
  onChange: (content: string, target: HTMLTextAreaElement) => void;
}

function MarkdownTextEditor({
  label,
  value,
  variant = 'text',
  collapseWhenEmpty = false,
  dropTarget,
  onCollapseEmpty,
  onChange
}: MarkdownTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const committedCompositionValueRef = useRef<string | null>(null);
  const slotCommitTimerRef = useRef<number | null>(null);
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: dropTarget?.id ?? `disabled-text-drop:${label}`,
    data: dropTarget
      ? {
          type: 'document-text-target',
          dropId: dropTarget.id,
          ownerPath: dropTarget.ownerPath,
          lineStart: dropTarget.lineStart,
          lineEnd: dropTarget.lineEnd
        }
      : { type: 'document-text-target-disabled' },
    disabled: !dropTarget
  });

  useEffect(() => {
    return () => clearSlotCommitTimer(slotCommitTimerRef);
  }, []);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    resizeTextarea(element, variant);
  }, [value, variant]);

  useEffect(() => {
    const element = ref.current;

    if (!element || isComposingRef.current || element.value === value) {
      return;
    }

    element.value = value;
    resizeTextarea(element, variant);
  }, [value, variant]);

  return (
    <textarea
      ref={(node) => {
        ref.current = node;
        setDropNodeRef(node);
      }}
      className={`document-text-editor ${variant === 'slot' ? 'is-slot' : ''} ${isOver ? 'is-drop-target' : ''}`}
      data-text-drop-id={dropTarget?.id}
      aria-label={label}
      defaultValue={value}
      spellCheck="true"
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        resizeTextarea(event.currentTarget, variant);

        if (variant === 'slot') {
          if (nextValue.length > 0 && !isNativeInputComposing(event)) {
            scheduleSlotCommit(slotCommitTimerRef, event.currentTarget, onChange);
          }
          return;
        }

        if (isNativeInputComposing(event)) {
          return;
        }

        if (committedCompositionValueRef.current === nextValue) {
          committedCompositionValueRef.current = null;
          return;
        }

        handleEditorChange(event, onChange, collapseWhenEmpty, onCollapseEmpty);
      }}
      onCompositionStart={() => {
        isComposingRef.current = true;
        clearSlotCommitTimer(slotCommitTimerRef);
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        const nextValue = event.currentTarget.value;
        committedCompositionValueRef.current = nextValue;
        resizeTextarea(event.currentTarget, variant);

        if (variant === 'slot') {
          if (nextValue.length > 0) {
            scheduleSlotCommit(slotCommitTimerRef, event.currentTarget, onChange);
          }
          return;
        }

        onChange(nextValue, event.currentTarget);
      }}
      onKeyDown={(event) =>
        handleEditorKeyDown(event, event.currentTarget.value, onChange, variant, collapseWhenEmpty, onCollapseEmpty)
      }
    />
  );
}

function isNativeInputComposing(event: ChangeEvent<HTMLTextAreaElement>): boolean {
  const nativeEvent = event.nativeEvent as InputEvent & { isComposing?: boolean };
  return Boolean(nativeEvent.isComposing || nativeEvent.inputType === 'insertCompositionText');
}

function scheduleSlotCommit(
  timerRef: MutableRefObject<number | null>,
  element: HTMLTextAreaElement,
  onChange: (content: string, target: HTMLTextAreaElement) => void
): void {
  clearSlotCommitTimer(timerRef);

  timerRef.current = window.setTimeout(() => {
    timerRef.current = null;

    if (!element.isConnected || element.value.length === 0) {
      return;
    }

    onChange(element.value, element);
  }, SLOT_COMMIT_DELAY_MS);
}

function clearSlotCommitTimer(timerRef: MutableRefObject<number | null>): void {
  if (timerRef.current === null) {
    return;
  }

  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function resizeTextarea(element: HTMLTextAreaElement, variant: 'text' | 'slot'): void {
  element.style.height = '0px';
  element.style.height = `${Math.max(variant === 'slot' ? 28 : 48, element.scrollHeight)}px`;
}

function handleEditorChange(
  event: ChangeEvent<HTMLTextAreaElement>,
  onChange: (content: string, target: HTMLTextAreaElement) => void,
  _collapseWhenEmpty: boolean,
  _onCollapseEmpty?: () => void
): void {
  const target = event.currentTarget;
  const nextValue = target.value;

  onChange(nextValue, target);
}

function handleEditorKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (content: string, target: HTMLTextAreaElement) => void,
  variant: 'text' | 'slot',
  collapseWhenEmpty: boolean,
  onCollapseEmpty?: () => void
): void {
  if (isImeComposing(event)) {
    return;
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    handleDeletionKey(event, value, onChange, variant, collapseWhenEmpty, onCollapseEmpty);
    return;
  }

  if (
    (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }

  const target = event.currentTarget;

  if (target.selectionStart !== target.selectionEnd) {
    return;
  }

  const cursor = getCursorPosition(value, target.selectionStart);

  if (event.key === 'ArrowDown' && cursor.lineIndex === cursor.lines.length - 1) {
    event.preventDefault();
    const next = getAdjacentEditor(target, 1);

    if (next) {
      focusEditorLine(next, 0, cursor.column);
    }
  }

  if (event.key === 'ArrowUp' && cursor.lineIndex === 0) {
    const previous = getAdjacentEditor(target, -1);

    if (!previous) {
      return;
    }

    event.preventDefault();
    const previousLines = previous.value.split('\n');
    focusEditorLine(previous, previousLines.length - 1, cursor.column);
  }
}

function handleDeletionKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (content: string, target: HTMLTextAreaElement) => void,
  variant: 'text' | 'slot',
  collapseWhenEmpty: boolean,
  onCollapseEmpty?: () => void
): void {
  const target = event.currentTarget;

  if (target.selectionStart !== target.selectionEnd) {
    return;
  }

  if (variant === 'slot' && value.length === 0) {
    event.preventDefault();
    const previous = getAdjacentEditor(target, -1);

    if (!previous) {
      target.blur();
      return;
    }

    const previousLines = previous.value.split('\n');
    focusEditorLine(previous, previousLines.length - 1, previousLines.at(-1)?.length ?? 0);
    return;
  }

  if (collapseWhenEmpty && value.length === 0 && onCollapseEmpty) {
    event.preventDefault();
    const previous = getAdjacentEditor(target, -1);
    onCollapseEmpty();
    focusAdjacentAfterCollapse(previous);
    return;
  }

  if (event.key === 'Delete') {
    return;
  }

  const cursor = getCursorPosition(value, target.selectionStart);

  if (cursor.lineIndex === cursor.lines.length - 1 && cursor.lines[cursor.lineIndex] === '' && target.selectionStart > 0) {
    event.preventDefault();
    const nextValue = value.slice(0, target.selectionStart - 1) + value.slice(target.selectionStart);
    onChange(nextValue, target);
    scheduleSelection(target, target.selectionStart - 1);
  }
}

function focusAdjacentAfterCollapse(editor: HTMLTextAreaElement | null): void {
  if (!editor) {
    return;
  }

  const lines = editor.value.split('\n');
  scheduleSelection(editor, editor.value.length);
  focusEditorLine(editor, lines.length - 1, lines.at(-1)?.length ?? 0);
}

function isImeComposing(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  const nativeEvent = event.nativeEvent as globalThis.KeyboardEvent & { isComposing?: boolean; keyCode?: number };
  return Boolean(nativeEvent.isComposing || nativeEvent.keyCode === 229 || event.key === 'Process');
}

function getAdjacentEditor(current: HTMLTextAreaElement, direction: 1 | -1): HTMLTextAreaElement | null {
  const editors = Array.from(document.querySelectorAll<HTMLTextAreaElement>('.document-text-editor'));
  const index = editors.indexOf(current);

  if (index === -1) {
    return null;
  }

  return editors[index + direction] ?? null;
}

function getEditorIndex(editor: HTMLTextAreaElement): number {
  return Array.from(document.querySelectorAll<HTMLTextAreaElement>('.document-text-editor')).indexOf(editor);
}

function focusEditorAtIndexAfterRender(index: number, offset: number): void {
  if (index < 0) {
    return;
  }

  const applyFocus = () => {
    tryFocusEditorAtIndex(index, offset);
  };

  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    window.requestAnimationFrame(applyFocus);
    return;
  }

  setTimeout(applyFocus, 0);
}

function focusEditorAtIndex(index: number, offset: number): void {
  if (tryFocusEditorAtIndex(index, offset)) {
    return;
  }

  focusEditorAtIndexAfterRender(index, offset);
}

function tryFocusEditorAtIndex(index: number, offset: number): boolean {
  const editors = Array.from(document.querySelectorAll<HTMLTextAreaElement>('.document-text-editor'));
  const editor = editors[index] ?? editors.at(-1);

  if (!editor) {
    return false;
  }

  const safeOffset = Math.min(Math.max(offset, 0), editor.value.length);
  editor.focus();
  editor.setSelectionRange(safeOffset, safeOffset);
  return true;
}

function focusEditorLine(editor: HTMLTextAreaElement, lineIndex: number, column: number): void {
  const lines = editor.value.split('\n');
  const safeLineIndex = Math.min(Math.max(lineIndex, 0), lines.length - 1);
  const lineStart = lines.slice(0, safeLineIndex).reduce((offset, line) => offset + line.length + 1, 0);
  const offset = lineStart + Math.min(column, lines[safeLineIndex]?.length ?? 0);

  editor.focus();
  editor.setSelectionRange(offset, offset);
}

function getCursorPosition(value: string, offset: number): { column: number; lineIndex: number; lines: string[] } {
  const lines = value.split('\n');
  let remaining = offset;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (remaining <= line.length) {
      return { column: remaining, lineIndex, lines };
    }

    remaining -= line.length + 1;
  }

  const lastLineIndex = lines.length - 1;
  return { column: lines[lastLineIndex]?.length ?? 0, lineIndex: lastLineIndex, lines };
}

function scheduleSelection(target: HTMLTextAreaElement, offset: number): void {
  const applySelection = () => {
    target.focus();
    target.setSelectionRange(offset, offset);
  };

  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    window.requestAnimationFrame(applySelection);
    return;
  }

  setTimeout(applySelection, 0);
}

function replaceTextSegment(source: string, segment: TextSegment, content: string): string {
  const lines = source.split(/\r?\n/);
  const before = lines.slice(0, segment.lineStart - 1);
  const after = lines.slice(segment.lineEnd);
  const replacement = content.split(/\r?\n/);

  return [...before, ...replacement, ...after].join('\n');
}

function removeTextSegment(source: string, segment: TextSegment): string {
  const lines = source.split(/\r?\n/);
  const before = lines.slice(0, segment.lineStart - 1);
  const after = lines.slice(segment.lineEnd);

  return [...before, ...after].join('\n');
}

function removeEmbedSegment(source: string, segment: Extract<MetaSegment, { type: 'embed' }>): string {
  const lines = source.split(/\r?\n/);
  lines.splice(segment.line - 1, 1);
  return lines.join('\n');
}

function isTextSegmentAfterEmbed(source: string, segment: TextSegment): boolean {
  const lines = source.split(/\r?\n/);
  const previousLine = lines[segment.lineStart - 2] ?? '';
  return /^\s*!\[\[[^\]]+\]\]\s*$/.test(previousLine);
}

function insertAtLine(source: string, insertAtLineIndex: number, content: string): string {
  const lines = source.split(/\r?\n/);
  const insertLines = content.split(/\r?\n/);
  const index = Math.min(Math.max(insertAtLineIndex, 0), lines.length);
  lines.splice(index, 0, ...insertLines);

  return lines.join('\n');
}

function expandDocumentBlocks(content: string, createDocumentBlock: (content: string) => MarkdownFile): string {
  const chunks = splitDocumentBlockChunks(content);

  if (chunks.length === 1) {
    return content;
  }

  const [firstChunk, ...blockChunks] = chunks;
  const embeds = blockChunks.map((chunk) => `![[${createDocumentBlock(chunk).path}]]`);
  const first = firstChunk.trimEnd();

  return [first, ...embeds].filter((chunk) => chunk.length > 0).join('\n\n');
}

function splitDocumentBlockChunks(content: string): string[] {
  const chunks: string[][] = [[]];

  content.split(/\r?\n/).forEach((line) => {
    if (DOCUMENT_BLOCK_DELIMITER_RE.test(line)) {
      chunks.push([]);
      return;
    }

    chunks[chunks.length - 1].push(line);
  });

  return chunks.map((chunk) => chunk.join('\n'));
}

function WarningBlock({ label }: { label: string }) {
  return (
    <div className="warning-block">
      <CircleAlert aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
