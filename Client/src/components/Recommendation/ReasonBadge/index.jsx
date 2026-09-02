// src/components/recommendation/ReasonBadge.jsx

const REASON_MAP = {
  LIKED_GENRE:      { label: 'Beğendiğin türden',       color: '#7C3AED' },
  SAVED_GENRE:      { label: 'Kaydettiğin türden',       color: '#0891B2' },
  COMMENTED_GENRE:  { label: 'Yorum yaptığın türden',    color: '#059669' },
  QUOTED_GENRE:     { label: 'Alıntı aldığın türden',    color: '#D97706' },
  ONBOARDING_GENRE: { label: 'Tercih ettiğin türden',    color: '#7C3AED' },
  SOCIAL:           { label: 'Takip ettiğin biri beğendi', color: '#DB2777' },
  NEW:              { label: 'Yeni eklendi',              color: '#16A34A' },
  POPULAR:          { label: 'Popüler',                   color: '#6B7280' },
};

export default function ReasonBadge({ reason }) {
  const meta = REASON_MAP[reason] ?? REASON_MAP.POPULAR;

  return (
    <span style={{
      display:         'inline-flex',
      alignItems:      'center',
      gap:             '4px',
      fontSize:        '11px',
      fontWeight:      500,
      padding:         '2px 8px',
      borderRadius:    '999px',
      backgroundColor: meta.color + '18',
      color:           meta.color,
      border:          `1px solid ${meta.color}30`,
      whiteSpace:      'nowrap',
    }}>
      {meta.label}
    </span>
  );
}