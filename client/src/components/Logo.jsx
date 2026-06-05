import React, { useState } from 'react';

/* Full logo — shows PNG, falls back to styled company name text */
export default function Logo({ height = 72, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {!failed ? (
        <img
          src="/logo.png"
          alt="The Deep Seafood Company"
          style={{ height, width: 'auto', objectFit: 'contain' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="text-center" style={{ height }}>
          <p className="text-white/50 text-xs italic font-semibold leading-none mb-0.5">The</p>
          <p className="font-black italic leading-none" style={{ color: '#1565C0', fontSize: height * 0.28 }}>
            Deep Seafood
          </p>
          <p className="font-black italic leading-none" style={{ color: '#1565C0', fontSize: height * 0.22 }}>
            Company
          </p>
        </div>
      )}
    </div>
  );
}

/* Compact badge for screen headers — bigger now that logo is cropped */
export function LogoBadge({ className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`flex items-center ${className}`}>
      {!failed ? (
        <img
          src="/logo.png"
          alt="The Deep Seafood Company"
          className="w-auto object-contain"
          style={{ height: 44 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-black italic text-sm" style={{ color: '#1E88E5' }}>
          The Deep Seafood Company
        </span>
      )}
    </div>
  );
}
