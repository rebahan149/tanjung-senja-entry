'use strict';
/* TANJUNG SENJA — people: Bima (the player), pedestrians who stroll the
   sidewalks and flee trouble, warehouse guards, fists and the pistol. */

const People = {
  player: null,
  peds: [],
  punchCooldown: 0,
  shootCooldown: 0,
  muzzle: null, muzzleTimer: 0,
  guardsActive: false,

  // ------------------------------------------------------------ meshes --
  buildPerson(shirt, pants, skin) {
    const grp = new THREE.Group();
    const mat = c => new THREE.MeshLambertMaterial({ color: c });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.78, 0.2), mat(pants));
    legL.position.set(-0.11, 0.39, 0); grp.add(legL);
    const legR = legL.clone(); legR.position.x = 0.11; grp.add(legR);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.28), mat(shirt));
    torso.position.y = 1.1; torso.castShadow = true; grp.add(torso);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.15), mat(shirt));
    armL.position.set(-0.34, 1.12, 0); grp.add(armL);
    const armR = armL.clone(); armR.position.x = 0.34; grp.add(armR);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), mat(skin));
    head.position.y = 1.62; head.castShadow = true; grp.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), mat(0x1d1712));
    hair.position.y = 1.82; grp.add(hair);
    grp.userData.limbs = { legL, legR, armL, armR };
    return grp;
  },
  _swing(grp, phase, amp) {
    const l = grp.userData.limbs;
    if (!l) return;
    l.legL.rotation.x = Math.sin(phase) * amp;
    l.legR.rotation.x = -Math.sin(phase) * amp;
    l.armL.rotation.x = -Math.sin(phase) * amp * 0.8;
    l.armR.rotation.x = Math.sin(phase) * amp * 0.8;
  },

  initPlayer() {
    const mesh = this.buildPerson(0x2a7d8c, 0x37424e, 0xc78d64); // Bima: teal work shirt
    mesh.position.set(G.playerPos.x, 0.15, G.playerPos.z);
    World.group.add(mesh);
    // Pistol visual (hidden until picked up): small dark box in right hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x22242a }));
    gun.position.set(0.34, 0.95, 0.3);
    gun.visible = false;
    mesh.add(gun);
    this.player = {
      mesh, gun, angle: 2.4, speedMag: 0, vehicle: null,
      walkPhase: 0, radius: 0.55,
    };
    mesh.userData.playerRef = this.player;
    // Muzzle flash sprite.
    const flashMat = new THREE.SpriteMaterial({
      map: World._glowTexture(), color: 0xffe9a0, depthWrite: false, transparent: true, opacity: 0,
    });
    this.muzzle = new THREE.Sprite(flashMat);
    this.muzzle.scale.set(1.1, 1.1, 1);
    World.group.add(this.muzzle);
  },

  // -------------------------------------------------------------- peds --
  spawnPed(x, z, opts) {
    opts = opts || {};
    const shirts = [0xd96a3a, 0xe8c73a, 0x3aa06a, 0xc73a5a, 0x4a6ec7, 0xe8e2d4, 0x7a4ac7, 0x2a9d8f];
    const mesh = this.buildPerson(
      opts.shirt !== undefined ? opts.shirt : randPick(shirts),
      randPick([0x37424e, 0x5a4636, 0x2c3e50, 0x6e5638]),
      randPick([0xc78d64, 0xa06844, 0x8a5a34, 0xe0aa7e])
    );
    mesh.position.set(x, 0.15, z);
    World.group.add(mesh);
    const ped = {
      mesh, angle: randRange(0, Math.PI * 2), state: opts.state || 'walk',
      speed: randRange(1.1, 1.7), tx: x, tz: z, hp: 2,
      downTimer: 0, shootTimer: randRange(0.5, 1.4),
      patrol: opts.patrol || null, patrolIdx: 0, isGuard: !!opts.guard,
      fleeFrom: null, fleeTimer: 0,
    };
    mesh.userData.ped = ped;
    this._pickSidewalkTarget(ped);
    this.peds.push(ped);
    return ped;
  },
  _pickSidewalkTarget(ped) {
    // Walk the pavement grid: pick a point on a sidewalk near a random
    // intersection within a few blocks of where the ped already is.
    const p = ped.mesh.position;
    const bi = clamp(Math.round(p.x / PITCH) + randInt(-2, 2), -GRID, GRID);
    const bj = clamp(Math.round(p.z / PITCH) + randInt(-2, 2), -GRID, GRID);
    const off = (ROAD / 2 + 2.3) * (RNG() < 0.5 ? 1 : -1);
    if (RNG() < 0.5) { ped.tx = streetCoord(bi) + off; ped.tz = clamp(p.z + randRange(-50, 50), -CITY_EDGE, CITY_EDGE); }
    else { ped.tz = streetCoord(bj) + off; ped.tx = clamp(p.x + randRange(-50, 50), -CITY_EDGE, CITY_EDGE); }
  },
  spawnCrowd() {
    const hotspots = [
      [27, -27], [81, 27], [27, -81], [-140, -120], [-100, 40],
      [81, 81], [0, 0], [54, -108], [-60, 108], [108, 54], [-186, 20],
    ];
    for (const [hx, hz] of hotspots) {
      const n = randInt(2, 4);
      for (let i = 0; i < n; i++) {
        this.spawnPed(hx + randRange(-14, 14), hz + randRange(-14, 14));
      }
    }
  },
  spawnFleeingDriver(x, z) {
    const ped = this.spawnPed(x, z, { shirt: 0xe8e2d4 });
    ped.state = 'flee';
    ped.fleeFrom = { x: x + randRange(-4, 4), z: z + randRange(-4, 4) };
    ped.fleeTimer = 5;
    return ped;
  },

  hurt(dmg) {
    if (G.mode !== 'playing' && G.mode !== 'shot') return;
    G.health -= dmg;
    HUD.flashHurt();
    AudioSys.sfx('hurt');
    if (G.health <= 0) { G.health = 0; Main.wasted(); }
  },

  // ------------------------------------------------------------ combat --
  tryPunch() {
    if (this.punchCooldown > 0 || this.player.vehicle) return;
    this.punchCooldown = 0.38;
    AudioSys.sfx('punch');
    const p = this.player.mesh.position;
    const fx = Math.sin(this.player.angle), fz = Math.cos(this.player.angle);
    // Arm swing animation kick.
    const limbs = this.player.mesh.userData.limbs;
    if (limbs) limbs.armR.rotation.x = -1.9;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.mesh.position.x - p.x, dz = ped.mesh.position.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2.0 && (dx * fx + dz * fz) > 0.2) {
        this.knockDown(ped, 1);
        Police.crime(ped.isGuard ? 0.5 : 0.6, true);
        return;
      }
    }
    // Punching a car dents it and angers the law a little.
    const car = Vehicles.nearestCar(p, 2.6);
    if (car) { AudioSys.sfx('hit'); Police.crime(0.2, true); }
  },

  knockDown(ped, dmg) {
    ped.hp -= dmg;
    AudioSys.sfx('hit');
    if (ped.hp <= 0) {
      ped.state = 'down';
      ped.downTimer = 9;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.35;
    } else {
      ped.state = 'flee';
      ped.fleeFrom = { x: this.player.mesh.position.x, z: this.player.mesh.position.z };
      ped.fleeTimer = 3.5;
    }
  },

  tryShoot(camera) {
    if (this.shootCooldown > 0 || !G.hasPistol || this.player.vehicle) return;
    this.shootCooldown = 0.26;
    AudioSys.sfx('shot');
    Police.crime(0.5, true);
    Police.alarmAt(this.player.mesh.position.x, this.player.mesh.position.z, 26);
    const p = this.player.mesh.position;
    // Flash at the gun tip.
    const gx = p.x + Math.sin(this.player.angle) * 0.6;
    const gz = p.z + Math.cos(this.player.angle) * 0.6;
    this.muzzle.position.set(gx, 1.25, gz);
    this.muzzle.material.opacity = 0.95;
    this.muzzleTimer = 0.05;
    // Raycast from the camera through the crosshair.
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    ray.far = 70;
    const hits = ray.intersectObjects(World.group.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      let ped = null, car = null;
      while (obj) {
        if (obj.userData.ped) ped = obj.userData.ped;
        if (obj.userData.carRef) car = obj.userData.carRef;
        obj = obj.parent;
      }
      if (ped && ped.state !== 'down') {
        this.knockDown(ped, 1);
        if (ped.isGuard) Police.crime(0.4, true);
        return;
      }
      if (car) {
        AudioSys.sfx('hit');
        if (car.role === 'traffic') { car.role = 'fleeing'; }
        return;
      }
      if (hit.distance > 3) return; // hit scenery
    }
  },

  // ------------------------------------------------------------- update --
  update(dt, input, camera) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.muzzle.material.opacity = 0;
    }
    const pl = this.player;
    pl.gun.visible = G.hasPistol && !pl.vehicle;

    if (!pl.vehicle && (G.mode === 'playing' || G.mode === 'shot')) {
      // On-foot movement, relative to the camera yaw.
      const yaw = Main.camYaw;
      let mx = 0, mz = 0;
      if (input.up) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
      if (input.down) { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
      if (input.left) { mx += Math.cos(yaw); mz -= Math.sin(yaw); }
      if (input.right) { mx -= Math.cos(yaw); mz += Math.sin(yaw); }
      const len = Math.sqrt(mx * mx + mz * mz);
      const sprint = input.sprint ? 1.55 : 1;
      if (len > 0.01) {
        mx /= len; mz /= len;
        const spd = 5.1 * sprint;
        pl.mesh.position.x += mx * spd * dt;
        pl.mesh.position.z += mz * spd * dt;
        pl.angle = angleLerp(pl.angle, Math.atan2(mx, mz), clamp(dt * 12, 0, 1));
        pl.speedMag = spd;
        pl.walkPhase += dt * (input.sprint ? 13 : 9.5);
      } else {
        pl.speedMag = 0;
        pl.walkPhase = lerp(pl.walkPhase, Math.round(pl.walkPhase / Math.PI) * Math.PI, dt * 8);
      }
      pl.mesh.rotation.y = pl.angle;
      World.collide(pl.mesh.position, pl.radius);
      pl.mesh.position.y = 0.15;
      this._swing(pl.mesh, pl.walkPhase, pl.speedMag > 0.1 ? 0.55 : 0);
      if (this.punchCooldown > 0.3) {
        const limbs = pl.mesh.userData.limbs;
        if (limbs) limbs.armR.rotation.x = -1.9;
      }
    }

    // Pedestrians.
    const playerCar = pl.vehicle;
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i];
      const pp = ped.mesh.position;
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          World.group.remove(ped.mesh);
          this.peds.splice(i, 1);
        }
        continue;
      }
      // Run over by the player's car?
      if (playerCar && Math.abs(playerCar.speed) > 4) {        const cp = playerCar.mesh.position;
        if (dist2d(pp.x, pp.z, cp.x, cp.z) < 1.9) {
          this.knockDown(ped, 5);
          Police.crime(1, true);
          playerCar.speed *= 0.55;
          continue;
        }
      }
      if (ped.state === 'stand') continue; // e.g. a taxi passenger waving
      let tx = ped.tx, tz = ped.tz, spd = ped.speed;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const dx = pp.x - (ped.fleeFrom ? ped.fleeFrom.x : pp.x);
        const dz = pp.z - (ped.fleeFrom ? ped.fleeFrom.z : pp.z);
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        tx = pp.x + (dx / d) * 12; tz = pp.z + (dz / d) * 12;
        spd = 4.6;
        if (ped.fleeTimer <= 0) { ped.state = ped.isGuard ? 'guard' : 'walk'; this._pickSidewalkTarget(ped); }
      } else if (ped.isGuard && this.guardsActive) {
        ped.state = 'guard';
      }
      if (ped.state === 'guard' && ped.patrol) {
        const target = ped.patrol[ped.patrolIdx % ped.patrol.length];
        tx = target[0]; tz = target[1]; spd = 1.9;
        if (dist2d(pp.x, pp.z, tx, tz) < 1.2) ped.patrolIdx++;
        // Guard engages the player inside the warehouse grounds.
        const plp = pl.mesh.position;
        const dp = dist2d(pp.x, pp.z, plp.x, plp.z);
        if (!pl.vehicle && dp < 17 && G.mode === 'playing') {
          ped.angle = angleLerp(ped.angle, Math.atan2(plp.x - pp.x, plp.z - pp.z), dt * 6);
          ped.mesh.rotation.y = ped.angle;
          ped.shootTimer -= dt;
          if (ped.shootTimer <= 0 && dp > 2) {
            ped.shootTimer = randRange(1.0, 1.6);
            AudioSys.sfx('shot');
            if (RNG() < 0.55) this.hurt(randRange(4, 9));
          }
          continue;
        }
      }
      const dx = tx - pp.x, dz = tz - pp.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.8) {
        if (ped.state === 'walk') this._pickSidewalkTarget(ped);
      } else {
        ped.angle = angleLerp(ped.angle, Math.atan2(dx, dz), clamp(dt * 8, 0, 1));
        pp.x += Math.sin(ped.angle) * spd * dt;
        pp.z += Math.cos(ped.angle) * spd * dt;
        World.collide(pp, 0.45);
        ped.mesh.rotation.y = ped.angle;
        ped.mesh.position.y = 0.15;
        this._swing(ped.mesh, (ped.walkPhase = (ped.walkPhase || 0) + dt * (spd > 3 ? 13 : 8)), 0.5);
      }
    }
  },
};
