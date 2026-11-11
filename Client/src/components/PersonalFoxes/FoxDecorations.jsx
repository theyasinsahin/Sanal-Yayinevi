import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import './PersonalFoxes.css';

const FALLBACKS = ['main h1', 'main h2', 'main h3', 'main h4', '.auth-header h3', '.notfound-title', '.admin-header h4', 'main h5', 'main h6'];

export function foxScene(pathname) {
  if (/^\/dashboard\//.test(pathname)) return { kind: 'writer', fox: 'standing', anchors: ['.editor-topbar .topbar-left', '.empty-state h4'] };
  if (/^\/book-reader\/|^\/kitap\/[^/]+\/(oku|bolum)(\/|$)/.test(pathname)) return { kind: 'reader', fox: 'plane', anchors: ['.chapter-number-label', '.sidebar-header h3'] };
  if (/^\/messages(\/|$)/.test(pathname)) return { kind: 'messages', fox: 'plane', anchors: [pathname === '/messages' ? '.conv-list-header' : '.chat-header', '.conv-list-header'] };
  if (pathname === '/') return { kind: 'welcome', fox: 'plane', anchors: ['.hero-title'] };
  if (/^\/(profile|user|yazar)(\/|$)/.test(pathname)) return { kind: 'portrait', fox: 'standing', anchors: ['.profile-header-card h2'] };
  if (/^\/(book-detail|kitap)(\/|$)/.test(pathname)) return { kind: 'bookmark', fox: 'standing', anchors: ['.book-title-lg', '.printed-book-title', '.printed-detail h1'] };
  if (/^\/(feed|printed-books|authors)(\/|$)/.test(pathname)) return { kind: 'discovery', fox: 'plane', anchors: ['.feed-header h4', '.community-page > header h1'] };
  if (/^\/(quotes|sessions|oturum)(\/|$)/.test(pathname)) return { kind: 'conversation', fox: 'standing', anchors: ['.quotes-page-title h3', '.session-detail-header h1'] };
  if (/^\/(create-book|print|donate|funding-history|payment|publisher)(\/|$)/.test(pathname)) return { kind: 'journey', fox: 'plane', anchors: ['.page-header h2', '.page-header h1'] };
  if (/^\/admin(\/|$)/.test(pathname)) return { kind: 'desk', fox: 'standing', anchors: ['.admin-header h4'] };
  return { kind: 'postcard', fox: 'standing', anchors: ['.community-page > header h1', '.auth-header h3', '.notfound-title'] };
}

const available = element => element.getClientRects().length > 0 && !element.closest('nav, footer, [role="dialog"], [aria-hidden="true"]');

// Page headings arrive asynchronously (lazy routes, book/profile queries).
// Portals use their existing whitespace instead of putting a fixed overlay on
// top of text or controls. No page needs a second layout or an extra toolbar.
export default function FoxDecorations() {
  const { pathname } = useLocation();
  const [slots, setSlots] = useState([]);

  useLayoutEffect(() => {
    const scene = foxScene(pathname);
    let mounted = [];
    let frame = null;
    const remove = () => {
      mounted.forEach(({ anchor, host, className }) => {
        host.remove(); anchor.classList.remove('personal-fox-anchor', className);
      });
      mounted = [];
    };
    const decorate = () => {
      frame = null;
      let heading;
      for (const selector of [...scene.anchors, ...FALLBACKS]) {
        heading = [...document.querySelectorAll(selector)].find(available);
        if (heading) break;
      }
      const footer = document.querySelector('.footer-brand');
      const profileCard = scene.kind === 'portrait' ? document.querySelector('.profile-header-card') : null;
      const gutter = profileCard?.getBoundingClientRect().left || 0;
      const flight = window.innerWidth >= 1100 && gutter >= 160 ? profileCard : null;
      const targets = [
        !profileCard && heading ? { anchor: heading, kind: scene.kind } : null,
        footer ? { anchor: footer, kind: 'farewell' } : null,
        flight ? { anchor: flight, kind: 'profile-flight' } : null,
        profileCard ? { anchor: profileCard, kind: 'profile-peek' } : null,
      ].filter(Boolean);
      if (mounted.length === targets.length && mounted.every((item, index) => item.anchor === targets[index].anchor && item.kind === targets[index].kind && item.host.isConnected)) {
        mounted.filter(item => item.kind === 'profile-flight').forEach(item => { item.host.style.width = `${Math.min(240, gutter - 40)}px`; });
        return;
      }
      remove();
      mounted = targets.map(({ anchor, kind }, index) => {
        const isFooter = kind === 'farewell';
        const isFlight = kind === 'profile-flight';
        const isPeek = kind === 'profile-peek';
        const fox = isPeek ? 'standing' : isFlight ? 'plane' : isFooter ? (scene.fox === 'standing' ? 'plane' : 'standing') : scene.fox;
        const className = isPeek ? 'personal-fox-peek-anchor' : isFlight ? 'personal-fox-flight-anchor' : `personal-fox-anchor--${kind}`;
        const host = document.createElement('span');
        host.className = `personal-fox-slot personal-fox-slot--${fox}${isFlight || isPeek ? ` personal-fox-slot--${kind}` : ''}`;
        if (isFlight) host.style.width = `${Math.min(240, gutter - 40)}px`;
        host.setAttribute('aria-hidden', 'true');
        anchor.classList.add(...(isFlight || isPeek ? [className] : ['personal-fox-anchor', className]));
        anchor.appendChild(host);
        return { anchor, host, className, kind, fox, key: `${pathname}:${index}` };
      });
      setSlots([...mounted]);
    };
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(decorate); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    decorate();
    return () => {
      observer.disconnect(); window.removeEventListener('resize', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
      remove();
    };
  }, [pathname]);

  return slots.map(({ host, fox, key }) => createPortal(
    <img src={`${process.env.PUBLIC_URL || ''}/images/fox/${fox}-fox.png`} alt="" draggable={false}
      width={fox === 'plane' ? 2732 : 469} height={fox === 'plane' ? 2048 : 532}
      loading="lazy" decoding="async" className="personal-fox-image" />, host, key,
  ));
}
