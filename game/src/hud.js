'use strict';
/* TANJUNG SENJA — HUD: money, clock, stars, health, objective, banner,
   toasts, dialogue boxes, speedometer, radio label and the minimap. */

const HUD = {
  els: {},
  objectiveText: '',
  bannerTimer: 0, toastTimer: 0, hurtTimer: 0,
  dlg: null, // {lines, idx, cb}

  init() {
    const ids = ['money', 'clock', 'shells', 'stars', 'bustedWrap', 'bustedInner',
      'healthInner', 'objective', 'banner', 'toast', 'speedWrap', 'speed', 'radio',
      'minimap', 'crosshair', 'dialogue', 'dialogueText', 'hurt', 'jobLabel'];
    for (const id of ids) this.els[id] = document.getElementById('hud-' + id);
    this.mapCtx = this.els.minimap ? this.els.minimap.getContext('2d') : null;
  },

  setObjective(text) { this.objectiveText = text; },
  banner(text) {
    if (!this.els.banner) return;
    this.els.banner.textContent = text;
    this.els.banner.style.opacity = '1';
    this.bannerTimer = 3.2;
  },
  toast(text) {
    if (!this.els.toast) return;
    this.els.toast.textContent = text;
    this.els.toast.style.opacity = '1';
    this.toastTimer = 3.6;
  },
  flashHurt() { this.hurtTimer = 0.5; },

  // ------------------------------------------------------------ dialogue --
  showDialogue(lines, cb) {
    this.dlg = { lines: lines.slice(), idx: 0, cb };
    G.mode = 'dialogue';
    this._dlgRender();
    if (this.els.dialogue) this.els.dialogue.style.display = 'block';
  },
  _dlgRender() {
    if (!this.dlg || !this.els.dialogueText) return;
    this.els.dialogueText.textContent = this.dlg.lines[this.dlg.idx];
  },
  dialogueNext() {
    if (!this.dlg) return;
    AudioSys.resume();
    this.dlg.idx++;
    if (this.dlg.idx >= this.dlg.lines.length) {
      const cb = this.dlg.cb;
      this.dlg = null;
      if (this.els.dialogue) this.els.dialogue.style.display = 'none';
      if (G.mode === 'dialogue') G.mode = 'playing';
      if (cb) cb();
    } else this._dlgRender();
  },

  fmtClock() {
    const t = ((G.time % 1440) + 1440) % 1440;
    const h = Math.floor(t / 60), m = Math.floor(t % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  },

  update(dt) {
    const e = this.els;
    if (!e.money) return;
    e.money.textContent = 'Rp ' + G.money.toLocaleString('id-ID');
    e.clock.textContent = this.fmtClock();
    e.shells.textContent = '🐚 ' + G.shellsFound + '/10';
    const stars = Math.floor(G.wanted + 0.0001);
    e.stars.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars);
    e.stars.style.color = stars > 0 ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    e.bustedWrap.style.display = G.bustedMeter > 0.02 ? 'block' : 'none';
    e.bustedInner.style.width = (G.bustedMeter * 100).toFixed(0) + '%';
    e.healthInner.style.width = clamp(G.health, 0, 100) + '%';
    e.healthInner.style.background = G.health > 45 ? '#7dc73a' : (G.health > 22 ? '#e8a33a' : '#e83a3a');

    // Objective line: the mission runner's live target wins; else the
    // last text set by a step (timers), else a free-roam hint.
    const target = (G.mode === 'playing' || G.mode === 'dialogue') ? Missions.objectiveTarget() : null;
    let obj = '';
    if (target) {
      const p = People.player.vehicle ? People.player.vehicle.mesh.position : People.player.mesh.position;
      const d = Math.round(dist2d(p.x, p.z, target.x, target.z));
      obj = target.text + (Missions.active && Missions.active.job.steps[Missions.active.stepIdx] &&
        Missions.active.job.steps[Missions.active.stepIdx].type === 'survive' ? '' : ' · ' + d + ' m');
    } else if (this.objectiveText) obj = this.objectiveText;
    e.objective.textContent = obj;
    e.jobLabel.textContent = Missions.active ? Missions.active.job.title :
      (G.jobIndex < Missions.JOBS.length ? 'Cerita: ' + (G.jobIndex + 1) + '/9 pekerjaan selesai ' + G.stats.jobsDone : 'Cerita selesai — roam bebas');

    // Speed + radio while driving.
    const veh = People.player.vehicle;
    if (veh) {
      e.speedWrap.style.display = 'block';
      e.speed.textContent = Math.round(Math.abs(veh.speed) * 3.6) + '';
      e.radio.textContent = '📻 ' + AudioSys.STATIONS[AudioSys.station] + ' (R)';
    } else e.speedWrap.style.display = 'none';

    // Crosshair only when armed and on foot.
    e.crosshair.style.display = (G.hasPistol && !veh && G.mode === 'playing') ? 'block' : 'none';

    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) e.banner.style.opacity = '0'; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) e.toast.style.opacity = '0'; }
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      e.hurt.style.opacity = String(clamp(this.hurtTimer * 1.4, 0, 0.65));
    } else e.hurt.style.opacity = '0';

    this._drawMinimap(target);
  },

  _drawMinimap(target) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const S = 190, HALF = 285; // world ±285 m maps onto the canvas
    const w2m = (x, z) => [(x + HALF) / (HALF * 2) * S, (z + HALF) / (HALF * 2) * S];
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, 0, S, S);
    // Sea + beach on the west.
    let [wx] = w2m(BEACH_X0, 0);
    ctx.fillStyle = '#1e5a74'; ctx.fillRect(0, 0, wx, S);
    let [bx] = w2m(BEACH_X1, 0);
    ctx.fillStyle = '#d9b078'; ctx.fillRect(wx, 0, bx - wx, S);
    // Blocks.
    ctx.fillStyle = '#2e333b';
    for (let i = -GRID; i < GRID; i++) for (let j = -GRID; j < GRID; j++) {
      const [x, y] = w2m(blockCenter(i) - BLOCK / 2, blockCenter(j) - BLOCK / 2);
      const sz = BLOCK / (HALF * 2) * S;
      ctx.fillRect(x, y, sz, sz);
    }
    // Roads.
    ctx.strokeStyle = '#4a4f58'; ctx.lineWidth = ROAD / (HALF * 2) * S;
    ctx.beginPath();
    for (let i = -GRID; i <= GRID; i++) {
      const [x] = w2m(streetCoord(i), 0);
      ctx.moveTo(x, 0); ctx.lineTo(x, S);
      const [, y] = w2m(0, streetCoord(i));
      ctx.moveTo(0, y); ctx.lineTo(S, y);
    }
    ctx.stroke();
    // Garage + safehouse icons.
    const dot = (x, z, color, r) => { const [mx, my] = w2m(x, z); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx, my, r || 3, 0, 7); ctx.fill(); };
    dot(PLACES.garage.x, PLACES.garage.z, '#ffa726', 3.4);
    dot(PLACES.safehouse.x, PLACES.safehouse.z, '#7dc73a', 3.4);
    // Uncollected shells.
    Missions.SHELL_SPOTS.forEach(([x, z], i) => { if (!G.shells[i]) dot(x, z, '#ffd94d', 1.8); });
    // Police blips.
    for (const u of Police.units) dot(u.car.mesh.position.x, u.car.mesh.position.z, '#5a8cff', 2.6);
    if (Police.heli) dot(Police.heli.position.x, Police.heli.position.z, '#5a8cff', 3.4);
    // Mission target.
    if (target) {
      const [mx, my] = w2m(target.x, target.z);
      const pulse = 4.5 + Math.sin(performance.now() / 200) * 1.4;
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath(); ctx.arc(mx, my, pulse, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(mx, my, pulse + 2.4, 0, 7); ctx.stroke();
    }
    // Player arrow.
    const pl = People.player;
    const pp = pl.vehicle ? pl.vehicle.mesh.position : pl.mesh.position;
    const [px, py] = w2m(pp.x, pp.z);
    const ang = pl.vehicle ? pl.vehicle.angle : pl.angle;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - ang); // canvas y is world +z; triangle points up at rest
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },
};
