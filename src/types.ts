export type MarkdownFileSource = 'imported' | 'generated';

export interface MarkdownFile {
  id: string;
  path: string;
  name: string;
  content: string;
  source: MarkdownFileSource;
  dirty: boolean;
  duplicateIndex?: number;
}

export interface TextSegment {
  type: 'text';
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface EmbedSegment {
  type: 'embed';
  raw: string;
  path: string;
  line: number;
  index: number;
}

export interface UnsupportedEmbedSegment {
  type: 'unsupported';
  raw: string;
  value: string;
  reason: string;
  line: number;
}

export type MetaSegment = TextSegment | EmbedSegment | UnsupportedEmbedSegment;

export interface EmbedReference {
  id: string;
  path: string;
  raw: string;
  line: number;
  index: number;
}
