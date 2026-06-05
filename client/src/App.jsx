import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import QuizScreen from './screens/QuizScreen';
import GuessPlayerScreen from './screens/GuessPlayerScreen';
import PenaltyScreen from './screens/PenaltyScreen';
import AnswerRevealScreen from './screens/AnswerRevealScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import WinnerScreen from './screens/WinnerScreen';
import HostApp from './host/HostApp';

const isHost = window.location.pathname === '/host';

function ConnectionBanner({ status, rejoining }) {
  if (status === 'connected' && !rejoining) return null;
  if (rejoining) return (
    <div className="fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-bold bg-blue-600 text-white">
      🔄 Reconnecting you to the game…
    </div>
  );
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-bold ${
      status === 'connecting' ? 'bg-yellow-500 text-yellow-900' : 'bg-red-600 text-white'
    }`}>
      {status === 'connecting' ? '⏳ Connecting to server…' : '❌ Disconnected — trying to reconnect…'}
    </div>
  );
}

export default function App() {
  const [screen, setScreen]           = useState(isHost ? 'host' : 'join');
  const [player, setPlayer]           = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quizData, setQuizData]       = useState(null);
  const [quizReveal, setQuizReveal]   = useState(null);
  const [timerPaused, setTimerPaused] = useState(false);
  const [guessData, setGuessData]     = useState(null);
  const [winner, setWinner]           = useState(null);
  const [roundEnd, setRoundEnd]       = useState(null);
  const [connStatus, setConnStatus]   = useState('connecting');
  const [rejoining, setRejoining]     = useState(false);

  useEffect(() => {
    if (isHost) return;

    socket.connect();

    socket.on('connect', () => {
      setConnStatus('connected');
      // Auto-rejoin if we have a saved session
      const saved = localStorage.getItem('dsfc_player');
      if (saved) {
        try {
          const { name } = JSON.parse(saved);
          if (name) { setRejoining(true); socket.emit('player:join', { name }); }
        } catch (_) {}
      }
    });
    socket.on('disconnect', () => setConnStatus('disconnected'));
    socket.on('connect_error', () => setConnStatus('disconnected'));

    socket.on('join:success', ({ player: p, rejoined }) => {
      localStorage.setItem('dsfc_player', JSON.stringify({ name: p.name }));
      setPlayer(p);
      setRejoining(false);
      if (!rejoined) setScreen('lobby'); // rejoined players get synced by server
    });
    socket.on('leaderboard',  lb => setLeaderboard(lb));

    socket.on('quiz:question', data => { setQuizReveal(null); setTimerPaused(false); setQuizData(data); setScreen('quiz'); });
    socket.on('quiz:reveal',   data => { setQuizReveal(data); setScreen('answer-reveal'); });
    socket.on('timer:paused',  ()   => setTimerPaused(true));
    socket.on('timer:resumed', ()   => setTimerPaused(false));

    socket.on('guess:clue',   data => { setGuessData(data); setScreen('guess'); });
    socket.on('guess:reveal', data => setGuessData(prev => ({ ...prev, revealed: data.answer })));

    socket.on('penalty:start',  () => { setScreen('penalty'); });
    socket.on('penalty:resume', () => { setScreen('penalty'); }); // reconnect mid-penalty

    socket.on('round:end',   data => { setRoundEnd(data); setScreen('leaderboard'); });
    socket.on('game:winner', data => { setWinner(data); setScreen('winner'); });
    socket.on('game:reset',  ()   => {
      localStorage.removeItem('dsfc_player');
      setScreen('join'); setPlayer(null);
    });
    socket.on('host:push-leaderboard', data => { setLeaderboard(data.leaderboard); setRoundEnd(null); setScreen('leaderboard'); });

    return () => socket.disconnect();
  }, []);

  if (isHost) return <HostApp />;

  const props = { player, leaderboard, socket };

  const screenEl = () => {
    switch (screen) {
      case 'join':        return <JoinScreen socket={socket} />;
      case 'lobby':       return <LobbyScreen {...props} />;
      case 'quiz':          return <QuizScreen {...props} quizData={quizData} timerPaused={timerPaused} />;
      case 'answer-reveal': return <AnswerRevealScreen revealData={{ ...quizReveal, feedback: quizReveal?.correct?.includes(player?.id) ? 'correct' : 'wrong' }} />;
      case 'guess':       return <GuessPlayerScreen {...props} guessData={guessData} />;
      case 'penalty':     return <PenaltyScreen socket={socket} player={player} />;
      case 'leaderboard': return <LeaderboardScreen {...props} roundEnd={roundEnd} />;
      case 'winner':      return <WinnerScreen {...props} winner={winner} />;
      default:            return <JoinScreen socket={socket} />;
    }
  };

  return (
    <>
      <ConnectionBanner status={connStatus} rejoining={rejoining} />
      {screenEl()}
    </>
  );
}
