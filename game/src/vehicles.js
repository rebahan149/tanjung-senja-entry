'use strict';
/* TANJUNG SENJA — vehicles: five box-built models, grid traffic AI with
   lane following, arcade driving for the player, and simple collisions. */

const Vehicles = {
  all: [],
  LANE: 3.4,
  TYPES: {
    hatchback: { len: 3.9, wid: 1.8, maxSpeed: 30, accel: 13, name: 'Hatchback' },
    sedan:     { len: 4.5, wid: 1.85, maxSpeed: 34, accel: 14, name: 'Sedan' },
    taksi:     { len: 4.5, wid: 1.85, maxSpeed: 32, accel: 13, name: 'Taksi Senja' },
    pickup:    { len: 4.7, wid: 1.95, maxSpeed: 29, accel: 12, name: 'Pickup' },
    truck:     { len: 6.6, wid: 2.3, maxSpeed: 23, accel: 8, name: 'Truk Gudang' },
  },
  COLORS: [0xc73a3a, 0x3a6ac7, 0xe8e2d4, 0x3aa06a, 0xe8a33a, 0x7a4ac7, 0x9aa0a8, 0x37424e, 0xd96ab0, 0x68b7c7],

  buildMesh(type, color) {
    const spec = this.TYPES[type];
    const grp = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1d2733 });
    const tyre = new THREE.MeshLambertMaterial({ color: 0x17181c });
    const L = spec.len, W = spec.wid;

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m;
    };

    if (type === 'truck') {
      add(new THREE.BoxGeometry(W, 1.5, 1.9), paint, 0, 1.15, L / 2 - 1.0);            // cab
      add(new THREE.BoxGeometry(W - 0.3, 0.8, 0.2), glass, 0, 1.5, L / 2 - 0.15);      // windshield
      add(new THREE.BoxGeometry(W + 0.15, 2.3, L - 2.2), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }), 0, 1.75, -0.9); // cargo
    } else if (type === 'pickup') {
      add(new THREE.BoxGeometry(W, 0.75, L), paint, 0, 0.62, 0);                       // body
      add(new THREE.BoxGeometry(W - 0.25, 0.75, 1.7), paint, 0, 1.3, 0.9);             // cab
      add(new THREE.BoxGeometry(W - 0.45, 0.55, 1.4), glass, 0, 1.36, 0.92);           // glass
      add(new THREE.BoxGeometry(W - 0.2, 0.4, 1.9), new THREE.MeshLambertMaterial({ color: 0x2c2c31 }), 0, 0.95, -1.25); // bed
    } else {
      add(new THREE.BoxGeometry(W, 0.62, L), paint, 0, 0.58, 0);                       // body
      add(new THREE.BoxGeometry(W - 0.3, 0.55, L * 0.48), paint, 0, 1.12, -0.2);       // cabin
      add(new THREE.BoxGeometry(W - 0.44, 0.42, L * 0.4), glass, 0, 1.14, -0.2);       // glass band
      if (type === 'taksi') {
        add(new THREE.BoxGeometry(0.85, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 0, 1.55, -0.2); // sign
      }
    }
    // Lights: warm headlights forward (+z), red tails behind.
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    const tl = new THREE.MeshBasicMaterial({ color: 0xff3a30 });
    add(new THREE.BoxGeometry(0.34, 0.16, 0.06), hl, -W / 2 + 0.3, 0.62, L / 2 + 0.01);
    add(new THREE.BoxGeometry(0.34, 0.16, 0.06), hl, W / 2 - 0.3, 0.62, L / 2 + 0.01);
    add(new THREE.BoxGeometry(0.34, 0.14, 0.06), tl, -W / 2 + 0.3, 0.66, -L / 2 - 0.01);
    add(new THREE.BoxGeometry(0.34, 0.14, 0.06), tl, W / 2 - 0.3, 0.66, -L / 2 - 0.01);

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    const wheels = [];
    const wz = type === 'truck' ? [L / 2 - 1.1, -L / 2 + 1.2] : [L / 2 - 0.85, -L / 2 + 0.85];
    for (const zz of wz) {
      for (const xx of [-W / 2, W / 2]) {
        const w = new THREE.Mesh(wheelGeo, tyre);
        w.rotation.z = Math.PI / 2;
        w.position.set(xx, 0.36, zz);
        grp.add(w); wheels.push(w);
      }
    }
    grp.userData.wheels = wheels;
    return grp;
  },

  spawn(type, x, z, angle, opts) {
    opts = opts || {};
    const color = opts.color !== undefined ? opts.color : (type === 'taksi' ? 0xf5c542 : randPick(this.COLORS));
    const mesh = this.buildMesh(type, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    World.group.add(mesh);
    const car = {
      mesh, type, color, angle, speed: 0,
      role: opts.role || 'parked',     // parked | traffic | player | police | mission
      cruise: randRange(9, 13),
      axis: opts.axis || 'z', dir: opts.dir || 1, street: opts.street || 0,
      lastCross: 9999, wheelSpin: 0, honkTimer: randRange(4, 14),
      blockerTimer: 0,
    };
    if (car.role === 'traffic') this._placeOnLane(car);
    mesh.userData.carRef = car;
    this.all.push(car);
    return car;
  },

  _placeOnLane(car) {
    // Put a traffic car exactly in its lane on its street.
    const sc = streetCoord(car.street);
    if (car.axis === 'z') {
      car.mesh.position.x = sc + car.dir * this.LANE;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.mesh.position.z = sc + car.dir * this.LANE;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.mesh.rotation.y = car.angle;
  },

  initTraffic() {
    const types = ['hatchback', 'sedan', 'sedan', 'taksi', 'pickup', 'hatchback'];
    for (let i = 0; i < 15; i++) {
      const axis = RNG() < 0.5 ? 'z' : 'x';
      const street = randInt(-GRID, GRID);
      const along = randRange(-CITY_EDGE + 12, CITY_EDGE - 12);
      const type = types[i % types.length];
      const car = this.spawn(type, 0, 0, 0, { role: 'traffic', axis, dir: RNG() < 0.5 ? 1 : -1, street });
      if (axis === 'z') car.mesh.position.z = along; else car.mesh.position.x = along;
      this._placeOnLane(car);
      if (axis === 'z') car.mesh.position.z = along; else car.mesh.position.x = along;
      car.speed = car.cruise * 0.7;
    }
    // Parked cars: harbour rows, market edge, beach lot, housing driveways.
    const parkSpots = [
      ['sedan', -160, -100, 1.5], ['pickup', -160, -88, 1.5], ['hatchback', -160, -150, 1.5],
      ['taksi', 40, -8, 0], ['sedan', 66, -8, 0], ['hatchback', -186, 60, 1.57],
      ['sedan', -186, 76, 1.57], ['pickup', -186, 92, 1.57], ['truck', -160, -40, 1.5],
      ['hatchback', 96, 108, 3.1], ['sedan', 122, 108, 3.1], ['taksi', 14, 168, 0],
      ['pickup', -40, 40, 0.2], ['sedan', 130, -100, 3.14], ['hatchback', -100, 20, 1.7],
    ];
    for (const [t, x, z, a] of parkSpots) this.spawn(t, x, z, a, { role: 'parked' });
    // The player's first ride: a faded teal hatchback by the harbour office.
    this.starterCar = this.spawn('hatchback', -146, -128, 2.6, { role: 'parked', color: 0x3f8a8a });
  },

  nearestCar(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const car of this.all) {
      if (car.role === 'police') continue;
      const d = dist2d(pos.x, pos.z, car.mesh.position.x, car.mesh.position.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  },

  removeCar(car) {
    const i = this.all.indexOf(car);
    if (i >= 0) this.all.splice(i, 1);
    World.group.remove(car.mesh);
  },

  // ------------------------------------------------------------- traffic --
  _trafficUpdate(car, dt) {
    const pos = car.mesh.position;
    // Obstacle scan straight ahead.
    const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
    let blocked = false;
    const ahead = (ox, oz) => {
      const dx = ox - pos.x, dz = oz - pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      return along > 1 && along < 10 && side < 2.1;
    };
    for (const other of this.all) {
      if (other === car) continue;
      if (ahead(other.mesh.position.x, other.mesh.position.z)) { blocked = true; break; }
    }
    if (!blocked && People.player.vehicle === null) {
      const pp = People.player.mesh.position;
      if (ahead(pp.x, pp.z)) blocked = true;
    }
    if (!blocked && People.player.vehicle) {
      const pp = People.player.vehicle.mesh.position;
      if (ahead(pp.x, pp.z)) blocked = true;
    }
    const target = blocked ? 0 : car.cruise;
    car.speed = lerp(car.speed, target, clamp(dt * (blocked ? 5 : 1.2), 0, 1));
    if (blocked && car.speed < 0.4) {
      car.honkTimer -= dt;
      if (car.honkTimer < 0) { AudioSys.sfx('horn'); car.honkTimer = randRange(5, 15); }
    }
    const alongBefore = car.axis === 'z' ? pos.z : pos.x;
    pos.x += fx * car.speed * dt;
    pos.z += fz * car.speed * dt;
    const alongAfter = car.axis === 'z' ? pos.z : pos.x;

    // Intersection logic: crossing a street centre may trigger a turn.
    const k = Math.round(alongAfter / PITCH);
    const centre = streetCoord(k);
    if (Math.abs(alongAfter - centre) < 1.2 && Math.abs(alongBefore - centre) >= 1.2 || (alongBefore < centre && alongAfter >= centre) || (alongBefore > centre && alongAfter <= centre)) {
      if (car.lastCross !== k * 10 + (car.axis === 'z' ? 0 : 1)) {
        car.lastCross = k * 10 + (car.axis === 'z' ? 0 : 1);
        const atEdge = Math.abs(centre) >= CITY_EDGE - 20;
        const r = RNG();
        if (atEdge || r < 0.34) {
          // Turn onto the crossing street (or U-turn at the city edge).
          if (atEdge && r < 0.3) {
            car.dir = -car.dir;
          } else {
            const newDir = RNG() < 0.5 ? 1 : -1;
            car.street = k;
            car.axis = car.axis === 'z' ? 'x' : 'z';
            car.dir = newDir;
          }
          this._snapToLane(car);
        }
      }
    }
    if (Math.abs(pos.x) > CITY_EDGE + 26 || Math.abs(pos.z) > CITY_EDGE + 26) {
      car.dir = -car.dir;
      this._snapToLane(car);
    }
    // Heading eases toward the lane direction.
    const targetAngle = car.axis === 'z'
      ? (car.dir > 0 ? 0 : Math.PI)
      : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.angle = angleLerp(car.angle, targetAngle, clamp(dt * 3.2, 0, 1));
    car.mesh.rotation.y = car.angle;
    // Keep the car centred in its lane while going straight.
    if (Math.abs(car.angle - targetAngle) < 0.05) this._snapToLane(car, true);
    this._spinWheels(car, dt);
  },

  _snapToLane(car, soft) {
    const sc = streetCoord(car.street);
    const pos = car.mesh.position;
    if (car.axis === 'z') {
      const want = sc + car.dir * this.LANE;
      pos.x = soft ? lerp(pos.x, want, 0.2) : want;
    } else {
      const want = sc + car.dir * this.LANE;
      pos.z = soft ? lerp(pos.z, want, 0.2) : want;
    }
  },

  _spinWheels(car, dt) {
    car.wheelSpin += (car.speed * dt) / 0.36;
    const wheels = car.mesh.userData.wheels || [];
    for (const w of wheels) w.rotation.x = car.wheelSpin;
  },

  // -------------------------------------------------------------- player --
  driveUpdate(car, input, dt) {
    const spec = this.TYPES[car.type];
    const pos = car.mesh.position;
    if (input.up) car.speed += spec.accel * dt;
    else if (input.down) car.speed -= (car.speed > 0.5 ? 22 : spec.accel * 0.7) * dt;
    else car.speed -= car.speed * 0.55 * dt; // engine braking / drag
    // Rolling resistance on sand.
    const onSand = pos.x < BEACH_X1 && pos.x > BEACH_X0 - 10;
    const maxF = spec.maxSpeed * (onSand ? 0.55 : 1);
    car.speed = clamp(car.speed, -9, maxF);
    if (!input.up && !input.down && Math.abs(car.speed) < 0.25) car.speed = 0;

    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    if (car.speed !== 0) {
      const grip = clamp(Math.abs(car.speed) / 9, 0.25, 1);
      car.angle += steer * 1.55 * grip * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / spec.maxSpeed + 0.35, 0, 1);
    }
    const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
    pos.x += fx * car.speed * dt;
    pos.z += fz * car.speed * dt;
    car.mesh.rotation.y = car.angle;

    // Building collision: bounce back a little and kill speed.
    const probe = { x: pos.x, z: pos.z };
    if (World.collide(probe, 1.7)) {
      const impact = Math.abs(car.speed);
      pos.x = probe.x; pos.z = probe.z;
      if (impact > 7) {
        AudioSys.sfx('crash');
        Police.crime(0.25, true);
        People.hurt(impact * 0.35);
      }
      car.speed = -car.speed * 0.22;
    }
    // Car-to-car: shove and slow.
    for (const other of this.all) {
      if (other === car) continue;
      const d = dist2d(pos.x, pos.z, other.mesh.position.x, other.mesh.position.z);
      const minD = (this.TYPES[car.type].len + this.TYPES[other.type].len) / 2 * 0.72;
      if (d < minD && d > 0.01) {
        const dx = (pos.x - other.mesh.position.x) / d, dz = (pos.z - other.mesh.position.z) / d;
        const push = (minD - d) / 2;
        pos.x += dx * push; pos.z += dz * push;
        if (other.role !== 'police') {
          other.mesh.position.x -= dx * push * 0.7;
          other.mesh.position.z -= dz * push * 0.7;
        }
        const impact = Math.abs(car.speed);
        if (impact > 6) {
          AudioSys.sfx('crash');
          Police.crime(0.4, true);
          if (other.role === 'traffic') { other.role = 'fleeing'; other.speed = 0; }
        }
        car.speed *= 0.45;
      }
    }
    this._spinWheels(car, dt);
    AudioSys.setEngine(car.speed / spec.maxSpeed, true);
    return Math.abs(car.speed);
  },

  update(dt) {
    for (const car of this.all) {
      if (car.role === 'traffic') this._trafficUpdate(car, dt);
      else if (car.role === 'fleeing') {
        // A car whose driver bailed, or a spooked driver: rolls to a stop.
        car.speed = lerp(car.speed, 0, dt * 3);
        car.mesh.position.x += Math.sin(car.angle) * car.speed * dt;
        car.mesh.position.z += Math.cos(car.angle) * car.speed * dt;
        this._spinWheels(car, dt);
        if (Math.abs(car.speed) < 0.2) car.role = 'parked';
      }
    }
  },
};
