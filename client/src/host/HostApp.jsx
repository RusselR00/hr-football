import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { QRCodeSVG } from 'qrcode.react';

const PHASES = {
  lobby: { label: 'Lobby', next: 'Start Quiz', event: 'host:start-quiz', color: 'blue' },
  quiz: { label: '⚽ Quiz Round', next: 'Start Guess Player', event: 'host:start-guess', color: 'green' },
  'guess-player': { label: '🕵️ Guess Player', next: 'Start Predictions', event: 'host:start-predict', color: 'purple' },
  predict: { label: '🎯 Predict Score', next: 'Start Penalty Shootout', event: 'host:start-penalty', color: 'orange' },
  penalty: { label: '🥅 Penalty Shootout', next: null, event: null, color: 'red' },
  winner: { label: '🏆 Game Over', next: 'Reset Game', event: 'host:reset', color: 'yellow' },
};

export default function HostApp() {
  const [phase, setPhase] = useState('lobby');
  const [players, setPlayers] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [roomCode, setRoomCode] = useState('DEEP24');
  const [playerUrl, setPlayerUrl] = useState('');

  useEffect(() => {
    setPlayerUrl(window.location.origin);
    socket.connect();
    socket.emit('host:join');

    socket.on('host:state', ({ phase: p, players: pl, roomCode: rc }) => {
      setPhase(p);
      setPlayers(pl);
      setRoomCode(rc);
    });

    socket.on('host:player-joined', ({ players: pl }) => setPlayers({ ...pl }));
    socket.on('leaderboard', (lb) => setLeaderboard(lb));

    socket.on('quiz:question', ({ index }) => setPhase('quiz'));
    socket.on('guess:clue', () => setPhase('guess-player'));
    socket.on('predict:match', () => setPhase('predict'));
    socket.on('penalty:kick', () => setPhase('penalty'));
    socket.on('game:winner', () => setPhase('winner'));
    socket.on('game:reset', () => { setPhase('lobby'); setPlayers({}); setLeaderboard([]); });

    return () => socket.disconnect();
  }, []);

  const advance = () => {
    const config = PHASES[phase];
    if (config?.event) socket.emit(config.event);
    if (config?.event === 'host:reset') setPhase('lobby');
  };

  const skip = () => socket.emit('host:skip');

  const config = PHASES[phase] || PHASES.lobby;
  const playerCount = Object.keys(players).length;
  const joinUrl = playerUrl;

  return (
    <div style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #0a0f1e 60%)' }} className="min-h-screen p-4 font-display">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">⚽ Host Dashboard</h1>
          <p className="text-white/50 text-sm">Deep Seafood Football Championship</p>
        </div>
        <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-center">
          <p className="text-white/50 text-xs">ROOM CODE</p>
          <p className="text-white font-black text-2xl tracking-widest">{roomCode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* QR & Join */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col items-center">
          <p className="text-white/60 text-sm font-semibold mb-3">📱 Scan to Join</p>
          <div className="bg-white rounded-2xl p-3">
            <QRCodeSVG value={joinUrl} size={180} fgColor="#1565C0" />
          </div>
          <p className="text-white/50 text-xs mt-3 text-center break-all">{joinUrl}</p>
          <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 text-center w-full">
            <span className="text-white/60 text-xs">Players Connected: </span>
            <span className="text-white font-black text-lg">{playerCount}</span>
          </div>
        </div>

        {/* Game Control */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/60 text-sm font-semibold">GAME CONTROL</p>
            <div className={`px-3 py-1 rounded-full text-xs font-bold bg-${config.color}-500/30 text-${config.color}-300 border border-${config.color}-400/30`}>
              {config.label}
            </div>
          </div>

          {/* Phase Steps */}
          <div className="space-y-2 mb-5 flex-1">
            {Object.entries(PHASES).map(([key, val]) => (
              <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                key === phase ? 'bg-white/20 border border-white/30' : 'bg-white/5 opacity-50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${key === phase ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                <span className="text-white text-sm font-medium">{val.label}</span>
              </div>
            ))}
          </div>

          {config.next && (
            <button
              onClick={advance}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg py-4 rounded-xl shadow-lg btn-press mb-2"
            >
              {config.next} →
            </button>
          )}

          {['quiz', 'guess-player', 'predict', 'penalty'].includes(phase) && (
            <button
              onClick={skip}
              className="w-full bg-white/10 border border-white/20 text-white/70 font-semibold py-2.5 rounded-xl hover:bg-white/20 transition-all btn-press text-sm"
            >
              ⏭ Skip to Reveal
            </button>
          )}
        </div>

        {/* Live Leaderboard */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
          <p className="text-white/60 text-sm font-semibold mb-3">🏆 LIVE LEADERBOARD</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {leaderboard.slice(0, 15).map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                i === 0 ? 'bg-yellow-500/20 border border-yellow-400/30' :
                i === 1 ? 'bg-gray-400/10' : i === 2 ? 'bg-orange-700/10' : 'bg-white/5'
              }`}>
                <span className="text-white/40 text-xs w-5">#{i+1}</span>
                <span className="text-sm">{p.name.split(' ')[0]}</span>
                <span className="text-white/80 text-sm flex-1 truncate">{p.name.split(' ').slice(1).join(' ')}</span>
                <span className="text-white font-bold text-sm">{p.score.toLocaleString()}</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-white/30 text-sm text-center py-4">Waiting for players...</p>
            )}
          </div>
        </div>
      </div>

      {/* Player Grid */}
      {playerCount > 0 && (
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">All Players ({playerCount})</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(players).map(p => (
              <div key={p.id} className="bg-white/10 border border-white/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <span>{p.name.split(' ')[0]}</span>
                <span className="text-white/80 text-sm">{p.name.split(' ').slice(1).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
