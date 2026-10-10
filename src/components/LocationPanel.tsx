import { useEffect, useRef } from 'react';
import useIsDesktop from '../hooks/useIsDesktop';
import type { Category, Location } from '../lib/types';

const CATEGORY_LABEL: Record<Category, string> = {
  garden: 'Community Garden',
  farm: 'Urban Farm',
  market: 'Farmers Market / Farm Stand',
};

const CATEGORY_COLOR: Record<Category, string> = {
  garden: '#3a7d44',
  farm: '#c0392b',
  market: '#7b2d8b',
};

interface Props {
  location: Location | null;
  onClose: () => void;
}

export default function LocationPanel({ location, onClose }: Props) {
  const isDesktop = useIsDesktop();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (location) {
      previousFocusRef.current = document.activeElement;
      closeRef.current?.focus();
    } else if (previousFocusRef.current instanceof HTMLElement) {
      previousFocusRef.current.focus();
    }
  }, [location]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && location) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [location, onClose]);

  if (!location) return null;

  const color = CATEGORY_COLOR[location.category];

  const panelStyle: React.CSSProperties = isDesktop
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 320,
        zIndex: 1200,
        backgroundColor: '#fff',
        overflowY: 'auto',
        boxShadow: '2px 0 16px rgba(0,0,0,0.15)',
      }
    : {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '50dvh',
        zIndex: 1200,
        backgroundColor: '#fff',
        overflowY: 'auto',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -2px 16px rgba(0,0,0,0.15)',
      };

  return (
    <>
      {/* Mobile only: tap backdrop to close */}
      {!isDesktop && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100 }}
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={location.name}
      >
        <button
          ref={closeRef}
          style={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {location.image_url && (
          <img
            src={location.image_url}
            alt={location.name}
            style={styles.image}
          />
        )}

        <div style={styles.body}>
          <span style={{ ...styles.tag, backgroundColor: color }}>
            {CATEGORY_LABEL[location.category]}
          </span>

          <h2 style={styles.name}>{location.name}</h2>

          {location.address && <p style={styles.field}>{location.address}</p>}

          {location.manager_name && (
            <p style={styles.field}>
              <strong>Manager:</strong> {location.manager_name}
            </p>
          )}

          {location.phone && (
            <p style={styles.field}>
              <a href={`tel:${location.phone}`} style={styles.link}>
                {location.phone}
              </a>
            </p>
          )}

          {location.email && (
            <p style={styles.field}>
              <a href={`mailto:${location.email}`} style={styles.link}>
                {location.email}
              </a>
            </p>
          )}

          {location.notes && (
            <p style={{ ...styles.field, marginTop: 12 }}>{location.notes}</p>
          )}
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
    background: 'none',
    border: 'none',
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    color: '#6b6375',
    padding: '0 4px',
    zIndex: 1,
  },
  image: {
    width: '100%',
    maxHeight: 180,
    objectFit: 'cover',
    display: 'block',
  },
  body: {
    padding: '14px 16px 20px',
  },
  tag: {
    display: 'inline-block',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 4,
    marginBottom: 8,
  },
  name: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 600,
    color: '#08060d',
    paddingRight: 24,
  },
  field: {
    margin: '4px 0',
    fontSize: 14,
    color: '#6b6375',
    lineHeight: 1.5,
  },
  link: {
    color: '#08060d',
  },
};
