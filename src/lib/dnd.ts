import type { UniqueIdentifier } from '@dnd-kit/core';

export const DOCUMENT_DROP_ID = 'document-drop';
export const LIBRARY_DROP_ID = 'library-drop';
export const LIBRARY_FILE_DROP_PREFIX = 'library-file:';
export const EDITOR_FILE_DROP_PREFIX = 'editor-file:';
export const EDITOR_INSERT_DROP_PREFIX = 'editor-insert:';
export const EDITOR_TEXT_DROP_PREFIX = 'editor-text:';

export function getLibraryFileDropId(fileId: string): string {
  return `${LIBRARY_FILE_DROP_PREFIX}${fileId}`;
}

export function getEditorFileDropId(instanceId: string): string {
  return `${EDITOR_FILE_DROP_PREFIX}${instanceId}`;
}

export function getEditorInsertDropId(instanceId: string, insertAtLineIndex: number): string {
  return `${EDITOR_INSERT_DROP_PREFIX}${instanceId}:${insertAtLineIndex}`;
}

export function getEditorTextDropId(instanceId: string): string {
  return `${EDITOR_TEXT_DROP_PREFIX}${instanceId}`;
}

export function isLibraryFileDropId(id: UniqueIdentifier | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(LIBRARY_FILE_DROP_PREFIX);
}

export function isEditorFileDropId(id: UniqueIdentifier | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(EDITOR_FILE_DROP_PREFIX);
}

export function isEditorInsertDropId(id: UniqueIdentifier | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(EDITOR_INSERT_DROP_PREFIX);
}

export function isEditorTextDropId(id: UniqueIdentifier | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(EDITOR_TEXT_DROP_PREFIX);
}

export function isEditorDocumentDropId(id: UniqueIdentifier | null | undefined): boolean {
  return isEditorFileDropId(id) || isEditorInsertDropId(id) || isEditorTextDropId(id);
}

export function isFileReorderDropId(id: UniqueIdentifier | null | undefined): boolean {
  return isLibraryFileDropId(id) || isEditorFileDropId(id);
}
