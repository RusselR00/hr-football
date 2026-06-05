import React, { useState, useRef, useEffect, useCallback } from 'react';

const GK_POS    = ['12%', '50%', '88%'];
const BALL_TARGETS = [
  { x: '18%', y: '40%' },
  { x: '50%', y: '25%' },
  { x: '82%', y: '40%' },
];
const TOTAL_KICKS = 5;

export default function PenaltyScreen({ socket, player }) {
  // Each player tracks their own kicks independently
  const [kickNum, setKickNum]       = useState(0);       // 0 = not started, 1-5 = kick in progress
  const [phase, setPhase]           = useState('wait');  // wait | ready | shooting | result | done
  const [gkDir, setGkDir]           = useState(null);
  const [ballTarget, setBallTarget] = useState(null);
  const [ballFlying, setBallFlying] = useState(false);
  const [isGoal, setIsGoal]         = useState(null);
  const [goals, setGoals]           = useState(0);
  const [ptsEarned, setPtsEarned]   = useState(0);
  const [history, setHistory]       = useState([]);      // [{goal}] per kick

  const touchStart  = useRef(null);
  const hasShot     = useRef(false);
  const containerRef = useRef(null);

  // Host started penalty round
  useEffect(() => {
    const onStart = () => {
      setKickNum(1);
      setPhase('ready');
      setGoals(0);
      setHistory([]);
      setBallFlying(false);
      setGkDir(null);
      setIsGoal(null);
      hasShot.current = false;
    };

    const onKickResult = ({ dir, goalkeeperDir, goal, kickNum: k, totalKicks }) => {
      setGkDir(goalkeeperDir);
      setBallTarget(BALL_TARGETS[dir]);
      setTimeout(() => setBallFlying(true), 30);

      setTimeout(() => {
        setIsGoal(goal);
        setPhase('result');
        if (goal) setGoals(g => g + 1);
        setHistory(h => [...h, { goal }]);
      }, 400);

      // Auto-advance to next kick after showing result
      if (k < totalKicks) {
        setTimeout(() => {
          setKickNum(k + 1);
          setPhase('ready');
          setBallFlying(false);
          setGkDir(null);
          setIsGoal(null);
          hasShot.current = false;
        }, 2500);
      }
    };

    const onDone = ({ goals: g, pts }) => {
      setTimeout(() => {
        setGoals(g);
        setPtsEarned(pts);
        setPhase('done');
      }, 2500);
    };

    socket.on('penalty:start',       onStart);
    socket.on('penalty:kick-result', onKickResult);
    socket.on('penalty:done',        onDone);

    return () => {
      socket.off('penalty:start',       onStart);
      socket.off('penalty:kick-result', onKickResult);
      socket.off('penalty:done',        onDone);
    };
  }, [socket]);

  const shoot = useCallback((dx, containerW) => {
    if (hasShot.current || phase !== 'ready') return;
    hasShot.current = true;
    setPhase('shooting');

    const threshold = containerW * 0.12;
    const dir = dx < -threshold ? 0 : dx > threshold ? 2 : 1;
    setBallTarget(BALL_TARGETS[dir]);

    socket.emit('penalty:shoot', { direction: dir });
  }, [phase, socket]);

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
    if (dy < -25) shoot(dx, containerRef.current?.offsetWidth || 375);
    touchStart.current = null;
  };
  const onMouseDown = (e) => { touchStart.current = { x: e.clientX, y: e.clientY }; };
  const onMouseUp = (e) => {
    if (!touchStart.current || hasShot.current) return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    if (dy < -15) shoot(dx, containerRef.current?.offsetWidth || 375);
    touchStart.current = null;
  };

  // ── Waiting for host to start ──────────────────────────────────────────────
  if (phase === 'wait') {
    return (
      <div className="screen game-bg flex flex-col items-center justify-center px-4">
        <div className="text-7xl mb-4">🥅</div>
        <h2 className="text-white font-black text-2xl mb-2">Penalty Shootout</h2>
        <p className="text-white/50 text-sm mb-6">Waiting for host to start…</p>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }}/>
          ))}
        </div>
      </div>
    );
  }

  // ── All done ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="screen game-bg flex flex-col items-center justify-center px-4">
        <div className="text-7xl mb-4 animate-bounce-in">
          {goals >= 4 ? '🔥' : goals >= 2 ? '⚽' : '😅'}
        </div>
        <h2 className="text-white font-black text-3xl mb-1 animate-fade-in">
          {goals} / {TOTAL_KICKS} Goals!
        </h2>
        <p className="text-yellow-300 font-black text-2xl mb-6 animate-fade-in">+{ptsEarned} points</p>

        {/* Kick history */}
        <div className="flex gap-3 mb-8">
          {history.map((k, i) => (
            <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border-2 ${
              k.goal ? 'bg-green-500/30 border-green-400 text-green-300' : 'bg-red-500/20 border-red-400/40 text-red-400'
            }`}>
              {k.goal ? '⚽' : '🧤'}
            </div>
          ))}
        </div>

        <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-center animate-fade-in">
          <p className="text-white/50 text-sm">Waiting for host to show final results…</p>
        </div>
      </div>
    );
  }

  // ── Active penalty game ───────────────────────────────────────────────────
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
      <div className="relative flex flex-col items-center" style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #132347 60%, #1a3a5c 100%)',
        flex: '0 0 52%',
      }}>
        {/* Floodlights */}
        <div className="absolute top-2 left-4 text-xl opacity-60">💡</div>
        <div className="absolute top-2 right-4 text-xl opacity-60">💡</div>

        {/* HUD */}
        <div className="flex items-center justify-between w-full px-4 pt-3 pb-2 z-20">
          <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-white font-bold text-sm">Kick {kickNum} / {TOTAL_KICKS}</span>
          </div>
          {/* Kick dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_KICKS }).map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full border ${
                i < history.length
                  ? history[i].goal ? 'bg-green-400 border-green-300' : 'bg-red-400 border-red-300'
                  : i === kickNum - 1 ? 'bg-white border-white' : 'bg-white/20 border-white/20'
              }`}/>
            ))}
          </div>
          <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="text-white font-bold text-sm">⚽ {goals}</span>
          </div>
        </div>

        {/* Goal */}
        <div className="relative flex-1 flex items-start justify-center w-full px-6 pt-2">
          <div className="relative w-full" style={{ maxWidth: 300 }}>
            <div className="relative border-white"
              style={{
                height: 130,
                borderTop: '5px solid white', borderLeft: '5px solid white',
                borderRight: '5px solid white', borderBottom: 'none',
                boxShadow: isGoal ? '0 0 30px rgba(255,215,0,0.8)' : '0 0 15px rgba(255,255,255,0.15)',
              }}
            >
              {/* Net */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)',
                backgroundSize: '15px 12px', backgroundColor: 'rgba(10,20,60,0.85)',
              }}/>
              {/* Thirds */}
              <div className="absolute inset-0 flex pointer-events-none">
                {['L','C','R'].map((z,i) => (
                  <div key={i} className={`flex-1 flex items-end justify-center pb-1 ${i<2?'border-r border-white/15':''}`}>
                    <span className="text-white/15 text-xs font-black">{z}</span>
                  </div>
                ))}
              </div>

              {/* Flying ball */}
              {ballFlying && ballTarget && (
                <div className="absolute z-20 text-3xl pointer-events-none"
                  style={{
                    left: ballTarget.x, top: ballTarget.y,
                    transform: 'translate(-50%,-50%)',
                    transition: 'left 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1)',
                    filter: isGoal ? 'drop-shadow(0 0 12px gold)' : 'none',
                    fontSize: 28, animation: 'spin 0.55s linear',
                  }}>⚽</div>
              )}

              {/* Goalkeeper */}
              <div className="absolute bottom-0 z-10 text-4xl pointer-events-none"
                style={{
                  left: gkDir !== null ? GK_POS[gkDir] : '50%',
                  transform: `translateX(-50%) ${gkDir===0?'scaleX(-1) rotate(-25deg)':gkDir===2?'rotate(-25deg)':''}`,
                  transition: 'left 0.45s cubic-bezier(0.34,1.56,0.64,1), transform 0.45s ease',
                  fontSize: 38, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.7))',
                }}>🧤</div>
            </div>
            <div className="flex justify-between -mt-0.5">
              <div className="w-2 h-3 bg-white rounded-b-sm"/>
              <div className="w-2 h-3 bg-white rounded-b-sm"/>
            </div>
          </div>
        </div>

        {/* Result banner */}
        {phase === 'result' && isGoal !== null && (
          <div className={`absolute bottom-3 left-4 right-4 z-30 text-center py-3 rounded-2xl font-black text-4xl shadow-2xl animate-bounce-in ${
            isGoal
              ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
              : 'bg-gradient-to-r from-red-600 to-red-500 text-white'
          }`}>
            {isGoal ? '⚽  G O A L !' : '🧤  S A V E D !'}
          </div>
        )}
      </div>

      {/* ── PITCH ── */}
      <div className="relative flex flex-col items-center justify-start pt-6" style={{
        flex: '0 0 48%',
        background: 'linear-gradient(180deg, #1e7a35 0%, #196830 40%, #145224 100%)',
        borderTop: '3px solid rgba(255,255,255,0.4)',
      }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-14 border-2 border-white/20 border-t-0 rounded-b-full"/>
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/50"/>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 20px, rgba(0,0,0,0.3) 20px, rgba(0,0,0,0.3) 40px)',
        }}/>

        {/* Ball */}
        {!ballFlying ? (
          <div className="relative z-10 mt-4" style={{
            fontSize: 64, cursor: 'grab',
            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))',
          }}>⚽</div>
        ) : (
          <div className="relative z-10 mt-4 opacity-20" style={{ fontSize: 64 }}>⚽</div>
        )}

        {phase === 'ready' && (
          <div className="mt-3 text-center z-10 px-4 animate-fade-in">
            <p className="text-white/90 font-black text-xl">Flick Up to Shoot!</p>
            <p className="text-white/50 text-sm mt-1">Swipe left or right to aim</p>
            <div className="flex justify-center gap-6 mt-3">
              <span className="text-white/30 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>↖</span>
              <span className="text-white/60 text-3xl animate-bounce" style={{ animationDelay: '0.1s' }}>↑</span>
              <span className="text-white/30 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>↗</span>
            </div>
          </div>
        )}
        {phase === 'shooting' && (
          <p className="mt-4 text-white/50 text-sm z-10 animate-fade-in">Shot taken…</p>
        )}
      </div>

      <style>{`
        @keyframes spin { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
      `}</style>
    </div>
  );
}
