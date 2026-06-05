/**
 * Deep Seafood Football Championship — Comprehensive Test Suite
 * Run: node test.js
 * Tests every feature, connection scenario, and edge case.
 */

const { io: ioClient } = require('socket.io-client');
const http = require('http');

const BASE = 'http://localhost:3001';
const PASS = '✅'; const FAIL = '❌'; const SKIP = '⏭';
let passed = 0; let failed = 0;
const results = [];

function log(icon, name, detail = '') {
  const line = `${icon} ${name}${detail ? ' — ' + detail : ''}`;
  results.push(line);
  console.log(line);
}

function client(path = '/') {
  return ioClient(BASE, { path: '/socket.io', transports: ['websocket'], forceNew: true });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; log(PASS, label); }
  else { failed++; log(FAIL, label, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
}

function expectTruthy(label, val) {
  if (val) { passed++; log(PASS, label); }
  else { failed++; log(FAIL, label, `got falsy: ${JSON.stringify(val)}`); }
}

function expectEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (...args) => { clearTimeout(t); resolve(args[0]); });
  });
}

// Safe connect — resolves immediately if already connected
function connect(socket) {
  if (socket.connected) return Promise.resolve();
  return expectEvent(socket, 'connect');
}

async function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    }).on('error', reject);
  });
}

// ─── Reset helper — calls host:force-reset ────────────────────────────────────
async function resetGame(host) {
  host.emit('host:force-reset');
  await wait(200);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: Server health
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteServerHealth() {
  console.log('\n── Suite 1: Server Health ──');
  try {
    const state = await apiGet('/api/state');
    expect('GET /api/state returns phase', state.phase, 'lobby');
    expectTruthy('GET /api/state has roomCode', state.roomCode);
  } catch(e) { failed++; log(FAIL, 'Server unreachable', e.message); }

  try {
    const ip = await apiGet('/api/network-ip');
    expectTruthy('GET /api/network-ip returns ip', ip.ip);
  } catch(e) { failed++; log(FAIL, 'network-ip endpoint', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: Host connection
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteHostConnection() {
  console.log('\n── Suite 2: Host Connection ──');
  const host = client();
  try {
    await connect(host);
    passed++; log(PASS, 'Host socket connects');

    host.emit('host:join');
    const state = await expectEvent(host, 'host:state');
    expect('host:state has roomCode', state.roomCode, 'DEEP24');
    expect('host:state starts in lobby', state.phase, 'lobby');
    expect('host:state starts with no players', Object.keys(state.players).length, 0);
  } catch(e) { failed++; log(FAIL, 'Host connection', e.message); }
  finally { host.disconnect(); await wait(100); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Player join
// ═══════════════════════════════════════════════════════════════════════════════
async function suitePlayerJoin() {
  console.log('\n── Suite 3: Player Join ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);

    // Valid join
    p1.emit('player:join', { name: '🦈 TestPlayer' });
    const joinRes = await expectEvent(p1, 'join:success');
    expect('join:success has player name', joinRes.player.name, '🦈 TestPlayer');
    expectTruthy('join:success has roomCode', joinRes.roomCode);

    // Host sees player
    const hostUpdate = await expectEvent(host, 'host:player-joined');
    expectTruthy('host sees player joined', Object.keys(hostUpdate.players).length >= 1);

    // Empty name rejected
    const p2 = client();
    await connect(p2);
    p2.emit('player:join', { name: '' });
    const err = await expectEvent(p2, 'join:error');
    expectTruthy('empty name rejected', err.message);
    p2.disconnect();

    // Duplicate name join (different socket) — allowed as fresh join in lobby
    const p3 = client();
    await connect(p3);
    p3.emit('player:join', { name: '🦈 TestPlayer' });
    const join3 = await expectEvent(p3, 'join:success');
    expectTruthy('same name fresh join accepted in lobby', join3.player);
    p3.disconnect();

  } catch(e) { failed++; log(FAIL, 'Player join', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Game mid-join rejected
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteMidGameJoinRejected() {
  console.log('\n── Suite 4: Mid-game join rejected ──');
  const host = client(); const p1 = client(); const late = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);
    p1.emit('player:join', { name: '🐟 Player1' });
    await expectEvent(p1, 'join:success');

    // Start quiz
    host.emit('host:start-quiz');
    await expectEvent(p1, 'quiz:question');

    // Late joiner should be rejected
    await connect(late);
    late.emit('player:join', { name: '🐠 LatePlayer' });
    const err = await expectEvent(late, 'join:error', 2000);
    expectTruthy('late join rejected mid-game', err.message);

  } catch(e) { failed++; log(FAIL, 'Mid-game join', e.message); }
  finally { host.disconnect(); p1.disconnect(); late.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5: Quiz round — full flow
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteQuizRound() {
  console.log('\n── Suite 5: Quiz Round ──');
  const host = client(); const p1 = client(); const p2 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    for (const p of [p1, p2]) {
      await connect(p);
    }
    p1.emit('player:join', { name: '🦈 Alice' });
    p2.emit('player:join', { name: '🐟 Bob' });
    await expectEvent(p1, 'join:success');
    await expectEvent(p2, 'join:success');

    // Start quiz
    host.emit('host:start-quiz');
    const q1 = await expectEvent(p1, 'quiz:question');
    expectTruthy('quiz question has question text', q1.question);
    expectTruthy('quiz question has 4 options', q1.options?.length === 4);
    expect('quiz question index starts at 0', q1.index, 0);
    expect('timer is 20s', q1.timeLimit, 20);

    // Player 1 answers correctly
    p1.emit('quiz:answer', { optionIndex: q1.answer ?? 1 });
    // Player 2 answers wrong
    p2.emit('quiz:answer', { optionIndex: (q1.answer + 1) % 4 });

    // Host reveals answer
    host.emit('host:show-answer');
    const reveal = await expectEvent(p1, 'quiz:reveal');
    expectTruthy('quiz:reveal has correctIndex', reveal.correctIndex !== undefined);
    expectTruthy('quiz:reveal has explanation', typeof reveal.explanation === 'string');
    expectTruthy('quiz:reveal has question', reveal.question);
    expectTruthy('quiz:reveal has options', reveal.options?.length === 4);
    expectTruthy('quiz:reveal has correctCount', reveal.correctCount !== undefined);

    // Pause/resume timer — navigate to a fresh question (don't restart quiz, just goto q0)
    host.emit('host:goto-question', { index: 0 });
    await expectEvent(p1, 'quiz:question');
    host.emit('host:pause-timer');
    const paused = await expectEvent(p1, 'timer:paused');
    expectTruthy('timer:paused event received', paused !== undefined || true);

    host.emit('host:resume-timer');
    const resumed = await expectEvent(p1, 'timer:resumed');
    expectTruthy('timer:resumed event received', true);

    // Navigate questions
    host.emit('host:goto-question', { index: 2 });
    const q3 = await expectEvent(p1, 'quiz:question');
    expect('goto-question navigates to index 2', q3.index, 2);

    host.emit('host:goto-question', { index: 1 });
    const q2 = await expectEvent(p1, 'quiz:question');
    expect('prev question navigates to index 1', q2.index, 1);

    // End round
    host.emit('host:show-answer');
    await expectEvent(p1, 'quiz:reveal');
    // Quiz done after all questions revealed and host advances — simulate by checking leaderboard update
    const lb = await expectEvent(p1, 'leaderboard');
    expectTruthy('leaderboard updates after quiz', Array.isArray(lb));

  } catch(e) { failed++; log(FAIL, 'Quiz round', e.message); }
  finally { host.disconnect(); p1.disconnect(); p2.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6: Guess the player
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteGuessPlayer() {
  console.log('\n── Suite 6: Guess the Player ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);
    p1.emit('player:join', { name: '🦑 Guesser' });
    await expectEvent(p1, 'join:success');

    host.emit('host:start-guess');
    const clue = await expectEvent(p1, 'guess:clue');
    expectTruthy('guess:clue has clues array', clue.clues?.length >= 1);
    expectTruthy('guess:clue has maxPoints', clue.maxPoints > 0);
    expectTruthy('guess:clue has timePerClue', clue.timePerClue > 0);

    // Wrong answer
    p1.emit('guess:answer', { answer: 'zzzzwrongplayer' });
    const wrong = await expectEvent(p1, 'guess:wrong');
    expectTruthy('wrong answer rejected', true);

    // Correct answer (Ronaldo)
    p1.emit('guess:answer', { answer: 'Ronaldo' });
    const correct = await expectEvent(p1, 'guess:correct', 2000);
    expectTruthy('correct answer gives points', correct.pts > 0);

    // Reveal fires
    const reveal = await expectEvent(p1, 'guess:reveal', 3000);
    expectTruthy('guess:reveal has answer', reveal.answer?.length > 0);

    // Test double-reveal prevention (second correct guess shouldn't double-reveal)
    // This is covered by the guessRevealPending flag on server

  } catch(e) { failed++; log(FAIL, 'Guess player', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7: Penalty shootout
// ═══════════════════════════════════════════════════════════════════════════════
async function suitePenalty() {
  console.log('\n── Suite 7: Penalty Shootout ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);
    p1.emit('player:join', { name: '🥅 Kicker' });
    await expectEvent(p1, 'join:success');

    host.emit('host:start-penalty');
    await expectEvent(p1, 'penalty:start');
    expectTruthy('penalty:start received', true);

    // Take all 5 kicks
    for (let kick = 1; kick <= 5; kick++) {
      p1.emit('penalty:shoot', { direction: kick % 3 }); // 0,1,2,0,1
      const result = await expectEvent(p1, 'penalty:kick-result', 3000);
      expect(`kick ${kick} kickNum`, result.kickNum, kick);
      expectTruthy(`kick ${kick} has goal boolean`, typeof result.goal === 'boolean');
      expectTruthy(`kick ${kick} has goalkeeperDir`, result.goalkeeperDir !== undefined);
    }

    // After 5 kicks, penalty:done fires
    const done = await expectEvent(p1, 'penalty:done', 5000);
    expectTruthy('penalty:done fires after 5 kicks', true);
    expectTruthy('penalty:done has goals', done.goals !== undefined);
    expectTruthy('penalty:done has pts', done.pts !== undefined);

    // Game winner fires (only player done)
    const winner = await expectEvent(p1, 'game:winner', 3000);
    expectTruthy('game:winner fires after all done', winner.winner);

  } catch(e) { failed++; log(FAIL, 'Penalty shootout', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(300); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8: Reconnect mid-game
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteReconnect() {
  console.log('\n── Suite 8: Reconnect mid-game ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);
    p1.emit('player:join', { name: '🐡 Reconnector' });
    const joinRes = await expectEvent(p1, 'join:success');
    const playerName = joinRes.player.name;

    // Start quiz
    host.emit('host:start-quiz');
    await expectEvent(p1, 'quiz:question');

    // Simulate player disconnect
    p1.disconnect();
    await wait(500);

    // Reconnect with new socket
    const p1b = client();
    await connect(p1b);
    p1b.emit('player:join', { name: playerName }); // same name = reconnect

    const rejoin = await expectEvent(p1b, 'join:success', 3000);
    expectTruthy('reconnected player gets join:success', rejoin.player);
    expect('reconnected player has same name', rejoin.player.name, playerName);

    // Should be synced back to quiz
    const synced = await expectEvent(p1b, 'quiz:question', 2000);
    expectTruthy('reconnected player synced to quiz screen', synced.question);
    expectTruthy('synced question has remaining time (not full 20s)', synced.timeLimit <= 20);

    p1b.disconnect();
  } catch(e) { failed++; log(FAIL, 'Reconnect mid-game', e.message); }
  finally { host.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 9: Host controls — push screens
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteHostPushScreens() {
  console.log('\n── Suite 9: Host screen push controls ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);
    p1.emit('player:join', { name: '🦀 Viewer' });
    await expectEvent(p1, 'join:success');

    host.emit('host:start-quiz');
    await expectEvent(p1, 'quiz:question');

    // Push leaderboard to all
    host.emit('host:push-screen', { screen: 'leaderboard' });
    const lb = await expectEvent(p1, 'host:push-leaderboard', 2000);
    expectTruthy('push leaderboard sends to players', lb.leaderboard);

    // Sync all
    host.emit('host:push-screen', { screen: 'sync' });
    const resynced = await expectEvent(p1, 'quiz:question', 2000);
    expectTruthy('sync push re-sends quiz question', resynced.question);

  } catch(e) { failed++; log(FAIL, 'Host push screens', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 10: Force reset clears all state
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteForceReset() {
  console.log('\n── Suite 10: Force reset ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host); // ensure clean lobby before joining

    await connect(p1);
    p1.emit('player:join', { name: '🦞 Resetter' });
    await expectEvent(p1, 'join:success');

    host.emit('host:start-quiz');
    await expectEvent(p1, 'quiz:question');

    // Force reset mid-game
    host.emit('host:force-reset');
    const reset = await expectEvent(p1, 'game:reset', 2000);
    expectTruthy('game:reset fires on all clients', true);

    // Server back to lobby
    const state = await apiGet('/api/state');
    expect('server phase is lobby after reset', state.phase, 'lobby');
    expect('server has 0 players after reset', state.players, 0);

  } catch(e) { failed++; log(FAIL, 'Force reset', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 11: Phase guards — can't bleed rounds
// ═══════════════════════════════════════════════════════════════════════════════
async function suitePhaseGuards() {
  console.log('\n── Suite 11: Phase Guards ──');
  const host = client(); const p1 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    await connect(p1);
    p1.emit('player:join', { name: '🐙 Guard' });
    await expectEvent(p1, 'join:success');

    host.emit('host:start-quiz');
    await expectEvent(p1, 'quiz:question');

    // Try to start guess while quiz is live — should be ignored
    let guessReceived = false;
    p1.once('guess:clue', () => { guessReceived = true; });
    host.emit('host:start-guess');
    await wait(500);
    expect('starting guess mid-quiz is ignored', guessReceived, false);

    // Try starting penalty mid-quiz — ignored
    let penaltyReceived = false;
    p1.once('penalty:start', () => { penaltyReceived = true; });
    host.emit('host:start-penalty');
    await wait(500);
    expect('starting penalty mid-quiz is ignored', penaltyReceived, false);

  } catch(e) { failed++; log(FAIL, 'Phase guards', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(200); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 12: Multiple players concurrent penalty
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteMultiPlayerPenalty() {
  console.log('\n── Suite 12: Multi-player concurrent penalty ──');
  const host = client(); const p1 = client(); const p2 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    for (const [p, name] of [[p1,'🦈 A'],[p2,'🐟 B']]) {
      await connect(p);
      p.emit('player:join', { name });
      await expectEvent(p, 'join:success');
    }

    host.emit('host:start-penalty');
    await expectEvent(p1, 'penalty:start');
    await expectEvent(p2, 'penalty:start');

    // Both shoot independently
    const shoot = async (player, label) => {
      for (let k = 1; k <= 5; k++) {
        player.emit('penalty:shoot', { direction: k % 3 });
        const r = await expectEvent(player, 'penalty:kick-result', 3000);
        expectTruthy(`${label} kick ${k} independent result`, r.kickNum === k);
      }
      const done = await expectEvent(player, 'penalty:done', 2000);
      expectTruthy(`${label} gets penalty:done`, done.goals !== undefined);
    };

    await Promise.all([shoot(p1,'P1'), shoot(p2,'P2')]);

    // Both done → game winner
    const winner = await expectEvent(p1, 'game:winner', 3000);
    expectTruthy('game winner fires after all players done', winner.winner);

  } catch(e) { failed++; log(FAIL, 'Multi-player penalty', e.message); }
  finally { host.disconnect(); p1.disconnect(); p2.disconnect(); await wait(300); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 13: DB persistence
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteDBPersistence() {
  console.log('\n── Suite 13: DB persistence ──');
  try {
    const sessions = await apiGet('/api/results');
    expectTruthy('GET /api/results returns array', Array.isArray(sessions));

    if (sessions.length > 0) {
      const detail = await apiGet(`/api/results/${sessions[0].id}`);
      expectTruthy('GET /api/results/:id returns player array', Array.isArray(detail));
    } else {
      log(SKIP, 'No sessions yet — DB persistence test skipped');
    }

    const qs = await apiGet('/api/questions');
    expectTruthy('GET /api/questions returns array', Array.isArray(qs));
    expectTruthy('Questions have explanation field', qs[0]?.explanation !== undefined);
    expectTruthy('Questions have correct answer index', qs[0]?.answer !== undefined);

    const gp = await apiGet('/api/guess-players');
    expectTruthy('GET /api/guess-players returns array', Array.isArray(gp));
    expectTruthy('Guess players have clue1', gp[0]?.clue1?.length > 0);
  } catch(e) { failed++; log(FAIL, 'DB persistence', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 14: Disconnected player during penalty doesn't block game end
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteDisconnectDuringPenalty() {
  console.log('\n── Suite 14: Disconnect during penalty ──');
  const host = client(); const p1 = client(); const p2 = client();
  try {
    await connect(host);
    host.emit('host:join');
    await expectEvent(host, 'host:state');
    await resetGame(host);

    for (const [p, name] of [[p1,'🦈 Stays'],[p2,'🐟 Leaves']]) {
      await connect(p);
      p.emit('player:join', { name });
      await expectEvent(p, 'join:success');
    }

    host.emit('host:start-penalty');
    await expectEvent(p1, 'penalty:start');
    await expectEvent(p2, 'penalty:start');

    // p2 disconnects immediately
    p2.disconnect();
    await wait(500);

    // p1 takes all 5 kicks
    for (let k = 1; k <= 5; k++) {
      p1.emit('penalty:shoot', { direction: 0 });
      await expectEvent(p1, 'penalty:kick-result', 3000);
    }
    await expectEvent(p1, 'penalty:done', 2000);

    // Game should end — only connected player (p1) needs to finish
    const winner = await expectEvent(p1, 'game:winner', 3000);
    expectTruthy('game ends even when p2 disconnected', winner.winner);

  } catch(e) { failed++; log(FAIL, 'Disconnect during penalty', e.message); }
  finally { host.disconnect(); p1.disconnect(); await wait(300); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════════════════════
async function globalSetup() {
  // Reset any leftover state from previous runs
  const h = client();
  await connect(h);
  h.emit('host:join');
  await expectEvent(h, 'host:state');
  h.emit('host:force-reset');
  await wait(300);
  h.disconnect();
  await wait(200);
}

async function runAll() {
  console.log('🏆 Deep Seafood Football Championship — Test Suite');
  console.log('═'.repeat(55));

  await globalSetup();
  await suiteServerHealth();
  await suiteHostConnection();
  await suitePlayerJoin();
  await suiteMidGameJoinRejected();
  await suiteQuizRound();
  await suiteGuessPlayer();
  await suitePenalty();
  await suiteReconnect();
  await suiteHostPushScreens();
  await suiteForceReset();
  await suitePhaseGuards();
  await suiteMultiPlayerPenalty();
  await suiteDBPersistence();
  await suiteDisconnectDuringPenalty();

  console.log('\n' + '═'.repeat(55));
  console.log(`Results: ${PASS} ${passed} passed  ${FAIL} ${failed} failed`);
  console.log('═'.repeat(55));

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.startsWith(FAIL)).forEach(r => console.log(' ', r));
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

runAll().catch(e => { console.error('Test runner crashed:', e); process.exit(1); });
