// src/components/ParagraphComment/ParagraphRenderer/index.jsx
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { ChatBubbleOutline, Bookmark, BookmarkBorder } from '@mui/icons-material';
import { GET_PARAGRAPH_COMMENT_COUNTS } from '../../../graphql/queries/paragraphComment';
import ParagraphCommentPanel from '../ParagraphCommentPanel';
import './ParagraphRenderer.css';

const ParagraphRenderer = ({ 
  content, 
  bookId, 
  chapterId,
  bookmark,        // { paragraphIndex } — mevcut ayraç
  onSetBookmark,   // (paragraphIndex) => void
  onRemoveBookmark // () => void
}) => {
  const [openPanelIndex, setOpenPanelIndex] = useState(null);
  const blockRefs = useRef({});

  const { data: countsData, refetch: refetchCounts } = useQuery(
    GET_PARAGRAPH_COMMENT_COUNTS,
    { variables: { chapterId }, skip: !chapterId }
  );

  const countsMap = useMemo(() => {
    const map = {};
    (countsData?.getParagraphCommentCounts || []).forEach(({ paragraphIndex, count }) => {
      map[paragraphIndex] = count;
    });
    return map;
  }, [countsData]);

  const segments = useMemo(() => {
    if (!content) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const nodes = Array.from(doc.body.childNodes);
    let paragraphIndex = 0;
    return nodes.map((node) => {
      if (node.nodeName === 'P') {
        const html = node.outerHTML;
        const idx = paragraphIndex++;
        return { type: 'paragraph', html, index: idx };
      }
      const div = document.createElement('div');
      div.appendChild(node.cloneNode(true));
      return { type: 'other', html: div.innerHTML };
    });
  }, [content]);

  const handleToggle = (index) => {
    setOpenPanelIndex(prev => prev === index ? null : index);
  };

  const handleKeyDown = useCallback((e, index) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (openPanelIndex !== index) {
        e.preventDefault();
        const el = blockRefs.current[index];
        if (el) {
          const twoLines = parseFloat(getComputedStyle(el).lineHeight || '28') * 2;
          window.scrollBy({ top: twoLines, behavior: 'smooth' });
        }
      }
    }
  }, [openPanelIndex]);

  const handleTouch = useCallback((e, index) => {
    if (openPanelIndex !== index) {
      const el = blockRefs.current[index];
      if (el) {
        const twoLines = parseFloat(getComputedStyle(el).lineHeight || '28') * 2;
        window.scrollBy({ top: twoLines, behavior: 'smooth' });
      }
    }
  }, [openPanelIndex]);

  const bookmarkRef = useCallback((el, index) => {
  blockRefs.current[index] = el;
}, []);

  return (
    <div className="paragraph-renderer">
      {segments.map((segment, i) => {
        if (segment.type === 'other') {
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: segment.html }} />
          );
        }

        const count = countsMap[segment.index] || 0;
        const isOpen = openPanelIndex === segment.index;
        const isBookmarked = bookmark?.paragraphIndex === segment.index;

        return (
          <div
            key={i}
            className={`paragraph-block ${isBookmarked ? 'has-bookmark' : ''}`}
            ref={(el) => { blockRefs.current[segment.index] = el; }}
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, segment.index)}
            onTouchEnd={(e) => handleTouch(e, segment.index)}
          >
            {/* Ayraç göstergesi */}
            {isBookmarked && (
              <div className="paragraph-bookmark-indicator">
                <Bookmark fontSize="inherit" />
                <span>Kaldığın yer</span>
              </div>
            )}

            {/* Paragraf içeriği */}
            <div
              className="paragraph-content"
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />

            {/*
              Aksiyon satırı — ayraç + yorum.
              onTouchEnd burada durduruluyor (stopPropagation), çünkü
              üstteki paragraph-block'un kendi onTouchEnd'i "dokununca
              aşağı kaydır" özelliğini tetikliyor. Bu satır olmadan,
              yorum/ayraç ikonuna dokunma da o kaydırmayı tetikliyordu.
            */}
            <div
              className="paragraph-action-row"
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {/* Ayraç butonu */}
              {onSetBookmark && (
                <button
                  className={`paragraph-bookmark-btn ${isBookmarked ? 'active' : ''}`}
                  onClick={() => isBookmarked ? onRemoveBookmark() : onSetBookmark(segment.index)}
                  title={isBookmarked ? 'Ayracı kaldır' : 'Ayraç koy'}
                >
                  {isBookmarked 
                    ? <Bookmark fontSize="inherit" /> 
                    : <BookmarkBorder fontSize="inherit" />
                  }
                </button>
              )}

              {/* Yorum butonu */}
              <button
                className={`paragraph-comment-trigger ${isOpen ? 'active' : ''} ${count > 0 ? 'has-comments' : ''}`}
                onClick={() => handleToggle(segment.index)}
                title={`${count} yorum`}
              >
                <ChatBubbleOutline fontSize="inherit" />
                {count > 0 && (
                  <span className="paragraph-comment-count">{count}</span>
                )}
              </button>
            </div>

            {/*
              Yorum paneli — kendi onTouchEnd'inde de stopPropagation var
              (ParagraphCommentPanel/index.jsx içinde), böylece panel
              içindeki dokunmalar (kapat, sil, textarea, gönder) da
              paragrafı kaydırmaz.
            */}
            {isOpen && (
              <ParagraphCommentPanel
                bookId={bookId}
                chapterId={chapterId}
                paragraphIndex={segment.index}
                onClose={() => setOpenPanelIndex(null)}
                onCommentAdded={refetchCounts}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ParagraphRenderer;