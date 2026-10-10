interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div style={styles.wrap}>
      <input
        type="search"
        placeholder="Search by name or notes…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search locations"
        style={styles.input}
      />
      {value && (
        <button
          aria-label="Clear search"
          onClick={() => onChange('')}
          style={styles.clear}
        >
          ×
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    padding: '8px 12px 0',
    backgroundColor: '#fff',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 32px 8px 12px',
    border: '1px solid #e5e4e7',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: 1.4,
    outline: 'none',
    fontFamily: 'inherit',
    color: '#08060d',
    backgroundColor: '#fff',
    appearance: 'none',
    WebkitAppearance: 'none',
  },
  clear: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: 'translateY(-25%)',
    background: 'none',
    border: 'none',
    fontSize: 18,
    lineHeight: 1,
    color: '#6b6375',
    cursor: 'pointer',
    padding: '0 4px',
  },
};
