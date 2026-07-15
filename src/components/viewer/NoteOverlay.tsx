import type { NoteRecord, UnifiedPost } from '../../types/post';

function plainText(value: string) {
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent ?? '';
}

export function NoteOverlay({ post, notes }: { post: UnifiedPost; notes: NoteRecord[] }) {
  if (!notes.length || !post.imageWidth || !post.imageHeight) return null;
  return (
    <div className="note-overlay" aria-label="Translation notes" style={{ '--note-aspect': post.imageWidth / post.imageHeight } as React.CSSProperties}>
      {notes.map((note) => <span className="image-note" key={note.id} style={{ left: `${note.x / post.imageWidth * 100}%`, top: `${note.y / post.imageHeight * 100}%`, width: `${note.width / post.imageWidth * 100}%`, height: `${note.height / post.imageHeight * 100}%` }}><span>{plainText(note.body)}</span></span>)}
    </div>
  );
}
