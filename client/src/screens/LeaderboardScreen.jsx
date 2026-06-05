import React from 'react';

const MEDALS = ['🥇','🥈','🥉'];

export default function LeaderboardScreen({ leaderboard, player, roundEnd }) {
  const myRank = leaderboard.findIndex(p => p.id === player?.id);

  return (
    <div className="screen game-bg flex flex-col">
      {/* Round complete */}
      {roundEnd && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-blue-600/40 to-red-600/30 border border-white/20 rounded-2xl p-4 text-center animate-bounce-in flex-shrink-0">
          <p className="text-white font-black text-xl">{roundEnd.message}</p>
        </div>
      )}

      <h2 className="text-white font-black text-2xl text-center mt-5 mb-4 flex-shrink-0">🏆 Leaderboard</h2>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2.5 pb-4">
        {leaderboard.slice(0, 12).map((p, i) => {
          const isMe = p.id === player?.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all animate-slide-up ${
                i === 0 ? 'bg-yellow-500/20 border border-yellow-400/40' :
                i === 1 ? 'bg-slate-400/10 border border-slate-400/25' :
                i === 2 ? 'bg-orange-700/15 border border-orange-600/25' :
                isMe    ? 'bg-blue-600/20 border border-blue-500/40' :
                          'bg-white/5 border border-white/10'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="w-8 text-center font-black text-lg">
                {i < 3 ? MEDALS[i] : <span className="text-white/35 text-sm">#{i+1}</span>}
              </div>
              <div className="text-xl flex-shrink-0">{p.name.split(' ')[0]}</div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                  {p.name.split(' ').slice(1).join(' ')}
                </p>
                {isMe && <span className="text-xs text-blue-400 font-semibold">← You</span>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-black text-xl ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>
                  {p.score.toLocaleString()}
                </p>
                <p className="text-white/25 text-xs">pts</p>
              </div>
            </div>
          );
        })}

        {/* Sticky "you" if outside top 12 */}
        {myRank >= 12 && (
          <div className="bg-blue-600/25 border border-blue-500/40 rounded-2xl px-4 py-3.5 flex items-center gap-3 animate-fade-in sticky bottom-0">
            <span className="text-white/40 font-bold w-8 text-center text-sm">#{myRank+1}</span>
            <span className="text-xl">{leaderboard[myRank]?.name.split(' ')[0]}</span>
            <span className="text-blue-300 font-bold flex-1 truncate">
              {leaderboard[myRank]?.name.split(' ').slice(1).join(' ')} ← You
            </span>
            <span className="text-white font-black">{leaderboard[myRank]?.score.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Waiting dots */}
      <div className="py-5 text-center flex-shrink-0">
        <p className="text-white/30 text-sm mb-2">Waiting for next round…</p>
        <div className="flex gap-1.5 justify-center">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}/>
          ))}
        </div>
      </div>
    </div>
  );
}
