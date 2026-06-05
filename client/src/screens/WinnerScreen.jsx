import React, { useEffect, useRef } from 'react';

/* Simple canvas confetti — no deps needed */
function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#1565C0','#C62828','#FFD700','#22c55e','#fff','#f97316'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 16 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 2,
      vr: (Math.random() - 0.5) * 0.15,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

export default function WinnerScreen({ winner, leaderboard, player }) {
  const w  = winner?.winner;
  const lb = winner?.leaderboard || leaderboard;
  const isWinner = w?.id === player?.id;

  return (
    <div className="screen game-bg flex flex-col items-center overflow-y-auto">
      <Confetti />

      <div className="relative z-10 flex flex-col items-center w-full px-4">
        {/* Trophy */}
        <div className="text-8xl mt-8 mb-3 animate-bounce-in">🏆</div>

        <p className="text-white/50 font-semibold text-xs uppercase tracking-widest mb-1">Champion</p>
        <h1 className="text-4xl font-black text-white text-center text-shadow-lg leading-tight mb-1">
          {w?.name || '—'}
        </h1>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-yellow-300 font-black text-2xl">{w?.score?.toLocaleString()}</span>
          <span className="text-yellow-400/50 text-sm">points</span>
        </div>

        {isWinner && (
          <div className="bg-yellow-500/25 border border-yellow-400/50 rounded-2xl px-8 py-3 mb-5 animate-bounce-in">
            <p className="text-yellow-300 font-black text-2xl text-center">🎉 YOU WON! 🎉</p>
          </div>
        )}

        {/* Podium */}
        {lb && lb.length >= 3 && (
          <div className="flex items-end justify-center gap-2 mb-5 w-full max-w-xs">
            {[1, 0, 2].map((rank, col) => {
              const entry = lb[rank];
              if (!entry) return null;
              const heights = ['h-20', 'h-28', 'h-16'];
              const medals  = ['🥈', '🥇', '🥉'];
              const bgs     = ['bg-slate-400/20 border-slate-400/30', 'bg-yellow-500/25 border-yellow-400/40', 'bg-orange-700/20 border-orange-600/30'];
              return (
                <div key={rank} className="flex flex-col items-center flex-1">
                  <div className="text-lg mb-0.5">{entry.name.split(' ')[0]}</div>
                  <div className="text-white/60 text-xs font-bold text-center leading-tight mb-1 px-1 truncate w-full text-center">
                    {entry.name.split(' ').slice(1).join(' ')}
                  </div>
                  <div className={`w-full ${heights[col]} rounded-t-xl border flex flex-col items-center justify-center ${bgs[col]}`}>
                    <div className="text-xl">{medals[col]}</div>
                    <div className="text-white font-black text-xs">{entry.score.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full standings */}
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Final Standings</p>
          </div>
          {lb?.slice(0, 10).map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 ${p.id === player?.id ? 'bg-blue-600/20' : ''}`}>
              <span className="text-white/35 text-sm w-6">#{i+1}</span>
              <span className="text-lg">{p.name.split(' ')[0]}</span>
              <span className="text-white/70 text-sm flex-1 truncate">{p.name.split(' ').slice(1).join(' ')}</span>
              <span className="text-white font-bold text-sm">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <img src="/logo.png" alt="" className="h-12 w-auto mx-auto mb-2 opacity-60"
          onError={e => e.target.style.display='none'} />
        <p className="text-white/20 text-xs text-center mb-8">
          Deep Seafood Football Championship 2026 ⚽
        </p>
      </div>
    </div>
  );
}
