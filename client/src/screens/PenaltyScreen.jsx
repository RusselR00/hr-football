import React, { useState, useRef, useEffect, useCallback } from 'react';

/*
  Penalty Shootout — 10 kicks, 5 zones, smart goalkeeper with diving animation
  Zones: 0=left corner  1=left-centre  2=centre  3=right-centre  4=right corner
*/

const TOTAL_KICKS = 10;

// Where ball lands in goal for each of 5 zones
const BALL_TARGETS = [
  { x: '8%',  y: '30%' },  // 0 left corner
  { x: '28%', y: '50%' },  // 1 left centre
  { x: '50%', y: '22%' },  // 2 centre (top)
  { x: '72%', y: '50%' },  // 3 right centre
  { x: '92%', y: '30%' },  // 4 right corner
];

// Goalkeeper position (left %) and body rotation for each zone
const GK_POSITIONS  = ['8%',  '27%', '50%', '73%', '92%'];
const GK_ROTATIONS  = [-55,   -30,    0,     30,    55  ];
const GK_BODY_LEAN  = ['scaleX(-1) rotate(-55deg)', 'rotate(-30deg)', 'rotate(0deg)', 'rotate(30deg)', 'scaleX(-1) rotate(-55deg)'];

// Goalkeeper SVG — green kit, red gloves, dives on command
function GoalkeeperSVG({ zone }) {
  const rot  = zone !== null ? GK_ROTATIONS[zone]  : 0;
  const posX = zone !== null ? GK_POSITIONS[zone]  : '50%';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 2,
        left: posX,
        transform: `translateX(-50%) rotate(${rot}deg)`,
        transition: 'left 0.42s cubic-bezier(0.34,1.56,0.64,1), transform 0.42s ease',
        transformOrigin: 'bottom center',
        zIndex: 10,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
      }}
    >
      <svg viewBox="0 0 54 78" width="44" height="60">
        {/* Shorts */}
        <rect x="18" y="52" width="8" height="18" rx="3" fill="#1e3a8a"/>
        <rect x="28" y="52" width="8" height="18" rx="3" fill="#1e3a8a"/>
        {/* Jersey */}
        <rect x="14" y="26" width="26" height="30" rx="5" fill="#16a34a"/>
        {/* Number */}
        <text x="27" y="45" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">1</text>
        {/* Head */}
        <circle cx="27" cy="16" r="11" fill="#fde68a"/>
        {/* Hair */}
        <ellipse cx="27" cy="7" rx="11" ry="5" fill="#92400e"/>
        {/* Face details */}
        <circle cx="23" cy="16" r="1.5" fill="#78350f"/>
        <circle cx="31" cy="16" r="1.5" fill="#78350f"/>
        <path d="M23 21 Q27 24 31 21" stroke="#78350f" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Left arm */}
        <line x1="14" y1="36" x2="1"  y2="28" stroke="#16a34a" strokeWidth="9" strokeLinecap="round"/>
        {/* Right arm */}
        <line x1="40" y1="36" x2="53" y2="28" stroke="#16a34a" strokeWidth="9" strokeLinecap="round"/>
        {/* Left glove */}
        <circle cx="1"  cy="28" r="8" fill="#dc2626"/>
        <circle cx="1"  cy="28" r="5" fill="#ef4444"/>
        {/* Right glove */}
        <circle cx="53" cy="28" r="8" fill="#dc2626"/>
        <circle cx="53" cy="28" r="5" fill="#ef4444"/>
        {/* Boots */}
        <ellipse cx="22" cy="70" rx="8" ry="4" fill="#1c1917"/>
        <ellipse cx="34" cy="70" rx="8" ry="4" fill="#1c1917"/>
      </svg>
    </div>
  );
}

// Zone aim indicators shown in the goal when picking
const ZONE_LABELS = ['◀◀', '◀', '▲', '▶', '▶▶'];
const ZONE_NAMES  = ['Left\nCorner', 'Left', 'Top\nCentre', 'Right', 'Right\nCorner'];

export default function PenaltyScreen({ socket, player }) {
  const [kickNum, setKickNum]       = useState(1);
  const [phase, setPhase]           = useState('ready');   // ready|aiming|shooting|result|done
  const [aimZone, setAimZone]       = useState(null);      // 0-4 while dragging
  const [gkZone, setGkZone]         = useState(null);
  const [ballTarget, setBallTarget] = useState(null);
  const [ballFlying, setBallFlying] = useState(false);
  const [isGoal, setIsGoal]         = useState(null);
  const [goals, setGoals]           = useState(0);
  const [ptsEarned, setPtsEarned]   = useState(0);
  const [history, setHistory]       = useState([]);
  const [netShake, setNetShake]     = useState(false);
  const [savedAnim, setSavedAnim]   = useState(false);

  const touchStart   = useRef(null);
  const hasShot      = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const timers = [];
    const t = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); };

    const onResume = ({ shots, nextKick }) => {
      const hist = shots.map(s => ({ goal: s.goal }));
      setHistory(hist);
      setGoals(hist.filter(h => h.goal).length);
      setKickNum(nextKick);
      setPhase('ready');
      setBallFlying(false);
      setGkZone(null);
      setIsGoal(null);
      hasShot.current = false;
    };

    const onKickResult = ({ dir, goalkeeperDir, goal, kickNum: k, totalKicks }) => {
      // GK dives simultaneously with ball
      setGkZone(goalkeeperDir);
      setBallTarget(BALL_TARGETS[dir]);
      t(() => setBallFlying(true), 30);
      t(() => {
        setIsGoal(goal);
        setPhase('result');
        if (goal) { setGoals(g => g + 1); setNetShake(true); t(() => setNetShake(false), 500); }
        else       { setSavedAnim(true); t(() => setSavedAnim(false), 600); }
        setHistory(h => [...h, { goal }]);
      }, 420);
      if (k < totalKicks) {
        t(() => {
          setKickNum(k + 1);
          setPhase('ready');
          setBallFlying(false);
          setGkZone(null);
          setIsGoal(null);
          setAimZone(null);
          hasShot.current = false;
        }, 2800);
      }
    };

    const onDone = ({ goals: g, pts }) => {
      t(() => { setGoals(g); setPtsEarned(pts); setPhase('done'); }, 2800);
    };

    socket.on('penalty:start',       () => {
      setKickNum(1); setPhase('ready'); setGoals(0); setHistory([]);
      setBallFlying(false); setGkZone(null); setIsGoal(null); setAimZone(null);
      hasShot.current = false;
    });
    socket.on('penalty:resume',      onResume);
    socket.on('penalty:kick-result', onKickResult);
    socket.on('penalty:done',        onDone);

    return () => {
      timers.forEach(clearTimeout);
      socket.off('penalty:start');
      socket.off('penalty:resume',      onResume);
      socket.off('penalty:kick-result', onKickResult);
      socket.off('penalty:done',        onDone);
    };
  }, [socket]);

  // Map swipe dx to zone 0-4
  const dxToZone = (dx, w) => {
    const pct = dx / w;
    if (pct < -0.28) return 0;
    if (pct < -0.10) return 1;
    if (pct >  0.28) return 4;
    if (pct >  0.10) return 3;
    return 2;
  };

  const shoot = useCallback((zone) => {
    if (hasShot.current || phase !== 'ready') return;
    hasShot.current = true;
    setPhase('shooting');
    setAimZone(zone);
    setBallTarget(BALL_TARGETS[zone]);
    socket.emit('penalty:shoot', { direction: zone });
  }, [phase, socket]);

  const onTouchStart = (e) => {
    if (hasShot.current || phase !== 'ready') return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchMove = (e) => {
    if (!touchStart.current || hasShot.current || phase !== 'ready') return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dy) > 15) {
      const w = containerRef.current?.offsetWidth || 375;
      setAimZone(dxToZone(dx, w));
    }
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current || hasShot.current || phase !== 'ready') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (dy < -30) {
      const w = containerRef.current?.offsetWidth || 375;
      shoot(dxToZone(dx, w));
    } else {
      setAimZone(null);
    }
  };

  const onMouseDown = (e) => { touchStart.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e) => {
    if (!touchStart.current || hasShot.current || phase !== 'ready') return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    if (Math.abs(dy) > 8) {
      const w = containerRef.current?.offsetWidth || 375;
      setAimZone(dxToZone(dx, w));
    }
  };
  const onMouseUp = (e) => {
    if (!touchStart.current || hasShot.current || phase !== 'ready') return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    touchStart.current = null;
    if (dy < -15) {
      const w = containerRef.current?.offsetWidth || 375;
      shoot(dxToZone(dx, w));
    } else setAimZone(null);
  };

  // ── Done screen ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = Math.round((goals / TOTAL_KICKS) * 100);
    return (
      <div className="screen game-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-4 animate-bounce-in">
          {goals >= 8 ? '🔥' : goals >= 5 ? '⚽' : goals >= 3 ? '😤' : '😅'}
        </div>
        <h2 className="text-white font-black text-4xl mb-1">{goals} / {TOTAL_KICKS}</h2>
        <p className="text-white/50 mb-1">Goals scored</p>
        <p className="text-yellow-300 font-black text-2xl mb-6">+{ptsEarned} pts</p>
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          {history.map((k, i) => (
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 font-bold ${
              k.goal ? 'bg-green-500/30 border-green-400 text-green-300' : 'bg-red-500/20 border-red-400/40 text-red-400'
            }`}>
              {k.goal ? '⚽' : '🧤'}
            </div>
          ))}
        </div>
        <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3">
          <p className="text-white/50 text-sm">Waiting for host to show final results…</p>
        </div>
      </div>
    );
  }

  // ── Game screen ──────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{ touchAction: 'none', userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* ── STADIUM SKY ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center" style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #132347 60%, #1a3a5c 100%)',
        flex: '0 0 54%',
      }}>
        {/* Logo centre */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <img src="/logo.png" alt="" className="h-8 w-auto opacity-70" onError={e => e.target.style.display='none'} />
        </div>
        <div className="absolute top-2 left-4 text-lg opacity-50">💡</div>
        <div className="absolute top-2 right-4 text-lg opacity-50">💡</div>

        {/* HUD */}
        <div className="flex items-center justify-between w-full px-4 pt-12 pb-1 z-20">
          <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-white font-bold text-sm">Kick {kickNum}/{TOTAL_KICKS}</span>
          </div>
          {/* Kick dots */}
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_KICKS }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full border ${
                i < history.length
                  ? history[i].goal ? 'bg-green-400 border-green-300' : 'bg-red-400 border-red-300'
                  : i === kickNum - 1 ? 'bg-white border-white animate-pulse' : 'bg-white/15 border-white/15'
              }`}/>
            ))}
          </div>
          <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-green-400 font-black text-sm">⚽ {goals}</span>
          </div>
        </div>

        {/* ── GOAL ── */}
        <div className="relative flex-1 flex items-start justify-center w-full px-5 pt-1">
          <div className="relative w-full" style={{ maxWidth: 320 }}>
            {/* Net shake animation */}
            <div
              className="relative border-white"
              style={{
                height: 140,
                borderTop: '5px solid white', borderLeft: '5px solid white',
                borderRight: '5px solid white', borderBottom: 'none',
                boxShadow: netShake
                  ? '0 0 30px rgba(255,215,0,0.9), inset 0 0 20px rgba(255,215,0,0.3)'
                  : isGoal === false && savedAnim
                  ? '0 0 20px rgba(239,68,68,0.8)'
                  : '0 0 15px rgba(255,255,255,0.15)',
                animation: netShake ? 'netShake 0.4s ease' : undefined,
              }}
            >
              {/* Net */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.2) 1px,transparent 1px)',
                backgroundSize: '14px 11px',
                backgroundColor: 'rgba(8,15,50,0.9)',
              }}/>

              {/* Zone markers — shown while aiming */}
              {phase === 'ready' && aimZone !== null && (
                <div className="absolute inset-0 flex pointer-events-none z-20">
                  {[0,1,2,3,4].map(z => (
                    <div key={z} className={`flex-1 flex items-center justify-center transition-all ${
                      z === aimZone
                        ? 'bg-yellow-400/30 border-x border-yellow-400/50'
                        : 'opacity-20'
                    }`}>
                      <span className="text-white/80 text-xs font-black">{ZONE_LABELS[z]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 5 zone dividers (subtle) */}
              <div className="absolute inset-0 flex pointer-events-none">
                {[0,1,2,3].map(i => (
                  <div key={i} className="flex-1 border-r border-white/10"/>
                ))}
              </div>

              {/* Flying ball */}
              {ballFlying && ballTarget && (
                <div className="absolute z-30 pointer-events-none"
                  style={{
                    left: ballTarget.x, top: ballTarget.y,
                    transform: 'translate(-50%,-50%)',
                    transition: 'left 0.5s cubic-bezier(0.22,1,0.36,1), top 0.5s cubic-bezier(0.22,1,0.36,1)',
                    filter: isGoal ? 'drop-shadow(0 0 14px gold) drop-shadow(0 0 6px #fff)' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
                    fontSize: 22,
                    animation: 'ballSpin 0.5s linear',
                  }}>⚽</div>
              )}

              {/* Goalkeeper */}
              <GoalkeeperSVG zone={gkZone} />
            </div>

            {/* Posts */}
            <div className="flex justify-between -mt-0.5">
              <div className="w-2 h-3 bg-white rounded-b-sm"/>
              <div className="w-2 h-3 bg-white rounded-b-sm"/>
            </div>
          </div>
        </div>

        {/* Result banner */}
        {phase === 'result' && isGoal !== null && (
          <div className={`absolute bottom-3 left-4 right-4 z-30 text-center py-3 rounded-2xl font-black text-3xl shadow-2xl animate-bounce-in ${
            isGoal
              ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
              : 'bg-gradient-to-r from-red-700 to-red-500 text-white'
          }`}>
            {isGoal ? '⚽  G O A L !' : '🧤  S A V E D !'}
          </div>
        )}
      </div>

      {/* ── PITCH ─────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-start pt-5" style={{
        flex: '0 0 46%',
        background: 'linear-gradient(180deg,#1e7a35 0%,#196830 40%,#145224 100%)',
        borderTop: '3px solid rgba(255,255,255,0.45)',
      }}>
        {/* Pitch markings */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-14 border-2 border-white/20 border-t-0 rounded-b-full"/>
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/50"/>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage:'repeating-linear-gradient(180deg,transparent 0px,transparent 20px,rgba(0,0,0,0.25) 20px,rgba(0,0,0,0.25) 40px)',
        }}/>

        {/* Ball */}
        {!ballFlying ? (
          <div className="relative z-10 mt-3" style={{
            fontSize: 60, cursor:'grab',
            filter:'drop-shadow(0 6px 14px rgba(0,0,0,0.65))',
            transition: 'transform 0.1s',
            transform: aimZone !== null ? 'scale(1.08)' : 'scale(1)',
          }}>⚽</div>
        ) : (
          <div className="relative z-10 mt-3 opacity-15" style={{ fontSize: 60 }}>⚽</div>
        )}

        {/* Aim indicator */}
        {phase === 'ready' && aimZone !== null && (
          <div className="mt-2 text-center z-10 animate-fade-in">
            <div className="bg-yellow-400/20 border border-yellow-400/40 rounded-xl px-4 py-1.5">
              <span className="text-yellow-300 font-black text-sm">
                Aiming: {['Left Corner','Left Centre','Centre','Right Centre','Right Corner'][aimZone]}
              </span>
            </div>
            <p className="text-white/40 text-xs mt-1">Release to shoot!</p>
          </div>
        )}

        {phase === 'ready' && aimZone === null && (
          <div className="mt-3 text-center z-10 animate-fade-in px-4">
            <p className="text-white/90 font-black text-xl">Flick Up to Shoot!</p>
            <p className="text-white/45 text-sm mt-1">Swipe left/right to aim · 5 zones</p>
            <div className="flex justify-center gap-5 mt-3">
              <span className="text-white/25 text-xl animate-bounce" style={{animationDelay:'0s'}}>↖</span>
              <span className="text-white/50 text-2xl animate-bounce" style={{animationDelay:'0.1s'}}>↑</span>
              <span className="text-white/25 text-xl animate-bounce" style={{animationDelay:'0.2s'}}>↗</span>
            </div>
          </div>
        )}

        {phase === 'shooting' && (
          <p className="mt-4 text-white/40 text-sm z-10 animate-fade-in">Shot taken…</p>
        )}
      </div>

      <style>{`
        @keyframes ballSpin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes netShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
      `}</style>
    </div>
  );
}
