// 식쌍성 모드의 기본값과 범위. 길이 단위는 별 A의 반지름 = 1.
export const config = {
  defaults: {
    periodSec: 8,
    inclinationDeg: 86,
    massRatio: 0.6,
    separation: 5,
    eccentricity: 0,
    periastronDeg: 0,
  },
  ranges: {
    periodSec: { min: 2, max: 60, log: true },
    inclinationDeg: { min: 0, max: 90, log: false },
    massRatio: { min: 0.2, max: 5, log: true },
    // 가장 가까울 때의 거리 separation × (1 - 이심률)이 두 별 반지름의 합보다 커야 한다(4 × 0.5 = 2 > 1.6)
    separation: { min: 4, max: 12, log: false },
    eccentricity: { min: 0, max: 0.5, log: false },
    periastronDeg: { min: 0, max: 360, log: false },
  },
  // surfaceBrightness: 표면이 단위 면적당 내는 빛(온도가 높을수록 큼). 밝기 = 표면 밝기 × 반지름²
  stars: {
    a: { radius: 1.0, surfaceBrightness: 0.5, coreToken: '--binary-a-core', edgeToken: '--binary-a-edge' },
    b: { radius: 0.6, surfaceBrightness: 1.0, coreToken: '--binary-b-core', edgeToken: '--binary-b-edge' },
  },
  curve: { points: 360, depthSamples: 720, minDepthShown: 0.005 },
  graph: { floorStep: 0.1, floorMargin: 0.05 },
  visual: {
    cameraDistance: 22,
    cameraDistanceMin: 14,
    cameraDistanceMax: 50,
    defaultYawDeg: 35,
    defaultPitchDeg: 25,
    maxPitchDeg: 88,
    dragSensitivity: 0.006,
    zoomSensitivity: 0.0015,
    observerLength: 9,
    orbitSegments: 160,
    orbitOpacity: 0.55,
    limbPower: 0.5,
    backgroundStars: 600,
    backgroundSeed: 11,
    backgroundStarRadius: 90,
    corona: [
      { scale: 3.4, opacity: 0.5 },
      { scale: 6.5, opacity: 0.18 },
    ],
  },
};
