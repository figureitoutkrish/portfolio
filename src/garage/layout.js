// The pit lane's geometry, shared by the 3D scene (src/three/garage/pitlane.js) and the vehicle
// model (vehicle.js). Metres.
// The lane runs along +z (the car starts at startZ heading +z); garages are on the driver's right
// (x < garageFront); our garage is centred on z = ours.
export const LAYOUT = {
  startZ: -150,
  laneHalf: 3.2, // the car's centre may drift ±3.2m across the lane
  garageFront: -8, // x of the garage openings
  garageDepth: 15,
  garageWidth: 14,
  pitch: 16, // garage spacing along z
  ours: 0, // z of our garage's centre
  // where the car ends up parked: nose out toward the lane
  box: { x: -12.6, z: 0, heading: Math.PI / 2 },
  pitWall: 9.5,
  speedLimit: 80, // km/h, the pit limiter
  approach: 45, // metres before our garage where the car is eased down (guidance, not a game)
  // past our garage: stop anywhere in here, then reverse into the box
  reverseZone: [4, 26], // z offsets from `ours`
  laneEnd: 27, // a closed pit exit: the car can't roll further than ours + 27
};
