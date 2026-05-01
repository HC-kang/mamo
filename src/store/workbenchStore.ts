import { create } from 'zustand';
import type { MarkdownFile } from '../types';
import {
  addEmbedLine,
  duplicateEmbedAt,
  getEmbedReferences,
  getMetaTitle,
  insertEmbedAtLine,
  moveEmbedLine,
  moveEmbedPath,
  removeEmbedAt,
  removeLastEmbedPath,
  replaceEmbedPath,
  reorderEmbeds,
  setMetaTitle
} from '../lib/embedParser';
import {
  createId,
  createQuickNotePath,
  disambiguateVirtualPath,
  importMarkdownFiles,
  isMarkdownFile,
  normalizeVirtualPath
} from '../lib/importExport';

export interface QuickNoteInput {
  title?: string;
  filename?: string;
  body: string;
}

export interface EmbedReferenceMoveInput {
  path: string;
  fromOwnerPath: string;
  fromLine: number;
  toOwnerPath: string;
  insertAtLineIndex: number;
}

interface WorkbenchState {
  files: MarkdownFile[];
  metaSource: string;
  currentMetaPath: string | null;
  importFiles: (files: Iterable<File>) => Promise<void>;
  createQuickNote: (input: QuickNoteInput) => MarkdownFile;
  createDocumentBlock: (content: string) => MarkdownFile;
  updateFileContent: (id: string, content: string) => void;
  renameFilePath: (id: string, nextPath: string) => void;
  setMetaSource: (source: string) => void;
  setMetaTitle: (title: string) => void;
  loadMetaFromFile: (id: string) => void;
  addEmbed: (path: string) => void;
  insertEmbedReference: (ownerPath: string, path: string, insertAtLineIndex: number) => void;
  moveEmbedReference: (input: EmbedReferenceMoveInput) => void;
  removeEmbed: (index: number) => void;
  duplicateEmbed: (index: number) => void;
  reorderEmbed: (fromIndex: number, toIndex: number) => void;
  moveEmbedPath: (movingPath: string, targetPath: string) => void;
  removeLastEmbedPath: (path: string) => void;
}

export const initialMetaSource = '# Untitled Document\n';

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  files: [],
  metaSource: initialMetaSource,
  currentMetaPath: null,

  importFiles: async (files) => {
    const imported = await importMarkdownFiles(
      files,
      get().files.map((file) => file.path)
    );

    if (imported.length > 0) {
      set((state) => ({ files: [...state.files, ...imported] }));
    }
  },

  createQuickNote: ({ title, filename, body }) => {
    const usedPaths = new Set(get().files.map((file) => file.path));
    const requestedPath = normalizeQuickNotePath(filename?.trim() || createQuickNotePath());
    const { path, duplicateIndex } = disambiguateVirtualPath(requestedPath, usedPaths);
    const trimmedTitle = title?.trim();
    const content = trimmedTitle ? `# ${trimmedTitle}\n\n${body.trim()}`.trimEnd() : body.trim();
    const note: MarkdownFile = {
      id: createId(),
      path,
      name: path.split('/').at(-1) ?? path,
      content,
      source: 'generated',
      dirty: true,
      duplicateIndex
    };

    set((state) => ({ files: [...state.files, note] }));
    return note;
  },

  createDocumentBlock: (content) => {
    const usedPaths = new Set(get().files.map((file) => file.path));
    const { path, duplicateIndex } = disambiguateVirtualPath(createDocumentBlockPath(), usedPaths);
    const block: MarkdownFile = {
      id: createId(),
      path,
      name: path.split('/').at(-1) ?? path,
      content: content.trim(),
      source: 'generated',
      dirty: true,
      duplicateIndex
    };

    set((state) => ({ files: [...state.files, block] }));
    return block;
  },

  updateFileContent: (id, content) => {
    set((state) => ({
      files: state.files.map((file) => (file.id === id ? { ...file, content, dirty: true } : file))
    }));
  },

  renameFilePath: (id, nextPath) => {
    const file = get().files.find((candidate) => candidate.id === id);

    if (!file || nextPath.trim().length === 0) {
      return;
    }

    const requestedPath = normalizeMarkdownPath(nextPath);
    const usedPaths = new Set(get().files.filter((candidate) => candidate.id !== id).map((candidate) => candidate.path));
    const { path, duplicateIndex } = disambiguateVirtualPath(requestedPath, usedPaths);

    set((state) => ({
      files: state.files.map((candidate) => {
        if (candidate.id === id) {
          return {
            ...candidate,
            path,
            name: path.split('/').at(-1) ?? path,
            dirty: true,
            duplicateIndex
          };
        }

        const nextContent = replaceEmbedPath(candidate.content, file.path, path);
        return nextContent === candidate.content ? candidate : { ...candidate, content: nextContent, dirty: true };
      }),
      metaSource: replaceEmbedPath(state.metaSource, file.path, path),
      currentMetaPath: state.currentMetaPath === file.path ? path : state.currentMetaPath
    }));
  },

  setMetaSource: (source) => {
    set({ metaSource: source, currentMetaPath: null });
  },

  setMetaTitle: (title) => {
    set((state) => ({ metaSource: setMetaTitle(state.metaSource, title) }));
  },

  loadMetaFromFile: (id) => {
    const file = get().files.find((candidate) => candidate.id === id);

    if (file && isMarkdownFile(file.path)) {
      set({ metaSource: file.content, currentMetaPath: file.path });
    }
  },

  addEmbed: (path) => {
    set((state) => ({ metaSource: addEmbedLine(state.metaSource, path), currentMetaPath: null }));
  },

  insertEmbedReference: (ownerPath, path, insertAtLineIndex) => {
    set((state) => updateOwnedSource(state, ownerPath, (source) => insertEmbedAtLine(source, path, insertAtLineIndex)));
  },

  moveEmbedReference: ({ path, fromOwnerPath, fromLine, toOwnerPath, insertAtLineIndex }) => {
    set((state) => {
      if (path === toOwnerPath) {
        return state;
      }

      if (fromOwnerPath === toOwnerPath) {
        return updateOwnedSource(state, fromOwnerPath, (source) => moveEmbedLine(source, path, fromLine, insertAtLineIndex));
      }

      const fromSource = getOwnedSource(state, fromOwnerPath);
      const toSource = getOwnedSource(state, toOwnerPath);

      if (fromSource === null || toSource === null) {
        return state;
      }

      const lines = fromSource.split(/\r?\n/);
      const fromIndex = fromLine - 1;

      if (fromIndex < 0 || fromIndex >= lines.length || lines[fromIndex].trim() !== `![[${path}]]`) {
        return state;
      }

      lines.splice(fromIndex, 1);

      const withoutOriginal = setOwnedSource(state, fromOwnerPath, lines.join('\n'));
      return updateOwnedSource(withoutOriginal, toOwnerPath, (source) => insertEmbedAtLine(source, path, insertAtLineIndex));
    });
  },

  removeEmbed: (index) => {
    set((state) => ({ metaSource: removeEmbedAt(state.metaSource, index), currentMetaPath: null }));
  },

  duplicateEmbed: (index) => {
    set((state) => ({ metaSource: duplicateEmbedAt(state.metaSource, index), currentMetaPath: null }));
  },

  reorderEmbed: (fromIndex, toIndex) => {
    set((state) => ({ metaSource: reorderEmbeds(state.metaSource, fromIndex, toIndex), currentMetaPath: null }));
  },

  moveEmbedPath: (movingPath, targetPath) => {
    set((state) => ({ metaSource: moveEmbedPath(state.metaSource, movingPath, targetPath), currentMetaPath: null }));
  },

  removeLastEmbedPath: (path) => {
    set((state) => ({ metaSource: removeLastEmbedPath(state.metaSource, path), currentMetaPath: null }));
  }
}));

export function selectFileMap(files: MarkdownFile[]): Map<string, MarkdownFile> {
  return new Map(files.map((file) => [file.path, file]));
}

export function selectMetaTitle(source: string): string {
  return getMetaTitle(source);
}

export function selectEmbedCount(source: string): number {
  return getEmbedReferences(source).length;
}

function normalizeQuickNotePath(path: string): string {
  const normalized = normalizeVirtualPath(path);
  return /\.m(?:d|arkdown)$/i.test(normalized) ? normalized : `${normalized}.md`;
}

function normalizeMarkdownPath(path: string): string {
  const normalized = normalizeVirtualPath(path.trim());
  return /\.m(?:d|arkdown)$/i.test(normalized) ? normalized : `${normalized}.md`;
}

function createDocumentBlockPath(date = new Date()): string {
  const pad = (value: number, length = 2) => value.toString().padStart(length, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3)
  ].join('');

  return `document/${stamp}.md`;
}

function getOwnedSource(state: WorkbenchState, ownerPath: string): string | null {
  if (ownerPath === 'document.md') {
    return state.metaSource;
  }

  return state.files.find((file) => file.path === ownerPath)?.content ?? null;
}

function updateOwnedSource(state: WorkbenchState, ownerPath: string, updater: (source: string) => string): WorkbenchState {
  const source = getOwnedSource(state, ownerPath);

  if (source === null) {
    return state;
  }

  return setOwnedSource(state, ownerPath, updater(source));
}

function setOwnedSource(state: WorkbenchState, ownerPath: string, source: string): WorkbenchState {
  if (ownerPath === 'document.md') {
    return { ...state, metaSource: source, currentMetaPath: null };
  }

  return {
    ...state,
    files: state.files.map((file) => (file.path === ownerPath ? { ...file, content: source, dirty: true } : file))
  };
}
