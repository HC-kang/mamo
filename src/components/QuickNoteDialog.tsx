import { useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchStore } from '../store/workbenchStore';

interface QuickNoteDialogProps {
  onClose: () => void;
}

export function QuickNoteDialog({ onClose }: QuickNoteDialogProps) {
  const createQuickNote = useWorkbenchStore((state) => state.createQuickNote);
  const [title, setTitle] = useState('');
  const [filename, setFilename] = useState('');
  const [body, setBody] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createQuickNote({ title, filename, body });
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={handleSubmit} aria-label="Create quick note">
        <div className="modal-header">
          <h2>Quick note</h2>
          <button type="button" className="icon-only" onClick={onClose} title="Close">
            <X aria-hidden="true" />
          </button>
        </div>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Filename</span>
          <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="inbox/note.md" />
        </label>
        <label className="field">
          <span>Markdown</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="text-button primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
