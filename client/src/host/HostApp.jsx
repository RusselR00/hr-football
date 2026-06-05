import React, { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { QRCodeSVG } from 'qrcode.react';
import QuestionManager from './QuestionManager';

// ─── Phase config ─────────────────────────────────────────────────────────────
const PHASES = {
  lobby:          { label: 'Lobby',             next: 'Start Quiz',             event: 'host:start-quiz',    color: 'blue',   canAdvance: true },
  quiz:           { label: '⚽ Quiz — Live',     next: null,                     event: null,                 color: 'green',  canAdvance: false },
  'quiz-done':    { label: '⚽ Quiz Complete',   next: 'Start Guess the Player', event: 'host:start-guess',   color: 'green',  canAdvance: true },
  'guess-player': { label: '🕵️ Guess — Live',   next: null,                     event: null,                 color: 'purple', canAdvance: false },
  'guess-done':   { label: '🕵️ Guess Complete', next: 'Start Penalty Shootout', event: 'host:start-penalty', color: 'purple', canAdvance: true },
  penalty:        { label: '🥅 Penalty — Live',  next: null,                     event: null,                 color: 'red',    canAdvance: false },
  winner:         { label: '🏆 Game Over',       next: 'Reset Game',             event: 'host:reset',         color: 'yellow', canAdvance: true },
};

const PHASE_STEPS = ['lobby','quiz','quiz-done','guess-player','guess-done','penalty','winner'];

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'control',   label: '🎮 Control' },
  { id: 'players',   label: '👥 Players' },
  { id: 'questions', label: '⚙️ Questions' },
];

// ─── Small reusable card ──────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white/10 border border-white/15 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">{children}</p>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HostApp() {
  const [tab, setTab]           = useState('control');
  const [phase, setPhase]       = useState('lobby');
  const [players, setPlayers]   = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [roomCode, setRoomCode] = useState('DEEP24');
  const [networkUrl, setNetworkUrl] = useState('');
  const [playerUrl, setPlayerUrl]   = useState('');
  const [confirm, setConfirm]   = useState(null);
  const [penaltyProgress, setPenaltyProgress] = useState({ done: 0, total: 0 });
  const [quizState, setQuizState] = useState({ index: 0, total: 0, paused: false, revealed: false, correctCount: 0, totalAnswered: 0 });

  useEffect(() => {
    setPlayerUrl(window.location.origin);
    fetch('/api/network-ip').then(r => r.json()).then(({ ip }) => {
      const port = window.location.port || '80';
      setNetworkUrl(`http://${ip}:${port}`);
    }).catch(() => {});

    socket.connect();
    socket.emit('host:join');

    socket.on('host:state', ({ phase: p, players: pl, roomCode: rc }) => { setPhase(p); setPlayers(pl); setRoomCode(rc); });
    socket.on('host:player-joined', ({ players: pl }) => setPlayers({ ...pl }));
    socket.on('leaderboard', lb => setLeaderboard(lb));
    socket.on('quiz:question',    () => { setPhase('quiz'); setQuizState(q => ({ ...q, revealed: false, paused: false })); });
    socket.on('host:quiz-state',  s  => setQuizState(s));
    socket.on('guess:clue', () => setPhase('guess-player'));
    socket.on('penalty:start', () => setPhase('penalty'));
    socket.on('game:winner', () => setPhase('winner'));
    socket.on('host:penalty-progress', p => setPenaltyProgress(p));
    socket.on('round:end', ({ round }) => {
      if (round === 'quiz')  setPhase('quiz-done');
      if (round === 'guess') setPhase('guess-done');
    });
    socket.on('game:reset', () => { setPhase('lobby'); setPlayers({}); setLeaderboard([]); setPenaltyProgress({ done: 0, total: 0 }); });

    return () => socket.disconnect();
  }, []);

  const config      = PHASES[phase] || PHASES.lobby;
  const allPlayers  = Object.values(players);
  const playerCount = allPlayers.length;
  const activeCount = allPlayers.filter(p => p.connected !== false).length;
  const joinUrl     = networkUrl || playerUrl;
  const currentStep = PHASE_STEPS.indexOf(phase);

  const advance = () => { if (config?.event) socket.emit(config.event); if (config?.event === 'host:reset') setPhase('lobby'); };
  const skip    = () => socket.emit('host:skip');
  const push    = (screen) => socket.emit('host:push-screen', { screen });

  // ── CONTROL TAB ────────────────────────────────────────────────────────────
  const ControlTab = () => (
    <div className="space-y-4">

      {/* Top row: QR + Phase progress */}
      <div className="grid grid-cols-2 gap-4">

        {/* QR Code */}
        <Card>
          <SectionTitle>📱 Player Join</SectionTitle>
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-xl p-2 mb-2">
              <QRCodeSVG value={joinUrl} size={120} fgColor="#1565C0" />
            </div>
            <p className="text-white font-bold text-xs text-center break-all leading-snug">{joinUrl}</p>
            <div className="mt-2 bg-white/10 rounded-xl px-3 py-1.5 text-center w-full">
              <span className="text-white/50 text-xs">Room: </span>
              <span className="text-white font-black text-sm tracking-widest">{roomCode}</span>
              <span className="text-white/50 text-xs ml-2">· </span>
              <span className="text-green-400 font-black text-sm">{activeCount}</span>
              {playerCount !== activeCount && <span className="text-red-400 text-xs font-bold"> /{playerCount}</span>}
              <span className="text-white/50 text-xs"> active</span>
            </div>
          </div>
        </Card>

        {/* Phase progress */}
        <Card>
          <SectionTitle>📍 Game Progress</SectionTitle>
          <div className="space-y-1.5">
            {PHASE_STEPS.map((key, i) => {
              const p = PHASES[key];
              const done    = i < currentStep;
              const current = key === phase;
              return (
                <div key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  current ? 'bg-white/20 text-white' : done ? 'text-white/30' : 'text-white/20'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${current ? 'bg-green-400 animate-pulse' : done ? 'bg-white/30' : 'bg-white/10'}`} />
                  {p.label}
                  {current && <span className="ml-auto text-green-400 text-xs">◀ Now</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Game Controls */}
      <Card>
        <SectionTitle>🎮 Game Controls</SectionTitle>
        <div className="space-y-3">

          {/* ── Quiz slideshow controls ── */}
          {(phase === 'quiz' || phase === 'quiz-done') && (
            <div className="space-y-2">

              {/* Progress bar */}
              <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                <span>Q{quizState.index + 1} of {quizState.total}</span>
                {quizState.revealed && (
                  <span className="text-green-400 font-bold">
                    ✓ {quizState.correctCount}/{quizState.totalAnswered} correct
                  </span>
                )}
                {quizState.paused && <span className="text-yellow-400 font-bold">⏸ Paused</span>}
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${quizState.total ? ((quizState.index + 1) / quizState.total) * 100 : 0}%` }} />
              </div>

              {/* Media player row */}
              <div className="grid grid-cols-5 gap-1.5">
                {/* Prev question */}
                <button
                  onClick={() => socket.emit('host:goto-question', { index: quizState.index - 1 })}
                  disabled={quizState.index <= 0}
                  className="bg-white/10 border border-white/15 text-white font-black py-3 rounded-xl btn-press hover:bg-white/20 disabled:opacity-30 text-lg"
                  title="Previous question">⏮</button>

                {/* Pause / Resume */}
                <button
                  onClick={() => socket.emit(quizState.paused ? 'host:resume-timer' : 'host:pause-timer')}
                  disabled={quizState.revealed}
                  className={`border font-black py-3 rounded-xl btn-press text-lg disabled:opacity-30 ${
                    quizState.paused
                      ? 'bg-yellow-500/30 border-yellow-400/40 text-yellow-300 hover:bg-yellow-500/40'
                      : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                  }`}
                  title={quizState.paused ? 'Resume timer' : 'Pause timer'}>
                  {quizState.paused ? '▶' : '⏸'}
                </button>

                {/* Show Answer */}
                <button
                  onClick={() => socket.emit('host:show-answer')}
                  disabled={quizState.revealed}
                  className="bg-blue-600/30 border border-blue-500/40 text-blue-300 font-black py-3 rounded-xl btn-press hover:bg-blue-600/40 disabled:opacity-30 text-xs"
                  title="Show answer now">
                  {quizState.revealed ? '✓ Shown' : '👁 Answer'}
                </button>

                {/* Skip timer */}
                <button
                  onClick={() => socket.emit('host:skip')}
                  disabled={quizState.revealed}
                  className="bg-white/10 border border-white/15 text-white/70 font-bold py-3 rounded-xl btn-press hover:bg-white/20 disabled:opacity-30 text-lg"
                  title="Skip to answer">⏭</button>

                {/* Next question */}
                <button
                  onClick={() => socket.emit('host:goto-question', { index: quizState.index + 1 })}
                  disabled={quizState.index >= quizState.total - 1}
                  className="bg-white/10 border border-white/15 text-white font-black py-3 rounded-xl btn-press hover:bg-white/20 disabled:opacity-30 text-lg"
                  title="Next question">⏭</button>
              </div>

              {/* Legend */}
              <div className="flex justify-around text-white/25 text-xs pt-1">
                <span>⏮ Prev</span><span>⏸ Pause</span><span>👁 Answer</span><span>⏭ Skip</span><span>⏭ Next</span>
              </div>
            </div>
          )}

          {/* ── Guess player skip ── */}
          {phase === 'guess-player' && (
            <button onClick={() => socket.emit('host:show-answer')}
              className="w-full bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold py-3 rounded-xl btn-press text-sm">
              👁 Show Player Answer Now
            </button>
          )}

          {/* ── Penalty progress ── */}
          {phase === 'penalty' && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
              <p className="text-white/50 text-xs font-semibold mb-1">Penalty Progress</p>
              <p className="text-white font-black text-xl">{penaltyProgress.done} / {penaltyProgress.total || activeCount}</p>
              <p className="text-white/30 text-xs">players finished</p>
            </div>
          )}

          {/* ── Round advance button ── */}
          {config.next && config.canAdvance && (
            <button onClick={advance}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-base py-4 rounded-xl shadow-lg btn-press mt-1">
              {config.next} →
            </button>
          )}
          {!config.canAdvance && phase !== 'quiz' && phase !== 'guess-player' && phase !== 'penalty' && (
            <div className="w-full bg-white/5 border border-white/10 text-white/40 text-sm py-3 rounded-xl text-center font-semibold">
              ⏳ Round in progress…
            </div>
          )}
        </div>
      </Card>

      {/* Push screens */}
      <Card>
        <SectionTitle>📺 Push to All Screens</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => push('sync')}
            className="bg-blue-600/25 border border-blue-500/30 text-blue-300 font-bold py-3 rounded-xl btn-press text-xs hover:bg-blue-600/35">
            🔄 Sync Everyone
          </button>
          <button onClick={() => push('leaderboard')}
            className="bg-yellow-500/20 border border-yellow-400/25 text-yellow-300 font-bold py-3 rounded-xl btn-press text-xs hover:bg-yellow-500/30">
            🏆 Show Leaderboard
          </button>
          {phase === 'winner' && (
            <button onClick={() => push('winner')}
              className="col-span-2 bg-purple-600/20 border border-purple-500/25 text-purple-300 font-bold py-3 rounded-xl btn-press text-sm">
              🥇 Show Winner Again
            </button>
          )}
        </div>
      </Card>

      {/* Danger zone — only mid-game */}
      {phase !== 'lobby' && phase !== 'winner' && (
        <Card>
          <SectionTitle>⚠️ Danger Zone</SectionTitle>
          <div className="space-y-2">
            {confirm === 'end-game' ? (
              <div className="bg-orange-600/15 border border-orange-500/30 rounded-xl p-3">
                <p className="text-orange-300 text-xs font-bold mb-2 text-center">End game now with current scores?</p>
                <div className="flex gap-2">
                  <button onClick={() => { socket.emit('host:end-game'); setConfirm(null); }}
                    className="flex-1 bg-orange-500 text-white font-black py-2 rounded-lg text-sm btn-press">Yes, End It</button>
                  <button onClick={() => setConfirm(null)}
                    className="flex-1 bg-white/10 text-white/60 font-semibold py-2 rounded-lg text-sm btn-press">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirm('end-game')}
                className="w-full bg-orange-600/15 border border-orange-500/25 text-orange-300 font-semibold py-3 rounded-xl btn-press text-sm hover:bg-orange-600/25">
                🏁 End Game &amp; Show Winner
              </button>
            )}
            {confirm === 'force-reset' ? (
              <div className="bg-red-700/15 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-300 text-xs font-bold mb-2 text-center">Wipe everything and start fresh?</p>
                <div className="flex gap-2">
                  <button onClick={() => { socket.emit('host:force-reset'); setConfirm(null); }}
                    className="flex-1 bg-red-600 text-white font-black py-2 rounded-lg text-sm btn-press">Yes, Reset All</button>
                  <button onClick={() => setConfirm(null)}
                    className="flex-1 bg-white/10 text-white/60 font-semibold py-2 rounded-lg text-sm btn-press">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirm('force-reset')}
                className="w-full bg-red-700/15 border border-red-600/25 text-red-400 font-semibold py-3 rounded-xl btn-press text-sm hover:bg-red-700/25">
                🗑 Force Reset (Clear All)
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Live leaderboard */}
      <Card>
        <SectionTitle>🏆 Live Leaderboard</SectionTitle>
        {leaderboard.length === 0
          ? <p className="text-white/25 text-sm text-center py-4">Waiting for players…</p>
          : (
            <div className="space-y-1.5">
              {leaderboard.slice(0, 15).map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                  i === 0 ? 'bg-yellow-500/20 border border-yellow-400/25' :
                  i === 1 ? 'bg-slate-400/10' : i === 2 ? 'bg-orange-700/10' : 'bg-white/5'
                }`}>
                  <span className="text-white/35 text-xs w-5 flex-shrink-0">#{i + 1}</span>
                  <span className="text-base flex-shrink-0">{p.name.split(' ')[0]}</span>
                  <span className="text-white/80 text-sm flex-1 truncate">{p.name.split(' ').slice(1).join(' ')}</span>
                  <span className={`font-black text-sm flex-shrink-0 ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>
                    {p.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </Card>
    </div>
  );

  // ── PLAYERS TAB ────────────────────────────────────────────────────────────
  const PlayersTab = () => (
    <div className="space-y-4">
      <Card>
        <SectionTitle>👥 Joined Players ({playerCount})</SectionTitle>
        {playerCount === 0
          ? <p className="text-white/25 text-sm text-center py-8">No players yet — share the QR code.</p>
          : (
            <div className="space-y-2">
              {Object.values(players).map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 border px-4 py-3 rounded-xl transition-all ${
                  p.connected === false
                    ? 'bg-red-900/20 border-red-500/20 opacity-60'
                    : 'bg-white/5 border-white/10'
                }`}>
                  <span className="text-white/30 text-xs w-5">#{i + 1}</span>
                  <span className="text-xl">{p.name.split(' ')[0]}</span>
                  <span className="text-white/80 font-medium flex-1">{p.name.split(' ').slice(1).join(' ')}</span>
                  {p.connected === false && (
                    <span className="text-red-400 text-xs font-bold">📵 dropped</span>
                  )}
                  <span className="text-white/40 text-xs">
                    {leaderboard.find(l => l.id === p.id)?.score?.toLocaleString() || '0'} pts
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </Card>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0D47A1 0%,#0a0f1e 60%)' }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#0a1428]/95 backdrop-blur border-b border-white/10">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-9 w-auto" onError={e => e.target.style.display = 'none'} />
            <div>
              <p className="text-white font-black text-sm leading-none">Host Dashboard</p>
              <p className="text-blue-400 text-xs">Deep Seafood FC 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
              config.color === 'green'  ? 'bg-green-500/20 text-green-300 border-green-400/30' :
              config.color === 'purple' ? 'bg-purple-500/20 text-purple-300 border-purple-400/30' :
              config.color === 'red'    ? 'bg-red-500/20 text-red-300 border-red-400/30' :
              config.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' :
                                          'bg-blue-500/20 text-blue-300 border-blue-400/30'
            }`}>
              {config.label}
            </div>
            <div className="bg-white/10 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="text-white text-xs font-bold">{activeCount}</span>
              {playerCount !== activeCount && (
                <span className="text-red-400 text-xs font-bold">/{playerCount}</span>
              )}
              <span className="text-xs">👥</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 pb-2 gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all btn-press ${
                tab === t.id ? 'bg-blue-600 text-white' : 'bg-white/8 text-white/50 hover:bg-white/15'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
        {tab === 'control'   && <ControlTab />}
        {tab === 'players'   && <PlayersTab />}
        {tab === 'questions' && <QuestionManager />}
      </div>
    </div>
  );
}
