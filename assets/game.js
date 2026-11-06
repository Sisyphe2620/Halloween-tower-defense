    /* The whole engine boots in the background: it is wrapped in
       __tdBoot and scheduled only after the browser has had its
       chance to paint the splash cover, so the player sees (and can
       tap) the start page first while the game sets itself up
       behind it. */
    window.__tdBoot = function () {
    "use strict";
    /* a retried engine fetch can leave two copies of this script racing:
       the loser must not boot a second engine (double rAF loop would
       run the whole game at 2x speed and double-wire every button) */
    if (window.__tdBooted) return;
    window.__tdBooted = true;
    /* ============================================================
       万圣节塔防 · 敲门大作战 — canvas simulation
       ============================================================ */
    var W = 450, H = 740;
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    // overlay canvas floating above the CASTLE SAVED group photo,
    // home of the victory candy fireworks (see renderWinFx)
    var fxCanvas = document.getElementById('winFx');
    var fxCtx = fxCanvas ? fxCanvas.getContext('2d') : null;

    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    /* ---------------- audio (WebAudio, all synthesized) ---------------- */
    var AC = null, masterGain = null, soundOn = true;
    function ensureAudio() {
      // resume from ANY parked state: 'suspended' on Android, but
      // iOS parks a locked-screen context as 'interrupted' — the
      // old 'suspended'-only check walked straight past that one
      // and left even a genuine tap unable to wake the sound
      if (AC) { if (AC.state !== 'running') { try { AC.resume(); } catch (e) {} } decodeDefSong(); return; }
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        // if the system hands the context back on its own schedule
        // after a screen-off, finish the recovery the moment it
        // runs again (finishRecovery is declared further down;
        // hoisted within this scope)
        AC.onstatechange = function () {
          if (AC && AC.state === 'running' && audioRecoveryPending) finishRecovery();
        };
        masterGain = AC.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(AC.destination);
        // the victory song decodes into this context (function
        // declared further down; hoisted within this scope)
        decodeDefSong();
      } catch (e) { AC = null; }
    }
    function knockSound(strength) {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      var vol = Math.min(0.55, 0.22 + strength * 0.05);
      // wooden thock: short filtered noise + low sine thump
      var dur = 0.09;
      var buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var src = AC.createBufferSource(); src.buffer = buf;
      var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 300; bp.Q.value = 1.1;
      var g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(masterGain); src.start(t);
      var o = AC.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.09);
      var g2 = AC.createGain(); g2.gain.setValueAtTime(vol * 0.9, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g2); g2.connect(masterGain); o.start(t); o.stop(t + 0.11);
    }
    function popSound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      var o = AC.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(520 + Math.random() * 160, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
      var g = AC.createGain(); g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.1);
    }
    function happySound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      [660, 880].forEach(function (f, i) {
        var o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        var g = AC.createGain();
        g.gain.setValueAtTime(0.0001, t + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.07 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.16);
        o.connect(g); g.connect(masterGain); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.18);
      });
    }
    function levelUpSound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      // bright rising arpeggio: the "a tower earned a level" chime,
      // also the sting when the player confirms the upgrade
      [659, 784, 988, 1319].forEach(function (f, i) {
        var o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        var g = AC.createGain();
        var st = t + i * 0.07;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.13, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.24);
        o.connect(g); g.connect(masterGain); o.start(st); o.stop(st + 0.26);
      });
    }
    function boomSound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      var dur = 0.9;
      var buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
      var src = AC.createBufferSource(); src.buffer = buf;
      var lp = AC.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(60, t + dur);
      var g = AC.createGain(); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(lp); lp.connect(g); g.connect(masterGain); src.start(t);
      var o = AC.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.7);
      var g2 = AC.createGain(); g2.gain.setValueAtTime(0.7, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      o.connect(g2); g2.connect(masterGain); o.start(t); o.stop(t + 0.8);
      // candy sparkle arpeggio
      [523, 659, 784, 1047, 1319].forEach(function (f, i) {
        var oo = AC.createOscillator(); oo.type = 'triangle'; oo.frequency.value = f;
        var gg = AC.createGain();
        var st = t + 0.25 + i * 0.09;
        gg.gain.setValueAtTime(0.0001, st);
        gg.gain.exponentialRampToValueAtTime(0.14, st + 0.02);
        gg.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
        oo.connect(gg); gg.connect(masterGain); oo.start(st); oo.stop(st + 0.32);
      });
    }

    function screamSound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      // spooky descending wail with a wobble
      var o = AC.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(190, t + 0.75);
      var lfo = AC.createOscillator(); lfo.frequency.value = 13;
      var lfoG = AC.createGain(); lfoG.gain.value = 55;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(g); g.connect(masterGain);
      o.start(t); o.stop(t + 0.85); lfo.start(t); lfo.stop(t + 0.85);
      var o2 = AC.createOscillator(); o2.type = 'triangle';
      o2.frequency.setValueAtTime(1170, t + 0.05);
      o2.frequency.exponentialRampToValueAtTime(260, t + 0.7);
      var g2 = AC.createGain();
      g2.gain.setValueAtTime(0.0001, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.1, t + 0.13);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
      o2.connect(g2); g2.connect(masterGain); o2.start(t + 0.05); o2.stop(t + 0.75);
    }
    function rainSound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      // candy sparkle shower
      [1319, 1568, 1047, 1760, 1319, 2093].forEach(function (f, i) {
        var o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        var g = AC.createGain();
        var st = t + i * 0.09;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.11, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.24);
        o.connect(g); g.connect(masterGain); o.start(st); o.stop(st + 0.26);
      });
    }

    /* ---------------- in-game background music: the ORIGINAL loop,
       restored untouched — a slow, quiet D-minor music box: a sparse
       spooky melody with long ringing notes, a soft bass underneath
       and a sustained chord pad, so it haunts the game without ever
       getting in the way. (The cheerful skeleton-dance further down
       belongs to the START PAGE only and stops the moment the game
       begins.) A lookahead scheduler walks 64 eighth-note steps
       (8 bars: Dm · Gm · Dm · A · Dm · Bb · A · Dm). ---- */
    var musicGain = null, musicTimer = null, musicStep = 0, musicNext = 0;
    var MUS_STEP = 0.32; // eighth-note length in seconds: slow music-box pace
    var MUS_LEAD = [
      74, 0, 77, 0, 81, 0, 77, 0,
      79, 0, 82, 0, 79, 0, 74, 0,
      77, 0, 74, 0, 69, 0, 74, 77,
      76, 0, 73, 0, 69, 0, 73, 0,
      81, 0, 77, 0, 86, 0, 81, 0,
      82, 0, 77, 0, 74, 0, 70, 0,
      76, 0, 81, 0, 76, 0, 73, 0,
      74, 0, 0, 0, 77, 0, 74, 0
    ];
    var MUS_BASS = [50, 55, 50, 45, 50, 46, 45, 50];   // bar roots: Dm · Gm · Dm · A · Dm · Bb · A · Dm
    var MUS_FIFTH = [57, 62, 57, 52, 57, 53, 52, 57];
    var MUS_CHORD = [
      [62, 65, 69], [62, 67, 70], [62, 65, 69], [61, 64, 69],
      [62, 65, 69], [62, 65, 70], [61, 64, 69], [62, 65, 69]
    ];
    function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function musNote(freq, t, dur, type, vol) {
      var o = AC.createOscillator(); o.type = type; o.frequency.value = freq;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function scheduleStep(s, t) {
      var bar = (s / 8) | 0, idx = s % 8;
      var lead = MUS_LEAD[s];
      // music-box lead: each note is struck once and left to ring out
      if (lead) musNote(mf(lead), t, 1.15, 'triangle', 0.115);
      if (idx === 0) {
        musNote(mf(MUS_BASS[bar]), t, 1.1, 'sine', 0.13);
        // the chord pad: soft tones sustained under the whole bar
        MUS_CHORD[bar].forEach(function (m) { musNote(mf(m), t, 2.5, 'sine', 0.02); });
      }
      if (idx === 4) musNote(mf(MUS_FIFTH[bar]), t, 0.9, 'sine', 0.09);
    }
    function scheduleMusic() {
      if (!AC) return;
      // if the context sat suspended (autoplay rules) the clock froze:
      // jump the playhead back to "now" instead of dumping a pile of
      // overdue notes the moment the sound is allowed through
      if (musicNext < AC.currentTime - 0.15) musicNext = AC.currentTime + 0.05;
      while (musicNext < AC.currentTime + 0.3) {
        scheduleStep(musicStep, musicNext);
        musicNext += MUS_STEP;
        musicStep = (musicStep + 1) % MUS_LEAD.length;
      }
    }
    function startMusic() {
      if (!AC || !soundOn || musicTimer) return;
      if (!musicGain) { musicGain = AC.createGain(); musicGain.gain.value = 1.0; musicGain.connect(masterGain); }
      musicStep = 0;
      musicNext = AC.currentTime + 0.08;
      musicTimer = setInterval(scheduleMusic, 90);
    }
    function stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    }

    /* ---------------- START-PAGE music: a cheerful Halloween
       skeleton-dance that scores ONLY the splash / start page —
       quick eighth notes, an octave-hopping xylophone-style lead, an
       oom-pah bass and bright chord stabs. It is a separate loop
       from the in-game music above: it starts on the player's first
       touch of the poster and is stopped the moment START drops
       into the game, where the original music-box loop takes over.
       Same 8-bar walk: Dm · Gm · Dm · A · Dm · Bb · A · Dm. ---- */
    var splGain = null, splTimer = null, splStep = 0, splNext = 0;
    var SPL_STEP = 0.19; // eighth-note length in seconds: brisk and merry
    var SPL_LEAD = [
      74, 77, 81, 86, 81, 77, 74, 77,
      79, 82, 86, 82, 79, 77, 74, 77,
      81, 77, 74, 77, 81, 84, 81, 77,
      76, 73, 69, 73, 76, 81, 76, 73,
      74, 77, 81, 86, 81, 77, 74, 77,
      82, 81, 77, 74, 70, 74, 77, 82,
      85, 81, 76, 73, 69, 73, 76, 81,
      86, 81, 77, 74, 77, 81, 74, 0
    ];
    function splNote(freq, t, dur, type, vol) {
      var o = AC.createOscillator(); o.type = type; o.frequency.value = freq;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(splGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function scheduleSplStep(s, t) {
      var bar = (s / 8) | 0, idx = s % 8;
      var lead = SPL_LEAD[s];
      if (lead) splNote(mf(lead), t, 0.3, 'triangle', 0.21);
      if (idx === 0) splNote(mf(MUS_BASS[bar]), t, 0.34, 'sine', 0.17);
      if (idx === 4) splNote(mf(MUS_FIFTH[bar]), t, 0.3, 'sine', 0.13);
      // oom-pah chord stabs on every other eighth keep the bounce going
      if (idx % 2 === 0) MUS_CHORD[bar].forEach(function (m) { splNote(mf(m), t, 0.22, 'triangle', 0.045); });
      // a tiny high sparkle answers the lead late in each bar
      if (idx === 6 && lead) splNote(mf(lead) * 2, t, 0.18, 'sine', 0.035);
    }
    function scheduleSplashMusic() {
      if (!AC) return;
      // same suspended-clock guard as the in-game scheduler
      if (splNext < AC.currentTime - 0.15) splNext = AC.currentTime + 0.05;
      while (splNext < AC.currentTime + 0.3) {
        scheduleSplStep(splStep, splNext);
        splNext += SPL_STEP;
        splStep = (splStep + 1) % SPL_LEAD.length;
      }
    }
    function startSplashMusic() {
      if (!AC || !soundOn || splTimer) return;
      if (!splGain) { splGain = AC.createGain(); splGain.gain.value = 1.0; splGain.connect(masterGain); }
      splStep = 0;
      splNext = AC.currentTime + 0.08;
      splTimer = setInterval(scheduleSplashMusic, 90);
    }
    function stopSplashMusic() {
      if (splTimer) { clearInterval(splTimer); splTimer = null; }
    }

    /* ---------------- victory music + kids' cheers ----------------
       When the kids win, the spooky D-minor loop stops and a brighter,
       bouncier C-major music-box tune takes over, while a crowd of
       little synthesized voices cheers "yay!" over the top. -------- */
    var winGain = null, winTimer = null, winStep = 0, winNext = 0;
    var WIN_STEP = 0.21; // faster eighths: a celebration, not a lullaby
    var WIN_LEAD = [
      72, 0, 76, 79, 84, 0, 79, 76,
      77, 0, 81, 84, 81, 0, 77, 81,
      79, 0, 83, 86, 83, 0, 79, 83,
      84, 0, 79, 76, 72, 0, 76, 0
    ];
    var WIN_BASS = [48, 53, 55, 48];        // bar roots: C · F · G · C
    var WIN_FIFTH = [55, 60, 62, 55];
    var WIN_CHORD = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]];
    function winNote(freq, t, dur, type, vol) {
      var o = AC.createOscillator(); o.type = type; o.frequency.value = freq;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(winGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function scheduleWinStep(s, t) {
      var bar = (s / 8) | 0, idx = s % 8;
      var lead = WIN_LEAD[s];
      if (lead) winNote(mf(lead), t, 0.34, 'triangle', 0.16);
      if (idx === 0) {
        winNote(mf(WIN_BASS[bar]), t, 0.45, 'sine', 0.17);
        WIN_CHORD[bar].forEach(function (m) { winNote(mf(m), t, 1.6, 'sine', 0.024); });
      }
      if (idx === 4) winNote(mf(WIN_FIFTH[bar]), t, 0.4, 'sine', 0.13);
      if (idx === 2 || idx === 6) winNote(mf(WIN_CHORD[bar][2] + 12), t, 0.22, 'triangle', 0.05); // sparkle
    }
    function scheduleWinMusic() {
      if (!AC) return;
      // same suspended-clock guard as the other schedulers: if the
      // context sat suspended (screen off), jump the playhead back
      // to "now" instead of dumping a pile of overdue notes at once
      if (winNext < AC.currentTime - 0.15) winNext = AC.currentTime + 0.05;
      while (winNext < AC.currentTime + 0.3) {
        scheduleWinStep(winStep, winNext);
        winNext += WIN_STEP;
        winStep = (winStep + 1) % 32;
      }
    }
    function startWinMusic() {
      if (!AC || !soundOn || winTimer) return;
      if (!winGain) { winGain = AC.createGain(); winGain.gain.value = 0.9; winGain.connect(masterGain); }
      winStep = 0;
      winNext = AC.currentTime + 0.08;
      winTimer = setInterval(scheduleWinMusic, 90);
    }
    function stopWinMusic() {
      if (winTimer) { clearInterval(winTimer); winTimer = null; }
    }

    /* ---------------- DEFENDER victory music ----------------
       When the player holds all 20 waves and the castle stands, the
       music box stops and THIS takes over: a fast, impish taunting
       dance written for Count Dracula's smug little triumph —
       very short staccato notes that bounce and stutter on playful
       repeated pitches, mocking upward slides that scoff up into
       the top notes, an oom-pah bass, cheeky chord stabs and a
       wink of high sparkle. Quick, bouncy and a bit wicked, like
       a smug little jig danced right in the kids' faces —
       deliberately unlike the slow D-minor in-game music box and
       unlike the kids' own C-major victory tune above. It plays
       ONLY while the CASTLE SAVED screen is up; restarting hands
       the music box back. -- */
    var defGain = null, defTimer = null, defStep = 0, defNext = 0;
    var DEF_STEP = 0.124; // fast eighths: a giddy taunting jig, not a lullaby
    var DEF_LEAD = [
      86, 86, 83, 86, 79, 79, 83,  0,   // G: high-D stutter, smug bounce back up
      84, 84, 81, 84, 79, 79, 76,  0,   // C: repeated-C taunt, shrug back down
      79, 83, 86, 86, 86, 83, 79, 83,   // G: climb, then a triple-D giggle at the top
      81, 81, 86,  0, 83,  0, 79,  0    // D: repeated-A into one last ta-daa
    ];
    var DEF_BASS = [43, 48, 43, 50];        // bar roots: G · C · G · D
    var DEF_FIFTH = [50, 55, 50, 57];
    var DEF_CHORD = [[55, 59, 62], [55, 60, 64], [55, 59, 62], [54, 57, 62]];
    function defNote(freq, t, dur, type, vol) {
      var o = AC.createOscillator(); o.type = type; o.frequency.value = freq;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(defGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
    /* a mocking upward slide: the note scoffs up from a few
       semitones below into its target pitch, quick and smug —
       the musical equivalent of a raised eyebrow and a snicker */
    function defSlideNote(midi, t) {
      var o = AC.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(mf(midi - 5), t);
      o.frequency.exponentialRampToValueAtTime(mf(midi), t + 0.07);
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.17, t + 0.055);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g); g.connect(defGain);
      o.start(t); o.stop(t + 0.16);
    }
    /* -- Halloween atmosphere ornaments for the victory loop --
       Pure decoration sprinkled BETWEEN the phrases of the tune
       above: the melody, bass, chords, tempo and levels are all
       untouched. One ornament per loop, rotating over a four-loop
       cycle (~16 s): a ghostly theremin-style glissando, a distant
       owl, a soft wind swell, then a far-off bell toll. Each is
       triggered at a phrase ending (a step where the lead rests)
       and kept well under the lead's 0.16 level, so the smug,
       playful tune always stays in front. They ride defGain like
       every other note of this loop, so they start and stop with
       the victory music and obey the sound toggle the same way. */
    var defOrnLoop = 0; // which loop of the 4-loop ornament cycle we are in
    var defNoiseBuf = null;
    function getDefNoiseBuf() {
      if (!defNoiseBuf) {
        var len = Math.floor(AC.sampleRate * 2);
        defNoiseBuf = AC.createBuffer(1, len, AC.sampleRate);
        var d = defNoiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return defNoiseBuf;
    }
    // a ghost sliding past: sine gliss up, wobble, and sigh back down
    function defGhostWail(t) {
      var o = AC.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(587, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.38);
      o.frequency.exponentialRampToValueAtTime(523, t + 0.95);
      var vib = AC.createOscillator(); vib.frequency.value = 5.5;
      var vibG = AC.createGain();
      vibG.gain.setValueAtTime(0, t);
      vibG.gain.linearRampToValueAtTime(14, t + 0.25);
      vibG.gain.linearRampToValueAtTime(0, t + 0.95);
      vib.connect(vibG); vibG.connect(o.frequency);
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.034, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(g); g.connect(defGain);
      o.start(t); o.stop(t + 1.05); vib.start(t); vib.stop(t + 1.05);
      // a faint octave shadow, so the wail feels hollow, not beepy
      defNote(1175, t + 0.05, 0.8, 'sine', 0.008);
    }
    // a far-off owl: two soft low hoots, "hoo… hoo"
    function defOwlHoot(t) {
      [0, 0.42].forEach(function (dt, i) {
        var st = t + dt;
        var o = AC.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(349, st);
        o.frequency.exponentialRampToValueAtTime(311, st + 0.2);
        var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        var g = AC.createGain();
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(i ? 0.036 : 0.042, st + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.26);
        o.connect(lp); lp.connect(g); g.connect(defGain);
        o.start(st); o.stop(st + 0.3);
      });
    }
    // wind worrying at the castle windows: filtered noise swelling
    // up and sighing away underneath one phrase, never over it
    function defWindSwell(t) {
      var src = AC.createBufferSource(); src.buffer = getDefNoiseBuf(); src.loop = true;
      var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(420, t);
      bp.frequency.linearRampToValueAtTime(880, t + 1.1);
      bp.frequency.linearRampToValueAtTime(340, t + 2.4);
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.02, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      src.connect(bp); bp.connect(g); g.connect(defGain);
      src.start(t); src.stop(t + 2.55);
    }
    // one distant bell toll: inharmonic partials decaying at
    // different rates, struck once in the gap after the last phrase
    function defBellToll(t) {
      [[196, 0.042, 2.2], [392, 0.02, 1.5], [537, 0.012, 0.9], [737, 0.007, 0.55]].forEach(function (p) {
        var o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = p[0];
        var g = AC.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(p[1], t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
        o.connect(g); g.connect(defGain);
        o.start(t); o.stop(t + p[2] + 0.05);
      });
    }
    function scheduleDefStep(s, t) {
      var bar = (s / 8) | 0, idx = s % 8;
      var lead = DEF_LEAD[s];
      // staccato lead: very short, bouncy plucked notes, nothing
      // left to ring — and on the scoffing steps (3, 11, 18, 26)
      // the note slides mockingly up into pitch instead of
      // landing clean, while the repeated-note steps (1, 9, 20,
      // 25) get an extra cheeky stutter-tick halfway through the
      // step, so the tune keeps giggling at the kids as it dances
      if (lead) {
        if (s === 3 || s === 11 || s === 18 || s === 26) defSlideNote(lead, t);
        else defNote(mf(lead), t, 0.082, 'triangle', 0.17);
        if (s === 1 || s === 9 || s === 20 || s === 25) defNote(mf(lead), t + DEF_STEP * 0.52, 0.04, 'triangle', 0.085);
      }
      if (idx === 0) defNote(mf(DEF_BASS[bar]), t, 0.16, 'sine', 0.16);
      if (idx === 4) defNote(mf(DEF_FIFTH[bar]), t, 0.14, 'sine', 0.12);
      // impish chord stabs on the off-eighths keep the jig bouncing
      if (idx === 2 || idx === 6) DEF_CHORD[bar].forEach(function (m) { defNote(mf(m), t, 0.07, 'triangle', 0.04); });
      // a tiny wink of sparkle answers the lead late in each bar
      if (idx === 6 && lead) defNote(mf(lead) * 2, t, 0.07, 'sine', 0.03);
      // Halloween ornaments (see defGhostWail & friends above):
      // one per loop, in the gaps between phrases, on a 4-loop
      // rotation — ghost, owl, wind, bell — then round again
      var orn = defOrnLoop % 4;
      if (s === 15 && orn === 0) defGhostWail(t + DEF_STEP);       // after bar 2, where the lead rests
      if (s === 15 && orn === 1) defOwlHoot(t + DEF_STEP);         // same gap, next time round
      if (s === 16 && orn === 2) defWindSwell(t);                  // swelling under bars 3–4
      if (s === 31 && orn === 3) defBellToll(t + DEF_STEP);        // one toll in the gap before the loop repeats
      if (s === 31) defOrnLoop++;
    }
    function scheduleDefMusic() {
      if (!AC) return;
      // same suspended-clock guard as the other schedulers
      if (defNext < AC.currentTime - 0.15) defNext = AC.currentTime + 0.05;
      while (defNext < AC.currentTime + 0.3) {
        scheduleDefStep(defStep, defNext);
        defNext += DEF_STEP;
        defStep = (defStep + 1) % DEF_LEAD.length;
      }
    }
    function startDefSynthMusic() {
      if (!AC || !soundOn || defTimer) return;
      if (!defGain) { defGain = AC.createGain(); defGain.gain.value = 0.95; defGain.connect(masterGain); }
      defStep = 0;
      defOrnLoop = 0; // the ornament rotation always starts from the ghost
      defNext = AC.currentTime + 0.08;
      defTimer = setInterval(scheduleDefMusic, 90);
    }
    function stopDefSynthMusic() {
      if (defTimer) { clearInterval(defTimer); defTimer = null; }
    }
    /* ---------------- CASTLE SAVED song: "My Castle, My Rules" ----------------
       The defender-win screen plays the player's own Suno song
       (assets/my-castle-my-rules.mp3 — the audio extracted from
       the screen recording he sent) on loop INSTEAD of the
       synthesized jig above. It is deliberately NOT played through
       an <audio> element: the win fires from the game loop, not
       from a tap, and phone browsers refuse HTMLAudio playback
       that no tap ever blessed — play() rejects, the fallback
       synth takes over, and the player hears the wrong music.
       So the song is fetched and decoded into the game's own
       AudioContext — the one every tap already unlocks through
       ensureAudio — and looped as a buffer source through its own
       gain into masterGain: the same unlock path as every other
       sound in the game, obeying the sound toggle the same way.
       Dracula's spoken line and laugh are separate and keep
       playing over the song exactly as before. If the song cannot
       be fetched or decoded for any reason, the synthesized loop
       takes over automatically so the victory screen is never
       silent. The fetch starts at boot; decoding happens as soon
       as the AudioContext exists (ensureAudio calls decodeDefSong),
       long before wave 20 can be won. -------- */
    var defSongBuf = null, defSongData = null, defSongFailed = false,
        defSongWanted = false, defSongSrc = null, defSongFetching = false,
        defSongDecoding = false;
    function fetchDefSong() {
      if (defSongFetching || defSongBuf || defSongFailed) return;
      defSongFetching = true;
      try {
        fetch('assets/my-castle-my-rules.mp3').then(function (r) {
          if (!r.ok) throw new Error('song fetch failed');
          return r.arrayBuffer();
        }).then(function (ab) {
          defSongData = ab;
          decodeDefSong();
        }).catch(function () {
          defSongFailed = true;
          if (defSongWanted) startDefSynthMusic();
        });
      } catch (e) { defSongFailed = true; }
    }
    function decodeDefSong() {
      if (!AC || !defSongData || defSongBuf || defSongDecoding || defSongFailed) return;
      defSongDecoding = true;
      var settled = false;
      var done = function (buf) {
        if (settled) return;
        settled = true;
        defSongDecoding = false;
        if (buf) {
          defSongBuf = buf;
          // the win screen is already up and waiting for the song
          if (defSongWanted && !defSongSrc && !defTimer) playDefSong();
        } else {
          defSongFailed = true;
          if (defSongWanted) startDefSynthMusic();
        }
      };
      try {
        var p = AC.decodeAudioData(defSongData.slice(0),
          function (buf) { done(buf); },
          function () { done(null); });
        if (p && p.catch) p.catch(function () { done(null); });
      } catch (e) { done(null); }
    }
    function playDefSong() {
      if (!AC || !defSongBuf || defSongSrc) return;
      try {
        var src = AC.createBufferSource();
        src.buffer = defSongBuf;
        src.loop = true;
        var g = AC.createGain(); g.gain.value = 0.8;
        src.connect(g); g.connect(masterGain);
        src.start();
        defSongSrc = src;
      } catch (e) { defSongFailed = true; startDefSynthMusic(); }
    }
    fetchDefSong(); // start fetching the song while the game boots
    function startDefMusic() {
      if (!soundOn) return;
      if (defTimer) return; // the fallback synth loop is already playing
      if (defSongSrc) return; // the song is already playing
      if (defSongFailed) { startDefSynthMusic(); return; }
      defSongWanted = true;
      fetchDefSong();
      decodeDefSong();
      if (defSongBuf) playDefSong();
      // buffer not ready yet: decodeDefSong's callback starts the
      // song the moment the decode lands
    }
    function stopDefMusic() {
      defSongWanted = false;
      if (defSongSrc) { try { defSongSrc.stop(); } catch (e) {} defSongSrc = null; }
      stopDefSynthMusic();
    }

    /* ---------------- audio recovery after the screen turns off ----------------
       When the phone screen goes off (or the page is otherwise
       hidden), the browser parks the AudioContext in 'suspended'
       to save power — and, crucially, it does NOT wake it up again
       when the screen comes back on: the context just sits there
       suspended and every loop goes silent even though the game
       itself kept running. So the moment the page becomes visible
       again (visibilitychange, with pageshow as the back-cache /
       bfcache twin) we resume the context ourselves — no tap from
       the player needed — and set every loop that was playing
       going again:
         · the scheduler loops (in-game music box, kids' victory
           tune, defender fallback jig, splash dance) still have
           their timers; refilling their lookahead restarts the
           music where it left off.
         · the CASTLE SAVED song is different: it is one looping
           BufferSource, and a source that died while the context
           was parked never comes back on its own — so if the
           victory screen still wants the song, it is started
           fresh from a new source rather than left silent.
       Recovery is deliberately redundant, because the single-
       resume version of this fix still lost the music on a real
       phone: iOS parks the context as 'interrupted' rather than
       'suspended'; its resume() promise can hang forever after
       an interruption (so a pending flag set inside that promise
       never gets set); and a resume fired the instant the page
       reappears lands before the system hands the audio session
       back. So: the pending flag is set up front, resume is
       retried on a short ladder, the context's own statechange
       finishes the job whenever it runs again, focus/pageshow
       are extra triggers, and the next pointerdown / touchstart
       anywhere retries inside a real gesture — see the
       document-level tap listeners further down. ---------------- */
    var audioRecoveryPending = false;
    var audioWentHidden = false; // the page truly went away (screen off / app switch)
    var recoverTimers = [];
    function refillSchedulers() {
      if (musicTimer) scheduleMusic();
      if (winTimer) scheduleWinMusic();
      if (defTimer) scheduleDefMusic();
      if (splTimer) scheduleSplashMusic();
    }
    function restartDefSong() {
      if (!defSongBuf || defTimer) return;
      if (defSongSrc) { try { defSongSrc.stop(); } catch (e) {} defSongSrc = null; }
      playDefSong();
    }
    function clearRecoverTimers() {
      for (var i = 0; i < recoverTimers.length; i++) clearTimeout(recoverTimers[i]);
      recoverTimers = [];
    }
    // The context is running again: refill every loop's lookahead,
    // and — only if the page really went away while the CASTLE
    // SAVED song was wanted — start the song fresh from a new
    // BufferSource: a source the system killed while parked never
    // restarts by itself. A mere blip that never hid the page
    // leaves the still-playing song untouched.
    function finishRecovery() {
      audioRecoveryPending = false;
      clearRecoverTimers();
      refillSchedulers();
      if (audioWentHidden && defSongWanted && defSongBuf && !defTimer) restartDefSong();
      audioWentHidden = false;
    }
    function tryResume() {
      if (!AC) return;
      try {
        var p = AC.resume();
        if (p && p.then) p.then(function () {
          if (AC.state === 'running') finishRecovery();
        }, function () { /* refused: the retry ladder / next tap keeps trying */ });
      } catch (e) {}
    }
    function recoverAudio() {
      if (!AC || !soundOn) { audioRecoveryPending = false; return; }
      if (AC.state === 'running') { finishRecovery(); return; }
      // The context is parked: 'suspended' on Android, 'interrupted'
      // on iOS. Flag the recovery pending BEFORE attempting anything.
      // The previous version only set this flag inside resume()'s
      // promise callback — but after an iOS interruption that promise
      // can hang forever, the flag stayed false, the tap fallback
      // never fired, and the music stayed dead for good.
      audioRecoveryPending = true;
      clearRecoverTimers();
      tryResume();
      // A resume fired the very instant the page reappears is often
      // ignored — the system has not handed the audio session back
      // yet — and the promise can also resolve a beat before the
      // state flips. So retry on a short ladder while the player is
      // looking at the page; the context's own statechange listener
      // (set in ensureAudio) finishes the job the moment any
      // attempt lands, and any tap retries inside a real gesture.
      [300, 900, 2000, 4000].forEach(function (d) {
        recoverTimers.push(setTimeout(function () {
          if (!AC || !audioRecoveryPending) return;
          if (!soundOn) { audioRecoveryPending = false; clearRecoverTimers(); return; }
          if (AC.state === 'running') finishRecovery(); else tryResume();
        }, d));
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { audioWentHidden = true; audioRecoveryPending = true; }
      else recoverAudio();
    });
    window.addEventListener('pagehide', function () { audioWentHidden = true; });
    window.addEventListener('pageshow', function () { recoverAudio(); });
    window.addEventListener('focus', function () { recoverAudio(); });

    /* ---------------- Dracula's maniacal laugh ----------------
       The punchline of his victory line: after the fake sympathy
       and the sudden arrogance, the Count throws his head back and
       LAUGHS. Synthesized like the kids' "yay!" chirps but at the
       opposite end of the world — a low sawtooth bark pushed
       through a bandpass so it reads as a deep male voice, five
       "HA!"s in a row, each a touch lower and louder than the
       last, the final one held and thrown into a short echo so
       it rings around the castle hall. It plays OVER the defender
       victory music (straight into masterGain, its own level kept
       modest) — the music never stops for it. ------------------ */
    var laughEcho = null;
    function getLaughEcho() {
      if (!laughEcho) {
        var dly = AC.createDelay(1); dly.delayTime.value = 0.13;
        var fb = AC.createGain(); fb.gain.value = 0.28;
        var wet = AC.createGain(); wet.gain.value = 0.4;
        dly.connect(fb); fb.connect(dly);
        dly.connect(wet); wet.connect(masterGain);
        laughEcho = dly;
      }
      return laughEcho;
    }
    /* one barked "HA!": pitch scoops down through the burst, with
       a wobble of vibrato and a round undertone for chest */
    function dracHa(t, base, dur, vol) {
      var o = AC.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.18, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.82, t + dur);
      var vib = AC.createOscillator(); vib.frequency.value = 22;
      var vibG = AC.createGain(); vibG.gain.value = base * 0.03;
      vib.connect(vibG); vibG.connect(o.frequency);
      var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.9;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(bp); bp.connect(g); g.connect(masterGain);
      var send = AC.createGain(); send.gain.value = 0.55;
      g.connect(send); send.connect(getLaughEcho());
      o.start(t); o.stop(t + dur + 0.05); vib.start(t); vib.stop(t + dur + 0.05);
      var o2 = AC.createOscillator(); o2.type = 'triangle';
      o2.frequency.setValueAtTime(base * 1.18, t);
      o2.frequency.exponentialRampToValueAtTime(base * 0.82, t + dur);
      var g2 = AC.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o2.connect(g2); g2.connect(masterGain);
      o2.start(t); o2.stop(t + dur + 0.05);
    }
    function dracLaugh() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime + 0.02;
      var beats = [
        { dt: 0,    f: 208, d: 0.17, v: 0.085 },
        { dt: 0.20, f: 196, d: 0.17, v: 0.09 },
        { dt: 0.40, f: 185, d: 0.17, v: 0.095 },
        { dt: 0.60, f: 174, d: 0.18, v: 0.10 },
        { dt: 0.82, f: 158, d: 0.36, v: 0.115 }  // the last one: lowest, loudest, held
      ];
      beats.forEach(function (b) { dracHa(t + b.dt, b.f, b.d, b.v); });
    }
    /* one small voice chirping "yay!": pitch swoops up, then settles,
       pushed through a bandpass so it reads as a kid's voice, not a beep */
    function kidYay(t, base) {
      var o = AC.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.8, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(base * 1.04, t + 0.24);
      var vib = AC.createOscillator(); vib.frequency.value = 26;
      var vibG = AC.createGain(); vibG.gain.value = base * 0.02;
      vib.connect(vibG); vibG.connect(o.frequency);
      var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 2.3; bp.Q.value = 1.1;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
      g.gain.setValueAtTime(0.05, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(bp); bp.connect(g); g.connect(masterGain);
      o.start(t); o.stop(t + 0.32); vib.start(t); vib.stop(t + 0.32);
      // a soft round undertone so the chirp has a little body
      var o2 = AC.createOscillator(); o2.type = 'triangle';
      o2.frequency.setValueAtTime(base * 0.8, t);
      o2.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.09);
      o2.frequency.exponentialRampToValueAtTime(base * 1.04, t + 0.24);
      var g2 = AC.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.045, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o2.connect(g2); g2.connect(masterGain);
      o2.start(t); o2.stop(t + 0.3);
    }
    /* a whole crowd of kids cheering at once: 6–9 little voices,
       staggered, each at its own pitch */
    function cheerSound() {
      if (!AC || !soundOn) return;
      var t = AC.currentTime;
      var n = 6 + Math.floor(Math.random() * 4);
      for (var i = 0; i < n; i++) {
        kidYay(t + Math.random() * 0.06 + i * (0.05 + Math.random() * 0.08), 600 + Math.random() * 420);
      }
    }

    /* ---------------- scene constants ---------------- */
    /* THREE roads, one per game of the rotation — the road follows
       the roster (see rosterKinds / layoutIndex below): game 1
       walks the original serpentine, game 2 walks road A (the same
       serpentine mirrored left-for-right), game 3 walks road B (a
       big hook: a short climb, a long run up the right edge, one
       long cross and a short top run), and from game 4 on A and B
       alternate (even games A, odd games B). All three are drawn
       by the same drawPath() in the same warm gold-orange with
       rounded corners and candy dots, all three leave the spawn
       gate at the bottom centre (225, 748) climbing x=225 first,
       and all three end at (225, 264), inside the round plaza in
       front of the castle door — so the kids' walk, the plaza
       slots and the knocking logic never change, only the shape
       of the road between spawn and plaza does. Everything that
       reasons about the road (kids, the scream ghost, bone piles,
       the werewolf's pounce) works off PATH / SEG / pointAt, so
       swapping PATH swaps the whole game onto the new road; the
       skills aim by tap point or by kid position, never by a
       hardcoded stretch of road, and the castle cannon still only
       ever tests isPlazaKnocker. Each road carries its OWN
       gravestone sites and decorations (SITES_BY_LAYOUT /
       DECO_BY_LAYOUT below), laid out for that road's shape so no
       stone and no decoration ever sits on the road itself:
       road A's sites and deco are the exact mirror of game 1's,
       and road B's were placed in its own grass pockets and
       checked segment by segment against the hook. */
    var PATHS = [
      // game 1: the original serpentine
      [
        [225, 748], [225, 652], [104, 652], [104, 536], [346, 536],
        [346, 416], [104, 416], [104, 300], [225, 300], [225, 264]
      ],
      // road A (even games): the serpentine mirrored left-for-right
      [
        [225, 748], [225, 652], [346, 652], [346, 536], [104, 536],
        [104, 416], [346, 416], [346, 300], [225, 300], [225, 264]
      ],
      // road B (odd games from game 3): the big hook
      [
        [225, 748], [225, 690], [375, 690], [375, 420], [75, 420],
        [75, 320], [225, 320], [225, 264]
      ]
    ];
    var PATH = PATHS[0];
    /* which road the CURRENT game walks, by the same parity rule
       as the roster: game 1 the original, even games road A, odd
       games (from 3) road B. gameNo is declared further down and
       only ever changes through PLAY AGAIN, exactly like the
       roster, so Restart keeps the current game's road just as it
       keeps its six cards. (At boot resetGame() runs before the
       gameNo assignment has executed, so an undefined gameNo must
       read as game 1 here.) */
    function layoutIndex() {
      if (gameNo == null || gameNo <= 1) return 0;
      return gameNo % 2 === 0 ? 1 : 2;
    }
    /* the road's last two runs are the ORIGINAL layout (restored
       at the player's request after a shorter top run read badly):
       the top horizontal runs at y 300 — a full 116px above the
       y 416 horizontal, the same spacing as the road's other
       storeys — and the final leg climbs x=225 straight into the
       round plaza, ending at (225, 264), inside the ellipse. The
       doorstep is drawn AFTER the road, so the leg tucks under
       the plaza's stone and the road visually connects to the
       plaza instead of stopping short of it. The wide grass
       strip between the y 300 and y 416 bands (road edges at
       y 327 and y 389) is what keeps every gravestone clear of
       the road up there: the buildable stele at (225, 356) spans
       y 331..377 and the little deco cross at (292, 356) spans
       y 356..379, both fully inside the strip, touching neither
       band. A walking kid's feet never leave the road: at the
       path's end the kid steps off into a plaza slot (toSlot)
       and only counts as a knocker once it is standing on the
       stone, inside the circle — and the castle cannon's target
       rule is unchanged by this layout: it checks knock mode +
       slot + ellipse (isPlazaKnocker), never mere position, so
       a kid still walking the final leg is never its target */
    var DOOR = { x: 225, y: 196 };
    // cumulative path lengths — rebuilt whenever the road changes
    // (applyLayout below), so pointAt always walks the CURRENT road
    var SEG = [], PATH_LEN = 0;
    function buildSeg() {
      SEG = []; PATH_LEN = 0;
      for (var i = 0; i < PATH.length - 1; i++) {
        var dx = PATH[i + 1][0] - PATH[i][0], dy = PATH[i + 1][1] - PATH[i][1];
        var l = Math.hypot(dx, dy);
        SEG.push({ x1: PATH[i][0], y1: PATH[i][1], x2: PATH[i + 1][0], y2: PATH[i + 1][1], len: l, start: PATH_LEN });
        PATH_LEN += l;
      }
    }
    buildSeg();
    function pointAt(dist) {
      if (dist <= 0) return { x: PATH[0][0], y: PATH[0][1] };
      for (var i = 0; i < SEG.length; i++) {
        var s = SEG[i];
        if (dist <= s.start + s.len) {
          var t = (dist - s.start) / s.len;
          return { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t };
        }
      }
      var last = PATH[PATH.length - 1];
      return { x: last[0], y: last[1] };
    }
    // which road segment a path distance falls on (the werewolf's
    // pounce uses it to tell the stretch of road directly in front
    // of its tower from every other stretch)
    function segIndexAt(dist) {
      for (var i = 0; i < SEG.length; i++) {
        if (dist <= SEG[i].start + SEG[i].len) return i;
      }
      return SEG.length - 1;
    }

    /* every tower throws its OWN candy with its OWN effect:
       Franken — lightning orb: chains to 2 nearby kids and stuns them.
       Ghost — piercing lollipop: flies straight through a whole row.
       Witch — poison potion: splashes a mist that damages + slows.
       Mummy — sand whirlwind: a swirling sand vortex chases a kid,
       slowing it to half pace and stinging it while it lasts.
       Black Cat — paw balls: fastest shots, low damage, often crit ×2.
       Skeleton — bone pile: a heap of bones lobbed onto the road that
       blocks the kids — each bump knocks a bone away until the road
       is clear again. */
    /* balance pass: the defence side was winning too easily, so every
       tower's cooldown (seconds between shots) is a touch longer than
       it was — and the Witch, whose mist was the worst offender, is
       reined in hardest below */
    var TOWER_DEFS = {
      /* franken rebalance: fires slower (interval 1.35 -> 1.6875, i.e.
         0.8x attack speed) but each bolt hits half again as hard
         (dmg 12 -> 18, i.e. 1.5x); chain hops, stun time and the
         relative level-up growth rules are untouched */
      franken: { nm: 'Franken Tower', cost: 50, range: 104, rate: 1.6875, dmg: 18, proj: 'bolt' },
      ghost:   { nm: 'Ghost Tower',   cost: 75,  range: 106, rate: 1.1, dmg: 9,  proj: 'lolli' },
      witch:   { nm: 'Witch Tower',   cost: 100, range: 108, rate: 2.6, dmg: 8,  proj: 'potion' },
      mummy:   { nm: 'Mummy Tower', cost: 125, range: 104, rate: 1.75, dmg: 6,  proj: 'vortex' },
      cat:     { nm: 'Black Cat Tower',   cost: 60,  range: 102, rate: 0.65, dmg: 6,  proj: 'ball' },
      skeleton: { nm: 'Skeleton Tower', cost: 90, range: 150, rate: 1.25, dmg: 0,  proj: 'pile' },
      /* the six rotating recruits (see ROSTERS below): only three of
         them share the panel with three originals in any one game.
         Spider — web spray: wraps the kids around the landing point
         in a heavy slow. Bat — a sonic ring burst around itself.
         Scarecrow — sends a crow to ride one kid, pecking it.
         Zombie — throws its own arm out and back, hitting both ways.
         Werewolf — its howl speeds nearby towers; at Lv3 it ALSO
         transforms into a giant wolf, pounces onto the road and
         mauls the kids there with huge claw swipes (Lv1/Lv2 only
         ever howl — the pounce is a Lv3 power).
         Slime — a goo ball that melts a kid's armour for a while
         AND stings a little on impact: the ball itself deals a
         small bite of direct damage (its dmg below), the melt is
         the main job so the sting stays deliberately small. The
         ball also splats into a sticky green puddle on the road
         (~4s): kids wading through it crawl and take a light
         steady nibble, far weaker than the witch's poison mist */
      spider:    { nm: 'Spider Tower',    cost: 80,  range: 112, rate: 2.2,  dmg: 5,  proj: 'web' },
      bat:       { nm: 'Bat Tower',       cost: 85,  range: 85,  rate: 2.8,  dmg: 11, proj: 'sonic' },
      scarecrow: { nm: 'Scarecrow Tower', cost: 95,  range: 110, rate: 2.0,  dmg: 8,  proj: 'crow' },
      zombie:    { nm: 'Zombie Tower',    cost: 70,  range: 150, rate: 1.6,  dmg: 10, proj: 'arm' },
      werewolf:  { nm: 'Werewolf Tower',  cost: 110, range: 120, rate: 12,   dmg: 0,  proj: 'howl' },
      slime:     { nm: 'Slime Tower',     cost: 90,  range: 108, rate: 3.0,  dmg: 8,  proj: 'goo' }
    };
    var WEB_TIME = [2.5, 3.0, 3.5], WEB_SLOW = [0.35, 0.30, 0.25], WEB_SPLASH = [36, 42, 48]; // spider web, per level
    var CROW_DUR = [4, 4.5, 5];                                    // scarecrow crow ride, per level
    var ARM_LEN = 140;                                             // zombie arm throw distance (range grows it per level)
    var HOWL_BUFF = 1.3, HOWL_DUR = [5, 5.5, 6];                   // werewolf: +30% fire speed, per-level duration
    var WOLF_LEAP_CD = 6;                                          // werewolf pounce: rest seconds AFTER shrinking back into werewolf form before the next transformation — the pounce itself never counts toward it
    var WOLF_CLAW_DMG = 55;                                        // per-swipe maul damage (x LVL_DMG a level, like every tower) — deliberately huge
    var WOLF_CLAW_R = 50;                                          // maul radius around the landed giant wolf
    // werewolf pounce reach: the giant wolf may ONLY land within the
    // tower's own effective range circle (range x the per-level
    // growth below — the same circle shown when placing a tower).
    // There is deliberately no extra multiplier any more: it used to
    // reach 1.6x that circle and would bound halfway across the
    // field after far-off kids. Outside this radius nothing triggers
    // a transformation at all
    var MELT_DUR = [4, 4.75, 5.5], MELT_FRAC = 0.5;                // slime: armour cut by half, per-level duration
    var SLIME_PUDDLE_DUR = 4;                                      // slime puddle: seconds a splat stays gooey on the road
    var SLIME_PUDDLE_R = [36, 42, 48];                             // slime puddle: radius, per level
    var SLIME_PUDDLE_DPS = 3;                                      // slime puddle: bite per second — deliberately far below the witch mist's 9 dps
    var SLIME_PUDDLE_SLOW = [0.65, 0.60, 0.55];                    // slime puddle: pace fraction for kids wading through it, per level
    var CHAIN_RANGE = 88, STUN_TIME = 0.7;                 // franken bolt
    /* witch potion, toned right down: the mist used to splash every
       1.5s into a radius-46 pool that lasted 3.5s, so pools stacked
       up and whole stretches of road sat under near-permanent mist.
       Now the bottle flies far less often (2.6s cooldown, above), the
       pool is much smaller (r 30) and it fades sooner (2.5s), so at
       most one pool is ever up and kids only wade a short stretch */
    var POISON_R = 30, POISON_DUR = 2.5, POISON_DPS = 9;   // witch potion
    var VORT_R = [34, 42, 50];                             // mummy sand whirlwind: radius, per level
    var VORT_DPS = [6, 9, 13];                             // …damage per second inside the vortex, per level
    var VORT_SLOW = 0.5;                                   // …pace fraction for kids caught in the sand
    var VORT_LIFE = [2.6, 3.0, 3.4];                       // …seconds a whirlwind chases before it blows out
    var VORT_SPEED = 240;                                  // …how fast the whirlwind travels, px/s
    var PILE_BONES = [4, 6, 8];                            // skeleton bone pile: bumps to clear, per level
    var PILE_DUR = 12;                                     // …seconds a pile sits on the road if nobody bumps it
    var PILE_BLOCK = 0.8;                                  // …seconds a kid is held up by each bump
    var CRIT_CHANCE = 0.3;                                 // black cat paw ball
    /* -------- level-3 evolutions: every monster's attack changes
       shape at Lv3 (Lv1/Lv2 keep their old behaviour exactly).
       The numbers live here so the whole Lv3 kit reads in one
       place; the per-tower fire/update/draw code below only
       branches on tw.level === 3. */
    var PLAGUE_R = 70, PLAGUE_DMG = 14, PLAGUE_CHAIN = 3;   // witch Lv3: plague burst radius / damage / max chain depth
    var STORM_R = 85, STORM_PUSH = 30;                      // mummy Lv3 sandstorm: radius, backward blow speed px/s
    var MINI_GHOST_CD = 6, MINI_GHOST_DUR = 1.5, MINI_GHOST_CARRY = 80; // ghost Lv3: seconds between releases, carry time, backward carry speed px/s
    var POUNCE_CD = 7, POUNCE_PIN = 2, POUNCE_DPS = 12, POUNCE_FLY = 0.35; // black cat Lv3 pounce: cooldown / pin seconds / scratch dps / leap seconds each way
    var NET_R = 90, NET_DUR = 4, NET_SLOW = 0.30, NET_DRAG = 26; // spider Lv3 net zone: radius / seconds / crawl fraction / drag-back px/s
    var ACID_R = 72, ACID_DPS = 9, ACID_SLOW = 0.45;        // slime Lv3 acid pool: radius / bite per second / pace fraction
    var plagueDepth = 0;                                    // witch Lv3 plague: live chain depth, so bursts never recurse forever
    /* -------- tower levels: every monster grows Lv1 -> Lv2 -> Lv3 --------
       Levels no longer come from a tower's OWN kills. Every kid any
       tower chases away adds 1 point to one shared pool; every
       PICK_EVERY points the player banks one PICK (see checkUnlock),
       spent in the monster picker: place a new tower of the picked
       kind, or tap one already on the field to level it up. Each
       level multiplies damage (x1.6 a level), bullet size (x1.4)
       and body size, trims the fire interval by 15% and stretches
       range by 10%; each monster's special grows too (chain
       targets, mist radius, whirlwind size, crit chance...) —
       those per-kind numbers live where the tower fires and where
       its candy lands, below. */
    var PICK_EVERY = 15;              // points (kids chased away) per banked pick
    var LVL_DMG = [1, 1.6, 2.56];
    var LVL_PROJ = [1, 1.4, 1.96];
    var LVL_SCALE = [0.82, 1, 1.18];
    /* build sites: gravestones along the road — empty until the player
       picks a monster card and taps one to build on it. Three stone
       styles (round-top, cross, flat tablet) so a row of graves does
       not look copy-pasted. EACH road has its own set of 18 (see
       PATHS above): game 1's original field, road A's exact mirror
       of it, and road B's field laid out in the hook's grass — the
       wide inner field between its cross and its bottom run, the
       pockets flanking the plaza and the strip right of the final
       climb. Every set was checked against its own road: no stone
       (and no tower base built on one) sits on the road */
    var SITES_BY_LAYOUT = [
      [
        { x: 80,  y: 244, style: 'stele' }, { x: 366, y: 256, style: 'round' },
        { x: 46,  y: 330, style: 'round' }, { x: 380, y: 358, style: 'cross' },
        { x: 225, y: 356, style: 'stele' }, { x: 176, y: 356, style: 'round' },
        { x: 390, y: 430, style: 'round' },
        { x: 46,  y: 468, style: 'cross' }, { x: 140, y: 468, style: 'round' },
        { x: 225, y: 468, style: 'stele' }, { x: 404, y: 500, style: 'round' },
        { x: 46,  y: 588, style: 'stele' }, { x: 162, y: 596, style: 'cross' },
        { x: 225, y: 596, style: 'round' }, { x: 310, y: 596, style: 'cross' },
        { x: 404, y: 592, style: 'stele' }, { x: 70,  y: 706, style: 'cross' },
        { x: 150, y: 700, style: 'stele' }
      ],
      [
        { x: 370, y: 244, style: 'stele' }, { x: 84,  y: 256, style: 'round' },
        { x: 404, y: 330, style: 'round' }, { x: 70,  y: 358, style: 'cross' },
        { x: 225, y: 356, style: 'stele' }, { x: 274, y: 356, style: 'round' },
        { x: 60,  y: 430, style: 'round' },
        { x: 404, y: 468, style: 'cross' }, { x: 310, y: 468, style: 'round' },
        { x: 225, y: 468, style: 'stele' }, { x: 46,  y: 500, style: 'round' },
        { x: 404, y: 588, style: 'stele' }, { x: 288, y: 596, style: 'cross' },
        { x: 225, y: 596, style: 'round' }, { x: 140, y: 596, style: 'cross' },
        { x: 46,  y: 592, style: 'stele' }, { x: 380, y: 706, style: 'cross' },
        { x: 300, y: 700, style: 'stele' }
      ],
      [
        { x: 70,  y: 250, style: 'stele' }, { x: 372, y: 246, style: 'round' },
        { x: 418, y: 306, style: 'cross' }, { x: 280, y: 362, style: 'round' },
        { x: 360, y: 364, style: 'stele' },
        { x: 48,  y: 484, style: 'cross' }, { x: 105, y: 482, style: 'round' },
        { x: 195, y: 482, style: 'stele' }, { x: 285, y: 482, style: 'cross' },
        { x: 48,  y: 550, style: 'round' }, { x: 105, y: 550, style: 'stele' },
        { x: 195, y: 550, style: 'round' }, { x: 285, y: 550, style: 'stele' },
        { x: 48,  y: 616, style: 'stele' }, { x: 105, y: 618, style: 'cross' },
        { x: 195, y: 618, style: 'round' }, { x: 285, y: 618, style: 'stele' },
        { x: 156, y: 700, style: 'round' }
      ]
    ];
    /* the live site list for the current road: loadSites() fills it
       from SITES_BY_LAYOUT (fresh copies, so a layout's raw data is
       never mutated by a game) and applyLayout() swaps it together
       with the road and the decorations */
    var SITES = [];
    /* decorations per road, in drawDeco()'s own terms: the little
       deco tombstones (left, top, scale, style), the iron fences
       (x1, x2, y), the bushes and lamp posts (x, y), the glowing
       pond's centre and the loose pumpkin by the spawn gate. Game
       1's set is the original; road A's is its exact mirror (the
       pond moves to the bottom-left, clear of the mirrored road);
       road B's set was placed around the hook — the pond takes the
       bottom-left pocket (the hook's bottom-right is road corner),
       the lamps and stones sit in the inner field and the top
       pockets, and nothing overlaps the road or a build site */
    var DECO_BY_LAYOUT = [
      {
        stones: [[56, 386, 1, 'round'], [292, 356, 0.85, 'cross'], [168, 596, 0.9, 'round'], [286, 600, 1, 'cross'], [352, 470, 0.8, 'round']],
        fences: [[8, 66, 428], [384, 444, 452]],
        bushes: [[24, 528], [420, 528]],
        lamps: [[160, 328], [296, 330], [160, 700], [298, 700]],
        pond: { x: 379, y: 676 },
        pumpkin: { x: 52, y: 700, r: 12 }
      },
      {
        stones: [[373, 386, 1, 'round'], [140, 356, 0.85, 'cross'], [263, 596, 0.9, 'round'], [143, 600, 1, 'cross'], [81, 470, 0.8, 'round']],
        fences: [[384, 442, 428], [6, 66, 452]],
        bushes: [[426, 528], [30, 528]],
        lamps: [[290, 328], [154, 330], [290, 700], [152, 700]],
        pond: { x: 71, y: 676 },
        pumpkin: { x: 398, y: 700, r: 12 }
      },
      {
        stones: [[146, 562, 1, 'round'], [326, 560, 0.85, 'cross'], [232, 636, 0.85, 'cross'], [398, 338, 0.8, 'round'], [150, 364, 0.85, 'cross']],
        fences: [[10, 64, 724], [410, 446, 560]],
        bushes: [[24, 528], [424, 640]],
        lamps: [[140, 545], [330, 478], [330, 640], [352, 300]],
        pond: { x: 71, y: 676 },
        pumpkin: { x: 420, y: 718, r: 12 }
      }
    ];
    var DECO = DECO_BY_LAYOUT[0];
    /* empty-gravestone shiver: a still-empty stone now and then gives
       one small, short shake. Every stone keeps its OWN random timer
       (shakeIn counts down to its next shake, shakeAge runs while it
       shakes), the wait is always randomised with a firm floor so
       shakes never come thick and fast, and a shared gap timer plus
       a one-shake-at-a-time rule keep different stones from ever
       shaking at the same moment — a stone whose turn comes up while
       another is shaking (or inside the shared gap) quietly waits a
       short random moment and tries again, so the shakes stay
       staggered. The first waits are spread out by index so the
       field does not all shiver at once when a game starts. Only
       'empty' sites ever shake: the moment one is built on it stops,
       and the purely decorative stones in drawDeco() never shake */
    var SHAKE_DUR = 0.38;                        // one shiver: short
    var shakeGap = 0;                            // shared no-shake gap after any stone starts
    function shakeWait(first, idx) {
      return first ? 1.6 + idx * 0.45 + Math.random() * 5 : 4 + Math.random() * 7;
    }
    /* fill the live SITES list with fresh copies of one layout's
       stones, each with its own shiver timer (see above) */
    function loadSites(idx) {
      SITES = SITES_BY_LAYOUT[idx].map(function (s) {
        return { x: s.x, y: s.y, style: s.style, phase: 'empty', anim: 0, kind: null, tower: null, shakeAge: -1, shakeIn: 0 };
      });
      SITES.forEach(function (s, i) { s.shakeIn = shakeWait(true, i); });
    }
    /* swap the whole scene layout — road, build sites and
       decorations — to the current game's set. Called by
       resetGame(), so a fresh run (Restart or PLAY AGAIN) always
       starts on its own game's road with its own empty graves */
    function applyLayout() {
      var idx = layoutIndex();
      PATH = PATHS[idx];
      buildSeg();
      loadSites(idx);
      DECO = DECO_BY_LAYOUT[idx];
      shakeGap = 0;
    }
    loadSites(0);
    var FALL_DUR = reduceMotion ? 0.15 : 0.45;   // gravestone topples over
    var RISE_DUR = reduceMotion ? 0.2 : 0.7;     // monster rises from the grave
    var THROW_DUR = reduceMotion ? 0.12 : 0.3;   // candy-throw wind-up + release
    /* like the reference video: towers are NOT bought from a shop. The
       The FIRST tower is free — the choice panel pops the moment
       the game starts, before any kid needs to be driven off. After
       that, every kid chased away adds 1 point to the shared pool;
       every 15 points banks one PICK (see checkUnlock), and a pick
       is spent in the monster picker: place a new tower of the
       picked kind, or tap one already on the field to level it up.
       There is no per-tower kill ladder any more, so a defence
       grows as fast as the whole field chases kids away. */
    /* kids arrive in set waves: every wave is bigger than the last
       (6 kids in wave 1), spawns a little faster, and fields a
       wider, tougher mix of kid kinds (see KID_TYPES: a new,
       stronger kind debuts every wave while the old kinds return
       boosted) — a steady difficulty ramp. Between waves there is
       a short breather before the next one is announced. In
       endless mode the waves never stop, and each wave past the
       first adds about one more kid every two waves on top. */
    var TOTAL_WAVES = 10;
    // wave label: challenge shows "3/10", endless shows the plain
    // wave number ("14") — there is no wave 10 to be out of
    function waveLabel(n, endless) { return endless ? String(n) : n + '/' + TOTAL_WAVES; }
    function waveCount(w) { return 4 + Math.ceil(w * 1.35) + (runMode === 'endless' ? Math.floor((w - 1) / 2) : 0); }
    function waveSpawnGap(w) { return Math.max(0.5, 1.3 - w * 0.035); }
    /* run mode: picked once per page session in the mode popup
       (after START, before the first tower picker) — 'challenge'
       is the current game (exactly 10 waves, then victory), and
       'endless' never ends (waves keep coming, harder each time,
       until the house falls). Kept OUTSIDE resetGame's state so
       Restart replays the same mode; only a fresh page load (back
       to the start screen) asks again. */
    var runMode = null;     // 'challenge' | 'endless'
    var modeChosen = false; // this page session has picked a mode
    var WAVE_BREAK = 4.5;
    /* the round stone plaza in front of the castle door — exactly
       the ellipse drawDoorstep() paints: centre (225, 268), radii
       104 x 25 (its edge runs from y 243 to y 293). A kid counts as
       a plaza knocker only when ALL THREE hold at once: it is
       KNOCKING, it is standing on one of the plaza crowd spots (it
       holds a slot, or it is the flagged overflow kid at the
       plaza's centre), and its feet are inside this ellipse. That
       triple check in isPlazaKnocker() is the castle cannon's ONLY
       target rule — a kid on the road can never satisfy it, because
       walking kids hold no slot and their mode is 'walk' */
    var PLAZA = { x: 225, y: 268, rx: 104, ry: 25 };
    function inPlaza(k) {
      var nx = (k.x - PLAZA.x) / PLAZA.rx, ny = (k.y - PLAZA.y) / PLAZA.ry;
      return nx * nx + ny * ny <= 1;
    }
    /* the castle's target test, with a safety margin on top of the
       triple check: the kid's feet must sit inside the INNER 90% of
       the ellipse (score <= 0.81), not merely inside its rim — every
       real crowd slot scores at most ~0.74, so all genuine knockers
       pass with room to spare, while anything standing at or beyond
       the plaza's edge can never be locked onto */
    function isPlazaKnocker(k) {
      if (!k || k.mode !== 'knock' || !(k.slot || k.overflow)) return false;
      var nx = (k.x - PLAZA.x) / PLAZA.rx, ny = (k.y - PLAZA.y) / PLAZA.ry;
      return nx * nx + ny * ny <= 0.81;
    }
    /* the castle's own candy cannon: one shot every 0.8s, and it
       holds its fire completely while kids are still marching,
       while they are walking across the plaza to their spot, and
       while nobody is knocking — it only ever lobs candy at a
       knocking kid standing inside the round plaza (isPlazaKnocker).
       There is deliberately NO range stat: the plaza test replaces
       it, so no shot can ever reach a kid out on the road */
    var HOUSE_CANNON = { x: 225, y: 109, rate: 0.8, dmg: 8 };
    /* pumpkin bomb skill: tap the button to arm it, then tap the road —
       a pumpkin drops there and bursts into candy with splash damage */
    var BOMB_CD = 12, BOMB_RADIUS = 80, BOMB_DMG = 30, BOMB_FALL = 0.45;
    /* ghost scream skill: tap the button and a big ghost drifts from the
       door back along the road — every walking kid it touches panics and
       runs back down the path for a moment */
    var SCREAM_CD = 18, GHOST_SPEED = 215, FLEE_TIME = 1.15, FLEE_SPEED = 155;
    /* candy rain skill: tap the button, then tap the road — candy rains
       on that stretch, walking kids stop to pick it up, and a kid who
       stays in the rain long enough eats its fill and leaves happy */
    var RAIN_CD = 16, RAIN_RADIUS = 88, RAIN_DUR = 3.6, RAIN_FEED = 1.6;
    /* the attacking kids come in 15 kinds, weakest first. A wave
       only fields the kinds unlocked so far: wave 1 sends just the
       two softest (bunny, ghost), every later wave unlocks ONE new
       kind (wave 2 adds skeleton, wave 3 cat, … wave 12 adds robot,
       wave 13 ninja, wave 14 cheetah), and the older kinds keep
       marching in every wave after their debut — but boosted: every
       kind's HP and defence BOTH grow with the wave number (+5% HP
       a wave, compounding, and +0.7 points of damage reduction a
       wave), so a wave-12 bunny is a much harder chase than a
       wave-1 one on both axes. Each kind also has its own base HP
       and its own base defence (a % of every hit shrugged off)
       climbing the roster: the robot kid at the top soaks up ~4.4x
       the bunny's candy and blocks ~24% of every hit before the
       wave boost is even counted. Tougher kinds are also a touch
       bigger and a touch slower — heavy kids, heavy costumes.
       The last TWO kinds break that pattern on purpose: the ninja
       (wave 13) and the cheetah (wave 14) are SPEEDSTERS — by far
       the fastest kids on the road (spd multiplies the usual pace,
       wave step-up included, so they keep getting faster as the
       waves climb, just like everyone else) — but they hit soft:
       their base HP sits back down at the bottom of the roster
       instead of climbing past the robot's, their defence stays
       near zero (the flat `armor` value replaces the tier ladder),
       they stay slim (slim replaces the tier size growth), and
       each of their knocks takes only half a point off the house
       (knock) — they are easy to chase away, they just get to the
       door in a hurry. Two kinds — the bunny and the cat — travel
       by hopping instead of ambling (the `hop` flag on their
       entries): pure show, their speed, HP and every other number
       follow exactly the same rules as everyone else's. */
    var KID_TYPES = [
      { c: 'bunny',    nm: 'BUNNY',    hp: 26, hop: true },
      { c: 'ghost',    nm: 'GHOST',    hp: 30 },
      { c: 'skeleton', nm: 'SKELETON', hp: 34 },
      { c: 'cat',      nm: 'CAT',      hp: 39, hop: true },
      { c: 'witch',    nm: 'WITCH',    hp: 44 },
      { c: 'pirate',   nm: 'PIRATE',   hp: 50 },
      { c: 'pumpkin',  nm: 'PUMPKIN',  hp: 56 },
      { c: 'vampire',  nm: 'VAMPIRE',  hp: 63 },
      { c: 'mummy',    nm: 'MUMMY',    hp: 71 },
      { c: 'hero',     nm: 'SUPERHERO', hp: 80 },
      { c: 'zombie',   nm: 'ZOMBIE',   hp: 90 },
      { c: 'devil',    nm: 'DEVIL',    hp: 101 },
      { c: 'robot',    nm: 'ROBOT',    hp: 114 },
      { c: 'ninja',    nm: 'NINJA',    hp: 24, spd: 1.5,  armor: 0.02, knock: 0.5, slim: 0.92 },
      { c: 'cheetah',  nm: 'CHEETAH',  hp: 20, spd: 1.68, armor: 0.01, knock: 0.5, slim: 0.9 }
    ];
    /* a kid's defence (share of every hit shrugged off): the
       kind's own base — 2 points a tier up the roster, robot 24% —
       PLUS a wave bonus of +0.7 points for every wave past wave 1.
       The wave bonus applies to EVERY kind alike, so an old kind
       marching again in a later wave blocks noticeably more than
       it did at its debut, growing right alongside its boosted HP:
       a wave-20 bunny shrugs off ~13% of every hit (not the 0% it
       had in wave 1), and the toughest late-wave kids cap at 34% */
    function kidArmor(tier, wave) {
      return Math.min(0.34, tier * 0.02 + Math.max(0, (wave || 1) - 1) * 0.007);
    }
    /* pick a kind for the current wave: anything already unlocked
       can show up, the newer (tougher) kinds a little more often */
    function pickKidTier(wave) {
      var maxTier = Math.min(wave, KID_TYPES.length - 1);
      var total = 0, i;
      for (i = 0; i <= maxTier; i++) total += 1 + i * 0.18;
      var r = Math.random() * total;
      for (i = 0; i <= maxTier; i++) {
        r -= 1 + i * 0.18;
        if (r <= 0) return i;
      }
      return maxTier;
    }
    var CANDY_COLORS = ['#ff5d8f', '#ffb03a', '#7ee06f', '#4dc9ff', '#c792ff', '#ffe14d', '#ff7a4d'];

    /* crowd slots in front of the door — every slot stands INSIDE
       the round plaza ellipse (centre 225,268, radii 104x25, edge
       at y 243..293), and the rows run 250 / 264 / 274. Each
       (x, y) pair passes the inPlaza() ellipse test with room to
       spare (worst corner scores ~0.74 of the way to the rim) */
    var SLOTS = [];
    (function () {
      var rows = [
        { y: 250, xs: [176, 200, 224, 248, 272] },
        { y: 264, xs: [158, 186, 214, 242, 270, 294] },
        { y: 274, xs: [172, 200, 228, 256, 284] }
      ];
      rows.forEach(function (r) { r.xs.forEach(function (x) { SLOTS.push({ x: x, y: r.y, taken: null }); }); });
    })();

    /* ---------------- game state ---------------- */
    var HOUSE_MAX = 260;
    var state;
    /* per-run counters for the defeat report: kill timestamps for
       the rolling 3-second Best Combo window, and how many pumpkin
       bombs this run has thrown (reset with every fresh run) */
    var killTimes = [], bestCombo = 0, bombsUsed = 0;
    function resetGame() {
      // the road, graves and decorations of THIS game (Restart
      // keeps gameNo, so it replays the same layout; PLAY AGAIN
      // has already advanced gameNo, so the next layout loads)
      applyLayout();
      state = {
        phase: 'idle',           // idle | playing | exploded
        time: 0,
        houseHP: HOUSE_MAX,
        knockCount: 0,
        kills: 0,                // kids driven away, total
        prog: 0,                 // points toward the next pick (1 per kid chased away)
        picks: 0,                // banked picks (each = one placement or one upgrade)
        pickMode: null,          // how the open picker was reached: null | 'free' | 'pick'
        pendingPick: false,      // a picked card is waiting for a field tap
        freePickDone: false,     // the free first-tower picker has popped
        choosing: false,         // tower-choice popup is up (game frozen)
        pendingKind: null,       // monster picked, waiting for a gravestone tap
        placeSite: null,       // "place here" mode: the shaking grave a tapped card builds on
        pickHintShown: false,  // the new-flow explainer float has shown once this run
        houseCd: 1.0,
        houseHold: true,         // castle cannon starts stood-down: the plaza is empty
        houseFlash: 0,
        houseAngle: -0.4,
        lives: 10,
        spawned: 0,
        wave: 1,
        waveLeft: waveCount(1),  // kids still to come in the current wave
        waveState: 'spawning',   // spawning | break | done (all 20 sent)
        breakTimer: 0,
        waveAnnounced: false,
        seenTiers: {},           // kid kinds that have debuted this run
        kids: [],
        towers: [],
        projs: [],
        zaps: [],                // franken chain-lightning arcs (visual)
        poisons: [],             // witch poison-mist zones
        slimePuddles: [],        // slime goo puddles lingering on the road
        crows: [],               // scarecrow crows riding a kid, pecking
        rings: [],               // bat screech / werewolf howl rings (visual)
        webs: [],                // spider web splats on the road (visual)
        vortexes: [],            // mummy sand whirlwinds chasing kids
        bonePiles: [],           // skeleton bone piles blocking the road
        miniGhosts: [],          // ghost Lv3: little white ghosts carrying kids back
        netZones: [],            // spider Lv3: big net zones laid on the road
        parts: [],               // explosion / ambient particles
        floats: [],              // KNOCK! texts etc.
        debris: [],
        spawnTimer: 2.0,
        shake: 0,
        flash: 0,
        explodeTimer: 0,
        lastKnockSnd: 0,
        smoke: [],
        smokeTimer: 0,
        bombCd: 0,
        bombArmed: false,
        bombs: [],
        screamCd: 0,
        ghosts: [],
        rainCd: 0,
        rainArmed: false,
        rains: [],
        cheerTimer: 0,           // kids-win cheering: time to the next cheer burst
        cheerLeft: 0,            // ...and how long the cheering keeps going
        fxTimer: 0,              // castle-saved candy fireworks: time to the next burst
        fxParts: []              // ...and the firework candies in flight (drawn on the overlay canvas above the group photo)
      };
      killTimes.length = 0; bestCombo = 0; bombsUsed = 0;
      SLOTS.forEach(function (s) { s.taken = null; });
      SITES.forEach(function (s, i) {
        s.phase = 'empty'; s.anim = 0; s.kind = null; s.tower = null;
        s.shakeAge = -1; s.shakeIn = shakeWait(true, i);
      });
      shakeGap = 0;
      document.getElementById('winBanner').classList.remove('show');
      var br0 = document.getElementById('battleReport');
      if (br0) { br0.classList.remove('show'); br0.setAttribute('aria-hidden', 'true'); }
      var db0 = document.getElementById('defBanner');
      if (db0) { db0.classList.remove('show'); db0.setAttribute('aria-hidden', 'true'); }
      var dd0 = document.getElementById('defDim');
      if (dd0) { dd0.classList.remove('show'); dd0.setAttribute('aria-hidden', 'true'); }
      var pa0 = document.getElementById('btnPlayAgain');
      if (pa0) { pa0.classList.remove('show'); pa0.setAttribute('aria-hidden', 'true'); }
      var ch0 = document.getElementById('towerChoice');
      if (ch0) { ch0.classList.remove('show'); ch0.setAttribute('aria-hidden', 'true'); }
      var mc0 = document.getElementById('modeChoice');
      if (mc0) { mc0.classList.remove('show'); mc0.setAttribute('aria-hidden', 'true'); }
      syncHUD(true);
    }
    resetGame();

    /* ---------------- entities ---------------- */
    var kidSeq = 0;
    function spawnKid() {
      kidSeq++;
      var wv = state.wave;
      // which kind walks in: only kinds unlocked by this wave can
      // appear (wave 1 = the two weakest, one new kind per wave)
      var tier = pickKidTier(wv);
      var def = KID_TYPES[tier];
      // the kind's own base HP, boosted by the wave it marches in:
      // +5% a wave compounding, so kinds that debuted early still
      // come back tougher every time they reappear. In challenge
      // mode the compounding halves to +2.5% a wave from wave 15
      // on (the wave-14 factor, then 1.025 for each wave past 14),
      // because the run ends at wave 10 anyway. In endless mode
      // the full x1.05^(wave-1) curve keeps compounding past wave
      // 10 with no cap, so the road never stops getting tougher.
      // From wave 5 on the settled HP is then multiplied by 1.5 on
      // top of that — and from wave 10 on by 1.6 instead — EVERY
      // kind alike, the two speedsters included; waves 1–4 settle
      // exactly as before
      var hpGrowth = runMode === 'endless' ? Math.pow(1.05, wv - 1) : (wv <= 14 ? Math.pow(1.05, wv - 1) : Math.pow(1.05, 13) * Math.pow(1.025, wv - 14));
      var khp = Math.round(def.hp * hpGrowth) + Math.random() * 6;
      if (wv >= 10) khp *= 1.6;
      else if (wv >= 5) khp *= 1.5;
      // road-speed step bonus (see the `speed` note below): the
      // +0.9 step every two waves up to wave 14, halved to +0.45
      // a step for the steps past wave 14
      var speedSteps = Math.floor((wv - 1) / 2);
      var speedBonus = wv <= 14 ? speedSteps * 0.9 : 6 * 0.9 + (speedSteps - 6) * 0.45;
      // a brand-new kind gets a shout the first time it ever appears
      if (!state.seenTiers[tier]) {
        state.seenTiers[tier] = true;
        if (tier >= 2) addFloat(225, 152, 'NEW KID: ' + def.nm + '!', '#ff9d5c', 19);
      }
      state.kids.push({
        id: kidSeq,
        costume: def.c,
        tier: tier,
        hop: !!def.hop,   // bunny & cat bound down the road instead of ambling (visual only — see drawKid)
        // defence: the two speedster kinds carry a flat `armor`
        // value on their KID_TYPES entry instead of climbing the
        // tier ladder — it only creeps up a third of a point a
        // wave (capped at 10%), so they stay easy to chase away
        // even in the last waves; everyone else uses kidArmor()
        armor: def.armor != null ? Math.min(0.1, def.armor + Math.max(0, wv - 1) * 0.003) : kidArmor(tier, wv),
        // how hard this kid's knocks hit the house: 1 point for
        // every kind except the two speedsters, whose knocks
        // only take half a point (see their KID_TYPES entries)
        knockDmg: def.knock || 1,
        dist: -Math.random() * 6,
        // road walking speed: a small step up every TWO waves —
        // waves 1-2 share the base pace, waves 3-4 are one slight
        // step faster (+0.9, under 2% of the base), waves 5-6 the
        // next, and so on up to wave 14 (+5.4). From wave 15 on
        // the step halves to +0.45 (see `speedBonus` above), so
        // waves 15–20 stay faster than wave 14 and keep climbing,
        // just less steeply (wave 19-20 tops out at +6.75). The
        // step is added BEFORE the kind's own pace factor below,
        // so every kind gains exactly the same step and the kinds'
        // relative order never changes: tougher kinds stay a
        // touch slower than weaker ones at every wave. The two
        // speedster kinds swap the usual slight slow-down factor
        // for their big `spd` multiplier instead — applied to the
        // same stepped base, so they enjoy the same every-two-
        // waves step-up while staying far ahead of the pack.
        // From wave 10 on, the whole road pace is then multiplied
        // by 1.3 on top of everything above — the kind's own
        // factor included, so the ninja's 1.5 and the cheetah's
        // 1.68 stack with it rather than being replaced. In
        // endless mode one more multiplier stacks on top:
        // x1.03 compounding per wave, so wave 20 runs about
        // 1.75x the wave-1 pace before the step bonus — each wave
        // is noticeably faster, and eventually overwhelming.
        // This `speed` drives ONLY the march down the road: fleeing
        // back (FLEE_SPEED) and walking to a knocking slot in the
        // plaza (its own fixed pace) are separate and unchanged.
        speed: (42 + Math.random() * 10 + speedBonus) * (def.spd || (1 - tier * 0.008)) * (wv >= 10 ? 1.3 : 1) * (runMode === 'endless' ? Math.pow(1.03, wv - 1) : 1),
        hp: khp, hpMax: khp,
        x: PATH[0][0], y: PATH[0][1],
        mode: 'walk',            // walk | toSlot | knock | happy | cheer
        slot: null,
        overflow: false,         // true only for the extra knocker standing at the plaza's centre when every slot is taken
        bob: Math.random() * Math.PI * 2,
        knockPhase: Math.random(),
        happyTimer: 0,
        // size: tougher kinds grow a touch tier by tier; the two
        // speedsters stay slim instead (their `slim` factor)
        scale: (1.05 + Math.random() * 0.12) * (def.slim || (1 + tier * 0.011)),
        slowTimer: 0,
        fleeTimer: 0,
        stunTimer: 0,            // franken bolt: frozen by electricity
        blockTimer: 0,           // skeleton bone pile: held up by a bump
        webTimer: 0,             // spider web: wrapped up, crawling
        webF: 0.35,              // ...at this fraction of normal pace
        armorDownTimer: 0,       // slime goo: armour melted, hits bite deeper
        armorZeroTimer: 0,       // slime Lv3 acid pool: armour fully corroded while inside
        carryT: 0,               // ghost Lv3 mini ghost: being carried back along the road
        pinT: 0,                 // black cat Lv3 pounce: pinned down, cannot move
        rainTime: 0
      });
      state.spawned++;
    }

    /* all 20 waves sent and every kid dealt with while the house still
       stands: the defender wins — float the banner (no panel, so the
       field stays visible) and let the remaining happy kids wander off */
    function defenderWin() {
      state.phase = 'defended';
      // the castle stands: the in-game music box gives way to
      // Dracula's own smug victory strut (it stops again the moment
      // the player restarts — see the restart / sound handlers)
      stopMusic();
      startDefMusic();
      var db = document.getElementById('defBanner');
      if (db) { db.classList.add('show'); db.setAttribute('aria-hidden', 'false'); }
      // darken the game behind the group photo (the dim veil sits
      // between the canvas and the photo, so the photo itself
      // stays at full brightness) and start the candy fireworks:
      // the first burst goes off just as the photo finishes
      // popping in, then one every ~0.9s for as long as this
      // screen stays up (resetGame clears both on Restart)
      var dd = document.getElementById('defDim');
      if (dd) { dd.classList.add('show'); dd.setAttribute('aria-hidden', 'false'); }
      var pa = document.getElementById('btnPlayAgain');
      if (pa) { pa.classList.add('show'); pa.setAttribute('aria-hidden', 'false'); }
      state.fxTimer = 0.35;
      // timed to the bubble: the HAHAHA! text bursts in at ~3.85s,
      // and the laugh itself lands right on it — over the victory
      // music, never instead of it. Guarded by the banner still
      // being up, so a quick restart silences it.
      setTimeout(function () {
        var dbNow = document.getElementById('defBanner');
        if (dbNow && dbNow.classList.contains('show')) dracLaugh();
      }, 3820);
      addFloat(DOOR.x, 150, 'All ' + TOTAL_WAVES + ' waves held!', '#7ee06f', 18);
      happySound();
      cheerSound();
      syncHUD(true);
    }

    function freeSlot() {
      for (var i = 0; i < SLOTS.length; i++) if (!SLOTS[i].taken) return SLOTS[i];
      return null;
    }

    /* ---------------- particles ---------------- */
    /* groundY: the ground line the burst's candies bounce on and
       settle at. Bursts off a kid pass that kid's own feet line, so
       the candies burst out of the kid's body and scatter around
       ITS position — without it they would bounce on the shared
       default line down by the plaza, far from where the kid was
       actually hit. Burst candies are small and numerous. */
    function burstCandy(x, y, n, power, groundY) {
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        var sp = (0.4 + Math.random() * 0.6) * power;
        state.parts.push({
          type: 'candy', shape: Math.floor(Math.random() * 3),
          color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9,
          life: 2.4 + Math.random() * 1.6, t: 0, size: 3 + Math.random() * 2.5,
          bounce: 0,
          floor: (groundY != null ? groundY + Math.random() * 6 : null)
        });
      }
    }
    /* ---------------- castle-saved candy fireworks ----------------
       While the CASTLE SAVED group photo is up, a burst of candy
       goes off around it every ~0.9s (ticked in update()): 20–30
       candies spray outward from a random point on the photo's
       edge, arc under the same gravity as the game's candy
       particles and fade out. They live in state.fxParts — NOT
       state.parts — because they are drawn on the #winFx overlay
       canvas that floats above the photo (see renderWinFx in
       draw()); the game-canvas particles would sit behind both
       the dim veil and the photo. The candies themselves are
       drawn by the game's own drawCandyShape. The photo's box in
       game coordinates: the banner is centred at (50%, 34%) of
       the 450×740 stage and 75% wide, and the image is
       1200×1061, so it spans x 56–394, y 102–401. */
    function burstWinFx() {
      var cx = W / 2, cy = H * 0.34;
      var hw = W * 0.75 / 2, hh = hw * 1061 / 1200;
      // a random point on the photo's rectangular edge
      var d = Math.random() * (4 * hw + 4 * hh), px, py;
      if (d < 2 * hw) { px = cx - hw + d; py = cy - hh; }
      else if (d < 2 * hw + 2 * hh) { px = cx + hw; py = cy - hh + (d - 2 * hw); }
      else if (d < 4 * hw + 2 * hh) { px = cx + hw - (d - 2 * hw - 2 * hh); py = cy + hh; }
      else { px = cx - hw; py = cy + hh - (d - 4 * hw - 2 * hh); }
      var base = Math.atan2(py - cy, px - cx);
      var n = 20 + Math.floor(Math.random() * 11);
      for (var i = 0; i < n; i++) {
        var a = base + (Math.random() - 0.5) * 1.6;
        var sp = 110 + Math.random() * 190;
        state.fxParts.push({
          shape: Math.floor(Math.random() * 3),
          color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
          x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9,
          life: 1.2 + Math.random() * 0.9, t: 0, size: 4.5 + Math.random() * 2.5
        });
      }
    }
    function burstDebris() {
      var pieces = ['roof', 'roof', 'wall', 'wall', 'door', 'chimney', 'plank', 'plank', 'plank'];
      pieces.forEach(function (p, i) {
        state.debris.push({
          kind: p,
          x: DOOR.x + (Math.random() - 0.5) * 70, y: 160 + Math.random() * 50,
          vx: (Math.random() - 0.5) * 260, vy: -180 - Math.random() * 190,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8,
          t: 0, life: 2.8
        });
      });
      for (var i = 0; i < 26; i++) {
        state.parts.push({
          type: 'puff', color: '#8f7cc9',
          x: DOOR.x + (Math.random() - 0.5) * 110, y: 180 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40,
          rot: 0, vr: 0, life: 1.4 + Math.random(), t: 0, size: 12 + Math.random() * 16, bounce: 0
        });
      }
    }
    function addFloat(x, y, text, color, size) {
      state.floats.push({ x: x, y: y, text: text, color: color, size: size || 15, t: 0, life: 0.85, rot: (Math.random() - 0.5) * 0.35 });
      if (state.floats.length > 26) state.floats.splice(0, state.floats.length - 26);
    }

    /* ---------------- battle report (defeat summary) ----------------
       When the castle falls, a snapshot of the run is taken at the
       moment of the explosion (the game clock keeps ticking behind
       the celebration, so the numbers must be frozen here), and the
       BATTLE REPORT popup floats in ~1.2s after the KIDS WIN!
       banner — late enough that the celebration is seen first, and
       closable via its X so it never traps the player on it. */
    /* Best Combo: every kid chased away stamps the run clock;
       the combo is the most stamps inside any rolling 3-second
       window — old stamps simply fall out of the window */
    function noteComboKill() {
      killTimes.push(state.time);
      while (killTimes.length && killTimes[0] <= state.time - 3) killTimes.shift();
      if (killTimes.length > bestCombo) bestCombo = killTimes.length;
    }
    var battleStats = null;
    function battleRank(w) {
      if (w <= 2) return 'Pumpkin Rookie';
      if (w <= 4) return 'Candy Apprentice';
      if (w <= 6) return 'Midnight Guard';
      if (w <= 8) return 'Castle Knight';
      return "Dracula's Shadow";
    }
    function fmtBattleTime(sec) {
      var m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
      return m + ':' + (ss < 10 ? '0' : '') + ss;
    }
    /* Dracula's verdict on the run, for the polaroid frame:
       the fewer waves the castle survived, the more the
       embarrassment is HIS — the kids were that strong */
    function draculaQuote(w) {
      if (w <= 2) return 'This is... embarrassing.';
      if (w <= 4) return 'Haha... they got lucky.';
      if (w <= 6) return 'Hmm... mildly amusing.';
      if (w <= 8) return 'Not bad... for a mortal.';
      return 'Almost worthy of my castle!';
    }
    /* which of the four polaroid portraits the run earns —
       coarser tiers than the quote, and the emotion runs
       ashamed-to-proud, NOT mocking: the fewer waves the
       castle held, the stronger the kids were and the more
       egg on Dracula's own face. So an early collapse gets
       the sweating, mortified portrait; the cape smirk at
       3–4; the raised-glass laugh at 5–6; and genuine
       approval past wave 6. The files come pre-cropped to
       the frame's ~1.21 aspect with the face centred, so
       both renderers just fill the frame */
    function draculaPortrait(w) {
      if (w <= 2) return 'assets/dracula-nervous.webp';
      if (w <= 4) return 'assets/dracula-smug.webp';
      if (w <= 6) return 'assets/dracula-laugh.webp';
      return 'assets/dracula-proud.webp';
    }
    /* rounded-rect path on an ARBITRARY 2d context — the game's
       own rr() only knows the main canvas, so the report's
       overlay canvas and the share card need their own tracer */
    function traceRoundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
      c.closePath();
    }
    /* cover the poster art's baked-in Frankenstein portrait
       with a patch of the card's own interior colour, then draw
       THIS run's top defender over it in its full Lv3 form,
       using the game's own monster renderer: the module ctx is
       borrowed for the duration and handed straight back — the
       same trick renderWinFx uses for the fireworks canvas.
       (px, py, pw, ph) is the patch rect in the target canvas's
       pixels; (mx, my) is where the monster's base sits and s
       its draw scale, so each caller fits its own canvas */
    function paintTopDefender(c, kind, px, py, pw, ph, mx, my, s) {
      var g = c.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, '#1e1444'); g.addColorStop(1, '#160b40');
      c.save();
      traceRoundRect(c, px, py, pw, ph, ph * 0.1);
      c.fillStyle = g; c.fill();
      c.clip();
      var mainCtx = ctx;
      ctx = c;
      try { drawMonster(kind, mx, my, 0, s, -1, 3); }
      catch (e) { console.log('[br] top defender draw failed', e); }
      ctx = mainCtx;
      c.restore();
    }
    function showBattleReport() {
      if (!battleStats) return;
      var box = document.getElementById('battleReport');
      if (!box) return;
      document.getElementById('brWaves').textContent = waveLabel(battleStats.waves, battleStats.endless);
      document.getElementById('brKids').textContent = battleStats.kids;
      document.getElementById('brCombo').textContent = 'x' + battleStats.combo;
      document.getElementById('brTop').textContent = battleStats.top;
      document.getElementById('brBomb').textContent = battleStats.bombs;
      /* the portrait beside that name: the run's real top
         defender, painted over the poster's baked-in
         Frankenstein (the overlay canvas is sized 244x232 —
         twice its slot on the 1086x1448 art). The tower is
         drawn SMALL (scale 2.9 here, 1.45 on the share card)
         and centred in the slot, so even the tallest Lv3
         regalia — the skeleton's top hat, the witch's hat —
         stays inside the slot with margin on every side
         instead of pressing over the card's frame. With no
         kills on any tower there is no defender: hide the
         canvas so the report never shows a face the name
         disowns */
      var brTf = document.getElementById('brTopFace');
      if (brTf) {
        if (battleStats.topKind) {
          brTf.style.display = 'block';
          var brTc = brTf.getContext ? brTf.getContext('2d') : null;
          if (brTc) paintTopDefender(brTc, battleStats.topKind, 0, 0, brTf.width, brTf.height, brTf.width / 2, brTf.height * 0.776, 2.9);
        } else {
          brTf.style.display = 'none';
        }
      }
      document.getElementById('brDracQuote').textContent = draculaQuote(battleStats.waves);
      var brDracImg = document.getElementById('brDracImg');
      if (brDracImg) brDracImg.src = draculaPortrait(battleStats.waves);
      document.getElementById('brBubble').textContent = battleStats.waves >= 7
        ? 'Your cemetery nearly survived the candy raid!'
        : 'The kids broke through... but your monsters fought bravely!';
      document.getElementById('brShareWaves').textContent =
        battleStats.waves + (battleStats.waves === 1 ? ' wave' : ' waves');
      box.classList.add('show');
      box.setAttribute('aria-hidden', 'false');
    }
    function hideBattleReport() {
      var box = document.getElementById('battleReport');
      if (!box) return;
      box.classList.remove('show');
      box.setAttribute('aria-hidden', 'true');
      hideBrLinkBox();
    }
    var brToastTimer = null;
    function showBrToast(msg) {
      var t = document.getElementById('brToast');
      if (!t) return;
      t.textContent = msg || 'Link copied! Challenge your friends!';
      t.hidden = false;
      if (brToastTimer) clearTimeout(brToastTimer);
      brToastTimer = setTimeout(function () { t.hidden = true; }, 2600);
    }
    /* last-resort copy for browsers without the async clipboard:
       a throwaway textarea + execCommand('copy'). Returns true
       only when the copy really went through, so the caller can
       fall through to the manual link box when it did not */
    function legacyCopyLink(url) {
      try {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '0';
        ta.style.top = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
        document.body.removeChild(ta);
        console.log('[br-share] execCommand copy ->', ok);
        return ok;
      } catch (e) {
        console.log('[br-share] execCommand copy unavailable', e);
        return false;
      }
    }
    /* every automatic route failed (e.g. an embedded webview that
       blocks both the share sheet and the clipboard): show the
       game link inside the popup in a tap-to-select field so the
       player can copy it by hand — Share must never fail silently */
    function showBrLinkBox(url) {
      var box = document.getElementById('brLinkBox');
      var input = document.getElementById('brLinkUrl');
      if (!box || !input) { console.log('[br-share] link box elements missing'); return; }
      input.value = url;
      box.hidden = false;
      console.log('[br-share] showing manual link box');
    }
    function hideBrLinkBox() {
      var box = document.getElementById('brLinkBox');
      if (box) box.hidden = true;
    }
    /* copy route: async clipboard first, execCommand as the
       backstop, the manual link box when both are blocked */
    function copyBattleLink(url) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          console.log('[br-share] clipboard copy ok');
          showBrToast();
        }, function (err) {
          console.log('[br-share] clipboard copy failed', err);
          if (legacyCopyLink(url)) showBrToast(); else showBrLinkBox(url);
        });
      } else if (legacyCopyLink(url)) {
        showBrToast();
      } else {
        showBrLinkBox(url);
      }
    }
    /* ---------- achievement card image share ----------
       Tapping Share Result first renders this run's defeat
       poster onto a canvas the same size as the art
       (1086x1448): a deep-purple base (so the poster's
       transparent corners come out filled), the poster itself,
       then the same words the popup shows, drawn at the same
       percentage positions and in the same style as the .br-*
       overlays — pale-lavender labels, chunky bright-yellow
       values, dark-purple words in the ghost's bubble, and the
       share card's yellow lettering with the pink line and a
       dark outline. The PNG then goes out through the native
       file share sheet when the browser supports one; where it
       does not, the card is downloaded instead (with a toast
       telling the player to post it to their IG Story) and the
       game link is copied alongside. Only when the card cannot
       be rendered at all does sharing fall back to the plain
       text/link chain further below. Everything is wrapped so
       a blocked share sheet inside an embedded webview can
       never fail silently or throw. ---------- */
    var SHARE_CARD_FONT = '"Baloo 2", "Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "PingFang SC", sans-serif';
    function battleShareText() {
      var rank = battleRank(battleStats.waves);
      return '\uD83C\uDF83 Halloween Tower Defense — I earned the title "' + rank + '"! I survived wave ' +
        waveLabel(battleStats.waves, battleStats.endless) + ' and repelled ' + battleStats.kids +
        ' trick-or-treat kids. Can you defend Dracula\u2019s castle longer?';
    }
    /* one stat cell, mirroring .br-cell: label + value stacked
       and vertically centred inside the painted card's box
       (box = [left, top, width, height] as fractions) */
    function drawCardCell(ctx, W, H, box, label, value, valScale) {
      var labSize = W * 0.026, valSize = W * (valScale || 0.052);
      var labH = labSize * 1.1, valH = valSize * 1.05;
      var x = box[0] * W;
      var y = box[1] * H + (box[3] * H - labH - valH) / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#c9bdf2';
      ctx.font = '700 ' + labSize + 'px ' + SHARE_CARD_FONT;
      ctx.fillText(label, x, y);
      ctx.fillStyle = '#ffd23e';
      ctx.font = '800 ' + valSize + 'px ' + SHARE_CARD_FONT;
      ctx.shadowColor = 'rgba(0, 0, 0, .35)';
      ctx.shadowBlur = W * 0.007;
      ctx.shadowOffsetY = W * 0.003;
      ctx.fillText(value, x, y + labH);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    function wrapCardLines(ctx, text, maxW, maxLines) {
      var words = String(text).split(' ');
      var lines = [], cur = '';
      for (var i = 0; i < words.length; i++) {
        var t = cur ? cur + ' ' + words[i] : words[i];
        if (ctx.measureText(t).width <= maxW || !cur) cur = t;
        else { lines.push(cur); cur = words[i]; }
      }
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines);
    }
    /* one centred line of the share card's chunky lettering:
       segments are [text, fill colour] pairs, stroked with the
       dark-purple outline first, then filled over a hard drop
       shadow — the canvas echo of .br-share-big */
    function drawCardLine(ctx, cx, y, segments, size) {
      var i, x, total = 0;
      ctx.font = '800 ' + size + 'px ' + SHARE_CARD_FONT;
      for (i = 0; i < segments.length; i++) total += ctx.measureText(segments[i][0]).width;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = '#2b1050';
      ctx.lineWidth = Math.max(4, size * 0.16);
      x = cx - total / 2;
      for (i = 0; i < segments.length; i++) {
        ctx.strokeText(segments[i][0], x, y);
        x += ctx.measureText(segments[i][0]).width;
      }
      ctx.shadowColor = 'rgba(23, 8, 48, .8)';
      ctx.shadowOffsetY = size * 0.09;
      ctx.shadowBlur = 0;
      x = cx - total / 2;
      for (i = 0; i < segments.length; i++) {
        ctx.fillStyle = segments[i][1];
        ctx.fillText(segments[i][0], x, y);
        x += ctx.measureText(segments[i][0]).width;
      }
      ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;
    }
    function renderShareCard(cb) {
      var done = false;
      function finish(blob) { if (!done) { done = true; cb(blob || null); } }
      try {
        var img = new Image();
        /* Dracula's portrait for this run (the polaroid) loads
           first — it is tiny and preloaded by the page, so this
           chain costs nothing in practice; if it fails, the card
           is still rendered, just with the frame left empty */
        var dracImg = new Image();
        var dracOk = false;
        var posterKicked = false;
        function kickPoster() {
          if (posterKicked) return;
          posterKicked = true;
          img.src = 'assets/defeat-report.webp';
        }
        dracImg.onload = function () { dracOk = true; kickPoster(); };
        dracImg.onerror = function () { kickPoster(); };
        dracImg.src = draculaPortrait(battleStats ? battleStats.waves : 1);
        setTimeout(kickPoster, 1500); // a hung portrait fetch must not hang the card
        img.onload = function () {
          try {
            var W = 1086, H = 1448;
            var cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            var ctx = cv.getContext('2d');
            if (!ctx) { finish(null); return; }
            ctx.fillStyle = '#241453';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0, W, H);
            var s = battleStats;
            /* Top Defender card: paint over the poster's baked-in
               Frankenstein with this run's actual top defender
               (same shrunken slot the popup's overlay canvas
               covers — x 91–213, y 676–792 in poster pixels,
               inside the painted card's frame — with the tower
               drawn small and centred in it, Lv3 hat and all) */
            if (s.topKind) {
              paintTopDefender(ctx, s.topKind, W * 0.0838, H * 0.4669, W * 0.1123, H * 0.0801, W * 0.14, H * 0.529, 1.45);
            }
            drawCardCell(ctx, W, H, [0.173, 0.361, 0.172, 0.087], 'Wave Reached', waveLabel(s.waves, s.endless));
            drawCardCell(ctx, W, H, [0.481, 0.361, 0.153, 0.087], 'Kids Knocked', String(s.kids));
            drawCardCell(ctx, W, H, [0.753, 0.361, 0.175, 0.087], 'Best Combo', 'x' + s.combo);
            drawCardCell(ctx, W, H, [0.201, 0.465, 0.283, 0.086], 'Top Defender', s.top, 0.042);
            drawCardCell(ctx, W, H, [0.656, 0.465, 0.270, 0.086], 'Pumpkin Bomb Used', String(s.bombs));
            /* the ghost's bubble: dark-purple words centred in
               the painted lavender bubble, wrapped like the DOM */
            var bub = s.waves >= 7
              ? 'Your cemetery nearly survived the candy raid!'
              : 'The kids broke through... but your monsters fought bravely!';
            var bSize = W * 0.032, lh = bSize * 1.18, i;
            ctx.font = '800 ' + bSize + 'px ' + SHARE_CARD_FONT;
            ctx.fillStyle = '#33186b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var lines = wrapCardLines(ctx, bub, W * 0.45, 3);
            var by = 0.569 * H + (0.07 * H - lines.length * lh) / 2;
            for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], W * 0.5, by + i * lh);
            /* the dashed share card: two chunky lines plus the
               pale sub-line, centred inside the painted frame */
            var big = W * 0.042, sub = W * 0.033, gap = W * 0.008;
            var totalH = big * 1.14 * 2 + gap + sub * 1.2;
            var sy = 0.686 * H + (0.136 * H - totalH) / 2;
            var cx = (0.295 + 0.435 / 2) * W;
            drawCardLine(ctx, cx, sy, [['I survived ', '#fff3d6'], [s.waves + (s.waves === 1 ? ' wave' : ' waves'), '#ffd23e']], big);
            drawCardLine(ctx, cx, sy + big * 1.14, [['in Space 5!', '#ff6ec7']], big);
            ctx.font = '700 ' + sub + 'px ' + SHARE_CARD_FONT;
            ctx.fillStyle = '#e9e2ff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0, 0, 0, .55)';
            ctx.shadowBlur = W * 0.005;
            ctx.shadowOffsetY = W * 0.002;
            ctx.fillText('Can you beat me?', cx, sy + big * 1.14 * 2 + gap);
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            /* the polaroid frame: this run's Dracula portrait
               fills the painted frame's whole inner area
               (~173x143 poster px, tilted -6 degrees like the
               art), and his verdict on the run sits over the
               picture's bottom edge on a dark gradient, the
               canvas echo of the popup's .br-polaroid */
            if (dracOk) {
              ctx.save();
              ctx.translate(W * 0.1828, H * 0.7503);
              ctx.rotate(-6 * Math.PI / 180);
              ctx.save();
              traceRoundRect(ctx, -86, -71, 172, 142, 8);
              ctx.clip();
              ctx.drawImage(dracImg, -86, -71, 172, 142);
              ctx.font = '800 20px ' + SHARE_CARD_FONT;
              var qLines = wrapCardLines(ctx, draculaQuote(s.waves), 156, 3);
              var qH = qLines.length * 23;
              var grad = ctx.createLinearGradient(0, 71 - qH - 30, 0, 71);
              grad.addColorStop(0, 'rgba(16, 4, 38, 0)');
              grad.addColorStop(1, 'rgba(16, 4, 38, .9)');
              ctx.fillStyle = grad;
              ctx.fillRect(-86, 71 - qH - 30, 172, qH + 30);
              ctx.fillStyle = '#f3edff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.shadowColor = 'rgba(0, 0, 0, .65)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetY = 2;
              for (i = 0; i < qLines.length; i++) ctx.fillText(qLines[i], 0, 71 - 6 - qH + i * 23);
              ctx.restore();
              ctx.restore();
            }
            if (cv.toBlob) {
              cv.toBlob(function (b) { finish(b); }, 'image/png');
            } else if (cv.toDataURL) {
              var bin = atob(cv.toDataURL('image/png').split(',')[1]);
              var arr = new Uint8Array(bin.length);
              for (i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              finish(new Blob([arr], { type: 'image/png' }));
            } else finish(null);
          } catch (e) {
            console.log('[br-share] card render failed', e);
            finish(null);
          }
        };
        img.onerror = function () {
          console.log('[br-share] poster failed to load for the card');
          finish(null);
        };
      } catch (e) {
        console.log('[br-share] card render unavailable', e);
        finish(null);
      }
    }
    /* best-effort link copy with NO feedback of its own: the
       download toast is the message on this route */
    function silentCopyLink(url) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {}, function () { legacyCopyLink(url); });
        } else {
          legacyCopyLink(url);
        }
      } catch (e) { /* copying is a bonus here, never a blocker */ }
    }
    function downloadShareCard(blob, url) {
      try {
        var objUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = objUrl;
        a.download = 'halloween-tower-defense-score.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 5000);
        console.log('[br-share] card downloaded');
      } catch (e) {
        console.log('[br-share] card download failed', e);
      }
      silentCopyLink(url);
      showBrToast('卡片已保存，去 IG 快拍发出来吧！');
    }
    function shareCardImage(blob, text, url) {
      var file = null;
      try { file = new File([blob], 'halloween-tower-defense-score.png', { type: 'image/png' }); } catch (e) { file = null; }
      var canFiles = false;
      if (file && navigator.canShare) {
        try { canFiles = !!navigator.canShare({ files: [file] }); } catch (e) { canFiles = false; }
      }
      if (canFiles && navigator.share) {
        var p = null;
        try {
          p = navigator.share({ files: [file], title: 'Halloween Tower Defense', text: text });
        } catch (e) {
          console.log('[br-share] file share threw synchronously', e);
        }
        if (p && typeof p.then === 'function') {
          p.then(function () {
            console.log('[br-share] card image share completed');
          }, function (err) {
            if (err && err.name === 'AbortError') {
              /* player opened the sheet and closed it — a
                 response, not a failure: no download behind
                 their back */
              console.log('[br-share] card share dismissed by player');
              return;
            }
            console.log('[br-share] card share failed — downloading instead', err);
            downloadShareCard(blob, url);
          });
          return;
        }
        console.log('[br-share] file share returned nothing usable — downloading instead');
      } else {
        console.log('[br-share] file share unsupported — downloading card');
      }
      downloadShareCard(blob, url);
    }
    function shareBattleScore() {
      console.log('[br-share] Share Result tapped');
      if (!battleStats) { console.log('[br-share] no battle stats yet — ignoring tap'); return; }
      hideBrLinkBox();
      var text = battleShareText();
      var url = location.href;
      renderShareCard(function (blob) {
        if (blob) {
          shareCardImage(blob, text, url);
        } else {
          console.log('[br-share] no card image — falling back to the text/link chain');
          shareBattleTextLink();
        }
      });
    }
    /* the original chain, kept whole as the fallback for when
       the card image cannot be rendered at all: native text/link
       share sheet, clipboard copy and manual link box behind it */
    function shareBattleTextLink() {
      console.log('[br-share] Share Result tapped');
      if (!battleStats) { console.log('[br-share] no battle stats yet — ignoring tap'); return; }
      hideBrLinkBox();
      var text = battleShareText();
      var url = location.href;
      if (navigator.share) {
        var p = null;
        try {
          p = navigator.share({ title: 'Halloween Tower Defense', text: text, url: url });
        } catch (e) {
          /* some webviews throw synchronously instead of rejecting */
          console.log('[br-share] navigator.share threw synchronously', e);
        }
        if (p && typeof p.then === 'function') {
          p.then(function () {
            console.log('[br-share] native share sheet completed');
          }, function (err) {
            if (err && err.name === 'AbortError') {
              /* the player opened the sheet and closed it — that
                 IS a response, not a failure: don't copy behind
                 their back */
              console.log('[br-share] share sheet dismissed by player');
              return;
            }
            console.log('[br-share] native share failed — falling back to copy', err);
            copyBattleLink(url);
          });
          return;
        }
        console.log('[br-share] navigator.share returned nothing usable — falling back to copy');
      } else {
        console.log('[br-share] navigator.share unavailable — falling back to copy');
      }
      copyBattleLink(url);
    }

    /* ---------------- explosion ---------------- */
    function explodeHouse() {
      state.phase = 'exploded';
      state.explodeTimer = 0;
      state.flash = reduceMotion ? 0.35 : 0.9;
      state.shake = reduceMotion ? 4 : 16;
      burstDebris();
      burstCandy(DOOR.x, 180, 130, 300);
      boomSound();
      // the kids won: swap the background music for the victory tune
      // and let the crowd cheer — a big burst now, then more waves of
      // cheering over the next few seconds (ticked in update())
      stopMusic();
      startWinMusic();
      cheerSound();
      state.cheerLeft = 6;
      state.cheerTimer = 0.55;
      addFloat(DOOR.x - 78, 158, 'YAY!', '#ff8fb5', 17);
      addFloat(DOOR.x + 74, 148, 'YAY!', '#4dc9ff', 15);
      addFloat(DOOR.x - 8, 134, 'Candy!', '#ffd23e', 16);
      state.kids.forEach(function (k) {
        if (k.mode === 'knock' || k.mode === 'toSlot') { k.mode = 'cheer'; k.bob = Math.random() * 6; }
      });
      document.getElementById('winBanner').classList.add('show');
      // freeze this run's numbers for the battle report, then let
      // the celebration breathe for a moment before it pops in
      // the run's top defender: whichever tower chased away the
      // most kids this run (its short name — "Franken", not
      // "Franken Tower" — is what the report card shows)
      var topTw = null;
      state.towers.forEach(function (tw) { if (!topTw || tw.kills > topTw.kills) topTw = tw; });
      battleStats = {
        waves: state.wave,
        endless: runMode === 'endless',
        kids: state.kills,
        combo: bestCombo,
        top: (topTw && topTw.kills > 0) ? TOWER_DEFS[topTw.kind].nm.replace(/ Tower$/, '') : '\u2014',
        topKind: (topTw && topTw.kills > 0) ? topTw.kind : null,
        bombs: bombsUsed,
        towers: state.towers.length,
        time: Math.floor(state.time)
      };
      setTimeout(function () { if (state.phase === 'exploded') showBattleReport(); }, 1200);
      syncHUD(true);
    }

    /* pumpkin bomb: bursts into a shower of candy, splash damage to
       every walking kid in the blast radius — kills feed tower progress
       exactly like tower hits do */
    function explodeBomb(x, y) {
      burstCandy(x, y - 6, 46, 250);
      for (var i = 0; i < 10; i++) {
        state.parts.push({
          type: 'puff', color: '#f5820d',
          x: x + (Math.random() - 0.5) * 40, y: y - 4 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 40,
          rot: 0, vr: 0, life: 0.5 + Math.random() * 0.3, t: 0, size: 7 + Math.random() * 8, bounce: 0
        });
      }
      addFloat(x, y - 52, 'BOOM!', '#ffb03a', 20);
      if (!reduceMotion) state.shake = Math.max(state.shake, 5);
      boomSound();
      noteSkillUsed('bomb');
      bombsUsed++;
      state.kids.forEach(function (k) {
        if (k.mode !== 'walk') return;
        if (Math.hypot(k.x - x, (k.y - 12) - y) > BOMB_RADIUS) return;
        k.hp -= armored(k, BOMB_DMG);
        k.slowTimer = 0.8;
        burstCandy(k.x, k.y - 14, 8, 70, k.y + 4);
        if (k.hp <= 0 && k.mode === 'walk') {
          k.mode = 'happy'; k.happyTimer = 0;
          state.kills++; noteComboKill();
          state.prog++;
          addFloat(k.x, k.y - 40, 'Progress +1', '#ffd23e', 14);
          happySound();
        }
      });
      syncHUD(true);
      checkUnlock();
    }

    /* a kid's defence shaves a % off every hit before it lands:
       only a wave-1 weakling shrugs off nothing — the share grows
       with the kind's tier AND with the wave it marches in, up to
       about a third of every piece of candy for the toughest
       late-wave kids */
    function armored(k, dmg) {
      var a = k.armor || 0;
      // slime Lv3 acid pool: armour fully corroded while the kid
      // stands in it — every hit lands at full strength
      if (k.armorZeroTimer > 0) return dmg;
      // slime goo melts half the kid's defence away while it lasts
      if (k.armorDownTimer > 0) a *= (1 - MELT_FRAC);
      return dmg * (1 - a);
    }

    /* ---------------- tower hit effects ----------------
       One shared damage path: any tower candy that drops a walking
       kid sends it home happy and feeds the tower-unlock progress,
       exactly like a plain hit always did. The one exception is the
       castle's own candy (hitKnocker): it may also hit a kid who is
       knocking on the door, and dropping one frees its crowd slot. */
    function damageKid(k, dmg, src, hitKnocker, isPoison) {
      if (!k) return;
      if (k.mode !== 'walk' && !(hitKnocker && isPlazaKnocker(k))) return;
      k.hp -= armored(k, dmg);
      if (k.hp <= 0 && (k.mode === 'walk' || k.mode === 'knock')) {
        if (k.slot) { k.slot.taken = null; k.slot = null; }
        k.overflow = false;
        k.mode = 'happy'; k.happyTimer = 0;
        state.kills++; noteComboKill();
        state.prog++;
        addFloat(k.x, k.y - 40, 'Progress +1', '#ffd23e', 14);
        happySound();
        // the tower whose candy landed the chase-away banks the
        // kill toward the defeat report's Top Defender only —
        // levels come from the shared points pool now (see
        // checkUnlock), never from one tower's own kills
        if (src) src.kills++;
        // witch Lv3 plague: a kid that DIES from the poison
        // bursts, spraying poison damage at the kids around it —
        // and a kid the burst kills bursts in turn, up to the
        // chain cap (plagueDepth is the live recursion guard)
        if (isPoison && src && src.kind === 'witch' && src.level === 3 && plagueDepth < PLAGUE_CHAIN) {
          plagueDepth++;
          plagueBurst(k, src);
          plagueDepth--;
        }
        syncHUD(true);
        checkUnlock();
      }
    }
    /* witch Lv3 plague burst: the dead kid's poison pops — a
       purple blast that stings every walking kid nearby and can
       chain through plagueBurst's own damageKid calls (each of
       those passes isPoison, so a burst kill bursts again) */
    function plagueBurst(deadK, src) {
      var bx = deadK.x, by = deadK.y - 14;
      burstCandy(bx, by, 10, 80, by + 4);
      state.rings.push({ x: bx, y: by, r: 8, maxR: PLAGUE_R, t: 0, life: 0.4, color: '157,92,255' });
      addFloat(bx, by - 30, 'PLAGUE!', '#b78cff', 14);
      state.kids.forEach(function (o) {
        if (o === deadK || o.mode !== 'walk') return;
        if (Math.hypot(o.x - bx, (o.y - 12) - by) > PLAGUE_R) return;
        damageKid(o, PLAGUE_DMG, src, false, true);
      });
    }
    /* franken bolt: the lightning jumps from the kid it hit to the two
       nearest kids beside them (weaker), and everyone it touches is
       stunned — frozen stiff for a moment */
    function chainZap(fromK, dmg, chainN, stunT, src) {
      if (!fromK) return;
      var others = [];
      state.kids.forEach(function (k) {
        if (k === fromK || k.mode !== 'walk') return;
        var d = Math.hypot(k.x - fromK.x, (k.y - 14) - (fromK.y - 14));
        if (d <= CHAIN_RANGE) others.push({ k: k, d: d });
      });
      others.sort(function (a, b) { return a.d - b.d; });
      var pts = [{ x: fromK.x, y: fromK.y - 14 }];
      others.slice(0, chainN).forEach(function (o) {
        pts.push({ x: o.k.x, y: o.k.y - 14 });
        o.k.stunTimer = Math.max(o.k.stunTimer, stunT);
        burstCandy(o.k.x, o.k.y - 14, 6, 55, o.k.y + 4);
        damageKid(o.k, dmg * 0.65, src);
      });
      if (pts.length > 1) state.zaps.push({ pts: pts, t: 0, life: 0.18 });
      if (fromK.mode === 'walk') fromK.stunTimer = Math.max(fromK.stunTimer, stunT);
    }
    /* what happens when one tower candy lands on its kid, per tower */
    function towerHit(p) {
      var k = p.tx;
      if (!k) return;
      if (k.mode !== 'walk' && !(p.houseShot && isPlazaKnocker(k))) return;
      var src = p.src || null;
      if (p.kind === 'bolt') {
        damageKid(k, p.dmg, src);
        chainZap(k, p.dmg, p.chain || 2, p.stun || STUN_TIME, src);
        addFloat(k.x, k.y - 46, 'ZAP!', '#ffe14d', 13);
      } else if (p.kind === 'potion') {
        // the bottle smashes at the kid's feet: a poison mist lingers —
        // its radius, bite and slow all carry the witch's level
        state.poisons.push({ x: k.x, y: k.y - 4, r: p.poisR || POISON_R, t: 0, dur: POISON_DUR, dps: p.poisDps || POISON_DPS, slowF: p.slowF || 0.72, src: src });
        for (var pz = 0; pz < 6; pz++) {
          state.parts.push({
            type: 'puff', color: '#9d5cff',
            x: k.x + (Math.random() - 0.5) * 30, y: k.y - 6 + (Math.random() - 0.5) * 12,
            vx: (Math.random() - 0.5) * 30, vy: -16 - Math.random() * 20,
            rot: 0, vr: 0, life: 0.5 + Math.random() * 0.3, t: 0, size: 6 + Math.random() * 6, bounce: 0
          });
        }
        damageKid(k, p.dmg, src);
      } else if (p.kind === 'ball') {
        var crit = Math.random() < (p.critC != null ? p.critC : CRIT_CHANCE);
        damageKid(k, crit ? p.dmg * 2 : p.dmg, src);
        if (crit) addFloat(k.x, k.y - 46, 'CRIT!', '#ffb03a', 15);
        k.slowTimer = Math.max(k.slowTimer, 0.2);
      } else if (p.kind === 'web') {
        // spider web: the spray bursts over the kids around the
        // landing point — everyone caught is wrapped up and crawls
        // at a fraction of their pace for a few seconds. The hit
        // itself barely stings: this tower controls, not kills
        damageKid(k, p.dmg, src);
        state.webs.push({ x: k.x, y: k.y - 2, r: p.webR || WEB_SPLASH[0], t: 0, life: p.webT || WEB_TIME[0] });
        state.kids.forEach(function (o) {
          if (o.mode !== 'walk') return;
          if (Math.hypot(o.x - k.x, (o.y - 12) - (k.y - 12)) > (p.webR || WEB_SPLASH[0])) return;
          o.webTimer = Math.max(o.webTimer, p.webT || WEB_TIME[0]);
          o.webF = p.webF || WEB_SLOW[0];
        });
        addFloat(k.x, k.y - 46, 'WEBBED!', '#d9d2f0', 13);
      } else if (p.kind === 'goo') {
        // slime goo: TWO things land at once — a small direct sting
        // (the ball's own damage: the kid's HP drops a little on
        // every hit, no melt needed), then the kid's armour is
        // half melted for a few seconds, so every later hit from
        // ANY tower bites deeper (see armored()). AND the ball
        // splats where it lands: a sticky green puddle stays on
        // the road for ~4s — kids wading through it crawl and
        // take a light steady nibble (far weaker than witch mist;
        // ticked in update(), slowed in the kid logic, drawn in
        // draw()). The melt itself stays a direct-hit-only effect:
        // merely walking through the puddle never melts armour
        damageKid(k, p.dmg, src);
        state.slimePuddles.push({
          x: k.x, y: k.y - 2, r: p.puddleR || SLIME_PUDDLE_R[0],
          t: 0, dur: p.puddleDur || SLIME_PUDDLE_DUR,
          dps: p.puddleDps || SLIME_PUDDLE_DPS, slowF: p.puddleSlow || SLIME_PUDDLE_SLOW[0],
          src: src, seed: Math.random() * 10, acid: p.acid || false
        });
        for (var gz = 0; gz < 5; gz++) {
          state.parts.push({
            type: 'puff', color: '#7ed957',
            x: k.x + (Math.random() - 0.5) * 26, y: k.y - 4 + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 36, vy: -12 - Math.random() * 16,
            rot: 0, vr: 0, life: 0.35 + Math.random() * 0.25, t: 0, size: 4 + Math.random() * 5, bounce: 0
          });
        }
        if (k.mode === 'walk') {
          k.armorDownTimer = Math.max(k.armorDownTimer, p.meltT || MELT_DUR[0]);
          addFloat(k.x, k.y - 46, 'ARMOR MELTED!', '#9be26d', 12.5);
        }
      } else {
        // castle candy cannon and any plain candy — the castle's own
        // shots are the only ones allowed to hit a knocking kid
        k.slowTimer = 0.55;
        damageKid(k, p.dmg, src, !!p.houseShot);
      }
      burstCandy(k.x, k.y - 14, 6, 60, k.y + 4);
    }

    /* ---------------- the six rotating towers fire their own way ----
       The original six all throw a homing candy (handled in the main
       fire loop); the rotating recruits each break that mould, so
       they get their own firing routine here. The shared maths is
       identical to the old towers: damage x1.6 a level, interval
       -15% a level, range +10% a level — and a werewolf howl nearby
       divides the interval by 1.3 while the buff lasts */
    function fireRate(tw, lvI) {
      return tw.rate * Math.pow(0.85, lvI) / (tw.buffT > 0 ? HOWL_BUFF : 1);
    }
    function fireSpecial(tw, lvI, range) {
      var dmg = tw.dmg * LVL_DMG[lvI];
      function findKid(nearest) {
        var pick = null, pickV = nearest ? Infinity : -1;
        state.kids.forEach(function (k) {
          if (k.mode !== 'walk') return;
          var d = Math.hypot(k.x - tw.x, k.y - tw.y);
          if (d >= range) return;
          var v = nearest ? d : k.dist;
          if (nearest ? v < pickV : v > pickV) { pickV = v; pick = k; }
        });
        return pick;
      }
      if (tw.proj === 'howl') {
        // werewolf: no target, no damage — the howl speeds up every
        // OTHER tower standing within its radius. With nobody in
        // earshot it just waits a beat and listens again
        var allies = [];
        state.towers.forEach(function (o) {
          if (o !== tw && Math.hypot(o.x - tw.x, o.y - tw.y) <= range) allies.push(o);
        });
        if (!allies.length) { tw.cd = 0.8; return; }
        tw.cd = fireRate(tw, lvI);
        tw.throwT = THROW_DUR;
        allies.forEach(function (o) { o.buffT = Math.max(o.buffT || 0, HOWL_DUR[lvI]); });
        state.rings.push({ x: tw.x, y: tw.y - 12, r: 10, maxR: range, t: 0, life: 0.55, color: '255,190,90' });
        addFloat(tw.x, tw.y - 76, 'AWOOO!', '#ffd9a0', 15);
        popSound();
        return;
      }
      if (tw.proj === 'sonic') {
        // bat: a screech ring bursts out of the bat itself — every
        // walking kid inside the ring takes the hit at once
        var anyIn = false;
        state.kids.forEach(function (k) {
          if (k.mode === 'walk' && Math.hypot(k.x - tw.x, (k.y - 12) - (tw.y - 12)) <= range) anyIn = true;
        });
        if (!anyIn) { tw.cd = 0.25; return; }
        tw.cd = fireRate(tw, lvI);
        tw.throwT = THROW_DUR;
        if (tw.level === 3) {
          // Lv3 sonic storm: THREE rings roll out one after
          // another, each one hurting and stunning every kid its
          // edge passes (the damage ticks in the rings loop)
          for (var sri = 0; sri < 3; sri++) {
            state.rings.push({ x: tw.x, y: tw.y - 14, r: 8, maxR: range, t: 0, life: 0.45, color: '120,220,255', delay: sri * 0.22, dmg: dmg, src: tw, hit: {}, stun: 1 });
          }
          addFloat(tw.x, tw.y - 66, 'SONIC STORM!', '#aee6ff', 13);
        } else {
          state.rings.push({ x: tw.x, y: tw.y - 14, r: 8, maxR: range, t: 0, life: 0.45, color: '120,220,255' });
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk') return;
            if (Math.hypot(k.x - tw.x, (k.y - 12) - (tw.y - 12)) > range) return;
            burstCandy(k.x, k.y - 14, 5, 55, k.y + 4);
            damageKid(k, dmg, tw);
          });
          addFloat(tw.x, tw.y - 66, 'SCREECH!', '#aee6ff', 13);
        }
        popSound();
        return;
      }
      // spider sprays the NEAREST kid; the rest aim at the leader
      var tgt = findKid(tw.proj === 'web');
      if (!tgt) { tw.cd = 0.2; return; }
      tw.cd = fireRate(tw, lvI);
      tw.throwT = THROW_DUR;
      if (tw.proj === 'web') {
        if (tw.level === 3) {
          // Lv3 net: one big net laid flat on the road — every
          // kid that steps into it is snared and dragged back
          // (the snare and drag tick in the update/kid loops)
          state.netZones.push({ x: tgt.x, y: tgt.y - 2, r: NET_R, t: 0, dur: NET_DUR, slowF: NET_SLOW, src: tw, seed: Math.random() });
          addFloat(tgt.x, tgt.y - 40, 'NET!', '#cfe8ff', 13);
        } else {
          state.projs.push({
            x: tw.x, y: tw.y - 26, tx: tgt, kind: 'web', color: '#e8e4f5',
            speed: 300, dmg: dmg, t: 0, src: tw, psize: LVL_PROJ[lvI],
            webT: WEB_TIME[lvI], webF: WEB_SLOW[lvI], webR: WEB_SPLASH[lvI]
          });
        }
      } else if (tw.proj === 'goo') {
        // Lv3 acid pool: bigger, meaner, stickier — and it eats
        // a kid's armour away entirely while they stand in it
        state.projs.push({
          x: tw.x, y: tw.y - 26, tx: tgt, kind: 'goo', color: '#7ee06f',
          speed: 250, dmg: dmg, t: 0, src: tw, psize: LVL_PROJ[lvI],
          meltT: MELT_DUR[lvI],
          puddleR: tw.level === 3 ? ACID_R : SLIME_PUDDLE_R[lvI],
          puddleDps: tw.level === 3 ? ACID_DPS : SLIME_PUDDLE_DPS * [1, 1.4, 1.9][lvI],
          puddleSlow: tw.level === 3 ? ACID_SLOW : SLIME_PUDDLE_SLOW[lvI],
          puddleDur: SLIME_PUDDLE_DUR, acid: tw.level === 3
        });
      } else if (tw.proj === 'crow') {
        if (tw.level === 3) {
          // Lv3 murder of crows: FIVE of them, each riding a
          // different kid — the pecking itself ticks in update()
          var crowTargets = [];
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk') return;
            var d = Math.hypot(k.x - tw.x, k.y - tw.y);
            if (d < range) crowTargets.push(k);
          });
          crowTargets.sort(function (a, b) { return b.dist - a.dist; });
          crowTargets.slice(0, 5).forEach(function (ck, ci) {
            state.crows.push({ tx: ck, src: tw, dps: dmg * 0.55, t: 0, dur: CROW_DUR[lvI], x: tw.x + (ci - 2) * 8, y: tw.y - 36 - (ci % 2) * 6, peck: 0 });
          });
          addFloat(tw.x, tw.y - 66, 'MURDER OF CROWS!', '#d9c8ff', 13);
        } else {
          // the crow flies off the scarecrow's arm and rides its kid,
          // pecking steadily — the pecking itself ticks in update()
          state.crows.push({ tx: tgt, src: tw, dps: dmg * 0.55, t: 0, dur: CROW_DUR[lvI], x: tw.x, y: tw.y - 36, peck: 0 });
        }
      } else if (tw.proj === 'arm') {
        // the zombie tears off its own forearm and hurls it in a
        // straight line: it bites every kid it passes through, then
        // crawls back and bites them again on the return leg (the
        // flight itself ticks in the projectile loop)
        var armTargets = [tgt];
        if (tw.level === 3) {
          // Lv3: BOTH arms fly at once, at the two furthest kids
          var armAlt = null, armAltD = -1;
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk' || k === tgt) return;
            var d = Math.hypot(k.x - tw.x, k.y - tw.y);
            if (d < range && k.dist > armAltD) { armAlt = k; armAltD = k.dist; }
          });
          if (armAlt) armTargets.push(armAlt);
        }
        armTargets.forEach(function (at) {
          var mx = tw.x, my = tw.y - 26;
          var ang = Math.atan2((at.y - 14) - my, at.x - mx);
          tw.armGone = true;
          tw.armsOut = (tw.armsOut || 0) + 1;
          state.projs.push({
            kind: 'arm', x: mx, y: my, vx: Math.cos(ang), vy: Math.sin(ang), ang: ang,
            speed: 330, dmg: dmg, t: 0, traveled: 0, maxTravel: ARM_LEN * (1 + 0.1 * lvI),
            phase: 'out', hitOut: {}, hitBack: {}, src: tw, psize: LVL_PROJ[lvI]
          });
        });
      }
      popSound();
    }

    /* ---------------- update ---------------- */
    var SPEED = 1, playing = false;
    /* per-game tower rotation: the choice panel always offers six
       cards, but WHICH six rotates every game. Game 1 fields the
       original six (with the Spider holding the Black Cat's old
       seat); game 2 swaps Ghost/Mummy/Skeleton for
       Black Cat/Bat/Scarecrow; game 3 brings the original bench
       back and swaps Franken/Witch/Spider for Zombie/Werewolf/Slime.
       From game 4 on there is no more two-line-up alternation: each
       game is derived from the PREVIOUS game's six by swapping
       exactly TWO towers — the two longest-serving members step
       down (ties broken by the fixed pool order below) and the two
       longest-benched towers come in, taken in that same fixed
       pool order. Because the outgoing pair is always the most
       overdue and the incoming pair always the longest waiting,
       all twelve towers keep cycling through the line-up and none
       can sit on the bench (or hold a seat) forever; the whole
       sequence is a pure function of gameNo, so the same game
       number always fields the same six. gameNo climbs ONLY when
       a won game is followed by the victory screen's PLAY AGAIN
       button: the top Restart button replays the CURRENT game, so
       its six cards stay exactly the same. Panel title, the free
       first tower, the kill thresholds and the level rules never
       change — only the six faces on the cards do */
    var gameNo = 1;
    var ROSTER_ORIG = ['franken', 'ghost', 'witch', 'mummy', 'spider', 'skeleton'];
    var ROSTER_B = ['franken', 'witch', 'spider', 'cat', 'bat', 'scarecrow'];
    var ROSTER_C = ['ghost', 'mummy', 'skeleton', 'zombie', 'werewolf', 'slime'];
    /* all twelve towers in one fixed order (debut order: the
       original six, then game 2's recruits, then game 3's) — the
       game-4+ rotation below takes its incoming pairs and breaks
       its ties strictly in this order */
    var ROSTER_POOL = ['franken', 'ghost', 'witch', 'mummy', 'spider', 'skeleton', 'cat', 'bat', 'scarecrow', 'zombie', 'werewolf', 'slime'];
    function rosterKinds() {
      if (gameNo <= 1) return ROSTER_ORIG;
      if (gameNo === 2) return ROSTER_B;
      if (gameNo === 3) return ROSTER_C;
      // game 4+: replay the deterministic swap chain from game 3's
      // line-up, one two-tower swap per game, up to this game
      var cur = ROSTER_C.slice();
      var tenure = {}; // consecutive games served in the line-up
      var benched = {}; // consecutive games spent out of it
      ROSTER_POOL.forEach(function (k) {
        tenure[k] = cur.indexOf(k) >= 0 ? 1 : 0;
        benched[k] = cur.indexOf(k) >= 0 ? 0 : 1;
      });
      for (var g = 4; g <= gameNo; g++) {
        // who comes in: the two longest-benched, pool order on ties
        var bench = ROSTER_POOL.filter(function (k) { return cur.indexOf(k) < 0; });
        bench.sort(function (a, b) {
          return (benched[b] - benched[a]) || (ROSTER_POOL.indexOf(a) - ROSTER_POOL.indexOf(b));
        });
        var incoming = bench.slice(0, 2);
        // who steps down: the two longest-serving, pool order on ties
        var serving = cur.slice();
        serving.sort(function (a, b) {
          return (tenure[b] - tenure[a]) || (ROSTER_POOL.indexOf(a) - ROSTER_POOL.indexOf(b));
        });
        var outgoing = serving.slice(0, 2);
        // the newcomers take the departing towers' card slots
        outgoing.forEach(function (k, i) { cur[cur.indexOf(k)] = incoming[i]; });
        ROSTER_POOL.forEach(function (k) {
          if (cur.indexOf(k) >= 0) { tenure[k]++; benched[k] = 0; }
          else { benched[k]++; tenure[k] = 0; }
        });
      }
      return cur;
    }
    /* the shared points pool: every kid chased away adds 1 point
       (state.prog). The FIRST tower is free — the choice panel
       pops the moment the game starts, before any kid needs to
       be driven off. After that, every PICK_EVERY points banks
       one PICK (extras stack: a second 15 while one waits shows
       x2 on the button, so nothing is ever lost); the pick itself
       waits on the gold PICK! button in the top bar until the
       player taps it — no auto-popup mid-wave any more. Banking
       needs no empty gravestone, because a pick can also be spent
       levelling a tower that is already standing. */
    function checkUnlock() {
      if (state.phase !== 'playing') return;
      if (!state.freePickDone) {
        if (state.choosing || state.pendingKind) return;
        state.freePickDone = true;
        openChoice('free');
        return;
      }
      var banked = false;
      while (state.prog >= PICK_EVERY) {
        state.prog -= PICK_EVERY;
        state.picks++;
        banked = true;
      }
      if (banked) {
        levelUpSound();
        addFloat(225, 90, 'PICK! ×' + state.picks, '#ffd23e', 16);
        // first banked pick of the run: spell out the new flow
        // once — the shaking graves and badges do the shouting
        // after that
        if (!state.pickHintShown) {
          state.pickHintShown = true;
          addFloat(225, 114, 'Tap a tower to upgrade it, or a shaking grave to place a new one!', '#ffe9a8', 13);
        }
        updatePickBtn();
        syncHUD(true);
      }
    }
    /* pick cues: while a pick is banked the field itself shouts
       about it — empty graves shake wildly and every sub-max
       tower wears a gold LV UP! badge. The cue only runs while
       the game is actually playing (not paused, no popup up, no
       card in flight — the in-flight chevrons take over then). */
    function pickCueActive() {
      return started && playing && state.phase === 'playing' && !state.choosing && !state.pendingKind && state.picks > 0;
    }
    function hasUpgradeableTower() {
      for (var i = 0; i < state.towers.length; i++) if (state.towers[i].level < 3) return true;
      return false;
    }
    function hasEmptySite() {
      for (var i = 0; i < SITES.length; i++) if (SITES[i].phase === 'empty') return true;
      return false;
    }
    /* badge geometry, shared by the draw code and the tap
       handler: the badge centre sits 17px above the level stars,
       which ride on the tower's drawn top at steady-state size
       (the grow-animation swell is ignored here — the generous
       hit padding below covers the few pixels it moves). */
    function badgeCenter(tw) {
      var mTop = MONSTER_TOP[tw.kind] ? MONSTER_TOP[tw.kind][tw.level - 1] : -46;
      var mScale = 1.3 * LVL_SCALE[tw.level - 1];
      return { x: tw.x, y: tw.y + mTop * mScale - 9 - 17 };
    }
    /* open the six-card monster picker. 'free' is the free first
       tower at game start (no pick spent, cannot be skipped);
       'pick' spends one banked pick — the player may also close
       it with Later and keep the pick for another moment.
       'place' is the tap-a-shaking-grave shortcut: the picked
       card builds on that grave at once, no second tap. */
    function openChoice(mode) {
      state.pickMode = mode;
      state.choosing = true;
      state.bombArmed = false;
      state.rainArmed = false;
      var ch = document.getElementById('towerChoice');
      if (ch) { ch.classList.add('show'); ch.setAttribute('aria-hidden', 'false'); }
      var ct = document.getElementById('choiceTitle');
      if (ct) ct.textContent = mode === 'free' ? 'Choose Your Defense Monster' : 'Pick a Monster!';
      var cs = document.getElementById('choiceSub');
      if (cs) {
        cs.style.display = (mode === 'pick' || mode === 'place') ? '' : 'none';
        if (mode === 'place') cs.textContent = 'Tap a card — it builds on the shaking grave right away!';
        else if (mode === 'pick') {
          // a banked pick with nothing to spend it on: say so
          // plainly instead of letting the player guess — the
          // pick stays banked, closing keeps it
          cs.textContent = (!hasUpgradeableTower() && !hasEmptySite())
            ? 'Nothing to upgrade or place right now — close this and keep your pick for later!'
            : 'Tap a card, then tap one of that monster on the field to upgrade it — or a gravestone to place another!';
        }
      }
      var cb = document.getElementById('btnChoiceClose');
      if (cb) cb.style.display = (mode === 'pick' || mode === 'place') ? '' : 'none';
      happySound();
      syncHUD(true);
    }
    function update(dt) {
      state.time += dt;
      if (state.choosing) return; // frozen while a popup is up
      if (state.houseFlash > 0) state.houseFlash = Math.max(0, state.houseFlash - dt);
      // chimney smoke
      state.smokeTimer -= dt;
      if (state.phase !== 'exploded' && state.smokeTimer <= 0) {
        state.smokeTimer = 0.55;
        state.smoke.push({ x: 259, y: 98, r: 5, t: 0, life: 2.6 });
      }
      state.smoke = state.smoke.filter(function (s) { s.t += dt; s.y -= 13 * dt; s.x += 5 * dt; s.r += 5 * dt; return s.t < s.life; });

      // build animations: gravestone topples, then the monster rises
      SITES.forEach(function (site) {
        if (site.phase === 'falling') {
          site.anim += dt;
          if (site.anim >= FALL_DUR) {
            site.phase = 'rising'; site.anim = 0;
            knockSound(4);
            for (var gi = 0; gi < 7; gi++) {
              state.parts.push({
                type: 'puff', color: '#9a8ab8',
                x: site.x + (site.x > 225 ? -1 : 1) * 16 + (Math.random() - 0.5) * 18, y: site.y + 13,
                vx: (Math.random() - 0.5) * 38, vy: -14 - Math.random() * 22,
                rot: 0, vr: 0, life: 0.7 + Math.random() * 0.4, t: 0, size: 6 + Math.random() * 7, bounce: 0
              });
            }
          }
        } else if (site.phase === 'rising') {
          site.anim += dt;
          if (Math.random() < dt * 16) {
            state.parts.push({
              type: 'puff', color: '#7a5230',
              x: site.x + (Math.random() - 0.5) * 30, y: site.y + 16,
              vx: (Math.random() - 0.5) * 46, vy: -24 - Math.random() * 26,
              rot: 0, vr: 0, life: 0.55 + Math.random() * 0.3, t: 0, size: 4 + Math.random() * 5, bounce: 0
            });
          }
          if (site.anim >= RISE_DUR) {
            site.phase = 'built'; site.anim = 0;
            var def = TOWER_DEFS[site.kind];
            var tw = { x: site.x, y: site.y, kind: site.kind, range: def.range, rate: def.rate, dmg: def.dmg, proj: def.proj, cd: 0.35, throwT: 0, level: 1, kills: 0, growT: -1, growFrom: LVL_SCALE[0], flashT: 0, buffT: 0, armGone: false, armsOut: 0, leap: null, leapCd: 1.6, pounce: null, pounceCd: 3 };
            site.tower = tw;
            state.towers.push(tw);
            popSound();
            addFloat(site.x, site.y - 54, def.nm + '!', '#ffd23e', 16);
            syncHUD(true);
            checkUnlock(); // progress may have filled while this tower rose
          }
        }
      });

      // empty-gravestone shivers (see SHAKE_DUR above): advance each
      // empty stone's own random timer — but only while the game is
      // actually running, so a paused game never shakes (update()
      // is not even called while paused, and the popup freeze above
      // returns before this point). A stone that stops being empty
      // (built on) has its shiver cancelled on the spot
      if (!reduceMotion && playing && state.phase === 'playing') {
        if (shakeGap > 0) shakeGap -= dt;
        var anyShaking = false, shakeStarted = false, si;
        for (si = 0; si < SITES.length; si++) {
          if (SITES[si].phase === 'empty' && SITES[si].shakeAge >= 0) { anyShaking = true; break; }
        }
        SITES.forEach(function (site) {
          if (site.phase !== 'empty') { site.shakeAge = -1; return; }
          if (site.shakeAge >= 0) {
            site.shakeAge += dt;
            if (site.shakeAge >= SHAKE_DUR) {
              site.shakeAge = -1;
              site.shakeIn = shakeWait(false, 0); // next wait: a fresh random 4–11s
              anyShaking = false;
            }
            return;
          }
          site.shakeIn -= dt;
          if (site.shakeIn > 0) return;
          if (!anyShaking && !shakeStarted && shakeGap <= 0) {
            site.shakeAge = 0;
            shakeStarted = true;
            anyShaking = true;
            // shared gap after this start (on top of the shake
            // itself), randomised so starts never bunch up
            shakeGap = 1.2 + Math.random() * 0.9;
          } else {
            // another stone is shaking (or too close behind it):
            // wait a short random moment, then check again
            site.shakeIn = 0.25 + Math.random() * 0.6;
          }
        });
      }

      if (state.phase === 'exploded') {
        state.explodeTimer += dt;
        if (state.explodeTimer > 1.1 && Math.random() < dt * 2.2) burstCandy(DOOR.x + (Math.random() - 0.5) * 90, 265, 3, 130);
        // waves of kids' cheering over the candy explosion
        if (state.cheerLeft > 0) {
          state.cheerLeft -= dt;
          state.cheerTimer -= dt;
          if (state.cheerTimer <= 0) {
            cheerSound();
            state.cheerTimer = 0.55 + Math.random() * 0.55;
            var ck = state.kids[Math.floor(Math.random() * state.kids.length)];
            if (ck && ck.mode === 'cheer') addFloat(ck.x, ck.y - 48, 'YAY!', '#ffe9a8', 14);
          }
        }
      }

      // castle-saved candy fireworks: bursts keep going off around
      // the group photo for as long as the victory screen is up
      if (state.phase === 'defended' && !reduceMotion) {
        state.fxTimer -= dt;
        if (state.fxTimer <= 0) { burstWinFx(); state.fxTimer = 0.9; }
      }
      // firework candies in flight: same gravity as the game's
      // candy particles, no floor — they fall and fade out
      for (var fxi = state.fxParts.length - 1; fxi >= 0; fxi--) {
        var fq = state.fxParts[fxi];
        fq.t += dt;
        fq.vy += 620 * dt;
        fq.x += fq.vx * dt; fq.y += fq.vy * dt;
        fq.rot += fq.vr * dt;
        if (fq.t > fq.life) state.fxParts.splice(fxi, 1);
      }

      if (playing && state.phase === 'playing') {
        // kids arrive in 20 announced waves of growing size
        if (state.waveState === 'spawning') {
          if (!state.waveAnnounced) {
            state.waveAnnounced = true;
            addFloat(225, 118, (runMode === 'challenge' && state.wave >= TOTAL_WAVES) ? 'FINAL WAVE!' : 'WAVE ' + state.wave + '!', '#ffd23e', 25);
          }
          state.spawnTimer -= dt;
          if (state.spawnTimer <= 0 && state.waveLeft > 0) {
            state.spawnTimer = waveSpawnGap(state.wave) * (0.9 + Math.random() * 0.2);
            spawnKid();
            state.waveLeft--;
            if (state.waveLeft <= 0) {
              // challenge ends at wave 10 (waveState 'done' leads
              // to the victory screen); endless just takes the
              // usual breather and marches on to the next wave
              if (runMode === 'challenge' && state.wave >= TOTAL_WAVES) state.waveState = 'done';
              else { state.waveState = 'break'; state.breakTimer = WAVE_BREAK; }
            }
          }
        } else if (state.waveState === 'break') {
          state.breakTimer -= dt;
          if (state.breakTimer <= 0) {
            state.wave++;
            state.waveLeft = waveCount(state.wave);
            state.waveState = 'spawning';
            state.waveAnnounced = false;
            state.spawnTimer = 0.3;
            syncHUD(true);
          }
        }
        // castle candy cannon (one shot every 0.8s) with an explicit
        // STAND-DOWN state. Every frame it first asks: is anyone
        // KNOCKING *and* standing inside the round plaza in front of
        // the door right now (isPlazaKnocker — the single, strict
        // target rule)? Kids still marching on the road, kids
        // crossing the plaza toward their slot (toSlot), and anyone
        // outside the plaza ellipse never count.
        // — If NOBODY qualifies, the cannon stands down completely:
        // it does not fire, any castle candy still in the air is
        // removed on the spot (so no castle shot can ever drift
        // onward and land on a road kid after the plaza clears),
        // the cooldown refills to a full 0.8s, and the barrel eases
        // back to pointing straight down at rest — the castle is
        // visibly idle. It stays stood down until the next kid
        // steps onto the plaza and starts knocking.
        // — If somebody qualifies, it works the weakest plaza
        // knocker down first, one shot every 0.8s, so the doorstep
        // crowd thins out one kid at a time.
        state.houseCd -= dt;
        var hBest = null;
        state.kids.forEach(function (k) {
          if (!isPlazaKnocker(k)) return;
          if (!hBest || k.hp < hBest.hp) hBest = k;
        });
        if (!hBest) {
          state.houseHold = true;
          state.houseCd = HOUSE_CANNON.rate;
          for (var hpi = state.projs.length - 1; hpi >= 0; hpi--) {
            if (state.projs[hpi].houseShot) state.projs.splice(hpi, 1);
          }
          var restA = Math.PI / 2, dAng = restA - state.houseAngle;
          while (dAng > Math.PI) dAng -= Math.PI * 2;
          while (dAng < -Math.PI) dAng += Math.PI * 2;
          state.houseAngle += dAng * Math.min(1, dt * 5);
        } else {
          state.houseHold = false;
          if (state.houseCd <= 0) {
            state.houseCd = HOUSE_CANNON.rate;
            state.houseFlash = 0.14;
            state.houseAngle = Math.atan2((hBest.y - 14) - HOUSE_CANNON.y, hBest.x - HOUSE_CANNON.x);
            state.projs.push({
              x: HOUSE_CANNON.x, y: HOUSE_CANNON.y, tx: hBest, kind: 'corn', houseShot: true,
              color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
              speed: 300, dmg: HOUSE_CANNON.dmg, t: 0, trail: []
            });
            popSound();
          }
        }
        // pumpkin bomb skill: cooldown ticks down, armed pumpkins fall
        if (state.bombCd > 0) state.bombCd = Math.max(0, state.bombCd - dt);
        for (var bi = state.bombs.length - 1; bi >= 0; bi--) {
          var bb = state.bombs[bi];
          bb.t += dt / BOMB_FALL;
          if (bb.t >= 1) { state.bombs.splice(bi, 1); explodeBomb(bb.x, bb.y); }
        }
        // ghost scream skill: cooldown ticks; the summoned ghost drifts
        // from the door back toward the entrance, scaring every walking
        // kid it touches into running back down the road
        if (state.screamCd > 0) state.screamCd = Math.max(0, state.screamCd - dt);
        for (var ghi = state.ghosts.length - 1; ghi >= 0; ghi--) {
          var gh = state.ghosts[ghi];
          gh.dist -= GHOST_SPEED * dt;
          if (gh.dist <= 0) { state.ghosts.splice(ghi, 1); continue; }
          var gp = pointAt(gh.dist);
          gh.x = gp.x; gh.y = gp.y;
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk' || gh.scared[k.id]) return;
            if (Math.hypot(k.x - gh.x, (k.y - 12) - gh.y) > 52) return;
            gh.scared[k.id] = true;
            k.fleeTimer = FLEE_TIME;
            k.rainTime = 0;
            addFloat(k.x, k.y - 46, 'BOO!', '#c792ff', 17);
            burstCandy(k.x, k.y - 14, 5, 50, k.y + 4);
          });
        }
        // candy rain skill: zones tick down; the feeding itself happens
        // in the kid walk logic below (kids stop inside the rain)
        if (state.rainCd > 0) state.rainCd = Math.max(0, state.rainCd - dt);
        for (var rni = state.rains.length - 1; rni >= 0; rni--) {
          var rz2 = state.rains[rni];
          rz2.t += dt;
          if (Math.random() < dt * 14) {
            state.parts.push({
              type: 'candy', shape: Math.floor(Math.random() * 3),
              color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
              x: rz2.x + (Math.random() - 0.5) * rz2.r * 1.3, y: rz2.y + rz2.r * 0.55,
              vx: (Math.random() - 0.5) * 20, vy: -10,
              rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6,
              life: 0.5, t: 0, size: 4.5 + Math.random() * 3.5, bounce: 3
            });
          }
          if (rz2.t >= rz2.dur) state.rains.splice(rni, 1);
        }
        // per-tower level bookkeeping: badge age, the flash right
        // after an upgrade, and the grow-up animation (star sparkles
        // while the monster swells from its old size to its new one)
        state.towers.forEach(function (tw) {
          if (tw.buffT > 0) tw.buffT = Math.max(0, tw.buffT - dt); // werewolf howl speed-up ticking down
          if (tw.flashT > 0) tw.flashT = Math.max(0, tw.flashT - dt);
          if (tw.growT >= 0) {
            tw.growT += dt;
            if (Math.random() < dt * 22) {
              state.parts.push({
                type: 'star', color: '#ffd23e',
                x: tw.x + (Math.random() - 0.5) * 44, y: tw.y - 8 - Math.random() * 32,
                vx: (Math.random() - 0.5) * 16, vy: -34 - Math.random() * 26,
                rot: Math.random() * 3, vr: 2.2, life: 0.8, t: 0, size: 5 + Math.random() * 4, bounce: 0
              });
            }
            if (tw.growT >= 0.7) tw.growT = -1;
          }
        });
        // towers fire (only ones the player has built)
        state.towers.forEach(function (tw) {
          if (tw.throwT > 0) tw.throwT = Math.max(0, tw.throwT - dt);
          tw.cd = (tw.cd || 0) - dt;
          // a Lv3 black cat's pounce clock ticks on its own rhythm,
          // whether or not its paw balls are ready to fly
          if (tw.kind === 'cat' && tw.level === 3 && !tw.pounce) tw.pounceCd = (tw.pounceCd == null ? 3 : tw.pounceCd) - dt;
          // a Lv3 ghost's mini-ghost clock ticks the same way
          if (tw.kind === 'ghost' && tw.level === 3 && (tw.miniCd || 0) > 0) tw.miniCd -= dt;
          if (tw.cd > 0) return;
          // a werewolf out on its pounce cannot howl mid-maul: its
          // howl clock simply waits until it is back on its stone
          // (the howl rhythm itself is untouched)
          if (tw.leap) return;
          // a black cat out on its pounce cannot bat paw balls
          // mid-pin: its ball clock simply waits until it bounds home
          if (tw.pounce) return;
          // this tower's level scales everything it throws: damage
          // x1.6 a level, range +10% a level, interval -15% a level,
          // bullets x1.4 a level — plus its own special growth below
          var lvI = tw.level - 1;
          var range = tw.range * (1 + 0.1 * lvI);
          // the six rotating towers fire their own way entirely
          if (tw.proj === 'web' || tw.proj === 'sonic' || tw.proj === 'crow' ||
              tw.proj === 'arm' || tw.proj === 'howl' || tw.proj === 'goo') {
            fireSpecial(tw, lvI, range);
            return;
          }
          // black cat Lv3 pounce: every few seconds the cat bounds
          // onto the foremost kid in range and pins it down (the
          // pin itself ticks in the pounce loop below; the cat
          // keeps batting paw balls between pounces)
          if (tw.kind === 'cat' && tw.level === 3 && !tw.pounce && (tw.pounceCd || 0) <= 0) {
            var pk = null, pkD = -1;
            state.kids.forEach(function (k) {
              if (k.mode !== 'walk') return;
              var d = Math.hypot(k.x - tw.x, k.y - tw.y);
              if (d < range && k.dist > pkD) { pk = k; pkD = k.dist; }
            });
            if (pk) {
              tw.pounce = { k: pk, phase: 'out', t: 0, x: tw.x, y: tw.y - 26, sx: tw.x, sy: tw.y - 26, tx: pk.x, ty: pk.y - 14 };
              tw.pounceCd = POUNCE_CD;
              addFloat(tw.x, tw.y - 66, 'POUNCE!', '#ffb03a', 13);
              popSound();
            } else tw.pounceCd = 0.5;
          }
          var best = null, bestD = -1;
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk') return;
            var d = Math.hypot(k.x - tw.x, k.y - tw.y);
            if (d < range && k.dist > bestD) { best = k; bestD = k.dist; }
          });
          if (best) {
            tw.cd = fireRate(tw, lvI); // level trims the interval; a werewolf howl nearby trims it further
            tw.throwT = THROW_DUR; // monster plays its candy-throw motion
            var dmg = tw.dmg * LVL_DMG[lvI];
            if (tw.proj === 'vortex') {
              // mummy: a swirling sand vortex chases the furthest kid
              // in range — at Lv3 a second one blows out at another kid
              var vTargets = [best];
              if (tw.level === 3) {
                var vAlt = null, vAltD = -1;
                state.kids.forEach(function (k) {
                  if (k.mode !== 'walk' || k === best) return;
                  var vd = Math.hypot(k.x - tw.x, k.y - tw.y);
                  if (vd < range && k.dist > vAltD) { vAlt = k; vAltD = k.dist; }
                });
                if (vAlt) vTargets.push(vAlt);
              }
              // Lv3 sandstorm: a much bigger whirlwind that also
              // blows kids back down the road (see the kid loop)
              var isStorm = tw.level === 3;
              vTargets.forEach(function (vt) {
                state.vortexes.push({
                  x: tw.x, y: tw.y - 26, tx: vt, r: isStorm ? STORM_R : VORT_R[lvI],
                  dps: VORT_DPS[lvI], slowF: VORT_SLOW, t: 0,
                  life: VORT_LIFE[lvI], src: tw, seed: Math.random(), storm: isStorm
                });
              });
            } else if (tw.proj === 'pile') {
              // skeleton: lobs a heap of bones onto the road at the
              // furthest kid in range — at most two piles per tower,
              // so the field never gets cluttered
              var livePiles = 0;
              state.bonePiles.forEach(function (bp) { if (bp.src === tw) livePiles++; });
              // Lv3 bone wall: THREE piles in a row along the road
              // (40px apart, back from the furthest kid) — the
              // triple counts as one throw, at most six piles live
              var pileN = (tw.level === 3) ? Math.min(3, 6 - livePiles) : (livePiles < 2 ? 1 : 0);
              for (var pqi = 0; pqi < pileN; pqi++) {
                var pdist = Math.max(0, best.dist - pqi * 40);
                var ppt = pointAt(pdist);
                state.bonePiles.push({
                  x: ppt.x, y: ppt.y, dist: pdist,
                  bones: PILE_BONES[lvI], maxBones: PILE_BONES[lvI],
                  t: 0, dur: PILE_DUR, src: tw, seed: Math.random()
                });
              }
              if (pileN > 0) {
                var ppt0 = pointAt(best.dist);
                addFloat(ppt0.x, ppt0.y - 26, pileN > 1 ? 'BONE WALL!' : 'BONES!', '#f2f2f2', 13);
                burstCandy(ppt0.x, ppt0.y - 6, 5, 40, ppt0.y + 4);
              }
            } else if (tw.proj === 'lolli') {
              // ghost tower: the lollipop flies STRAIGHT and pierces —
              // it keeps going through every kid in its line; a Lv3
              // ghost often throws TWO of them at once, fanned apart
              var mx2 = tw.x, my2 = tw.y - 26;
              var baseAng = Math.atan2((best.y - 14) - my2, best.x - mx2);
              var shots = (tw.level === 3 && Math.random() < 0.55) ? 2 : 1;
              for (var sh = 0; sh < shots; sh++) {
                var ang = baseAng + (shots === 2 ? (sh === 0 ? -0.13 : 0.13) : 0);
                state.projs.push({
                  x: mx2, y: my2, kind: 'lolli', pierce: true,
                  vx: Math.cos(ang) * 305, vy: Math.sin(ang) * 305,
                  speed: 305, dmg: dmg, t: 0, traveled: 0,
                  maxTravel: range + 80, hit: {}, src: tw, psize: LVL_PROJ[lvI]
                });
              }
              // ghost Lv3: every few seconds, three little white
              // ghosts fly out and carry three kids back down the
              // road (the carry itself ticks in the update loop)
              if (tw.level === 3 && (tw.miniCd || 0) <= 0) {
                tw.miniCd = MINI_GHOST_CD;
                var mgTargets = [];
                state.kids.forEach(function (k) {
                  if (k.mode !== 'walk') return;
                  var d = Math.hypot(k.x - tw.x, k.y - tw.y);
                  if (d < range) mgTargets.push(k);
                });
                mgTargets.sort(function (a, b) { return b.dist - a.dist; });
                mgTargets.slice(0, 3).forEach(function (mk) {
                  state.miniGhosts.push({ k: mk, t: 0, dur: MINI_GHOST_DUR, src: tw, seed: Math.random() * 6 });
                  addFloat(mk.x, mk.y - 44, 'BOO!', '#f6f2ff', 12);
                });
              }
            } else {
              var np = 1;
              // Lv3 franken: THREE bolts at three different kids
              // at once — a real lightning storm
              if (tw.proj === 'bolt' && tw.level === 3) np = 3;
              // Lv3 black cat sometimes bats out a second paw ball
              else if (tw.proj === 'ball' && tw.level === 3 && Math.random() < 0.35) np = 2;
              var usedTgts = [best];
              for (var pi2 = 0; pi2 < np; pi2++) {
                var tgt = best;
                if (pi2 >= 1) {
                  // the bonus shot picks another kid in range if any
                  var alt = null, altD = -1;
                  state.kids.forEach(function (k) {
                    if (k.mode !== 'walk' || usedTgts.indexOf(k) >= 0) return;
                    var d2 = Math.hypot(k.x - tw.x, k.y - tw.y);
                    if (d2 < range && k.dist > altD) { alt = k; altD = k.dist; }
                  });
                  if (alt) { tgt = alt; usedTgts.push(alt); }
                }
                var pr = {
                  x: tw.x, y: tw.y - 26, tx: tgt, kind: tw.proj,
                  color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
                  speed: 265, dmg: dmg, t: 0, src: tw, psize: LVL_PROJ[lvI]
                };
                if (tw.proj === 'bolt') { pr.chain = [2, 3, 4][lvI]; pr.stun = (tw.level === 3 ? 2 : [0.7, 0.95, 1.2][lvI]); }
                if (tw.proj === 'potion') { pr.poisR = [30, 38, 46][lvI]; pr.poisDps = POISON_DPS * [1, 1.35, 1.75][lvI]; pr.slowF = [0.72, 0.64, 0.56][lvI]; }
                if (tw.proj === 'ball') { pr.critC = [0.3, 0.4, 0.5][lvI]; }
                state.projs.push(pr);
              }
            }
            popSound();
          }
        });
      }

      // black cat Lv3 pounce: the cat bounds onto the foremost
      // kid, pins it down and scratches it, then bounds home.
      // The pin itself freezes the kid (pinT, see the kid loop)
      // and the scratching ticks here, crediting the cat
      state.towers.forEach(function (tw) {
        if (tw.kind !== 'cat' || !tw.pounce) return;
        var pc = tw.pounce;
        pc.t += dt;
        if (!pc.k || pc.k.mode !== 'walk') { pc.phase = 'back'; pc.t = 0; }
        if (pc.phase === 'out') {
          var fo = Math.min(1, pc.t / POUNCE_FLY);
          pc.x = pc.sx + (pc.tx - pc.sx) * fo;
          pc.y = pc.sy + (pc.ty - pc.sy) * fo - Math.sin(fo * Math.PI) * 30;
          if (fo >= 1) {
            pc.phase = 'pin'; pc.t = 0;
            if (pc.k) {
              pc.k.pinT = Math.max(pc.k.pinT, POUNCE_PIN);
              addFloat(pc.k.x, pc.k.y - 48, 'PINNED!', '#ffb03a', 13);
            }
          }
        } else if (pc.phase === 'pin') {
          if (pc.k) {
            pc.x = pc.k.x; pc.y = pc.k.y - 14;
            pc.k.pinT = Math.max(pc.k.pinT, 0.15);
            damageKid(pc.k, POUNCE_DPS * dt, tw);
            if (Math.random() < dt * 6) burstCandy(pc.k.x, pc.k.y - 20, 1, 26, pc.k.y + 4);
          }
          if (pc.t >= POUNCE_PIN) { pc.phase = 'back'; pc.t = 0; }
        } else if (pc.phase === 'back') {
          var fb = Math.min(1, pc.t / POUNCE_FLY);
          pc.x = pc.tx + (pc.sx - pc.tx) * fb;
          pc.y = pc.ty + (pc.sy - pc.ty) * fb - Math.sin(fb * Math.PI) * 30;
          if (fb >= 1) { tw.pounce = null; }
        }
      });

      // werewolf pounce: after WOLF_LEAP_CD seconds back in
      // werewolf form (counted from the shrink-back finishing),
      // the werewolf swells up into a GIANT wolf (a real visible
      // grow, dust and a shock ring), bounds onto the road at the
      // nearest walking kid, mauls everything around the landing
      // spot with 3-4 huge claw swipes, then bounds home and
      // shrinks back into the tower werewolf. The howl above
      // keeps its own 12s rhythm — the pounce runs alongside it,
      // never instead of it
      state.towers.forEach(function (tw) {
        if (tw.kind !== 'werewolf') return;
        // the pounce is a Lv3 power: at Lv1/Lv2 the werewolf
        // ONLY howls — it never transforms, never leaps
        if (tw.level < 3) return;
        var lvW = tw.level - 1;
        // the rest interval only ticks while the werewolf is back
        // in werewolf form: it is measured from the moment the
        // shrink-back finishes (see the shrink phase below, which
        // is what sets leapCd), never from when a transformation
        // starts — the pounce itself is not part of the interval
        if (!tw.leap) tw.leapCd = (tw.leapCd == null ? 1.6 : tw.leapCd) - dt;
        if (!tw.leap) {
          if (tw.leapCd > 0) return;
          // pounce ONLY at a walking kid close to the tower: the
          // landing spot must sit inside the tower's own effective
          // range circle (see WOLF pounce reach note above), so the
          // giant wolf never bounds far away after a distant kid —
          // and with nobody inside that circle there is no
          // transformation at all
          var reach = tw.range * (1 + 0.1 * lvW);
          // the stretch of road directly in front of this tower:
          // the segment whose closest point to the tower is nearest
          // to it. Kids on that stretch are the pounce's first
          // choice; kids on any other stretch inside the circle are
          // only a fallback
          var frontSeg = 0, frontD = Infinity;
          for (var si = 0; si < SEG.length; si++) {
            var sg = SEG[si];
            var sdx = sg.x2 - sg.x1, sdy = sg.y2 - sg.y1;
            var st = sg.len > 0 ? ((tw.x - sg.x1) * sdx + (tw.y - sg.y1) * sdy) / (sg.len * sg.len) : 0;
            st = Math.max(0, Math.min(1, st));
            var sd = Math.hypot(tw.x - (sg.x1 + sdx * st), tw.y - (sg.y1 + sdy * st));
            if (sd < frontD) { frontD = sd; frontSeg = si; }
          }
          var pick = null, pickD = Infinity;        // best kid on the front stretch
          var pickFar = null, pickFarD = Infinity;  // best fallback inside the circle
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk') return;
            var d = Math.hypot(k.x - tw.x, k.y - tw.y);
            if (d >= reach) return;
            if (segIndexAt(k.dist) === frontSeg) {
              if (d < pickD) { pickD = d; pick = k; }
            } else if (d < pickFarD) { pickFarD = d; pickFar = k; }
          });
          if (!pick) pick = pickFar;
          if (!pick) { tw.leapCd = 0.45; return; } // nobody near the tower to maul: check again in a beat, no transformation
          // no cooldown is set here: the 6s rest only starts when
          // this pounce ends and the wolf has shrunk back (below)
          tw.leap = {
            phase: 'grow', t: 0,
            sx: tw.x, sy: tw.y, tx: pick.x, ty: pick.y,
            x: tw.x, y: tw.y, lift: 0, face: pick.x >= tw.x ? 1 : -1,
            swipes: 3 + (Math.random() < 0.5 ? 1 : 0), swipeT: 0.14, swipeAge: 9,
            dmg: WOLF_CLAW_DMG * LVL_DMG[lvW]
          };
          state.rings.push({ x: tw.x, y: tw.y - 12, r: 8, maxR: 52, t: 0, life: 0.4, color: '255,176,58' });
          addFloat(tw.x, tw.y - 84, 'TRANSFORM!', '#ffb03a', 14);
          popSound();
          return;
        }
        var lp = tw.leap;
        lp.t += dt;
        lp.swipeAge += dt;
        if (lp.phase === 'grow') {
          // swelling into the giant wolf: dust bursts off its fur
          if (Math.random() < dt * 26) {
            state.parts.push({
              type: 'puff', color: '#caa27e',
              x: tw.x + (Math.random() - 0.5) * 38, y: tw.y - 6 - Math.random() * 26,
              vx: (Math.random() - 0.5) * 34, vy: -18 - Math.random() * 24,
              rot: 0, vr: 0, life: 0.45, t: 0, size: 4 + Math.random() * 4, bounce: 0
            });
          }
          if (lp.t >= 0.38) { lp.phase = 'out'; lp.t = 0; }
        } else if (lp.phase === 'out') {
          var fo = Math.min(1, lp.t / 0.42);
          lp.x = lp.sx + (lp.tx - lp.sx) * fo;
          lp.y = lp.sy + (lp.ty - lp.sy) * fo;
          lp.lift = Math.sin(fo * Math.PI) * 58;
          if (fo >= 1) {
            lp.phase = 'claw'; lp.t = 0; lp.lift = 0;
            state.shake = Math.max(state.shake, 3.5);
            burstCandy(lp.x, lp.y - 4, 6, 65, lp.y + 4);
            popSound();
          }
        } else if (lp.phase === 'claw') {
          lp.swipeT -= dt;
          if (lp.swipeT <= 0 && lp.swipes > 0) {
            lp.swipes--;
            lp.swipeAge = 0;
            lp.swipeT = 0.27;
            state.rings.push({ x: lp.x, y: lp.y - 10, r: 8, maxR: WOLF_CLAW_R, t: 0, life: 0.26, color: '255,120,60' });
            state.kids.forEach(function (k) {
              if (k.mode !== 'walk') return;
              if (Math.hypot(k.x - lp.x, (k.y - 12) - (lp.y - 12)) > WOLF_CLAW_R) return;
              burstCandy(k.x, k.y - 14, 6, 70, k.y + 4);
              addFloat(k.x, k.y - 48, 'MAULED!', '#ffb03a', 13);
              damageKid(k, lp.dmg, tw);
            });
            popSound();
          }
          if (lp.swipes <= 0 && lp.swipeT <= 0) { lp.phase = 'back'; lp.t = 0; }
        } else if (lp.phase === 'back') {
          var fb = Math.min(1, lp.t / 0.42);
          lp.x = lp.tx + (lp.sx - lp.tx) * fb;
          lp.y = lp.ty + (lp.sy - lp.ty) * fb;
          lp.lift = Math.sin(fb * Math.PI) * 58;
          lp.face = lp.sx >= lp.tx ? 1 : -1;
          if (fb >= 1) { lp.phase = 'shrink'; lp.t = 0; lp.lift = 0; }
        } else if (lp.phase === 'shrink') {
          if (lp.t >= 0.3) { tw.leap = null; tw.leapCd = WOLF_LEAP_CD; } // fully back in werewolf form: the 6s rest starts NOW, from this moment
        }
      });

      // witch poison mist: zones tick down; kids standing in the mist
      // keep taking damage (their crawl in the kid logic below)
      for (var zi = state.poisons.length - 1; zi >= 0; zi--) {
        var zn = state.poisons[zi];
        zn.t += dt;
        if (zn.t >= zn.dur) { state.poisons.splice(zi, 1); continue; }
        state.kids.forEach(function (k) {
          if (k.mode !== 'walk') return;
          if (Math.hypot(k.x - zn.x, (k.y - 12) - zn.y) < zn.r) damageKid(k, zn.dps * dt, zn.src, false, true);
        });
      }
      // slime puddles: zones tick down over ~4s; kids standing in
      // the goo keep taking a light nibble (their crawl through it
      // is applied in the kid logic below). Puddle kills credit the
      // slime tower like any of its hits, via damageKid's src
      for (var szi = state.slimePuddles.length - 1; szi >= 0; szi--) {
        var szn = state.slimePuddles[szi];
        szn.t += dt;
        if (szn.t >= szn.dur) { state.slimePuddles.splice(szi, 1); continue; }
        state.kids.forEach(function (k) {
          if (k.mode !== 'walk') return;
          if (Math.hypot(k.x - szn.x, (k.y - 12) - szn.y) < szn.r) {
            damageKid(k, szn.dps * dt, szn.src);
            // Lv3 acid pool: armour is fully corroded while the
            // kid stands in it — refreshed every frame, so it
            // ends the moment they step out
            if (szn.acid) k.armorZeroTimer = Math.max(k.armorZeroTimer, 0.25);
          }
        });
      }
      // chain-lightning arcs are pure visual: brief and gone
      for (var zpi = state.zaps.length - 1; zpi >= 0; zpi--) {
        state.zaps[zpi].t += dt;
        if (state.zaps[zpi].t >= state.zaps[zpi].life) state.zaps.splice(zpi, 1);
      }
      // scarecrow crows: each one chases its kid down, settles on its
      // head and pecks steadily until its time is up or the kid is
      // chased away — peck kills credit the scarecrow like any hit
      for (var cri = state.crows.length - 1; cri >= 0; cri--) {
        var cr = state.crows[cri];
        cr.t += dt;
        if (!cr.tx || cr.tx.mode !== 'walk' || cr.t >= cr.dur) { state.crows.splice(cri, 1); continue; }
        var cgx = cr.tx.x, cgy = cr.tx.y - 36;
        var cdx = cgx - cr.x, cdy = cgy - cr.y, cdd = Math.hypot(cdx, cdy);
        var cstep = 340 * dt;
        if (cdd > 4) { cr.x += cdx / cdd * Math.min(cstep, cdd); cr.y += cdy / cdd * Math.min(cstep, cdd); }
        if (cdd <= 26) {
          damageKid(cr.tx, cr.dps * dt, cr.src);
          cr.peck += dt;
          if (cr.peck > 0.3) { cr.peck = 0; burstCandy(cr.tx.x, cr.tx.y - 28, 1, 26, cr.tx.y + 4); }
        }
      }
      // bat screech / werewolf howl rings: expand and fade
      for (var rgi = state.rings.length - 1; rgi >= 0; rgi--) {
        var rg = state.rings[rgi];
        // a Lv3 bat's second and third rings wait their turn
        // before rolling out (see fireSpecial)
        if (rg.delay > 0) { rg.delay -= dt; continue; }
        rg.t += dt;
        var rgf = Math.min(1, rg.t / rg.life);
        rg.r = rg.maxR * (1 - (1 - rgf) * (1 - rgf));
        // a Lv3 bat ring hurts and stuns every kid it rolls over,
        // once each, as its edge passes them
        if (rg.dmg) {
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk' || (rg.hit && rg.hit[k.id])) return;
            if (Math.hypot(k.x - rg.x, (k.y - 12) - rg.y) > rg.r) return;
            rg.hit[k.id] = true;
            k.stunTimer = Math.max(k.stunTimer, rg.stun || 0);
            burstCandy(k.x, k.y - 14, 4, 55, k.y + 4);
            damageKid(k, rg.dmg, rg.src);
          });
        }
        if (rg.t >= rg.life) state.rings.splice(rgi, 1);
      }
      // spider web splats dry out with the slow they caused
      for (var wbi = state.webs.length - 1; wbi >= 0; wbi--) {
        var wb = state.webs[wbi];
        wb.t += dt;
        if (wb.t >= wb.life) state.webs.splice(wbi, 1);
      }
      // spider Lv3 net zones: kids standing in the net are
      // snared (their web crawl) — the drag back down the road
      // happens in the kid loop below, next to the web crawl
      for (var nzi = state.netZones.length - 1; nzi >= 0; nzi--) {
        var nz = state.netZones[nzi];
        nz.t += dt;
        if (nz.t >= nz.dur) { state.netZones.splice(nzi, 1); continue; }
        state.kids.forEach(function (k) {
          if (k.mode !== 'walk') return;
          if (Math.hypot(k.x - nz.x, (k.y - 12) - nz.y) < nz.r) {
            k.webTimer = Math.max(k.webTimer, 0.35);
            k.webF = nz.slowF;
          }
        });
      }
      // mummy sand whirlwinds: each one chases its kid, stinging
      // every kid caught inside it (the half-pace drag is applied
      // in the kid logic below, next to the mist and puddle slows)
      for (var vxi = state.vortexes.length - 1; vxi >= 0; vxi--) {
        var vx = state.vortexes[vxi];
        vx.t += dt;
        if (!vx.tx || vx.tx.mode !== 'walk' || vx.t >= vx.life) { state.vortexes.splice(vxi, 1); continue; }
        var vdx = vx.tx.x - vx.x, vdy = (vx.tx.y - 14) - vx.y, vdd = Math.hypot(vdx, vdy);
        var vstep = VORT_SPEED * dt;
        if (vdd > 4) { vx.x += vdx / vdd * Math.min(vstep, vdd); vx.y += vdy / vdd * Math.min(vstep, vdd); }
        state.kids.forEach(function (k) {
          if (k.mode !== 'walk') return;
          if (Math.hypot(k.x - vx.x, (k.y - 12) - vx.y) < vx.r) damageKid(k, vx.dps * dt, vx.src);
        });
      }
      // skeleton bone piles: sit on the road until their bones are
      // all bumped away or their time runs out
      for (var bpi = state.bonePiles.length - 1; bpi >= 0; bpi--) {
        var bp = state.bonePiles[bpi];
        bp.t += dt;
        if (bp.t >= bp.dur || bp.bones <= 0) state.bonePiles.splice(bpi, 1);
      }
      // ghost Lv3 mini ghosts: each one rides its kid and carries
      // it back down the road, then vanishes and drops the kid —
      // the kid's own walk stays frozen (carryT) while it is held
      for (var mgi = state.miniGhosts.length - 1; mgi >= 0; mgi--) {
        var mg = state.miniGhosts[mgi];
        mg.t += dt;
        if (!mg.k || mg.k.mode !== 'walk' || mg.t >= mg.dur) {
          if (mg.k) mg.k.carryT = 0;
          state.miniGhosts.splice(mgi, 1); continue;
        }
        mg.k.carryT = Math.max(mg.k.carryT, 0.12);
        mg.k.dist = Math.max(0, mg.k.dist - MINI_GHOST_CARRY * dt);
      }

      // projectiles
      for (var pi = state.projs.length - 1; pi >= 0; pi--) {
        var p = state.projs[pi];
        if (p.kind === 'arm') {
          // zombie forearm: flies STRAIGHT out to its full reach,
          // biting every kid it passes through once — then turns
          // and crawls back to its owner, biting a second time on
          // the way home (a kid can be bitten once per leg)
          p.t += dt;
          if (p.phase === 'out') {
            var astep = p.speed * dt;
            p.x += p.vx * astep; p.y += p.vy * astep; p.traveled += astep;
            state.kids.forEach(function (k) {
              if (k.mode !== 'walk' || p.hitOut[k.id]) return;
              if (Math.hypot(k.x - p.x, (k.y - 14) - p.y) > 17) return;
              p.hitOut[k.id] = true;
              burstCandy(k.x, k.y - 14, 5, 55, k.y + 4);
              addFloat(k.x, k.y - 46, 'CHOMP!', '#a8d8a8', 12.5);
              damageKid(k, p.dmg, p.src);
            });
            if (p.traveled >= p.maxTravel) p.phase = 'back';
          } else {
            var hx = p.src.x, hy = p.src.y - 26;
            var adx = hx - p.x, ady = hy - p.y, ad = Math.hypot(adx, ady);
            var bstep = p.speed * 1.15 * dt;
            p.ang = Math.atan2(ady, adx);
            state.kids.forEach(function (k) {
              if (k.mode !== 'walk' || p.hitBack[k.id]) return;
              if (Math.hypot(k.x - p.x, (k.y - 14) - p.y) > 17) return;
              p.hitBack[k.id] = true;
              burstCandy(k.x, k.y - 14, 5, 55, k.y + 4);
              addFloat(k.x, k.y - 46, 'CHOMP!', '#a8d8a8', 12.5);
              damageKid(k, p.dmg, p.src);
            });
            if (ad <= bstep + 4) {
              // the arm is home: only reattach it when the LAST
              // arm is back (a Lv3 zombie throws two at once)
              if (p.src) { p.src.armsOut = Math.max(0, (p.src.armsOut || 1) - 1); p.src.armGone = p.src.armsOut > 0; }
              state.projs.splice(pi, 1);
              continue;
            }
            p.x += adx / ad * bstep; p.y += ady / ad * bstep;
          }
          continue;
        }
        if (p.pierce) {
          // ghost lollipop: straight flight, hits every kid it passes
          // through once, dies after flying past the tower's reach
          p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt;
          p.traveled += p.speed * dt;
          state.kids.forEach(function (k) {
            if (k.mode !== 'walk' || p.hit[k.id]) return;
            if (Math.hypot(k.x - p.x, (k.y - 14) - p.y) > 15) return;
            p.hit[k.id] = true;
            k.slowTimer = Math.max(k.slowTimer, 0.3);
            burstCandy(k.x, k.y - 14, 6, 55, k.y + 4);
            damageKid(k, p.dmg, p.src);
          });
          if (p.traveled >= p.maxTravel || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
            state.projs.splice(pi, 1);
          }
          continue;
        }
        // a castle shot stays valid only while its target is STILL
        // a knocking kid inside the round plaza — the moment the kid
        // stops knocking or is no longer in the plaza the candy
        // fizzles out mid-flight instead of chasing it onto the road
        var txOk = !!p.tx && (p.houseShot ? isPlazaKnocker(p.tx) : p.tx.mode === 'walk');
        if (!txOk) { state.projs.splice(pi, 1); continue; }
        var dx = p.tx.x - p.x, dy = (p.tx.y - 14) - p.y, dd = Math.hypot(dx, dy);
        var step = p.speed * dt;
        if (dd <= step + 4) {
          state.projs.splice(pi, 1);
          towerHit(p);
        } else {
          p.x += dx / dd * step; p.y += dy / dd * step; p.t += dt;
          // castle candy leaves a short golden trail as it flies, so
          // a shot from the roof cannon is unmistakably the CASTLE's —
          // no tower throws anything that looks like it
          if (p.houseShot) {
            p.trail = p.trail || [];
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 7) p.trail.shift();
          }
        }
      }

      // kids
      var knockers = 0;
      for (var ki = state.kids.length - 1; ki >= 0; ki--) {
        var k = state.kids[ki];
        k.bob += dt * (k.mode === 'cheer' ? 10 : 7);
        if (k.slowTimer > 0) k.slowTimer -= dt;
        if (k.stunTimer > 0) k.stunTimer -= dt;
        if (k.blockTimer > 0) k.blockTimer -= dt;
        if (k.webTimer > 0) k.webTimer -= dt;
        if (k.armorDownTimer > 0) k.armorDownTimer -= dt;
        if (k.armorZeroTimer > 0) k.armorZeroTimer -= dt;
        if (k.carryT > 0) k.carryT -= dt;
        if (k.pinT > 0) k.pinT -= dt;
        if (k.mode === 'walk') {
          // candy rain: a kid standing in the rain stops to pick up candy
          var inRain = false;
          for (var rzi = 0; rzi < state.rains.length; rzi++) {
            var rz3 = state.rains[rzi];
            if (Math.hypot(k.x - rz3.x, (k.y - 12) - rz3.y) < rz3.r) { inRain = true; break; }
          }
          if (inRain) {
            k.rainTime += dt;
            if (k.rainTime >= RAIN_FEED && k.mode === 'walk') {
              k.mode = 'happy'; k.happyTimer = 0;
              state.kills++; noteComboKill();
              state.prog++;
              addFloat(k.x, k.y - 40, 'All Full!', '#ff8fb5', 14);
              happySound();
              syncHUD(true);
              checkUnlock();
            }
          } else {
            if (k.rainTime > 0) k.rainTime = Math.max(0, k.rainTime - dt * 0.7);
            if (k.stunTimer > 0 || k.blockTimer > 0 || k.carryT > 0 || k.pinT > 0) {
              // stunned by lightning, held up by a bone pile,
              // carried back by a mini ghost or pinned by a cat:
              // going nowhere
            } else if (k.fleeTimer > 0) {
              // scared by the ghost: run back down the road
              k.fleeTimer -= dt;
              k.dist = Math.max(0, k.dist - FLEE_SPEED * dt);
            } else {
              var sp = k.speed * (k.slowTimer > 0 ? 0.45 : 1);
              // tangled in a spider web: a heavy crawl (0.35x at Lv1,
              // tighter still as the spider grows) until it dries out
              if (k.webTimer > 0) sp *= k.webF;
              // wading through witch poison mist slows a kid — but
              // only gently now (was ×0.55, which with the old huge,
              // ever-present pools all but pinned kids in place)
              for (var pzi = 0; pzi < state.poisons.length; pzi++) {
                var zn2 = state.poisons[pzi];
                if (Math.hypot(k.x - zn2.x, (k.y - 12) - zn2.y) < zn2.r) { sp *= (zn2.slowF || 0.72); break; }
              }
              // wading through a slime puddle: the goo clings to
              // their shoes — a clear drag (x0.65 at Lv1, stickier
              // as the slime grows) for as long as they stand in it
              for (var szi2 = 0; szi2 < state.slimePuddles.length; szi2++) {
                var szn2 = state.slimePuddles[szi2];
                if (Math.hypot(k.x - szn2.x, (k.y - 12) - szn2.y) < szn2.r) { sp *= (szn2.slowF || 0.65); break; }
              }
              // caught in a mummy sand whirlwind: the sand drags the
              // kid to half pace while the vortex lasts
              for (var vxi2 = 0; vxi2 < state.vortexes.length; vxi2++) {
                var vx2 = state.vortexes[vxi2];
                if (Math.hypot(k.x - vx2.x, (k.y - 12) - vx2.y) < vx2.r) { sp *= (vx2.slowF || 0.5); break; }
              }
              // a skeleton bone pile on the road ahead: the kid runs
              // into it, is held up a moment and knocks a bone away
              // — after the hold-up it bumps the pile again, until
              // the bones are gone and the road is clear
              for (var bpi2 = 0; bpi2 < state.bonePiles.length; bpi2++) {
                var bp2 = state.bonePiles[bpi2];
                if (bp2.bones <= 0) continue;
                if (k.dist < bp2.dist && k.dist + sp * dt >= bp2.dist - 2) {
                  bp2.bones--;
                  k.blockTimer = PILE_BLOCK;
                  k.dist = bp2.dist - 2 - (Math.abs(k.id || 0) % 5) * 3;
                  burstCandy(k.x, k.y - 14, 4, 40, k.y + 4);
                  addFloat(k.x, k.y - 46, 'BONK!', '#f2f2f2', 13);
                  break;
                }
              }
              k.dist += sp * dt;
              // caught in a Lv3 spider net: the net drags the kid
              // back down the road while it holds them
              for (var nzi2 = 0; nzi2 < state.netZones.length; nzi2++) {
                var nz2 = state.netZones[nzi2];
                if (Math.hypot(k.x - nz2.x, (k.y - 12) - nz2.y) < nz2.r) {
                  k.dist = Math.max(0, k.dist - NET_DRAG * dt);
                  break;
                }
              }
              // caught in a Lv3 mummy sandstorm: the wind shoves
              // the kid back down the road while the storm holds them
              for (var vxi3 = 0; vxi3 < state.vortexes.length; vxi3++) {
                var vx3 = state.vortexes[vxi3];
                if (!vx3.storm) continue;
                if (Math.hypot(k.x - vx3.x, (k.y - 12) - vx3.y) < vx3.r) {
                  k.dist = Math.max(0, k.dist - STORM_PUSH * dt);
                  break;
                }
              }
            }
          }
          var pt = pointAt(Math.max(0, k.dist));
          k.x = pt.x; k.y = pt.y;
          if (k.mode === 'walk' && k.dist >= PATH_LEN - 2) {
            if (state.phase === 'exploded') { k.mode = 'cheer'; k.x = pt.x; k.y = pt.y; }
            else {
              var s = freeSlot();
              if (s) { s.taken = k; k.slot = s; k.mode = 'toSlot'; }
              else { k.mode = 'knock'; k.overflow = true; k.x = PLAZA.x; k.y = 272; } // overflow crowd: flagged, standing at the round plaza's centre (225,272), well inside the ellipse
            }
          }
        } else if (k.mode === 'toSlot') {
          var tx = k.slot.x, ty = k.slot.y;
          var mx = tx - k.x, my = ty - k.y, md = Math.hypot(mx, my);
          if (md < 3) { k.x = tx; k.y = ty; k.mode = state.phase === 'exploded' ? 'cheer' : 'knock'; }
          else { k.x += mx / md * 65 * dt; k.y += my / md * 65 * dt; }
        } else if (k.mode === 'knock') {
          knockers++;
          if (state.phase === 'playing') {
            k.knockPhase += dt / 0.55;
            if (k.knockPhase >= 1) {
              k.knockPhase = 0;
              state.knockCount++;
              // per-kind knock damage: 1 point for most kids, half
              // a point for the two fast-but-soft speedster kinds
              state.houseHP = Math.max(0, state.houseHP - (k.knockDmg || 1));
              // knock text near the door, jittered
              addFloat(DOOR.x + (Math.random() - 0.5) * 90, 198 + Math.random() * 26,
                       Math.random() < 0.3 ? 'KNOCK KNOCK!' : 'KNOCK!', '#ffe9a8', 14 + Math.random() * 6);
              var now = performance.now();
              if (now - state.lastKnockSnd > 110) { state.lastKnockSnd = now; knockSound(knockers); }
              if (!reduceMotion) state.shake = Math.max(state.shake, Math.min(3.2, 0.7 + knockers * 0.22));
              if (state.houseHP <= 0) { explodeHouse(); }
              syncHUD();
            }
          }
        } else if (k.mode === 'happy') {
          k.happyTimer += dt;
          if (k.happyTimer > 1.15) state.kids.splice(ki, 1);
        }
      }

      // final stand-down sweep: the kids loop above is the last
      // place a knocker can leave the plaza within a frame (driven
      // away happy, or the house bursting and the crowd turning to
      // cheer). If the plaza is empty NOW, the castle's stand-down
      // applies to this frame's picture too: no castle candy stays
      // airborne and the cannon stays stood down, so a castle shot
      // can never be seen flying — let alone landing — while
      // nobody is knocking inside the round plaza
      var anyPlazaK = false;
      state.kids.forEach(function (k) { if (isPlazaKnocker(k)) anyPlazaK = true; });
      if (!anyPlazaK) {
        state.houseHold = true;
        for (var spi = state.projs.length - 1; spi >= 0; spi--) {
          if (state.projs[spi].houseShot) state.projs.splice(spi, 1);
        }
      }

      // final wave fully dealt with and the house still standing?
      if (state.phase === 'playing' && state.waveState === 'done') {
        var anyActive = false;
        state.kids.forEach(function (k) {
          if (k.mode === 'walk' || k.mode === 'toSlot' || k.mode === 'knock') anyActive = true;
        });
        if (!anyActive) defenderWin();
      }

      // particles
      for (var qi = state.parts.length - 1; qi >= 0; qi--) {
        var q = state.parts[qi];
        q.t += dt;
        if (q.type === 'candy') {
          q.vy += 620 * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
          q.rot += q.vr * dt;
          // a burst with its own floor (e.g. off a hit kid) bounces
          // and settles on THAT line, right where the burst happened;
          // floorless bursts keep the old shared plaza-side line
          var floor = (q.floor != null ? q.floor : 250 + (q.x % 60));
          if (q.y > floor && q.bounce < 2) { q.y = floor; q.vy *= -0.42; q.vx *= 0.7; q.bounce++; }
          else if (q.floor != null && q.y > floor) { q.y = floor; q.vy = 0; q.vx *= 0.86; }
          if (q.t > q.life) state.parts.splice(qi, 1);
        } else {
          q.x += q.vx * dt; q.y += q.vy * dt; q.rot += (q.vr || 0) * dt;
          if (q.t > q.life) state.parts.splice(qi, 1);
        }
      }
      for (var di = state.debris.length - 1; di >= 0; di--) {
        var db = state.debris[di];
        db.t += dt;
        db.vy += 640 * dt;
        db.x += db.vx * dt; db.y += db.vy * dt;
        db.rot += db.vr * dt;
        if (db.y > 252) { db.y = 252; db.vy *= -0.3; db.vx *= 0.6; db.vr *= 0.5; }
        if (db.t > db.life) state.debris.splice(di, 1);
      }
      for (var fi2 = state.floats.length - 1; fi2 >= 0; fi2--) {
        var f = state.floats[fi2];
        f.t += dt; f.y -= 26 * dt;
        if (f.t > f.life) state.floats.splice(fi2, 1);
      }
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 14);
      if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
    }

    /* ============================================================
       DRAWING — flat vector style
       ============================================================ */
    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); }

    var VIG = null;
    var STARS = [];
    for (var si = 0; si < 60; si++) STARS.push({ x: Math.random() * W, y: Math.random() * 300, r: Math.random() * 1.6 + 0.5, p: Math.random() * 6.28 });

    function drawSky(t) {
      var g = ctx.createLinearGradient(0, 0, 0, 330);
      g.addColorStop(0, '#160b36'); g.addColorStop(0.55, '#2b1763'); g.addColorStop(1, '#452a8f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
      // soft nebula cloud bands
      ctx.fillStyle = 'rgba(124,86,224,.15)';
      [[80, 58, 118, 24], [330, 38, 148, 28], [205, 112, 178, 22], [52, 152, 128, 18], [392, 168, 108, 18]].forEach(function (c) {
        ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2], c[3], 0, 0, 6.3); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,138,80,.08)';
      ctx.beginPath(); ctx.ellipse(368, 116, 128, 36, 0, 0, 6.3); ctx.fill();
      // stars
      STARS.forEach(function (s) {
        ctx.globalAlpha = 0.4 + 0.45 * Math.sin(t * 1.4 + s.p);
        ctx.fillStyle = '#fff3cf';
        circle(s.x, s.y, s.r); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // sparkle stars
      ctx.fillStyle = '#ffe9a8';
      [[52, 120], [140, 44], [300, 130], [416, 190], [96, 208]].forEach(function (sp, i) {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 2 + i * 1.9);
        var r = 5.5;
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1] - r); ctx.quadraticCurveTo(sp[0], sp[1], sp[0] + r, sp[1]);
        ctx.quadraticCurveTo(sp[0], sp[1], sp[0], sp[1] + r); ctx.quadraticCurveTo(sp[0], sp[1], sp[0] - r, sp[1]);
        ctx.quadraticCurveTo(sp[0], sp[1], sp[0], sp[1] - r);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      // moon: warm halo + gradient crescent — parked lower-right in
      // open sky, clear of the HUD pills along the top edge
      var mg = ctx.createRadialGradient(382, 118, 8, 382, 118, 86);
      mg.addColorStop(0, 'rgba(255,172,64,.5)'); mg.addColorStop(0.55, 'rgba(255,150,50,.16)'); mg.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = mg; circle(382, 118, 86); ctx.fill();
      ctx.save();
      ctx.beginPath(); circle(382, 118, 27); ctx.clip();
      var mcg = ctx.createLinearGradient(358, 91, 406, 146);
      mcg.addColorStop(0, '#ffc95e'); mcg.addColorStop(1, '#ff9416');
      ctx.fillStyle = mcg; ctx.fillRect(352, 88, 62, 62);
      var bite = ctx.createLinearGradient(0, 76, 0, 166);
      bite.addColorStop(0, '#1e1145'); bite.addColorStop(1, '#301b6a');
      ctx.fillStyle = bite; circle(366, 106, 23); ctx.fill();
      ctx.restore();
      // bats
      ctx.fillStyle = '#120a2c';
      for (var i = 0; i < 4; i++) {
        var bx = (t * (14 + i * 5) + i * 130) % (W + 60) - 30;
        var by = 52 + i * 26 + Math.sin(t * 2 + i * 2) * 7;
        var fl = Math.sin(t * 9 + i * 1.7) * 4;
        ctx.beginPath();
        ctx.moveTo(bx - 11, by + fl); ctx.quadraticCurveTo(bx - 4, by - 4, bx, by);
        ctx.quadraticCurveTo(bx + 4, by - 4, bx + 11, by + fl);
        ctx.quadraticCurveTo(bx + 4, by + 3, bx, by + 1.5);
        ctx.quadraticCurveTo(bx - 4, by + 3, bx - 11, by + fl);
        ctx.fill();
      }
    }
    function drawGround() {
      // one smooth vertical blend: starts at the hill's own deep purple and
      // eases down into the lighter violet — no hard seam anywhere
      var g = ctx.createLinearGradient(0, 180, 0, 740);
      g.addColorStop(0, '#301b68'); g.addColorStop(0.3, '#452a92'); g.addColorStop(0.65, '#5636b0'); g.addColorStop(1, '#482b99');
      ctx.fillStyle = g; ctx.fillRect(0, 180, W, H - 180);
      // mottled texture patches (the road and props paint over what they cover)
      for (var i = 0; i < 34; i++) {
        var bx = (i * 197 + 40) % W, by = 250 + (i * 131) % 470, br = 22 + (i * 53) % 46;
        ctx.fillStyle = i % 2 ? 'rgba(24,10,58,.13)' : 'rgba(150,110,255,.07)';
        ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.55, (i % 5) * 0.6, 0, 6.3); ctx.fill();
      }
      // sparkle dust
      ctx.fillStyle = 'rgba(255,240,200,.16)';
      for (var j = 0; j < 30; j++) {
        circle((j * 173 + 20) % W, 300 + (j * 97) % 420, 1.3); ctx.fill();
      }
      // grass tufts
      ctx.strokeStyle = 'rgba(64,140,96,.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var k = 0; k < 26; k++) {
        var gx = (k * 167 + 26) % (W - 20) + 10, gy = 268 + (k * 149) % 440;
        ctx.beginPath();
        ctx.moveTo(gx - 4, gy); ctx.quadraticCurveTo(gx - 3, gy - 7, gx - 6, gy - 9);
        ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx, gy - 8, gx + 1, gy - 11);
        ctx.moveTo(gx + 4, gy); ctx.quadraticCurveTo(gx + 5, gy - 6, gx + 7, gy - 8);
        ctx.stroke();
      }
      // tiny flowers
      for (var f = 0; f < 16; f++) {
        var fx = (f * 211 + 60) % (W - 24) + 12, fy = 285 + (f * 173) % 420;
        ctx.fillStyle = f % 3 === 0 ? '#ff8fb5' : (f % 3 === 1 ? '#ffb03a' : '#c792ff');
        circle(fx - 2.2, fy, 1.7); ctx.fill(); circle(fx + 2.2, fy, 1.7); ctx.fill();
        circle(fx, fy - 2, 1.7); ctx.fill(); circle(fx, fy + 2, 1.7); ctx.fill();
        ctx.fillStyle = '#ffe9a8'; circle(fx, fy, 1.2); ctx.fill();
      }
      // fallen leaves
      ctx.fillStyle = 'rgba(245,130,32,.45)';
      for (var l = 0; l < 12; l++) {
        var lx = (l * 181 + 90) % (W - 30) + 15, ly = 300 + (l * 199) % 400;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(l * 1.3);
        ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 2.4, 0, 0, 6.3); ctx.fill();
        ctx.restore();
      }
    }
    function drawHillAndHouse(t, dmg) {
      // curved hill: gradient dome with a warm rim light along the top
      var hg = ctx.createLinearGradient(0, 170, 0, 272);
      hg.addColorStop(0, '#3d2573'); hg.addColorStop(1, '#301b68');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(225, 268, 330, 92, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,176,80,.3)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(225, 267, 327, 90, 0, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
      // fence posts following the hill curve
      function hillY(fx) { return 268 - 92 * Math.sqrt(Math.max(0, 1 - Math.pow((fx - 225) / 330, 2))); }
      ctx.fillStyle = '#150a2e';
      [52, 84, 116, 334, 366, 398].forEach(function (fx) { ctx.fillRect(fx - 2, hillY(fx) - 4, 4, 14); });
      ctx.strokeStyle = '#150a2e'; ctx.lineWidth = 3;
      ctx.beginPath();
      [52, 84, 116].forEach(function (fx, i) { if (i === 0) ctx.moveTo(fx, hillY(fx) + 1); else ctx.lineTo(fx, hillY(fx) + 1); });
      [334, 366, 398].forEach(function (fx, i) { if (i === 0) ctx.moveTo(fx, hillY(fx) + 1); else ctx.lineTo(fx, hillY(fx) + 1); });
      ctx.stroke();
      // dead trees + webs on hill
      drawDeadTree(96, 222, 0.95, 1, 'owl'); drawDeadTree(356, 218, 1.05, -1, 'pumpkin');
      drawWeb(114, 174); drawWeb(336, 168);
      // pumpkins on hill
      drawPumpkinDeco(64, 240, 15); drawPumpkinDeco(390, 244, 13);

      if (state.phase === 'exploded') {
        ctx.save(); ctx.translate(0, 30); drawRubble(); ctx.restore();
        return;
      }

      ctx.save();
      // damage wobble
      var wob = dmg > 0.55 ? Math.sin(t * 30) * (dmg - 0.5) * 2.2 : 0;
      ctx.translate(DOOR.x + wob, 196);
      ctx.rotate(wob * 0.004);
      ctx.translate(-DOOR.x, -196);
      // the castle itself sits a notch smaller and lower than it used
      // to, so its spires and finials clear the HUD pills along the
      // top of the board instead of hiding behind them; the shrink
      // pivots on the doorstep so the gate stays planted on its steps
      ctx.translate(0, 30);
      ctx.translate(DOOR.x, 196); ctx.scale(0.9, 0.9); ctx.translate(-DOOR.x, -196);

      var flick = dmg > 0.65 && Math.sin(t * 17) > 0.55;
      var wallG = ctx.createLinearGradient(0, 84, 0, 198);
      wallG.addColorStop(0, '#4c3391'); wallG.addColorStop(1, '#332268');
      var roof = '#281a54', roofHi = '#55389f';
      // the keep's centre spire, rising behind the roof — tall and
      // sharp, so the silhouette reads vampire's castle, not cottage
      ctx.fillStyle = wallG;
      ctx.fillRect(203, 62, 44, 46);
      ctx.fillStyle = roof;
      ctx.beginPath(); ctx.moveTo(196, 66); ctx.lineTo(225, 16); ctx.lineTo(254, 66); ctx.closePath(); ctx.fill();
      ctx.fillStyle = roofHi;
      ctx.beginPath(); ctx.moveTo(225, 16); ctx.lineTo(254, 66); ctx.lineTo(240, 66); ctx.lineTo(227, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb03a'; circle(225, 13, 3); ctx.fill();
      // side towers: taller than before, each with a crenellated
      // parapet under its spire — battlements say "castle" at a glance
      ctx.fillStyle = wallG;
      ctx.fillRect(158, 92, 36, 104);
      ctx.fillRect(258, 88, 36, 108);
      ctx.fillStyle = 'rgba(10,4,26,.25)';
      ctx.fillRect(187, 92, 7, 104); ctx.fillRect(287, 88, 7, 108);
      ctx.fillStyle = wallG;
      [158, 258].forEach(function (tx0, ti) {
        var ty0 = ti === 0 ? 92 : 88;
        for (var mi = 0; mi < 4; mi++) ctx.fillRect(tx0 + 1 + mi * 9.5, ty0 - 7, 6, 8);
      });
      // spires with a lit edge + golden finials
      ctx.fillStyle = roof;
      ctx.beginPath(); ctx.moveTo(150, 95); ctx.lineTo(176, 40); ctx.lineTo(202, 95); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(250, 91); ctx.lineTo(276, 34); ctx.lineTo(302, 91); ctx.closePath(); ctx.fill();
      ctx.fillStyle = roofHi;
      ctx.beginPath(); ctx.moveTo(176, 40); ctx.lineTo(202, 95); ctx.lineTo(190, 95); ctx.lineTo(179, 53); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(276, 34); ctx.lineTo(302, 91); ctx.lineTo(290, 91); ctx.lineTo(279, 47); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb03a'; circle(176, 37, 2.6); ctx.fill(); circle(276, 31, 2.6); ctx.fill();
      // chimney tucked beside the centre spire (its smoke is in update())
      ctx.fillStyle = '#2e1c5c'; ctx.fillRect(256, 58, 12, 52);
      ctx.fillStyle = '#170b31'; ctx.fillRect(254, 54, 16, 6);
      // main body + gable roof
      ctx.fillStyle = wallG; ctx.fillRect(168, 130, 116, 66);
      ctx.fillStyle = 'rgba(10,4,26,.22)'; ctx.fillRect(269, 130, 15, 66);
      ctx.fillStyle = roof;
      ctx.beginPath(); ctx.moveTo(156, 132); ctx.lineTo(226, 79); ctx.lineTo(296, 132); ctx.closePath(); ctx.fill();
      ctx.fillStyle = roofHi;
      ctx.beginPath(); ctx.moveTo(226, 79); ctx.lineTo(296, 132); ctx.lineTo(279, 132); ctx.lineTo(228, 91); ctx.closePath(); ctx.fill();
      // the keep: a battlemented front block that the door sits in,
      // so the building reads as a fortress gatehouse
      ctx.fillStyle = wallG; ctx.fillRect(198, 106, 54, 90);
      ctx.fillStyle = 'rgba(10,4,26,.22)'; ctx.fillRect(240, 106, 12, 90);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(198, 106, 5, 90);
      ctx.fillStyle = wallG;
      for (var ki2 = 0; ki2 < 5; ki2++) ctx.fillRect(199 + ki2 * 11, 99, 7, 9);
      // two little gargoyles perched on the keep's front corners
      ctx.fillStyle = '#1c0f3d';
      [[203, 99], [247, 99]].forEach(function (gp2) {
        ctx.beginPath(); ctx.ellipse(gp2[0], gp2[1] - 2, 4.6, 5.4, 0, 0, 6.3); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(gp2[0] - 4, gp2[1] - 5); ctx.lineTo(gp2[0] - 9, gp2[1] - 10); ctx.lineTo(gp2[0] - 2, gp2[1] - 8);
        ctx.moveTo(gp2[0] + 4, gp2[1] - 5); ctx.lineTo(gp2[0] + 9, gp2[1] - 10); ctx.lineTo(gp2[0] + 2, gp2[1] - 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb03a'; circle(gp2[0] - 1.8, gp2[1] - 3, 0.9); ctx.fill(); circle(gp2[0] + 1.8, gp2[1] - 3, 0.9); ctx.fill();
        ctx.fillStyle = '#1c0f3d';
      });
      // wall speckle
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      [[176, 140], [200, 188], [262, 140], [180, 168], [246, 186], [292, 120]].forEach(function (d) { circle(d[0], d[1], 1.6); ctx.fill(); });
      // windows with warm glow
      function win(x, y, w, h, r) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,166,48,.9)'; ctx.shadowBlur = 15;
        if (flick) { ctx.fillStyle = '#8a5a18'; }
        else {
          var wg = ctx.createLinearGradient(0, y, 0, y + h);
          wg.addColorStop(0, '#ffd76e'); wg.addColorStop(1, '#ff9a1f');
          ctx.fillStyle = wg;
        }
        rr(x, y, w, h, r); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(46,22,0,.7)'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + 1); ctx.lineTo(x + w / 2, y + h - 1);
        ctx.moveTo(x + 1, y + h / 2); ctx.lineTo(x + w - 1, y + h / 2);
        ctx.stroke();
      }
      win(169, 110, 13, 19, 6);
      win(269, 106, 13, 19, 6);
      win(182, 149, 17, 17, 3);
      win(258, 149, 17, 17, 3);
      // rose window on the keep front
      ctx.save();
      ctx.shadowColor = 'rgba(255,166,48,.9)'; ctx.shadowBlur = 15;
      var aw = ctx.createRadialGradient(222, 123, 2, 225, 126, 11);
      aw.addColorStop(0, '#ffe08a'); aw.addColorStop(1, '#ff9a1f');
      ctx.fillStyle = flick ? '#8a5a18' : aw;
      circle(225, 126, 9.5); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(46,22,0,.7)'; ctx.lineWidth = 1.6;
      circle(225, 126, 9.5); ctx.stroke();
      ctx.beginPath();
      for (var rs = 0; rs < 4; rs++) {
        var ra = rs * Math.PI / 4;
        ctx.moveTo(225 - Math.cos(ra) * 9, 126 - Math.sin(ra) * 9);
        ctx.lineTo(225 + Math.cos(ra) * 9, 126 + Math.sin(ra) * 9);
      }
      ctx.stroke();
      // a tiny lit slit window high on the centre spire
      ctx.save();
      ctx.shadowColor = 'rgba(255,166,48,.9)'; ctx.shadowBlur = 10;
      ctx.fillStyle = flick ? '#8a5a18' : '#ffc95e';
      rr(222.5, 44, 5, 10, 2.5); ctx.fill();
      ctx.restore();
      // door: dark arch frame + glowing door
      ctx.fillStyle = '#150a2e';
      ctx.beginPath();
      ctx.moveTo(205, 196); ctx.lineTo(205, 170); ctx.quadraticCurveTo(225, 152, 245, 170); ctx.lineTo(245, 196); ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.shadowColor = 'rgba(255,154,31,.8)'; ctx.shadowBlur = 13;
      var dg2 = ctx.createLinearGradient(0, 158, 0, 196);
      dg2.addColorStop(0, '#ffb03a'); dg2.addColorStop(1, '#f5820d');
      ctx.fillStyle = dg2;
      ctx.beginPath();
      ctx.moveTo(210, 196); ctx.lineTo(210, 172); ctx.quadraticCurveTo(225, 158, 240, 172); ctx.lineTo(240, 196); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(122,58,0,.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(225, 162); ctx.lineTo(225, 196); ctx.stroke();
      ctx.fillStyle = '#7a4a12'; circle(233, 184, 2.4); ctx.fill();
      // pointed stone architrave + iron bands and studs across the
      // door, so the doorway reads castle gate, not cottage door
      ctx.strokeStyle = 'rgba(21,10,46,.85)'; ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(205, 196); ctx.lineTo(205, 170); ctx.quadraticCurveTo(225, 150, 245, 170); ctx.lineTo(245, 196);
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,20,55,.8)';
      ctx.fillRect(211, 176, 28, 3); ctx.fillRect(211, 188, 28, 3);
      ctx.fillStyle = '#2b1a52';
      [215, 225, 235].forEach(function (sx2) { circle(sx2, 177.5, 1.1); ctx.fill(); circle(sx2, 189.5, 1.1); ctx.fill(); });
      // pumpkins flanking the door
      drawPumpkinDeco(190, 190, 9); drawPumpkinDeco(261, 190, 9);
      // castle candy cannon on the roof peak — it only fires at a
      // kid who is knocking AND standing inside the round plaza in
      // front of the door, never at anyone else
      ctx.save();
      ctx.translate(225, 76);
      ctx.fillStyle = '#170b31';
      ctx.beginPath(); ctx.ellipse(0, 4, 13, 6, 0, 0, 6.3); ctx.fill();
      ctx.save();
      ctx.rotate(state.houseAngle + Math.PI / 2);
      var bg3 = ctx.createLinearGradient(0, -16, 0, 6);
      bg3.addColorStop(0, '#8b7cc0'); bg3.addColorStop(1, '#4c3a80');
      ctx.fillStyle = bg3; rr(-5, -16, 10, 20, 4); ctx.fill();
      ctx.fillStyle = '#2b1a52'; rr(-6.5, -19, 13, 6, 3); ctx.fill();
      ctx.restore();
      var cg3 = ctx.createRadialGradient(-3, -4, 2, 0, 0, 10);
      cg3.addColorStop(0, '#ffb03a'); cg3.addColorStop(1, '#dd6f00');
      ctx.fillStyle = cg3; circle(0, 0, 8.5); ctx.fill();
      ctx.fillStyle = '#431d00'; circle(-2.8, -1, 1.5); ctx.fill(); circle(2.8, -1, 1.5); ctx.fill();
      if (state.houseFlash > 0) {
        ctx.fillStyle = 'rgba(255,214,120,' + (state.houseFlash / 0.14 * 0.9) + ')';
        var fx = Math.cos(state.houseAngle) * 24, fy = Math.sin(state.houseAngle) * 24 - 6;
        circle(fx, fy, 7); ctx.fill();
      }
      ctx.restore();

      // cracks by damage stage
      var stageN = dmg < 0.3 ? 0 : dmg < 0.55 ? 1 : dmg < 0.8 ? 2 : 3;
      ctx.strokeStyle = 'rgba(8,4,20,.85)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      var cracks = [
        [[196, 132], [202, 144], [197, 152], [205, 164]],
        [[262, 136], [255, 148], [261, 158], [254, 170], [258, 182]],
        [[178, 108], [186, 118], [182, 128]],
        [[207, 112], [212, 124], [208, 136], [213, 148]],
        [[242, 142], [248, 152], [244, 162]]
      ];
      var show = [0, 2, 3, 5][stageN];
      for (var ci = 0; ci < show; ci++) {
        ctx.beginPath();
        cracks[ci].forEach(function (pt, j) { if (j === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); });
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawRubble() {
      ctx.fillStyle = '#1c0f3d';
      ctx.beginPath(); ctx.ellipse(225, 248, 96, 16, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#33205f';
      [[168, 240, 30, 12], [212, 236, 36, 14], [262, 241, 26, 10], [196, 244, 20, 8]].forEach(function (r) {
        rr(r[0], r[1], r[2], r[3], 4); ctx.fill();
      });
      // broken door leaning
      ctx.save(); ctx.translate(286, 240); ctx.rotate(0.5);
      ctx.fillStyle = '#8a5a1e'; ctx.fillRect(-8, -22, 16, 24);
      ctx.restore();
      // snapped spire tip
      ctx.fillStyle = '#1a0e36';
      ctx.beginPath(); ctx.moveTo(150, 246); ctx.lineTo(163, 224); ctx.lineTo(176, 246); ctx.closePath(); ctx.fill();
    }

    /* the hill's two spooky trees, redrawn: instead of the old bare
       black stick-branches, each tree is built from tapered curved
       limbs (thick at the trunk, whisker-thin at the tips) filled
       with a deep-violet gradient, with flared roots, a knot hole,
       and a little character of its own — an owl roosting on the
       left tree, a tiny jack-o'-lantern hanging from the right */
    function drawDeadTree(x, y, s, flip, variant) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s * (flip || 1), s);
      var tg = ctx.createLinearGradient(0, -80, 0, 4);
      tg.addColorStop(0, '#2c1a58'); tg.addColorStop(1, '#160b31');
      ctx.fillStyle = tg;
      // one tapered limb along a quadratic curve, w0 wide at the
      // base shrinking to a fine point at the tip
      function limb(x0, y0, cx, cy, x1, y1, w0) {
        var L = [], R = [], N = 6, i, t, mt, px, py, qx, qy, dx, dy, dl, w;
        for (i = 0; i <= N; i++) {
          t = i / N; mt = 1 - t;
          px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
          py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
          qx = mt * x0 + t * cx; qy = mt * y0 + t * cy;
          dx = px - qx; dy = py - qy; dl = Math.hypot(dx, dy) || 1;
          w = (w0 * (1 - t) + 0.5 * t) / 2;
          L.push([px - dy / dl * w, py + dx / dl * w]);
          R.push([px + dy / dl * w, py - dx / dl * w]);
        }
        ctx.beginPath();
        ctx.moveTo(L[0][0], L[0][1]);
        for (i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]);
        for (i = N; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
        ctx.closePath(); ctx.fill();
      }
      // flared roots gripping the hill
      limb(0, 1, -7, 1, -15, 4, 5);
      limb(0, 1, 7, 1, 15, 4, 5);
      // gnarled trunk with a slight S-curve
      limb(0, 3, 3, -22, -2, -46, 15);
      // three main branches off the crown
      limb(-2, -38, -15, -50, -27, -65, 6.5);
      limb(-1, -40, 10, -53, 20, -69, 7);
      limb(-2, -42, 1, -57, 3, -75, 5.5);
      // twiglets at the branch tips
      limb(-27, -65, -33, -71, -39, -83, 2.2);
      limb(-27, -65, -25, -75, -23, -86, 2);
      limb(20, -69, 27, -75, 34, -83, 2.2);
      limb(20, -69, 18, -79, 15, -90, 2);
      limb(3, -75, -1, -83, -4, -93, 2);
      limb(3, -75, 8, -83, 13, -90, 1.8);
      // knot hole low on the trunk
      ctx.fillStyle = '#0a0518';
      ctx.beginPath(); ctx.ellipse(-1, -23, 3.1, 4.4, 0.15, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(170,140,255,.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(-1, -23, 3.6, 5, 0.15, 0, 6.3); ctx.stroke();
      if (variant === 'owl') {
        // a small owl roosting on the right-hand branch
        ctx.fillStyle = '#3a2470';
        ctx.beginPath(); ctx.ellipse(13, -62, 5.4, 6.6, 0, 0, 6.3); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8.6, -66); ctx.lineTo(7.6, -70.5); ctx.lineTo(11, -67.5);
        ctx.moveTo(17.4, -66); ctx.lineTo(18.4, -70.5); ctx.lineTo(15, -67.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5b439e';
        ctx.beginPath(); ctx.ellipse(13, -59.5, 3.4, 3.8, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#ffb03a';
        circle(10.9, -64.2, 1.6); ctx.fill(); circle(15.1, -64.2, 1.6); ctx.fill();
        ctx.fillStyle = '#160b31';
        circle(10.9, -64.2, 0.8); ctx.fill(); circle(15.1, -64.2, 0.8); ctx.fill();
      } else if (variant === 'pumpkin') {
        // a tiny jack-o'-lantern dangling from the left branch tip
        ctx.strokeStyle = 'rgba(230,225,255,.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-25, -63); ctx.lineTo(-25, -55); ctx.stroke();
        drawPumpkinDeco(-25, -50, 6.5);
      }
      ctx.restore();
    }
    function drawWeb(x, y) {
      ctx.strokeStyle = 'rgba(230,225,255,.4)'; ctx.lineWidth = 1;
      for (var i = 0; i < 5; i++) {
        var a = i / 5 * 6.28;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); ctx.stroke();
      }
      circle(x, y, 6.5); ctx.stroke(); circle(x, y, 12); ctx.stroke();
    }
    function drawPumpkinDeco(x, y, r) {
      ctx.fillStyle = '#f5820d';
      circle(x, y, r); ctx.fill();
      ctx.fillStyle = '#e06f00'; circle(x - r * 0.45, y, r * 0.72); ctx.fill(); circle(x + r * 0.45, y, r * 0.72); ctx.fill();
      ctx.fillStyle = '#3f7a1e'; ctx.fillRect(x - 2, y - r - 4, 4, 6);
      ctx.fillStyle = '#431d00';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.15); ctx.lineTo(x - r * 0.22, y - r * 0.15); ctx.lineTo(x - r * 0.36, y + r * 0.08); ctx.closePath();
      ctx.moveTo(x + r * 0.22, y - r * 0.15); ctx.lineTo(x + r * 0.5, y - r * 0.15); ctx.lineTo(x + r * 0.36, y + r * 0.08); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y + r * 0.35);
      ctx.lineTo(x - r * 0.3, y + r * 0.55); ctx.lineTo(x - r * 0.12, y + r * 0.38); ctx.lineTo(x, y + r * 0.6);
      ctx.lineTo(x + r * 0.12, y + r * 0.38); ctx.lineTo(x + r * 0.3, y + r * 0.55); ctx.lineTo(x + r * 0.55, y + r * 0.35);
      ctx.lineTo(x + r * 0.4, y + r * 0.68); ctx.lineTo(x - r * 0.4, y + r * 0.68);
      ctx.closePath(); ctx.fill();
    }

    function drawPath() {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      var pts = PATH;
      function strokeAll(w, color, dy) {
        ctx.strokeStyle = color; ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1] + (dy || 0)); else ctx.lineTo(p[0], p[1] + (dy || 0)); });
        ctx.stroke();
      }
      strokeAll(57, 'rgba(13,5,32,.42)', 6);
      strokeAll(54, '#bd6c1c');
      var rg = ctx.createLinearGradient(0, 215, 0, 745);
      rg.addColorStop(0, '#f9b44c'); rg.addColorStop(0.55, '#f39c33'); rg.addColorStop(1, '#f0a13a');
      strokeAll(46, rg);
      strokeAll(33, 'rgba(255,208,128,.45)');
      // candy dots sprinkled along the road: 32 of them, evenly spread
      // over the whole run, alternating sides of the centre line and
      // staying well inside the road surface (offset 15 + r 2.6 < the
      // road's ~23 half-width), so none reach the edges or gravestones
      var dots = [0.02, 0.051, 0.082, 0.113, 0.144, 0.175, 0.206, 0.237, 0.268, 0.299, 0.33, 0.361, 0.392, 0.423, 0.454, 0.485, 0.515, 0.546, 0.577, 0.608, 0.639, 0.67, 0.701, 0.732, 0.763, 0.794, 0.825, 0.856, 0.887, 0.918, 0.949, 0.98];
      dots.forEach(function (f, i) {
        var pt = pointAt(f * PATH_LEN);
        var off = (i % 2 === 0 ? -15 : 15);
        var oy = ((i * 37) % 9) - 4;
        ctx.fillStyle = CANDY_COLORS[i % CANDY_COLORS.length];
        circle(pt.x + off, pt.y + oy, 2.6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        circle(pt.x + off - 0.8, pt.y + oy - 0.8, 0.9); ctx.fill();
      });
    }
    /* stone apron + steps in front of the door — drawn AFTER the hill and
       house so the dome no longer buries them; the road's final run climbs
       x=225 straight into this apron, dead-on with the door above it */
    function drawDoorstep() {
      // door platform: stone apron so road meets the house cleanly;
      // shifted down with the castle so the steps stay under the gate
      ctx.save();
      ctx.translate(0, 30);
      ctx.fillStyle = 'rgba(13,5,32,.4)';
      ctx.beginPath(); ctx.ellipse(225, 247, 107, 26, 0, 0, 6.3); ctx.fill();
      var pg = ctx.createLinearGradient(0, 210, 0, 264);
      pg.addColorStop(0, '#7d6ab0'); pg.addColorStop(1, '#554584');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.ellipse(225, 238, 104, 25, 0, 0, 6.3); ctx.fill();
      // a clear golden rim around the round plaza (drawn at local
      // y 238; on screen the ellipse sits at 225,268): inside this
      // ring is the ONLY ground the castle's candy may ever touch
      ctx.strokeStyle = 'rgba(255,196,90,.55)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(225, 238, 104, 25, 0, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,225,255,.16)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(225, 236, 86, 18, 0, 0, 6.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(225, 235, 58, 11, 0, 0, 6.3); ctx.stroke();
      ctx.fillStyle = 'rgba(20,10,45,.3)';
      [[180, 232], [225, 242], [268, 230], [205, 248], [248, 250]].forEach(function (s) {
        ctx.beginPath(); ctx.ellipse(s[0], s[1], 11, 4, 0, 0, 6.3); ctx.fill();
      });
      // steps up to the door
      ctx.fillStyle = '#68539c'; rr(200, 210, 50, 10, 3); ctx.fill();
      ctx.fillStyle = '#937fc2'; rr(200, 210, 50, 3.6, 2); ctx.fill();
      ctx.fillStyle = '#7a64ac'; rr(206, 200, 38, 10, 3); ctx.fill();
      ctx.fillStyle = '#a08ccb'; rr(206, 200, 38, 3.6, 2); ctx.fill();
      ctx.restore();
    }
    function drawDeco(t) {
      // every position below comes from the current road's DECO
      // set (DECO_BY_LAYOUT), so the decorations follow the road:
      // no stone, fence, bush, lamp or pond edge ever sits on the
      // road the kids are walking
      // tombstones with shading — round-top and cross shapes mixed
      DECO.stones.forEach(function (g) {
        var w = 21 * g[2], h = 27 * g[2];
        ctx.fillStyle = 'rgba(12,5,30,.35)';
        ctx.beginPath(); ctx.ellipse(g[0] + w / 2, g[1] + h + 2, w * 0.62, 4, 0, 0, 6.3); ctx.fill();
        var tg = ctx.createLinearGradient(0, g[1], 0, g[1] + h);
        tg.addColorStop(0, '#a79ccb'); tg.addColorStop(1, '#7c6ea6');
        ctx.fillStyle = tg;
        if (g[3] === 'cross') {
          rr(g[0] + w * 0.31, g[1], w * 0.38, h, 3); ctx.fill();
          rr(g[0] + w * 0.06, g[1] + h * 0.3, w * 0.88, h * 0.27, 3); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.18)';
          rr(g[0] + w * 0.36, g[1] + 2, w * 0.14, h - 5, 2); ctx.fill();
          return;
        }
        rr(g[0], g[1], w, h, w * 0.42); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(g[0] + 2, g[1] + 2, w - 4, 5, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(43,28,84,.75)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(g[0] + w / 2, g[1] + 8 * g[2]); ctx.lineTo(g[0] + w / 2, g[1] + 18 * g[2]);
        ctx.moveTo(g[0] + w / 2 - 5 * g[2], g[1] + 12 * g[2]); ctx.lineTo(g[0] + w / 2 + 5 * g[2], g[1] + 12 * g[2]);
        ctx.stroke();
      });
      // iron fences
      function fence(x1, x2, y) {
        ctx.strokeStyle = '#1c113f'; ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.moveTo(x1, y + 7); ctx.lineTo(x2, y + 7); ctx.stroke();
        ctx.lineWidth = 2.4;
        for (var fx = x1 + 3; fx < x2; fx += 11) {
          ctx.beginPath(); ctx.moveTo(fx, y - 6); ctx.lineTo(fx, y + 10); ctx.stroke();
          ctx.fillStyle = '#1c113f'; circle(fx, y - 8, 1.8); ctx.fill();
        }
      }
      DECO.fences.forEach(function (f) { fence(f[0], f[1], f[2]); });
      // bushes
      DECO.bushes.forEach(function (b) {
        ctx.fillStyle = '#2e1c5c';
        circle(b[0] - 9, b[1], 10); ctx.fill(); circle(b[0] + 8, b[1] + 1, 11); ctx.fill(); circle(b[0], b[1] - 6, 10); ctx.fill();
        ctx.fillStyle = 'rgba(140,110,230,.35)';
        circle(b[0] - 5, b[1] - 8, 2); ctx.fill(); circle(b[0] + 7, b[1] - 4, 2); ctx.fill(); circle(b[0] + 1, b[1] + 2, 1.7); ctx.fill();
      });
      // lamp posts with warm halos
      DECO.lamps.forEach(function (l, li) {
        var fl = 0.8 + 0.2 * Math.sin(t * 9 + li * 2.1);
        var lg = ctx.createRadialGradient(l[0], l[1] - 12, 2, l[0], l[1] - 12, 26);
        lg.addColorStop(0, 'rgba(255,180,80,' + (0.5 * fl) + ')'); lg.addColorStop(1, 'rgba(255,180,80,0)');
        ctx.fillStyle = lg; circle(l[0], l[1] - 12, 26); ctx.fill();
        ctx.strokeStyle = '#180d33'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(l[0], l[1] + 13); ctx.lineTo(l[0], l[1] - 8); ctx.stroke();
        ctx.fillStyle = '#180d33'; rr(l[0] - 5, l[1] - 19, 10, 12, 2.5); ctx.fill();
        ctx.fillStyle = '#ffd88f'; rr(l[0] - 3, l[1] - 17, 6, 8, 1.5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(l[0] - 6, l[1] - 19); ctx.lineTo(l[0], l[1] - 24); ctx.lineTo(l[0] + 6, l[1] - 19); ctx.closePath();
        ctx.fillStyle = '#180d33'; ctx.fill();
      });
      // glowing pond with two little ghosts — bottom right on the
      // original road (as in the concept), bottom left on roads A
      // and B, whose bottom-right corners are road; the stones and
      // ghosts ride at fixed offsets from the pond's centre
      var pond = DECO.pond;
      ctx.fillStyle = '#8f86b8';
      [[-49, -16], [-27, -24], [25, -24], [49, -14], [51, 14], [25, 24], [-27, 24], [-51, 12]].forEach(function (st) {
        circle(pond.x + st[0], pond.y + st[1], 5.5); ctx.fill();
      });
      var wg2 = ctx.createRadialGradient(pond.x, pond.y, 8, pond.x, pond.y, 62);
      wg2.addColorStop(0, '#5fe0d4'); wg2.addColorStop(0.6, '#2aa7b8'); wg2.addColorStop(1, '#176d8c');
      ctx.fillStyle = wg2;
      ctx.beginPath(); ctx.ellipse(pond.x, pond.y, 56, 24, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(190,255,246,.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(pond.x, pond.y - 2, 40, 15, 0, 0, 6.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(pond.x, pond.y + 3, 22, 8, 0, 0, 6.3); ctx.stroke();
      [[-23, -6], [21, 6]].forEach(function (go) {
        var gp = [pond.x + go[0], pond.y + go[1]];
        ctx.fillStyle = 'rgba(240,255,252,.85)';
        ctx.beginPath();
        ctx.moveTo(gp[0] - 6, gp[1] + 6);
        ctx.quadraticCurveTo(gp[0] - 6.5, gp[1] - 7, gp[0], gp[1] - 7.5);
        ctx.quadraticCurveTo(gp[0] + 6.5, gp[1] - 7, gp[0] + 6, gp[1] + 6);
        ctx.lineTo(gp[0] + 3, gp[1] + 3.6); ctx.lineTo(gp[0], gp[1] + 6); ctx.lineTo(gp[0] - 3, gp[1] + 3.6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#176d8c'; circle(gp[0] - 2, gp[1] - 1, 1.1); ctx.fill(); circle(gp[0] + 2, gp[1] - 1, 1.1); ctx.fill();
      });
      // candy-cane gate at spawn
      [-1, 1].forEach(function (s) {
        var x = 225 + s * 34;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, 726); ctx.lineTo(x, 700); ctx.quadraticCurveTo(x, 690, x - s * 8, 692); ctx.stroke();
        ctx.strokeStyle = '#e8402f'; ctx.lineWidth = 7;
        ctx.setLineDash([7, 9]); ctx.beginPath(); ctx.moveTo(x, 726); ctx.lineTo(x, 700); ctx.stroke(); ctx.setLineDash([]);
      });
      drawPumpkinDeco(DECO.pumpkin.x, DECO.pumpkin.y, DECO.pumpkin.r);
    }
    /* ---------- monster towers ---------- */
    function drawTowerBase(x, y, t) {
      ctx.fillStyle = 'rgba(12,5,30,.45)';
      ctx.beginPath(); ctx.ellipse(x, y + 17, 33, 9, 0, 0, 6.3); ctx.fill();
      // stacked stone slabs
      var bg1 = ctx.createLinearGradient(0, y, 0, y + 18);
      bg1.addColorStop(0, '#6f5fa6'); bg1.addColorStop(1, '#4c3a80');
      ctx.fillStyle = bg1; rr(x - 31, y + 3, 62, 15, 7); ctx.fill();
      var bg2 = ctx.createLinearGradient(0, y - 8, 0, y + 6);
      bg2.addColorStop(0, '#8b7cc0'); bg2.addColorStop(1, '#635199');
      ctx.fillStyle = bg2; rr(x - 25, y - 7, 50, 13, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)'; rr(x - 25, y - 7, 50, 4, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,16,64,.4)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 7); ctx.lineTo(x - 8, y + 17); ctx.moveTo(x + 10, y + 7); ctx.lineTo(x + 10, y + 17); ctx.stroke();
      // candles with flickering glow
      [-27, 27].forEach(function (o, ci) {
        var fl = 0.75 + 0.25 * Math.sin(t * 11 + x + ci * 2.4);
        ctx.save();
        ctx.globalAlpha = 0.45 * fl;
        ctx.fillStyle = '#ffb03a'; circle(x + o, y - 4, 8); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#f3ead2'; ctx.fillRect(x + o - 2, y - 1, 4, 8);
        ctx.fillStyle = '#ffca7a'; circle(x + o, y - 3.5, 2.1 * fl + 0.8); ctx.fill();
      });
    }
    /* each kind's drawn TOP, per level, in drawMonster's local
       units at scale 1 — measured off the real draw code (base
       body plus that level's regalia, over the full idle-bob
       cycle, so the figure is at its highest). The level stars
       ride on this instead of one fixed height for every tower:
       squat monsters (cat, slime, spider) used to leave their
       stars floating far above their heads, while the witch's
       hat and the Lv3 skeleton's top hat poked past theirs */
    var MONSTER_TOP = {
      franken: [-45.6, -45.6, -45.6],
      ghost: [-30.1, -30.1, -30.1],
      witch: [-53.6, -55.2, -55.2],
      mummy: [-31.6, -31.6, -31.6],
      cat: [-28.6, -28.6, -28.6],
      skeleton: [-42.1, -42.1, -50.6],
      spider: [-32.4, -33.0, -36.3],
      bat: [-32.6, -32.6, -32.6],
      scarecrow: [-42.6, -43.2, -43.2],
      zombie: [-40.6, -40.6, -40.6],
      werewolf: [-41.6, -41.6, -41.6],
      slime: [-27.1, -33.0, -33.0]
    };
    /* throwQ: -1 = idle; 0..1 = progress of the candy-throw motion the
       monster plays each time its tower fires. The throw swings the
       monster's OWN right arm / paw / wand hand to (thx, thy) — each
       kind below draws that limb at the swung position while throwing,
       so it never grows a third arm on top of its two still ones. */
    function drawMonster(kind, x, y, t, s, throwQ, lvl) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      var bobY = Math.sin(t * 2.2 + x) * 1.6;
      ctx.translate(0, bobY);
      // Lv1 youngsters are paler and plainer; the colour deepens as
      // they grow (Lv2 full colour, Lv3 full colour plus the aura
      // the caller draws around the monster)
      if (lvl === 1) ctx.filter = 'saturate(0.55) brightness(1.07)';
      var throwing = (throwQ != null && throwQ >= 0);
      var armless = (throwQ === -2); // zombie only: its throwing arm is away flying
      var thx = 0, thy = 0;
      if (throwing) {
        // body: quick hop + forward lean + squash, peaking mid-throw
        var sw = Math.sin(throwQ * Math.PI);
        ctx.translate(0, -sw * 2.6);
        ctx.rotate(sw * 0.13);
        ctx.scale(1 + sw * 0.05, 1 - sw * 0.06);
        // right-hand position over the swing: starts cocked up-back,
        // sweeps forward to the release point (candy leaves at q ≈ 0.5)
        var aa = -2.35 + throwQ * 1.95;
        thx = 13 + Math.cos(aa) * 13; thy = -10 + Math.sin(aa) * 13;
      }
      if (kind === 'franken') {
        // Frankenstein's monster: flat-top green head, neck bolts, stitches
        var fj = ctx.createLinearGradient(0, -16, 0, 8);
        fj.addColorStop(0, '#3a3f4a'); fj.addColorStop(1, '#23262e');
        ctx.fillStyle = fj;
        rr(-14, -15, 28, 21, 5); ctx.fill();
        ctx.fillStyle = '#6b7280';
        ctx.beginPath(); ctx.moveTo(-5, -15); ctx.lineTo(5, -15); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
        // neck bolts
        ctx.fillStyle = '#9aa3b2';
        ctx.fillRect(-19.5, -24, 6, 4); ctx.fillRect(13.5, -24, 6, 4);
        ctx.fillStyle = '#6e7686';
        ctx.fillRect(-19.5, -24, 2.4, 4); ctx.fillRect(17.1, -24, 2.4, 4);
        // head: green, flat top
        var fh = ctx.createLinearGradient(0, -44, 0, -14);
        fh.addColorStop(0, '#8fce6e'); fh.addColorStop(1, '#5da244');
        ctx.fillStyle = fh;
        rr(-13, -44, 26, 30, 4); ctx.fill();
        // flat black hair with a jagged fringe
        ctx.fillStyle = '#191c22';
        ctx.beginPath();
        ctx.moveTo(-13, -44); ctx.lineTo(13, -44); ctx.lineTo(13, -35);
        ctx.lineTo(7, -37.5); ctx.lineTo(2, -35); ctx.lineTo(-3, -37.5); ctx.lineTo(-8, -35); ctx.lineTo(-13, -37);
        ctx.closePath(); ctx.fill();
        // forehead stitch scar
        ctx.strokeStyle = 'rgba(30,50,25,.75)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8, -31); ctx.lineTo(6, -32.5); ctx.stroke();
        [-5, -1, 3].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx, -33.6); ctx.lineTo(sx + 0.7, -29.9); ctx.stroke();
        });
        // heavy brow + eyes under it
        ctx.fillStyle = 'rgba(30,50,25,.5)'; rr(-10, -27.5, 20, 3.4, 1.7); ctx.fill();
        ctx.fillStyle = '#fff8d6'; circle(-5, -21.5, 2.7); ctx.fill(); circle(5, -21.5, 2.7); ctx.fill();
        ctx.fillStyle = '#1c2416'; circle(-5, -21.2, 1.4); ctx.fill(); circle(5, -21.2, 1.4); ctx.fill();
        // cheek scar + straight stitched mouth
        ctx.strokeStyle = 'rgba(30,50,25,.7)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(8.5, -19); ctx.lineTo(11, -15.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4.5, -16.5); ctx.lineTo(4.5, -16.5); ctx.stroke();
        [-2.5, 0.5, 3].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx, -17.8); ctx.lineTo(sx, -15.4); ctx.stroke();
        });
        // left arm always reaches out stiffly; the RIGHT arm is the
        // throwing arm — while throwing it swings to (thx, thy) instead
        // of staying in its stiff pose, so there are never three arms
        ctx.strokeStyle = '#2c303a'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(-19, -3); ctx.stroke();
        ctx.fillStyle = '#79c25e'; circle(-19.5, -2.5, 3); ctx.fill();
        ctx.strokeStyle = '#2c303a'; ctx.lineWidth = 5.5;
        if (throwing) {
          ctx.beginPath(); ctx.moveTo(13, -10); ctx.lineTo(thx, thy); ctx.stroke();
          ctx.fillStyle = '#79c25e'; circle(thx, thy, 3); ctx.fill();
          if (throwQ < 0.5) drawCandyShape(0, '#ff5d8f', thx, thy - 2, 5.5, throwQ * 3);
        } else {
          ctx.beginPath(); ctx.moveTo(13, -10); ctx.lineTo(19, -3); ctx.stroke();
          ctx.fillStyle = '#79c25e'; circle(19.5, -2.5, 3); ctx.fill();
        }
      } else if (kind === 'ghost') {
        var gg2 = ctx.createLinearGradient(0, -22, 0, 6);
        gg2.addColorStop(0, '#ffffff'); gg2.addColorStop(1, '#d5cdf0');
        ctx.fillStyle = gg2;
        ctx.beginPath();
        ctx.moveTo(-16, 4);
        ctx.quadraticCurveTo(-17, -20, 0, -21);
        ctx.quadraticCurveTo(17, -20, 16, 4);
        ctx.lineTo(11, 0); ctx.lineTo(6, 4); ctx.lineTo(0, 0); ctx.lineTo(-6, 4); ctx.lineTo(-11, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(130,105,205,.16)';
        ctx.beginPath(); ctx.ellipse(0, 1, 13, 4.5, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#241245';
        circle(-6, -10, 2.6); ctx.fill(); circle(6, -10, 2.6); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -3.5, 2.6, 3.4, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#ffffff'; circle(-6.8, -11, 0.9); ctx.fill(); circle(5.2, -11, 0.9); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,160,.55)';
        circle(-11, -5, 3.4); ctx.fill(); circle(11, -5, 3.4); ctx.fill();
        // the lollipop IS the ghost's throwing hand: while throwing, the
        // same stick-and-candy swings to (thx, thy) and the candy leaves
        // the hand at the release point — no second arm appears
        if (throwing) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(13, -5); ctx.lineTo(thx, thy); ctx.stroke();
          ctx.fillStyle = '#f3eefc'; circle(thx, thy, 2.8); ctx.fill();
          if (throwQ < 0.5) {
            ctx.fillStyle = 'rgba(255,93,143,.3)'; circle(thx, thy - 3, 9.5); ctx.fill();
            ctx.fillStyle = '#ff5d8f'; circle(thx, thy - 3, 5.5); ctx.fill();
            ctx.fillStyle = '#ffd3e4'; circle(thx, thy - 3, 2.4); ctx.fill();
          }
        } else {
          // lollipop with a soft glow
          ctx.fillStyle = 'rgba(255,93,143,.3)'; circle(22, -19, 9.5); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(15, -4); ctx.lineTo(21, -16); ctx.stroke();
          ctx.fillStyle = '#ff5d8f'; circle(22, -19, 5.5); ctx.fill();
          ctx.fillStyle = '#ffd3e4'; circle(22, -19, 2.4); ctx.fill();
        }
      } else if (kind === 'witch') {
        var wd = ctx.createLinearGradient(0, -16, 0, 6);
        wd.addColorStop(0, '#7c3aed'); wd.addColorStop(1, '#4c1d95');
        ctx.fillStyle = wd;
        ctx.beginPath(); ctx.moveTo(-13, 4); ctx.lineTo(-8, -16); ctx.lineTo(8, -16); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb03a'; ctx.fillRect(-6, -6, 12, 3.4);
        var wf = ctx.createRadialGradient(-3, -25, 2, 0, -21, 12);
        wf.addColorStop(0, '#ffe7c4'); wf.addColorStop(1, '#ffd0a0');
        ctx.fillStyle = wf; circle(0, -21, 10.5); ctx.fill();
        ctx.fillStyle = '#35c463';
        ctx.beginPath(); ctx.arc(-9.5, -21, 5.5, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(9.5, -21, 5.5, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#27934a';
        ctx.beginPath(); ctx.arc(-9.5, -17.3, 4, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(9.5, -17.3, 4, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#241245'; circle(-3.6, -21, 1.5); ctx.fill(); circle(3.6, -21, 1.5); ctx.fill();
        ctx.strokeStyle = '#c24914'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, -18.5, 3.6, 0.3, 2.8); ctx.stroke();
        // hat
        var wh = ctx.createLinearGradient(0, -52, 0, -28);
        wh.addColorStop(0, '#4a1a8f'); wh.addColorStop(1, '#2c0e57');
        ctx.fillStyle = wh;
        ctx.beginPath(); ctx.ellipse(0, -29, 15, 4.4, 0, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(2, -52); ctx.lineTo(9, -30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb03a'; ctx.fillRect(-7.5, -33.5, 15, 4);
        ctx.fillStyle = '#2c0e57'; ctx.fillRect(-1.8, -32.8, 3.6, 2.6);
        // the wand hand does the throwing: while throwing, her own wand
        // arm swings to (thx, thy) with the star riding at the wand tip
        ctx.strokeStyle = '#8a5a1e'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        var wtx, wty;
        if (throwing) {
          ctx.beginPath(); ctx.moveTo(11, -9); ctx.lineTo(thx, thy); ctx.stroke();
          ctx.fillStyle = '#ffd0a0'; circle(thx, thy, 2.6); ctx.fill();
          wtx = thx + 5; wty = thy - 5;
        } else {
          ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(20, -22); ctx.stroke();
          wtx = 21; wty = -25;
        }
        ctx.fillStyle = 'rgba(199,146,255,.35)'; circle(wtx, wty, 8); ctx.fill();
        ctx.fillStyle = '#c792ff';
        ctx.beginPath();
        var cx = wtx, cy = wty;
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 1.6, cy - 1.6); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx + 1.6, cy + 1.6);
        ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 1.6, cy + 1.6); ctx.lineTo(cx - 5, cy); ctx.lineTo(cx - 1.6, cy - 1.6);
        ctx.closePath(); ctx.fill();
      } else if (kind === 'mummy') {
        var mg2 = ctx.createLinearGradient(0, -30, 0, 8);
        mg2.addColorStop(0, '#f7f0dc'); mg2.addColorStop(1, '#d8c9a2');
        ctx.fillStyle = mg2;
        rr(-13, -30, 26, 36, 10); ctx.fill();
        ctx.strokeStyle = '#bfab7f'; ctx.lineWidth = 2.6;
        [-22, -14, -6, 1].forEach(function (yy) {
          ctx.beginPath(); ctx.moveTo(-12, yy); ctx.lineTo(12, yy - 3); ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(122,100,58,.35)'; ctx.lineWidth = 1.4;
        [-18, -10].forEach(function (yy) {
          ctx.beginPath(); ctx.moveTo(-12, yy); ctx.lineTo(12, yy - 3); ctx.stroke();
        });
        ctx.fillStyle = '#241245'; rr(-10, -24, 20, 8, 4); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(255,210,62,.95)'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffd23e'; circle(-4.5, -20, 2.1); ctx.fill(); circle(4.5, -20, 2.1); ctx.fill();
        ctx.restore();
        // right arm is the throwing arm: while throwing it swings to
        // (thx, thy) instead of hanging in its resting curl
        ctx.lineCap = 'round';
        if (throwing) {
          ctx.strokeStyle = '#e9dfc6'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(thx, thy); ctx.stroke();
          if (throwQ < 0.5) drawCandyShape(0, '#ff5d8f', thx, thy - 2, 5.5, throwQ * 3);
        } else {
          ctx.strokeStyle = '#e9dfc6'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(12, -12); ctx.quadraticCurveTo(19, -6, 17, 2); ctx.stroke();
        }
        ctx.strokeStyle = '#cbbd97'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-12, -10); ctx.quadraticCurveTo(-18, -4, -16, 3); ctx.stroke();
      } else if (kind === 'cat') {
        var cg = ctx.createLinearGradient(0, -28, 0, 8);
        cg.addColorStop(0, '#352257'); cg.addColorStop(1, '#1b1030');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.ellipse(0, -8, 15, 13, 0, 0, 6.3); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-13, -16); ctx.lineTo(-11, -27); ctx.lineTo(-4, -19); ctx.closePath();
        ctx.moveTo(13, -16); ctx.lineTo(11, -27); ctx.lineTo(4, -19); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8fb5';
        ctx.beginPath(); ctx.moveTo(-10.5, -19); ctx.lineTo(-9.8, -23.5); ctx.lineTo(-6.8, -19.8); ctx.closePath();
        ctx.moveTo(10.5, -19); ctx.lineTo(9.8, -23.5); ctx.lineTo(6.8, -19.8); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(255,210,62,.8)'; ctx.shadowBlur = 5;
        ctx.fillStyle = '#ffd23e'; circle(-5.5, -10, 2.6); ctx.fill(); circle(5.5, -10, 2.6); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#120a24'; circle(-5.5, -10, 1.2); ctx.fill(); circle(5.5, -10, 1.2); ctx.fill();
        // crescent-moon pendant
        ctx.fillStyle = '#ffb03a'; circle(0, 2, 3.2); ctx.fill();
        ctx.fillStyle = '#241640'; circle(1.1, 1.1, 2.3); ctx.fill();
        // whiskers
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1;
        [-1, 1].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx * 7.4, -6); ctx.lineTo(sx * 13.5, -7.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx * 7.4, -3.6); ctx.lineTo(sx * 13.5, -2.4); ctx.stroke();
        });
        ctx.strokeStyle = '#241640'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(14, -4); ctx.quadraticCurveTo(24, -8, 22, -20); ctx.stroke();
        // the cat bats its candy ball with its own right paw: the paw
        // only comes out for the swing, following (thx, thy)
        if (throwing) {
          ctx.strokeStyle = '#241640'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(thx, thy); ctx.stroke();
          ctx.fillStyle = '#241640'; circle(thx, thy, 3.1); ctx.fill();
          if (throwQ < 0.5) drawCandyShape(1, '#4dc9ff', thx, thy - 3, 5.5, throwQ * 3);
        }
      } else if (kind === 'skeleton') {
        // Skeleton: a little ribcage robe under a round white skull
        // with big dark eye sockets and a toothy grin
        var sg = ctx.createLinearGradient(0, -16, 0, 8);
        sg.addColorStop(0, '#5b4a86'); sg.addColorStop(1, '#372a5c');
        ctx.fillStyle = sg;
        rr(-11, -14, 22, 18, 6); ctx.fill();
        // ribcage arcs on the robe
        ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 1.6;
        [-8, -3, 2].forEach(function (yy) {
          ctx.beginPath(); ctx.moveTo(-7, yy); ctx.quadraticCurveTo(0, yy + 2.4, 7, yy); ctx.stroke();
        });
        // skull: round cranium + jaw block
        var sk = ctx.createLinearGradient(0, -42, 0, -12);
        sk.addColorStop(0, '#fdfaf0'); sk.addColorStop(1, '#ddd3ba');
        ctx.fillStyle = sk;
        circle(0, -27, 13.5); ctx.fill();
        rr(-8.5, -22, 17, 10, 4); ctx.fill();
        // eye sockets with little green glow pupils
        ctx.fillStyle = '#241245';
        ctx.beginPath(); ctx.ellipse(-5.5, -28, 3.6, 4.4, 0, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5.5, -28, 3.6, 4.4, 0, 0, 6.3); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(126,224,111,.95)'; ctx.shadowBlur = 5;
        ctx.fillStyle = '#7ee06f'; circle(-5.5, -27.6, 1.4); ctx.fill(); circle(5.5, -27.6, 1.4); ctx.fill();
        ctx.restore();
        // nose hole + toothy grin
        ctx.fillStyle = '#241245';
        ctx.beginPath(); ctx.moveTo(0, -24.5); ctx.lineTo(-1.9, -21.4); ctx.lineTo(1.9, -21.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(36,18,69,.8)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-6.5, -16.5); ctx.lineTo(6.5, -16.5); ctx.stroke();
        [-4, -1.3, 1.3, 4].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx, -19.4); ctx.lineTo(sx, -13.8); ctx.stroke();
        });
        // a hairline crack on the cranium
        ctx.strokeStyle = 'rgba(120,105,70,.5)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(9.5, -33); ctx.lineTo(7.6, -29.5); ctx.lineTo(9.8, -27); ctx.stroke();
        // arms: the left one hangs bony and still; the right arm is
        // the throwing arm — mid-swing it holds the bone at (thx, thy)
        ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-10, -9); ctx.lineTo(-16, -2); ctx.stroke();
        ctx.fillStyle = '#f4efe2'; circle(-16.5, -1.5, 2.6); ctx.fill();
        if (throwing) {
          ctx.beginPath(); ctx.moveTo(10, -9); ctx.lineTo(thx, thy); ctx.stroke();
          ctx.fillStyle = '#f4efe2'; circle(thx, thy, 2.6); ctx.fill();
          if (throwQ < 0.5) {
            ctx.save(); ctx.translate(thx, thy - 3); ctx.rotate(throwQ * 5);
            ctx.fillStyle = '#f4efe2';
            ctx.fillRect(-5.5, -1.7, 11, 3.4);
            circle(-5.5, -2.6, 2.4); ctx.fill(); circle(-5.5, 2.6, 2.4); ctx.fill();
            circle(5.5, -2.6, 2.4); ctx.fill(); circle(5.5, 2.6, 2.4); ctx.fill();
            ctx.restore();
          }
        } else {
          ctx.beginPath(); ctx.moveTo(10, -9); ctx.lineTo(16, -2); ctx.stroke();
          ctx.fillStyle = '#f4efe2'; circle(16.5, -1.5, 2.6); ctx.fill();
        }
      } else if (kind === 'spider') {
        // Spider, redrawn to read as a spider at a glance: a big
        // round ABDOMEN ballooning up behind, a smaller head
        // (cephalothorax) tucked at its lower front carrying SIX
        // eyes and two little fangs, and eight clearly JOINTED
        // legs — four a side, each rising to a high knee before
        // dropping to its foot, splayed wide either side of the
        // body. Same purple family as the other monsters; the web
        // still sprays from her mouth when she throws
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#33204e'; ctx.lineWidth = 3.6;
        // legs first, behind the body: [hip, knee, foot] per leg
        var legSet = [
          [7, -19, 18, -29, 25, -14],
          [11, -14, 23, -21, 28, -8],
          [12, -8, 24, -12, 28, 1],
          [9, -3, 20, -4, 25, 7]
        ];
        [-1, 1].forEach(function (sd) {
          legSet.forEach(function (L) {
            ctx.beginPath();
            ctx.moveTo(sd * L[0], L[1]);
            ctx.lineTo(sd * L[2], L[3]);
            ctx.lineTo(sd * L[4], L[5]);
            ctx.stroke();
          });
        });
        // the big round abdomen
        var spg = ctx.createRadialGradient(-5, -23, 3, 0, -16, 16);
        spg.addColorStop(0, '#b18ae0'); spg.addColorStop(1, '#6d439e');
        ctx.fillStyle = spg;
        ctx.beginPath(); ctx.ellipse(0, -16, 14.5, 13.5, 0, 0, 6.3); ctx.fill();
        // abdomen markings: darker spots + a soft top highlight
        ctx.fillStyle = 'rgba(58,33,84,.32)';
        circle(-7, -21, 2.3); ctx.fill(); circle(6, -24, 1.7); ctx.fill(); circle(9.5, -15, 1.4); ctx.fill(); circle(-10, -13, 1.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.20)';
        ctx.beginPath(); ctx.ellipse(-5.5, -24.5, 5.5, 3.2, -0.5, 0, 6.3); ctx.fill();
        // the head: a smaller, deeper-purple dome at the abdomen's
        // lower front — this is where the face lives
        var sph = ctx.createRadialGradient(-2, -9, 2, 0, -4.5, 9);
        sph.addColorStop(0, '#7d4fb0'); sph.addColorStop(1, '#54307e');
        ctx.fillStyle = sph;
        circle(0, -4.5, 8.4); ctx.fill();
        // SIX eyes clustered on the head: two big googly ones, a
        // medium pair flanking them, two tiny ones below centre
        ctx.fillStyle = '#fff';
        circle(-3.4, -7.6, 2.7); ctx.fill(); circle(3.4, -7.6, 2.7); ctx.fill();
        circle(-6.4, -5.2, 1.8); ctx.fill(); circle(6.4, -5.2, 1.8); ctx.fill();
        circle(-1.7, -3.8, 1.15); ctx.fill(); circle(1.7, -3.8, 1.15); ctx.fill();
        ctx.fillStyle = '#241245';
        circle(-3.4, -7.2, 1.45); ctx.fill(); circle(3.4, -7.2, 1.45); ctx.fill();
        circle(-6.4, -4.9, 0.95); ctx.fill(); circle(6.4, -4.9, 0.95); ctx.fill();
        circle(-1.7, -3.6, 0.6); ctx.fill(); circle(1.7, -3.6, 0.6); ctx.fill();
        ctx.fillStyle = '#fff';
        circle(-4, -8.3, 0.75); ctx.fill(); circle(2.8, -8.3, 0.75); ctx.fill();
        circle(-6.9, -5.8, 0.5); ctx.fill(); circle(5.9, -5.8, 0.5); ctx.fill();
        // smile, two little fangs under it, blush on the head sides
        ctx.strokeStyle = '#2c1845'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(0, -2.6, 3.2, 0.4, 2.74); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-3.1, -0.9); ctx.lineTo(-1.5, -0.9); ctx.lineTo(-2.3, 1.9); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1.5, -0.9); ctx.lineTo(3.1, -0.9); ctx.lineTo(2.3, 1.9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,160,.5)'; circle(-7.6, -1.8, 1.9); ctx.fill(); circle(7.6, -1.8, 1.9); ctx.fill();
        if (throwing) {
          // the web strand streams from her mouth to the launch point
          ctx.strokeStyle = 'rgba(240,238,250,.85)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(thx, thy); ctx.stroke();
          if (throwQ < 0.5) { ctx.fillStyle = '#f0eefb'; circle(thx, thy - 2, 5.5); ctx.fill(); }
        }
      } else if (kind === 'bat') {
        // Bat: a round violet bat with big ears and flappy wings.
        // Screeching (throwing) throws the wings wide and opens
        // the mouth in a big O — the ring itself is drawn in the world
        var flap = Math.sin(t * 7 + x * 1.3) * (throwing ? 0.08 : 0.2);
        [-1, 1].forEach(function (sd) {
          ctx.save();
          ctx.translate(sd * 7, -14); ctx.rotate(sd * flap);
          var wg = ctx.createLinearGradient(0, -14, 0, 10);
          wg.addColorStop(0, '#5f469c'); wg.addColorStop(1, '#3c2864');
          ctx.fillStyle = wg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(sd * 13, -13, sd * 23, throwing ? -14 : -10);
          ctx.quadraticCurveTo(sd * 20, -2, sd * 16, 0);
          ctx.quadraticCurveTo(sd * 15, 5, sd * 10, 3);
          ctx.quadraticCurveTo(sd * 7, 8, sd * 2, 6);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = '#46306e';
        ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-8, -31); ctx.lineTo(-2, -23); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(8, -31); ctx.lineTo(2, -23); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8fb5';
        ctx.beginPath(); ctx.moveTo(-8.2, -22.5); ctx.lineTo(-7.6, -28); ctx.lineTo(-4.4, -23.4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8.2, -22.5); ctx.lineTo(7.6, -28); ctx.lineTo(4.4, -23.4); ctx.closePath(); ctx.fill();
        var bg2 = ctx.createRadialGradient(-3, -18, 3, 0, -12, 14);
        bg2.addColorStop(0, '#7d5fb5'); bg2.addColorStop(1, '#4c3278');
        ctx.fillStyle = bg2;
        ctx.beginPath(); ctx.ellipse(0, -12, 11.5, 11, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath(); ctx.ellipse(0, -6, 6.5, 5, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#ffd23e'; circle(-4.6, -14, 2.5); ctx.fill(); circle(4.6, -14, 2.5); ctx.fill();
        ctx.fillStyle = '#241245'; circle(-4.6, -13.8, 1.2); ctx.fill(); circle(4.6, -13.8, 1.2); ctx.fill();
        ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.ellipse(0, -10.6, 1.7, 1.2, 0, 0, 6.3); ctx.fill();
        if (throwing) {
          ctx.fillStyle = '#2c1030';
          ctx.beginPath(); ctx.ellipse(0, -6.8, 3.2, 3.8, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-2.6, -10); ctx.lineTo(-1, -10); ctx.lineTo(-1.8, -7.6); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(1, -10); ctx.lineTo(2.6, -10); ctx.lineTo(1.8, -7.6); ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = '#2c1845'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(0, -8.6, 2.6, 0.4, 2.74); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-2.2, -7); ctx.lineTo(-0.8, -7); ctx.lineTo(-1.5, -5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0.8, -7); ctx.lineTo(2.2, -7); ctx.lineTo(1.5, -5); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#ffb03a';
        ctx.beginPath(); ctx.ellipse(-4.5, -0.5, 2.4, 1.4, 0, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4.5, -0.5, 2.4, 1.4, 0, 0, 6.3); ctx.fill();
      } else if (kind === 'scarecrow') {
        // Scarecrow: a patchwork shirt on a stick frame, straw poking
        // out everywhere, a big floppy straw hat — and a pet crow.
        // The right arm is the throwing arm: it launches the crow
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -18); ctx.stroke();
        var scg = ctx.createLinearGradient(0, -18, 0, 6);
        scg.addColorStop(0, '#c65a21'); scg.addColorStop(1, '#9c3f14');
        ctx.fillStyle = scg;
        ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-7, -17); ctx.lineTo(7, -17); ctx.lineTo(10, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3f7a8c'; ctx.fillRect(-8.6, -4, 6, 6);
        ctx.fillStyle = '#7a9e3f'; ctx.fillRect(3.4, -13, 5.4, 5.4);
        ctx.strokeStyle = 'rgba(60,25,5,.55)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
        ctx.strokeRect(-8.6, -4, 6, 6); ctx.strokeRect(3.4, -13, 5.4, 5.4);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#e8c877'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-9.4, 2.5); ctx.lineTo(9.4, 2.5); ctx.stroke();
        ctx.strokeStyle = '#e8c34a'; ctx.lineWidth = 1.8;
        [-6, -2, 2, 6].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx * 0.6, -17); ctx.lineTo(sx, -20.5); ctx.stroke();
        });
        // left arm: a stick ending in straw fingers
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-8, -13); ctx.lineTo(-17, -9); ctx.stroke();
        ctx.strokeStyle = '#e8c34a'; ctx.lineWidth = 1.8;
        [-2.4, 0, 2.4].forEach(function (fo) {
          ctx.beginPath(); ctx.moveTo(-17, -9); ctx.lineTo(-20.5, -9 + fo); ctx.stroke();
        });
        // right (throwing) arm, with the crow waiting on it
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
        if (throwing) {
          ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(thx, thy); ctx.stroke();
          if (throwQ < 0.5) {
            ctx.fillStyle = '#221c33'; circle(thx, thy - 4, 4.2); ctx.fill();
            ctx.fillStyle = '#ffb03a';
            ctx.beginPath(); ctx.moveTo(thx + 3.6, thy - 4.6); ctx.lineTo(thx + 7, thy - 3.6); ctx.lineTo(thx + 3.6, thy - 2.8); ctx.closePath(); ctx.fill();
          }
        } else {
          ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(17, -9); ctx.stroke();
          ctx.strokeStyle = '#e8c34a'; ctx.lineWidth = 1.8;
          [-2.4, 0, 2.4].forEach(function (fo) {
            ctx.beginPath(); ctx.moveTo(17, -9); ctx.lineTo(20.5, -9 + fo); ctx.stroke();
          });
          ctx.fillStyle = '#221c33'; circle(17, -13.5, 4.2); ctx.fill();
          ctx.fillStyle = '#ffd23e'; circle(18.2, -14.4, 0.8); ctx.fill();
          ctx.fillStyle = '#ffb03a';
          ctx.beginPath(); ctx.moveTo(20.4, -14); ctx.lineTo(23.6, -13); ctx.lineTo(20.4, -12.2); ctx.closePath(); ctx.fill();
        }
        // burlap head: button eyes, carrot nose, stitched smile
        var scf = ctx.createRadialGradient(-3, -30, 3, 0, -27, 11);
        scf.addColorStop(0, '#f2d191'); scf.addColorStop(1, '#d9a95f');
        ctx.fillStyle = scf; circle(0, -27, 10.5); ctx.fill();
        ctx.fillStyle = '#33241a'; circle(-3.8, -28, 1.6); ctx.fill(); circle(3.8, -28, 1.6); ctx.fill();
        ctx.fillStyle = '#e86a17';
        ctx.beginPath(); ctx.moveTo(0, -26.4); ctx.lineTo(-1.8, -23.4); ctx.lineTo(1.8, -23.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#7a4a21'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, -23.5, 4.4, 0.35, 2.79); ctx.stroke();
        [-3, 0, 3].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx, -21.4); ctx.lineTo(sx, -19.6); ctx.stroke();
        });
        ctx.fillStyle = 'rgba(255,120,90,.5)'; circle(-7.4, -24, 2.4); ctx.fill(); circle(7.4, -24, 2.4); ctx.fill();
        // straw hat: wide brim + domed top + red band
        var sch = ctx.createLinearGradient(0, -46, 0, -32);
        sch.addColorStop(0, '#eec95e'); sch.addColorStop(1, '#d29a35');
        ctx.fillStyle = sch;
        ctx.beginPath(); ctx.ellipse(0, -34.5, 15.5, 4.2, 0, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-8.5, -35); ctx.quadraticCurveTo(0, -47, 8.5, -35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a33b1f'; ctx.fillRect(-8.6, -36.6, 17.2, 2.8);
      } else if (kind === 'zombie') {
        // Zombie, redrawn well away from Frankenstein: no green
        // skin, no dark suit. A hunched, shambling corpse in
        // grey-brown decay tones and torn brown rags — head sunk
        // low between sloped shoulders, both arms dangling long
        // past the body — and a DETACHABLE right arm: while it is
        // away flying (armless) only the torn sleeve stump is drawn
        // the hump of its hunched back, behind everything
        ctx.fillStyle = '#4c3a24';
        ctx.beginPath(); ctx.ellipse(0, -15, 15.5, 13.5, 0, 0, 6.3); ctx.fill();
        // torso: torn rags with a jagged ripped hem
        var zg = ctx.createLinearGradient(0, -20, 0, 6);
        zg.addColorStop(0, '#6e5a3a'); zg.addColorStop(1, '#47351f');
        ctx.fillStyle = zg;
        ctx.beginPath();
        ctx.moveTo(-12, -13);
        ctx.quadraticCurveTo(-10.5, -19, -4, -19.5);
        ctx.quadraticCurveTo(3, -20.5, 8, -18);
        ctx.quadraticCurveTo(12, -16, 12.5, -10);
        ctx.lineTo(13, 2);
        ctx.lineTo(8, 0); ctx.lineTo(5, 4.5); ctx.lineTo(1, 0.5);
        ctx.lineTo(-3, 5); ctx.lineTo(-7, 0.5); ctx.lineTo(-13, 2.5);
        ctx.closePath(); ctx.fill();
        // a rip in the rags showing the grubby undershirt beneath
        ctx.fillStyle = '#8d7c62';
        ctx.beginPath(); ctx.ellipse(-3.5, -5, 4.2, 5.6, 0.25, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(52,40,24,.65)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-6.4, -8.6); ctx.lineTo(-4.4, -6.8); ctx.moveTo(-4.4, -8.6); ctx.lineTo(-6.4, -6.8); ctx.stroke();
        // a stitched-on patch
        ctx.save(); ctx.translate(7, -8.5); ctx.rotate(0.18);
        ctx.fillStyle = '#7d6c4c'; ctx.fillRect(-3.5, -3, 7, 6);
        ctx.strokeStyle = 'rgba(52,40,24,.6)'; ctx.lineWidth = 0.9; ctx.setLineDash([1.6, 1.6]);
        ctx.strokeRect(-3.5, -3, 7, 6); ctx.setLineDash([]);
        ctx.restore();
        // torn collar: a wedge of dull skin at the neck
        ctx.fillStyle = '#8d7c62';
        ctx.beginPath(); ctx.moveTo(-2, -19.2); ctx.lineTo(3, -19.2); ctx.lineTo(0, -14); ctx.closePath(); ctx.fill();
        // the head: sunk low and tilted, grey-brown and gaunt
        ctx.save(); ctx.translate(1.5, -23.5); ctx.rotate(0.10);
        var zh = ctx.createLinearGradient(0, -13, 0, 11);
        zh.addColorStop(0, '#b3a58c'); zh.addColorStop(1, '#87765c');
        ctx.fillStyle = zh;
        rr(-10.5, -12.5, 21, 23.5, 8); ctx.fill();
        // sparse strands of dark hair on a mostly bald scalp
        ctx.strokeStyle = '#38302a'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
        [-5, -0.5, 3.5].forEach(function (sx) {
          ctx.beginPath(); ctx.moveTo(sx, -12); ctx.quadraticCurveTo(sx + 1, -15, sx + 3, -14.4); ctx.stroke();
        });
        // sunken eye sockets: one milky blind eye, one dark dead one
        ctx.fillStyle = 'rgba(46,36,24,.45)';
        ctx.beginPath(); ctx.ellipse(-4.5, -0.5, 3.5, 2.9, 0, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, 0, 3, 2.6, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#e8e1cb'; circle(-4.5, -0.5, 1.9); ctx.fill();
        ctx.fillStyle = '#6b5a41'; circle(-4.3, 0.1, 0.7); ctx.fill();
        ctx.fillStyle = '#2e2417'; circle(5, 0.2, 1.25); ctx.fill();
        ctx.strokeStyle = 'rgba(46,36,24,.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(2.8, -1.8); ctx.lineTo(7.2, -1.4); ctx.stroke();
        ctx.fillStyle = 'rgba(46,36,24,.35)';
        rr(-8, -5.6, 6.5, 1.8, 0.9); ctx.fill(); rr(2, -5.2, 6, 1.7, 0.85); ctx.fill();
        // nose shadow and a scar stitched across the cheek
        ctx.strokeStyle = 'rgba(70,58,40,.8)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0.5, 1.5); ctx.lineTo(-0.3, 4.2); ctx.lineTo(1.2, 4.4); ctx.stroke();
        ctx.strokeStyle = '#6e5c40';
        ctx.beginPath(); ctx.moveTo(7.2, 3.4); ctx.lineTo(9.8, 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7.8, 3.2); ctx.lineTo(7.6, 5); ctx.moveTo(9, 4.4); ctx.lineTo(8.8, 6.2); ctx.stroke();
        // crooked gaping mouth, one lone tooth
        ctx.fillStyle = '#33241a';
        ctx.beginPath(); ctx.ellipse(0.5, 7.6, 3.3, 2.4, -0.15, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#efe8d8'; ctx.fillRect(-1.6, 5.7, 1.9, 1.7);
        // a droopy ear
        ctx.fillStyle = '#9a8867'; circle(-10.3, 0.5, 2.3); ctx.fill();
        ctx.restore();
        // left arm: torn sleeve, then bare forearm dangling long
        // past the hem, fingers limp
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.moveTo(-11, -11); ctx.lineTo(-14.5, -1); ctx.stroke();
        ctx.strokeStyle = '#9a8867'; ctx.lineWidth = 4.2;
        ctx.beginPath(); ctx.moveTo(-14.5, -1); ctx.lineTo(-15.5, 6.5); ctx.stroke();
        ctx.fillStyle = '#9a8867'; circle(-15.5, 7, 2.7); ctx.fill();
        // the right arm: throwing, dangling — or simply GONE
        if (armless) {
          ctx.fillStyle = '#5a4630'; circle(11.5, -10.5, 3.3); ctx.fill();
          ctx.fillStyle = '#8a7658'; circle(12.3, -10.5, 1.4); ctx.fill();
        } else if (throwing) {
          ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 5.5;
          ctx.beginPath(); ctx.moveTo(11, -10.5); ctx.lineTo(thx, thy); ctx.stroke();
          ctx.fillStyle = '#9a8867'; circle(thx, thy, 2.9); ctx.fill();
        } else {
          ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 5.5;
          ctx.beginPath(); ctx.moveTo(11, -10.5); ctx.lineTo(14.5, -1); ctx.stroke();
          ctx.strokeStyle = '#9a8867'; ctx.lineWidth = 4.2;
          ctx.beginPath(); ctx.moveTo(14.5, -1); ctx.lineTo(15.5, 6.5); ctx.stroke();
          ctx.fillStyle = '#9a8867'; circle(15.5, 7, 2.7); ctx.fill();
        }
      } else if (kind === 'werewolf') {
        // Werewolf: a shaggy brown wolf with a cream belly. Throwing
        // means HOWLING — the head tips back, the jaws open wide
        // and both paws lift; the buff ring itself rolls out in
        // the world (drawn with the other rings in draw())
        var wwg = ctx.createLinearGradient(0, -14, 0, 8);
        wwg.addColorStop(0, '#7a5a38'); wwg.addColorStop(1, '#54391f');
        ctx.fillStyle = wwg;
        rr(-11, -13, 22, 19, 7); ctx.fill();
        ctx.fillStyle = '#caa27e';
        ctx.beginPath(); ctx.ellipse(0, 0, 6.8, 6, 0, 0, 6.3); ctx.fill();
        ctx.save();
        ctx.translate(0, -16);
        if (throwing) ctx.rotate(-0.3 * Math.sin(throwQ * Math.PI));
        ctx.fillStyle = '#5d4023';
        ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(-12.5, -24); ctx.lineTo(-4.5, -18); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(11, -14); ctx.lineTo(12.5, -24); ctx.lineTo(4.5, -18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#caa27e';
        ctx.beginPath(); ctx.moveTo(-9.8, -16.4); ctx.lineTo(-10.6, -21.6); ctx.lineTo(-6.2, -18.2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(9.8, -16.4); ctx.lineTo(10.6, -21.6); ctx.lineTo(6.2, -18.2); ctx.closePath(); ctx.fill();
        var wh2 = ctx.createRadialGradient(-3, -14, 3, 0, -10, 14);
        wh2.addColorStop(0, '#966f42'); wh2.addColorStop(1, '#6e4e2a');
        ctx.fillStyle = wh2;
        ctx.beginPath();
        ctx.moveTo(-11, -6);
        ctx.lineTo(-13, -1); ctx.lineTo(-9.5, -0.5);
        ctx.quadraticCurveTo(-10, 4, -5, 5.5);
        ctx.lineTo(5, 5.5);
        ctx.quadraticCurveTo(10, 4, 9.5, -0.5);
        ctx.lineTo(13, -1); ctx.lineTo(11, -6);
        ctx.quadraticCurveTo(10, -16, 0, -16.5);
        ctx.quadraticCurveTo(-10, -16, -11, -6);
        ctx.closePath(); ctx.fill();
        // snout + shiny nose
        ctx.fillStyle = '#caa27e';
        ctx.beginPath(); ctx.ellipse(0, 0.5, 6.4, 4.6, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#2c1c10';
        ctx.beginPath(); ctx.ellipse(0, -1.8, 2.9, 2.1, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(-0.9, -2.4, 0.8); ctx.fill();
        if (throwing) {
          // jaws wide mid-howl, little fangs showing
          ctx.fillStyle = '#57262b';
          ctx.beginPath(); ctx.ellipse(0, 3.6, 3.4, 2.7, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-3, 1.4); ctx.lineTo(-1.4, 1.4); ctx.lineTo(-2.2, 3.6); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(1.4, 1.4); ctx.lineTo(3, 1.4); ctx.lineTo(2.2, 3.6); ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = '#3a2712'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0.4); ctx.lineTo(0, 2);
          ctx.moveTo(0, 2); ctx.quadraticCurveTo(-2.4, 3.4, -4.2, 2.2);
          ctx.moveTo(0, 2); ctx.quadraticCurveTo(2.4, 3.4, 4.2, 2.2); ctx.stroke();
        }
        ctx.fillStyle = '#ffb03a'; circle(-5.6, -9, 2.3); ctx.fill(); circle(5.6, -9, 2.3); ctx.fill();
        ctx.fillStyle = '#241203'; circle(-5.6, -8.8, 1.1); ctx.fill(); circle(5.6, -8.8, 1.1); ctx.fill();
        ctx.strokeStyle = '#54391f'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8, -12.4); ctx.lineTo(-3.4, -11.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, -12.4); ctx.lineTo(3.4, -11.4); ctx.stroke();
        ctx.restore();
        // paws: resting at the sides, lifted mid-howl
        ctx.strokeStyle = '#54391f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        if (throwing) {
          ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-15, -14); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(15, -14); ctx.stroke();
          ctx.fillStyle = '#caa27e'; circle(-15.5, -14.5, 2.8); ctx.fill(); circle(15.5, -14.5, 2.8); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-14, 1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(14, 1); ctx.stroke();
          ctx.fillStyle = '#caa27e'; circle(-14.5, 1.5, 2.8); ctx.fill(); circle(14.5, 1.5, 2.8); ctx.fill();
        }
      } else if (kind === 'slime') {
        // Slime: a wobbly translucent green blob with the face
        // floating inside the goo. Firing squeezes the whole body
        // (the shared throw squash does that) and a goo ball bulges
        // at the launch point mid-spit
        var wob = Math.sin(t * 3.2 + x) * 0.7;
        ctx.save();
        ctx.globalAlpha = 0.92;
        var slg = ctx.createLinearGradient(0, -26, 0, 6);
        slg.addColorStop(0, '#b6f29a'); slg.addColorStop(1, '#58b368');
        ctx.fillStyle = slg;
        ctx.beginPath();
        ctx.moveTo(-13, 5);
        ctx.quadraticCurveTo(-14.5, -8 - wob, -8, -16);
        ctx.quadraticCurveTo(-4, -25 - wob, 0, -25 - wob);
        ctx.quadraticCurveTo(5, -25 - wob, 8.5, -16);
        ctx.quadraticCurveTo(14.5, -8 + wob, 13, 5);
        ctx.quadraticCurveTo(6, 8, 0, 7.4);
        ctx.quadraticCurveTo(-6, 8, -13, 5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.ellipse(-5.5, -17, 3.4, 5, -0.4, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        circle(6.5, -6, 1.7); ctx.fill(); circle(3.4, -12.5, 1.1); ctx.fill(); circle(-7.5, -4, 1.2); ctx.fill();
        // the face, floating inside the goo
        ctx.fillStyle = '#1e4d24'; circle(-4.2, -12, 1.9); ctx.fill(); circle(4.2, -12, 1.9); ctx.fill();
        ctx.fillStyle = '#fff'; circle(-4.8, -12.7, 0.7); ctx.fill(); circle(3.6, -12.7, 0.7); ctx.fill();
        ctx.strokeStyle = '#1e4d24'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -8.6, 3.2, 0.35, 2.79); ctx.stroke();
        ctx.fillStyle = 'rgba(255,130,150,.45)'; circle(-8.6, -8.4, 2.3); ctx.fill(); circle(8.6, -8.4, 2.3); ctx.fill();
        ctx.restore();
        if (throwing && throwQ < 0.5) {
          ctx.fillStyle = 'rgba(139,226,110,.75)'; circle(thx, thy - 2, 6.4); ctx.fill();
          ctx.fillStyle = '#8be26e'; circle(thx, thy - 2, 4.4); ctx.fill();
          ctx.fillStyle = '#d8ffb0'; circle(thx - 1.4, thy - 3.6, 1.5); ctx.fill();
        }
      }
      // growth accessories: Lv2 adds each monster's signature extra,
      // Lv3 completes the regalia — visible at a glance across the field
      if (lvl >= 2) {
        if (kind === 'franken') {
          // the neck bolts glow with stored charge
          ctx.save(); ctx.shadowColor = 'rgba(255,210,62,.95)'; ctx.shadowBlur = 7;
          ctx.fillStyle = '#ffd23e'; circle(-16.5, -22, 2.2); ctx.fill(); circle(16.5, -22, 2.2); ctx.fill();
          ctx.restore();
        } else if (kind === 'ghost') {
          // a pink bow on top
          ctx.fillStyle = '#ff5d8f';
          ctx.beginPath(); ctx.moveTo(6, -19); ctx.lineTo(13, -23); ctx.lineTo(13, -15); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -19); ctx.lineTo(-1, -23); ctx.lineTo(-1, -15); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd3e4'; circle(6, -19, 1.8); ctx.fill();
        } else if (kind === 'witch') {
          // a gold bell on the hat tip
          ctx.fillStyle = '#ffd23e'; circle(2.5, -51, 2.6); ctx.fill();
          ctx.fillStyle = '#b8860b'; circle(2.5, -50, 0.9); ctx.fill();
        } else if (kind === 'mummy') {
          // a golden headband
          ctx.fillStyle = '#e8b93c'; ctx.fillRect(-12.5, -27.5, 25, 3);
          ctx.fillStyle = '#fff3cf'; circle(0, -26, 1.4); ctx.fill();
        } else if (kind === 'cat') {
          // a red collar with a gold bell
          ctx.strokeStyle = '#e8402f'; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.arc(0, -1, 8.5, 0.5, 2.64); ctx.stroke();
          ctx.fillStyle = '#ffd23e'; circle(0, 6.5, 2.6); ctx.fill();
        } else if (kind === 'skeleton') {
          // one gold tooth in the grin
          ctx.fillStyle = '#ffd23e'; ctx.fillRect(-1.3, -19.4, 2.6, 3.4);
        } else if (kind === 'spider') {
          // an orange hourglass mark on the big abdomen (above the
          // little head) + a silk tuft on top of the abdomen
          ctx.fillStyle = '#ff7a1a';
          ctx.beginPath(); ctx.moveTo(-2.6, -20.2); ctx.lineTo(2.6, -20.2); ctx.lineTo(0, -17.8); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-2.6, -15.4); ctx.lineTo(2.6, -15.4); ctx.lineTo(0, -17.6); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#f0eefb'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-3, -29); ctx.quadraticCurveTo(0, -32.5, 3, -29); ctx.stroke();
        } else if (kind === 'bat') {
          // a gold earring on one ear
          ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(-8.6, -21.4, 2.2, 0, 6.3); ctx.stroke();
        } else if (kind === 'scarecrow') {
          // a sunflower pinned to the hat brim
          ctx.fillStyle = '#ffb03a';
          for (var sfp = 0; sfp < 6; sfp++) { var sfa = sfp * Math.PI / 3; circle(10.6 + Math.cos(sfa) * 2.7, -37.4 + Math.sin(sfa) * 2.7, 1.9); ctx.fill(); }
          ctx.fillStyle = '#5d3a14'; circle(10.6, -37.4, 2); ctx.fill();
        } else if (kind === 'zombie') {
          // a fancy red bow tie, absurdly intact
          ctx.fillStyle = '#e8402f';
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(-5, -15.6); ctx.lineTo(-5, -10.4); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(5, -15.6); ctx.lineTo(5, -10.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#b02018'; circle(0, -13, 1.5); ctx.fill();
        } else if (kind === 'werewolf') {
          // a silver crescent-moon pendant on the belly fur
          ctx.fillStyle = '#dfe6f2'; circle(0, 1.5, 3.1); ctx.fill();
          ctx.fillStyle = '#caa27e'; circle(1.1, 0.6, 2.3); ctx.fill();
        } else if (kind === 'slime') {
          // a little leaf sprout growing out of the goo
          ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, -25); ctx.quadraticCurveTo(0.5, -28, 1.8, -29.4); ctx.stroke();
          ctx.fillStyle = '#66bb4a';
          ctx.beginPath(); ctx.ellipse(-1.8, -28.8, 3.1, 1.7, -0.6, 0, 6.3); ctx.fill();
          ctx.beginPath(); ctx.ellipse(3.4, -29.6, 2.7, 1.5, 0.5, 0, 6.3); ctx.fill();
        }
      }
      if (lvl >= 3) {
        if (kind === 'franken') {
          // charge crackles around the head
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath();
          if (Math.sin(t * 9 + x) > 0) { ctx.moveTo(-17, -34); ctx.lineTo(-21, -29); ctx.lineTo(-17.5, -28); }
          else { ctx.moveTo(17, -36); ctx.lineTo(21, -31); ctx.lineTo(17.5, -30); }
          ctx.stroke();
        } else if (kind === 'ghost') {
          // a little gold crown
          ctx.fillStyle = '#ffd23e';
          ctx.beginPath();
          ctx.moveTo(-5, -20); ctx.lineTo(-5, -25); ctx.lineTo(-2.5, -22); ctx.lineTo(0, -25.5); ctx.lineTo(2.5, -22); ctx.lineTo(5, -25); ctx.lineTo(5, -20);
          ctx.closePath(); ctx.fill();
        } else if (kind === 'witch') {
          // an amethyst gem on the dress
          ctx.save(); ctx.shadowColor = 'rgba(199,146,255,.9)'; ctx.shadowBlur = 6;
          ctx.fillStyle = '#c792ff';
          ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(3, 1); ctx.lineTo(0, 5); ctx.lineTo(-3, 1); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (kind === 'mummy') {
          // a gold ankh pendant
          ctx.strokeStyle = '#e8b93c'; ctx.lineWidth = 1.8;
          circle(0, -6, 2.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -3.6); ctx.lineTo(0, 2.5); ctx.moveTo(-2.6, -0.8); ctx.lineTo(2.6, -0.8); ctx.stroke();
        } else if (kind === 'cat') {
          // the crescent pendant glows at full power
          ctx.save(); ctx.shadowColor = 'rgba(255,176,58,.95)'; ctx.shadowBlur = 8;
          ctx.fillStyle = '#ffb03a'; circle(0, 2, 3.6); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#241640'; circle(1.2, 1.2, 2.5); ctx.fill();
        } else if (kind === 'skeleton') {
          // a dapper little top hat
          ctx.fillStyle = '#1c1030';
          ctx.fillRect(-8, -41.5, 16, 3);
          ctx.fillRect(-5.5, -49, 11, 8);
          ctx.fillStyle = '#7a1030'; ctx.fillRect(-5.5, -43.5, 11, 2.4);
        } else if (kind === 'spider') {
          // a golden silk crown, worn on top of the big abdomen
          ctx.fillStyle = '#ffd23e';
          ctx.beginPath();
          ctx.moveTo(-5, -29.2); ctx.lineTo(-5, -33.7); ctx.lineTo(-2.4, -31.1); ctx.lineTo(0, -34.7); ctx.lineTo(2.4, -31.1); ctx.lineTo(5, -33.7); ctx.lineTo(5, -29.2);
          ctx.closePath(); ctx.fill();
        } else if (kind === 'bat') {
          // a ruby amulet at the throat, glowing
          ctx.save(); ctx.shadowColor = 'rgba(255,80,90,.95)'; ctx.shadowBlur = 7;
          ctx.fillStyle = '#ff4d5e';
          ctx.beginPath(); ctx.moveTo(0, -4.6); ctx.lineTo(2.8, -1.4); ctx.lineTo(0, 2); ctx.lineTo(-2.8, -1.4); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (kind === 'scarecrow') {
          // a gold pumpkin brooch on the chest
          ctx.save(); ctx.shadowColor = 'rgba(255,160,40,.9)'; ctx.shadowBlur = 5;
          ctx.fillStyle = '#ffb03a'; circle(0, -6, 3.4); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#7a4a12';
          ctx.beginPath(); ctx.moveTo(-1.9, -6.8); ctx.lineTo(-0.7, -6.8); ctx.lineTo(-1.3, -5.4); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0.7, -6.8); ctx.lineTo(1.9, -6.8); ctx.lineTo(1.3, -5.4); ctx.closePath(); ctx.fill();
        } else if (kind === 'zombie') {
          // a golden tooth in the crooked mouth, and the milky eye
          // burning bright (both at the redrawn face's new spots)
          ctx.fillStyle = '#ffd23e'; ctx.fillRect(-0.8, -18, 2, 1.8);
          ctx.save(); ctx.shadowColor = 'rgba(255,225,77,.95)'; ctx.shadowBlur = 6;
          ctx.fillStyle = '#ffe14d'; circle(-2.9, -24.4, 1.7); ctx.fill();
          ctx.restore();
        } else if (kind === 'werewolf') {
          // a golden ear cuff (head-local ears sit at y ≈ -35 up
          // here) and eyes burning at full power
          ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 1.7;
          ctx.beginPath(); ctx.arc(11.8, -35, 2.1, 0, 6.3); ctx.stroke();
          ctx.save(); ctx.shadowColor = 'rgba(255,176,58,.95)'; ctx.shadowBlur = 6;
          ctx.fillStyle = '#ffb03a'; circle(-5.6, -25, 2.4); ctx.fill(); circle(5.6, -25, 2.4); ctx.fill();
          ctx.restore();
        } else if (kind === 'slime') {
          // a tiny gold crown, and sparkles swimming in the goo
          ctx.fillStyle = '#ffd23e';
          ctx.beginPath();
          ctx.moveTo(-4.4, -25.5); ctx.lineTo(-4.4, -29.4); ctx.lineTo(-2.2, -27.2); ctx.lineTo(0, -29.8); ctx.lineTo(2.2, -27.2); ctx.lineTo(4.4, -29.4); ctx.lineTo(4.4, -25.5);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.8)';
          circle(7.6, -15, 1); ctx.fill(); circle(-8.8, -11, 0.9); ctx.fill();
        }
      }
      ctx.restore();
    }
    /* the werewolf's OTHER body: a giant wolf, drawn far bigger
       than the tower werewolf, out on the road mid-pounce. Local
       space: origin at the ground under its belly, facing +x (the
       caller flips by leap.face), feet at y = 0, back at about
       y = -37. While it mauls, the near foreleg rakes down and
       three pale claw arcs slash the air ahead of the paw */
    function drawGiantWolf(tw, t) {
      var lp = tw.leap;
      var lvl = tw.level;
      var gs = 1.3 * LVL_SCALE[lvl - 1] * 1.8;
      // ground shadow stays on the road while the wolf is airborne
      var shr = Math.max(0.45, 1 - lp.lift / 130);
      ctx.fillStyle = 'rgba(12,6,30,.35)';
      ctx.beginPath(); ctx.ellipse(lp.x, lp.y + 3, 34 * gs * shr, 7 * gs * shr, 0, 0, 6.3); ctx.fill();
      ctx.save();
      ctx.translate(lp.x, lp.y - lp.lift);
      if (lp.phase === 'claw') ctx.translate(Math.sin(t * 42) * 1.6, -Math.abs(Math.sin(t * 21)) * 1.2);
      ctx.scale(gs * lp.face, gs);
      if (lvl === 1) ctx.filter = 'saturate(0.55) brightness(1.07)';
      var flying = (lp.phase === 'out' || lp.phase === 'back');
      var swipeP = lp.swipeAge < 0.22 ? lp.swipeAge / 0.22 : -1;
      // tail: thick, raised, dark at the tip
      ctx.strokeStyle = '#54391f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-24, -20); ctx.quadraticCurveTo(-36, -26, -38, -36 + Math.sin(t * 6) * 2); ctx.stroke();
      ctx.strokeStyle = '#3a2712'; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(-35.5, -31); ctx.quadraticCurveTo(-37, -34, -38, -36 + Math.sin(t * 6) * 2); ctx.stroke();
      // far legs (darker, behind the body)
      ctx.strokeStyle = '#54391f'; ctx.lineWidth = 6;
      if (flying) {
        ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(-24, -4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, -12); ctx.lineTo(24, -5); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-17, -12); ctx.lineTo(-18, -1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(15, -12); ctx.lineTo(14, -1); ctx.stroke();
      }
      // the body: one big shaggy mass
      var wg = ctx.createLinearGradient(0, -36, 0, -2);
      wg.addColorStop(0, '#8a653c'); wg.addColorStop(1, '#5d4023');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.ellipse(0, -19, 28, 14.5, 0, 0, 6.3); ctx.fill();
      // shaggy spine spikes
      ctx.fillStyle = '#54391f';
      [-20, -12, -4, 4, 12].forEach(function (sx) {
        ctx.beginPath(); ctx.moveTo(sx - 3.5, -30.5); ctx.lineTo(sx, -37); ctx.lineTo(sx + 3.5, -30.5); ctx.closePath(); ctx.fill();
      });
      // cream belly
      ctx.fillStyle = '#caa27e';
      ctx.beginPath(); ctx.ellipse(2, -11, 19, 7, 0, 0, 6.3); ctx.fill();
      // near hind leg
      ctx.strokeStyle = '#6e4e2a'; ctx.lineWidth = 6.5;
      if (flying) {
        ctx.beginPath(); ctx.moveTo(-13, -12); ctx.lineTo(-19, -3); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-13, -13); ctx.lineTo(-12, -1); ctx.stroke();
        ctx.fillStyle = '#caa27e'; circle(-12, 0, 3); ctx.fill();
      }
      // near foreleg: planted — or RAKING while a swipe lands
      ctx.strokeStyle = '#6e4e2a'; ctx.lineWidth = 6.5;
      if (swipeP >= 0) {
        var pawX = 26 + swipeP * 12, pawY = -16 + swipeP * 14;
        ctx.beginPath(); ctx.moveTo(17, -13); ctx.lineTo(pawX, pawY); ctx.stroke();
        ctx.fillStyle = '#caa27e'; circle(pawX, pawY, 3.4); ctx.fill();
        // the claws themselves: three pale arcs raking down-forward
        ctx.strokeStyle = 'rgba(255,246,224,' + (0.95 * (1 - swipeP * 0.5)) + ')'; ctx.lineWidth = 2.2;
        [-5, 0, 5].forEach(function (off) {
          ctx.beginPath();
          ctx.moveTo(pawX + 3 + off * 0.4, pawY - 3 + off);
          ctx.quadraticCurveTo(pawX + 10 + off * 0.4, pawY + 2 + off, pawX + 7 + off * 0.4, pawY + 9 + off);
          ctx.stroke();
        });
      } else if (flying) {
        ctx.beginPath(); ctx.moveTo(17, -13); ctx.lineTo(25, -4); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(17, -13); ctx.lineTo(18, -1); ctx.stroke();
        ctx.fillStyle = '#caa27e'; circle(18, 0, 3); ctx.fill();
      }
      // the head: big, up front, ears pricked, jaws open mid-maul
      ctx.save(); ctx.translate(29, -27);
      if (flying) ctx.rotate(-0.06); else if (swipeP >= 0) ctx.rotate(0.10);
      ctx.fillStyle = '#5d4023';
      ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-10.5, -17); ctx.lineTo(-3.5, -12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7, -9); ctx.lineTo(9.5, -17.5); ctx.lineTo(1.5, -12.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#caa27e';
      ctx.beginPath(); ctx.moveTo(-8.2, -10.4); ctx.lineTo(-9, -14.6); ctx.lineTo(-5, -11.8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6.6, -11.4); ctx.lineTo(8, -14.8); ctx.lineTo(3.8, -11.6); ctx.closePath(); ctx.fill();
      var hg = ctx.createRadialGradient(-3, -8, 3, 0, -4, 15);
      hg.addColorStop(0, '#966f42'); hg.addColorStop(1, '#6e4e2a');
      ctx.fillStyle = hg; circle(0, -4, 12.5); ctx.fill();
      // shaggy cheek tufts
      ctx.fillStyle = '#6e4e2a';
      ctx.beginPath(); ctx.moveTo(-11.5, 0); ctx.lineTo(-14.5, 4); ctx.lineTo(-10.5, 4.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10.5, -1); ctx.lineTo(13.5, 3); ctx.lineTo(9.5, 3.5); ctx.closePath(); ctx.fill();
      // snout + shiny nose
      ctx.fillStyle = '#caa27e';
      ctx.beginPath(); ctx.ellipse(8.5, 1.5, 7.5, 5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#2c1c10';
      ctx.beginPath(); ctx.ellipse(14.5, -0.5, 3.2, 2.4, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(13.6, -1.3, 0.9); ctx.fill();
      // jaws: open and fanged while flying or mauling, shut at rest
      if (flying || lp.phase === 'claw') {
        ctx.fillStyle = '#57262b';
        ctx.beginPath(); ctx.ellipse(7.5, 5.6, 5, 3.2, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(3.4, 3); ctx.lineTo(5.4, 3); ctx.lineTo(4.4, 6.4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(9, 3); ctx.lineTo(11, 3); ctx.lineTo(10, 6.4); ctx.closePath(); ctx.fill();
      } else {
        ctx.strokeStyle = '#3a2712'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(8, 3.4); ctx.quadraticCurveTo(11, 4.6, 14, 3.4); ctx.stroke();
      }
      // amber eyes (burning at Lv3, like the tower form's)
      if (lvl === 3) { ctx.save(); ctx.shadowColor = 'rgba(255,176,58,.95)'; ctx.shadowBlur = 7; }
      ctx.fillStyle = '#ffb03a'; circle(-2.5, -6.5, 2.6); ctx.fill(); circle(6.5, -6.5, 2.6); ctx.fill();
      if (lvl === 3) ctx.restore();
      ctx.fillStyle = '#241203'; circle(-2.3, -6.3, 1.2); ctx.fill(); circle(6.7, -6.3, 1.2); ctx.fill();
      ctx.strokeStyle = '#54391f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6.5, -10.5); ctx.lineTo(-0.5, -9.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -10.5); ctx.lineTo(4.5, -9.6); ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    /* ---------- build sites: gravestone -> topple -> monster rises ---------- */
    function stoneBody(style) {
      var tg = ctx.createLinearGradient(0, -46, 0, 4);
      tg.addColorStop(0, '#b3a8d4'); tg.addColorStop(1, '#7c6ea6');
      ctx.fillStyle = tg;
      if (style === 'cross') {
        // cross-shaped headstone: upright post + crossbar
        rr(-6.5, -46, 13, 44, 3); ctx.fill();
        rr(-17, -35, 34, 12, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        rr(-4.5, -44, 4, 38, 2); ctx.fill();
        rr(-15, -33.5, 30, 3.4, 1.7); ctx.fill();
        ctx.fillStyle = 'rgba(43,28,84,.35)';
        circle(-2, -12, 1.5); ctx.fill(); circle(8, -27, 1.3); ctx.fill();
      } else if (style === 'stele') {
        // flat-top tablet stone with an engraved panel
        ctx.beginPath();
        ctx.moveTo(-17, 2); ctx.lineTo(-17, -33); ctx.lineTo(-10, -41); ctx.lineTo(10, -41); ctx.lineTo(17, -33); ctx.lineTo(17, 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(-14, -38, 28, 5, 2); ctx.fill();
        ctx.strokeStyle = 'rgba(43,28,84,.6)'; ctx.lineWidth = 1.8;
        rr(-10.5, -31, 21, 24, 3); ctx.stroke();
        ctx.strokeStyle = 'rgba(43,28,84,.5)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -22); ctx.lineTo(6, -22);
        ctx.moveTo(-6, -15); ctx.lineTo(3, -15);
        ctx.stroke();
        ctx.fillStyle = 'rgba(43,28,84,.4)'; circle(0, -27.5, 1.7); ctx.fill();
      } else {
        // classic round-top stone with a carved cross
        rr(-16, -44, 32, 46, 15); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(-13, -41, 26, 6, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(43,28,84,.7)'; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -34); ctx.lineTo(0, -20);
        ctx.moveTo(-5.5, -29); ctx.lineTo(5.5, -29);
        ctx.stroke();
        ctx.fillStyle = 'rgba(43,28,84,.35)';
        circle(-7, -9, 1.6); ctx.fill(); circle(6, -13, 1.3); ctx.fill();
      }
      // shared base slab
      ctx.fillStyle = '#65548f'; rr(-20, -3, 40, 8, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(-20, -3, 40, 3, 2); ctx.fill();
    }
    function drawSiteStone(x, y, rot, style) {
      ctx.fillStyle = 'rgba(70,45,20,.5)';
      ctx.beginPath(); ctx.ellipse(x, y + 19, 24, 6, 0, 0, 6.3); ctx.fill();
      ctx.save(); ctx.translate(x, y + 16); ctx.rotate(rot); stoneBody(style); ctx.restore();
    }
    function drawFallenStone(x, y, style) {
      var side = x > 225 ? -1 : 1; // right-edge graves fall inward
      ctx.save();
      ctx.translate(x + side * 32, y + 15); ctx.rotate(side * 1.52); ctx.scale(0.92, 0.92);
      ctx.globalAlpha = 0.95;
      stoneBody(style);
      ctx.restore();
    }
    function drawSites(t) {
      var canPlace = !!(started && playing && state.phase === 'playing' && state.pendingKind);
      // a banked pick makes every empty grave shake wildly until
      // the pick is spent — the unmissable "tap me" cue
      var wildShake = pickCueActive() && hasEmptySite();
      SITES.forEach(function (site) {
        if (site.phase === 'empty') {
          if (canPlace) {
            var pu = 0.5 + 0.5 * Math.sin(t * 3.2 + site.x * 0.7);
            ctx.fillStyle = 'rgba(255,176,80,.09)';
            circle(site.x, site.y, TOWER_DEFS[state.pendingKind].range); ctx.fill();
            ctx.strokeStyle = 'rgba(255,190,90,' + (0.55 + 0.4 * pu) + ')'; ctx.lineWidth = 2.6;
            circle(site.x, site.y + 8, 27 + 3 * pu); ctx.stroke();
            // bouncing chevron above the stone: "tap here to place"
            var chy = site.y - 56 + Math.sin(t * 4.2 + site.x * 0.7) * 3.5;
            ctx.fillStyle = '#ffb03a';
            ctx.beginPath();
            ctx.moveTo(site.x - 8, chy); ctx.lineTo(site.x + 8, chy); ctx.lineTo(site.x, chy + 9); ctx.closePath(); ctx.fill();
          }
          // an empty stone mid-shiver wobbles a little around its
          // base: a quick decaying oscillation (a few degrees, under
          // a pixel sideways, gone in SHAKE_DUR). The gate repeats
          // the running check so a stone frozen mid-shiver by a
          // pause renders upright and still, not stuck tilted
          var shRot = 0, shX = 0;
          if (!reduceMotion && playing && state.phase === 'playing') {
            if (wildShake) {
              // wild shake: hard, fast, continuous — every empty
              // grave at once, each on its own phase so they do
              // not all lean the same way
              shRot = Math.sin(t * 14 + site.x * 1.3) * 0.11;
              shX = Math.sin(t * 17 + site.y * 1.1) * 3;
            } else if (site.shakeAge >= 0) {
              var shp = Math.min(1, site.shakeAge / SHAKE_DUR);
              var shAmp = 1 - shp;
              shRot = Math.sin(shp * Math.PI * 5) * shAmp * 0.05;
              shX = Math.sin(shp * Math.PI * 7) * shAmp * 0.8;
            }
          }
          drawSiteStone(site.x + shX, site.y, shRot, site.style);
        } else if (site.phase === 'falling') {
          var p = Math.min(1, site.anim / FALL_DUR);
          drawSiteStone(site.x, site.y, (site.x > 225 ? -1 : 1) * 1.32 * p * p, site.style);
        } else if (site.phase === 'rising') {
          var e = 1 - Math.pow(1 - Math.min(1, site.anim / RISE_DUR), 3);
          drawFallenStone(site.x, site.y, site.style);
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.65 * e;
          drawTowerBase(site.x, site.y + 8 + (1 - e) * 22, t);
          ctx.restore();
          drawMonster(site.kind, site.x, site.y + (1 - e) * 30, t, 1.3 * LVL_SCALE[0] * (0.45 + 0.55 * e), -1, 1);
        } else {
          drawFallenStone(site.x, site.y, site.style);
          drawTowerBase(site.x, site.y + 8, t);
          var tw2 = site.tower;
          var tq = tw2 && tw2.throwT > 0 ? 1 - tw2.throwT / THROW_DUR : -1;
          // a zombie whose arm is still away flying is drawn armless
          if (tw2 && tw2.kind === 'zombie' && tw2.armGone && tq < 0) tq = -2;
          var lvl = tw2 ? tw2.level : 1;
          // body size grows with level; mid-upgrade it swells from
          // the old size to the new one over the grow animation
          var mScale = 1.3 * LVL_SCALE[lvl - 1];
          if (tw2 && tw2.growT >= 0) {
            var ge = Math.min(1, tw2.growT / 0.7);
            var gs = 1 - Math.pow(1 - ge, 3);
            mScale = 1.3 * (tw2.growFrom + (LVL_SCALE[lvl - 1] - tw2.growFrom) * gs);
          }
          // a werewolf mid-pounce is OFF its stone: while it swells
          // into the giant wolf (grow) and shrinks back (shrink) it
          // is still drawn here, hugely scaled; while it is out on
          // the road the giant wolf is drawn with the kids instead
          // and the stone stands empty
          var wolfAway = !!(tw2 && tw2.leap && tw2.leap.phase !== 'grow' && tw2.leap.phase !== 'shrink');
          // a black cat out on its Lv3 pounce is OFF its stone the
          // same way: the pouncing cat is drawn over its kid with
          // the kids instead, and the stone stands empty
          var catAway = !!(tw2 && tw2.kind === 'cat' && tw2.pounce);
          if (tw2 && tw2.leap && !wolfAway) {
            var morph = tw2.leap.phase === 'grow'
              ? Math.min(1, tw2.leap.t / 0.38)
              : 1 - Math.min(1, tw2.leap.t / 0.3);
            mScale *= 1 + 1.15 * morph * morph;
          }
          if (lvl === 3 && !wolfAway && !catAway) {
            // full-form aura: a soft golden halo behind the monster
            var ag = ctx.createRadialGradient(site.x, site.y - 14, 4, site.x, site.y - 14, 46);
            ag.addColorStop(0, 'rgba(255,205,70,' + (0.30 + 0.08 * Math.sin(t * 3)) + ')');
            ag.addColorStop(1, 'rgba(255,205,70,0)');
            ctx.fillStyle = ag; circle(site.x, site.y - 14, 46); ctx.fill();
          }
          if (!wolfAway && !catAway) drawMonster(site.kind, site.x, site.y, t, mScale, tq, lvl);
          if (!wolfAway && !catAway && tw2 && tw2.flashT > 0) {
            // the bright flash the moment an upgrade lands
            ctx.fillStyle = 'rgba(255,240,190,' + (tw2.flashT / 0.55 * 0.55) + ')';
            circle(site.x, site.y - 16, 34); ctx.fill();
          }
          if (!wolfAway && !catAway) {
          // level stars above the head: one, two, three
          ctx.font = '800 11px "Baloo 2", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(50,16,0,.8)';
          var stxt = stars(lvl);
          // the stars sit a small margin above THIS tower's own
          // drawn top at its current level and size (mScale
          // already carries the level scale and any grow / wolf
          // morph swelling), never at one fixed height for all
          var mTop = MONSTER_TOP[site.kind] ? MONSTER_TOP[site.kind][lvl - 1] : -46;
          var sy = site.y + mTop * mScale - 9;
          ctx.strokeText(stxt, site.x, sy);
          ctx.fillStyle = '#ffd23e';
          ctx.fillText(stxt, site.x, sy);
          // a banked pick puts the gold LV UP! badge back over
          // every tower below level 3 — tapping the badge (or
          // the tower) upgrades it on the spot, no picker. The
          // badge bounces gently and sits 17px above the stars,
          // the same spot it used to sit before the points rework
          if (pickCueActive() && tw2 && tw2.level < 3) {
            var bBy = sy - 17 + (reduceMotion ? 0 : Math.sin(t * 5 + site.x * 0.1) * 2.5);
            ctx.fillStyle = '#ffd23e';
            rr(site.x - 27, bBy - 10, 54, 20, 10); ctx.fill();
            ctx.strokeStyle = 'rgba(50,16,0,.85)'; ctx.lineWidth = 2;
            rr(site.x - 27, bBy - 10, 54, 20, 10); ctx.stroke();
            ctx.font = '900 12px "Baloo 2", sans-serif';
            ctx.fillStyle = '#241245';
            ctx.fillText('LV UP!', site.x, bBy + 0.5);
            ctx.font = '800 11px "Baloo 2", sans-serif';
          }
          // a werewolf howl still ringing in this tower: twin gold
          // chevrons bob at its shoulders while the speed-up lasts
          if (tw2 && tw2.buffT > 0) {
            ctx.fillStyle = 'rgba(255,176,58,.95)';
            [-1, 1].forEach(function (sd) {
              var cx2 = site.x + sd * 25, cy2 = site.y - 26 + Math.sin(t * 6 + site.x + sd) * 1.8;
              ctx.beginPath();
              ctx.moveTo(cx2 - 4.5, cy2 + 1); ctx.lineTo(cx2, cy2 - 4); ctx.lineTo(cx2 + 4.5, cy2 + 1);
              ctx.lineTo(cx2 + 4.5, cy2 + 4); ctx.lineTo(cx2, cy2 - 1); ctx.lineTo(cx2 - 4.5, cy2 + 4);
              ctx.closePath(); ctx.fill();
            });
          }
          }
        }
      });
    }
    /* ---------- kids ---------- */
    function drawBucket(x, y) {
      ctx.fillStyle = '#f5820d';
      ctx.beginPath();
      ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.lineTo(x + 4, y + 8); ctx.lineTo(x - 4, y + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5d8f'; circle(x - 2, y - 1, 1.8); ctx.fill();
      ctx.fillStyle = '#4dc9ff'; circle(x + 2, y - 1, 1.8); ctx.fill();
    }
    function drawKid(k, t) {
      var s = k.scale;
      var jump = 0;
      if (k.mode === 'cheer') jump = -Math.abs(Math.sin(k.bob)) * 9;
      else if (k.mode === 'knock') jump = -Math.abs(Math.sin(k.bob)) * 2;
      var walking = (k.mode === 'walk' || k.mode === 'toSlot');
      // most kids amble with a small 2.4px bob; the two hoppers
      // (bunny and cat) BOUND down the road instead — a real hop
      // off the same bob clock, with a touch of squash-and-stretch
      // at the top of each bound. Purely how they look: their
      // speed, HP and everything else are untouched
      var hopArc = (k.hop && walking) ? Math.abs(Math.sin(k.bob)) : 0;
      var walkBob = walking ? (k.hop ? -hopArc * 8.5 : -Math.abs(Math.sin(k.bob)) * 2.4) : 0;
      var x = k.x, y = k.y + jump + walkBob;
      // carried back by a ghost Lv3 mini ghost: the kid floats
      // up off the road while the little ghost holds them (the
      // shadow below stays on the road, so the lift reads)
      if (k.carryT > 0) y -= 14;
      // shadow
      ctx.fillStyle = 'rgba(12,6,30,.35)';
      ctx.beginPath(); ctx.ellipse(k.x, k.y + 3, 11 * s, 4, 0, 0, 6.3); ctx.fill();
      ctx.save(); ctx.translate(x, y);
      // hoppers squash a little as they land and stretch at the
      // top of the bound (the scale origin is the kid's feet)
      if (hopArc) ctx.scale(s * (1 - (hopArc - 0.5) * 0.05), s * (1 + (hopArc - 0.5) * 0.07));
      else ctx.scale(s, s);
      var c = k.costume;
      /* the attackers are CHILDREN in fancy dress, never real
         monsters: every kid shows the same unmistakable child cues —
         a warm human face with rosy cheeks and a cheerful smile,
         real hair, skin-tone hands and coloured sneakers under the
         costume. Monster heads are gone: the skeleton is a onesie
         with its mask pushed up, the ghost is a bedsheet with the
         child's own face in the cut-out, the pumpkin is a round
         suit a child wears — so a kid can never be mistaken for
         one of the real monster towers, whose skeleton, ghost and
         witch keep their actual monster heads */
      var SKINS = ['#ffd9b0', '#ffdfc2', '#f2c184', '#d99a5b'];
      var HAIRS = ['#3a2314', '#6b3a1e', '#1e1a24', '#8a4b16', '#4a2410'];
      var SHOE_COLS = ['#ff5d8f', '#4dc9ff', '#ffd23e', '#7ee06f'];
      var skin = SKINS[Math.abs(k.id || 0) % SKINS.length];
      var hair = HAIRS[Math.abs(k.id || 0) % HAIRS.length];
      var shoe = SHOE_COLS[Math.abs(k.id || 0) % SHOE_COLS.length];
      // shared child face: sparkly eyes, rosy cheeks, a real smile
      function kidFace(fx, fy) {
        ctx.fillStyle = 'rgba(255,105,135,.62)';
        circle(fx - 4.9, fy + 1.8, 2.3); ctx.fill();
        circle(fx + 4.9, fy + 1.8, 2.3); ctx.fill();
        ctx.fillStyle = '#2a1830';
        circle(fx - 2.9, fy - 0.6, 1.45); ctx.fill();
        circle(fx + 2.9, fy - 0.6, 1.45); ctx.fill();
        ctx.fillStyle = '#fff';
        circle(fx - 2.4, fy - 1.1, 0.5); ctx.fill();
        circle(fx + 3.4, fy - 1.1, 0.5); ctx.fill();
        ctx.strokeStyle = '#a33b1f'; ctx.lineWidth = 1.25; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(fx, fy + 1.2, 3.1, 0.35, 2.79); ctx.stroke();
      }
      // a tufty fringe of the child's own hair across the forehead
      function kidHair(fx, fy, r) {
        ctx.fillStyle = hair;
        circle(fx - 4.6, fy - r + 2.2, 3.1); ctx.fill();
        circle(fx, fy - r + 0.9, 3.6); ctx.fill();
        circle(fx + 4.6, fy - r + 2.2, 3.1); ctx.fill();
      }
      // coloured sneakers peeking out under every costume
      function kidShoes(y0) {
        ctx.fillStyle = shoe;
        rr(-7.6, y0, 6.6, 3.4, 1.6); ctx.fill();
        rr(1, y0, 6.6, 3.4, 1.6); ctx.fill();
        ctx.fillStyle = '#fff';
        rr(-7.6, y0 + 2.1, 6.6, 1.3, 0.6); ctx.fill();
        rr(1, y0 + 2.1, 6.6, 1.3, 0.6); ctx.fill();
      }
      // small skin-tone hands at the costume's sides
      function kidHands(y0) {
        ctx.fillStyle = skin;
        circle(-9.4, y0, 3); ctx.fill();
        circle(9.4, y0, 3); ctx.fill();
      }
      if (c === 'skeleton') {
        // a skeleton-print onesie: bone pattern on the pyjamas,
        // the child's face framed by the pushed-back hood, and
        // the skull mask worn up on top like a silly hat
        ctx.fillStyle = '#22222f'; rr(-8, -15, 16, 16, 5); ctx.fill();
        ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 1.7;
        [-9.5, -5, -0.5].forEach(function (yy) { ctx.beginPath(); ctx.moveTo(-5.5, yy); ctx.lineTo(5.5, yy); ctx.stroke(); });
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = '#22222f'; circle(0, -22.5, 10); ctx.fill();
        ctx.fillStyle = skin; circle(0, -22, 8.3); ctx.fill();
        kidHair(0, -22, 8.3);
        kidFace(0, -22);
        ctx.save(); ctx.translate(5.8, -31.8); ctx.rotate(0.35);
        ctx.fillStyle = '#fff'; circle(0, 0, 4.6); ctx.fill();
        ctx.fillStyle = '#22222f'; circle(-1.6, -0.4, 1.1); ctx.fill(); circle(1.6, -0.4, 1.1); ctx.fill();
        ctx.fillRect(-1.8, 2.2, 3.6, 1.1);
        ctx.restore();
      } else if (c === 'ghost') {
        // a bedsheet costume, not a real ghost: the sheet drapes
        // around the child, whose own face fills the face cut-out,
        // with hands and sneakers sticking out from under the sheet
        ctx.fillStyle = '#f8f5ff';
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-11, -26, 0, -27); ctx.quadraticCurveTo(11, -26, 10, 0);
        ctx.lineTo(6, -3); ctx.lineTo(2, 0); ctx.lineTo(-2, -3); ctx.lineTo(-6, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = skin; circle(0, -18, 7.4); ctx.fill();
        kidHair(0, -18, 7.4);
        kidFace(0, -18);
        kidHands(-6);
        kidShoes(0.6);
      } else if (c === 'witch') {
        // a little girl in a witch dress: her own braided hair
        // (never the tower witch's green hair), a smiling face
        // under an oversized bought witch hat
        ctx.fillStyle = '#6d28d9'; ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(-5, -15); ctx.lineTo(5, -15); ctx.lineTo(8, 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb03a'; ctx.fillRect(-5.6, -7, 11.2, 2.6);
        kidShoes(1);
        kidHands(-6);
        ctx.fillStyle = hair;
        circle(-8.4, -18, 3.1); ctx.fill(); circle(-8.8, -13.5, 2.6); ctx.fill();
        circle(8.4, -18, 3.1); ctx.fill(); circle(8.8, -13.5, 2.6); ctx.fill();
        ctx.fillStyle = '#ff5d8f'; circle(-8.8, -11, 1.4); ctx.fill(); circle(8.8, -11, 1.4); ctx.fill();
        ctx.fillStyle = skin; circle(0, -21, 8); ctx.fill();
        kidFace(0, -21);
        ctx.fillStyle = '#3b1470';
        ctx.beginPath(); ctx.ellipse(0, -27.5, 12, 3.6, 0, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, -28.5); ctx.lineTo(1.5, -43); ctx.lineTo(7, -28.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb03a'; ctx.fillRect(-5.8, -31.5, 12, 3.2);
      } else if (c === 'vampire') {
        // dress-up vampire: a cape and bow tie over a little suit,
        // a normal child's hair and grin — the two tiny fangs are
        // the plastic clip-on kind, sitting in a big cheerful smile
        ctx.fillStyle = '#7a1030';
        ctx.beginPath(); ctx.moveTo(-8, -15); ctx.lineTo(-13, 1); ctx.lineTo(-7, 1); ctx.closePath();
        ctx.moveTo(8, -15); ctx.lineTo(13, 1); ctx.lineTo(7, 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2b2b3a'; rr(-8, -16, 16, 17, 5); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-3.4, -15); ctx.lineTo(3.4, -15); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8402f';
        ctx.beginPath(); ctx.moveTo(0, -13.4); ctx.lineTo(-3.6, -15.2); ctx.lineTo(-3.6, -11.6); ctx.closePath();
        ctx.moveTo(0, -13.4); ctx.lineTo(3.6, -15.2); ctx.lineTo(3.6, -11.6); ctx.closePath(); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22.5, 8.4); ctx.fill();
        kidHair(0, -22.5, 8.4);
        kidFace(0, -22.5);
        // open playful grin with two tiny plastic fangs
        ctx.fillStyle = '#7a1f1f';
        ctx.beginPath(); ctx.ellipse(0, -18.6, 2.7, 1.9, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-2.5, -20.2); ctx.lineTo(-1.1, -20.2); ctx.lineTo(-1.8, -18.4); ctx.closePath();
        ctx.moveTo(1.1, -20.2); ctx.lineTo(2.5, -20.2); ctx.lineTo(1.8, -18.4); ctx.closePath(); ctx.fill();
      } else if (c === 'pumpkin') {
        // a round pumpkin SUIT worn by a child: the carved face is
        // printed on the tummy of the suit, and the child's own
        // head — topped with a little green stem beanie — pops
        // out of the top. No pumpkin head any more
        ctx.fillStyle = '#f5820d';
        ctx.beginPath(); ctx.ellipse(0, -7, 11, 9.5, 0, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(190,90,0,.55)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(0, -7, 5.5, 9, 0, 0, 6.3); ctx.stroke();
        ctx.fillStyle = '#431d00';
        ctx.beginPath();
        ctx.moveTo(-5.6, -10.5); ctx.lineTo(-2.4, -10.5); ctx.lineTo(-4, -7.8); ctx.closePath();
        ctx.moveTo(2.4, -10.5); ctx.lineTo(5.6, -10.5); ctx.lineTo(4, -7.8); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-5, -5.4); ctx.lineTo(-2.4, -3.2); ctx.lineTo(0, -5.6); ctx.lineTo(2.4, -3.2); ctx.lineTo(5, -5.4);
        ctx.lineTo(3.4, -2.2); ctx.lineTo(-3.4, -2.2); ctx.closePath(); ctx.fill();
        kidShoes(2.2);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22.5, 8.2); ctx.fill();
        ctx.fillStyle = '#3f7a1e';
        ctx.beginPath(); ctx.arc(0, -23.5, 8.4, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#356b18'; ctx.fillRect(-1.6, -35, 3.2, 4.6);
        kidFace(0, -22.5);
      } else if (c === 'bunny') {
        // a bunny onesie with the ears on a headband: the child's
        // face, hair and painted-on bunny nose make clear this is
        // a kid dressed up, not a rabbit creature
        ctx.fillStyle = '#fdfaff'; rr(-8, -16, 16, 17, 6); ctx.fill();
        ctx.fillStyle = '#ffb3cd'; circle(0, -8, 2.8); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = '#fdfaff';
        ctx.beginPath(); ctx.ellipse(-4.5, -36, 3.2, 8, -0.15, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4.5, -36, 3.2, 8, 0.15, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#ffb3cd';
        ctx.beginPath(); ctx.ellipse(-4.5, -36, 1.5, 5, -0.15, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4.5, -36, 1.5, 5, 0.15, 0, 6.3); ctx.fill();
        ctx.fillStyle = skin; circle(0, -22, 8.2); ctx.fill();
        kidHair(0, -22, 8.2);
        // pink headband the ears are sewn onto
        ctx.strokeStyle = '#ff8fb5'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -22, 8.8, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
        kidFace(0, -22);
        // bunny nose painted on the child's own nose + whisker dots
        ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.ellipse(0, -20.2, 1.6, 1.2, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(42,24,48,.55)';
        circle(-5.6, -19.6, 0.45); ctx.fill(); circle(-6.4, -18.6, 0.45); ctx.fill();
        circle(5.6, -19.6, 0.45); ctx.fill(); circle(6.4, -18.6, 0.45); ctx.fill();
      } else if (c === 'cat') {
        // a black-cat onesie: ears sewn onto the hood, a swishy
        // tail behind, whiskers painted on the child's cheeks
        ctx.strokeStyle = '#26262e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(7, -3); ctx.quadraticCurveTo(15, -5, 13.5, -13); ctx.stroke();
        ctx.fillStyle = '#26262e'; rr(-8, -16, 16, 17, 6); ctx.fill();
        ctx.fillStyle = '#8f8fa8'; ctx.beginPath(); ctx.ellipse(0, -7, 4.4, 5.6, 0, 0, 6.3); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = '#26262e';
        ctx.beginPath(); ctx.moveTo(-8.6, -26.5); ctx.lineTo(-6.4, -35); ctx.lineTo(-2.2, -28.2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8.6, -26.5); ctx.lineTo(6.4, -35); ctx.lineTo(2.2, -28.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8fb5';
        ctx.beginPath(); ctx.moveTo(-7.2, -28.2); ctx.lineTo(-6.3, -32.2); ctx.lineTo(-4.3, -28.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7.2, -28.2); ctx.lineTo(6.3, -32.2); ctx.lineTo(4.3, -28.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#26262e'; circle(0, -22, 8.8); ctx.fill();
        ctx.fillStyle = skin; circle(0, -21.6, 7.6); ctx.fill();
        kidFace(0, -21.6);
        // painted-on whiskers and a tiny cat nose
        ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.ellipse(0, -19.8, 1.5, 1.1, 0, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(42,24,48,.55)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-8.6, -20.4); ctx.lineTo(-5.6, -19.8); ctx.moveTo(-8.6, -18.4); ctx.lineTo(-5.6, -18.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8.6, -20.4); ctx.lineTo(5.6, -19.8); ctx.moveTo(8.6, -18.4); ctx.lineTo(5.6, -18.8); ctx.stroke();
      } else if (c === 'pirate') {
        // a pirate outfit: stripy top, a spotty bandana knotted
        // over the child's hair and a toy eye patch — the grin
        // underneath is all kid
        ctx.fillStyle = '#f4f1ea'; rr(-8, -16, 16, 17, 5); ctx.fill();
        ctx.fillStyle = '#e8402f';
        ctx.fillRect(-7.6, -11.5, 15.2, 3); ctx.fillRect(-7.9, -4.5, 15.8, 3);
        ctx.fillStyle = '#7a4a21'; ctx.fillRect(-8, -1.8, 16, 2.6);
        ctx.fillStyle = '#ffd23e'; rr(-1.8, -2.1, 3.6, 3.2, 1); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22, 8.3); ctx.fill();
        kidFace(0, -22);
        // eye patch over one eye, strap running to the bandana
        ctx.strokeStyle = '#2a1830'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8, -26.5); ctx.lineTo(6.5, -21.5); ctx.stroke();
        ctx.fillStyle = '#2a1830'; circle(3.4, -22.3, 2.9); ctx.fill();
        // bandana: a red cap of cloth with white spots and a knot
        ctx.fillStyle = '#e8402f';
        ctx.beginPath(); ctx.arc(0, -22.8, 8.6, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        circle(-4.4, -27.6, 1.1); ctx.fill(); circle(1.2, -29.4, 1.1); ctx.fill(); circle(5.2, -26.4, 1.1); ctx.fill();
        ctx.fillStyle = '#c22e22';
        ctx.beginPath(); ctx.moveTo(7.6, -27); ctx.lineTo(11.4, -24.4); ctx.lineTo(8.6, -22.6); ctx.closePath(); ctx.fill();
      } else if (c === 'mummy') {
        // a toilet-paper mummy: bandage strips wrapped round the
        // body, but the child's whole face left bare with a tuft
        // of hair escaping, and one loose strip trailing behind
        ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-7, -5); ctx.quadraticCurveTo(-13.5, -2, -12, 3.5); ctx.stroke();
        ctx.fillStyle = '#efe9da'; rr(-8, -16, 16, 17, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(163,150,118,.85)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-7.8, -12); ctx.lineTo(7.8, -13.6); ctx.moveTo(-7.8, -7); ctx.lineTo(7.8, -5.6); ctx.moveTo(-7.8, -2); ctx.lineTo(7.8, -3.4); ctx.stroke();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22, 8.3); ctx.fill();
        kidHair(0, -22, 8.3);
        kidFace(0, -22);
        // one bandage strip flopped across the forehead
        ctx.save(); ctx.translate(0, -27.6); ctx.rotate(-0.16);
        ctx.fillStyle = '#efe9da'; rr(-8.2, -1.8, 16.4, 3.6, 1.8); ctx.fill();
        ctx.restore();
      } else if (c === 'hero') {
        // a superhero costume: cape, chest emblem and a mask over
        // the eyes — but the smile, cheeks and hair tuft are the
        // child's own, and the "muscles" are pure pyjama padding
        ctx.fillStyle = '#d92b2b';
        ctx.beginPath(); ctx.moveTo(-7, -15); ctx.lineTo(-13.5, 1); ctx.lineTo(-6, 1); ctx.closePath();
        ctx.moveTo(7, -15); ctx.lineTo(13.5, 1); ctx.lineTo(6, 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2456c4'; rr(-8, -16, 16, 17, 5); ctx.fill();
        ctx.fillStyle = '#ffd23e'; ctx.fillRect(-8, -3.4, 16, 2.8);
        ctx.fillStyle = '#ffdf4d'; circle(0, -10.5, 3.6); ctx.fill();
        ctx.fillStyle = '#d92b2b';
        ctx.beginPath(); ctx.moveTo(0.9, -13.4); ctx.lineTo(-1.8, -8.6); ctx.lineTo(0.1, -8.8); ctx.lineTo(-0.9, -7.2); ctx.lineTo(1.9, -11.6); ctx.lineTo(-0.1, -11.4); ctx.closePath(); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22, 8.3); ctx.fill();
        kidHair(0, -22, 8.3);
        kidFace(0, -22);
        // mask band across the eyes, eyes shining through it
        ctx.fillStyle = '#173a7d'; rr(-8.5, -25.2, 17, 5.2, 2.6); ctx.fill();
        ctx.fillStyle = '#fff'; circle(-2.9, -22.6, 1.7); ctx.fill(); circle(2.9, -22.6, 1.7); ctx.fill();
        ctx.fillStyle = '#2a1830'; circle(-2.9, -22.6, 0.95); ctx.fill(); circle(2.9, -22.6, 0.95); ctx.fill();
      } else if (c === 'zombie') {
        // a zombie costume done in face paint: the child's face
        // painted pale green (cheeks and grin still showing
        // through), a torn patched shirt — a kid playing scary
        ctx.fillStyle = '#5b4a8a'; rr(-8, -16, 16, 17, 5); ctx.fill();
        ctx.fillStyle = '#7a6a3a'; ctx.fillRect(2.5, -6.5, 4.6, 4.6);
        ctx.strokeStyle = 'rgba(20,12,30,.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-7.9, -9); ctx.lineTo(-4, -9); ctx.lineTo(-5.5, -5.5); ctx.stroke();
        kidShoes(1);
        kidHands(-7);
        // green face paint instead of skin on the face only
        ctx.fillStyle = '#b7dd8f'; circle(0, -22, 8.3); ctx.fill();
        kidHair(0, -22, 8.3);
        kidFace(0, -22);
        // a painted stitch scar on one cheek
        ctx.strokeStyle = 'rgba(90,40,40,.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(4.6, -18.4); ctx.lineTo(7.2, -16.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5.4, -19); ctx.lineTo(5.8, -17.4); ctx.moveTo(6.4, -18.4); ctx.lineTo(6.8, -16.8); ctx.stroke();
      } else if (c === 'devil') {
        // a little devil suit: red onesie, horns on a headband
        // over the child's own hair, and a pointy toy tail
        ctx.strokeStyle = '#a31f1f'; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(7, -3); ctx.quadraticCurveTo(14.5, -4, 13, -11); ctx.stroke();
        ctx.fillStyle = '#a31f1f';
        ctx.beginPath(); ctx.moveTo(13, -14.6); ctx.lineTo(15.6, -9.6); ctx.lineTo(10.6, -9.4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c22e2e'; rr(-8, -16, 16, 17, 6); ctx.fill();
        ctx.fillStyle = '#8f1d1d'; ctx.beginPath(); ctx.ellipse(0, -7, 4.2, 5.4, 0, 0, 6.3); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22, 8.3); ctx.fill();
        kidHair(0, -22, 8.3);
        kidFace(0, -22);
        // horns on a headband, sitting in the hair
        ctx.strokeStyle = '#7a1030'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(0, -22, 8.8, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
        ctx.fillStyle = '#e8e0cc';
        ctx.beginPath(); ctx.moveTo(-7.6, -27.6); ctx.quadraticCurveTo(-7.8, -32.5, -4.9, -34.6); ctx.quadraticCurveTo(-4.3, -31.2, -4.1, -28.4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7.6, -27.6); ctx.quadraticCurveTo(7.8, -32.5, 4.9, -34.6); ctx.quadraticCurveTo(4.3, -31.2, 4.1, -28.4); ctx.closePath(); ctx.fill();
      } else if (c === 'robot') {
        // a cardboard-box robot costume: the box is painted
        // silver with crayon buttons and dials, and the child's
        // face grins out of the cut-out in the box head
        ctx.fillStyle = '#aeb6c2'; rr(-8.5, -16, 17, 17, 2.5); ctx.fill();
        ctx.strokeStyle = 'rgba(70,80,95,.6)'; ctx.lineWidth = 1.2; rr(-8.5, -16, 17, 17, 2.5); ctx.stroke();
        ctx.fillStyle = '#8f97a5'; rr(-6.5, -14, 13, 6.5, 1.5); ctx.fill();
        ctx.fillStyle = '#e8402f'; circle(-3.6, -10.8, 1.7); ctx.fill();
        ctx.fillStyle = '#ffd23e'; circle(0.4, -10.8, 1.7); ctx.fill();
        ctx.fillStyle = '#4dc9ff'; circle(4.4, -10.8, 1.7); ctx.fill();
        ctx.strokeStyle = '#5a6472'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(0, -3.4, 2.6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -3.4); ctx.lineTo(1.8, -5.2); ctx.stroke();
        kidShoes(1);
        kidHands(-7);
        // the box head with its face hole
        ctx.fillStyle = '#aeb6c2'; rr(-10, -32.5, 20, 20.5, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(70,80,95,.6)'; ctx.lineWidth = 1.2; rr(-10, -32.5, 20, 20.5, 3); ctx.stroke();
        ctx.fillStyle = skin; circle(0, -22, 7.4); ctx.fill();
        kidFace(0, -22);
        // antenna with a bobble, and crayon speaker lines
        ctx.strokeStyle = '#7c8593'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -32.5); ctx.lineTo(0, -37.5); ctx.stroke();
        ctx.fillStyle = '#e8402f'; circle(0, -38.6, 2.2); ctx.fill();
        ctx.strokeStyle = 'rgba(70,80,95,.75)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-8.6, -17.5); ctx.lineTo(-5.8, -17.5); ctx.moveTo(-8.6, -15.4); ctx.lineTo(-5.8, -15.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5.8, -17.5); ctx.lineTo(8.6, -17.5); ctx.moveTo(5.8, -15.4); ctx.lineTo(8.6, -15.4); ctx.stroke();
      } else if (c === 'ninja') {
        // a ninja costume: a dark teal wrap outfit with a red
        // sash, a cloth mask over the lower face and a knotted
        // red headband whose two long tails stream out behind —
        // the child's own eyes and rosy cheeks shine over the
        // mask, and the star on the chest is a foam toy shuriken
        var flut = Math.sin(k.bob * 1.6) * 1.6; // headband tails flutter as the kid runs
        ctx.strokeStyle = '#d92b2b'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-7.5, -27.5); ctx.quadraticCurveTo(-14.5, -26 + flut, -16.5, -21 + flut); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7.8, -25); ctx.quadraticCurveTo(-14, -22 + flut, -15, -16.5 + flut); ctx.stroke();
        ctx.fillStyle = '#1e3d4d'; rr(-8, -16, 16, 17, 5); ctx.fill();
        ctx.strokeStyle = '#16303e'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-7.6, -14.5); ctx.lineTo(6, -4); ctx.moveTo(7.6, -14.5); ctx.lineTo(-6, -4); ctx.stroke();
        ctx.fillStyle = '#d92b2b'; ctx.fillRect(-8, -2.6, 16, 2.8);
        // foam toy shuriken pinned on the chest
        ctx.save(); ctx.translate(0, -10.5); ctx.rotate(0.5);
        ctx.fillStyle = '#c9d4de';
        ctx.beginPath();
        for (var spki = 0; spki < 8; spki++) {
          var aa = spki * Math.PI / 4, rad = spki % 2 === 0 ? 3.6 : 1.5;
          var px = Math.cos(aa) * rad, py = Math.sin(aa) * rad;
          if (spki === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1e3d4d'; circle(0, 0, 1); ctx.fill();
        ctx.restore();
        kidShoes(1);
        kidHands(-7);
        ctx.fillStyle = skin; circle(0, -22, 8.3); ctx.fill();
        kidFace(0, -22);
        // cloth mask over the nose and mouth, tied at the sides
        ctx.fillStyle = '#2a5a74'; rr(-8.1, -21.4, 16.2, 6.4, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(240,248,255,.5)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-7.6, -19.6); ctx.lineTo(7.6, -19.6); ctx.moveTo(-7.6, -17.2); ctx.lineTo(7.6, -17.2); ctx.stroke();
        // dark hood wrap over the hair, red headband knotted on top
        ctx.fillStyle = '#1e3d4d';
        ctx.beginPath(); ctx.arc(0, -23.2, 8.6, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d92b2b'; rr(-8.7, -28.6, 17.4, 3.4, 1.7); ctx.fill();
        ctx.fillStyle = '#a31f1f'; circle(-7.8, -26.9, 2); ctx.fill();
      } else if (c === 'cheetah') {
        // a cheetah onesie: golden spotted pyjamas, a long spotted
        // tail swishing behind, round ears on the hood and spotty
        // face paint — the child's own face grins out of the hood
        ctx.strokeStyle = '#e89b1c'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(7, -3); ctx.quadraticCurveTo(15.5, -4.5, 14, -13 + Math.sin(k.bob * 1.6) * 1.5); ctx.stroke();
        ctx.fillStyle = '#5a3a14'; circle(14, -13.5 + Math.sin(k.bob * 1.6) * 1.5, 2.1); ctx.fill();
        ctx.fillStyle = '#f2ac26'; rr(-8, -16, 16, 17, 6); ctx.fill();
        ctx.fillStyle = '#ffe1a0'; ctx.beginPath(); ctx.ellipse(0, -6.5, 4.3, 5.6, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#8a5a16';
        circle(-5.6, -12.6, 1.25); ctx.fill(); circle(5.9, -10.8, 1.25); ctx.fill();
        circle(-6.1, -4.6, 1.25); ctx.fill(); circle(6.2, -14.2, 1.1); ctx.fill(); circle(-3.4, -8.2, 1); ctx.fill();
        kidShoes(1);
        kidHands(-7);
        // round ears on the hood
        ctx.fillStyle = '#f2ac26'; circle(-7.2, -30.6, 3.6); ctx.fill(); circle(7.2, -30.6, 3.6); ctx.fill();
        ctx.fillStyle = '#ff8fb5'; circle(-7.2, -30.6, 1.8); ctx.fill(); circle(7.2, -30.6, 1.8); ctx.fill();
        // the spotted hood framing the child's face
        ctx.fillStyle = '#f2ac26'; circle(0, -22.5, 10); ctx.fill();
        ctx.fillStyle = '#8a5a16';
        circle(-8.6, -19, 1.15); ctx.fill(); circle(8.6, -19, 1.15); ctx.fill();
        circle(-6.4, -27.8, 1.15); ctx.fill(); circle(6.4, -27.8, 1.15); ctx.fill();
        ctx.fillStyle = skin; circle(0, -22, 8.2); ctx.fill();
        kidFace(0, -22);
        // cheetah face paint: a pink nose and the dark tear marks
        ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.ellipse(0, -20.2, 1.6, 1.2, 0, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(90,58,20,.8)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-3.6, -20.6); ctx.quadraticCurveTo(-4.2, -18.8, -3.8, -17.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3.6, -20.6); ctx.quadraticCurveTo(4.2, -18.8, 3.8, -17.4); ctx.stroke();
      }
      // knock arm (raises toward door when knocking): always a
      // child's own skin-tone arm with a little hand at the end —
      // even the ghost kid's hands are human hands out of the sheet
      if (k.mode === 'knock' || k.mode === 'cheer') {
        var raise = k.mode === 'cheer' ? -14 : -8 - Math.max(0, Math.sin(k.bob)) * 7;
        var offY = k.mode === 'cheer' ? -18 : -6;
        ctx.strokeStyle = skin; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(7, -12); ctx.lineTo(13, raise - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(-12, offY); ctx.stroke();
        ctx.fillStyle = skin;
        circle(13, raise - 4, 2.9); ctx.fill();
        circle(-12, offY, 2.9); ctx.fill();
      }
      ctx.restore();
      // pumpkin bucket beside kid
      if (k.mode !== 'happy') drawBucket(x + 11 * s, y - 6);
      // hp bar (knockers too, so the castle wearing one down shows)
      if ((k.mode === 'walk' || k.mode === 'knock') && k.hp < k.hpMax) {
        ctx.fillStyle = 'rgba(10,5,25,.75)'; rr(x - 13, y - 46 * s, 26, 5, 2.5); ctx.fill();
        ctx.fillStyle = '#7ee06f'; rr(x - 12, y - 46 * s + 1, 24 * Math.max(0, k.hp / k.hpMax), 3, 1.5); ctx.fill();
      }
      if (k.mode === 'happy') {
        var a = 1 - k.happyTimer / 1.15;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = '#ff5d8f';
        var hx = x, hy = y - 44 - k.happyTimer * 12;
        ctx.beginPath();
        ctx.moveTo(hx, hy + 4);
        ctx.bezierCurveTo(hx - 7, hy - 3, hx - 3.4, hy - 8, hx, hy - 4);
        ctx.bezierCurveTo(hx + 3.4, hy - 8, hx + 7, hy - 3, hx, hy + 4);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* ---------- projectiles & candy shapes ---------- */
    function drawCandyShape(shape, color, x, y, size, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      if (shape === 0) { // wrapped candy
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-size, 0); ctx.lineTo(-size * 0.35, -size * 0.55); ctx.lineTo(-size * 0.35, size * 0.55); ctx.closePath();
        ctx.moveTo(size, 0); ctx.lineTo(size * 0.35, -size * 0.55); ctx.lineTo(size * 0.35, size * 0.55); ctx.closePath();
        ctx.fill();
        circle(0, 0, size * 0.52); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(-size * 0.16, -size * 0.16, size * 0.18); ctx.fill();
      } else if (shape === 1) { // lollipop swirl
        ctx.fillStyle = color; circle(0, 0, size * 0.62); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, size * 0.34, 0.4, 4.4); ctx.stroke();
      } else { // candy corn
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.7); ctx.lineTo(size * 0.55, size * 0.5); ctx.lineTo(-size * 0.55, size * 0.5); ctx.closePath();
        ctx.fillStyle = '#f5820d'; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.7); ctx.lineTo(size * 0.3, size * 0.02); ctx.lineTo(-size * 0.3, size * 0.02); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-size * 0.3, size * 0.02); ctx.lineTo(size * 0.3, size * 0.02); ctx.lineTo(size * 0.44, size * 0.28); ctx.lineTo(-size * 0.44, size * 0.28); ctx.closePath();
        ctx.fillStyle = '#ffd23e'; ctx.fill();
      }
      ctx.restore();
    }
    function drawProj(p) {
      var ps = p.psize || 1; // bullet size grows with the tower's level
      if (p.kind === 'lolli') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - 4, p.y + 6); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#ff5d8f'; circle(p.x, p.y - 2, 6 * ps); ctx.fill();
        ctx.fillStyle = '#ffd3e4'; circle(p.x, p.y - 2, 2.6 * ps); ctx.fill();
      } else if (p.kind === 'potion') {
        // witch tower throws a little purple potion bottle
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 7); ctx.scale(ps, ps);
        ctx.fillStyle = 'rgba(230,220,255,.85)'; ctx.fillRect(-1.6, -8, 3.2, 3.4);
        ctx.fillStyle = '#7a2bd0'; circle(0, 1.5, 6); ctx.fill();
        ctx.fillStyle = '#c792ff'; circle(-1.8, -0.5, 2.4); ctx.fill();
        ctx.fillStyle = '#e9dcff'; circle(1.8, 3.4, 1.4); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'ball') {
        // black cat tower throws little paw balls
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(ps, ps);
        ctx.fillStyle = '#ffb03a'; circle(0, 0, 5.6); ctx.fill();
        ctx.fillStyle = '#7a4a12';
        circle(-1.8, 1.2, 1.5); ctx.fill();
        circle(-3, -2.2, 1); ctx.fill(); circle(0, -3.2, 1); ctx.fill(); circle(2.8, -2.2, 1); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'bolt') {
        // Frankenstein tower fires crackling lightning bolts
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.t * 22) * 0.35); ctx.scale(ps, ps);
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath();
        ctx.moveTo(2.5, -9); ctx.lineTo(-3.5, 1); ctx.lineTo(-0.5, 1); ctx.lineTo(-2.5, 9); ctx.lineTo(3.5, -1.5); ctx.lineTo(0.5, -1.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,160,30,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'web') {
        // spider tower spits a sticky web blob
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 5); ctx.scale(ps, ps);
        ctx.fillStyle = 'rgba(240,238,250,.92)'; circle(0, 0, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(180,172,215,.9)'; ctx.lineWidth = 1.1;
        for (var wi = 0; wi < 4; wi++) {
          var wa = wi * Math.PI / 2 + 0.4;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(wa) * 7.5, Math.sin(wa) * 7.5); ctx.stroke();
        }
        ctx.restore();
      } else if (p.kind === 'goo') {
        // slime tower spits a wobbly ball of corrosive goo
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(ps, ps);
        ctx.fillStyle = 'rgba(126,224,111,.5)'; circle(0, 0, 8.2); ctx.fill();
        ctx.fillStyle = '#8be26e'; circle(0, 0, 5.6); ctx.fill();
        ctx.fillStyle = '#d8ffb0'; circle(-1.8, -1.8, 2); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'arm') {
        // zombie tower's own thrown forearm, fingers curled, torn
        // sleeve cuff at the back — it flies point-first (p.ang)
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0); ctx.scale(ps, ps);
        ctx.fillStyle = '#9a8867';
        rr(-9, -3.4, 13, 6.8, 3); ctx.fill();
        circle(6, 0, 4.4); ctx.fill();
        ctx.strokeStyle = '#9a8867'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        [-2.6, 0, 2.6].forEach(function (fo) {
          ctx.beginPath(); ctx.moveTo(9, fo * 0.8); ctx.lineTo(12.5, fo * 1.25); ctx.stroke();
        });
        ctx.fillStyle = '#5a4630'; ctx.fillRect(-11.5, -4.2, 4.5, 8.4);
        ctx.strokeStyle = 'rgba(60,48,30,.6)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-3, 3); ctx.moveTo(1, -3); ctx.lineTo(1, 3); ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'corn') {
        // the CASTLE's own candy — and only the castle's: a big
        // golden-ringed sweet with a fading gold trail behind it, so
        // it can never be mistaken for a tower's throw at a road kid
        if (p.trail) {
          for (var ti = 0; ti < p.trail.length; ti++) {
            var tp = p.trail[ti], tf = (ti + 1) / p.trail.length;
            ctx.fillStyle = 'rgba(255,190,60,' + (0.34 * tf) + ')';
            circle(tp.x, tp.y, 2 + 4.5 * tf); ctx.fill();
          }
        }
        ctx.save();
        ctx.shadowColor = 'rgba(255,170,40,.95)'; ctx.shadowBlur = 13;
        ctx.fillStyle = '#ffb03a'; circle(p.x, p.y, 10.5 * ps); ctx.fill();
        ctx.restore();
        drawCandyShape(2, p.color, p.x, p.y, 8 * ps, p.t * 7);
        ctx.fillStyle = 'rgba(255,255,255,.85)'; circle(p.x - 3, p.y - 3.4, 1.7); ctx.fill();
      } else {
        drawCandyShape(p.kind === 'ball' ? 1 : 0, p.color, p.x, p.y, 7 * ps, p.t * 6);
      }
    }

    /* a scarecrow's crow in flight / riding its kid: little black
       body, flapping wings, orange beak — it dips as it pecks */
    function drawCrow(x, y, t, cr) {
      var flap = Math.sin(t * 14 + x) * 0.5;
      var dip = (cr && cr.peck > 0.22) ? 2.2 : 0;
      ctx.save(); ctx.translate(x, y + dip);
      ctx.fillStyle = '#221c33';
      ctx.save(); ctx.rotate(-0.5 - flap * 0.45);
      ctx.beginPath(); ctx.ellipse(-7, -2, 7.5, 3, -0.4, 0, 6.3); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(0.5 + flap * 0.45);
      ctx.beginPath(); ctx.ellipse(7, -2, 7.5, 3, 0.4, 0, 6.3); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 4.6, 0, 0, 6.3); ctx.fill();
      circle(5.5, -2.5, 3.4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-5.5, 0.5); ctx.lineTo(-11, 3.4); ctx.lineTo(-5, 3.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb03a';
      ctx.beginPath(); ctx.moveTo(8.4, -2.8); ctx.lineTo(12.4, -1.6); ctx.lineTo(8.4, -0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23e'; circle(6.2, -3.2, 0.9); ctx.fill();
      ctx.restore();
    }

    /* ghost Lv3 mini ghost: a small white sheet ghost, same cut as
       the big scream ghost, riding above the kid it carries */
    function drawMiniGhost(x, y, t, mg) {
      var wob = Math.sin(t * 7 + mg.seed) * 1.5;
      ctx.save(); ctx.translate(x, y + wob);
      ctx.fillStyle = 'rgba(246,242,255,.95)';
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.quadraticCurveTo(-9, -10, 0, -11);
      ctx.quadraticCurveTo(9, -10, 8, 4);
      ctx.lineTo(5.5, 1.5); ctx.lineTo(3, 4); ctx.lineTo(0, 1.5); ctx.lineTo(-3, 4); ctx.lineTo(-5.5, 1.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#241245';
      circle(-3, -3.5, 1.3); ctx.fill();
      circle(3, -3.5, 1.3); ctx.fill();
      ctx.restore();
    }

    /* black cat Lv3 pounce: the cat itself, crouched over the kid
       it pins — black body, pink inner ears, yellow eyes, tail
       lashing; while it pins, white claw slashes flash over it */
    function drawPounceCat(x, y, t, pinning) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(12,6,30,.3)';
      ctx.beginPath(); ctx.ellipse(0, 8, 11, 3.5, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#221636'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, 4); ctx.quadraticCurveTo(18, 2, 16, -6 + Math.sin(t * 9) * 2); ctx.stroke();
      ctx.fillStyle = '#221636';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-8, -12); ctx.lineTo(-2, -7); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(8, -12); ctx.lineTo(2, -7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8fb5';
      ctx.beginPath(); ctx.moveTo(-6, -5.5); ctx.lineTo(-7.2, -10); ctx.lineTo(-3.6, -6.8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -5.5); ctx.lineTo(7.2, -10); ctx.lineTo(3.6, -6.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23e';
      circle(-3.5, -1.5, 1.6); ctx.fill();
      circle(3.5, -1.5, 1.6); ctx.fill();
      ctx.fillStyle = '#120a24';
      circle(-3.5, -1.5, 0.7); ctx.fill();
      circle(3.5, -1.5, 0.7); ctx.fill();
      if (pinning) {
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6;
        for (var sc = 0; sc < 3; sc++) {
          var sy2 = -4 + sc * 3.5 + Math.sin(t * 12 + sc) * 1;
          ctx.beginPath(); ctx.moveTo(-8, sy2); ctx.lineTo(8, sy2 - 2); ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* ---------- first-run tutorial bubble (canvas) ---------- */
    function drawTutorial(t) {
      var bob = Math.sin(t * 3) * 3;
      // in pick mode the bubble reminds the player of BOTH uses of
      // the picked card (upgrade a tower of that kind, or place
      // another on a grave) — so it runs a little wider than the
      // plain first-tower placement hint
      var isPick = state.pickMode === 'pick';
      var tw = isPick ? 330 : 256, th = 36, tx = 225 - tw / 2, ty = 304 + bob;
      ctx.save();
      ctx.fillStyle = 'rgba(24,14,54,.93)';
      rr(tx, ty, tw, th, 12); ctx.fill();
      ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 2; rr(tx, ty, tw, th, 12); ctx.stroke();
      // pointer down toward the nearest gravestone — the middle
      // stone (225, 356) on the original and A roads, so the
      // pointer lands exactly where it always did there; on road
      // B it aims at that road's nearest stone instead of the road
      var nearSite = null, nearD = Infinity;
      SITES.forEach(function (s) {
        var d = Math.hypot(s.x - 225, s.y - 356);
        if (d < nearD) { nearD = d; nearSite = s; }
      });
      var px = nearSite ? nearSite.x : 225;
      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.moveTo(px - 10, ty + th - 1); ctx.lineTo(px + 10, ty + th - 1); ctx.lineTo(px, ty + th + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.font = isPick ? '700 13px "Baloo 2", sans-serif' : '700 14.5px "Baloo 2", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(isPick ? ('Tap a ' + TOWER_DEFS[state.pendingKind].nm.replace(/ Tower$/, '') + ' to upgrade — or a grave!') : ('Tap a gravestone to place the ' + TOWER_DEFS[state.pendingKind].nm + '!'), 225, ty + th / 2 + 1);
      ctx.restore();
    }

    /* ---------- HUD (in-canvas) ---------- */
    function pill(x, y, w, drawFn) {
      // slim pills: 26 tall (was 34) with a matching 13 radius, so the
      // frame hugs the unchanged 14–15px text instead of towering over it
      ctx.fillStyle = 'rgba(24,14,54,.88)';
      rr(x, y, w, 26, 13); ctx.fill();
      ctx.strokeStyle = '#6b54b8'; ctx.lineWidth = 2; rr(x, y, w, 26, 13); ctx.stroke();
      drawFn(x, y);
    }
    function drawHUD() {
      ctx.textBaseline = 'middle';
      // Four pills in row 1 (top edge, evenly spread across the
      // full width with matching 8px gaps and 10px side margins):
      // kids driven away, wave, knock count, and points toward
      // the next pick. Row 2: the house HP bar alone, centred
      // and stretched wider now that it no longer shares its row.
      // kids driven away (every one adds a point to the shared pool)
      pill(10, 5, 88, function (x, y) {
        ctx.fillStyle = '#ff5d8f'; circle(x + 16, y + 13, 7.5); ctx.fill();
        ctx.fillStyle = '#ffd3e4'; circle(x + 16, y + 13, 3.2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 15px "Baloo 2", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('×' + state.kills, x + 29, y + 14);
      });
      // wave
      pill(106, 5, 122, function (x, y) {
        ctx.fillStyle = '#fff'; circle(x + 17, y + 12, 6); ctx.fill();
        ctx.fillStyle = '#241453'; circle(x + 14.5, y + 11, 1.9); ctx.fill(); circle(x + 19.5, y + 11, 1.9); ctx.fill();
        ctx.fillRect(x + 13.8, y + 15.5, 6.4, 3);
        ctx.fillStyle = '#ffd23e'; ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('WAVE ' + waveLabel(state.wave, runMode === 'endless'), x + 29, y + 14);
      });
      // knock count — how hard the door is being pounded
      pill(236, 5, 112, function (x, y) {
        ctx.fillStyle = '#ffb03a'; rr(x + 9, y + 6, 12, 14, 3); ctx.fill();
        ctx.fillStyle = '#7a4a12'; circle(x + 17.5, y + 13, 1.7); ctx.fill();
        ctx.fillStyle = state.phase === 'exploded' ? '#ff6b5e' : '#fff';
        ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('KNOCK ×' + state.knockCount, x + 28, y + 14);
      });
      // points toward the next pick: every kid chased away by any
      // tower adds 1; every 15 banks one PICK on the top-bar button
      pill(356, 5, 84, function (x, y) {
        ctx.fillStyle = '#ffd23e'; ctx.font = '800 13.5px "Baloo 2", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('PTS ' + state.prog + '/' + PICK_EVERY, x + 9, y + 14);
      });
      // house HP bar above the house — centred on the board and
      // wider than before, alone on its row. The frame pads the
      // track by an even 3px on ALL four sides with a concentric
      // radius (9 = 6 + 3), and the coloured fill is clipped to the
      // track's own rounded shape, so the green sits flush with the
      // frame at the top, bottom and both ends at any HP value —
      // the old frame padded 4px at the top and 0 at the bottom,
      // which is why the green never lined up with its border.
      // Pulled up to y=40 now that the slimmer pills above end at
      // y=31, keeping the whole HUD block compact.
      var pct = Math.max(0, Math.min(1, state.houseHP / HOUSE_MAX));
      var bx = 55, bw = 340, by = 40, bh = 12, br = 6, pad = 3;
      ctx.fillStyle = 'rgba(24,14,54,.88)'; rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, br + pad); ctx.fill();
      ctx.strokeStyle = '#6b54b8'; ctx.lineWidth = 1.6; rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, br + pad); ctx.stroke();
      ctx.fillStyle = '#170b31'; rr(bx, by, bw, bh, br); ctx.fill();
      if (pct > 0) {
        ctx.save();
        rr(bx, by, bw, bh, br); ctx.clip();
        ctx.fillStyle = state.phase === 'exploded' ? '#555' : (pct > 0.5 ? '#58d13d' : pct > 0.28 ? '#f5a623' : '#e8402f');
        ctx.fillRect(bx, by, bw * pct, bh);
        ctx.restore();
      }
      ctx.fillStyle = '#fff'; ctx.font = '800 10.5px "Baloo 2", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(state.phase === 'exploded' ? 'HOUSE DOWN!' : 'HOUSE HP ' + Math.ceil(state.houseHP) + '/' + HOUSE_MAX, bx + bw / 2, by + bh / 2 + 0.5);
    }
    /* slim status/hint strip along the bottom of the canvas — replaces
       the DOM hint line that used to eat space below the stage */
    function hintMessage() {
      if (!started || state.choosing || state.pendingKind) return '';
      if (state.phase === 'exploded') return 'The house got knocked apart — tap Restart up top and defend again!';
      if (state.phase !== 'playing') return '';
      if (state.bombArmed) return 'Pumpkin Bomb ready — tap the road the kids walk on to drop it!';
      if (state.rainArmed) return 'Candy Rain ready — tap the road to shower that stretch with candy!';
      if (state.ghosts.length) return 'The big ghost is out! Every kid it touches is fleeing back…';
      return '';
    }
    function drawHintStrip() {
      var msg = hintMessage();
      if (!msg) return;
      ctx.font = '700 12.5px "Baloo 2", sans-serif';
      var tw = ctx.measureText(msg).width + 26;
      var x = 225 - tw / 2, y = H - 104;
      ctx.fillStyle = 'rgba(24,14,54,.82)';
      rr(x, y, tw, 24, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(107,84,184,.8)'; ctx.lineWidth = 1.4; rr(x, y, tw, 24, 12); ctx.stroke();
      ctx.fillStyle = '#cfc4f5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(msg, 225, y + 12.5);
    }

    /* ---------- main draw ---------- */
    /* the victory candy fireworks, painted on the #winFx overlay
       canvas (above the group photo): ctx is swapped to that
       canvas for the duration so the game's own drawCandyShape —
       and the circle() helper it relies on — paint there, then
       swapped straight back */
    function renderWinFx() {
      if (!fxCtx) return;
      var mainCtx = ctx;
      ctx = fxCtx;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      state.fxParts.forEach(function (q) {
        ctx.globalAlpha = Math.max(0, Math.min(1, q.life - q.t));
        drawCandyShape(q.shape, q.color, q.x, q.y, q.size, q.rot);
      });
      ctx.globalAlpha = 1;
      ctx = mainCtx;
    }

    function draw() {
      var t = state.time;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (state.shake > 0.1) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      var dmg = 1 - state.houseHP / HOUSE_MAX;
      drawSky(t);
      drawGround();
      drawPath();
      drawDeco(t);
      drawHillAndHouse(t, dmg);
      if (state.phase !== 'exploded') drawDoorstep();
      // chimney smoke (above roof)
      if (state.phase !== 'exploded') {
        state.smoke.forEach(function (s) {
          ctx.globalAlpha = 0.35 * (1 - s.t / s.life);
          ctx.fillStyle = '#cfc4ee'; circle(s.x, s.y, s.r); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      // build sites: gravestones, build animations, finished towers
      drawSites(t);
      // placement bubble: a monster is picked from the unlock popup and
      // waiting — point the player at the gravestones
      if (started && playing && state.phase === 'playing' && state.pendingKind) drawTutorial(t);
      // projectiles
      state.projs.forEach(drawProj);
      // kids sorted by y
      var sorted = state.kids.slice().sort(function (a, b) { return a.y - b.y; });
      sorted.forEach(function (k) {
        drawKid(k, t);
        if (k.mode !== 'walk') return;
        // slime goo still eating at this kid: green blobs drip off
        if (k.armorDownTimer > 0) {
          ctx.save(); ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#8be26e';
          circle(k.x - 6, k.y - 24, 2.6); ctx.fill();
          circle(k.x + 5.5, k.y - 17, 2.1); ctx.fill();
          circle(k.x - 1, k.y - 7, 1.8); ctx.fill();
          ctx.restore();
        }
        // wrapped in a spider web: strands criss-cross the costume
        if (k.webTimer > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(238,235,250,.92)'; ctx.lineWidth = 1.3;
          var wx = k.x, wy = k.y - 14, wr = 13 * k.scale;
          for (var wi3 = 0; wi3 < 5; wi3++) {
            var wa3 = wi3 * Math.PI * 2 / 5 + 0.4;
            ctx.beginPath(); ctx.moveTo(wx, wy);
            ctx.lineTo(wx + Math.cos(wa3) * wr, wy + Math.sin(wa3) * wr * 1.15); ctx.stroke();
          }
          [0.55, 0.9].forEach(function (fr) {
            ctx.beginPath(); ctx.ellipse(wx, wy, wr * fr, wr * fr * 1.15, 0, 0, 6.3); ctx.stroke();
          });
          ctx.restore();
        }
      });
      // a werewolf out on its pounce: the giant wolf itself, on the
      // road among the kids it is mauling (grow/shrink phases are
      // drawn back at its stone, hugely scaled — see drawSites)
      state.towers.forEach(function (tw) {
        if (tw.kind === 'werewolf' && tw.leap &&
            tw.leap.phase !== 'grow' && tw.leap.phase !== 'shrink') drawGiantWolf(tw, t);
      });
      // falling pumpkin bombs: target ring + shadow grow as it drops
      state.bombs.forEach(function (b) {
        var e = Math.min(1, b.t);
        ctx.strokeStyle = 'rgba(255,176,80,.8)'; ctx.lineWidth = 2;
        circle(b.x, b.y, 10 + 12 * e); ctx.stroke();
        ctx.fillStyle = 'rgba(12,6,30,.3)';
        ctx.beginPath(); ctx.ellipse(b.x, b.y + 3, 7 + 10 * e, 2.6 + 2.6 * e, 0, 0, 6.3); ctx.fill();
        drawPumpkinDeco(b.x, b.y - (1 - e) * (1 - e) * 190, 13);
      });
      // candy rain zones: a glowing patch on the road with candy falling
      state.rains.forEach(function (rz) {
        var fade = Math.min(1, rz.t / 0.25, (rz.dur - rz.t) / 0.5);
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = 'rgba(255,93,143,.13)';
        circle(rz.x, rz.y, rz.r); ctx.fill();
        ctx.strokeStyle = 'rgba(255,179,216,.75)'; ctx.lineWidth = 2;
        ctx.setLineDash([7, 6]); circle(rz.x, rz.y, rz.r); ctx.stroke(); ctx.setLineDash([]);
        for (var ci2 = 0; ci2 < 15; ci2++) {
          var offx = (((ci2 * 53) % 140) - 70) / 70 * rz.r * 0.82;
          var span = rz.r * 1.7;
          var fy = rz.y - rz.r * 0.85 + ((t * 150 + ci2 * 61) % span);
          var fx2 = rz.x + offx + Math.sin(t * 2 + ci2) * 2;
          if (Math.hypot(fx2 - rz.x, fy - rz.y) < rz.r * 0.94) {
            drawCandyShape(ci2 % 3, CANDY_COLORS[ci2 % CANDY_COLORS.length], fx2, fy, 6, t * 3 + ci2);
          }
        }
        ctx.restore();
      });
      // slime puddles: a glossy GREEN splat of goo spread flat on
      // the road — an irregular wobbly blob (main pool + satellite
      // blobs oozing off its edges, all flattened to the road's
      // perspective), a darker rim, pale gloss highlights and slow
      // lime bubbles, so it reads as sticky liquid at a glance and
      // can never be mistaken for the witch's purple mist
      state.slimePuddles.forEach(function (sz) {
        var sfade = Math.min(1, sz.t / 0.2, (sz.dur - sz.t) / 0.5);
        var swob = 1 + Math.sin(t * 3 + sz.seed * 7) * 0.03;
        var sr = sz.r * swob;
        ctx.save();
        ctx.globalAlpha = Math.max(0, sfade);
        // satellite ooze blobs around the rim (positions fixed per
        // puddle by its seed, so the shape holds still)
        ctx.fillStyle = 'rgba(84,190,52,.5)';
        for (var sb = 0; sb < 5; sb++) {
          var sa = sz.seed * 3 + sb * 1.85;
          var sx2 = sz.x + Math.cos(sa) * sr * 0.82;
          var sy2 = sz.y + Math.sin(sa) * sr * 0.36;
          ctx.beginPath(); ctx.ellipse(sx2, sy2, sr * (0.22 + (sb % 3) * 0.05), sr * 0.13, 0, 0, 6.3); ctx.fill();
        }
        // the main pool
        ctx.fillStyle = 'rgba(104,214,66,.62)';
        ctx.beginPath(); ctx.ellipse(sz.x, sz.y, sr, sr * 0.52, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(139,226,110,.55)';
        ctx.beginPath(); ctx.ellipse(sz.x - sr * 0.12, sz.y - sr * 0.08, sr * 0.68, sr * 0.34, 0, 0, 6.3); ctx.fill();
        // darker sticky rim
        ctx.strokeStyle = 'rgba(46,140,32,.75)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.ellipse(sz.x, sz.y, sr, sr * 0.52, 0, 0, 6.3); ctx.stroke();
        // Lv3 acid pool: a hot yellow-green edge, so it never
        // reads as the plain goo
        if (sz.acid) {
          ctx.strokeStyle = 'rgba(220,255,90,.9)'; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.ellipse(sz.x, sz.y, sr * 1.02, sr * 0.53, 0, 0, 6.3); ctx.stroke();
        }
        // gloss highlights: the wet shine on top of the goo
        ctx.fillStyle = 'rgba(235,255,205,.5)';
        ctx.beginPath(); ctx.ellipse(sz.x - sr * 0.34, sz.y - sr * 0.16, sr * 0.2, sr * 0.07, -0.25, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sz.x + sr * 0.3, sz.y + sr * 0.05, sr * 0.12, sr * 0.045, 0.2, 0, 6.3); ctx.fill();
        // slow lime bubbles swelling inside the goo
        for (var sbb = 0; sbb < 5; sbb++) {
          var sbx = sz.x + Math.sin(sbb * 2.7 + sz.seed * 5) * sr * 0.55;
          var sby = sz.y + Math.cos(sbb * 2.1 + sz.seed * 3) * sr * 0.26;
          var sbr = 2 + ((sz.t * 5 + sbb * 1.7 + sz.seed) % 3);
          ctx.fillStyle = 'rgba(196,255,150,.65)';
          circle(sbx, sby, sbr); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,235,.7)';
          circle(sbx - sbr * 0.3, sby - sbr * 0.3, sbr * 0.32); ctx.fill();
        }
        ctx.restore();
      });
      // witch poison mist zones: a bubbling purple puddle on the road
      state.poisons.forEach(function (zn) {
        var fade = Math.min(1, zn.t / 0.25, (zn.dur - zn.t) / 0.5);
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = 'rgba(157,92,255,.22)';
        circle(zn.x, zn.y, zn.r); ctx.fill();
        ctx.strokeStyle = 'rgba(199,146,255,.65)'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]); circle(zn.x, zn.y, zn.r); ctx.stroke(); ctx.setLineDash([]);
        for (var pb = 0; pb < 6; pb++) {
          var bx2 = zn.x + Math.sin(pb * 2.4 + zn.t * 0.7) * zn.r * 0.55;
          var byy = zn.y + Math.cos(pb * 1.9) * zn.r * 0.4 - ((zn.t * 22 + pb * 17) % 18);
          ctx.fillStyle = 'rgba(216,180,255,.5)';
          circle(bx2, byy, 2.5 + (pb % 3)); ctx.fill();
        }
        ctx.restore();
      });
      // mummy sand whirlwinds: a spinning tan spiral with sand
      // grains whirling around it — it fades as it blows out
      state.vortexes.forEach(function (vx) {
        var vfade = Math.min(1, vx.t / 0.2, (vx.life - vx.t) / 0.5);
        var vr = vx.r * (0.85 + 0.15 * Math.min(1, vx.t / 0.4));
        ctx.save();
        ctx.globalAlpha = Math.max(0, vfade);
        ctx.translate(vx.x, vx.y);
        // soft sandy dust disc under the spiral, so the whirlwind
        // reads as a sandstorm instead of a thin ring — the disc
        // is exactly the slow/damage zone, so what you see is
        // what it does (visuals only: DPS and slow unchanged)
        ctx.fillStyle = 'rgba(217,176,106,.22)';
        circle(0, 0, vr); ctx.fill();
        ctx.fillStyle = 'rgba(232,200,130,.30)';
        circle(0, 0, vr * 0.62); ctx.fill();
        ctx.fillStyle = 'rgba(245,220,160,.28)';
        circle(0, 0, vr * 0.34); ctx.fill();
        // a Lv3 sandstorm wears a golden outer ring, so it reads
        // as the big one even before its size gives it away
        if (vx.storm) {
          ctx.strokeStyle = 'rgba(255,190,90,.8)'; ctx.lineWidth = 3;
          circle(0, 0, vr); ctx.stroke();
        }
        // the spiral itself: one more arm, thicker and brighter
        ctx.strokeStyle = 'rgba(222,182,110,.95)'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        for (var vs = 0; vs < 4; vs++) {
          var va0 = vx.t * 6 + vs * 1.57;
          ctx.beginPath();
          for (var va = 0; va <= 4.2; va += 0.35) {
            var vrr = 4 + (va / 4.2) * (vr - 4);
            var vpx = Math.cos(va0 + va) * vrr, vpy = Math.sin(va0 + va) * vrr * 0.55;
            if (va === 0) ctx.moveTo(vpx, vpy); else ctx.lineTo(vpx, vpy);
          }
          ctx.stroke();
        }
        // sand grains whirling around the spiral — twice as many,
        // so the spin reads at a glance
        ctx.fillStyle = 'rgba(232,200,130,.95)';
        for (var vg = 0; vg < 16; vg++) {
          var vga = vx.t * 7 + vg * 0.42;
          var vgr = 6 + ((vg * 7 + vx.seed * 20) % Math.max(1, vr - 6));
          circle(Math.cos(vga) * vgr, Math.sin(vga) * vgr * 0.55, 2.2 + (vg % 3) * 0.6); ctx.fill();
        }
        ctx.restore();
      });
      // skeleton bone piles: a little heap of white bones on the
      // road — drawn bone by bone, so the heap visibly shrinks as
      // kids bump bones away
      state.bonePiles.forEach(function (bp) {
        var bfade = Math.min(1, bp.t / 0.2, (bp.dur - bp.t) / 0.5);
        var bscale = 0.55 + 0.45 * (bp.bones / bp.maxBones);
        ctx.save();
        ctx.globalAlpha = Math.max(0, bfade);
        ctx.translate(bp.x, bp.y);
        ctx.fillStyle = 'rgba(12,6,30,.28)';
        ctx.beginPath(); ctx.ellipse(0, 2, 15 * bscale, 5 * bscale, 0, 0, 6.3); ctx.fill();
        for (var bi = 0; bi < bp.bones; bi++) {
          var ba = bp.seed * 6 + bi * 2.4;
          var bx = Math.cos(ba) * 8 * bscale, by = -2 - (bi % 3) * 2.4 * bscale + Math.sin(ba) * 2 * bscale;
          ctx.save();
          ctx.translate(bx, by); ctx.rotate(ba);
          ctx.fillStyle = '#f4efe2';
          ctx.fillRect(-6, -1.8, 12, 3.6);
          circle(-6, -2.6, 2.4); ctx.fill();
          circle(-6, 2.6, 2.4); ctx.fill();
          circle(6, -2.6, 2.4); ctx.fill();
          circle(6, 2.6, 2.4); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      });
      // franken chain lightning: jagged arcs between the zapped kids
      state.zaps.forEach(function (zp) {
        ctx.save();
        ctx.globalAlpha = 1 - zp.t / zp.life;
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,200,40,.9)'; ctx.shadowBlur = 7;
        for (var zs = 0; zs < zp.pts.length - 1; zs++) {
          var a2 = zp.pts[zs], b2 = zp.pts[zs + 1];
          ctx.beginPath();
          ctx.moveTo(a2.x, a2.y);
          for (var zm = 1; zm <= 3; zm++) {
            var f2 = zm / 4;
            ctx.lineTo(a2.x + (b2.x - a2.x) * f2 + (Math.random() - 0.5) * 11,
                       a2.y + (b2.y - a2.y) * f2 + (Math.random() - 0.5) * 11);
          }
          ctx.lineTo(b2.x, b2.y);
          ctx.stroke();
        }
        ctx.restore();
      });
      // bat screech / werewolf howl rings rolling outward
      state.rings.forEach(function (rg) {
        // a Lv3 bat's later rings wait their turn before showing
        if (rg.delay > 0) return;
        var rfa = Math.max(0, 1 - rg.t / rg.life);
        ctx.save(); ctx.globalAlpha = rfa;
        ctx.strokeStyle = 'rgba(' + rg.color + ',.85)'; ctx.lineWidth = 3;
        circle(rg.x, rg.y, rg.r); ctx.stroke();
        ctx.strokeStyle = 'rgba(' + rg.color + ',.4)'; ctx.lineWidth = 1.6;
        circle(rg.x, rg.y, rg.r * 0.7); ctx.stroke();
        ctx.restore();
      });
      // spider web splats drying on the road
      state.webs.forEach(function (wb) {
        var wfa = Math.min(1, wb.t / 0.2, (wb.life - wb.t) / 0.4);
        ctx.save(); ctx.globalAlpha = Math.max(0, wfa) * 0.8;
        ctx.strokeStyle = '#e6e1f5'; ctx.lineWidth = 1.3;
        for (var wi2 = 0; wi2 < 6; wi2++) {
          var wa2 = wi2 * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(wb.x, wb.y);
          ctx.lineTo(wb.x + Math.cos(wa2) * wb.r, wb.y + Math.sin(wa2) * wb.r * 0.45); ctx.stroke();
        }
        [0.45, 0.75, 1].forEach(function (fr) {
          ctx.beginPath(); ctx.ellipse(wb.x, wb.y, wb.r * fr, wb.r * fr * 0.45, 0, 0, 6.3); ctx.stroke();
        });
        ctx.restore();
      });
      // spider Lv3 net zones: a big net spread flat on the road,
      // wider and bluer than a plain web splat
      state.netZones.forEach(function (nz) {
        var nfa = Math.min(1, nz.t / 0.2, (nz.dur - nz.t) / 0.4);
        ctx.save(); ctx.globalAlpha = Math.max(0, nfa) * 0.85;
        ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 1.6;
        for (var ni2 = 0; ni2 < 8; ni2++) {
          var na2 = ni2 * Math.PI / 4;
          ctx.beginPath(); ctx.moveTo(nz.x, nz.y);
          ctx.lineTo(nz.x + Math.cos(na2) * nz.r, nz.y + Math.sin(na2) * nz.r * 0.45); ctx.stroke();
        }
        [0.4, 0.7, 1].forEach(function (fr) {
          ctx.beginPath(); ctx.ellipse(nz.x, nz.y, nz.r * fr, nz.r * fr * 0.45, 0, 0, 6.3); ctx.stroke();
        });
        ctx.restore();
      });
      // scarecrow crows, chasing and riding their kids
      state.crows.forEach(function (cr) { drawCrow(cr.x, cr.y, t, cr); });
      // ghost Lv3 mini ghosts riding their kids back down the road
      state.miniGhosts.forEach(function (mg) {
        if (!mg.k) return;
        drawMiniGhost(mg.k.x, mg.k.y - 34 + Math.sin(t * 6 + mg.seed) * 2, t, mg);
      });
      // a black cat out on its Lv3 pounce, riding the kid it pins
      state.towers.forEach(function (tw) {
        if (tw.kind === 'cat' && tw.pounce) drawPounceCat(tw.pounce.x, tw.pounce.y, t, tw.pounce.phase === 'pin');
      });
      // the big scream ghost drifting back along the road
      state.ghosts.forEach(function (gh) {
        if (gh.x == null) return;
        var gbob = Math.sin(t * 5) * 3;
        ctx.save();
        ctx.fillStyle = 'rgba(199,146,255,.22)';
        circle(gh.x, gh.y - 12 + gbob, 40); ctx.fill();
        ctx.translate(gh.x, gh.y - 12 + gbob); ctx.scale(2.05, 2.05);
        var ggr = ctx.createLinearGradient(0, -22, 0, 8);
        ggr.addColorStop(0, 'rgba(255,255,255,.97)'); ggr.addColorStop(1, 'rgba(203,190,245,.88)');
        ctx.fillStyle = ggr;
        ctx.beginPath();
        ctx.moveTo(-16, 7);
        ctx.quadraticCurveTo(-18, -20, 0, -22);
        ctx.quadraticCurveTo(18, -20, 16, 7);
        ctx.lineTo(11, 2.5); ctx.lineTo(6, 7); ctx.lineTo(0, 2.5); ctx.lineTo(-6, 7); ctx.lineTo(-11, 2.5);
        ctx.closePath(); ctx.fill();
        // outstretched arms
        ctx.strokeStyle = 'rgba(240,236,255,.95)'; ctx.lineWidth = 4.6; ctx.lineCap = 'round';
        var wave = Math.sin(t * 7) * 2;
        ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-22, -12 + wave); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(22, -12 - wave); ctx.stroke();
        // wide screaming face
        ctx.fillStyle = '#241245';
        circle(-6, -11, 3); ctx.fill(); circle(6, -11, 3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -2, 3.6, 5.2, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fff'; circle(-7, -12, 1); ctx.fill(); circle(5, -12, 1); ctx.fill();
        ctx.restore();
      });
      // debris & particles
      state.debris.forEach(function (db) {
        ctx.save(); ctx.translate(db.x, db.y); ctx.rotate(db.rot);
        ctx.globalAlpha = Math.min(1, (db.life - db.t) / 0.6 + 0.4);
        if (db.kind === 'roof') {
          ctx.fillStyle = '#1a0e36';
          ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(0, -14); ctx.lineTo(22, 8); ctx.closePath(); ctx.fill();
        } else if (db.kind === 'door') {
          ctx.fillStyle = '#ff9a1f'; rr(-9, -14, 18, 28, 7); ctx.fill();
        } else if (db.kind === 'chimney') {
          ctx.fillStyle = '#21123f'; ctx.fillRect(-7, -12, 14, 24);
        } else if (db.kind === 'wall') {
          ctx.fillStyle = '#2b1a52'; rr(-13, -9, 26, 18, 3); ctx.fill();
          ctx.fillStyle = '#ffb03a'; rr(-5, -4, 9, 8, 2); ctx.fill();
        } else {
          ctx.fillStyle = '#4a2f14'; ctx.fillRect(-14, -3, 28, 6);
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      state.parts.forEach(function (q) {
        var a = q.type === 'candy' ? Math.min(1, q.life - q.t) : q.type === 'star' ? Math.min(1, (q.life - q.t) * 2) : (1 - q.t / q.life) * 0.5;
        ctx.globalAlpha = Math.max(0, a);
        if (q.type === 'candy') drawCandyShape(q.shape, q.color, q.x, q.y, q.size, q.rot);
        else if (q.type === 'star') {
          ctx.fillStyle = q.color;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.beginPath();
          ctx.moveTo(0, -q.size); ctx.quadraticCurveTo(0, 0, q.size, 0); ctx.quadraticCurveTo(0, 0, 0, q.size);
          ctx.quadraticCurveTo(0, 0, -q.size, 0); ctx.quadraticCurveTo(0, 0, 0, -q.size);
          ctx.fill(); ctx.restore();
        }
        else { ctx.fillStyle = q.color; circle(q.x, q.y, q.size * (0.6 + q.t / q.life)); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
      // floating texts
      state.floats.forEach(function (f) {
        var pop = f.t < 0.12 ? 0.5 + f.t / 0.12 * 0.5 : 1;
        ctx.save();
        ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(pop, pop);
        ctx.globalAlpha = Math.min(1, (f.life - f.t) / 0.3);
        ctx.font = '800 ' + f.size + 'px "Baloo 2", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(50,16,0,.85)';
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      ctx.restore();
      // warm glow at the door + soft vignette for depth
      var dglow = ctx.createRadialGradient(225, 224, 8, 225, 224, 135);
      dglow.addColorStop(0, 'rgba(255,150,50,.14)'); dglow.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = dglow; ctx.fillRect(85, 84, 280, 285);
      if (!VIG) {
        VIG = ctx.createRadialGradient(225, 370, 250, 225, 370, 590);
        VIG.addColorStop(0, 'rgba(9,3,24,0)'); VIG.addColorStop(1, 'rgba(9,3,24,.46)');
      }
      ctx.fillStyle = VIG; ctx.fillRect(0, 0, W, H);
      // explosion flash
      if (state.flash > 0) {
        ctx.fillStyle = 'rgba(255,214,140,' + (state.flash * 0.85) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      drawHUD();
      drawHintStrip();
      renderWinFx();
    }

    /* ---------------- HUD sync ----------------
       Every status readout (knock count, crowd, wave, house HP, unlock
       progress, build hint) is drawn inside the canvas by drawHUD /
       drawHintStrip, so there is no DOM below the stage left to sync.
       syncHUD remains as the single "state changed" hook callers use. */
    function syncHUD(force) {}

    /* ---------------- tower choice popup ---------------- */
    /* all twelve monsters have a card; refreshCards() shows exactly
       the six of the current game's roster (see rosterKinds) and
       hides the rest — the panel itself never changes shape */
    var CARD_DEFS = [
      { kind: 'franken', nm: 'Franken Tower', desc: 'Chain lightning · Lv3 triple storm' },
      { kind: 'ghost', nm: 'Ghost Tower', desc: 'Piercing lollipops · Lv3 ghost carriers' },
      { kind: 'spider', nm: 'Spider Tower', desc: 'Web spray · Lv3 giant net' },
      { kind: 'witch', nm: 'Witch Tower', desc: 'Poison mist · Lv3 plague bursts' },
      { kind: 'zombie', nm: 'Zombie Tower', desc: 'Thrown arm · Lv3 two arms' },
      { kind: 'mummy', nm: 'Mummy Tower', desc: 'Sand whirlwind · Lv3 sandstorm' },
      { kind: 'bat', nm: 'Bat Tower', desc: 'Sonic ring · Lv3 triple storm' },
      { kind: 'werewolf', nm: 'Werewolf Tower', desc: 'Howl speeds towers · Lv3 giant-wolf pounce' },
      { kind: 'cat', nm: 'Black Cat Tower', desc: 'Rapid paw balls · Lv3 pounce pin' },
      { kind: 'skeleton', nm: 'Skeleton Tower', desc: 'Bone pile · Lv3 bone wall' },
      { kind: 'scarecrow', nm: 'Scarecrow Tower', desc: 'Pet crow · Lv3 crow flock' },
      { kind: 'slime', nm: 'Slime Tower', desc: 'Goo puddle · Lv3 acid pool' }
    ];
    var miniSVG = {
      franken: '<svg viewBox="0 0 48 48"><rect x="13" y="33" width="22" height="11" rx="3" fill="#2c303a"/><rect x="5" y="19" width="5" height="4" rx="1" fill="#9aa3b2"/><rect x="38" y="19" width="5" height="4" rx="1" fill="#9aa3b2"/><rect x="11" y="5" width="26" height="27" rx="4" fill="#79c25e"/><path d="M11 5 H37 V12 L31 10 L25 12 L19 10 L13 12 L11 11 Z" fill="#191c22"/><path d="M16 18.5 H31 M19 16.8 V20 M24 16.8 V20 M28.5 16.8 V20" stroke="#2e4d24" stroke-width="1.5" fill="none"/><circle cx="19" cy="23.5" r="2.1" fill="#1c2416"/><circle cx="29" cy="23.5" r="2.1" fill="#1c2416"/><path d="M19.5 28.5 H28.5 M22.5 27.2 V29.8 M26 27.2 V29.8" stroke="#2e4d24" stroke-width="1.5" fill="none"/></svg>',
      ghost: '<svg viewBox="0 0 48 48"><path d="M12 38 L12 22 Q12 9 24 9 Q36 9 36 22 L36 38 L30 33 L24 38 L18 33 Z" fill="#f6f2ff"/><circle cx="19" cy="22" r="2.6" fill="#241245"/><circle cx="29" cy="22" r="2.6" fill="#241245"/><ellipse cx="24" cy="28" rx="2.6" ry="3.4" fill="#241245"/><circle cx="14.5" cy="27" r="3" fill="#ff9dbd" opacity=".6"/><circle cx="33.5" cy="27" r="3" fill="#ff9dbd" opacity=".6"/></svg>',
      witch: '<svg viewBox="0 0 48 48"><path d="M14 42 L19 26 L29 26 L34 42 Z" fill="#5b21b6"/><circle cx="24" cy="20" r="8.5" fill="#ffd9b0"/><path d="M9 15 Q24 10 39 15 L37 18 Q24 14 11 18 Z" fill="#3b1470"/><path d="M17 14 L26 3 L31 14 Z" fill="#3b1470"/><rect x="17.5" y="11.5" width="13" height="3.4" fill="#ffb03a"/><circle cx="21" cy="20" r="1.4" fill="#241245"/><circle cx="27" cy="20" r="1.4" fill="#241245"/></svg>',
      mummy: '<svg viewBox="0 0 48 48"><rect x="13" y="8" width="22" height="32" rx="9" fill="#efe6cf"/><path d="M14 17 L34 14 M14 26 L34 29 M14 34 L34 32" stroke="#cbbd97" stroke-width="3"/><rect x="16" y="18" width="16" height="7" rx="3.5" fill="#241245"/><circle cx="21" cy="21.5" r="1.9" fill="#ffd23e"/><circle cx="27" cy="21.5" r="1.9" fill="#ffd23e"/></svg>',
      cat: '<svg viewBox="0 0 48 48"><path d="M13 17 L15 7 L22 13 Z M35 17 L33 7 L26 13 Z" fill="#221636"/><path d="M16.5 14.5 L17.3 10.5 L20 13.2 Z M31.5 14.5 L30.7 10.5 L28 13.2 Z" fill="#ff8fb5"/><ellipse cx="24" cy="25" rx="14" ry="12" fill="#221636"/><circle cx="19" cy="24" r="2.6" fill="#ffd23e"/><circle cx="29" cy="24" r="2.6" fill="#ffd23e"/><circle cx="19" cy="24" r="1.2" fill="#120a24"/><circle cx="29" cy="24" r="1.2" fill="#120a24"/><circle cx="24" cy="35" r="3" fill="#ffb03a"/></svg>',
      skeleton: '<svg viewBox="0 0 48 48"><circle cx="24" cy="20" r="12" fill="#f6f1e2"/><rect x="17" y="27" width="14" height="8" rx="3" fill="#f6f1e2"/><ellipse cx="19" cy="20" rx="3.2" ry="4" fill="#241245"/><ellipse cx="29" cy="20" rx="3.2" ry="4" fill="#241245"/><circle cx="19" cy="20.5" r="1.2" fill="#7ee06f"/><circle cx="29" cy="20.5" r="1.2" fill="#7ee06f"/><path d="M24 24 L22.4 26.6 H25.6 Z" fill="#241245"/><path d="M18.5 31.5 H29.5 M21 29 V34 M24 29 V34 M27 29 V34" stroke="#8a7c58" stroke-width="1.4" fill="none"/><path d="M13 41 Q24 37 35 41" stroke="#e8e2d2" stroke-width="2.4" fill="none"/></svg>',
      spider: '<svg viewBox="0 0 48 48"><path d="M17 13 L8 6 L3 14 M14.5 19 L4.5 15 L2 24 M14.5 25 L5 26 L3 34 M17 30 L9.5 35 L6.5 42 M31 13 L40 6 L45 14 M33.5 19 L43.5 15 L46 24 M33.5 25 L43 26 L45 34 M31 30 L38.5 35 L41.5 42" stroke="#3a2154" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><ellipse cx="24" cy="17.5" rx="11" ry="10.5" fill="#7d4fb0"/><circle cx="19" cy="13" r="1.6" fill="#3a2154" opacity=".3"/><circle cx="29" cy="11.5" r="1.2" fill="#3a2154" opacity=".3"/><circle cx="31" cy="19" r="1" fill="#3a2154" opacity=".3"/><circle cx="24" cy="28.5" r="6.8" fill="#63388f"/><circle cx="21.6" cy="26.8" r="1.9" fill="#fff"/><circle cx="26.4" cy="26.8" r="1.9" fill="#fff"/><circle cx="21.6" cy="27.1" r="0.95" fill="#241245"/><circle cx="26.4" cy="27.1" r="0.95" fill="#241245"/><circle cx="19.3" cy="28.6" r="1.15" fill="#fff"/><circle cx="28.7" cy="28.6" r="1.15" fill="#fff"/><circle cx="19.3" cy="28.8" r="0.55" fill="#241245"/><circle cx="28.7" cy="28.8" r="0.55" fill="#241245"/><circle cx="22.9" cy="29.8" r="0.8" fill="#fff"/><circle cx="25.1" cy="29.8" r="0.8" fill="#fff"/><circle cx="22.9" cy="29.9" r="0.4" fill="#241245"/><circle cx="25.1" cy="29.9" r="0.4" fill="#241245"/><path d="M21.3 32.6 L22.2 35.4 L23.1 32.6 Z M24.9 32.6 L25.8 35.4 L26.7 32.6 Z" fill="#fff"/></svg>',
      bat: '<svg viewBox="0 0 48 48"><path d="M15 20 Q4 12 3 22 Q7 21 8 26 Q12 24 14 27 Z M33 20 Q44 12 45 22 Q41 21 40 26 Q36 24 34 27 Z" fill="#4c3278"/><path d="M18 13 L19.5 5 L24 10 L28.5 5 L30 13 Z" fill="#46306e"/><ellipse cx="24" cy="25" rx="10" ry="10.5" fill="#62449e"/><circle cx="20" cy="23" r="2.3" fill="#ffd23e"/><circle cx="28" cy="23" r="2.3" fill="#ffd23e"/><circle cx="20" cy="23.2" r="1.1" fill="#241245"/><circle cx="28" cy="23.2" r="1.1" fill="#241245"/><ellipse cx="24" cy="27.5" rx="1.6" ry="1.1" fill="#ff8fb5"/><path d="M21.5 30 L22.6 32.6 L23.7 30 M24.3 30 L25.4 32.6 L26.5 30" fill="#fff"/></svg>',
      scarecrow: '<svg viewBox="0 0 48 48"><path d="M14 42 L18 27 L30 27 L34 42 Z" fill="#b5501e"/><rect x="20" y="33" width="5.5" height="5.5" fill="#3f7a8c"/><circle cx="24" cy="20" r="9.5" fill="#e9c078"/><ellipse cx="24" cy="12.5" rx="14" ry="3.8" fill="#dca83e"/><path d="M17 11.5 Q24 2 31 11.5 Z" fill="#dca83e"/><rect x="17" y="9.8" width="14" height="2.6" fill="#a33b1f"/><circle cx="20.6" cy="19.5" r="1.5" fill="#33241a"/><circle cx="27.4" cy="19.5" r="1.5" fill="#33241a"/><path d="M24 21 L22.6 23.6 H25.4 Z" fill="#e86a17"/><path d="M20 25.4 Q24 27.6 28 25.4" stroke="#7a4a21" stroke-width="1.4" fill="none"/></svg>',
      zombie: '<svg viewBox="0 0 48 48"><path d="M13.5 26 L10.5 40 M34.5 26 L37.5 40" stroke="#9a8867" stroke-width="3.4" stroke-linecap="round"/><path d="M14 44 L16 25 Q24 20.5 32 25 L34 44 L28.5 41.5 L24 44 L19 41.5 Z" fill="#5d4a2f"/><rect x="27" y="31" width="6" height="5" fill="#7d6c4c"/><ellipse cx="25" cy="14.5" rx="9.5" ry="8.5" fill="#a08c6c"/><path d="M18 8.5 L16.5 5.5 M23 7 L22.5 4 M28 7.5 L29 4.5" stroke="#38302a" stroke-width="1.7" stroke-linecap="round"/><ellipse cx="21" cy="14" rx="2.9" ry="2.3" fill="#2e2417" opacity=".35"/><circle cx="21" cy="14" r="1.6" fill="#e8e1cb"/><ellipse cx="29.5" cy="14.4" rx="2.5" ry="2.1" fill="#2e2417" opacity=".35"/><circle cx="29.5" cy="14.6" r="1" fill="#2e2417"/><ellipse cx="25" cy="20.5" rx="2.9" ry="2.1" fill="#33241a"/><rect x="23.4" y="18.9" width="1.8" height="1.6" fill="#efe8d8"/></svg>',
      werewolf: '<svg viewBox="0 0 48 48"><path d="M13 14 L11 4 L20 10 Z M35 14 L37 4 L28 10 Z" fill="#5d4023"/><circle cx="24" cy="22" r="12.5" fill="#7d5830"/><ellipse cx="24" cy="27" rx="6.2" ry="4.6" fill="#caa27e"/><ellipse cx="24" cy="24.8" rx="2.8" ry="2" fill="#2c1c10"/><circle cx="18.5" cy="19" r="2.2" fill="#ffb03a"/><circle cx="29.5" cy="19" r="2.2" fill="#ffb03a"/><circle cx="18.5" cy="19.2" r="1" fill="#241203"/><circle cx="29.5" cy="19.2" r="1" fill="#241203"/><path d="M12 24 L8 27 L12.5 28 M36 24 L40 27 L35.5 28" stroke="#5d4023" stroke-width="2" fill="none"/><path d="M20 31 Q24 33 28 31" stroke="#3a2712" stroke-width="1.3" fill="none"/></svg>',
      slime: '<svg viewBox="0 0 48 48"><path d="M10 38 Q8 22 15 15 Q19 7 24 7 Q30 7 33.5 15 Q40 22 38 38 Q31 41.5 24 41 Q17 41.5 10 38 Z" fill="#79cf62"/><ellipse cx="18.5" cy="17" rx="3" ry="4.6" fill="#ffffff" opacity=".5"/><circle cx="19.5" cy="24" r="1.9" fill="#1e4d24"/><circle cx="28.5" cy="24" r="1.9" fill="#1e4d24"/><path d="M21 29.5 Q24 31.8 27 29.5" stroke="#1e4d24" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="31.5" cy="31" r="1.6" fill="#ffffff" opacity=".35"/><circle cx="15.5" cy="33" r="1.2" fill="#ffffff" opacity=".35"/><path d="M24 7 Q24.6 3.8 26.4 2.4 M24 7 Q22 4.6 19.8 4" stroke="#2e7d32" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'
    };
    var choiceEl = document.getElementById('towerChoice');
    var choiceGrid = document.getElementById('choiceGrid');
    var cardEls = {};
    CARD_DEFS.forEach(function (c) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'card';
      d.innerHTML = miniSVG[c.kind] + '<div class="nm">' + c.nm + '</div><div class="nm" style="color:var(--ink-dim);font-weight:500">' + c.desc + '</div>';
      d.addEventListener('click', function () {
        if (!state.choosing) return;
        // "place here" mode: the card builds on the shaking grave
        // that was tapped — at once, no second tap. If that grave
        // filled meanwhile (it can't — the game is frozen while
        // choosing), fall back to the normal pick flow.
        if (state.pickMode === 'place') {
          var site = state.placeSite;
          if (site && site.phase === 'empty') {
            site.kind = c.kind;
            site.phase = 'falling';
            site.anim = 0;
            state.placeSite = null;
            state.pickMode = null;
            state.choosing = false;
            choiceEl.classList.remove('show');
            choiceEl.setAttribute('aria-hidden', 'true');
            if (soundOn) { ensureAudio(); popSound(); }
            state.picks = Math.max(0, state.picks - 1);
            state.pendingPick = false;
            updatePickBtn();
            syncHUD(true);
            return;
          }
          state.placeSite = null;
          state.pickMode = 'pick';
        }
        state.pendingKind = c.kind;
        // in pick mode the pick is now in flight: it is spent only
        // when the player taps a tower to upgrade it, or a
        // gravestone to place a new one of this kind (see the
        // canvas tap handler); closing or cancelling keeps it
        state.pendingPick = (state.pickMode === 'pick');
        state.choosing = false;
        choiceEl.classList.remove('show');
        choiceEl.setAttribute('aria-hidden', 'true');
        if (soundOn) { ensureAudio(); popSound(); }
        updatePickBtn();
        syncHUD(true);
      });
      cardEls[c.kind] = d;
      choiceGrid.appendChild(d);
    });
    /* show exactly this game's six cards, in CARD_DEFS order; the
       other six sit the game out (display:none keeps the 3x2 grid) */
    function refreshCards() {
      var kinds = rosterKinds();
      CARD_DEFS.forEach(function (c) {
        cardEls[c.kind].style.display = kinds.indexOf(c.kind) >= 0 ? '' : 'none';
      });
    }
    refreshCards();

    /* ---------------- pick upgrades ----------------
       There is no upgrade panel any more: a level comes from a
       banked pick, spent in the monster picker (see openChoice).
       doUpgrade() is the one place a tower actually levels up —
       the grow-up animation, the flash and the chime are the old
       panel's Upgrade button, minus the panel. */
    function stars(n) { var s = ''; for (var i = 0; i < n; i++) s += '\u2605'; return s; }
    function doUpgrade(tw) {
      tw.growFrom = LVL_SCALE[tw.level - 1];
      tw.level++;
      tw.growT = 0;      // the grow-up animation (stars + swelling) starts
      tw.flashT = 0.55;  // ...with a bright flash over the tower
      levelUpSound();
      addFloat(tw.x, tw.y - 78, 'Lv ' + tw.level + '!', '#ffd23e', 19);
      // one pick = one action: the pick is spent now that the
      // upgrade has landed
      state.picks = Math.max(0, state.picks - 1);
      state.pendingPick = false;
      state.pendingKind = null;
      state.pickMode = null;
      updatePickBtn();
      syncHUD(true);
    }
    /* ---------------- controls & loop ---------------- */
    var btnPlay = document.getElementById('btnPlay');
    var btnPlayTxt = document.getElementById('btnPlayTxt');
    var overlay = document.getElementById('startOverlay');
    var started = false;

    function setPlaying(on) {
      playing = on;
      if (on && state.phase === 'idle') { state.phase = 'playing'; checkUnlock(); }
      btnPlayTxt.textContent = on ? 'Pause' : (started ? 'Resume' : 'Start Game');
      btnPlay.querySelector('svg').innerHTML = on
        ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
        : '<path d="M8 5.5v13l11-6.5z"/>';
    }
    function startGame() {
      // mode first: on a fresh page load the player has not picked
      // one yet, so START stops at the two big mode buttons and
      // only continues once one is tapped (chooseMode below).
      // Restart replays the same mode, so this gate never fires
      // mid-session — modeChosen is set once and stays set.
      if (!modeChosen) { showModeChoice(); return; }
      // entering the game is the moment the display font gets fetched
      // (it is kept off the start page's load path entirely)
      if (window.__tdLoadGameFont) window.__tdLoadGameFont();
      ensureAudio();
      stopSplashMusic(); // (engine-side hand-off no-op, kept for safety)
      if (window.__tdStopSplashMusic) window.__tdStopSplashMusic(); // the start page's dance ends here…
      startMusic();      // …and the game's own music-box loop takes over
      started = true;
      if (overlay) overlay.classList.add('hidden'); // overlay removed 2026-10-29: null-safe
      resetSkillTips();
      setPlaying(true);
    }
    /* the mode buttons: the choice applies to the whole run.
       Restart replays the same mode (runMode lives outside
       resetGame's state); only a fresh page load — back at the
       start screen — asks again. */
    function showModeChoice() {
      var mc = document.getElementById('modeChoice');
      if (mc) { mc.classList.add('show'); mc.setAttribute('aria-hidden', 'false'); }
    }
    function chooseMode(mode) {
      runMode = mode;
      modeChosen = true;
      var mc = document.getElementById('modeChoice');
      if (mc) { mc.classList.remove('show'); mc.setAttribute('aria-hidden', 'true'); }
      if (soundOn) { ensureAudio(); popSound(); }
      startGame();
    }
    document.getElementById('btnModeChallenge').addEventListener('click', function () { chooseMode('challenge'); });
    document.getElementById('btnModeEndless').addEventListener('click', function () { chooseMode('endless'); });
    /* the gold PICK! button in the top bar: hidden until a pick is
       banked. Tapping it opens the monster picker (game frozen)
       and the pick is spent only when a placement or an upgrade
       actually lands. While a picked card is waiting for a field
       tap, the same button turns into Cancel Pick — it drops the
       card, reopens the picker, and the banked pick stays put. */
    var btnPick = document.getElementById('btnPick');
    var pickBtnTxt = '';
    function updatePickBtn() {
      if (!btnPick) return;
      var show = started && playing && state.phase === 'playing' && !state.choosing && (state.picks > 0 || state.pendingPick);
      btnPick.hidden = !show;
      var t = state.pendingPick ? 'Cancel Pick' : (state.picks > 1 ? 'PICK! ×' + state.picks : 'PICK!');
      if (t !== pickBtnTxt) { pickBtnTxt = t; btnPick.textContent = t; }
    }
    btnPick.addEventListener('click', function () {
      ensureAudio();
      if (!started || !playing || state.phase !== 'playing') return;
      if (state.pendingPick) {
        // change of mind: drop the picked card, reopen the picker,
        // keep the banked pick for another kind
        state.pendingKind = null;
        state.pendingPick = false;
        openChoice('pick');
        updatePickBtn();
        return;
      }
      if (state.picks > 0 && !state.choosing && !state.pendingKind) {
        openChoice('pick');
        updatePickBtn();
      }
    });
    /* the picker close button ("Later"): only offered on a pick
       or a "place here" pick, never on the free first tower —
       closing keeps the banked pick for later, it is never spent
       without an action. */
    document.getElementById('btnChoiceClose').addEventListener('click', function () {
      if (state.pickMode !== 'pick' && state.pickMode !== 'place') return;
      state.placeSite = null;
      state.choosing = false;
      state.pickMode = null;
      var ch = document.getElementById('towerChoice');
      if (ch) { ch.classList.remove('show'); ch.setAttribute('aria-hidden', 'true'); }
      updatePickBtn();
      syncHUD(true);
    });
    var bs = document.getElementById('btnStart');
    if (bs) bs.addEventListener('click', startGame); // overlay removed 2026-10-29
    /* splash page: the START button on the cover art is wired by the
       little bootstrap script right after the splash markup; once the
       engine has booted it calls window.__tdEnter (set at the bottom
       of this script), which dismisses the splash and drops straight
       into the game (popping the free first tower choice, as before) */
    btnPlay.addEventListener('click', function () {
      ensureAudio();
      if (!started) { startGame(); return; }
      setPlaying(!playing);
    });
    /* the one shared restart run: resets the field, the victory
       photo, dim veil, candy fireworks and the music, then drops
       straight into a fresh run of the CURRENT game — the roster
       (gameNo) is NOT touched here, so the six cards stay the
       same. Whoever wants the NEXT game must say so before
       calling this (only PLAY AGAIN does) */
    function restartRun() {
      // a restart before any mode was ever picked (top Restart
      // tapped before START) asks for the mode first instead of
      // starting a modeless run
      if (!modeChosen) { showModeChoice(); return; }
      ensureAudio();
      stopWinMusic(); // leaving the kids-win screen: back to the normal loop
      stopDefMusic(); // leaving the castle-saved screen: back to the normal loop
      startMusic();
      resetGame();
      refreshCards();
      started = true;
      if (overlay) overlay.classList.add('hidden'); // overlay removed 2026-10-29: null-safe
      resetSkillTips();
      setPlaying(true);
    }
    /* the top Restart button replays the current game: same
       roster, same six cards — it never advances the rotation */
    document.getElementById('btnRestart').addEventListener('click', restartRun);
    /* CASTLE SAVED "PLAY AGAIN": the victory screen's own button,
       centred under the group photo — the ONLY way into the next
       game. It advances the rotation one step FIRST, then runs
       exactly the same restart as the top button (victory photo,
       dim veil, candy fireworks and victory music all reset the
       same way) */
    document.getElementById('btnPlayAgain').addEventListener('click', function () {
      // only a genuinely shown victory button may advance the
      // rotation — a stray click that reaches it while it is
      // hidden (it is opacity-0 / pointer-events:none then) must
      // never restart anything
      if (!document.getElementById('btnPlayAgain').classList.contains('show')) return;
      gameNo++;
      restartRun();
    });
    /* the defeat report's buttons share one rule: they act ONLY
       while the report is on screen. The report hides with
       opacity + pointer-events:none on the container, but its
       painted-button tap zones once forced pointer-events:auto on
       themselves — which keeps a child hit-testable through a
       none parent — so mid-game taps on the lower field were
       landing on the invisible Play Again zone and restarting
       the run (the game-3 sudden-restart bug). The CSS now keeps
       the zones off unless the report is shown; this guard is
       the second lock on the same door. */
    function brIsShown() {
      var br = document.getElementById('battleReport');
      return !!(br && br.classList.contains('show'));
    }
    /* battle report popup buttons: X just closes it (the KIDS WIN!
       celebration and the top Restart stay live behind it), Share
       Result renders the achievement-card PNG and shares that
       (download + copied link where file sharing is missing, the
       old text/link chain where the card cannot render), and
       Play Again runs the same restart as the top button */
    var brCloseBtn = document.getElementById('brClose');
    if (brCloseBtn) brCloseBtn.addEventListener('click', function () { if (brIsShown()) hideBattleReport(); });
    var brShareBtn = document.getElementById('brShare');
    if (brShareBtn) {
      brShareBtn.addEventListener('click', function () { if (brIsShown()) shareBattleScore(); });
      /* press feedback the finger can see even on iOS Safari,
         which does not reliably paint :active on buttons: light
         the painted Share Result button up while it is held */
      brShareBtn.addEventListener('pointerdown', function () { brShareBtn.classList.add('pressing'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        brShareBtn.addEventListener(ev, function () { brShareBtn.classList.remove('pressing'); });
      });
    }
    /* the manual link box (shown only when share + clipboard are
       both blocked): X closes it, tapping the field selects the
       whole link for a long-press copy */
    var brLinkCloseBtn = document.getElementById('brLinkClose');
    if (brLinkCloseBtn) brLinkCloseBtn.addEventListener('click', hideBrLinkBox);
    var brLinkUrlInput = document.getElementById('brLinkUrl');
    if (brLinkUrlInput) {
      brLinkUrlInput.addEventListener('click', function () { brLinkUrlInput.select(); });
      brLinkUrlInput.addEventListener('focus', function () { brLinkUrlInput.select(); });
    }
    var brAgainBtn = document.getElementById('brPlayAgain');
    if (brAgainBtn) brAgainBtn.addEventListener('click', function () { if (!brIsShown()) return; hideBattleReport(); restartRun(); });
    var btnSound = document.getElementById('btnSound');
    btnSound.addEventListener('click', function () {
      soundOn = !soundOn;
      btnSound.classList.toggle('on', soundOn);
      btnSound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      if (soundOn) {
        ensureAudio();
        if (started) { if (state.phase === 'exploded') startWinMusic(); else if (state.phase === 'defended') startDefMusic(); else startMusic(); }
        else if (window.__tdStartSplashMusic) window.__tdStartSplashMusic();
      }
      else { stopMusic(); stopWinMusic(); stopDefMusic(); stopSplashMusic(); }
    });
    var btnSpeed = document.getElementById('btnSpeed');
    btnSpeed.addEventListener('click', function () {
      SPEED = SPEED === 1 ? 2 : SPEED === 2 ? 3 : 1;
      btnSpeed.textContent = SPEED + '× Speed';
      btnSpeed.classList.toggle('on', SPEED > 1);
    });
    canvas.addEventListener('pointerdown', function (e) {
      ensureAudio();
      if (!started || !playing || state.phase !== 'playing') return;
      var r = canvas.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * W;
      var y = (e.clientY - r.top) / r.height * H;
      if (state.rainArmed) {
        // candy rain skill: this tap picks the stretch of road to soak
        state.rainArmed = false;
        state.rainCd = RAIN_CD;
        state.rains.push({ x: x, y: y, t: 0, r: RAIN_RADIUS, dur: RAIN_DUR });
        rainSound();
        noteSkillUsed('rain');
        return;
      }
      if (state.bombArmed) {
        // pumpkin bomb skill: this tap is the drop point on the road
        state.bombArmed = false;
        state.bombCd = BOMB_CD;
        state.bombs.push({ x: x, y: y, t: 0 });
        popSound();
        return;
      }
      // a pick is in flight (a card was picked from the monster
      // picker): tapping one of the picked kind on the field levels
      // it up; tapping anywhere else places a new one of that kind
      // on the closest empty gravestone (see tapSite). A tower of
      // another kind just explains the choice — the pick is not spent.
      if (state.pendingKind && state.pickMode === 'pick') {
        var pickTw = null, pickD = 40;
        state.towers.forEach(function (tw) {
          var d = Math.hypot(tw.x - x, (tw.y - 12) - y);
          if (d < pickD) { pickD = d; pickTw = tw; }
        });
        if (pickTw) {
          if (pickTw.kind === state.pendingKind) {
            if (pickTw.level >= 3) addFloat(pickTw.x, pickTw.y - 62, 'Lv 3 MAX \u2605\u2605\u2605', '#ffd23e', 14);
            else doUpgrade(pickTw);
          } else {
            addFloat(pickTw.x, pickTw.y - 62, 'Tap a ' + TOWER_DEFS[state.pendingKind].nm.replace(/ Tower$/, '') + ' to upgrade it — or a gravestone to place another!', '#ffe9a8', 12.5);
          }
          return;
        }
        tapSite(x, y);
        return;
      }
      // a banked pick makes the badge (and the tower under it) a
      // one-tap upgrade: the badge is checked first, because it
      // floats above the tower's body and the body radius below
      // does not reach it. The check mirrors the draw condition
      // exactly (pickCueActive), so a badge you can see is a
      // badge you can tap, and vice versa
      if (pickCueActive()) {
        var badgeTw = null;
        state.towers.forEach(function (tw) {
          if (tw.level >= 3) return;
          var bc = badgeCenter(tw);
          if (Math.abs(x - bc.x) <= 39 && Math.abs(y - bc.y) <= 25) badgeTw = tw;
        });
        if (badgeTw) { doUpgrade(badgeTw); return; }
      }
      // tapping one of your own monsters, outside a pick: with a
      // pick banked the tap upgrades it on the spot (the badge
      // above its head says so); with no pick banked it only
      // shows its level info — there is no upgrade panel any more
      var tappedTw = null, tappedD = 40;
      state.towers.forEach(function (tw) {
        var d = Math.hypot(tw.x - x, (tw.y - 12) - y);
        if (d < tappedD) { tappedD = d; tappedTw = tw; }
      });
      if (tappedTw) {
        if (tappedTw.level >= 3) addFloat(tappedTw.x, tappedTw.y - 62, 'Lv 3 MAX \u2605\u2605\u2605', '#ffd23e', 14);
        else if (pickCueActive()) doUpgrade(tappedTw);
        else addFloat(tappedTw.x, tappedTw.y - 62, 'Lv ' + tappedTw.level + ' \u00b7 chased ' + tappedTw.kills + ' kids', '#ffe9a8', 13.5);
        return;
      }
      tapSite(x, y);
    });
    function tapSite(x, y) {
      // nearest EMPTY gravestone to the tap (measured to the stone's
      // visible centre, a little above the site's anchor point)
      var best = null, bd = Infinity;
      SITES.forEach(function (s) {
        if (s.phase !== 'empty') return;
        var d = Math.hypot(s.x - x, (s.y - 6) - y);
        if (d < bd) { bd = d; best = s; }
      });
      if (!best) {
        // nowhere left to build: a pick in flight stays banked —
        // the player cancels it from the PICK! button up top and
        // chooses another kind, or closes the picker
        if (state.pendingPick) addFloat(x, y - 30, 'No empty gravestones — tap PICK! up top to choose again', '#ff9a8a', 12.5);
        return;
      }
      if (!state.pendingKind) {
        // no monster selected: with a pick banked, tapping a
        // shaking grave opens the picker in "place here" mode —
        // the picked card builds on THIS grave at once, no
        // second tap. With no pick banked the tap explains how
        // far off the next one is.
        if (bd <= 60) {
          if (state.picks > 0 && !state.choosing) {
            state.placeSite = best;
            openChoice('place');
          } else if (state.picks <= 0) {
            var rem = PICK_EVERY - state.prog;
            addFloat(best.x, best.y - 48, 'Chase away ' + rem + ' more for a PICK!', '#ff9a8a', 14);
          }
        }
        return;
      }
      // placement mode: ANY tap on the field puts the picked tower on the
      // closest empty gravestone — a slightly-off tap can no longer
      // silently miss and leave the tower unplaced
      best.kind = state.pendingKind;
      state.pendingKind = null;
      best.phase = 'falling';
      best.anim = 0;
      // a placement spends a pick exactly like an upgrade does;
      // the free first tower (pickMode 'free') spends nothing
      if (state.pendingPick) {
        state.picks = Math.max(0, state.picks - 1);
        state.pendingPick = false;
        updatePickBtn();
      }
      state.pickMode = null;
      syncHUD(true);
    }

    /* skill coaching, one tip at a time: no wall of text up front.
       The tips wait until a kid has actually reached the round
       plaza and started knocking at the door — only then do they
       appear, in order: first the Pumpkin Bomb, later the Ghost
       Scream, then the Candy Rain. A tip goes away when the player
       uses that skill (or closes it), and the next one appears the
       next time a kid is knocking. In-memory only, per session. */
    var SKILL_TIPS = [
      { key: 'bomb', btn: 'btnBomb', html: '<b>Pumpkin Bomb</b> — lots of kids! Tap the pumpkin button below, then tap the road to drop it. BOOM!' },
      { key: 'scream', btn: 'btnScream', html: '<b>Ghost Scream</b> — the road is packed! Tap the ghost button below to scare every kid back down the road!' },
      { key: 'rain', btn: 'btnRain', html: '<b>Candy Rain</b> — so many kids! Tap the candy button below, then tap the road: kids stop to fill up and head home!' }
    ];
    var skillTipEl = document.getElementById('skillTip');
    var skillTipText = document.getElementById('skillTipText');
    var skillTipPath = document.getElementById('skillTipPath');
    var skillTipShape = document.getElementById('skillTipShape');
    var tipIdx = 0, tipActive = false, tipShownAt = 0, tipLastAt = -99;
    /* draw the tip as ONE speech-bubble outline and aim its tail:
       the bubble sits just above the skill dock, and the single
       continuous path below runs around the rounded rectangle,
       diverts down around the triangular tail and back — the tail
       tip lands exactly over the centre of the button the tip
       teaches, so there is no bottom-edge segment crossing the
       tail and nothing is patched over a join. The fill matches
       the translucent fill set in the markup. Coordinates are
       worked out from layout offsets (not getBoundingClientRect),
       so the pop-in animation's transform cannot skew them */
    var TIP_TAIL = 14, TIP_R = 18;
    function drawSkillTipShape() {
      if (!skillTipEl || !skillTipPath || !skillTipShape || skillTipEl.hidden) return;
      if (tipIdx >= SKILL_TIPS.length) return;
      var btn = document.getElementById(SKILL_TIPS[tipIdx].btn);
      var stage = document.getElementById('stage');
      var dock = document.querySelector('.skilldock');
      if (!btn || !stage || !dock) return;
      // sit the bubble just above the dock, however tall it is
      skillTipEl.style.bottom = (stage.clientHeight - dock.offsetTop + 8) + 'px';
      var w = skillTipEl.offsetWidth, h = skillTipEl.offsetHeight;
      if (w < 60 || h < TIP_TAIL + 20) return;
      // button centre, in stage coordinates: both the dock and
      // this bubble are centred with left:50% + translateX(-50%)
      var btnCx = (stage.clientWidth - dock.offsetWidth) / 2 + btn.offsetLeft + btn.offsetWidth / 2;
      var bubbleLeft = (stage.clientWidth - w) / 2;
      var tailCx = btnCx - bubbleLeft;
      var half = 11;
      var lo = TIP_R + half + 2, hi = w - TIP_R - half - 2;
      if (tailCx < lo) tailCx = lo;
      if (tailCx > hi) tailCx = hi;
      skillTipEl.style.transformOrigin = tailCx + 'px 100%';
      var x0 = 1, y0 = 1, x1 = w - 1, y1 = h - TIP_TAIL - 1, yT = h - 2, r = TIP_R;
      var d = 'M ' + (x0 + r) + ' ' + y0 +
        ' H ' + (x1 - r) + ' Q ' + x1 + ' ' + y0 + ' ' + x1 + ' ' + (y0 + r) +
        ' V ' + (y1 - r) + ' Q ' + x1 + ' ' + y1 + ' ' + (x1 - r) + ' ' + y1 +
        ' H ' + (tailCx + half) +
        ' L ' + tailCx + ' ' + yT +
        ' L ' + (tailCx - half) + ' ' + y1 +
        ' H ' + (x0 + r) + ' Q ' + x0 + ' ' + y1 + ' ' + x0 + ' ' + (y1 - r) +
        ' V ' + (y0 + r) + ' Q ' + x0 + ' ' + y0 + ' ' + (x0 + r) + ' ' + y0 + ' Z';
      skillTipShape.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      skillTipPath.setAttribute('d', d);
    }
    window.addEventListener('resize', function () { if (tipActive) drawSkillTipShape(); });
    var tipsUsed = {};
    function resetSkillTips() {
      tipIdx = 0; tipActive = false; tipLastAt = -99; tipsUsed = {};
      if (skillTipEl) skillTipEl.hidden = true;
      SKILL_TIPS.forEach(function (tp) {
        var b = document.getElementById(tp.btn);
        if (b) b.classList.remove('tipglow');
      });
    }
    function hideSkillTip() {
      tipActive = false;
      tipLastAt = state.time;
      if (skillTipEl) skillTipEl.hidden = true;
      SKILL_TIPS.forEach(function (tp) {
        var b = document.getElementById(tp.btn);
        if (b) b.classList.remove('tipglow');
      });
    }
    function noteSkillUsed(key) {
      tipsUsed[key] = true;
      if (tipActive && tipIdx < SKILL_TIPS.length && SKILL_TIPS[tipIdx].key === key) {
        hideSkillTip();
        tipIdx++;
      }
    }
    function maybeSkillTip() {
      if (!started || !playing || state.phase !== 'playing' || state.choosing || state.pendingKind) return;
      if (tipActive) {
        // ignored for a while? tuck it away and offer it again the
        // next time a kid is knocking instead of leaving it hanging
        // over the game
        if (state.time - tipShownAt > 10) hideSkillTip();
        return;
      }
      while (tipIdx < SKILL_TIPS.length && tipsUsed[SKILL_TIPS[tipIdx].key]) tipIdx++;
      if (tipIdx >= SKILL_TIPS.length) return;
      if (state.time - tipLastAt < 8) return;
      // the trigger: a kid must be IN the round plaza, knocking at
      // the door (the same test the castle cannon aims by) — kids
      // still marching on the road never start the tips
      var knockers = 0;
      state.kids.forEach(function (k) { if (isPlazaKnocker(k)) knockers++; });
      var tp = SKILL_TIPS[tipIdx];
      if (knockers < 1) return;
      // only teach a skill that is actually ready to fire
      if (tp.key === 'bomb' && state.bombCd > 0) return;
      if (tp.key === 'scream' && state.screamCd > 0) return;
      if (tp.key === 'rain' && state.rainCd > 0) return;
      tipActive = true;
      tipShownAt = state.time;
      if (skillTipText) skillTipText.innerHTML = tp.html;
      if (skillTipEl) skillTipEl.hidden = false;
      drawSkillTipShape();
      var b = document.getElementById(tp.btn);
      if (b) b.classList.add('tipglow');
      popSound();
    }
    document.getElementById('skillTipClose').addEventListener('click', function () {
      if (!tipActive) return;
      hideSkillTip();
      tipIdx++; // seen it — the next tip waits for the next knocker
    });
    // any first tap anywhere also unlocks the AudioContext on strict webviews
    document.addEventListener('pointerdown', function () { ensureAudio(); });
    // …and the screen-off recovery fallback: the player's next
    // touch retries the recovery inside a real gesture, where
    // the unlock is always allowed. Deliberately gated on the
    // context's STATE, not on the pending flag: after an iOS
    // interruption the flag itself can be stale, but a context
    // that is not 'running' is a fact, and resume() inside a
    // genuine tap is the one call no browser refuses.
    document.addEventListener('pointerdown', function () { if (AC && AC.state !== 'running') recoverAudio(); });
    document.addEventListener('touchstart', function () {
      ensureAudio();
      if (AC && AC.state !== 'running') recoverAudio();
    }, { passive: true });

    /* splash background music NO LONGER lives here: the cheerful
       Halloween skeleton-dance now runs from the splash page's own
       lightweight script in index.html (window.__tdStartSplashMusic /
       __tdStopSplashMusic), available from the first paint — this
       engine loads in the background, so its tap listeners were
       registered too late and the dance was never heard on a real
       phone. The engine's own copy below is kept only so stopSplash-
       Music() stays a harmless no-op hand-off; nothing starts it.
       The in-game music-box loop is a separate thing entirely and
       is started by startGame, as before. */

    /* pumpkin bomb skill button: arm it, then the next canvas tap drops
       the pumpkin there; a 12s cooldown keeps it a special, not a spam */
    var btnBomb = document.getElementById('btnBomb');
    var btnBombTxt = document.getElementById('btnBombTxt');
    btnBomb.addEventListener('click', function () {
      ensureAudio();
      if (!started || !playing || state.phase !== 'playing' || state.choosing || state.pendingKind) return;
      if (state.bombCd > 0) return;
      state.bombArmed = !state.bombArmed;
      if (state.bombArmed) state.rainArmed = false;
      if (soundOn) popSound();
      syncHUD(true);
    });
    var lastBombLabel = null;
    function updateBombBtn() {
      var label, dis = false;
      if (!started || state.phase !== 'playing') { label = 'Pumpkin Bomb'; dis = true; }
      else if (state.bombArmed) label = 'Tap road: DROP!';
      else if (state.bombCd > 0) { label = 'Pumpkin ' + Math.ceil(state.bombCd) + 's'; dis = true; }
      else label = 'Pumpkin Bomb';
      if (label !== lastBombLabel) { lastBombLabel = label; btnBombTxt.textContent = label; }
      if (btnBomb.disabled !== dis) btnBomb.disabled = dis;
      if (btnBomb.classList.contains('armed') !== !!state.bombArmed) btnBomb.classList.toggle('armed', !!state.bombArmed);
      var bReady = started && state.phase === 'playing' && state.bombCd <= 0 && !state.bombArmed && !state.choosing && !state.pendingKind;
      if (btnBomb.classList.contains('ready') !== bReady) btnBomb.classList.toggle('ready', bReady);
    }

    /* ghost scream skill button: fires instantly — a big ghost leaves
       the castle door and drifts back along the road scaring kids */
    var btnScream = document.getElementById('btnScream');
    var btnScreamTxt = document.getElementById('btnScreamTxt');
    btnScream.addEventListener('click', function () {
      ensureAudio();
      if (!started || !playing || state.phase !== 'playing' || state.choosing || state.pendingKind) return;
      if (state.screamCd > 0) return;
      state.screamCd = SCREAM_CD;
      state.bombArmed = false;
      state.rainArmed = false;
      var gp0 = pointAt(PATH_LEN - 2);
      state.ghosts.push({ dist: PATH_LEN - 2, x: gp0.x, y: gp0.y, scared: {} });
      screamSound();
      addFloat(DOOR.x, 160, 'BOO!!', '#c792ff', 22);
      noteSkillUsed('scream');
      syncHUD(true);
    });
    var lastScreamLabel = null;
    function updateScreamBtn() {
      var label, dis = false;
      if (!started || state.phase !== 'playing') { label = 'Ghost Scream'; dis = true; }
      else if (state.screamCd > 0) { label = 'Scream ' + Math.ceil(state.screamCd) + 's'; dis = true; }
      else label = 'Ghost Scream';
      if (label !== lastScreamLabel) { lastScreamLabel = label; btnScreamTxt.textContent = label; }
      if (btnScream.disabled !== dis) btnScream.disabled = dis;
      var sReady = started && state.phase === 'playing' && state.screamCd <= 0 && !state.choosing && !state.pendingKind;
      if (btnScream.classList.contains('ready') !== sReady) btnScream.classList.toggle('ready', sReady);
    }

    /* candy rain skill button: arm it, then the next canvas tap picks
       the stretch of road where the candy rain falls */
    var btnRain = document.getElementById('btnRain');
    var btnRainTxt = document.getElementById('btnRainTxt');
    btnRain.addEventListener('click', function () {
      ensureAudio();
      if (!started || !playing || state.phase !== 'playing' || state.choosing || state.pendingKind) return;
      if (state.rainCd > 0) return;
      state.rainArmed = !state.rainArmed;
      if (state.rainArmed) state.bombArmed = false;
      if (soundOn) popSound();
      syncHUD(true);
    });
    var lastRainLabel = null;
    function updateRainBtn() {
      var label, dis = false;
      if (!started || state.phase !== 'playing') { label = 'Candy Rain'; dis = true; }
      else if (state.rainArmed) label = 'Tap road: RAIN!';
      else if (state.rainCd > 0) { label = 'Candy Rain ' + Math.ceil(state.rainCd) + 's'; dis = true; }
      else label = 'Candy Rain';
      if (label !== lastRainLabel) { lastRainLabel = label; btnRainTxt.textContent = label; }
      if (btnRain.disabled !== dis) btnRain.disabled = dis;
      if (btnRain.classList.contains('armed') !== !!state.rainArmed) btnRain.classList.toggle('armed', !!state.rainArmed);
      var rReady = started && state.phase === 'playing' && state.rainCd <= 0 && !state.rainArmed && !state.choosing && !state.pendingKind;
      if (btnRain.classList.contains('ready') !== rReady) btnRain.classList.toggle('ready', rReady);
    }

    var lastTs = 0;
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!lastTs) lastTs = ts;
      var dt = Math.min(0.05, (ts - lastTs) / 1000) * SPEED;
      lastTs = ts;
      if (playing || state.phase === 'exploded' || state.phase === 'idle' || state.phase === 'defended') update(dt);
      draw();
      maybeSkillTip();
      updateBombBtn();
      updateScreamBtn();
      updateRainBtn();
      updatePickBtn();
    }
    requestAnimationFrame(loop);

    /* hand the splash START button its action, and honour a tap that
       landed before the boot finished */
    window.__tdEnter = function () {
      document.getElementById('splash').classList.add('gone');
      startGame();
    };
    if (window.__tdPendingEnter) {
      window.__tdPendingEnter = false;
      window.__tdEnter();
    }
    /* the engine is fully initialised at this point — state reset,
       first frame queued, START wired — so tell the loading screen
       its final stage is genuinely done */
    if (window.__tdEngineReady) window.__tdEngineReady();
    };
    /* boot after first paint: idle callback if available, with plain
       timers and the load event as backstops, so the splash cover is
       on screen (and tappable) while this runs behind it */
    (function scheduleBoot() {
      var done = false;
      function go() { if (done) return; done = true; window.__tdBoot(); }
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 800 });
      setTimeout(go, 350);
      window.addEventListener('load', go);
    })();
