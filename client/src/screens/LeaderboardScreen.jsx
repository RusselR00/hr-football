import React from 'react';

const MEDALS = ['🥇', '🥈', '🥉'];
const ROUND_NAMES = {
  quiz: '⚽ Football Quiz',
  guess: '🕵️ Guess the Player',
  predict: '🎯 Predict the Score',
  penalty: '🥅 Penalty Shootout',
};

export default function LeaderboardScreen({ leaderboard, player, roundEnd }) {
  return (
    <div className="game-bg min-h-screen flex flex-col px-4 pt-6">
      {/* Round Complete Banner */}
      {roundEnd && (
        <div className="bg-gradient-to-r from-brand-blue/40 to-brand-red/30 border border-white/20 rounded-2xl p-4 text-center mb-5 animate-bounce-in">
          <p className="text-white font-black text-xl">{roundEnd.message}</p>
          <p className="text-white/60 text-sm mt-1">Leaderboard Updated</p>
        </div>
      )}

      <h2 className="text-white font-black text-2xl text-center mb-5">🏆 Leaderboard</h2>

      <div className="space-y-3">
        {leaderboard.slice(0, 10).map((p, i) => {
          const isMe = p.id === player?.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all animate-slide-up ${
                i === 0 ? 'bg-yellow-500/20 border border-yellow-400/40' :
                i === 1 ? 'bg-gray-400/10 border border-gray-400/30' :
                i === 2 ? 'bg-orange-700/20 border border-orange-600/30' :
                isMe ? 'bg-brand-blue/20 border border-brand-blue/40' :
                'bg-white/5 border border-white/10'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="w-8 text-center font-black text-lg">
                {i < 3 ? MEDALS[i] : <span className="text-white/40">#{i + 1}</span>}
              </div>
              <div className="text-xl">{p.name.split(' ')[0]}</div>
              <div className="flex-1">
                <p className={`font-bold ${isMe ? 'text-brand-blue-light' : 'text-white'}`}>
                  {p.name.split(' ').slice(1).join(' ')}
                  {isMe && <span className="text-xs bg-brand-blue text-white px-1.5 py-0.5 rounded-full ml-2">You</span>}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-black text-xl ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>
                  {p.score.toLocaleString()}
                </p>
                <p className="text-white/30 text-xs">pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* My Position if not in top 10 */}
      {player && leaderboard.findIndex(p => p.id === player.id) >= 10 && (
        <div className="mt-4 bg-brand-blue/20 border border-brand-blue/40 rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in">
          <span className="text-white/50 font-bold">#{leaderboard.findIndex(p => p.id === player.id) + 1}</span>
          <span className="text-white font-bold flex-1">You</span>
          <span className="text-white font-black">{leaderboard.find(p => p.id === player.id)?.score.toLocaleString()} pts</span>
        </div>
      )}

      <div className="mt-6 text-center animate-fade-in">
        <p className="text-white/30 text-sm">Waiting for next round...</p>
        <div className="flex gap-1 justify-center mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-brand-blue-light rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
