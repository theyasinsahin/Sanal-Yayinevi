// src/pages/LeaderboardPage/index.jsx
import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { EmojiEvents, Person } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { GET_LEADERBOARD, GET_USER_RANK } from '../../graphql/queries/score';
import { useAuth } from '../../context/AuthContext';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import './LeaderboardPage.css';

const PERIODS = [
  { key: 'total',   label: 'Genel' },
  { key: 'monthly', label: 'Aylık' },
  { key: 'weekly',  label: 'Haftalık' },
  { key: 'daily',   label: 'Günlük' },
];

const RANK_STYLES = {
  1: { icon: '🥇', className: 'rank-gold' },
  2: { icon: '🥈', className: 'rank-silver' },
  3: { icon: '🥉', className: 'rank-bronze' },
};

// ─── Yardımcı: Google fotoğraf sorunu için güvenli avatar bileşeni ──────────
// referrerPolicy="no-referrer" : Google, referer header'ı gören istekleri reddediyor.
// onError                      : URL varsa ama yine de yüklenemezse img'yi gizle,
//                                wrapper'daki placeholder (Person ikonu) görünsün.
const SafeAvatar = ({ src, alt, className, placeholderClassName, placeholderSize = 'small' }) => {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.target.onerror = null;
          e.target.style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className={placeholderClassName}>
      <Person fontSize={placeholderSize} />
    </div>
  );
};

const LeaderboardPage = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('total');

  const { data, loading } = useQuery(GET_LEADERBOARD, {
    variables: { period },
    fetchPolicy: 'network-only',
  });

  const { data: rankData } = useQuery(GET_USER_RANK, {
    variables: { userId: user?.id, period },
    skip: !user,
  });

  const entries = data?.getLeaderboard || [];
  const userRank = rankData?.getUserRank;
  const displayPoints = (pts) => pts >= 1000 ? '999+' : pts;

  return (
    <MainLayout>
      <div className="leaderboard-page">
        <Container maxWidth="2xl">

          <div className="leaderboard-header">
            <EmojiEvents style={{ fontSize: '2.5rem', color: '#f59e0b' }} />
            <Typography variant="h3" weight="bold">Lider Tablosu</Typography>
            <Typography variant="body" color="muted">En çok puan kazanan okuyucular</Typography>

            {/* Period tabs */}
            <div className="leaderboard-tabs">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  className={`leaderboard-tab ${period === p.key ? 'active' : ''}`}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top 3 podium */}
          {!loading && entries.length >= 3 && (
            <div className="leaderboard-podium">
              {[entries[1], entries[0], entries[2]].map((entry, i) => {
                const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
                const style = RANK_STYLES[actualRank];
                return (
                  <div
                    key={entry.user?.id}
                    className={`podium-item ${style.className} ${actualRank === 1 ? 'podium-first' : ''}`}
                  >
                    <span className="podium-medal">{style.icon}</span>
                    <Link to={`/user/${entry.user?.id}`}>
                      {/* ── FIX: referrerPolicy + onError ── */}
                      <SafeAvatar
                        src={entry.user?.profilePicture}
                        alt={entry.user?.username}
                        className="podium-avatar"
                        placeholderClassName="podium-avatar-placeholder"
                        placeholderSize="medium"
                      />
                    </Link>
                    <Link to={`/user/${entry.user?.id}`} className="podium-username">
                      @{entry.user?.username}
                    </Link>
                    <span className="podium-points">{displayPoints(entry.points)} puan</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tam liste */}
          <div className="leaderboard-list">
            {loading ? (
              [...Array(10)].map((_, i) => (
                <div key={i} className="leaderboard-skeleton" />
              ))
            ) : (
              entries.map((entry) => {
                const style = RANK_STYLES[entry.rank];
                const isCurrentUser = user?.id === entry.user?.id;
                return (
                  <div
                    key={entry.user?.id}
                    className={`leaderboard-row ${isCurrentUser ? 'is-me' : ''}`}
                  >
                    <span className="leaderboard-rank">
                      {style ? style.icon : `#${entry.rank}`}
                    </span>
                    <Link to={`/user/${entry.user?.id}`} className="leaderboard-user">
                      {/* ── FIX: referrerPolicy + onError ── */}
                      <SafeAvatar
                        src={entry.user?.profilePicture}
                        alt={entry.user?.username}
                        className="leaderboard-avatar"
                        placeholderClassName="leaderboard-avatar-placeholder"
                        placeholderSize="small"
                      />
                      <div>
                        <p className="leaderboard-fullname">{entry.user?.fullName}</p>
                        <p className="leaderboard-username">@{entry.user?.username}</p>
                      </div>
                    </Link>
                    <span className="leaderboard-points">{displayPoints(entry.points)} puan</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Kullanıcının kendi sırası */}
          {user && userRank && !entries.find(e => e.user?.id === user.id) && (
            <div className="leaderboard-my-rank">
              <span className="leaderboard-rank">#{userRank.rank}</span>
              <span className="leaderboard-my-rank-label">Senin sıran</span>
              <span className="leaderboard-points">{displayPoints(userRank.points)} puan</span>
            </div>
          )}

        </Container>
      </div>
    </MainLayout>
  );
};

export default LeaderboardPage;