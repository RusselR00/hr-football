import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import QuizScreen from './screens/QuizScreen';
import GuessPlayerScreen from './screens/GuessPlayerScreen';
import PredictScreen from './screens/PredictScreen';
import PenaltyScreen from './screens/PenaltyScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import WinnerScreen from './screens/WinnerScreen';
import HostApp from './host/HostApp';

const isHost = window.location.pathname === '/host';

export default function App() {
  const [screen, setScreen]         = useState(isHost ? 'host' : 'join');
  const [player, setPlayer]         = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quizData, setQuizData]     = useState(null);
  const [quizReveal, setQuizReveal] = useState(null);
  const [guessData, setGuessData]   = useState(null);
  const [predictData, setPredictData] = useState(null);
  const [penaltyData, setPenaltyData] = useState(null);
  const [penaltyResult, setPenaltyResult] = useState(null);
  const [winner, setWinner]         = useState(null);
  const [roundEnd, setRoundEnd]     = useState(null);

  useEffect(() => {
    if (isHost) return;
    socket.connect();

    socket.on('join:success', ({ player: p }) => { setPlayer(p); setScreen('lobby'); });
    socket.on('leaderboard',  lb => setLeaderboard(lb));

    socket.on('quiz:question', data => { setQuizReveal(null); setQuizData(data); setScreen('quiz'); });
    socket.on('quiz:reveal',   data => setQuizReveal(data));

    socket.on('guess:clue',   data => { setGuessData(data); setScreen('guess'); });
    socket.on('guess:reveal', data => setGuessData(prev => ({ ...prev, revealed: data.answer })));

    socket.on('predict:match',  data => { setPredictData(data); setScreen('predict'); });
    socket.on('predict:reveal', data => setPredictData(prev => ({ ...prev, reveal: data })));

    socket.on('penalty:kick',   data => { setPenaltyResult(null); setPenaltyData(data); setScreen('penalty'); });
    socket.on('penalty:result', data => setPenaltyResult(data));

    socket.on('round:end', data => { setRoundEnd(data); setScreen('leaderboard'); });
    socket.on('game:winner', data => { setWinner(data); setScreen('winner'); });
    socket.on('game:reset',  ()   => { setScreen('join'); setPlayer(null); });

    return () => socket.disconnect();
  }, []);

  if (isHost) return <HostApp />;

  const props = { player, leaderboard, socket };

  switch (screen) {
    case 'join':        return <JoinScreen socket={socket} />;
    case 'lobby':       return <LobbyScreen {...props} />;
    case 'quiz':        return <QuizScreen {...props} quizData={quizData} quizReveal={quizReveal} />;
    case 'guess':       return <GuessPlayerScreen {...props} guessData={guessData} />;
    case 'predict':     return <PredictScreen {...props} predictData={predictData} />;
    case 'penalty':     return <PenaltyScreen {...props} penaltyData={penaltyData} penaltyResult={penaltyResult} />;
    case 'leaderboard': return <LeaderboardScreen {...props} roundEnd={roundEnd} />;
    case 'winner':      return <WinnerScreen {...props} winner={winner} />;
    default:            return <JoinScreen socket={socket} />;
  }
}
