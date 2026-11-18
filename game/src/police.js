'use strict';
/* TANJUNG SENJA — the law: wanted stars, pursuing police cars, roadblocks
   at three stars, a spotlight helicopter at four, and the busted meter. */

const Police = {
  units: [],          // {car, stuckTimer}
  heli: null, heliAngle: 0,
  roadblockCars: [], roadblockTimer: 0,
  spawnTimer: 0,
  lightFlash: 0,

  crime(amount, seen) {
    if (G.mode !== 'playing') return;
    if (seen) {
      G.wanted = clamp(G.wanted + amount, 0, 5);
      G.unseenTimer = 0;
    }
  },
  alarmAt(x, z, r) {
    for (const ped of People.peds) {
      if (ped.state === 'walk' && dist2d(x, z, ped.mesh.position.x, ped.mesh.position.z) < r) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.fleeTimer = randRange(2.5, 4.5);
      }
    }
  },
  setWanted(n) { G.wanted = clamp(n, 0, 5); },

  _policeMesh() {
    const mesh = Vehicles.buildMesh('sedan', 0xf2f2f5);
    // Black bonnet stripe + lightbar with red/blue beacons.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.2, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x22242e }));
    stripe.position.y = 0.42; mesh.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a20 }));
    red.position.x = -0.3; bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.x = 0.3; bar.add(blue);
    bar.position.set(0, 1.52, -0.2);
    mesh.add(bar);
    mesh.userData.lightbar = { red, blue };
    return mesh;
  },

  _spawnUnit() {
    const pp = People.player.mesh.position;
    // Spawn on a street 70–115 m away, out of immediate view.
    for (let tries = 0; tries < 8; tries++) {
      const a = randRange(0, Math.PI * 2), d = randRange(70, 115);
      let x = clamp(pp.x + Math.sin(a) * d, -CITY_EDGE, CITY_EDGE);
      let z = clamp(pp.z + Math.cos(a) * d, -CITY_EDGE, CITY_EDGE);
      x = World.snapStreet(x) + (RNG() < 0.5 ? Vehicles.LANE : -Vehicles.LANE);
      z = clamp(z, -CITY_EDGE, CITY_EDGE);
      const mesh = this._policeMesh();
      mesh.position.set(x, 0, z);
      World.group.add(mesh);
      const car = {
        mesh, type: 'sedan', color: 0xf2f2f5, angle: randRange(0, 6.28), speed: 0,
        role: 'police', cruise: 12, wheelSpin: 0, stuckTimer: 0, reverseTimer: 0,
      };
      mesh.userData.carRef = car;
      Vehicles.all.push(car);
      this.units.push({ car });
      return;
    }
  },

  _removeUnit(unit) {
    Vehicles.removeCar(unit.car);
    const i = this.units.indexOf(unit);
    if (i >= 0) this.units.splice(i, 1);
  },

  _buildHeli() {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2c3440 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 4.6), bodyMat);
    body.castShadow = true; grp.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4.4), bodyMat);
    tail.position.set(0, 0.3, -4.2); grp.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.7), bodyMat);
    fin.position.set(0, 0.8, -6.3); grp.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    rotor.position.y = 1.25; grp.add(rotor);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), bodyMat);
    skidL.position.set(-1, -1.2, 0); grp.add(skidL);
    const skidR = skidL.clone(); skidR.position.x = 1; grp.add(skidR);
    grp.userData.rotor = rotor;
    // Spotlight: a real spotlight plus a visible translucent cone.
    const spot = new THREE.SpotLight(0xfff2cc, 2.4, 90, 0.32, 0.5, 0.6);
    grp.add(spot); grp.add(spot.target);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7.5, 30, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffeeb8, transparent: true, opacity: 0.13,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    cone.position.y = -15;
    grp.add(cone);
    grp.userData.spot = spot;
    grp.userData.cone = cone;
    return grp;
  },

  _updateHeli(dt) {
    const wantHeli = G.wanted >= 4 && G.mode === 'playing';
    if (wantHeli && !this.heli) {
      this.heli = this._buildHeli();
      const pp = People.player.mesh.position;
      this.heli.position.set(pp.x + 30, 30, pp.z + 30);
      World.group.add(this.heli);
    }
    if (!wantHeli && this.heli) {
      World.group.remove(this.heli);
      this.heli = null;
    }
    if (!this.heli) return;
    const pp = People.player.vehicle ? People.player.vehicle.mesh.position : People.player.mesh.position;
    this.heliAngle += dt * 0.35;
    const hx = pp.x + Math.sin(this.heliAngle) * 13;
    const hz = pp.z + Math.cos(this.heliAngle) * 13;
    this.heli.position.x = lerp(this.heli.position.x, hx, clamp(dt * 1.6, 0, 1));
    this.heli.position.z = lerp(this.heli.position.z, hz, clamp(dt * 1.6, 0, 1));
    this.heli.position.y = 29 + Math.sin(this.heliAngle * 2) * 1.2;
    this.heli.rotation.y = Math.atan2(pp.x - this.heli.position.x, pp.z - this.heli.position.z);
    this.heli.userData.rotor.rotation.y += dt * 28;
    const spot = this.heli.userData.spot;
    spot.target.position.set(pp.x - this.heli.position.x, -29, pp.z - this.heli.position.z);
    spot.target.updateMatrixWorld();
  },

  _roadblockUpdate(dt) {
    this.roadblockTimer -= dt;
    const pl = People.player;
    if (G.wanted >= 3 && pl.vehicle && this.roadblockTimer <= 0 && G.mode === 'playing') {
      this.roadblockTimer = 26;
      // Clear the old block, then wall off the next intersection ahead.
      for (const c of this.roadblockCars) Vehicles.removeCar(c);
      this.roadblockCars = [];
      const cp = pl.vehicle.mesh.position;
      const fx = Math.sin(pl.vehicle.angle), fz = Math.cos(pl.vehicle.angle);
      const aheadX = cp.x + fx * 55, aheadZ = cp.z + fz * 55;
      const vertical = Math.abs(fx) < Math.abs(fz); // travelling along z?
      const bx = vertical ? World.snapStreet(aheadX) : clamp(aheadX, -CITY_EDGE, CITY_EDGE);
      const bz = vertical ? clamp(aheadZ, -CITY_EDGE, CITY_EDGE) : World.snapStreet(aheadZ);
      for (const off of [-3.6, 0.5]) {
        const mesh = this._policeMesh();
        const x = vertical ? bx + off : bx;
        const z = vertical ? bz : bz + off;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = vertical ? Math.PI / 2.4 : Math.PI / 5;
        World.group.add(mesh);
        const car = {
          mesh, type: 'sedan', color: 0xf2f2f5, angle: mesh.rotation.y, speed: 0,
          role: 'police', cruise: 0, wheelSpin: 0, stuckTimer: 0, reverseTimer: 0,
        };
        mesh.userData.carRef = car;
        Vehicles.all.push(car);
        this.roadblockCars.push(car);
      }
      HUD.toast('Blokade polisi di depan!');
    }
    if (G.wanted < 3 && this.roadblockCars.length) {
      for (const c of this.roadblockCars) Vehicles.removeCar(c);
      this.roadblockCars = [];
    }
  },

  reset() {
    for (let i = this.units.length - 1; i >= 0; i--) this._removeUnit(this.units[i]);
    for (const c of this.roadblockCars) Vehicles.removeCar(c);
    this.roadblockCars = [];
    if (this.heli) { World.group.remove(this.heli); this.heli = null; }
    G.wanted = 0; G.bustedMeter = 0; G.unseenTimer = 0;
    AudioSys.setSiren(false);
  },

  update(dt) {
    const pl = People.player;
    const targetPos = pl.vehicle ? pl.vehicle.mesh.position : pl.mesh.position;
    const stars = Math.floor(G.wanted + 0.0001);
    const desired = [0, 2, 3, 4, 5, 6][clamp(stars, 0, 5)];

    this.spawnTimer -= dt;
    if (G.mode === 'playing' && this.units.length < desired && this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      this._spawnUnit();
    }
    // Despawn far-away units when the heat dies down.
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const d = dist2d(u.car.mesh.position.x, u.car.mesh.position.z, targetPos.x, targetPos.z);
      if ((this.units.length > desired && d > 60) || d > 210) this._removeUnit(u);
    }

    this.lightFlash += dt * 9;
    const flashOn = Math.sin(this.lightFlash) > 0;
    let nearest = 1e9;

    for (const unit of this.units) {
      const car = unit.car;
      const pos = car.mesh.position;
      const dx = targetPos.x - pos.x, dz = targetPos.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      nearest = Math.min(nearest, d);
      const lb = car.mesh.userData.lightbar;
      if (lb) {
        lb.red.material.color.setHex(flashOn ? 0xff2a20 : 0x701410);
        lb.blue.material.color.setHex(flashOn ? 0x2255ff : 0x101f60);
      }
      if (G.mode !== 'playing') { car.speed = lerp(car.speed, 0, dt * 4); continue; }
      // Pursuit steering: aim at the player, lead a touch when they drive.
      let aimX = targetPos.x, aimZ = targetPos.z;
      if (pl.vehicle) {
        aimX += Math.sin(pl.vehicle.angle) * pl.vehicle.speed * 0.45;
        aimZ += Math.cos(pl.vehicle.angle) * pl.vehicle.speed * 0.45;
      }
      const wantAngle = Math.atan2(aimX - pos.x, aimZ - pos.z);
      if (car.reverseTimer > 0) {
        car.reverseTimer -= dt;
        car.speed = lerp(car.speed, -8, dt * 4);
      } else {
        car.angle = angleLerp(car.angle, wantAngle, clamp(dt * 2.4, 0, 1));
        const maxSp = 35.5;
        const want = d > 7 ? maxSp : maxSp * 0.55;
        car.speed = lerp(car.speed, want, clamp(dt * 1.1, 0, 1));
      }
      pos.x += Math.sin(car.angle) * car.speed * dt;
      pos.z += Math.cos(car.angle) * car.speed * dt;
      const probe = { x: pos.x, z: pos.z };
      if (World.collide(probe, 1.7)) {
        pos.x = probe.x; pos.z = probe.z;
        car.stuckTimer += dt;
        if (car.stuckTimer > 0.55) { car.reverseTimer = 0.8; car.stuckTimer = 0; }
      } else car.stuckTimer = Math.max(0, car.stuckTimer - dt);
      car.mesh.rotation.y = car.angle;
      Vehicles._spinWheels(car, dt);
      // Ramming the player's car hurts a little and slows both.
      if (pl.vehicle && d < 3.4 && Math.abs(car.speed) > 8) {
        pl.vehicle.speed *= 0.82;
        car.speed *= 0.6;
        People.hurt(2.5);
        AudioSys.sfx('crash');
      }
    }

    this._updateHeli(dt);
    this._roadblockUpdate(dt);
    AudioSys.setSiren(nearest < 48 && G.mode === 'playing');

    // Wanted decay while out of sight.
    if (G.mode === 'playing' && G.wanted > 0 && nearest > 55 && !this.heli) {
      G.unseenTimer += dt;
      if (G.unseenTimer > 6) {
        G.unseenTimer = 0;
        const floor = Missions.forcedWanted();
        G.wanted = Math.max(floor, G.wanted - 0.34);
        if (G.wanted <= floor) HUD.toast('Polisi kehilangan jejakmu.');
      }
    } else if (nearest <= 55) G.unseenTimer = 0;

    // Busted meter.
    if (G.mode === 'playing' && G.wanted >= 1) {
      let fill = 0;
      if (!pl.vehicle && nearest < 7.5) fill = 0.6;
      else if (pl.vehicle && nearest < 9 && Math.abs(pl.vehicle.speed) < 2.5) fill = 0.38;
      G.bustedMeter = clamp(G.bustedMeter + (fill > 0 ? fill * dt : -dt * 0.5), 0, 1);
      if (G.bustedMeter >= 1) Main.busted();
    } else {
      G.bustedMeter = Math.max(0, G.bustedMeter - dt * 0.5);
    }
  },
};
