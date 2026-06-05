import React, { useState, useRef, useEffect, useCallback } from 'react';

const TOTAL_KICKS = 10;

// Where ball goes on a GOAL (past the keeper) — corners / sides
const GOAL_TARGETS = [
  { x: '7%',  y: '28%' },  // 0 left corner
  { x: '26%', y: '52%' },  // 1 left centre
  { x: '50%', y: '18%' },  // 2 top centre
  { x: '74%', y: '52%' },  // 3 right centre
  { x: '93%', y: '28%' },  // 4 right corner
];

// Where ball ends up when SAVED — at keeper's glove
const SAVE_TARGETS = [
  { x: '2%',  y: '35%' },  // 0 left corner glove
  { x: '18%', y: '48%' },  // 1 left centre glove
  { x: '50%', y: '22%' },  // 2 centre glove (arms up)
  { x: '82%', y: '48%' },  // 3 right centre glove
  { x: '98%', y: '35%' },  // 4 right corner glove
];

// Keeper dive position and angle per zone
const GK_LEFT = ['7%', '26%', '50%', '74%', '93%'];
const GK_ROT  = [-58,  -32,   0,     32,    58  ];

// ── BIG Goalkeeper SVG ────────────────────────────────────────────────────────
function Goalkeeper({ zone, holdingBall }) {
  const posX = zone !== null ? GK_LEFT[zone] : '50%';
  const rot  = zone !== null ? GK_ROT[zone]  : 0;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: posX,
      transform: `translateX(-50%) rotate(${rot}deg)`,
      transition: 'left 0.44s cubic-bezier(0.34,1.56,0.64,1), transform 0.44s ease',
      transformOrigin: 'bottom center',
      zIndex: 15,
      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))',
    }}>
      <svg viewBox="0 0 80 120" width="72" height="108">
        {/* ── Boots ── */}
        <ellipse cx="28" cy="113" rx="13" ry="6" fill="#111"/>
        <ellipse cx="52" cy="113" rx="13" ry="6" fill="#111"/>
        {/* ── Socks ── */}
        <rect x="21" y="90" width="14" height="24" rx="3" fill="#fff"/>
        <rect x="45" y="90" width="14" height="24" rx="3" fill="#fff"/>
        {/* ── Shorts ── */}
        <rect x="20" y="70" width="16" height="24" rx="4" fill="#1e3a8a"/>
        <rect x="44" y="70" width="16" height="24" rx="4" fill="#1e3a8a"/>
        {/* ── Jersey body ── */}
        <rect x="16" y="36" width="48" height="38" rx="7" fill="#16a34a"/>
        {/* Jersey stripes */}
        <rect x="22" y="36" width="5" height="38" rx="2" fill="#15803d" opacity="0.5"/>
        <rect x="53" y="36" width="5" height="38" rx="2" fill="#15803d" opacity="0.5"/>
        {/* Number */}
        <text x="40" y="62" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial">1</text>
        {/* ── Left arm ── */}
        <line x1="16" y1="50" x2="-2" y2="38" stroke="#16a34a" strokeWidth="14" strokeLinecap="round"/>
        {/* ── Right arm ── */}
        <line x1="64" y1="50" x2="82" y2="38" stroke="#16a34a" strokeWidth="14" strokeLinecap="round"/>
        {/* ── Left glove ── */}
        <circle cx="-2" cy="38" r="13" fill="#dc2626"/>
        <circle cx="-2" cy="38" r="9"  fill="#ef4444"/>
        {/* glove fingers */}
        <rect x="-11" y="28" width="5" height="9" rx="2" fill="#dc2626"/>
        <rect x="-5"  y="26" width="5" height="9" rx="2" fill="#dc2626"/>
        <rect x="1"   y="27" width="5" height="9" rx="2" fill="#dc2626"/>
        {/* ── Right glove ── */}
        <circle cx="82" cy="38" r="13" fill="#dc2626"/>
        <circle cx="82" cy="38" r="9"  fill="#ef4444"/>
        <rect x="70"  y="28" width="5" height="9" rx="2" fill="#dc2626"/>
        <rect x="76"  y="26" width="5" height="9" rx="2" fill="#dc2626"/>
        <rect x="82"  y="27" width="5" height="9" rx="2" fill="#dc2626"/>
        {/* ── Neck ── */}
        <rect x="33" y="22" width="14" height="16" rx="4" fill="#fde68a"/>
        {/* ── Head ── */}
        <circle cx="40" cy="18" r="17" fill="#fde68a"/>
        {/* Hair */}
        <ellipse cx="40" cy="5"  rx="17" ry="8" fill="#92400e"/>
        <ellipse cx="27" cy="10" rx="7"  ry="9" fill="#92400e"/>
        <ellipse cx="53" cy="10" rx="7"  ry="9" fill="#92400e"/>
        {/* Eyes */}
        <circle cx="33" cy="18" r="3"   fill="white"/>
        <circle cx="47" cy="18" r="3"   fill="white"/>
        <circle cx="34" cy="18" r="1.8" fill="#1c1917"/>
        <circle cx="48" cy="18" r="1.8" fill="#1c1917"/>
        {/* Mouth */}
        <path d="M33 26 Q40 31 47 26" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Glove captain band */}
        <rect x="-10" y="42" width="16" height="4" rx="2" fill="#facc15"/>

        {/* ── Ball in hands (shown when saved) ── */}
        {holdingBall && (
          <g>
            {/* Ball held at left glove */}
            <circle cx="-2" cy="38" r="11" fill="white" stroke="#1c1917" strokeWidth="1.5"/>
            {/* Pentagon pattern */}
            <polygon points="-2,29 5,34 3,42 -7,42 -9,34" fill="#1c1917" opacity="0.7"/>
            <line x1="-2" y1="29" x2="-2" y2="27" stroke="#1c1917" strokeWidth="1" opacity="0.5"/>
          </g>
        )}
      </svg>
    </div>
  );
}

const ZONE_LABELS = ['◀◀ Corner', '◀ Left', '▲ Top', 'Right ▶', 'Corner ▶▶'];

export default function PenaltyScreen({ socket, player }) {
  const [kickNum, setKickNum]     = useState(1);
  const [phase, setPhase]         = useState('ready');
  const [aimZone, setAimZone]     = useState(null);
  const [gkZone, setGkZone]       = useState(null);
  const [ballTarget, setBallTarget] = useState(null);
  const [ballFlying, setBallFlying] = useState(false);
  const [ballVisible, setBallVisible] = useState(true);  // hides after save (ball in hands)
  const [holdingBall, setHoldingBall] = useState(false); // keeper holds ball after save
  const [isGoal, setIsGoal]       = useState(null);
  const [goals, setGoals]         = useState(0);
  const [ptsEarned, setPtsEarned] = useState(0);
  const [history, setHistory]     = useState([]);
  const [netShake, setNetShake]   = useState(false);

  const touchStart = useRef(null);
  const hasShot    = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const timers = [];
    const t = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); };

    const onResume = ({ shots, nextKick }) => {
      setHistory(shots.map(s => ({ goal: s.goal })));
      setGoals(shots.filter(s => s.goal).length);
      setKickNum(nextKick);
      setPhase('ready'); setBallFlying(false); setBallVisible(true);
      setGkZone(null); setIsGoal(null); setAimZone(null); setHoldingBall(false);
      hasShot.current = false;
    };

    const onKickResult = ({ dir, goalkeeperDir, goal, kickNum: k, totalKicks }) => {
      // GK dives toward the player's zone
      setGkZone(goalkeeperDir);

      if (goal) {
        // GOAL: ball flies INTO THE NET past the keeper
        setBallTarget(GOAL_TARGETS[dir]);
        t(() => setBallFlying(true), 30);
        t(() => {
          setIsGoal(true);
          setPhase('result');
          setGoals(g => g + 1);
          setNetShake(true);
          t(() => setNetShake(false), 500);
          setHistory(h => [...h, { goal: true }]);
        }, 440);
      } else {
        // SAVE: ball flies TO THE KEEPER'S GLOVE
        setBallTarget(SAVE_TARGETS[goalkeeperDir]);
        t(() => setBallFlying(true), 30);
        t(() => {
          setIsGoal(false);
          setPhase('result');
          setHistory(h => [...h, { goal: false }]);
          // Ball disappears and appears IN keeper's hands
          t(() => { setBallVisible(false); setHoldingBall(true); }, 100);
        }, 440);
      }

      if (k < totalKicks) {
        t(() => {
          setKickNum(k + 1);
          setPhase('ready');
          setBallFlying(false);
          setBallVisible(true);
          setHoldingBall(false);
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

    socket.on('penalty:start', () => {
      setKickNum(1); setPhase('ready'); setGoals(0); setHistory([]);
      setBallFlying(false); setBallVisible(true); setHoldingBall(false);
      setGkZone(null); setIsGoal(null); setAimZone(null);
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

  const dxToZone = (dx, w) => {
    const p = dx / w;
    if (p < -0.28) return 0;
    if (p < -0.09) return 1;
    if (p >  0.28) return 4;
    if (p >  0.09) return 3;
    return 2;
  };

  const shoot = useCallback((zone) => {
    if (hasShot.current || phase !== 'ready') return;
    hasShot.current = true;
    setPhase('shooting');
    setAimZone(zone);
    socket.emit('penalty:shoot', { direction: zone });
  }, [phase, socket]);

  const onTouchStart = e => {
    if (hasShot.current || phase !== 'ready') return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = e => {
    if (!touchStart.current || hasShot.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dy) > 12) setAimZone(dxToZone(dx, containerRef.current?.offsetWidth || 375));
  };
  const onTouchEnd = e => {
    if (!touchStart.current || hasShot.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (dy < -30) shoot(dxToZone(dx, containerRef.current?.offsetWidth || 375));
    else setAimZone(null);
  };
  const onMouseDown = e => { touchStart.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = e => {
    if (!touchStart.current || hasShot.current) return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    if (Math.abs(dy) > 8) setAimZone(dxToZone(dx, containerRef.current?.offsetWidth || 375));
  };
  const onMouseUp = e => {
    if (!touchStart.current || hasShot.current) return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    touchStart.current = null;
    if (dy < -15) shoot(dxToZone(dx, containerRef.current?.offsetWidth || 375));
    else setAimZone(null);
  };

  // ── Done screen ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="screen game-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-4 animate-bounce-in">
          {goals >= 8 ? '🔥' : goals >= 6 ? '⚽' : goals >= 4 ? '😤' : '😅'}
        </div>
        <h2 className="text-white font-black text-4xl mb-1">{goals} / {TOTAL_KICKS}</h2>
        <p className="text-white/50 mb-1">Goals scored</p>
        <p className="text-yellow-300 font-black text-2xl mb-6">+{ptsEarned} pts</p>
        <div className="flex gap-1.5 mb-8 flex-wrap justify-center">
          {history.map((k, i) => (
            <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 font-bold ${
              k.goal ? 'bg-green-500/30 border-green-400 text-green-300' : 'bg-red-500/20 border-red-400/40 text-red-400'
            }`}>{k.goal ? '⚽' : '🧤'}</div>
          ))}
        </div>
        <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3">
          <p className="text-white/50 text-sm">Waiting for host to show final results…</p>
        </div>
      </div>
    );
  }

  // ── Game ─────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{ touchAction: 'none', userSelect: 'none' }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}   onMouseMove={onMouseMove} onMouseUp={onMouseUp}
    >
      {/* ── STADIUM ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center" style={{
        background: 'linear-gradient(180deg,#07101f 0%,#0d1e3a 55%,#162d50 100%)',
        flex: '0 0 56%',
      }}>
        {/* Logo */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <img src="/logo.png" alt="" className="h-8 w-auto opacity-60" onError={e => e.target.style.display='none'} />
        </div>
        {/* Floodlights */}
        <div className="absolute top-2 left-3 text-lg opacity-50">💡</div>
        <div className="absolute top-2 right-3 text-lg opacity-50">💡</div>

        {/* HUD */}
        <div className="flex items-center justify-between w-full px-3 pt-12 pb-1 z-20">
          <div className="bg-black/50 px-3 py-1 rounded-full border border-white/10">
            <span className="text-white font-bold text-sm">Kick {kickNum}/{TOTAL_KICKS}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_KICKS }).map((_, i) => (
              <div key={i} className={`rounded-full border ${
                i < history.length
                  ? history[i].goal ? 'w-2.5 h-2.5 bg-green-400 border-green-300' : 'w-2.5 h-2.5 bg-red-400 border-red-300'
                  : i === kickNum - 1 ? 'w-2.5 h-2.5 bg-white border-white animate-pulse' : 'w-2 h-2 bg-white/15 border-white/15'
              }`}/>
            ))}
          </div>
          <div className="bg-black/50 px-3 py-1 rounded-full border border-white/10">
            <span className="text-green-400 font-black text-sm">⚽ {goals}</span>
          </div>
        </div>

        {/* ── GOAL ── */}
        <div className="relative flex-1 flex items-start justify-center w-full px-4 pt-0">
          <div className="relative w-full" style={{ maxWidth: 340 }}>
            <div className="relative border-white" style={{
              height: 158,
              borderTop: '6px solid white', borderLeft: '6px solid white',
              borderRight: '6px solid white', borderBottom: 'none',
              boxShadow: netShake
                ? '0 0 35px rgba(255,215,0,1), inset 0 0 25px rgba(255,215,0,0.4)'
                : '0 0 18px rgba(255,255,255,0.18)',
              animation: netShake ? 'netShake 0.45s ease' : undefined,
            }}>
              {/* Net */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.18) 1px,transparent 1px)',
                backgroundSize: '16px 12px',
                backgroundColor: 'rgba(5,10,40,0.92)',
              }}/>

              {/* Zone aim highlight */}
              {phase === 'ready' && aimZone !== null && (
                <div className="absolute inset-0 flex pointer-events-none z-20">
                  {[0,1,2,3,4].map(z => (
                    <div key={z} className={`flex-1 transition-all ${
                      z === aimZone ? 'bg-yellow-400/35 border-x-2 border-yellow-300/60' : ''
                    }`}/>
                  ))}
                </div>
              )}

              {/* Zone dividers */}
              <div className="absolute inset-0 flex pointer-events-none">
                {[0,1,2,3].map(i => <div key={i} className="flex-1 border-r border-white/8"/>)}
              </div>

              {/* Flying ball */}
              {ballFlying && ballTarget && ballVisible && (
                <div className="absolute z-30 pointer-events-none"
                  style={{
                    left: ballTarget.x, top: ballTarget.y,
                    transform: 'translate(-50%,-50%)',
                    transition: 'left 0.52s cubic-bezier(0.22,1,0.36,1), top 0.52s cubic-bezier(0.22,1,0.36,1)',
                    filter: isGoal ? 'drop-shadow(0 0 16px gold) drop-shadow(0 0 8px #fff)' : 'none',
                    fontSize: 24,
                    animation: 'ballSpin 0.52s linear',
                  }}>⚽</div>
              )}

              {/* ── BIG Goalkeeper ── */}
              <Goalkeeper zone={gkZone} holdingBall={holdingBall} />
            </div>

            {/* Posts bottom */}
            <div className="flex justify-between -mt-0.5">
              <div className="w-2.5 h-4 bg-white rounded-b-sm"/>
              <div className="w-2.5 h-4 bg-white rounded-b-sm"/>
            </div>
          </div>
        </div>

        {/* Result banner */}
        {phase === 'result' && isGoal !== null && (
          <div className={`absolute bottom-3 left-4 right-4 z-40 text-center py-3 rounded-2xl font-black text-3xl shadow-2xl animate-bounce-in ${
            isGoal
              ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
              : 'bg-gradient-to-r from-red-700 to-red-500 text-white'
          }`}>
            {isGoal ? '⚽  G O A L !' : '🧤  S A V E D !'}
          </div>
        )}
      </div>

      {/* ── PITCH ─────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-start pt-4" style={{
        flex: '0 0 44%',
        background: 'linear-gradient(180deg,#1e7a35 0%,#196830 45%,#145224 100%)',
        borderTop: '4px solid rgba(255,255,255,0.5)',
      }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-14 border-2 border-white/20 border-t-0 rounded-b-full"/>
        <div className="absolute top-7 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white/60"/>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage:'repeating-linear-gradient(180deg,transparent 0px,transparent 20px,rgba(0,0,0,0.25) 20px,rgba(0,0,0,0.25) 40px)',
        }}/>

        {/* Ball on pitch */}
        {!ballFlying ? (
          <div className="relative z-10 mt-2" style={{
            fontSize: 62,
            filter:'drop-shadow(0 6px 14px rgba(0,0,0,0.7))',
            transform: aimZone !== null ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.15s',
          }}>⚽</div>
        ) : (
          <div className="relative z-10 mt-2 opacity-10" style={{ fontSize: 62 }}>⚽</div>
        )}

        {/* Aim label */}
        {phase === 'ready' && aimZone !== null && (
          <div className="mt-2 text-center z-10 animate-fade-in">
            <div className="bg-yellow-400/20 border border-yellow-400/50 rounded-xl px-4 py-1.5 inline-block">
              <span className="text-yellow-200 font-black text-sm">{ZONE_LABELS[aimZone]}</span>
            </div>
            <p className="text-white/40 text-xs mt-1">Release to shoot!</p>
          </div>
        )}

        {phase === 'ready' && aimZone === null && (
          <div className="mt-2 text-center z-10 px-4">
            <p className="text-white/90 font-black text-xl">Flick Up to Shoot!</p>
            <p className="text-white/45 text-sm mt-0.5">Swipe left/right to aim · 5 zones</p>
            <div className="flex justify-center gap-5 mt-2">
              <span className="text-white/25 text-xl animate-bounce" style={{animationDelay:'0s'}}>↖</span>
              <span className="text-white/55 text-2xl animate-bounce" style={{animationDelay:'0.1s'}}>↑</span>
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
        @keyframes netShake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
      `}</style>
    </div>
  );
}
