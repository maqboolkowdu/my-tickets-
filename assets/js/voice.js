/* OpsLog — speech synthesis, speech recognition and the phone ringtone. */
(function (WL) {
  'use strict';
  const { Store } = WL;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = { tts: 'speechSynthesis' in window, stt: !!SR };

  /* ---------- Text to speech ---------- */
  let voices = [];
  function loadVoices() { if (supported.tts) voices = speechSynthesis.getVoices(); }
  if (supported.tts) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

  function pickVoice() {
    const want = Store.settings.voice;
    if (want) { const v = voices.find((x) => x.name === want); if (v) return v; }
    const lang = (Store.settings.lang || 'en-US').slice(0, 2);
    return voices.find((v) => v.lang.startsWith(lang) && /natural|neural|online|aria|jenny|samantha|google us english|sonia|libby/i.test(v.name))
      || voices.find((v) => v.lang.startsWith(Store.settings.lang)) || voices.find((v) => v.lang.startsWith(lang)) || null;
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!supported.tts || !text) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || Store.settings.lang || 'en-US';
      u.rate = Store.settings.voiceRate || 1;
      u.pitch = 1;
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
      // Safety net: some browsers never fire `end`.
      const guard = setTimeout(finish, 1500 + text.length * 85);
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
    });
  }
  function stopSpeaking() { if (supported.tts) speechSynthesis.cancel(); }

  /* ---------- Speech to text ---------- */
  let rec = null;
  let cancelListen = null;

  /**
   * Listen until the speaker pauses. Resolves with the final transcript ('' on silence).
   * onInterim(text) is called with the running transcript for live captions.
   */
  function listen({ onInterim, silenceMs = 2200, firstWordMs = 9000, maxMs = 90000 } = {}) {
    return new Promise((resolve, reject) => {
      if (!supported.stt) return reject(new Error('Speech recognition is not supported in this browser'));
      stopListening();
      const r = new SR();
      rec = r;
      rec.lang = Store.settings.lang || 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      let finalText = '', interim = '', ended = false, heard = false;
      let silenceT = setTimeout(() => stop(), firstWordMs);
      const hardT = setTimeout(() => stop(), maxMs);
      const stop = () => { try { r.stop(); } catch { /* already stopped */ } };
      const done = (val) => {
        if (ended) return; ended = true;
        clearTimeout(silenceT); clearTimeout(hardT);
        cancelListen = null; if (rec === r) rec = null;
        resolve(val.trim());
      };
      cancelListen = () => { done(''); stop(); };
      r.onresult = (ev) => {
        heard = true;
        interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalText += r[0].transcript + ' ';
          else interim += r[0].transcript;
        }
        onInterim && onInterim((finalText + interim).trim());
        clearTimeout(silenceT);
        silenceT = setTimeout(stop, silenceMs);
      };
      r.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { ended = true; clearTimeout(silenceT); clearTimeout(hardT); if (rec === r) rec = null; cancelListen = null; reject(new Error('Microphone permission was denied')); }
        // 'no-speech', 'aborted', 'network' → resolve with whatever we have on end
      };
      r.onend = () => done(heard ? (finalText || interim) : '');
      try { r.start(); } catch (e) { done(''); }
    });
  }
  function stopListening() { if (cancelListen) cancelListen(); else if (rec) { try { rec.abort(); } catch { /* noop */ } rec = null; } }

  /* ---------- Ringtone (Web Audio, classic dual-tone phone ring) ---------- */
  let ctx = null, ringTimer = null, ringNodes = [];
  function audio() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function burst(t0, dur) {
    const a = audio(); if (!a) return;
    const gain = a.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.setValueAtTime(0.18, t0 + dur - 0.03);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    gain.connect(a.destination);
    [440, 480].forEach((f) => {
      const o = a.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(gain); o.start(t0); o.stop(t0 + dur + 0.05);
      ringNodes.push(o);
    });
  }
  function ringOnce() {
    const a = audio(); if (!a) return;
    const t = a.currentTime + 0.05;
    burst(t, 0.4); burst(t + 0.6, 0.4); // UK-style "brr-brr"
    if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
  }
  function startRing() {
    stopRing();
    if (!Store.settings.ringtone) { if (navigator.vibrate) navigator.vibrate([400, 200, 400]); return; }
    ringOnce();
    ringTimer = setInterval(ringOnce, 2600);
  }
  function stopRing() {
    clearInterval(ringTimer); ringTimer = null;
    ringNodes.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
    ringNodes = [];
    if (navigator.vibrate) navigator.vibrate(0);
  }
  function chime(kind = 'up') {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    const notes = kind === 'up' ? [660, 880] : kind === 'end' ? [520, 390] : [880];
    notes.forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.25);
      o.connect(g); g.connect(a.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3);
    });
  }
  // Unlock audio on first user gesture so scheduled rings can make sound.
  let unlocked = false;
  const unlock = () => { unlocked = true; audio(); document.documentElement.classList.add('audio-ok'); };
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true, capture: true }));

  WL.Voice = { supported, speak, stopSpeaking, listen, stopListening, startRing, stopRing, chime, voices: () => voices, isListening: () => !!rec, isUnlocked: () => unlocked };
})(window.WL);
