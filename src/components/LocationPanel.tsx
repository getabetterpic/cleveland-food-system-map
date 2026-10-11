import { Suspense, use, useEffect, useRef } from 'react';
import useIsDesktop from '../hooks/useIsDesktop';
import PhotoUpload from './PhotoUpload';
import { distanceMiles, formatMiles, type UserPosition } from '../lib/geo';
import type {
  Category,
  Contact,
  EditorContacts,
  Location,
  MarketSchedule,
} from '../lib/types';

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

// Google Maps' cross-platform URL: opens the app on phones, the site elsewhere.
// Coordinates are exact; fall back to the address for markets without them.
function directionsUrl(location: Location): string | null {
  const destination =
    location.lat !== null && location.lng !== null
      ? `${location.lat},${location.lng}`
      : location.address;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function formatSchedule(s: MarketSchedule): string {
  const hours = `${DAYS[s.day_of_week]} ${formatTime(s.opens_at)}–${formatTime(s.closes_at)}`;
  const season =
    s.season_start && s.season_end
      ? ` (${formatDate(s.season_start)} – ${formatDate(s.season_end)})`
      : '';
  return hours + season + (s.notes ? ` · ${s.notes}` : '');
}

// Import stores '2162834400' or '2162834400 x2705'.
function formatPhone(phone: string): string {
  const [digits, ext] = phone.split(' x');
  const m = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
  const base = m ? `(${m[1]}) ${m[2]}-${m[3]}` : digits;
  return ext ? `${base} ext. ${ext}` : base;
}

function ContactItem({ contact }: { contact: Contact }) {
  return (
    <li style={styles.contact}>
      {contact.name && <div style={styles.contactName}>{contact.name}</div>}
      {contact.phone && (
        <div style={styles.field}>
          <a href={`tel:${contact.phone.split(' x')[0]}`} style={styles.link}>
            {formatPhone(contact.phone)}
          </a>
        </div>
      )}
      {contact.email && (
        <div style={styles.field}>
          <a href={`mailto:${contact.email}`} style={styles.link}>
            {contact.email}
          </a>
        </div>
      )}
    </li>
  );
}

// Suspends on the streamed promise; renders nothing for non-editors (null).
function Contacts({
  contacts,
  locationId,
}: {
  contacts: EditorContacts;
  locationId: string;
}) {
  const list = use(contacts)?.[locationId];
  if (!list?.length) return null;
  return (
    <div style={styles.subsection}>
      <h4 style={styles.subheading}>Contacts</h4>
      <ul style={styles.list}>
        {list.map((c) => (
          <ContactItem key={c.id} contact={c} />
        ))}
      </ul>
    </div>
  );
}

// Everything below the rule is editor-only, labelled as such so editors know
// the public doesn't see it. Suspends on the streamed editor check.
function EditorSection({
  canEdit,
  contacts,
  location,
}: {
  canEdit: Promise<boolean>;
  contacts: EditorContacts;
  location: Location;
}) {
  if (!use(canEdit)) return null;
  return (
    <section style={styles.section} aria-labelledby="editor-heading">
      <h3 id="editor-heading" style={styles.sectionHeading}>
        Editors only
      </h3>
      <p style={styles.sectionNote}>Not shown to the public.</p>
      <PhotoUpload
        // Remount per location so a pending message doesn't carry over.
        key={location.id}
        locationId={location.id}
        hasImage={location.image_url !== null}
      />
      <Contacts contacts={contacts} locationId={location.id} />
    </section>
  );
}

interface Props {
  location: Location | null;
  contacts: EditorContacts;
  canEdit: Promise<boolean>;
  userPosition: UserPosition | null;
  onClose: () => void;
}

export default function LocationPanel({
  location,
  contacts,
  canEdit,
  userPosition,
  onClose,
}: Props) {
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
  const directions = directionsUrl(location);
  const distance =
    userPosition && location.lat !== null && location.lng !== null
      ? distanceMiles(userPosition, { lat: location.lat, lng: location.lng })
      : null;

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

          {distance !== null && (
            <p style={styles.field}>
              {formatMiles(distance)} away (straight line)
            </p>
          )}

          {directions && (
            <p style={styles.field}>
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                {location.address ?? 'Get directions'}
              </a>
            </p>
          )}

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
            <ul style={{ ...styles.list, marginTop: 12 }} aria-label="Hours">
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

          <Suspense fallback={null}>
            <EditorSection
              canEdit={canEdit}
              contacts={contacts}
              location={location}
            />
          </Suspense>
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
  // Tailwind preflight strips link color + underline; restore both.
  // #1d4ed8 on white is ~6.7:1, passes WCAG AA for body text.
  link: {
    color: '#1d4ed8',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #e5e4e7',
  },
  sectionHeading: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#6b6375',
  },
  sectionNote: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#6b6375',
  },
  subsection: {
    marginTop: 14,
  },
  subheading: {
    margin: '0 0 6px',
    fontSize: 14,
    fontWeight: 600,
    color: '#08060d',
  },
  contact: {
    marginBottom: 10,
  },
  contactName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#08060d',
  },
};
