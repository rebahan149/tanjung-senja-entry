'use strict';
/* TANJUNG SENJA — story jobs, the mission runner, and side activities.
   Bima, a harbour launch pilot, was framed for a phantom smuggling run.
   Fixer Laras holds the real ledger. Nine jobs earn it back. */

const Missions = {
  active: null,        // {job, stepIdx, t, collectIdx, warned, holdT}
  startMarkerJob: -1,
  marker: null, markerTop: null,
  followTruck: null, followIdx: 0, followLoseT: 0, followRams: 0,
  guards: [],
  taxi: { phase: 'idle', ped: null, dest: null, timer: 8 },
  race: { phase: 'idle', idx: 0, t: 0 },
  garageInside: false,
  stepWantedFloor: 0,

  JOBS: [
    {
      title: '1 · First Light Run', reward: 150, start: PLACES.larasKiosk,
      intro: [
        'LARAS: Bima. Wajahmu masuk daftar hitam manifest gara-gara muatan hantu yang tak pernah ada.',
        'LARAS: Buku besar aslinya ada padaku — tapi tidak gratis. Kerja dulu untukku, mulai pagi ini.',
        'BIMA: Asal namaku bersih lagi, Laras. Mulai dari mana?',
        'LARAS: Hatchback tuaku di kantor pelabuhan. Ambil, lalu antar dokumen ini ke Pelabuhan Lama.',
      ],
      outro: ['LARAS (radio): Bagus. Kaki-kakimu masih ingat kota ini. Lanjut ke pekerjaan berikutnya.'],
      steps: [
        { type: 'goto', x: -146, z: -128, r: 5, label: 'Ambil hatchback teal di kantor pelabuhan (E untuk masuk)' },
        { type: 'goto', x: -176, z: -102, r: 8, needCar: true, label: 'Antar dokumen ke Pelabuhan Lama' },
      ],
    },
    {
      title: '2 · Market Debts', reward: 200, start: PLACES.pasarSenja,
      intro: [
        'LARAS: Tiga pedagang Pasar Senja berutang padaku. Amplop-amplop itu berkeliaran entah di mana.',
        'BIMA: Jadi sekarang aku debt collector?',
        'LARAS: Sebut saja kurir berseragam matahari terbenam. Kumpulkan tiga amplopnya.',
      ],
      outro: ['LARAS (radio): Tiga amplop, lengkap. Pedagang pasar titip salam — dan keringat dingin.'],
      steps: [
        { type: 'collect', label: 'Kumpulkan amplop utang', points: [[18, -16], [44, -38], [70, 18]] },
      ],
    },
    {
      title: '3 · The Night Manifest', reward: 260, start: PLACES.harbourOffice,
      intro: [
        'LARAS: Truk gudang itu membawa manifest palsu yang menjebakmu. Ikuti dia.',
        'BIMA: Kalau ketahuan?',
        'LARAS: Jaga jarak. Jangan sampai hilang, jangan menabraknya. Biar dia tunjukkan ke mana muatan hantu itu pergi.',
      ],
      outro: ['LARAS (radio): Dia berhenti di pasar selatan — jadi di sana muatan hantu itu "dibongkar". Satu petunjuk lagi terkunci.'],
      steps: [
        { type: 'follow', label: 'Ikuti truk gudang — jaga jarak, jangan tabrak' },
      ],
    },
    {
      title: '4 · Hot Cargo', reward: 320, start: PLACES.gudang9,
      intro: [
        'LARAS: Kargo ini harus sampai ke Menara TV Senja sebelum matahari tenggelam penuh. Cepat.',
        'BIMA: Dan polisi?',
        'LARAS: Mereka akan mengendus muatan ini. Itu sebabnya aku memanggil pilot tercepat di pelabuhan.',
      ],
      outro: ['LARAS (radio): Tepat waktu. Stasiun TV berhutang padaku sekarang — itu akan berguna nanti.'],
      steps: [
        { type: 'timed', x: 118, z: -118, r: 9, seconds: 80, wanted: 2, label: 'Antar kargo panas ke Menara TV Senja' },
      ],
    },
    {
      title: '5 · Witness Run', reward: 380, start: PLACES.clinic,
      intro: [
        'LARAS: Ada saksi — juru mudi malam itu. Dia mau bicara, tapi orang-orang yang menjebakmu juga mencarinya.',
        'BIMA: Jemput di klinik, antar ke rumah aman Bukit Cahaya.',
        'LARAS: Dan jangan berhenti untuk polisi. Dia tidak boleh sampai ke kantor mereka.',
      ],
      outro: ['SAKSI: Aku lihat siapa yang menandatangani manifest palsu itu. Semua akan kubilang ke Laras.', 'LARAS (radio): Saksi aman. Ceritanya cocok dengan buku besar. Sedikit lagi, Bima.'],
      steps: [
        { type: 'goto', x: 62, z: -152, r: 8, needCar: true, label: 'Jemput saksi di Klinik Pusat Kota (pakai mobil)' },
        { type: 'evade', x: 96, z: 120, r: 8, wanted: 2, label: 'Antar saksi ke Rumah Aman Bukit Cahaya' },
      ],
    },
    {
      title: '6 · The Harbour Ledger', reward: 450, start: PLACES.larasKiosk,
      intro: [
        'LARAS: Halaman asli buku besar itu disimpan di kantor Gudang 9. Penjaga bersenjata berkeliaran di sana.',
        'BIMA: Aku pilot, bukan maling.',
        'LARAS: Malam ini kau keduanya. Ada pistol tua di dekat pintu gudang — ambil kalau berani. Ambil halamannya, keluar hidup-hidup.',
      ],
      outro: ['BIMA (radio): Halamannya dapat. Nama penandatangannya… aku kenal orang ini.', 'LARAS (radio): Simpan baik-baik. Sekarang kita buat mereka panik.'],
      steps: [
        { type: 'goto', x: -135, z: -62, r: 5, onFoot: true, label: 'Masuk Gudang 9 dengan berjalan kaki' },
        { type: 'pickup', x: -127, z: -70, r: 2.6, label: 'Ambil pistol di dekat tumpukan peti' },
        { type: 'goto', x: -135, z: -90, r: 3.4, onFoot: true, label: 'Ambil halaman buku besar di meja kantor' },
        { type: 'goto', x: -135, z: -48, r: 6, label: 'Keluar dari kawasan Gudang 9' },
      ],
    },
    {
      title: '7 · Decoy Convoy', reward: 520, start: PLACES.harbourOffice,
      intro: [
        'LARAS: Malam ini konvoi asli bergerak tanpa muatan berharga — dan kau umpannya.',
        'BIMA: Truk umpan. Polisi mengejarku, konvoi asli lolos.',
        'LARAS: Tahan 90 detik di truk itu. Jangan tertangkap, jangan hancur. Seperti biasa.',
      ],
      outro: ['LARAS (radio): Konvoi asli sudah lewat jembatan. Kau resmi hantu sekarang, Bima.'],
      steps: [
        { type: 'boardTruck', x: -152, z: -96, r: 6, label: 'Naik truk umpan di pelabuhan (E)' },
        { type: 'survive', seconds: 90, wanted: 3, label: 'Bertahan dari kejaran polisi' },
      ],
    },
    {
      title: '8 · Signal Fire', reward: 600, start: PLACES.pantai,
      intro: [
        'LARAS: Kapal saksi terakhir hanya percaya satu tanda: api sinyal di Mercusuar Tanjung, seperti dulu.',
        'BIMA: Nyalakan sinyalnya, tahan sampai menyala penuh.',
        'LARAS: Lima detik di lingkaran cahayanya. Angin pantai sisanya biar aku yang urus.',
      ],
      outro: ['LARAS (radio): Kapal itu menjawab dengan lampunya. Saksi terakhir bergerak. Satu pekerjaan terakhir, Bima.'],
      steps: [
        { type: 'goto', x: -220, z: 188, r: 7, label: 'Pergi ke Mercusuar Tanjung' },
        { type: 'hold', x: -222, z: 192, r: 6.5, seconds: 5, label: 'Nyalakan api sinyal — tahan di lingkaran' },
      ],
    },
    {
      title: '9 · Last Light', reward: 1000, start: PLACES.tvTower,
      intro: [
        'LARAS: Semua bukti lengkap: halaman buku besar, saksi, dan rute muatan hantu.',
        'BIMA: Antar ke Menara TV Senja sebelum gelap. Mereka akan mengerahkan segalanya.',
        'LARAS: Lima bintang pun tidak apa. Begitu bukti ini siaran langsung, namamu bersih, Bima.',
      ],
      outro: ['LARAS (radio): Bukti terkirim. Lihat layarnya, Bima — itu namamu, dibersihkan langsung di televisi.'],
      steps: [
        { type: 'deliver', x: 124, z: -122, r: 9, wanted: 5, label: 'Antar buku besar ke Menara TV Senja — JANGAN TERTANGKAP' },
      ],
    },
  ],

  SHELL_SPOTS: [
    [-222, 186], [-196, 40], [-196, -40], [-188, 150], [-170, -150],
    [30, -30], [128, 76], [96, 118], [140, -128], [-20, 158],
  ],

  // -------------------------------------------------------------- setup --
  init() {
    // Mission marker: a pillar of golden light + floating diamond.
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.7, 34, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc94d, transparent: true, opacity: 0.30,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    cyl.position.y = 17;
    const grp = new THREE.Group();
    grp.add(cyl);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
    );
    diamond.position.y = 4.4;
    grp.add(diamond);
    grp.visible = false;
    World.group.add(grp);
    this.marker = grp;
    this.markerTop = diamond;

    // Golden shells (kerang emas).
    this.shellMeshes = [];
    const shellMat = new THREE.MeshPhongMaterial({ color: 0xffc21f, shininess: 90, emissive: 0x664d00 });
    this.SHELL_SPOTS.forEach(([x, z], i) => {
      const s = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
      dome.scale.set(1, 0.75, 1); s.add(dome);
      for (let r = 0; r < 5; r++) {
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.8), shellMat);
        const a = (r / 4 - 0.5) * 1.1;
        ridge.position.set(Math.sin(a) * 0.4, 0.18, -Math.cos(a) * 0.15);
        ridge.rotation.z = -a; s.add(ridge);
      }
      s.position.set(x, 0.5, z);
      s.userData.shellId = i;
      World.group.add(s);
      this.shellMeshes.push(s);
      if (G.shells[i]) s.visible = false;
    });

    // Pistol pickup prop (hidden until job 6 needs it).
    const pg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x22242a }));
    pg.add(body);
    pg.position.set(-127, 0.6, -70);
    pg.visible = false;
    World.group.add(pg);
    this.pistolProp = pg;
  },

  forcedWanted() { return this.stepWantedFloor || 0; },

  // --------------------------------------------------------- job flow --
  nextJobStart() {
    if (G.jobIndex >= this.JOBS.length) return null;
    return this.JOBS[G.jobIndex];
  },

  startJob(idx) {
    const job = this.JOBS[idx];
    this.active = { job, stepIdx: 0, t: 0, collectIdx: 0, holdT: 0, warned: false };
    this.stepWantedFloor = 0;
    HUD.banner(job.title);
    AudioSys.sfx('job');
    if (idx === 5) this._spawnGuards();
    this._enterStep();
  },

  _spawnGuards() {
    for (const g of this.guards) { World.group.remove(g.mesh); }
    this.guards = [];
    const defs = [
      { patrol: [[-146, -70], [-124, -70]], shirt: 0x37424e },
      { patrol: [[-124, -88], [-146, -88]], shirt: 0x4a3728 },
      { patrol: [[-135, -58], [-135, -76]], shirt: 0x2e4038 },
    ];
    for (const d of defs) {
      const ped = People.spawnPed(d.patrol[0][0], d.patrol[0][1], { guard: true, patrol: d.patrol, shirt: d.shirt, state: 'guard' });
      ped.hp = 2;
      this.guards.push(ped);
    }
    People.guardsActive = true;
  },

  _enterStep() {
    const a = this.active;
    if (!a) return;
    const step = a.job.steps[a.stepIdx];
    a.t = 0; a.holdT = 0; a.warned = false;
    this.stepWantedFloor = step.wanted || 0;
    if (this.stepWantedFloor > 0) Police.setWanted(Math.max(G.wanted, this.stepWantedFloor));
    if (step.type === 'follow') this._startFollow();
    if (step.type === 'pickup') this.pistolProp.visible = true;
    if (step.type === 'boardTruck') {
      if (!this.decoyTruck || !Vehicles.all.includes(this.decoyTruck)) {
        this.decoyTruck = Vehicles.spawn('truck', step.x, step.z, 1.4, { role: 'parked', color: 0xc7c2b4 });
      }
    }
    HUD.setObjective(step.label);
  },

  _startFollow() {
    if (this.followTruck) { Vehicles.removeCar(this.followTruck); this.followTruck = null; }
    const truck = Vehicles.spawn('truck', -160, -104, Math.PI / 2, { role: 'mission', color: 0x8a94a6 });
    truck.speed = 0;
    this.followTruck = truck;
    this.followIdx = 0;
    this.followLoseT = 0; this.followRams = 0;
    this.followRoute = [[-54, -108], [52, -108], [54, 20], [74, 24]];
  },

  _stepDone() {
    const a = this.active;
    AudioSys.sfx('pickup');
    a.stepIdx++;
    if (a.stepIdx >= a.job.steps.length) { this._completeJob(); return; }
    this._enterStep();
  },

  _completeJob() {
    const job = this.active.job;
    const wasLast = G.jobIndex === this.JOBS.length - 1;
    G.money += job.reward;
    G.stats.earned += job.reward;
    G.stats.jobsDone++;
    G.jobIndex++;
    this.active = null;
    this.stepWantedFloor = 0;
    People.guardsActive = false;
    this.pistolProp.visible = false;
    if (this.followTruck) { Vehicles.removeCar(this.followTruck); this.followTruck = null; }
    AudioSys.sfx('cash');
    HUD.banner('PEKERJAAN SELESAI · +Rp' + job.reward);
    saveGame();
    Main.showDialogue(job.outro, () => {
      if (wasLast) Main.ending();
      else HUD.toast('Pekerjaan berikutnya menunggu di penanda kuning.');
    });
  },

  failStep(msg) {
    if (!this.active) return;
    AudioSys.sfx('fail');
    HUD.toast(msg || 'Gagal — ulangi langkah ini.');
    if (this.followTruck) { Vehicles.removeCar(this.followTruck); this.followTruck = null; }
    this._enterStep();
  },

  objectiveTarget() {
    // Returns {x, z, text} for HUD/minimap, or null in free roam.
    if (this.active) {
      const step = this.active.job.steps[this.active.stepIdx];
      if (!step) return null;
      switch (step.type) {
        case 'goto': case 'timed': case 'evade': case 'deliver': case 'hold': case 'pickup': case 'boardTruck':
          return { x: step.x, z: step.z, text: step.label };
        case 'collect': {
          const pts = step.points[this.active.collectIdx];
          if (pts) return { x: pts[0], z: pts[1], text: step.label + ' (' + this.active.collectIdx + '/' + step.points.length + ')' };
          return null;
        }
        case 'follow':
          if (this.followTruck) return { x: this.followTruck.mesh.position.x, z: this.followTruck.mesh.position.z, text: step.label };
          return null;
        case 'survive':
          return { x: People.player.mesh.position.x, z: People.player.mesh.position.z, text: step.label + ' — ' + Math.ceil(step.seconds - this.active.t) + ' dtk' };
      }
      return null;
    }
    if (this.taxi.phase === 'pickup' && this.taxi.ped) {
      return { x: this.taxi.ped.mesh.position.x, z: this.taxi.ped.mesh.position.z, text: 'Jemput penumpang taksi' };
    }
    if (this.taxi.phase === 'deliver' && this.taxi.dest) {
      return { x: this.taxi.dest.x, z: this.taxi.dest.z, text: 'Antar penumpang ke ' + this.taxi.dest.name };
    }
    if (this.race.phase === 'run') {
      const cp = this.RACE_POINTS[this.race.idx];
      if (cp) return { x: cp[0], z: cp[1], text: 'Balap! Titik ' + (this.race.idx + 1) + '/' + this.RACE_POINTS.length + ' — ' + this.race.t.toFixed(1) + ' dtk' };
    }
    const job = this.nextJobStart();
    if (job) return { x: job.start.x, z: job.start.z, text: 'Mulai: ' + job.title + ' — temui penanda di ' + job.start.name };
    return { x: PLACES.pantai.x, z: PLACES.pantai.z, text: 'Roam bebas — taksi, balap, dan kerang emas masih menanti' };
  },

  // ------------------------------------------------------------ update --
  update(dt) {
    const pl = People.player;
    const ppos = pl.vehicle ? pl.vehicle.mesh.position : pl.mesh.position;

    // Animate marker + shells.
    const target = this.objectiveTarget();
    if (target && G.mode === 'playing') {
      this.marker.visible = true;
      this.marker.position.set(target.x, 0, target.z);
      this.markerTop.position.y = 4.4 + Math.sin(performance.now() / 300) * 0.5;
      this.markerTop.rotation.y += dt * 2.4;
    } else this.marker.visible = false;
    this.shellMeshes.forEach((s, i) => {
      if (G.shells[i]) return;
      s.rotation.y += dt * 1.4;
      s.position.y = 0.5 + Math.sin(performance.now() / 350 + i) * 0.16;
      if (dist2d(ppos.x, ppos.z, s.position.x, s.position.z) < 2.8) {
        G.shells[i] = true; G.shellsFound++;
        s.visible = false;
        G.money += 25; G.stats.earned += 25;
        AudioSys.sfx('shell');
        HUD.toast('Kerang emas! ' + G.shellsFound + '/10 · +Rp25');
        if (G.shellsFound === 10) { G.money += 250; HUD.banner('SEMUA KERANG EMAS · BONUS Rp250'); }
        saveGame();
      }
    });

    this._garageUpdate(pl);
    if (this.active) this._jobUpdate(dt, pl, ppos);
    else { this._taxiUpdate(dt, pl, ppos); this._raceUpdate(dt, pl, ppos); }

    // Waiting at the next job's start marker begins its intro dialogue.
    if (!this.active && G.mode === 'playing') {
      const job = this.nextJobStart();
      if (job && dist2d(ppos.x, ppos.z, job.start.x, job.start.z) < 4.2) {
        const idx = G.jobIndex;
        Main.showDialogue(job.intro, () => this.startJob(idx));
      }
    }
  },

  _garageUpdate(pl) {
    const zone = World.garageZone;
    if (!zone || !pl.vehicle) { this.garageInside = false; return; }
    const p = pl.vehicle.mesh.position;
    const inside = p.x > zone.minX && p.x < zone.maxX && p.z > zone.minZ && p.z < zone.maxZ;
    if (inside && !this.garageInside && G.wanted > 0) {
      const fee = 40 + 60 * Math.ceil(G.wanted);
      if (G.money >= fee) {
        G.money -= fee;
        Police.reset();
        AudioSys.sfx('cash');
        HUD.banner('BENGKEL CAHAYA · Cat baru, plat baru — polisi kehilangan jejak (Rp' + fee + ')');
      } else {
        HUD.toast('Bengkel Cahaya butuh Rp' + fee + ' untuk menghilangkan jejakmu.');
      }
    }
    this.garageInside = inside;
  },

  _jobUpdate(dt, pl, ppos) {
    const a = this.active;
    const step = a.job.steps[a.stepIdx];
    if (!step) return;
    a.t += dt;
    const atTarget = (r) => dist2d(ppos.x, ppos.z, step.x, step.z) < r;

    switch (step.type) {
      case 'goto': {
        if (step.needCar && !pl.vehicle) { if (!a.warned) { a.warned = true; } break; }
        if (step.onFoot && pl.vehicle) break;
        if (atTarget(step.r)) this._stepDone();
        break;
      }
      case 'evade': case 'deliver': {
        if (atTarget(step.r)) this._stepDone();
        break;
      }
      case 'timed': {
        const left = step.seconds - a.t;
        HUD.setObjective(step.label + ' — ' + Math.ceil(left) + ' dtk');
        if (atTarget(step.r)) this._stepDone();
        else if (left <= 0) this.failStep('Terlambat! Kargo mendingin — ulangi pengantaran.');
        break;
      }
      case 'collect': {
        const pts = step.points[a.collectIdx];
        if (pts && dist2d(ppos.x, ppos.z, pts[0], pts[1]) < 3) {
          a.collectIdx++;
          AudioSys.sfx('cash');
          HUD.toast('Amplop ' + a.collectIdx + '/' + step.points.length + ' terkumpul');
          if (a.collectIdx >= step.points.length) this._stepDone();
        }
        break;
      }
      case 'follow': this._followUpdate(dt, ppos); break;
      case 'survive': {
        HUD.setObjective(step.label + ' — ' + Math.ceil(step.seconds - a.t) + ' dtk');
        if (!pl.vehicle || pl.vehicle.type !== 'truck') this.failStep('Kau meninggalkan truk umpan!');
        else if (a.t >= step.seconds) this._stepDone();
        break;
      }
      case 'hold': {
        if (atTarget(step.r)) {
          a.holdT += dt;
          HUD.setObjective(step.label + ' — ' + Math.ceil(step.seconds - a.holdT) + ' dtk');
          if (a.holdT >= step.seconds) this._stepDone();
        } else a.holdT = Math.max(0, a.holdT - dt * 2);
        break;
      }
      case 'pickup': {
        if (!pl.vehicle && atTarget(step.r)) {
          G.hasPistol = true;
          this.pistolProp.visible = false;
          AudioSys.sfx('pickup');
          HUD.banner('PISTOL DIDAPAT · Klik untuk menembak');
          this._stepDone();
        }
        break;
      }
      case 'boardTruck': {
        if (pl.vehicle && pl.vehicle.type === 'truck') this._stepDone();
        break;
      }
    }
    // Guards stay hot while Bima is inside Gudang 9's job.
    if (this.active && G.jobIndex === 5) People.guardsActive = true;
  },

  _followUpdate(dt, ppos) {
    const truck = this.followTruck;
    if (!truck) { this._startFollow(); return; }
    const tp = truck.mesh.position;
    const route = this.followRoute;
    const wp = route[this.followIdx];
    if (wp) {
      const dx = wp[0] - tp.x, dz = wp[1] - tp.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 6) this.followIdx++;
      else {
        const want = Math.atan2(dx, dz);
        truck.angle = angleLerp(truck.angle, want, clamp(dt * 2, 0, 1));
        truck.speed = lerp(truck.speed, 10.5, dt * 1.5);
        tp.x += Math.sin(truck.angle) * truck.speed * dt;
        tp.z += Math.cos(truck.angle) * truck.speed * dt;
        truck.mesh.rotation.y = truck.angle;
        Vehicles._spinWheels(truck, dt);
      }
    } else {
      truck.speed = lerp(truck.speed, 0, dt * 3);
      // Arrived at Pasar Senja Selatan.
      if (dist2d(ppos.x, ppos.z, tp.x, tp.z) < 30) { this._stepDone(); return; }
    }
    const d = dist2d(ppos.x, ppos.z, tp.x, tp.z);
    if (d > 88) {
      this.followLoseT += dt;
      HUD.setObjective('Truk hampir hilang! Kejar — ' + Math.ceil(4 - this.followLoseT) + ' dtk');
      if (this.followLoseT > 4) this.failStep('Kau kehilangan truknya. Ulangi dari pelabuhan.');
    } else this.followLoseT = Math.max(0, this.followLoseT - dt);
    if (d < 5.6) {
      this.followRams++;
      AudioSys.sfx('crash');
      if (this.followRams >= 3) this.failStep('Kau menabrak truknya tiga kali — penyamaranmu terbongkar.');
      else HUD.toast('Jangan tabrak truknya! (' + this.followRams + '/3)');
      truck.speed = 14;
    }
  },

  // --------------------------------------------------------- side jobs --
  RACE_POINTS: [[108, -54], [54, -162], [-54, -108], [-108, 54], [0, 162], [108, 108]],
  _taxiUpdate(dt, pl, ppos) {
    const t = this.taxi;
    t.timer -= dt;
    if (t.phase === 'idle' && t.timer <= 0 && G.mode === 'playing') {
      // A passenger waves from a sidewalk a few blocks away.
      const sx = clamp(ppos.x + randRange(-90, 90), -CITY_EDGE, CITY_EDGE);
      const sz = clamp(ppos.z + randRange(-90, 90), -CITY_EDGE, CITY_EDGE);
      const ped = People.spawnPed(World.snapStreet(sx) + 10, sz, { shirt: 0xffe9a0 });
      ped.state = 'stand';
      t.ped = ped; t.phase = 'pickup';
      HUD.toast('Penumpang taksi melambai — jemput dia!');
    }
    if (t.phase === 'pickup' && t.ped) {
      const pp = t.ped.mesh.position;
      t.ped.mesh.rotation.y += dt * 2; // waving spin to catch the eye
      if (pl.vehicle && Math.abs(pl.vehicle.speed) < 1.2 && dist2d(ppos.x, ppos.z, pp.x, pp.z) < 4.5) {
        World.group.remove(t.ped.mesh);
        const pi = People.peds.indexOf(t.ped);
        if (pi >= 0) People.peds.splice(pi, 1);
        t.ped = null;
        const dests = [PLACES.pasarSenja, PLACES.pantai, PLACES.tvTower, PLACES.safehouse, PLACES.clinic, PLACES.harbourOffice];
        t.dest = randPick(dests);
        t.phase = 'deliver';
        AudioSys.sfx('door');
        HUD.toast('Penumpang naik! Antar ke ' + t.dest.name + '.');
      } else if (!pl.vehicle && dist2d(ppos.x, ppos.z, pp.x, pp.z) < 3) {
        if (!t.warned) { t.warned = true; HUD.toast('Penumpang butuh mobil — bawa kendaraan ke sini.'); }
      }
    }
    if (t.phase === 'deliver' && t.dest) {
      if (pl.vehicle && Math.abs(pl.vehicle.speed) < 1.2 && dist2d(ppos.x, ppos.z, t.dest.x, t.dest.z) < 7) {
        const fare = 30 + Math.round(randRange(20, 90));
        G.money += fare; G.stats.earned += fare; G.taxiFares++;
        AudioSys.sfx('cash');
        HUD.banner('TARIF TAKSI · +Rp' + fare);
        t.phase = 'idle'; t.timer = randRange(14, 26); t.dest = null; t.warned = false;
        saveGame();
      }
    }
  },

  _raceUpdate(dt, pl, ppos) {
    const r = this.race;
    if (r.phase === 'idle') {
      const s = PLACES.raceStart;
      if (pl.vehicle && dist2d(ppos.x, ppos.z, s.x, s.z) < 6 && Math.abs(pl.vehicle.speed) < 1) {
        r.phase = 'run'; r.idx = 0; r.t = 0;
        AudioSys.sfx('job');
        HUD.banner('BALAP JALANAN DIMULAI · 6 titik, secepatnya!');
      }
      return;
    }
    if (r.phase === 'run') {
      r.t += dt;
      if (!pl.vehicle) {
        r.phase = 'idle';
        HUD.toast('Balap batal — kau keluar dari mobil.');
        AudioSys.sfx('fail');
        return;
      }
      const cp = this.RACE_POINTS[r.idx];
      if (cp && dist2d(ppos.x, ppos.z, cp[0], cp[1]) < 9) {
        r.idx++;
        AudioSys.sfx('pickup');
        if (r.idx >= this.RACE_POINTS.length) {
          const reward = r.t < 120 ? 300 : (r.t < 170 ? 200 : 120);
          G.money += reward; G.stats.earned += reward;
          if (!G.raceBest || r.t < G.raceBest) G.raceBest = r.t;
          HUD.banner('FINISH ' + r.t.toFixed(1) + ' dtk · +Rp' + reward + ' · Terbaik: ' + G.raceBest.toFixed(1) + ' dtk');
          AudioSys.sfx('cash');
          r.phase = 'idle';
          saveGame();
        } else HUD.toast('Titik ' + r.idx + '/' + this.RACE_POINTS.length);
      }
    }
  },
};
