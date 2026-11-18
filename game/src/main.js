'use strict';
/* TANJUNG SENJA: LAST LIGHT — boot, input, camera, the game loop, and the
   big state changes (start / pause / busted / wasted / ending / save). */

const Main = {
  renderer: null, scene: null, camera: null,
  camYaw: 2.4, camPitch: 0.32, camDist: 8,
  keys: {}, dragging: false, lastMouse: null,
  saveTimer: 0, started: false,

  input() {
    return {
      up: !!(this.keys.KeyW || this.keys.ArrowUp),
      down: !!(this.keys.KeyS || this.keys.ArrowDown),
      left: !!(this.keys.KeyA || this.keys.ArrowLeft),
      right: !!(this.keys.KeyD || this.keys.ArrowRight),
      sprint: !!(this.keys.ShiftLeft || this.keys.ShiftRight),
    };
  },

  boot() {
    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    const seed = parseInt(params.get('seed') || '1', 10) || 1;
    seedRNG(shot ? seed : (Date.now() % 2147483647));
    if (shot) { G.shotMode = shot; G.mode = 'shot'; }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1600);
    this.camera.position.set(-218, 25, 46);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-holder').appendChild(this.renderer.domElement);

    World.init(this.scene);
    Vehicles.initTraffic();
    People.initPlayer();
    People.spawnCrowd();
    Missions.init();
    HUD.init();
    this._bindInput();
    this._bindMenus();

    if (shot) {
      document.getElementById('title-screen').style.display = shot === 'start' ? 'flex' : 'none';
      document.getElementById('hud').style.display = (shot === 'play' || shot === 'chase') ? 'block' : 'none';
      Shots.setup(shot);
      if (shot === 'end') this._fillEnding();
      if (shot === 'end') document.getElementById('ending-screen').style.display = 'flex';
      this.started = true;
    } else {
      const save = loadSave();
      const cont = document.getElementById('btn-continue');
      if (cont) cont.disabled = !save;
    }
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  },

  // -------------------------------------------------------------- input --
  _bindInput() {
    addEventListener('keydown', (ev) => {
      this.keys[ev.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
      if (G.mode === 'dialogue' && (ev.code === 'Enter' || ev.code === 'Space')) { HUD.dialogueNext(); return; }
      if (G.mode !== 'playing') {
        if ((ev.code === 'KeyP' || ev.code === 'Escape') && G.mode === 'paused') this.resume();
        return;
      }
      if (ev.code === 'KeyE' || ev.code === 'KeyF') this._toggleVehicle();
      if (ev.code === 'KeyP' || ev.code === 'Escape') this.pause();
      if (ev.code === 'KeyR' && People.player.vehicle) {
        const name = AudioSys.cycleRadio();
        HUD.toast('📻 ' + name);
      }
      if (ev.code === 'KeyM') {
        G.muted = !G.muted;
        AudioSys.setMuted(G.muted);
        HUD.toast(G.muted ? 'Suara mati (M)' : 'Suara nyala (M)');
      }
    });
    addEventListener('keyup', (ev) => { this.keys[ev.code] = false; });
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (ev) => {
      this.dragging = true;
      this.lastMouse = { x: ev.clientX, y: ev.clientY };
      AudioSys.resume();
    });
    addEventListener('pointermove', (ev) => {
      if (!this.dragging || !this.lastMouse) return;
      const dx = ev.clientX - this.lastMouse.x;
      const dy = ev.clientY - this.lastMouse.y;
      this.lastMouse = { x: ev.clientX, y: ev.clientY };
      if (!People.player.vehicle) {
        this.camYaw -= dx * 0.005;
        this.camPitch = clamp(this.camPitch + dy * 0.004, 0.05, 1.15);
      }
    });
    addEventListener('pointerup', (ev) => {
      const wasDrag = this.dragging && this.lastMouse &&
        (Math.abs(ev.clientX - this.lastMouse.x) + Math.abs(ev.clientY - this.lastMouse.y) > 6);
      this.dragging = false;
      this.lastMouse = null;
      if (G.mode === 'dialogue') { HUD.dialogueNext(); return; }
      if (G.mode !== 'playing' || wasDrag) return;
      if (ev.target !== el) return;
      // A clean click: shoot with the pistol, otherwise throw a punch.
      if (G.hasPistol && !People.player.vehicle) People.tryShoot(this.camera);
      else People.tryPunch();
    });
  },

  _toggleVehicle() {
    const pl = People.player;
    AudioSys.resume();
    if (pl.vehicle) {
      const car = pl.vehicle;
      const p = car.mesh.position;
      pl.mesh.position.set(p.x + Math.cos(car.angle) * 2.2, 0.15, p.z - Math.sin(car.angle) * 2.2);
      pl.angle = car.angle;
      pl.mesh.visible = true;
      if (car.role === 'player') car.role = 'parked';
      pl.vehicle = null;
      car.speed = 0;
      AudioSys.setEngine(0, false);
      AudioSys.stopEngine();
      if (AudioSys.radioTimer) { clearInterval(AudioSys.radioTimer); AudioSys.radioTimer = null; }
      AudioSys.sfx('door');
      saveGame();
    } else {
      const car = Vehicles.nearestCar(pl.mesh.position, 3.6);
      if (!car) return;
      const wasTraffic = car.role === 'traffic';
      if (wasTraffic) {
        People.spawnFleeingDriver(car.mesh.position.x, car.mesh.position.z);
        Police.crime(1, true);
        G.stats.carsStolen++;
        HUD.toast('Mobil dicuri! Wanted naik.');
      } else if (car.role === 'parked') G.stats.carsStolen += 0; // your own rides are free
      car.role = 'player';
      car.speed = 0;
      pl.vehicle = car;
      pl.mesh.visible = false;
      AudioSys.init(); AudioSys.resume();
      AudioSys.startEngine();
      if (AudioSys.station === 0) { AudioSys.station = 1; HUD.toast('📻 Senja FM'); }
      AudioSys._restartRadio();
      AudioSys.sfx('door');
    }
  },

  // -------------------------------------------------------------- menus --
  _bindMenus() {
    const on = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
    on('btn-new', () => this.startGame(true));
    on('btn-continue', () => this.startGame(false));
    on('btn-resume', () => this.resume());
    on('btn-respawn-busted', () => this.respawn('busted'));
    on('btn-respawn-wasted', () => this.respawn('wasted'));
    on('btn-freeroam', () => {
      document.getElementById('ending-screen').style.display = 'none';
      G.mode = 'playing'; G.freeRoam = true;
      HUD.toast('Namamu bersih. Tanjung Senja milikmu sekarang — roam bebas!');
    });
  },

  startGame(fresh) {
    AudioSys.init(); AudioSys.resume();
    if (fresh) {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      G.money = 120; G.jobIndex = 0; G.hasPistol = false;
      G.shells = {}; G.shellsFound = 0; G.taxiFares = 0; G.raceBest = 0;
      G.stats = { jobsDone: 0, carsStolen: 0, earned: 0, bustedCount: 0, wastedCount: 0 };
      People.player.mesh.position.set(G.playerPos.x, 0.15, G.playerPos.z);
      Missions.shellMeshes.forEach(s => { s.visible = true; });
    } else {
      const save = loadSave();
      if (applySave(save)) {
        People.player.mesh.position.set(G.playerPos.x, 0.15, G.playerPos.z);
        Missions.shellMeshes.forEach((s, i) => { s.visible = !G.shells[i]; });
      }
    }
    G.health = 100; G.wanted = 0;
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    G.mode = 'playing';
    this.started = true;
    HUD.banner('TANJUNG SENJA · Pekerjaan menanti di penanda kuning');
    HUD.toast('WASD jalan · E masuk mobil · klik pukul · Shift lari');
  },

  pause() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    document.getElementById('pause-screen').style.display = 'flex';
  },
  resume() {
    document.getElementById('pause-screen').style.display = 'none';
    if (G.mode === 'paused') G.mode = 'playing';
  },

  showDialogue(lines, cb) { HUD.showDialogue(lines, cb); },

  busted() {
    if (G.mode !== 'playing') return;
    G.mode = 'busted';
    G.stats.bustedCount++;
    AudioSys.sfx('busted');
    AudioSys.setSiren(false);
    document.getElementById('busted-screen').style.display = 'flex';
  },
  wasted() {
    if (G.mode !== 'playing') return;
    G.mode = 'wasted';
    G.stats.wastedCount++;
    AudioSys.sfx('fail');
    document.getElementById('wasted-screen').style.display = 'flex';
  },
  respawn(kind) {
    document.getElementById(kind + '-screen').style.display = 'none';
    const pl = People.player;
    if (pl.vehicle) {
      if (pl.vehicle.role === 'player') pl.vehicle.role = 'parked';
      pl.vehicle.speed = 0;
      pl.vehicle = null;
      pl.mesh.visible = true;
      AudioSys.stopEngine();
    }
    Police.reset();
    G.health = 100;
    G.bustedMeter = 0;
    const fee = kind === 'busted' ? 150 : 100;
    G.money = Math.max(0, G.money - fee);
    const spot = kind === 'busted' ? PLACES.policeStation : PLACES.clinic;
    pl.mesh.position.set(spot.x, 0.15, spot.z);
    if (Missions.active) Missions.failStep(kind === 'busted' ? 'Tertangkap — pekerjaan diulang dari langkah ini.' : 'Kau pingsan — pekerjaan diulang dari langkah ini.');
    G.mode = 'playing';
    HUD.toast(kind === 'busted' ? 'Denda Rp' + fee + ' — lain kali jangan berhenti.' : 'Biaya klinik Rp' + fee + '.');
    saveGame();
  },

  _fillEnding() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('end-money', 'Rp ' + G.money.toLocaleString('id-ID'));
    set('end-earned', 'Rp ' + G.stats.earned.toLocaleString('id-ID'));
    set('end-jobs', G.stats.jobsDone + ' / 9');
    set('end-shells', G.shellsFound + ' / 10');
    set('end-cars', G.stats.carsStolen);
    set('end-taxi', G.taxiFares);
    set('end-race', G.raceBest ? G.raceBest.toFixed(1) + ' dtk' : '—');
    set('end-busted', G.stats.bustedCount + '× ditangkap · ' + G.stats.wastedCount + '× pingsan');
  },
  ending() {
    this._fillEnding();
    document.getElementById('ending-screen').style.display = 'flex';
    G.mode = 'ended';
    AudioSys.sfx('job');
    saveGame();
  },

  // --------------------------------------------------------------- loop --
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = clamp(dt, 0, 0.05);
    const input = this.input();

    if (G.mode === 'shot') {
      World.update(dt);
      People.update(dt, {}, this.camera);
      if (Police.heli) Police.heli.userData.rotor.rotation.y += dt * 28;
      Shots.frame(G.shotMode, this.camera, now / 1000);
      HUD.update(0);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (G.mode === 'title' || !this.started) {
      World.update(dt);
      this.camera.position.set(-218 + Math.sin(now / 9000) * 6, 25, 46);
      this.camera.lookAt(-40, 4, -50);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (G.mode === 'paused' || G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'ended') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // dialogue: the world breathes, but nobody acts
    World.update(dt);
    if (G.mode === 'dialogue') {
      Vehicles.update(dt);
      People.update(dt, {}, this.camera);
      this._updateCamera(dt);
      HUD.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // playing
    G.time += dt * 0.9; // ~1 in-game minute per real second, always near sunset
    if (G.time > 19 * 60 + 30) G.time = 17 * 60 + 5; // the senja never fully ends
    const pl = People.player;
    if (pl.vehicle) Vehicles.driveUpdate(pl.vehicle, input, dt);
    People.update(dt, input, this.camera);
    Vehicles.update(dt);
    Police.update(dt);
    Missions.update(dt);
    if (G.wanted < 0.5 && G.health < 100 && G.health > 0) G.health = Math.min(100, G.health + dt * 1.6);
    this._updateCamera(dt);
    HUD.update(dt);
    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; saveGame(); }
    this.renderer.render(this.scene, this.camera);
  },

  _updateCamera(dt) {
    const pl = People.player;
    const target = pl.vehicle ? pl.vehicle.mesh.position : pl.mesh.position;
    if (pl.vehicle) {
      // Chase camera settles behind the car.
      const wantYaw = pl.vehicle.angle + Math.PI;
      this.camYaw = angleLerp(this.camYaw, wantYaw, clamp(dt * 3.2, 0, 1));
      this.camPitch = lerp(this.camPitch, 0.30, clamp(dt * 3, 0, 1));
      this.camDist = lerp(this.camDist, 10.5, clamp(dt * 3, 0, 1));
    } else {
      this.camDist = lerp(this.camDist, 7.5, clamp(dt * 3, 0, 1));
    }
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const h = Math.sin(this.camPitch) * this.camDist;
    const back = Math.cos(this.camPitch) * this.camDist;
    this.camera.position.set(
      target.x - fx * back,
      target.y + 1.6 + h,
      target.z - fz * back
    );
    if (this.camera.position.y < 1.1) this.camera.position.y = 1.1;
    this.camera.lookAt(target.x + fx * 3, target.y + 1.5, target.z + fz * 3);
  },
};

window.addEventListener('error', (ev) => {
  const box = document.getElementById('errbox');
  if (box) { box.style.display = 'block'; box.textContent = 'Error: ' + ev.message; }
});

document.addEventListener('DOMContentLoaded', () => Main.boot());
