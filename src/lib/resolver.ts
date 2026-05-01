import type { MarkdownFile, MetaSegment } from '../types';
import { parseMetaDocument } from './embedParser';

export interface ResolveOptions {
  includeBoundaryMarkers?: boolean;
  maxDepth?: number;
  rootPath?: string;
}

type FileLookup = Map<string, MarkdownFile> | Record<string, MarkdownFile>;

const DEFAULT_MAX_DEPTH = 20;

export function resolveRenderedMarkdown(
  metaPathOrSource: string,
  fileLookup: FileLookup,
  options: ResolveOptions = {}
): string {
  const fileMap = toFileMap(fileLookup);
  const rootFile = fileMap.get(metaPathOrSource);
  const rootPath = rootFile?.path ?? options.rootPath ?? 'current-meta.md';
  const source = rootFile?.content ?? metaPathOrSource;

  return resolveSource(source, fileMap, {
    includeBoundaryMarkers: options.includeBoundaryMarkers ?? true,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    stack: [rootPath],
    depth: 0
  }).trimEnd();
}

interface InternalResolveOptions {
  includeBoundaryMarkers: boolean;
  maxDepth: number;
  stack: string[];
  depth: number;
}

function resolveSource(
  source: string,
  fileMap: Map<string, MarkdownFile>,
  options: InternalResolveOptions
): string {
  const segments = parseMetaDocument(source);

  return segments
    .map((segment) => renderSegment(segment, fileMap, options))
    .filter((chunk) => chunk.length > 0)
    .join('\n');
}

function renderSegment(
  segment: MetaSegment,
  fileMap: Map<string, MarkdownFile>,
  options: InternalResolveOptions
): string {
  if (segment.type === 'text') {
    return segment.content;
  }

  if (segment.type === 'unsupported') {
    return `> Unsupported embed syntax: ${segment.value || segment.raw}`;
  }

  return resolveEmbed(segment.path, fileMap, options);
}

function resolveEmbed(
  path: string,
  fileMap: Map<string, MarkdownFile>,
  options: InternalResolveOptions
): string {
  if (options.stack.includes(path)) {
    return `> Circular embed detected: ${[...options.stack, path].join(' -> ')}`;
  }

  if (options.depth >= options.maxDepth) {
    return `> Max embed depth exceeded: ${path}`;
  }

  const file = fileMap.get(path);

  if (!file) {
    return `> Missing embed: ${path}`;
  }

  const resolved = resolveSource(file.content, fileMap, {
    ...options,
    stack: [...options.stack, path],
    depth: options.depth + 1
  }).trim();

  if (!options.includeBoundaryMarkers) {
    return resolved;
  }

  return [`<!-- Begin embed: ${path} -->`, '', resolved, '', `<!-- End embed: ${path} -->`].join('\n');
}

function toFileMap(fileLookup: FileLookup): Map<string, MarkdownFile> {
  if (fileLookup instanceof Map) {
    return fileLookup;
  }

  return new Map(Object.entries(fileLookup));
}
