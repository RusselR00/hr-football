import React, { useState } from 'react';

/* SVG approximation of The Deep Seafood Company logo — shows when PNG not found */
function LogoSVG({ height = 56 }) {
  const w = height * 1.4;
  return (
    <svg width={w} height={height} viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
      {/* Blue oval body */}
      <ellipse cx="70" cy="38" rx="52" ry="34" fill="#1565C0" transform="rotate(-12 70 38)" />
      {/* White inner space */}
      <ellipse cx="68" cy="36" rx="36" ry="22" fill="white" transform="rotate(-12 68 36)" />
      {/* Red swoosh */}
      <path d="M 28 55 Q 70 18 118 30" stroke="#C62828" strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* Blue bottom curve */}
      <path d="M 20 42 Q 70 70 120 46" stroke="#1565C0" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ height = 56, className = '' }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {!imgFailed ? (
        <img
          src="/logo.png"
          alt="The Deep Seafood Company"
          style={{ height, width: 'auto' }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center">
          <LogoSVG height={height} />
        </div>
      )}
    </div>
  );
}

/* Compact text-only badge for headers */
export function LogoBadge({ className = '' }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!imgFailed ? (
        <img src="/logo.png" alt="" className="h-8 w-auto" onError={() => setImgFailed(true)} />
      ) : (
        <LogoSVG height={32} />
      )}
      <div className="leading-tight">
        <p className="text-white font-black text-xs leading-none">Deep Seafood</p>
        <p className="text-blue-400 text-xs font-semibold">Football 2026</p>
      </div>
    </div>
  );
}
