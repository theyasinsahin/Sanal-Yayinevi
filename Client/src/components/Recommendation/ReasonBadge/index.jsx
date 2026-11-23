import './ReasonBadge.css';

// Öneri nedeni etiketi. Tonlar paletle sınırlı: kişisel nedenler turuncu,
// sosyal/genel nedenler bordo.
const REASON_MAP = {
  LIKED_GENRE:      { label: 'Beğendiğin türden',          tone: 'ember' },
  SAVED_GENRE:      { label: 'Kaydettiğin türden',          tone: 'ember' },
  COMMENTED_GENRE:  { label: 'Yorum yaptığın türden',       tone: 'ember' },
  QUOTED_GENRE:     { label: 'Alıntı aldığın türden',       tone: 'ember' },
  ONBOARDING_GENRE: { label: 'Tercih ettiğin türden',       tone: 'ember' },
  SOCIAL:           { label: 'Takip ettiğin biri beğendi',  tone: 'wine' },
  NEW:              { label: 'Yeni eklendi',                tone: 'wine' },
  POPULAR:          { label: 'Popüler',                     tone: 'neutral' },
};

export default function ReasonBadge({ reason }) {
  const meta = REASON_MAP[reason] ?? REASON_MAP.POPULAR;
  return <span className={`reason-badge reason-badge--${meta.tone}`}>{meta.label}</span>;
}
