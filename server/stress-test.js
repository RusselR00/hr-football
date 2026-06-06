/**
 * HR Football — 60-player stress test
 *
 * Usage (local):      node stress-test.js
 * Usage (production): node stress-test.js https://ip-172-26-4-83.taild77fe0.ts.net
 *
 * What it does:
 *   1. Connects 60 bot players simultaneously
 *   2. All join the lobby (measures join latency)
 *   3. Host starts quiz — all bots answer every question
 *   4. Host starts penalty — all bots take all 10 kicks concurrently
 *   5. Prints a pass/fail report with latency stats
 */

const { io: ioClient } = require('socket.io-client');

const BASE       = process.argv[2] || 'http://localhost:3001';
const PLAYERS    = 60;
const QUIZ_WAIT  = 25_000;   // ms to wait for each quiz question reveal
const TIMEOUT    = 10_000;   // ms for individual socket events

console.log(`\n🏟  HR Football Stress Test — ${PLAYERS} players → ${BASE}\n`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const results  = { ok: 0, fail: 0, errors: [] };
const timings  = {};

function mark(label) { timings[label] = Date.now(); }
function elapsed(from) { return `${Date.now() - (timings[from] || Date.now())}ms`; }

function pass(msg) { results.ok++;   console.log(`  ✅ ${msg}`); }
function fail(msg) { results.fail++; results.errors.push(msg); console.log(`  ❌ ${msg}`); }

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function on(socket, event, ms = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout (${ms}ms) waiting for "${event}"`)), ms);
    socket.once(event, data => { clearTimeout(t); resolve(data); });
  });
}

function makeClient() {
  return ioClient(BASE, {
    path: '/socket.io',
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    timeout: 8000,
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function stats(label, values) {
  if (!values.length) return;
  const sorted = [...values].sort((a, b) => a - b);
  const avg    = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  const p95    = sorted[Math.floor(sorted.length * 0.95)];
  const max    = sorted[sorted.length - 1];
  console.log(`  📊 ${label}: avg ${avg}ms · p95 ${p95}ms · max ${max}ms`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  // ── 1. Host connects and resets ─────────────────────────────────────────────
  console.log('[ 1 ] Connecting host...');
  const host = makeClient();
  await new Promise((res, rej) => {
    host.on('connect', res);
    host.on('connect_error', e => rej(new Error(`Host connect failed: ${e.message}`)));
    setTimeout(() => rej(new Error('Host connect timeout')), TIMEOUT);
  });
  host.emit('host:join');
  await on(host, 'host:state');
  host.emit('host:force-reset');
  await wait(300);
  pass('Host connected and game reset');

  // ── 2. Spawn 60 players simultaneously ──────────────────────────────────────
  console.log(`\n[ 2 ] Connecting ${PLAYERS} players simultaneously...`);
  mark('connect-start');

  const bots      = [];
  const connectMs = [];
  let   connected = 0;
  let   connFail  = 0;

  await Promise.all(
    Array.from({ length: PLAYERS }, (_, i) =>
      new Promise(resolve => {
        const bot   = makeClient();
        const start = Date.now();
        bot.on('connect', () => {
          connectMs.push(Date.now() - start);
          connected++;
          bots.push(bot);
          resolve();
        });
        bot.on('connect_error', () => { connFail++; resolve(); });
        setTimeout(resolve, TIMEOUT); // don't block others
      })
    )
  );

  stats('connect', connectMs);
  if (connected === PLAYERS) {
    pass(`All ${PLAYERS} players connected (${elapsed('connect-start')})`);
  } else {
    fail(`Only ${connected}/${PLAYERS} connected (${connFail} failed)`);
  }

  // ── 3. All players join the lobby ────────────────────────────────────────────
  console.log('\n[ 3 ] All players joining lobby...');
  mark('join-start');

  const joinMs    = [];
  let   joined    = 0;
  let   joinFail  = 0;

  await Promise.all(
    bots.map((bot, i) =>
      new Promise(resolve => {
        const start = Date.now();
        const name  = `Bot${String(i + 1).padStart(2, '0')} Player`;
        bot.once('join:success', () => {
          joinMs.push(Date.now() - start);
          joined++;
          resolve();
        });
        bot.once('join:error', err => {
          joinFail++;
          fail(`Bot${i + 1} join error: ${err?.message}`);
          resolve();
        });
        setTimeout(() => { joinFail++; resolve(); }, TIMEOUT);
        bot.emit('player:join', { name });
      })
    )
  );

  stats('join', joinMs);
  if (joined === bots.length) {
    pass(`All ${joined} bots joined lobby (${elapsed('join-start')})`);
  } else {
    fail(`Only ${joined}/${bots.length} joined (${joinFail} failed)`);
  }

  // ── 4. Quiz round — all bots answer every question ──────────────────────────
  console.log('\n[ 4 ] Starting quiz round...');
  mark('quiz-start');

  host.emit('host:start-quiz');

  // Run through all quiz questions (host reveals each one)
  let questionsDone   = 0;
  let answeredTotal   = 0;
  const answerMs      = [];

  // Hook all bots to answer every quiz:question they receive
  const answerPromises = bots.map(bot => new Promise(resolve => {
    let answeredThisBot = 0;
    const onQuestion = (q) => {
      const start = Date.now();
      // Answer with a random option
      const pick = Math.floor(Math.random() * 4);
      bot.emit('quiz:answer', { optionIndex: pick });
      bot.once('quiz:answered', () => {
        answerMs.push(Date.now() - start);
        answeredThisBot++;
      });
    };
    bot.on('quiz:question', onQuestion);
    bot.once('round:end', () => {
      bot.off('quiz:question', onQuestion);
      answeredTotal += answeredThisBot;
      resolve();
    });
  }));

  // Host drives questions: reveal answer then move to next
  const driveQuiz = async () => {
    let hostQuizState = { index: 0, total: 0 };
    host.on('host:quiz-state', s => { hostQuizState = s; });

    await on(host, 'host:quiz-state', QUIZ_WAIT); // first question

    while (true) {
      await wait(400); // let bots answer
      host.emit('host:show-answer');
      await on(host, 'host:quiz-state', QUIZ_WAIT);
      questionsDone++;

      if (hostQuizState.index >= hostQuizState.total - 1) {
        await wait(200);
        host.emit('host:end-round');
        break;
      }
      host.emit('host:goto-question', { index: hostQuizState.index + 1 });
      await on(host, 'host:quiz-state', QUIZ_WAIT);
    }
    host.off('host:quiz-state');
  };

  await Promise.race([
    Promise.all([...answerPromises, driveQuiz()]),
    wait(QUIZ_WAIT * 25).then(() => { fail('Quiz timed out'); }),
  ]);

  stats('quiz answer RTT', answerMs);
  pass(`Quiz complete — ${questionsDone} questions, ${answeredTotal} answers received`);

  // ── 5. Penalty — all bots kick 10 times concurrently ────────────────────────
  console.log('\n[ 5 ] Starting penalty round...');
  mark('penalty-start');

  await wait(300);

  const kickMs        = [];
  let   kicksDone     = 0;
  let   goalCount     = 0;
  let   penaltyFailed = 0;
  const TOTAL_KICKS   = 10;

  // IMPORTANT: register all bot listeners BEFORE the host starts the round
  // Realistic pacing: bots wait 300-800ms between kicks (like real players watching the animation)
  const penaltyPromises = bots.map((bot, i) =>
    new Promise(resolve => {
      bot.once('penalty:start', async () => {
        try {
          // Stagger start slightly so not all 60 kick at the exact same millisecond
          await wait(Math.random() * 500);

          // Set up penalty:done listener BEFORE starting kicks so it can't be missed
          const donePromise = on(bot, 'penalty:done', 60000);

          for (let k = 0; k < TOTAL_KICKS; k++) {
            const start = Date.now();
            const dir   = Math.floor(Math.random() * 5);
            bot.emit('penalty:shoot', { direction: dir });
            const result = await on(bot, 'penalty:kick-result', 10000);
            kickMs.push(Date.now() - start);
            if (result.goal) goalCount++;
            kicksDone++;
            // Simulate player watching the animation — but NOT after the last kick
            if (k < TOTAL_KICKS - 1) await wait(300 + Math.random() * 300);
          }

          await donePromise;
        } catch (e) {
          penaltyFailed++;
          fail(`Bot${i + 1} penalty error: ${e.message}`);
        }
        resolve();
      });
      // Fallback if penalty:start is missed
      setTimeout(() => { penaltyFailed++; fail(`Bot${i + 1} never got penalty:start`); resolve(); }, 120000);
    })
  );

  // Register game:winner listener before starting the round so it can't be missed
  const winnerPromise = on(bots[0], 'game:winner', 120000).catch(() => null);

  // NOW start the round — all listeners are already registered
  host.emit('host:start-penalty');

  await Promise.all(penaltyPromises);

  stats('kick RTT', kickMs);
  const goalPct = kicksDone ? Math.round((goalCount / kicksDone) * 100) : 0;
  if (penaltyFailed === 0) {
    pass(`All ${bots.length} bots completed penalty — ${kicksDone} kicks, ${goalCount} goals (${goalPct}%)`);
  } else {
    fail(`${penaltyFailed} bots failed penalty`);
  }

  // ── 6. Game winner fires ─────────────────────────────────────────────────────
  console.log('\n[ 6 ] Waiting for game:winner...');
  const winner = await winnerPromise;
  if (winner?.winner) {
    pass(`Game ended cleanly — winner: ${winner.winner.name} (${winner.winner.score} pts)`);
  } else {
    fail('game:winner did not fire');
  }

  // ── 7. Memory / process check ────────────────────────────────────────────────
  console.log('\n[ 7 ] Checking server state post-game...');
  await new Promise((resolve, reject) => {
    const http = require('http');
    const url  = new URL('/api/state', BASE);
    http.get({ hostname: url.hostname, port: url.port || 80, path: url.pathname }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const state = JSON.parse(d);
          if (state.phase === 'winner') pass('Server in winner phase — clean state');
          else fail(`Unexpected phase: ${state.phase}`);
        } catch { fail('Could not parse /api/state'); }
        resolve();
      });
    }).on('error', e => { fail(`/api/state unreachable: ${e.message}`); resolve(); });
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  bots.forEach(b => b.disconnect());
  host.disconnect();
  await wait(200);

  // ── Report ───────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log(`  Total time : ${elapsed('connect-start')}`);
  console.log(`  ✅ Passed  : ${results.ok}`);
  console.log(`  ❌ Failed  : ${results.fail}`);
  if (results.errors.length) {
    console.log('\n  Failures:');
    results.errors.forEach(e => console.log(`    • ${e}`));
  }
  console.log('═'.repeat(55));

  if (results.fail === 0) {
    console.log('\n🎉 60-player stress test PASSED — server is solid!\n');
    process.exit(0);
  } else {
    console.log('\n💥 Stress test FAILED\n');
    process.exit(1);
  }
}

run().catch(e => {
  console.error('\n💥 Stress test crashed:', e.message);
  process.exit(1);
});
