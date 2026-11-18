'use strict';
/* TANJUNG SENJA — all sound is synthesized with WebAudio. No audio files.
   Three radio stations are tiny step-sequencers with their own scales,
   tempos and waveforms, so each one genuinely sounds different. */

const AudioSys = {
  ctx: null, master: null, started: false,
  station: 0, // 0 off, 1 Senja FM, 2 Koplo Pantura, 3 Pelabuhan Blues
  radioGain: null, radioTimer: null, radioStep: 0,
  engineOsc: null, engineGain: null, engineFilter: null,
  sirenOsc: null, sirenGain: null, sirenLfo: null,

  STATIONS: ['Radio mati', 'Senja FM', 'Koplo Pantura', 'Pelabuhan Blues'],

  init() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = G.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.34;
      this.radioGain.connect(this.master);
      this.started = true;
    } catch (e) { /* no audio available: the game still plays silently */ }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 0.55; },

  // ---------------------------------------------------------- one shots --
  tone(freq, dur, type, vol, when, slideTo, dest) {
    if (!this.started) return;
    const t0 = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, when, freq) {
    if (!this.started) return;
    const t0 = this.ctx.currentTime + (when || 0);
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },
  sfx(name) {
    if (!this.started) return;
    switch (name) {
      case 'punch': this.noise(0.09, 0.30, 0, 500); this.tone(120, 0.08, 'sine', 0.25, 0, 60); break;
      case 'hit': this.noise(0.16, 0.4, 0, 300); this.tone(90, 0.2, 'square', 0.15, 0, 45); break;
      case 'crash': this.noise(0.35, 0.5, 0, 700); this.tone(70, 0.3, 'sawtooth', 0.2, 0, 35); break;
      case 'pickup': this.tone(660, 0.09, 'sine', 0.2); this.tone(990, 0.14, 'sine', 0.2, 0.08); break;
      case 'cash': this.tone(880, 0.07, 'triangle', 0.22); this.tone(1174, 0.07, 'triangle', 0.22, 0.06); this.tone(1568, 0.16, 'triangle', 0.22, 0.12); break;
      case 'shot': this.noise(0.14, 0.55, 0, 2600); this.tone(160, 0.1, 'square', 0.3, 0, 50); break;
      case 'hurt': this.tone(220, 0.15, 'sawtooth', 0.2, 0, 110); break;
      case 'door': this.tone(180, 0.06, 'square', 0.12); this.tone(140, 0.08, 'square', 0.12, 0.07); break;
      case 'job': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, i * 0.09)); break;
      case 'fail': [400, 340, 280, 200].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.14, i * 0.11)); break;
      case 'shell': this.tone(1318, 0.12, 'sine', 0.2); this.tone(1760, 0.2, 'sine', 0.18, 0.09); break;
      case 'busted': [330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'square', 0.16, i * 0.16)); break;
      case 'horn': this.tone(370, 0.18, 'square', 0.12); this.tone(466, 0.18, 'square', 0.1, 0.01); break;
    }
  },

  // -------------------------------------------------------------- radio --
  // Chord/note tables. Frequencies in Hz, 0 = rest.
  _senjaChords: [ // mellow pop: Am7 - Fmaj7 - Cmaj7 - G6, one chord per bar
    [220.0, 261.6, 329.6, 392.0], [174.6, 220.0, 261.6, 349.2],
    [130.8, 196.0, 261.6, 329.6], [196.0, 246.9, 293.7, 392.0],
  ],
  _koploBass: [110, 0, 110, 0, 130.8, 0, 110, 0, 98, 0, 98, 0, 146.8, 0, 164.8, 0],
  _bluesBass: [82.4, 0, 98, 0, 110, 0, 98, 0, 73.4, 0, 87.3, 0, 82.4, 0, 123.5, 0],
  _bluesLead: [329.6, 0, 392, 466.2, 0, 392, 0, 311.1, 0, 329.6, 0, 0, 293.7, 0, 246.9, 0],

  cycleRadio() {
    this.station = (this.station + 1) % 4;
    this._restartRadio();
    return this.STATIONS[this.station];
  },
  _restartRadio() {
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
    if (!this.started || this.station === 0) return;
    this.radioStep = 0;
    const bpm = this.station === 1 ? 76 : (this.station === 2 ? 148 : 62);
    const stepMs = 60000 / bpm / 2; // eighth notes
    const tick = () => {
      if (!this.started || G.mode !== 'playing') return;
      const s = this.radioStep++;
      if (this.station === 1) this._senjaStep(s);
      else if (this.station === 2) this._koploStep(s);
      else this._bluesStep(s);
    };
    tick();
    this.radioTimer = setInterval(tick, stepMs);
  },
  _senjaStep(s) {
    const chord = this._senjaChords[(s >> 3) % 4];
    const note = chord[s % 4] * (s % 8 >= 4 ? 2 : 1);
    this.tone(note, 0.42, 'triangle', 0.16, 0, 0, this.radioGain);
    if (s % 8 === 0) chord.forEach(f => this.tone(f / 2, 1.4, 'sine', 0.07, 0, 0, this.radioGain));
  },
  _koploStep(s) {
    const i = s % 16;
    const bass = this._koploBass[i];
    if (bass) this.tone(bass, 0.16, 'square', 0.13, 0, 0, this.radioGain);
    if (i % 4 === 0) this.noise(0.05, 0.20, 0, 900);            // kendang tak
    if (i % 4 === 2) this.noise(0.09, 0.26, 0, 300);            // kendang dang (low)
    if (i % 2 === 1) this.tone(1568, 0.05, 'square', 0.05, 0, 0, this.radioGain); // kempul tick
    if (s % 32 >= 24 && i % 2 === 0) this.tone([587, 659, 740, 880][(i >> 1) % 4], 0.12, 'sawtooth', 0.06, 0, 0, this.radioGain);
  },
  _bluesStep(s) {
    const i = s % 16;
    const bass = this._bluesBass[i];
    if (bass) this.tone(bass, 0.5, 'triangle', 0.2, 0, 0, this.radioGain);
    const lead = this._bluesLead[(s >> 4) % 2 === 0 ? i : (i + 5) % 16];
    if (lead && s % 32 >= 16) this.tone(lead * 2, 0.34, 'triangle', 0.08, 0, lead * 1.9, this.radioGain);
    if (i === 0) this.noise(0.2, 0.03, 0, 6000); // brush
  },

  // ------------------------------------------------------------- engine --
  startEngine() {
    if (!this.started || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter); this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  },
  setEngine(speedRatio, running) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    const f = 55 + Math.abs(speedRatio) * 165;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(280 + Math.abs(speedRatio) * 900, t, 0.06);
    this.engineGain.gain.setTargetAtTime(running ? 0.075 : 0.0, t, 0.09);
  },
  stopEngine() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; }
  },

  // -------------------------------------------------------------- siren --
  setSiren(on) {
    if (!this.started) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 760;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square'; this.sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 190;
      this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.028;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenLfo = null;
    }
  },
};
