// src/components/recommendation/GenreOnboarding.jsx
import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { useUserPreference } from '../../../hooks/useRecommendations';

const GET_ALL_GENRES = gql`
  query {
    getAllGenres {
      id
      name
      hexColor
      description
    }
  }
`;

export default function GenreOnboarding({ onComplete }) {
  const [selected, setSelected] = useState(new Set());
  const { data, loading } = useQuery(GET_ALL_GENRES);
  const { savePreference, saving } = useUserPreference();

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    try {
        await savePreference([...selected]); // awaitRefetchQueries:true ile bitmesini bekle
        onComplete?.();                      // cache güncellendi, şimdi callback'i çağır
    } catch (err) {
        console.error('Tercih kaydedilemedi:', err);
    }
  };

  if (loading) return null;

  const genres = data?.getAllGenres ?? [];

  return (
    <div style={{
      maxWidth:  '520px',
      margin:    '0 auto',
      padding:   '32px 24px',
    }}>
      <h2 style={{
        margin:     '0 0 8px',
        fontSize:   '20px',
        fontWeight: 500,
        color:      'var(--color-text-primary)',
      }}>
        Hangi türleri seviyorsun?
      </h2>
      <p style={{
        margin:   '0 0 24px',
        fontSize: '14px',
        color:    'var(--color-text-secondary)',
      }}>
        En az birini seç, sana özel öneriler hazırlayalım.
      </p>

      <div style={{
        display:   'flex',
        flexWrap:  'wrap',
        gap:       '10px',
        marginBottom: '28px',
      }}>
        {genres.map((genre) => {
          const isSelected = selected.has(genre.id);
          const color = genre.hexColor ?? 'var(--primary)';

          return (
            <button
              key={genre.id}
              onClick={() => toggle(genre.id)}
              style={{
                padding:         '8px 16px',
                borderRadius:    '999px',
                border:          `1.5px solid ${isSelected ? color : 'var(--color-border-secondary)'}`,
                backgroundColor: isSelected ? color + '18' : 'transparent',
                color:           isSelected ? color : 'var(--color-text-secondary)',
                fontSize:        '13px',
                fontWeight:      isSelected ? 500 : 400,
                cursor:          'pointer',
                transition:      'all 0.15s',
              }}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={selected.size === 0 || saving}
        style={{
          width:           '100%',
          padding:         '12px',
          borderRadius:    '10px',
          border:          'none',
          backgroundColor: selected.size > 0 ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
          color:           selected.size > 0 ? 'var(--color-background-primary)' : 'var(--color-text-tertiary)',
          fontSize:        '14px',
          fontWeight:      500,
          cursor:          selected.size === 0 || saving ? 'not-allowed' : 'pointer',
          transition:      'all 0.15s',
        }}
      >
        {saving ? 'Kaydediliyor...' : `Devam et ${selected.size > 0 ? `(${selected.size} tür)` : ''}`}
      </button>
    </div>
  );
}