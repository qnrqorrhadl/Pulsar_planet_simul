// 쌍성 병합(중성자별 두 개가 서로 돌며 다가가다 합쳐짐) 모드의 기본값과 범위.
export const config = {
  defaults: {
    mass1: 1.4,
    mass2: 1.4,
    startSeparationKm: 80,
    slowMotion: 1 / 150,
  },
  ranges: {
    mass1: { min: 1.1, max: 2.3, log: false },
    mass2: { min: 1.1, max: 2.3, log: false },
    // 맞닿는 거리(반지름 합)보다 충분히 멀어야 한다
    startSeparationKm: { min: 40, max: 150, log: true },
    slowMotion: { min: 0.0005, max: 0.1, log: true },
  },
  // 중성자별 반지름. 두 별이 맞닿는 거리 = 반지름 × 2 에서 합쳐짐으로 본다
  star: { radiusKm: 12 },
  graph: { points: 480 },
  visual: {
    unitKm: 10, // 장면 길이 1 = 10 km
    cameraDistance: 26,
    cameraDistanceMin: 12,
    cameraDistanceMax: 60,
    defaultYawDeg: 30,
    defaultPitchDeg: 35,
    maxPitchDeg: 88,
    dragSensitivity: 0.006,
    zoomSensitivity: 0.0015,
    limbPower: 0.5,
    corona: [
      { scale: 3.0, opacity: 0.5 },
      { scale: 5.5, opacity: 0.16 },
    ],
    // 궤적은 돈 각도 stepRad마다 점 하나(최대 maxPoints개)로 그린다
    trail: { maxPoints: 2000, stepRad: 0.08, opacity: 0.55 },
    merge: { remnantScale: 1.26, flashSeconds: 2.5, flashScale: 14 },
    backgroundStars: 600,
    backgroundSeed: 23,
    backgroundStarRadius: 90,
  },
};
