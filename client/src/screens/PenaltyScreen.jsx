import React, { useState, useRef, useEffect, useCallback } from 'react';

/*  Full interactive penalty shootout
    ─ Player flicks the ball up (and left/right to aim)
    ─ Ball flies along a curve into the goal
    ─ Goalkeeper dives to a random side (from server result)
    ─ GOAL / SAVED banner with net shake effect
*/

const GK_LEFT   = '12%';
const GK_CENTRE = '50%';
const GK_RIGHT  = '88%';
const GK_POS    = [GK_LEFT, GK_CENTRE, GK_RIGHT];

const BALL_TARGETS = [   // where ball lands in goal for each dir
  { x: '18%', y: '40%' },   // left
  { x: '50%', y: '25%' },   // centre top
  { x: '82%', y: '40%' },   // right
];

export default function PenaltyScreen({ socket, penaltyData, penaltyResult, player }) {
  const [phase, setPhase]       = useState('idle');  // idle | shooting | result
  const [shotDir, setShotDir]   = useState(null);    // 0 1 2
  const [gkDir, setGkDir]       = useState(null);
  const [isGoal, setIsGoal]     = useState(null);
  const [timeLeft, setTimeLeft] = useState(8);
  const [netShake, setNetShake] = useState(false);
  const [ballFlying, setBallFlying] = useState(false);
  const [ballTarget, setBallTarget] = useState({ x: '50%', y: '50%' });
  const [dragHint, setDragHint] = useState(true);

  const touchStart  = useRef(null);
  const timerRef    = useRef(null);
  const hasShot     = useRef(false);
  const containerRef = useRef(null);

  // Reset every new kick
  useEffect(() => {
    hasShot.current = false;
    setPhase('idle');
    setShotDir(null);
    setGkDir(null);
    setIsGoal(null);
    setBallFlying(false);
    setNetShake(false);
    setTimeLeft(penaltyData?.timeLimit || 8);
    setDragHint(true);
  }, [penaltyData?.round]);

  // Countdown timer
  useEffect(() => {
    if (!penaltyData || phase !== 'idle') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [penaltyData?.round, phase]);

  // Handle result from server
  useEffect(() => {
    if (!penaltyResult || !player) return;
    const my = penaltyResult.results?.[player.id];
    if (!my) return;

    // Goalkeeper dives immediately on result
    setGkDir(my.goalkeeperDir);

    setTimeout(() => {
      setIsGoal(my.goal);
      setPhase('result');
      if (my.goal) setNetShake(true);
    }, 350);
  }, [penaltyResult]);

  const shoot = useCallback((dx, dy, containerW) => {
    if (hasShot.current || phase !== 'idle') return;
    hasShot.current = true;
    clearInterval(timerRef.current);
    setDragHint(false);

    // Map dx to direction
    const threshold = containerW * 0.12;
    let dir = 1;
    if (dx < -threshold) dir = 0;
    else if (dx > threshold) dir = 2;

    setShotDir(dir);
    setBallTarget(BALL_TARGETS[dir]);
    setPhase('shooting');

    // Start ball flight
    setTimeout(() => setBallFlying(true), 30);

    socket.emit('penalty:shoot', { direction: dir });
  }, [phase, socket]);

  // Touch handlers
  const onTouchStart = (e) => {
    if (hasShot.current) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current || hasShot.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (dy < -25) { // upward flick
      const w = containerRef.current?.offsetWidth || 375;
      shoot(dx, dy, w);
    }
    touchStart.current = null;
  };

  // Mouse fallback for desktop testing
  const onMouseDown = (e) => {
    touchStart.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = (e) => {
    if (!touchStart.current || hasShot.current) return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    if (dy < -15) {
      const w = containerRef.current?.offsetWidth || 375;
      shoot(dx, dy, w);
    }
    touchStart.current = null;
  };

  if (!penaltyData) return null;

  const timerPct = (timeLeft / (penaltyData.timeLimit || 8)) * 100;
  const timerColor = timeLeft > 4 ? '#22c55e' : '#ef4444';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col select-none overflow-hidden"
      style={{ touchAction: 'none', userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      {/* ── SKY / STADIUM ── */}
      <div
        className="relative flex flex-col items-center"
        style={{
          background: 'linear-gradient(180deg, #0a1628 0%, #132347 60%, #1a3a5c 100%)',
          flex: '0 0 52%',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Stadium crowd silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-8 opacity-20"
          style={{ background: 'repeating-linear-gradient(90deg, #fff 0px, #fff 2px, transparent 2px, transparent 8px)', borderRadius: '50% 50% 0 0 / 100% 100% 0 0' }} />

        {/* Floodlights */}
        <div className="absolute top-2 left-4 text-xl opacity-60">💡</div>
        <div className="absolute top-2 right-4 text-xl opacity-60">💡</div>

        {/* HUD */}
        <div className="flex items-center justify-between w-full px-4 pt-3 pb-2 z-20">
          <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-white font-bold text-sm">Kick {penaltyData.round} / {penaltyData.total}</span>
          </div>

          {/* Timer ring */}
          <div className="relative w-11 h-11">
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPct / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
                strokeLinecap="round"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">{timeLeft}</span>
          </div>

          <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-white font-bold text-sm">🥅 Penalty</span>
          </div>
        </div>

        {/* ── GOAL ── */}
        <div className="relative flex-1 flex items-start justify-center w-full px-6 pt-2">
          <div className="relative w-full max-w-xs" style={{ maxWidth: 300 }}>
            {/* Goal frame */}
            <div
              className={`relative border-white ${netShake ? 'animate-bounce' : ''}`}
              style={{
                height: 130,
                borderTop: '5px solid white',
                borderLeft: '5px solid white',
                borderRight: '5px solid white',
                borderBottom: 'none',
                boxShadow: netShake
                  ? '0 0 30px rgba(255,215,0,0.8), inset 0 0 20px rgba(255,215,0,0.3)'
                  : '0 0 15px rgba(255,255,255,0.15)',
              }}
            >
              {/* Net */}
              <div className="absolute inset-0" style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)',
                backgroundSize: '15px 12px',
                backgroundColor: 'rgba(10,20,60,0.85)',
              }} />

              {/* Goal zone thirds */}
              <div className="absolute inset-0 flex pointer-events-none">
                {['L','C','R'].map((z, i) => (
                  <div key={i} className={`flex-1 flex items-end justify-center pb-1 ${i < 2 ? 'border-r border-white/15' : ''}`}>
                    <span className="text-white/15 text-xs font-black">{z}</span>
                  </div>
                ))}
              </div>

              {/* Flying ball inside goal */}
              {ballFlying && (
                <div
                  className="absolute z-20 text-3xl pointer-events-none"
                  style={{
                    left: ballTarget.x,
                    top: ballTarget.y,
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1)',
                    filter: isGoal
                      ? 'drop-shadow(0 0 12px gold) drop-shadow(0 0 6px #fff)'
                      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
                    fontSize: 30,
                    animation: 'spin 0.55s linear',
                  }}
                >
                  ⚽
                </div>
              )}

              {/* Goalkeeper */}
              <div
                className="absolute bottom-0 z-10 text-4xl pointer-events-none"
                style={{
                  left: gkDir !== null ? GK_POS[gkDir] : '50%',
                  transform: `translateX(-50%) ${gkDir === 0 ? 'scaleX(-1) rotate(-25deg)' : gkDir === 2 ? 'rotate(-25deg)' : 'rotate(0deg)'}`,
                  transition: 'left 0.45s cubic-bezier(0.34,1.56,0.64,1), transform 0.45s ease',
                  fontSize: 38,
                  filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.7))',
                  transformOrigin: 'bottom center',
                }}
              >
                🧤
              </div>
            </div>

            {/* Goalposts bottom */}
            <div className="flex justify-between -mt-0.5">
              <div className="w-2 h-3 bg-white rounded-b-sm" />
              <div className="w-2 h-3 bg-white rounded-b-sm" />
            </div>
          </div>
        </div>

        {/* Result banner */}
        {phase === 'result' && isGoal !== null && (
          <div className={`absolute bottom-4 left-4 right-4 z-30 text-center py-3 rounded-2xl font-black text-4xl shadow-2xl animate-bounce-in ${
            isGoal
              ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
              : 'bg-gradient-to-r from-red-600 to-red-500 text-white'
          }`}>
            {isGoal ? '⚽  G O A L !' : '🧤  S A V E D !'}
          </div>
        )}
      </div>

      {/* ── PITCH ── */}
      <div
        className="relative flex flex-col items-center justify-start pt-6"
        style={{
          flex: '0 0 48%',
          background: 'linear-gradient(180deg, #1e7a35 0%, #196830 40%, #145224 100%)',
          borderTop: '3px solid rgba(255,255,255,0.4)',
        }}
      >
        {/* Pitch markings */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-14 border-2 border-white/20 border-t-0 rounded-b-full" />
        {/* Penalty arc */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border border-white/10 border-t-0 rounded-b-full" />
        {/* Penalty spot */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/50" />
        {/* Grass stripes */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 20px, rgba(0,0,0,0.3) 20px, rgba(0,0,0,0.3) 40px)',
        }} />

        {/* Ball on pitch */}
        {!ballFlying && (
          <div
            className="relative z-10 mt-4"
            style={{
              fontSize: 64,
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))',
              animation: dragHint ? 'none' : undefined,
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            ⚽
          </div>
        )}

        {ballFlying && (
          <div className="relative z-10 mt-4 opacity-20" style={{ fontSize: 64 }}>⚽</div>
        )}

        {/* Instruction */}
        {phase === 'idle' && (
          <div className="mt-3 text-center animate-fade-in z-10 px-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-white/90 font-black text-xl">Flick Up to Shoot!</span>
            </div>
            <p className="text-white/50 text-sm">Swipe left or right to aim</p>
            {/* Animated swipe hint */}
            <div className="flex justify-center gap-6 mt-3">
              <span className="text-white/30 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>↖</span>
              <span className="text-white/60 text-3xl animate-bounce" style={{ animationDelay: '0.1s' }}>↑</span>
              <span className="text-white/30 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>↗</span>
            </div>
          </div>
        )}

        {phase === 'shooting' && !penaltyResult && (
          <div className="mt-4 text-center z-10 animate-fade-in">
            <div className="flex gap-1 justify-center">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }}/>
              ))}
            </div>
            <p className="text-white/40 text-sm mt-2">Waiting for result…</p>
          </div>
        )}

        {/* Goal tally */}
        {penaltyData.round > 1 && (
          <div className="absolute bottom-6 flex gap-2 z-10">
            {Array.from({ length: penaltyData.total }).map((_, i) => (
              <div key={i} className={`w-5 h-5 rounded-full border-2 border-white/40 ${
                i < penaltyData.round - 1 ? 'bg-white/60' : 'bg-transparent'
              }`} />
            ))}
          </div>
        )}
      </div>

      {/* Ball spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}
