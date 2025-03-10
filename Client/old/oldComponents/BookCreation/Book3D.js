import React from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, useTexture } from '@react-three/drei';

const Book3D = ({ title, coverPhoto, font, fontSizePx, fontColor, hasBorder, borderColor, borderWidth }) => {
  const defaultCover = useTexture('/images/books/yuzyillik-yalnizlik.png');
  const selectedImage = useLoader(THREE.TextureLoader, coverPhoto);
  const coverTexture = coverPhoto ? selectedImage : defaultCover;

  // Convert px to scale
  const fontSize = fontSizePx / 48;

  return (
    <group scale={[1.3, 1.3, 1.3]}>
      <directionalLight intensity={4} position={[5, 5, 5]} />
      <directionalLight intensity={4} position={[-5, -5, -5]} />
      {/* Front Cover */}
      <mesh position={[0, 0, 0.15]}>
        <boxGeometry args={[2.5, 3.5, 0.15]} />
        <meshStandardMaterial map={coverTexture} />
      </mesh>

      {/* Back Cover */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.5, 3.5, 0.15]} />
        <meshStandardMaterial color="#f0f0f0" map={coverTexture} />
      </mesh>

      {/* Spine 
      <mesh position={[-1.17, 0, 0]}>
        <boxGeometry args={[0.15, 3.5, 0.40]} />
        <meshStandardMaterial color="#ddd" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>*/}

      {/* Title Text on Front Cover */}
      {title && (
        <Text
          position={[0, 1.2, 0.23]}
          fontSize={fontSize}
          font={`/fonts/${font}.ttf`}
          color={fontColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={hasBorder ? borderWidth : 0} // Dynamic border width
          outlineColor={hasBorder ? borderColor : '#000000'} // Border color
        >
          {title}
        </Text>
      )}
    </group>
  );
};

export default Book3D;
