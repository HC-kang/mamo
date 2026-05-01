import type { MarkdownFile } from '../types';

export interface VirtualPathResult {
  path: string;
  duplicateIndex?: number;
}

type BrowserFileLike = File & {
  webkitRelativePath?: string;
};

export function createVirtualPath(file: Pick<BrowserFileLike, 'name'> & Partial<BrowserFileLike>): string {
  const relativePath = typeof file.webkitRelativePath === 'string' ? file.webkitRelativePath : '';
  const path = relativePath.trim().length > 0 ? relativePath : file.name;
  return normalizeVirtualPath(path);
}

export async function importMarkdownFiles(
  files: Iterable<File>,
  existingPaths: Iterable<string> = []
): Promise<MarkdownFile[]> {
  const usedPaths = new Set(existingPaths);
  const imported: MarkdownFile[] = [];

  for (const file of files) {
    if (!isMarkdownFile(file.name)) {
      continue;
    }

    const basePath = createVirtualPath(file);
    const { path, duplicateIndex } = disambiguateVirtualPath(basePath, usedPaths);
    usedPaths.add(path);

    imported.push({
      id: createId(),
      path,
      name: path.split('/').at(-1) ?? file.name,
      content: await file.text(),
      source: 'imported',
      dirty: false,
      duplicateIndex
    });
  }

  return imported;
}

export function isMarkdownFile(path: string): boolean {
  return /\.m(?:d|arkdown)$/i.test(path);
}

export function disambiguateVirtualPath(path: string, usedPaths: Set<string>): VirtualPathResult {
  const normalized = normalizeVirtualPath(path);

  if (!usedPaths.has(normalized)) {
    return { path: normalized };
  }

  const slashIndex = normalized.lastIndexOf('/');
  const folder = slashIndex >= 0 ? `${normalized.slice(0, slashIndex + 1)}` : '';
  const fileName = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex) : '';
  let duplicateIndex = 2;
  let candidate = `${folder}${base} (${duplicateIndex})${extension}`;

  while (usedPaths.has(candidate)) {
    duplicateIndex += 1;
    candidate = `${folder}${base} (${duplicateIndex})${extension}`;
  }

  return { path: candidate, duplicateIndex };
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createQuickNotePath(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');

  return `inbox/${stamp}.md`;
}

export function normalizeVirtualPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/u, '').replace(/\/{2,}/gu, '/');
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
