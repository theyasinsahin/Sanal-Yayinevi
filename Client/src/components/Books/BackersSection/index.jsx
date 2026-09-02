import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_BOOK_BACKERS } from '../../../graphql/queries/book';
import { Typography } from '../../UI/Typography';
import './BackersSection.css';

const MAX_VISIBLE = 7; // Yan yana gösterilecek maksimum avatar

const BackersSection = ({ bookId, backerCount }) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data, loading } = useQuery(GET_BOOK_BACKERS, {
    variables: { bookId },
    skip: !bookId,
  });

  const backers = data?.getBookBackers ?? [];
  console.log("Destekçiler:", backers);
  // Hiç destekçi yoksa bileşeni gösterme
  if (!loading && backers.length === 0) return null;

  const visibleBackers = backers.slice(0, MAX_VISIBLE);
  const remaining = Math.max(0, backers.length - MAX_VISIBLE);

  return (
    <>
      <div className="backers-section">
        <Typography variant="caption" color="muted" className="backers-label">
          {backers.length} destekçi
        </Typography>

        <div className="backers-avatars" onClick={() => setShowModal(true)}>
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="backer-avatar backer-avatar--skeleton" />
              ))
            : visibleBackers.map((backer, i) => (
                <div
                  key={backer.id}
                  className="backer-avatar"
                  style={{ zIndex: MAX_VISIBLE - i }}
                  title={backer.fullName || backer.username}
                >
                  {backer.profilePicture ? (
                    <img src={backer.profilePicture} alt={backer.username} />
                  ) : (
                    <span>
                      {(backer.fullName || backer.username || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
              ))}

          {remaining > 0 && (
            <div className="backer-avatar backer-avatar--more">
              +{remaining}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="backers-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="backers-modal" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="backers-modal-header">
              <Typography variant="h6" weight="bold">
                Destekçiler ({backers.length})
              </Typography>
              <button className="backers-modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {/* Modal Listesi */}
            <div className="backers-modal-list">
              {backers.map((backer) => {
                // Eğer API'den gelen obje yapısı farklıysa buradaki 'item.id', 'item.fullName' kısımlarını kendi datana göre eşleştirebilirsin.
                return (
                  <div 
                    key={backer.id} 
                    className="backers-modal-item"
                    onClick={() => {
                      setShowModal(false);
                      navigate(`/user/${backer.id}`); // Kullanıcı profiline yönlendirme
                    }}
                  >
                    <div className="backers-modal-avatar">
                      {backer.profilePicture ? (
                        <img src={backer.profilePicture} alt={backer.username} referrerPolicy="no-referrer" />
                      ) : (
                        <span>
                          {(backer.fullName || backer.username || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="backers-modal-info">
                      <Typography variant="caption" weight="medium">
                        {backer.fullName || backer.username}
                      </Typography>
                      {backer.fullName && (
                        <Typography variant="caption" color="muted">
                          @{backer.username}
                        </Typography>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}
      {/* MODAL BİTİŞİ */}
          </>
  );
};

export default BackersSection;