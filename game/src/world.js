'use strict';
/* TANJUNG SENJA — world building: sky, sea, beach, road grid, districts,
   buildings with canvas-lit windows, harbour cranes, market stalls, palms,
   lamps, the lighthouse and Gudang 9. Also owns the collision list. */

const World = {
  colliders: [],       // {minX,maxX,minZ,maxZ}
  group: null,
  water: null, waterMat: null,
  sunSprite: null,
  lampSprites: [],
  beacon: null,
  time: 0,

  addCollider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  },

  // Push a circle (pos {x,z}, radius r) out of every building AABB.
  collide(pos, r) {
    let hit = false;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const nx = clamp(pos.x, c.minX, c.maxX);
      const nz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the smallest penetration
          const pl = pos.x - c.minX, pr = c.maxX - pos.x;
          const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) pos.x = c.minX - r;
          else if (m === pr) pos.x = c.maxX + r;
          else if (m === pt) pos.z = c.minZ - r;
          else pos.z = c.maxZ + r;
        }
      }
    }
    pos.x = clamp(pos.x, -250, CITY_EDGE + 4);
    pos.z = clamp(pos.z, -CITY_EDGE - 4, 214);
    return hit;
  },

  isOnRoad(x, z) {
    const fx = ((x % PITCH) + PITCH) % PITCH;
    const fz = ((z % PITCH) + PITCH) % PITCH;
    const onV = fx < ROAD / 2 + 0.5 || fx > PITCH - ROAD / 2 - 0.5;
    const onH = fz < ROAD / 2 + 0.5 || fz > PITCH - ROAD / 2 - 0.5;
    return onV || onH;
  },
  // Snap a value to the centre of the nearest street.
  snapStreet(v) { return Math.round(v / PITCH) * PITCH; },

  // ------------------------------------------------------------ textures --
  _windowTexture(base, litRatio, floors, cols) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    const ww = 128 / cols, wh = 256 / floors;
    for (let y = 0; y < floors; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = RNG() < litRatio;
        g.fillStyle = lit ? (RNG() < 0.75 ? '#ffd98a' : '#fff3c4') : '#232733';
        g.fillRect(x * ww + ww * 0.22, y * wh + wh * 0.24, ww * 0.56, wh * 0.5);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 2;
    return tex;
  },
  _roadTexture(horizontal) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#2c2c31'; g.fillRect(0, 0, 128, 128);
    // speckle
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 90; i++) g.fillRect(RNG() * 128, RNG() * 128, 2, 2);
    g.fillStyle = '#e8e4da';
    if (horizontal) { g.fillRect(0, 5, 128, 3); g.fillRect(0, 120, 128, 3); }
    else { g.fillRect(5, 0, 3, 128); g.fillRect(120, 0, 3, 128); }
    g.fillStyle = '#f5c542';
    if (horizontal) g.fillRect(16, 62, 42, 4); else g.fillRect(62, 16, 4, 42);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },
  _glowTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,214,140,1)');
    grad.addColorStop(0.4, 'rgba(255,170,80,0.45)');
    grad.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  },

  // -------------------------------------------------------------- build --
  init(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const glowTex = this._glowTexture();

    // Sky: a tall gradient dome made from a canvas texture.
    const skyCv = document.createElement('canvas');
    skyCv.width = 16; skyCv.height = 256;
    const sg = skyCv.getContext('2d');
    const grad = sg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#2c2a55');
    grad.addColorStop(0.35, '#6a3a6e');
    grad.addColorStop(0.62, '#c65a3a');
    grad.addColorStop(0.8, '#f08a3c');
    grad.addColorStop(1.0, '#ffc46b');
    sg.fillStyle = grad; sg.fillRect(0, 0, 16, 256);
    const skyTex = new THREE.CanvasTexture(skyCv);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
    );
    this.group.add(sky);
    scene.fog = new THREE.Fog(0xd97a4a, 190, 720);

    // Sun: a fat warm sprite low over the sea, plus the light rig.
    const sunMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b0, fog: false, depthWrite: false });
    this.sunSprite = new THREE.Sprite(sunMat);
    this.sunSprite.scale.set(260, 260, 1);
    this.sunSprite.position.set(-760, 95, 190);
    this.group.add(this.sunSprite);
    const hemi = new THREE.HemisphereLight(0xffd9a8, 0x4a3428, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffa04e, 1.55);
    sun.position.set(-260, 150, 110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 900;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xff9a5c, 0.22));
    this._sunLight = sun;

    // Ground base (under everything): scrubby dark earth.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1500, 1500),
      new THREE.MeshLambertMaterial({ color: 0x51463a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Beach: a long sand strip on the west edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(BEACH_X1 - BEACH_X0 + 30, 560),
      new THREE.MeshLambertMaterial({ color: 0xd9b078 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((BEACH_X0 + BEACH_X1) / 2 - 8, 0.0, 10);
    sand.receiveShadow = true;
    this.group.add(sand);

    // Sea: animated plane west of the sand.
    this.waterMat = new THREE.MeshPhongMaterial({
      color: 0x1e5a74, shininess: 90, specular: 0xff9a50,
      transparent: true, opacity: 0.94,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(760, 1100), this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(WATER_X - 372, 0.12, 0);
    this.group.add(this.water);
    // A lighter foam line where sea meets sand.
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 560),
      new THREE.MeshBasicMaterial({ color: 0xf7e8c8, transparent: true, opacity: 0.55 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(BEACH_X0 + 3, 0.16, 10);
    this.group.add(foam);
    this._foam = foam;

    this._buildRoads();
    this._buildBlocks(glowTex);
    this._buildHarbour();
    this._buildLighthouse();
    this._buildLamps(glowTex);
    this._buildPalms();
  },

  _buildRoads() {
    const len = CITY_EDGE * 2 + 30;
    const texV = this._roadTexture(false); texV.repeat.set(1, len / PITCH);
    const texH = this._roadTexture(true); texH.repeat.set(len / PITCH, 1);
    const matV = new THREE.MeshLambertMaterial({ map: texV });
    const matH = new THREE.MeshLambertMaterial({ map: texH });
    for (let i = -GRID; i <= GRID; i++) {
      const c = streetCoord(i);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, len), matV);
      v.rotation.x = -Math.PI / 2; v.position.set(c, 0.02, 0);
      v.receiveShadow = true; this.group.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(len, ROAD), matH);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.021, c);
      h.receiveShadow = true; this.group.add(h);
    }
    // Promenade along the beach road.
    const prom = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 460),
      new THREE.MeshLambertMaterial({ color: 0xb09a7a })
    );
    prom.rotation.x = -Math.PI / 2;
    prom.position.set(BEACH_X1 + 2, 0.03, 0);
    prom.receiveShadow = true;
    this.group.add(prom);
  },

  _building(x, z, w, d, h, texMat, roofColor) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const roof = new THREE.MeshLambertMaterial({ color: roofColor || 0x5a4636 });
    const mesh = new THREE.Mesh(geo, [texMat, texMat, roof, roof, texMat, texMat]);
    mesh.position.set(x, h / 2 + 0.15, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
    this.addCollider(x, z, w, d);
    return mesh;
  },

  _buildBlocks(glowTex) {
    const palettes = [
      { base: '#8a6f5c', lit: 0.42 }, { base: '#6e5a6e', lit: 0.5 },
      { base: '#7d7a6a', lit: 0.36 }, { base: '#96684a', lit: 0.55 },
      { base: '#5f6d7d', lit: 0.48 }, { base: '#a08059', lit: 0.4 },
    ];
    const texCache = {};
    const matFor = (pi, floors, cols) => {
      const key = pi + '-' + floors + '-' + cols;
      if (!texCache[key]) {
        const p = palettes[((pi % palettes.length) + palettes.length) % palettes.length];
        const tex = this._windowTexture(p.base, p.lit, floors, cols);
        texCache[key] = new THREE.MeshLambertMaterial({ map: tex });
      }
      return texCache[key];
    };
    const slabMat = new THREE.MeshLambertMaterial({ color: 0x9a8f80 });

    for (let bx = -GRID; bx < GRID; bx++) {
      for (let bz = -GRID; bz < GRID; bz++) {
        const cx = blockCenter(bx), cz = blockCenter(bz);
        // Sidewalk slab under each block.
        const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 3, 0.3, BLOCK + 3), slabMat);
        slab.position.set(cx, 0.0, cz);
        slab.receiveShadow = true;
        this.group.add(slab);

        const west = bx === -GRID, downtown = bx >= 1 && bz <= -2;
        const market = (bx === 0 && bz === -1) || (bx === 1 && bz === 0);
        const housing = bx >= 1 && bz >= 1;
        const gudangBlock = bx === -GRID && bz === -2;

        if (gudangBlock) { this._buildGudang9(cx, cz); continue; }
        if (market) { this._buildMarket(cx, cz); continue; }

        if (west && bz <= -1) {
          // Pelabuhan Lama: long warehouses near the cranes.
          this._building(cx - 6, cz, 26, 30, 9, matFor(bx + bz + 2, 2, 6), 0x6e4a38);
          this._building(cx + 12, cz + 6, 10, 18, 6, matFor(bx - bz, 1, 4), 0x6e4a38);
        } else if (downtown) {
          // Pusat Kota towers.
          const isTvBlock = bx === 2 && bz === -3;
          if (isTvBlock) { this._buildTvTower(cx, cz); }
          else {
            const h = randRange(30, 52);
            this._building(cx, cz, randRange(20, 26), randRange(20, 26), h, matFor(bx * 3 + bz, 12, 6), 0x3f3648);
            if (RNG() < 0.8) this._building(cx + (RNG() < 0.5 ? -13 : 13), cz + 10, 12, 12, randRange(14, 24), matFor(bz + 4, 6, 4));
          }
        } else if (housing) {
          // Bukit Cahaya: two-storey houses with pitched colour roofs.
          for (let hx = -1; hx <= 1; hx++) {
            for (let hz = -1; hz <= 1; hz++) {
              if (RNG() < 0.18) continue;
              const x = cx + hx * 12.5, z = cz + hz * 12.5;
              const house = this._building(x, z, 8.5, 8, randRange(4.5, 6.5), matFor(hx + hz + 5, 2, 3), randPick([0xa04030, 0x38686e, 0x707a38, 0x8a6a30]));
              house.position.y -= 0.1;
            }
          }
        } else if (west) {
          // Pantai Senja bungalows and small hotels along the beach.
          this._building(cx, cz - 8, 22, 13, randRange(7, 11), matFor(bz + 1, 3, 6), 0x7a4a30);
          this._building(cx + 2, cz + 11, 16, 11, randRange(5, 8), matFor(bx + 3, 2, 5), 0x7a4a30);
        } else {
          // Mixed mid-rise blocks elsewhere.
          const n = randInt(2, 3);
          for (let k = 0; k < n; k++) {
            const x = cx + randRange(-10, 10), z = cz + randRange(-10, 10);
            this._building(x, z, randRange(11, 17), randRange(11, 17), randRange(9, 20), matFor(bx + bz + k, 5, 4));
          }
        }
      }
    }

    // Bengkel Cahaya garage: open-front workshop on its block + forecourt.
    const gp = PLACES.garage;
    const gMat = new THREE.MeshLambertMaterial({ color: 0xc7a23a });
    const back = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 2), gMat);
    back.position.set(gp.x, 3.5, gp.z - 10); back.castShadow = true; this.group.add(back);
    this.addCollider(gp.x, gp.z - 10, 20, 2);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(2, 7, 18), gMat);
    sideL.position.set(gp.x - 10, 3.5, gp.z - 1); this.group.add(sideL);
    this.addCollider(gp.x - 10, gp.z - 1, 2, 18);
    const sideR = sideL.clone(); sideR.position.x = gp.x + 10; this.group.add(sideR);
    this.addCollider(gp.x + 10, gp.z - 1, 2, 18);
    const roofG = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 20), new THREE.MeshLambertMaterial({ color: 0x74552a }));
    roofG.position.set(gp.x, 7.4, gp.z - 1); this.group.add(roofG);
    this.garageZone = { minX: gp.x - 9, maxX: gp.x + 9, minZ: gp.z - 8, maxZ: gp.z + 8 };

    // Safehouse: a green-doored house corner in Bukit Cahaya.
    const sp = PLACES.safehouse;
    this._building(sp.x, sp.z - 6, 11, 9, 5.5, matFor(2, 2, 3), 0x38684a);
  },

  _buildMarket(cx, cz) {
    // Pasar Senja: rows of stalls with bright canvas canopies.
    const canopyCols = [0xd9503c, 0xe8a33a, 0x3a9a7d, 0x4a6ec7, 0xd96ab0, 0xe8e0c8];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x6a5138 });
    for (let r = -1; r <= 1; r++) {
      for (let c = -2; c <= 2; c++) {
        if (RNG() < 0.15) continue;
        const x = cx + c * 7.4, z = cz + r * 11;
        const stall = new THREE.Group();
        const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a6a48 }));
        counter.position.y = 0.55; counter.castShadow = true; stall.add(counter);
        const goods = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 1.8),
          new THREE.MeshLambertMaterial({ color: randPick([0xe86a3a, 0x7dc73a, 0xe8c73a, 0xc73a5a]) }));
        goods.position.y = 1.35; stall.add(goods);
        for (const [px, pz] of [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]]) {
          const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), poleMat);
          pole.position.set(px, 1.3, pz); stall.add(pole);
        }
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.14, 3.1),
          new THREE.MeshLambertMaterial({ color: canopyCols[randInt(0, canopyCols.length - 1)] }));
        canopy.position.y = 2.65; canopy.rotation.z = 0.05; canopy.castShadow = true; stall.add(canopy);
        stall.position.set(x, 0.15, z);
        this.group.add(stall);
        this.addCollider(x, z, 3.4, 2.4);
      }
    }
  },

  _buildGudang9(cx, cz) {
    // Gudang 9: a warehouse the player can walk into — three walls, a roof
    // held high, and an office nook at the back holding the ledger desk.
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x7d6a55 });
    const W = 30, D = 30, H = 10;
    const mkWall = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      m.position.set(x, H / 2, z); m.castShadow = true; m.receiveShadow = true;
      this.group.add(m); this.addCollider(x, z, w, d);
    };
    mkWall(cx, cz - D / 2, W, 1.2);            // back (north)
    mkWall(cx - W / 2, cz, 1.2, D);            // west
    mkWall(cx + W / 2, cz, 1.2, D);            // east
    // South wall in two pieces, leaving a wide doorway.
    mkWall(cx - 10.5, cz + D / 2, 9, 1.2);
    mkWall(cx + 10.5, cz + D / 2, 9, 1.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 3, 0.8, D + 3),
      new THREE.MeshLambertMaterial({ color: 0x8a4a34 }));
    roof.position.set(cx, H + 0.4, cz); roof.castShadow = true; this.group.add(roof);
    // Office nook: desk + shelves at the back.
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x5a4030 }));
    desk.position.set(cx, 0.7, cz - D / 2 + 3.2); this.group.add(desk);
    this.addCollider(cx, cz - D / 2 + 3.2, 4.4, 1.8);
    for (let i = 0; i < 4; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
        new THREE.MeshLambertMaterial({ color: randPick([0x9a7a4e, 0x84744f, 0xa08658]) }));
      crate.position.set(cx + randRange(-11, 11), 1.35, cz + randRange(-9, 9));
      crate.castShadow = true; this.group.add(crate);
      this.addCollider(crate.position.x, crate.position.z, 2.4, 2.4);
    }
    this.gudangInterior = { cx, cz, W, D };
  },

  _buildTvTower(cx, cz) {
    const mat = new THREE.MeshLambertMaterial({ map: this._windowTexture('#4a4a66', 0.6, 14, 6) });
    const tower = this._building(cx, cz, 20, 20, 46, mat, 0x2f2a3d);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 20, 6),
      new THREE.MeshLambertMaterial({ color: 0xb0b4c0 }));
    mast.position.set(cx, 56, cz); this.group.add(mast);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 6, 0, Math.PI * 2, 0, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xd8dce4, side: THREE.DoubleSide }));
    dish.position.set(cx + 6, 40, cz); dish.rotation.z = -0.9; this.group.add(dish);
    const beaconMat = new THREE.SpriteMaterial({
      map: this._glowTexture(), color: 0xff4040, depthWrite: false, transparent: true,
    });
    this.beacon = new THREE.Sprite(beaconMat);
    this.beacon.scale.set(7, 7, 1);
    this.beacon.position.set(cx, 66.5, cz);
    this.group.add(this.beacon);
    return tower;
  },

  _buildHarbour() {
    // Two orange dock cranes west of Pelabuhan Lama + container stacks.
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd96a26 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x5a4636 });
    for (const cz of [-128, -58]) {
      const crane = new THREE.Group();
      const legA = new THREE.Mesh(new THREE.BoxGeometry(1.6, 17, 1.6), craneMat);
      legA.position.set(-4, 8.5, 0); crane.add(legA);
      const legB = legA.clone(); legB.position.x = 4; crane.add(legB);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(24, 1.4, 1.6), craneMat);
      jib.position.set(-4, 17.4, 0); crane.add(jib);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.6), darkMat);
      cab.position.set(-12, 15.8, 0); crane.add(cab);
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7, 0.18), darkMat);
      cable.position.set(-13, 13, 0); crane.add(cable);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2.4),
        new THREE.MeshLambertMaterial({ color: randPick([0x3a7dc7, 0xc73a4a, 0x3aa06a]) }));
      hook.position.set(-13, 8.6, 0); hook.castShadow = true; crane.add(hook);
      crane.position.set(-196, 0, cz);
      crane.traverse(o => { o.castShadow = true; });
      this.group.add(crane);
      this.addCollider(-196, cz, 10, 4);
    }
    const contCols = [0x3a7dc7, 0xc73a4a, 0x3aa06a, 0xe8a33a, 0x7a4ac7];
    for (let i = 0; i < 12; i++) {
      const x = -186 + randRange(-8, 10), z = -160 + i * 9 + randRange(-2, 2);
      const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6),
        new THREE.MeshLambertMaterial({ color: contCols[i % contCols.length] }));
      c.position.set(x, 1.3 + (i % 3 === 0 ? 2.6 : 0), z);
      c.castShadow = true; this.group.add(c);
      if (c.position.y < 2) this.addCollider(x, z, 6, 2.6);
    }
    // A moored launch boat bobbing by the quay — Bima's old workplace.
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, 3.2),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
    hull.position.y = 0.8; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x3a6a8a }));
    cabin.position.set(-0.6, 2.4, 0); boat.add(cabin);
    boat.position.set(BEACH_X0 - 6, 0.2, -120);
    this.group.add(boat);
    this._boat = boat;
  },

  _buildLighthouse() {
    const p = PLACES.lighthouse;
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 3, 9),
      new THREE.MeshLambertMaterial({ color: 0x6a625a }));
    rock.position.set(p.x, 1, p.z); this.group.add(rock);
    const white = new THREE.MeshLambertMaterial({ color: 0xf0ead8 });
    const red = new THREE.MeshLambertMaterial({ color: 0xc73a30 });
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * 0.4, 3.8 - i * 0.4, 4.4, 10), i % 2 ? red : white);
      seg.position.set(p.x, 4.4 + i * 4.4, p.z);
      seg.castShadow = true; this.group.add(seg);
    }
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.6, 8),
      new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    lampRoom.position.set(p.x, 23.4, p.z); this.group.add(lampRoom);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTexture(), color: 0xfff2b0, depthWrite: false, transparent: true,
    }));
    glow.scale.set(15, 15, 1);
    glow.position.set(p.x, 23.4, p.z);
    this.group.add(glow);
    this._lighthouseGlow = glow;
    this.addCollider(p.x, p.z, 8, 8);
  },

  _buildLamps(glowTex) {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (let i = -GRID; i <= GRID; i++) {
      for (let j = -GRID; j <= GRID; j++) {
        if ((i + j) % 2 !== 0) continue;
        const x = streetCoord(i) + ROAD / 2 + 1.2, z = streetCoord(j) + ROAD / 2 + 1.2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 5), poleMat);
        pole.position.set(x, 2.7, z); this.group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), headMat);
        head.position.set(x, 5.5, z); this.group.add(head);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: 0xffc37a, depthWrite: false, transparent: true, opacity: 0.85,
        }));
        spr.scale.set(4.4, 4.4, 1);
        spr.position.set(x, 5.5, z);
        this.group.add(spr);
        this.lampSprites.push(spr);
      }
    }
  },

  _buildPalms() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a, side: THREE.DoubleSide });
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.6, 6);
    const leafGeo = new THREE.ConeGeometry(2.6, 1.1, 7);
    const spots = [];
    for (let z = -170; z <= 190; z += 17) spots.push([-186 + randRange(-3, 3), z]);
    for (let i = 0; i < 26; i++) {
      const x = randRange(-160, 165), z = randRange(-160, 165);
      if (this.isOnRoad(x, z)) spots.push([x + 11, z + 11]);
    }
    for (const [x, z] of spots) {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.8; trunk.rotation.z = randRange(-0.09, 0.09);
      trunk.castShadow = true; palm.add(trunk);
      const crown = new THREE.Mesh(leafGeo, leafMat);
      crown.position.y = 5.9; crown.rotation.x = Math.PI; palm.add(crown);
      const crown2 = new THREE.Mesh(leafGeo, leafMat);
      crown2.position.y = 6.3; crown2.scale.set(0.7, 0.8, 0.7); crown2.rotation.x = Math.PI;
      palm.add(crown2);
      palm.position.set(x, 0, z);
      this.group.add(palm);
    }
  },

  update(dt) {
    this.time += dt;
    // Gentle sea: bob the water level and breathe its colour.
    if (this.water) {
      this.water.position.y = 0.12 + Math.sin(this.time * 0.7) * 0.09;
      const s = 0.5 + 0.5 * Math.sin(this.time * 0.35);
      this.waterMat.color.setHSL(0.54, 0.55, 0.26 + s * 0.05);
    }
    if (this._foam) this._foam.material.opacity = 0.4 + 0.25 * Math.sin(this.time * 0.9);
    if (this._boat) this._boat.position.y = 0.2 + Math.sin(this.time * 0.8 + 1) * 0.14;
    if (this.beacon) this.beacon.material.opacity = (Math.sin(this.time * 2.4) > 0.2) ? 0.95 : 0.12;
    if (this._lighthouseGlow) {
      const p = 0.75 + 0.25 * Math.sin(this.time * 1.6);
      this._lighthouseGlow.material.opacity = p;
    }
    // Lamp glow flickers very slightly, like old sodium lights warming up.
    for (let i = 0; i < this.lampSprites.length; i++) {
      this.lampSprites[i].material.opacity = 0.8 + 0.1 * Math.sin(this.time * 3 + i * 1.7);
    }
  },
};
