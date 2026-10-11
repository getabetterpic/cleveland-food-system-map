import { useRef, useState, useTransition } from 'react';
import { setLocationImage } from '@/app/map/actions';
import { createClient } from '@/lib/supabase/client';
import {
  LOCATION_IMAGES_BUCKET,
  prepareLocationImage,
} from '../lib/location-images';

// Editor-only. The file goes browser → Storage directly (storage RLS checks
// editor membership); the server action then records the path, or clears it
// and deletes the object on remove.
type Phase = 'preparing' | 'uploading' | 'saving' | 'removing';

const PHASE_LABEL: Record<Phase, string> = {
  preparing: 'Preparing photo…',
  uploading: 'Uploading…',
  saving: 'Saving…',
  removing: 'Removing photo…',
};

export default function PhotoUpload({
  locationId,
  hasImage,
}: {
  locationId: string;
  hasImage: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // `pending` covers the server action plus the map refresh it triggers;
  // `phase` names the step. Set phase outside startTransition — updates made
  // inside it before the first await wouldn't show until the whole thing ends.
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const working = pending || phase !== null;
  const status = phase ?? (pending ? 'saving' : null);

  const fail = (text: string) => {
    setMessage(text);
    setPhase(null);
  };

  const upload = (file: File) => {
    setMessage(null);
    setPhase('preparing');
    startTransition(async () => {
      let image: Blob;
      try {
        image = await prepareLocationImage(file);
      } catch {
        return fail("Couldn't read that image. Try a JPEG or PNG.");
      }

      setPhase('uploading');
      const path = `${locationId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await createClient()
        .storage.from(LOCATION_IMAGES_BUCKET)
        // Paths are never reused, so the CDN can cache forever.
        .upload(path, image, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        });
      if (uploadError) return fail(`Upload failed: ${uploadError.message}`);

      // Revalidates the map data; the panel re-renders with the new photo.
      setPhase('saving');
      const result = await setLocationImage(locationId, path);
      if (result?.error) return fail(result.error);
      setPhase(null); // `pending` keeps "Saving…" up until the refresh lands
    });
  };

  const remove = () => {
    // The object is deleted, not archived — no undo.
    if (!window.confirm('Remove this photo? This cannot be undone.')) return;
    setMessage(null);
    setPhase('removing');
    startTransition(async () => {
      const result = await setLocationImage(locationId, null);
      if (result?.error) return fail(result.error);
      setPhase(null);
    });
  };

  const buttonStyle = (base: React.CSSProperties) =>
    working ? { ...base, ...styles.disabled } : base;

  return (
    <div style={styles.wrap} aria-busy={working}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow re-picking the same file
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        style={buttonStyle(styles.button)}
        disabled={working}
        onClick={() => inputRef.current?.click()}
      >
        {hasImage ? 'Replace photo' : 'Add photo'}
      </button>
      {hasImage && (
        <button
          type="button"
          style={buttonStyle({ ...styles.button, ...styles.destructive })}
          disabled={working}
          onClick={remove}
        >
          Remove photo
        </button>
      )}
      {/* Always mounted so screen readers announce each phase change. */}
      <p role="status" style={styles.status}>
        {status && (
          <>
            <svg
              className="motion-safe:animate-spin"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
            </svg>
            {PHASE_LABEL[status]}
          </>
        )}
      </p>
      {message && (
        <p role="alert" style={styles.message}>
          {message}
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  button: {
    padding: '6px 12px',
    fontSize: 14,
    fontWeight: 500,
    color: '#08060d',
    background: '#fff',
    // Longhands, not `border`: destructive/disabled override borderColor, and
    // React warns when a rerender mixes a shorthand with its longhand.
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#c9c7cd',
    borderRadius: 6,
    cursor: 'pointer',
  },
  // Destructive = dark, never red (CLAUDE.md design rules).
  destructive: {
    color: '#fff',
    background: '#08060d',
    borderColor: '#08060d',
  },
  // Greyed while working; overrides both the default and destructive looks.
  disabled: {
    color: '#8a8791',
    background: '#f4f4f5',
    borderColor: '#e5e4e7',
    cursor: 'wait',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexBasis: '100%',
    margin: 0,
    fontSize: 13,
    color: '#6b6375',
  },
  message: {
    flexBasis: '100%',
    margin: 0,
    fontSize: 13,
    fontWeight: 500,
    color: '#08060d',
  },
};
