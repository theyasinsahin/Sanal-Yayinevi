import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Bu dosya yalnızca React.lazy ile yüklenir; three.js ana pakete girmez.

const WINE = '#780038';
const WINE_DEEP = '#55002A';
const EMBER = '#E63B11';
const PAPER = '#FFFBFB';

const BOOK = { w: 2, h: 3, d: 0.38, board: 0.035 };
const FLIP_MS = 1300;
const PLACEHOLDER = '/images/book-placeholder.svg';

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Sayfa kenarı: ince yatay çizgili kağıt dokusu (canvas ile üretilir)
function makePageEdgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = `rgba(87, 74, 74, ${0.08 + Math.random() * 0.1})`;
    ctx.fillRect(0, y, 64, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Zemin gölgesi: yumuşak bordo elips
function makeShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(85, 0, 42, 0.45)');
  gradient.addColorStop(1, 'rgba(85, 0, 42, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

// Kapak, kağıt renginde bir tuvale çizilir: saydam PNG kapaklar siyah görünmez
function coverTexture(image) {
  const width = image.naturalWidth || image.width || 512;
  const height = image.naturalHeight || image.height || 768;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function loadCover(url) {
  return new Promise(resolve => {
    const loader = new THREE.ImageLoader();
    loader.setCrossOrigin('anonymous');
    const done = image => {
      try { resolve(coverTexture(image)); } catch { resolve(null); }
    };
    loader.load(url || PLACEHOLDER, done, undefined, () => {
      loader.load(PLACEHOLDER, done, undefined, () => resolve(null));
    });
  });
}

function Book({ coverUrl, flipKey, pointer, onActivate, onReady }) {
  const group = useRef();
  const coverMaterial = useRef();
  const flip = useRef({ start: -1, swapped: true, pending: null });
  const baseY = useRef(-0.45);
  const textures = useRef(new Map());
  const pageEdge = useMemo(makePageEdgeTexture, []);
  const { invalidate } = useThree();

  // Kapak dokusunu önbellekle; kitap değişince çevirme animasyonu başlar
  useEffect(() => {
    let cancelled = false;
    const cached = textures.current.get(coverUrl);
    const apply = texture => {
      if (cancelled || !texture) return;
      textures.current.set(coverUrl, texture);
      if (flip.current.start < 0 && !coverMaterial.current.map) {
        coverMaterial.current.map = texture;
        coverMaterial.current.needsUpdate = true;
        onReady?.();
      } else {
        flip.current = { start: performance.now(), swapped: false, pending: texture };
      }
      invalidate();
    };
    if (cached) apply(cached); else loadCover(coverUrl).then(apply);
    return () => { cancelled = true; };
  }, [coverUrl, flipKey, invalidate, onReady]);

  useEffect(() => () => {
    textures.current.forEach(texture => texture.dispose());
    pageEdge.dispose();
  }, [pageEdge]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = group.current;
    if (!g) return;

    // Boşta salınım + imleç eğimi
    let spin = 0;
    const f = flip.current;
    if (f.start >= 0) {
      const progress = Math.min(1, (performance.now() - f.start) / FLIP_MS);
      spin = easeInOut(progress) * Math.PI * 2;
      // Arka kapak kameraya döndüğünde ön kapak dokusu değişir
      if (!f.swapped && progress >= 0.5 && f.pending) {
        coverMaterial.current.map = f.pending;
        coverMaterial.current.needsUpdate = true;
        f.swapped = true;
      }
      if (progress >= 1) flip.current = { start: -1, swapped: true, pending: null };
    }

    const targetY = -0.45 + Math.sin(t * 0.35) * 0.18 + pointer.current.x * 0.35;
    const targetX = 0.08 + pointer.current.y * 0.14;
    baseY.current = THREE.MathUtils.lerp(baseY.current, targetY, 0.06);
    g.rotation.y = baseY.current + spin;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetX, 0.06);
    g.position.y = Math.sin(t * 0.8) * 0.06;
  });

  const half = BOOK.d / 2;
  return (
    <group ref={group} onClick={onActivate}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}>
      {/* Sayfa bloğu */}
      <mesh>
        <boxGeometry args={[BOOK.w - 0.06, BOOK.h - 0.08, BOOK.d - BOOK.board * 2]} />
        <meshStandardMaterial map={pageEdge} roughness={0.95} />
      </mesh>
      {/* Ön kapak */}
      <mesh position={[0, 0, half - BOOK.board / 2]}>
        <boxGeometry args={[BOOK.w, BOOK.h, BOOK.board]} />
        <meshStandardMaterial attach="material-0" color={WINE} roughness={0.6} />
        <meshStandardMaterial attach="material-1" color={WINE} roughness={0.6} />
        <meshStandardMaterial attach="material-2" color={WINE} roughness={0.6} />
        <meshStandardMaterial attach="material-3" color={WINE} roughness={0.6} />
        <meshStandardMaterial attach="material-4" ref={coverMaterial} color="#ffffff" roughness={0.45} metalness={0.02} />
        <meshStandardMaterial attach="material-5" color={WINE} roughness={0.6} />
      </mesh>
      {/* Arka kapak */}
      <mesh position={[0, 0, -half + BOOK.board / 2]}>
        <boxGeometry args={[BOOK.w, BOOK.h, BOOK.board]} />
        <meshStandardMaterial color={WINE_DEEP} roughness={0.55} />
      </mesh>
      {/* Sırt + turuncu şerit */}
      <mesh position={[-BOOK.w / 2 + BOOK.board / 2, 0, 0]}>
        <boxGeometry args={[BOOK.board, BOOK.h, BOOK.d]} />
        <meshStandardMaterial color={WINE_DEEP} roughness={0.5} />
      </mesh>
      <mesh position={[-BOOK.w / 2 - 0.001, BOOK.h * 0.32, 0]}>
        <boxGeometry args={[0.004, 0.12, BOOK.d * 0.98]} />
        <meshStandardMaterial color={EMBER} roughness={0.4} emissive={EMBER} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function Shadow() {
  const texture = useMemo(makeShadowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.85, 0]}>
      <planeGeometry args={[3.6, 1.6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

export default function Book3DScene({ coverUrl, flipKey, active, onActivate, onReady }) {
  const pointer = useRef({ x: 0, y: 0 });

  // İmleç konumu (yalnızca fare): -1..1 aralığına normalize
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    const move = event => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <Canvas
      className="hero-book-canvas"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.1, 7.4], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.55} color="#fff3ec" />
      {/* Sıcak anahtar ışık (sol üst) */}
      <directionalLight position={[-3.5, 4, 5]} intensity={2.2} color="#fff1e6" />
      {/* Sinematik turuncu kenar ışığı (sağ arka) */}
      <directionalLight position={[4, 1.5, -3]} intensity={1.6} color={EMBER} />
      <pointLight position={[0, -2, 3]} intensity={0.6} color="#F3E4EA" />
      <Book coverUrl={coverUrl} flipKey={flipKey} pointer={pointer} onActivate={onActivate} onReady={onReady} />
      <Shadow />
    </Canvas>
  );
}
