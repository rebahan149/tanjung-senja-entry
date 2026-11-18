'use strict';
/* TANJUNG SENJA — deterministic screenshot scenes for ?shot=start|play|
   chase|end&seed=1. Everything is placed by hand with the seeded RNG, the
   camera is locked, and the scene holds steady for the capture. */

const Shots = {
  setup(mode) {
    G.time = 17 * 60 + 48; // fixed late-sunset light for every shot
    if (mode === 'play') this._play();
    else if (mode === 'chase') this._chase();
    else if (mode === 'end') this._end();
    // 'start' needs nothing placed: the title screen floats over the vista.
  },

  _play() {
    const pl = People.player;
    pl.mesh.position.set(16, 0.15, -4);
    pl.angle = -0.7;
    pl.mesh.rotation.y = pl.angle;
    G.jobIndex = 1; // HUD shows the Market Debts chapter
    HUD.setObjective('Kumpulkan amplop utang di Pasar Senja · 18 m');
    // Life around the market: extra peds and a taksi rolling past.
    People.spawnPed(22, -14); People.spawnPed(12, -22); People.spawnPed(30, -6);
    People.spawnPed(8, -30); People.spawnPed(36, -20);
    const taksi = Vehicles.spawn('taksi', 2, -27, Math.PI / 2, { role: 'parked' });
    taksi.mesh.position.set(2, 0, -27);
    const sedan = Vehicles.spawn('sedan', 30, -54, Math.PI, { role: 'parked', color: 0x3a6ac7 });
    sedan.mesh.position.set(30, 0, -54);
  },

  _policeCar(x, z, angle) {
    const mesh = Police._policeMesh();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    World.group.add(mesh);
    const car = {
      mesh, type: 'sedan', color: 0xf2f2f5, angle, speed: 14,
      role: 'police', cruise: 12, wheelSpin: 0, stuckTimer: 0, reverseTimer: 0,
    };
    mesh.userData.carRef = car;
    Vehicles.all.push(car);
    Police.units.push({ car });
    return car;
  },

  _chase() {
    const pl = People.player;
    const car = Vehicles.starterCar || Vehicles.nearestCar({ x: -146, z: -128 }, 30);
    // Put the chase on the long eastern avenue, heading north at speed.
    car.mesh.position.set(54 - Vehicles.LANE, 0, 34);
    car.angle = Math.PI; // facing -z (north)
    car.mesh.rotation.y = Math.PI;
    car.speed = 19;
    car.role = 'player';
    pl.vehicle = car;
    pl.mesh.visible = false;
    G.wanted = 4.3;
    G.hasPistol = true;
    AudioSys.station = 2; // HUD radio label reads Koplo Pantura mid-chase
    // Pursuers sit between the camera and the player so they read in frame.
    this._policeCar(45, 46, Math.PI - 0.1);
    this._policeCar(58, 49, Math.PI + 0.08);
    this._policeCar(50, 54, Math.PI);
    // Helicopter hovers ahead-above the car so its body and spotlight
    // cone both read in frame while the light itself tracks the car.
    Police.heli = Police._buildHeli();
    Police.heli.position.set(44, 21, 10);
    Police.heli.rotation.y = 2.6;
    World.group.add(Police.heli);
    const spot = Police.heli.userData.spot;
    spot.target.position.set(6.6, -21, 24);
    HUD.setObjective('Kabur dari kejaran — jangan sampai tertangkap!');
  },

  _end() {
    G.money = 2875;
    G.jobIndex = 9;
    G.shellsFound = 7;
    G.stats = { jobsDone: 9, carsStolen: 6, earned: 3615, bustedCount: 1, wastedCount: 0 };
    G.taxiFares = 4;
    G.raceBest = 118.4;
    const pl = People.player;
    pl.mesh.position.set(124, 0.15, -116);
    pl.angle = 2.8;
    pl.mesh.rotation.y = pl.angle;
  },

  // Locked camera per scene; called every frame while in shot mode.
  frame(mode, camera, t) {
    if (mode === 'start') {
      camera.position.set(-218 + Math.sin(t * 0.05) * 3, 25, 46);
      camera.lookAt(-40, 4, -50);
    } else if (mode === 'play') {
      camera.position.set(7.5, 3.4, 5.5);
      camera.lookAt(20, 1.4, -14);
    } else if (mode === 'chase') {
      const car = People.player.vehicle;
      if (car) {
        const p = car.mesh.position;
        camera.position.set(p.x + 7.5, 5.4, p.z + 23);
        camera.lookAt(p.x, 1.0, p.z - 8);
      }
    } else if (mode === 'end') {
      camera.position.set(112, 9, -96);
      camera.lookAt(130, 16, -128);
    }
  },
};
