import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PreviewPanel } from './PreviewPanel';
import { initialMetaSource, useWorkbenchStore } from '../store/workbenchStore';
import type { MarkdownFile } from '../types';

function file(path: string, content: string): MarkdownFile {
  return {
    id: path,
    path,
    name: path,
    content,
    source: 'imported',
    dirty: false
  };
}

describe('PreviewPanel', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({ files: [], metaSource: initialMetaSource, currentMetaPath: null });
  });

  it('edits the root document directly from the document surface', () => {
    render(<PreviewPanel />);

    fireEvent.change(screen.getByLabelText('Edit document section 1'), { target: { value: '# Revised' } });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Revised');
  });

  it('turns --doc-- into a new embedded markdown file', () => {
    render(<PreviewPanel />);

    fireEvent.change(screen.getByLabelText('Edit document section 1'), {
      target: { value: '# First block\n\n--doc--\n\n# Second block' }
    });

    const state = useWorkbenchStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.files[0].content).toBe('# Second block');
    expect(state.metaSource).toBe(`# First block\n\n![[${state.files[0].path}]]`);
    expect(state.metaSource).not.toContain('--doc--');
  });

  it('turns --앷-- into a new embedded markdown file', () => {
    render(<PreviewPanel />);

    fireEvent.change(screen.getByLabelText('Edit document section 1'), {
      target: { value: '# First block\n\n--앷--\n\n# Second block' }
    });

    const state = useWorkbenchStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.files[0].content).toBe('# Second block');
    expect(state.metaSource).toBe(`# First block\n\n![[${state.files[0].path}]]`);
    expect(state.metaSource).not.toContain('--앷--');
  });

  it('shows file wrappers in the editor and a rendered preview beside it', () => {
    useWorkbenchStore.setState({
      files: [file('a.md', '# Hidden until visible')],
      metaSource: '# Article\n\n![[a.md]]'
    });

    render(<PreviewPanel />);

    const editor = screen.getByLabelText('Document editor');
    const preview = screen.getByLabelText('Markdown preview');

    expect(within(editor).getByLabelText('document file section')).toBeInTheDocument();
    expect(within(editor).getByLabelText('a.md file section')).toBeInTheDocument();
    expect(within(editor).getByLabelText('Edit a.md section 1')).toBeInTheDocument();
    expect(within(preview).getByText('Hidden until visible')).toBeInTheDocument();
    expect(screen.queryByText('Embedded file: a.md')).not.toBeInTheDocument();
  });

  it('uses embedded file titles as drag handles and exposes rename action', () => {
    useWorkbenchStore.setState({
      files: [file('document/child.md', '# Child')],
      metaSource: '# Article\n\n![[document/child.md]]'
    });

    render(<PreviewPanel />);

    expect(screen.getByRole('button', { name: 'document/child.md' })).toHaveClass('file-editor-title-handle');
    expect(screen.getByTitle('Rename file')).toBeInTheDocument();
    expect(screen.getByTitle('Remove this reference from document')).toBeInTheDocument();
  });

  it('removes only the selected embedded reference from the editor wrapper', () => {
    useWorkbenchStore.setState({
      files: [file('document/child.md', '# Child')],
      metaSource: '# Article\n\n![[document/child.md]]'
    });

    render(<PreviewPanel />);

    fireEvent.click(screen.getByTitle('Remove this reference from document'));

    const state = useWorkbenchStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.metaSource).toBe('# Article\n');
    expect(screen.queryByLabelText('document/child.md file section')).not.toBeInTheDocument();
  });

  it('renames an embedded file from the editor title action', () => {
    useWorkbenchStore.setState({
      files: [file('document/child.md', '# Child')],
      metaSource: '# Article\n\n![[document/child.md]]'
    });

    render(<PreviewPanel />);

    fireEvent.click(screen.getByTitle('Rename file'));
    const renameInput = screen.getByLabelText('Rename document/child.md');
    fireEvent.change(renameInput, { target: { value: 'document/renamed' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    const state = useWorkbenchStore.getState();
    expect(state.files[0].path).toBe('document/renamed.md');
    expect(state.metaSource).toBe('# Article\n\n![[document/renamed.md]]');
  });

  it('highlights the dragged file in the editor and rendered preview', () => {
    useWorkbenchStore.setState({
      files: [file('a.md', '# Highlighted child')],
      metaSource: '# Article\n\n![[a.md]]'
    });

    render(<PreviewPanel highlightPath="a.md" />);

    expect(screen.getByLabelText('a.md file section')).toHaveClass('is-highlighted');
    expect(screen.getByText('Highlighted child').closest('[data-rendered-embed-path="a.md"]')).toHaveClass('is-highlighted');
  });

  it('uses the drag preview source to show the pending document order', () => {
    useWorkbenchStore.setState({
      files: [file('a.md', '# A'), file('b.md', '# B')],
      metaSource: '![[a.md]]\n![[b.md]]'
    });

    render(<PreviewPanel metaSourceOverride={'![[b.md]]\n![[a.md]]'} />);

    const preview = screen.getByLabelText('Markdown preview');
    const previewText = preview.textContent ?? '';
    expect(previewText.indexOf('B')).toBeLessThan(previewText.indexOf('A'));
  });

  it('shows missing and unsupported embed warnings', () => {
    useWorkbenchStore.setState({
      files: [],
      metaSource: '![[missing.md]]\n![[image.png]]'
    });

    render(<PreviewPanel />);

    expect(screen.getAllByText('Missing embed: missing.md').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unsupported embed syntax: image.png').length).toBeGreaterThan(0);
  });

  it('edits an embedded file directly from the document surface', () => {
    useWorkbenchStore.setState({
      files: [file('a.md', '# Original')],
      metaSource: '# Article\n\n![[a.md]]'
    });

    render(<PreviewPanel />);

    const editor = screen.getByLabelText('Edit a.md section 1');
    fireEvent.change(editor, { target: { value: '# Revised' } });

    const [updated] = useWorkbenchStore.getState().files;
    expect(updated.content).toBe('# Revised');
    expect(updated.dirty).toBe(true);
  });

  it('moves the caret down and up across document file boundaries', () => {
    useWorkbenchStore.setState({
      files: [file('a.md', '# Child')],
      metaSource: '# Parent\n\n![[a.md]]'
    });

    render(<PreviewPanel />);

    const parent = screen.getByLabelText('Edit document section 1') as HTMLTextAreaElement;
    const child = screen.getByLabelText('Edit a.md section 1') as HTMLTextAreaElement;

    parent.focus();
    parent.setSelectionRange(parent.value.length, parent.value.length);
    fireEvent.keyDown(parent, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(child);

    child.setSelectionRange(0, 0);
    fireEvent.keyDown(child, { key: 'ArrowUp' });

    expect(document.activeElement).toBe(parent);
  });

  it('moves out to the nearest parent slots when navigating from a deeply nested block', () => {
    useWorkbenchStore.setState({
      files: [file('middle.md', '![[inner.md]]'), file('inner.md', '# Inner')],
      metaSource: '# Root\n\n![[middle.md]]'
    });

    render(<PreviewPanel />);

    const inner = screen.getByLabelText('Edit inner.md section 1') as HTMLTextAreaElement;
    const middleBefore = screen.getByLabelText('Edit middle.md gap 1') as HTMLTextAreaElement;
    const middleAfter = screen.getByLabelText('Edit middle.md gap 2') as HTMLTextAreaElement;

    inner.focus();
    inner.setSelectionRange(0, 0);
    fireEvent.keyDown(inner, { key: 'ArrowUp' });

    expect(document.activeElement).toBe(middleBefore);

    inner.focus();
    inner.setSelectionRange(inner.value.length, inner.value.length);
    fireEvent.keyDown(inner, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(middleAfter);
  });

  it('creates trailing space in the parent file when moving down from a nested block bottom', async () => {
    useWorkbenchStore.setState({
      files: [file('middle.md', '![[inner.md]]'), file('inner.md', '# Inner')],
      metaSource: '# Root\n\n![[middle.md]]'
    });

    render(<PreviewPanel />);

    const inner = screen.getByLabelText('Edit inner.md section 1') as HTMLTextAreaElement;
    inner.focus();
    inner.setSelectionRange(inner.value.length, inner.value.length);
    fireEvent.keyDown(inner, { key: 'ArrowDown' });

    const parentSlot = screen.getByLabelText('Edit middle.md gap 2') as HTMLTextAreaElement;
    fireEvent.change(parentSlot, { target: { value: '# Middle after' } });

    await waitFor(() => expect(useWorkbenchStore.getState().files[0].content).toBe('![[inner.md]]\n# Middle after'));
    expect(useWorkbenchStore.getState().files[1].content).toBe('# Inner');
  });

  it('keeps focus after typing the first character into a generated parent gap', async () => {
    useWorkbenchStore.setState({
      files: [file('child.md', '# Child')],
      metaSource: '# Parent\n\n![[child.md]]'
    });

    render(<PreviewPanel />);

    const parentGap = screen.getByLabelText('Edit document gap 1') as HTMLTextAreaElement;
    parentGap.focus();
    fireEvent.change(parentGap, {
      target: { value: 'a', selectionStart: 1, selectionEnd: 1 }
    });

    const lowerParent = (await screen.findByLabelText('Edit document section 3')) as HTMLTextAreaElement;

    expect(document.activeElement).toBe(lowerParent);
    expect(lowerParent.selectionStart).toBe(1);
    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]\na');
  });

  it('waits for IME composition to finish before converting a slot into a text editor', async () => {
    useWorkbenchStore.setState({
      files: [file('child.md', '# Child')],
      metaSource: '# Parent\n\n![[child.md]]'
    });

    render(<PreviewPanel />);

    const parentGap = screen.getByLabelText('Edit document gap 1') as HTMLTextAreaElement;
    parentGap.focus();
    fireEvent.compositionStart(parentGap);
    fireEvent.change(parentGap, {
      target: { value: 'ㄱ', selectionStart: 1, selectionEnd: 1 }
    });
    fireEvent.change(parentGap, {
      target: { value: '가', selectionStart: 1, selectionEnd: 1 }
    });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]');

    fireEvent.compositionEnd(parentGap);

    const lowerParent = (await screen.findByLabelText('Edit document section 3')) as HTMLTextAreaElement;

    expect(document.activeElement).toBe(lowerParent);
    expect(lowerParent.value).toBe('가');
    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]\n가');
  });

  it('keeps the slot mounted until Korean input is idle so the second syllable is preserved', async () => {
    useWorkbenchStore.setState({
      files: [file('child.md', '# Child')],
      metaSource: '# Parent\n\n![[child.md]]'
    });

    render(<PreviewPanel />);

    const parentGap = screen.getByLabelText('Edit document gap 1') as HTMLTextAreaElement;
    parentGap.focus();
    fireEvent.compositionStart(parentGap);
    fireEvent.change(parentGap, {
      target: { value: '가', selectionStart: 1, selectionEnd: 1 }
    });
    fireEvent.compositionEnd(parentGap);

    expect(parentGap.value).toBe('가');
    fireEvent.compositionStart(parentGap);
    fireEvent.change(parentGap, {
      target: { value: '가ㄴ', selectionStart: 2, selectionEnd: 2 }
    });
    fireEvent.change(parentGap, {
      target: { value: '가나', selectionStart: 2, selectionEnd: 2 }
    });
    fireEvent.compositionEnd(parentGap);

    expect(parentGap.value).toBe('가나');
    fireEvent.compositionStart(parentGap);
    fireEvent.change(parentGap, {
      target: { value: '가나다', selectionStart: 3, selectionEnd: 3 }
    });
    fireEvent.compositionEnd(parentGap);

    const lowerParent = (await screen.findByLabelText('Edit document section 3')) as HTMLTextAreaElement;
    expect(document.activeElement).toBe(lowerParent);

    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]\n가나다');
    expect(lowerParent.value).toBe('가나다');
  });

  it('does not create a blank line when moving down past the last editor', () => {
    render(<PreviewPanel />);

    const editor = screen.getByLabelText('Edit document section 1') as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    fireEvent.keyDown(editor, { key: 'ArrowDown' });

    expect(useWorkbenchStore.getState().metaSource).toBe(initialMetaSource);
  });

  it('collapses an empty document gap when pressing backspace', () => {
    useWorkbenchStore.setState({
      files: [file('middle.md', '![[inner.md]]'), file('inner.md', '# Inner')],
      metaSource: '# Root\n\n![[middle.md]]'
    });

    render(<PreviewPanel />);

    const middleAfter = screen.getByLabelText('Edit middle.md gap 2') as HTMLTextAreaElement;
    const inner = screen.getByLabelText('Edit inner.md section 1') as HTMLTextAreaElement;

    middleAfter.focus();
    middleAfter.setSelectionRange(0, 0);
    fireEvent.keyDown(middleAfter, { key: 'Backspace' });

    expect(document.activeElement).toBe(inner);
    expect(useWorkbenchStore.getState().files[0].content).toBe('![[inner.md]]');
  });

  it('removes the final empty line with backspace', () => {
    useWorkbenchStore.setState({ files: [], metaSource: '# Root\n', currentMetaPath: null });
    render(<PreviewPanel />);

    const editor = screen.getByLabelText('Edit document section 1') as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    fireEvent.keyDown(editor, { key: 'Backspace' });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Root');
  });

  it('keeps an emptied lower parent section active until a second deletion key press', () => {
    useWorkbenchStore.setState({
      files: [file('child.md', '# Child')],
      metaSource: '# Parent\n\n![[child.md]]\na'
    });

    render(<PreviewPanel />);

    const lowerParent = screen.getByLabelText('Edit document section 3') as HTMLTextAreaElement;
    const child = screen.getByLabelText('Edit child.md section 1') as HTMLTextAreaElement;

    lowerParent.focus();
    lowerParent.setSelectionRange(lowerParent.value.length, lowerParent.value.length);
    fireEvent.keyDown(lowerParent, { key: 'Backspace' });

    fireEvent.change(lowerParent, {
      target: { value: '', selectionStart: 0, selectionEnd: 0 }
    });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]\n');
    expect(document.activeElement).toBe(lowerParent);
    expect(screen.getByLabelText('Edit document section 3')).toBeInTheDocument();

    fireEvent.keyDown(lowerParent, { key: 'Backspace' });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]');
    expect(document.activeElement).toBe(child);
    expect(screen.queryByLabelText('Edit document section 3')).not.toBeInTheDocument();
  });

  it('collapses an already empty lower parent section with delete', () => {
    useWorkbenchStore.setState({
      files: [file('child.md', '# Child')],
      metaSource: '# Parent\n\n![[child.md]]\n'
    });

    render(<PreviewPanel />);

    const lowerParent = screen.getByLabelText('Edit document section 3') as HTMLTextAreaElement;
    const child = screen.getByLabelText('Edit child.md section 1') as HTMLTextAreaElement;

    lowerParent.focus();
    lowerParent.setSelectionRange(0, 0);
    fireEvent.keyDown(lowerParent, { key: 'Delete' });

    expect(useWorkbenchStore.getState().metaSource).toBe('# Parent\n\n![[child.md]]');
    expect(document.activeElement).toBe(child);
    expect(screen.queryByLabelText('Edit document section 3')).not.toBeInTheDocument();
  });

  it('does not move focus across blocks while IME composition is active', () => {
    useWorkbenchStore.setState({
      files: [file('child.md', '# Child')],
      metaSource: '# Parent\n\n![[child.md]]'
    });

    render(<PreviewPanel />);

    const parent = screen.getByLabelText('Edit document section 1') as HTMLTextAreaElement;

    parent.focus();
    parent.setSelectionRange(parent.value.length, parent.value.length);
    fireEvent.keyDown(parent, { key: 'ArrowDown', keyCode: 229 });

    expect(document.activeElement).toBe(parent);
  });
});
