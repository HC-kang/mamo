import type { EmbedReference, MetaSegment, UnsupportedEmbedSegment } from '../types';

const EMBED_LINE_RE = /^\s*!\[\[([^\]]*)\]\]\s*$/;
const EMBED_START_RE = /^\s*!\[\[/;
const MARKDOWN_PATH_RE = /\.m(?:d|arkdown)$/i;

export function parseMetaDocument(source: string): MetaSegment[] {
  const lines = source.split(/\r?\n/);
  const segments: MetaSegment[] = [];
  let textLines: string[] = [];
  let textStart = 1;
  let embedIndex = 0;

  const flushText = (lineEnd: number) => {
    if (textLines.length === 0) {
      return;
    }

    segments.push({
      type: 'text',
      content: textLines.join('\n'),
      lineStart: textStart,
      lineEnd
    });
    textLines = [];
  };

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1;
    const embedMatch = line.match(EMBED_LINE_RE);

    if (embedMatch) {
      flushText(lineNumber - 1);
      const value = embedMatch[1].trim();
      const unsupported = getUnsupportedEmbed(line, value, lineNumber);

      if (unsupported) {
        segments.push(unsupported);
        return;
      }

      segments.push({
        type: 'embed',
        raw: line,
        path: value,
        line: lineNumber,
        index: embedIndex
      });
      embedIndex += 1;
      return;
    }

    if (EMBED_START_RE.test(line)) {
      flushText(lineNumber - 1);
      segments.push({
        type: 'unsupported',
        raw: line,
        value: extractUnsupportedValue(line),
        reason: 'Invalid or unsupported embed syntax',
        line: lineNumber
      });
      return;
    }

    if (textLines.length === 0) {
      textStart = lineNumber;
    }
    textLines.push(line);
  });

  flushText(lines.length);
  return segments;
}

export function getEmbedReferences(source: string): EmbedReference[] {
  return parseMetaDocument(source)
    .filter((segment) => segment.type === 'embed')
    .map((segment) => ({
      id: `embed-${segment.index}-${segment.path}`,
      path: segment.path,
      raw: segment.raw,
      line: segment.line,
      index: segment.index
    }));
}

export function setMetaTitle(source: string, title: string): string {
  const nextTitle = title.trim() || 'Untitled Document';
  const lines = source.length > 0 ? source.split(/\r?\n/) : [];

  if (lines[0]?.startsWith('# ')) {
    lines[0] = `# ${nextTitle}`;
    return lines.join('\n');
  }

  return [`# ${nextTitle}`, '', source].filter((part) => part.length > 0).join('\n');
}

export function getMetaTitle(source: string): string {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.startsWith('# ') ? firstLine.slice(2).trim() : 'Untitled Document';
}

export function addEmbedLine(source: string, path: string): string {
  const normalized = `![[${path}]]`;
  const trimmedEnd = source.replace(/\s*$/u, '');
  return trimmedEnd.length > 0 ? `${trimmedEnd}\n\n${normalized}` : normalized;
}

export function insertEmbedAtLine(source: string, path: string, insertAtLineIndex: number): string {
  const lines = source.split(/\r?\n/);
  const index = clampLineIndex(insertAtLineIndex, lines.length);
  lines.splice(index, 0, `![[${path}]]`);
  return lines.join('\n');
}

export function removeEmbedAt(source: string, embedIndex: number): string {
  const refs = getEmbedReferences(source);
  const ref = refs[embedIndex];

  if (!ref) {
    return source;
  }

  const lines = source.split(/\r?\n/);
  lines.splice(ref.line - 1, 1);
  return lines.join('\n');
}

export function removeLastEmbedPath(source: string, path: string): string {
  const ref = getEmbedReferences(source)
    .slice()
    .reverse()
    .find((candidate) => candidate.path === path);

  if (!ref) {
    return source;
  }

  const lines = source.split(/\r?\n/);
  lines.splice(ref.line - 1, 1);
  return lines.join('\n');
}

export function moveEmbedLine(source: string, path: string, fromLine: number, insertAtLineIndex: number): string {
  const lines = source.split(/\r?\n/);
  const fromIndex = fromLine - 1;

  if (fromIndex < 0 || fromIndex >= lines.length) {
    return source;
  }

  if (lines[fromIndex].trim() !== `![[${path}]]`) {
    return source;
  }

  if (insertAtLineIndex === fromIndex || insertAtLineIndex === fromIndex + 1) {
    return source;
  }

  const [embedLine] = lines.splice(fromIndex, 1);
  const adjustedInsertIndex = insertAtLineIndex > fromIndex ? insertAtLineIndex - 1 : insertAtLineIndex;
  lines.splice(clampLineIndex(adjustedInsertIndex, lines.length), 0, embedLine);
  return lines.join('\n');
}

export function duplicateEmbedAt(source: string, embedIndex: number): string {
  const refs = getEmbedReferences(source);
  const ref = refs[embedIndex];

  if (!ref) {
    return source;
  }

  const lines = source.split(/\r?\n/);
  lines.splice(ref.line, 0, `![[${ref.path}]]`);
  return lines.join('\n');
}

export function reorderEmbeds(source: string, fromIndex: number, toIndex: number): string {
  const refs = getEmbedReferences(source);

  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= refs.length ||
    toIndex >= refs.length
  ) {
    return source;
  }

  const reorderedPaths = [...refs.map((ref) => ref.path)];
  const [moved] = reorderedPaths.splice(fromIndex, 1);
  reorderedPaths.splice(toIndex, 0, moved);

  const lines = source.split(/\r?\n/);
  refs.forEach((ref, index) => {
    lines[ref.line - 1] = `![[${reorderedPaths[index]}]]`;
  });

  return lines.join('\n');
}

export function moveEmbedPath(source: string, movingPath: string, targetPath: string): string {
  if (movingPath === targetPath) {
    return source;
  }

  const refs = getEmbedReferences(source);
  const fromIndex = refs.findIndex((ref) => ref.path === movingPath);
  const toIndex = refs.findIndex((ref) => ref.path === targetPath);

  if (fromIndex === -1 || toIndex === -1) {
    return source;
  }

  return reorderEmbeds(source, fromIndex, toIndex);
}

export function replaceEmbedPath(source: string, oldPath: string, nextPath: string): string {
  if (oldPath === nextPath) {
    return source;
  }

  const refs = getEmbedReferences(source);

  if (refs.length === 0) {
    return source;
  }

  const lines = source.split(/\r?\n/);
  let changed = false;

  refs.forEach((ref) => {
    if (ref.path !== oldPath) {
      return;
    }

    lines[ref.line - 1] = `![[${nextPath}]]`;
    changed = true;
  });

  return changed ? lines.join('\n') : source;
}

function getUnsupportedEmbed(
  raw: string,
  value: string,
  line: number
): UnsupportedEmbedSegment | null {
  if (value.length === 0) {
    return { type: 'unsupported', raw, value, reason: 'Empty embed target', line };
  }

  if (value.includes('#')) {
    return { type: 'unsupported', raw, value, reason: 'Heading or block embeds are not supported', line };
  }

  if (value.includes('|')) {
    return { type: 'unsupported', raw, value, reason: 'Embed aliases are not supported', line };
  }

  if (!MARKDOWN_PATH_RE.test(value)) {
    return { type: 'unsupported', raw, value, reason: 'Only Markdown file embeds are supported', line };
  }

  return null;
}

function extractUnsupportedValue(line: string): string {
  const start = line.indexOf('![[');
  const end = line.indexOf(']]', start);

  if (start === -1 || end === -1) {
    return line.trim();
  }

  return line.slice(start + 3, end).trim();
}

function clampLineIndex(index: number, length: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), length);
}
