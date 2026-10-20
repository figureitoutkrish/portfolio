// The pit lane's geometry, shared by the 3D scene (src/three/garage/pitlane.js) and the vehicle
// model (vehicle.js). Metres.
// The lane runs along +z (the car starts at startZ heading +z); garages are on the driver's right
// (x < garageFront); our garage is centred on z = ours. Across the lane, right to left: the
// garages, the working lane in front of them (where the pit boxes are), the fast lane, the wall.
//
// The real procedure (see design-system/pages/data.md): brake under the limit before the pit
// entry line and switch the limiter on as you cross it; drive down the fast lane; turn into your
// box in the working lane and stop on the crew's marks. The car is then pushed back into the
// garage by the mechanics: F1 cars almost never reverse.
export const LAYOUT = {
  startZ: -250, // where the drive starts, rolling at startKph
  startKph: 110,
  entryLine: -135, // the pit entry line: the speed limit starts here
  garageFront: -8, // x of the garage openings
  garageDepth: 15,
  garageWidth: 14,
  pitch: 16, // garage spacing along z
  ours: 0, // z of our garage's centre
  // the pit box in the working lane, in front of our garage: where the car stops (car origin;
  // the front tyres sit on the T at z + axles.front)
  pitBox: { x: -4.6, z: 0 },
  // the car's axles relative to its origin (the concept car's: 3.4 m between them)
  axles: { front: 1.44, rear: -1.96 },
  // where the crew pushes it: inside the garage, nose out toward the lane
  box: { x: -12.6, z: 0, heading: Math.PI / 2 },
  pitWall: 9.5,
  speedLimit: 80, // km/h, the pit limiter
  bounds: { left: 8.1, right: -6.9 }, // the car's centre stays between the wall and the garages
  laneEnd: 30, // the pit exit is closed: the car can't roll further than ours + 30
};
