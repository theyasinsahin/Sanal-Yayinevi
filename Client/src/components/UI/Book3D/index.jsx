import React from 'react';
import PropTypes from 'prop-types';
import './Book3D.css';

const PLACEHOLDER = '/images/book-placeholder.svg';

/**
 * WebGL kullanmadan, yalnızca CSS transform ile çizilen 3D kitap.
 * Kapak, sırt, sayfa kenarı ve arka kapaktan oluşur. Hover eğimi
 * yalnızca hassas işaretçili (fare) cihazlarda çalışır; hareket
 * hassasiyeti açıksa kitap düz durur.
 */
export const Book3D = ({
  src,
  alt,
  size = 'md',
  angle = -24,
  tilt = true,
  float = false,
  loading = 'lazy',
  className = '',
}) => (
  <div
    className={`book3d book3d--${size}${tilt ? ' book3d--tilt' : ''}${float ? ' book3d--float' : ''} ${className}`}
    style={{ '--book-angle': `${angle}deg` }}
  >
    <div className="book3d__body">
      <span className="book3d__back" aria-hidden="true" />
      <span className="book3d__spine" aria-hidden="true" />
      <span className="book3d__pages" aria-hidden="true" />
      <div className="book3d__cover">
        <img
          src={src || PLACEHOLDER}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = PLACEHOLDER;
          }}
        />
        <span className="book3d__sheen" aria-hidden="true" />
      </div>
    </div>
    <span className="book3d__shadow" aria-hidden="true" />
  </div>
);

Book3D.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  angle: PropTypes.number,
  tilt: PropTypes.bool,
  float: PropTypes.bool,
  loading: PropTypes.oneOf(['lazy', 'eager']),
  className: PropTypes.string,
};

export default Book3D;
