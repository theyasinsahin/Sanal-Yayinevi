
import React from 'react';
import { FaInstagram, FaLinkedinIn, FaTiktok } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

const platforms = [
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/betik.tr/',
    Icon: FaInstagram
  },
  {
    name: 'X',
    url: 'https://twitter.com/betiktr',
    Icon: FaXTwitter
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/company/betiktr/',
    Icon: FaLinkedinIn
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@betik.tr',
    Icon: FaTiktok
  }
];

export default function SocialLinks() {
  return (
    <div className="social-links">
      {platforms
        .filter(platform => platform.url)
        .map(({ name, url, Icon }) => (
          <a
            key={name}
            href={url}
            aria-label={`Betik ${name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <Icon aria-hidden="true" />
          </a>
        ))}
    </div>
  );
}
