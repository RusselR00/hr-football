import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import QuizScreen from './screens/QuizScreen';
import GuessPlayerScreen from './screens/GuessPlayerScreen';
import PenaltyScreen from './screens/PenaltyScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import WinnerScreen from './screens/WinnerScreen';
import HostApp from './host/HostApp';

const isHost = window.location.pathname === '/host';

function ConnectionBanner({ status }) {
  if (status === 'connected') return null;
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
  const [guessData, setGuessData]     = useState(null);
  const [penaltyData, setPenaltyData] = useState(null);
  const [penaltyResult, setPenaltyResult] = useState(null);
  const [winner, setWinner]           = useState(null);
  const [roundEnd, setRoundEnd]       = useState(null);
  const [connStatus, setConnStatus]   = useState('connecting');

  useEffect(() => {
    if (isHost) return;

    socket.connect();

    socket.on('connect',    () => setConnStatus('connected'));
    socket.on('disconnect', () => setConnStatus('disconnected'));
    socket.on('connect_error', () => setConnStatus('disconnected'));

    socket.on('join:success', ({ player: p }) => { setPlayer(p); setScreen('lobby'); });
    socket.on('leaderboard',  lb => setLeaderboard(lb));

    socket.on('quiz:question', data => { setQuizReveal(null); setQuizData(data); setScreen('quiz'); });
    socket.on('quiz:reveal',   data => setQuizReveal(data));

    socket.on('guess:clue',   data => { setGuessData(data); setScreen('guess'); });
    socket.on('guess:reveal', data => setGuessData(prev => ({ ...prev, revealed: data.answer })));

    socket.on('penalty:kick',   data => { setPenaltyResult(null); setPenaltyData(data); setScreen('penalty'); });
    socket.on('penalty:result', data => setPenaltyResult(data));

    socket.on('round:end',   data => { setRoundEnd(data); setScreen('leaderboard'); });
    socket.on('game:winner', data => { setWinner(data); setScreen('winner'); });
    socket.on('game:reset',  ()   => { setScreen('join'); setPlayer(null); });

    return () => socket.disconnect();
  }, []);

  if (isHost) return <HostApp />;

  const props = { player, leaderboard, socket };

  const screenEl = () => {
    switch (screen) {
      case 'join':        return <JoinScreen socket={socket} />;
      case 'lobby':       return <LobbyScreen {...props} />;
      case 'quiz':        return <QuizScreen {...props} quizData={quizData} quizReveal={quizReveal} />;
      case 'guess':       return <GuessPlayerScreen {...props} guessData={guessData} />;
      case 'penalty':     return <PenaltyScreen {...props} penaltyData={penaltyData} penaltyResult={penaltyResult} />;
      case 'leaderboard': return <LeaderboardScreen {...props} roundEnd={roundEnd} />;
      case 'winner':      return <WinnerScreen {...props} winner={winner} />;
      default:            return <JoinScreen socket={socket} />;
    }
  };

  return (
    <>
      <ConnectionBanner status={connStatus} />
      {screenEl()}
    </>
  );
}
