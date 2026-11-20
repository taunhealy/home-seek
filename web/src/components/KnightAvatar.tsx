'use client';

import React from 'react';

interface KnightAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Animated SVG Knight character used as the default user avatar ("Knightly" aesthetic).
 * Features subtle plume sway, glowing visor eyes, and a metallic sheen sweep.
 */
export const KnightAvatar: React.FC<KnightAvatarProps> = ({ size = 'sm', className = '' }) => {
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-9 h-9' : 'w-7 h-7';

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden border border-indigo-400/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-zinc-900 flex items-center justify-center shrink-0 relative shadow-inner ${className}`}
      title="Knightly Default Avatar"
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Animated Knight Avatar"
      >
        <defs>
          <linearGradient id="knight-steel" x1="16" y1="14" x2="48" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="knight-plume" x1="28" y1="4" x2="42" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="knight-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>

        {/* Subtle aura pulse */}
        <circle cx="32" cy="34" r="24" fill="#6366f1" opacity="0.14">
          <animate attributeName="r" values="22;25;22" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0.24;0.12" dur="3.2s" repeatCount="indefinite" />
        </circle>

        {/* Animated Plume */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-3 32 18; 3 32 18; -3 32 18"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <path
            d="M31 16C25 14 23 6 32 5C41 4 45 10 38 16H31Z"
            fill="url(#knight-plume)"
          />
          <path
            d="M32 6C36 6 39 9 36 14"
            stroke="#c7d2fe"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>

        {/* Shoulder Pauldrons / Armor */}
        <path
          d="M12 60C13 48 21 44 32 44C43 44 51 48 52 60H12Z"
          fill="#334155"
          stroke="#64748b"
          strokeWidth="1.5"
        />
        <path d="M24 45L32 52L40 45" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Helmet Dome & Faceplate */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -1.2; 0 0"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <path
            d="M18 30C18 20.5 24 15 32 15C40 15 46 20.5 46 30V41C46 45.5 39 49 32 49C25 49 18 45.5 18 41V30Z"
            fill="url(#knight-steel)"
            stroke="#f8fafc"
            strokeWidth="1.2"
          />

          {/* Center Helmet Crest */}
          <path d="M32 15V48" stroke="#cbd5e1" strokeWidth="1.4" opacity="0.85" />

          {/* Dark Visor Slit */}
          <path
            d="M20 29.5L32 31.5L44 29.5L43 34.5L32 36L21 34.5L20 29.5Z"
            fill="#0f172a"
          />

          {/* Glowing Animated Knight Eyes */}
          <rect x="24.5" y="31.3" width="4.5" height="2" rx="1" fill="url(#knight-glow)">
            <animate attributeName="opacity" values="0.75;1;0.4;1;0.75" dur="4s" repeatCount="indefinite" />
          </rect>
          <rect x="35" y="31.3" width="4.5" height="2" rx="1" fill="url(#knight-glow)">
            <animate attributeName="opacity" values="0.75;1;0.4;1;0.75" dur="4s" repeatCount="indefinite" />
          </rect>

          {/* Breathing / Grill Slits */}
          <path d="M24 39.5H28M36 39.5H40M25 42.5H28M36 42.5H39" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};
