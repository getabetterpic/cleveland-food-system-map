import { useEffect, useRef } from 'react';
import useIsDesktop from '../hooks/useIsDesktop';
import type { Category, Location, MarketSchedule } from '../lib/types';

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 'HH:MM:SS' → '8 AM' / '12:30 PM'
function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return m
    ? `${hour}:${String(m).padStart(2, '0')} ${suffix}`
    : `${hour} ${suffix}`;
}

// 'YYYY-MM-DD' → 'Jun 7'. UTC so the date doesn't shift with the viewer's zone.
function formatDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatSchedule(s: MarketSchedule): string {
  const hours = `${DAYS[s.day_of_week]} ${formatTime(s.opens_at)}–${formatTime(s.closes_at)}`;
  const season =
    s.season_start && s.season_end
      ? ` (${formatDate(s.season_start)} – ${formatDate(s.season_end)})`
      : '';
  return hours + season + (s.notes ? ` · ${s.notes}` : '');
}

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

          {location.website && (
            <p style={styles.field}>
              <a
                href={location.website}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                Website
              </a>
            </p>
          )}

          {location.schedules.length > 0 && (
            <ul style={styles.schedules} aria-label="Hours">
              {location.schedules.map((s) => (
                <li key={s.id} style={styles.field}>
                  {formatSchedule(s)}
                </li>
              ))}
            </ul>
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
  schedules: {
    listStyle: 'none',
    margin: '12px 0 0',
    padding: 0,
  },
};
