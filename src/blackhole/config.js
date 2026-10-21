// 블랙홀 모드의 기본값과 범위. 길이 단위는 슈바르츠실트 반지름(rs) 1.
export const config = {
  defaults: {
    elevationDeg: 10,
    azimuthDeg: 0,
    massSolar: 10,
    diskSpeed: 1,
    lookYawDeg: 0,
    lookPitchDeg: 0,
  },
  view: {
    // 처음과 "시점 초기화"의 카메라 거리(rs). 실제 거리는 질량을 곱해서 km로 바꾼다.
    defaultDistanceRs: 25,
    // 카메라 거리 제한(rs): 원반 바깥(10)보다 멀어야 하고, 계산은 maxRenderRs까지만 직접 하며
    // 그보다 먼 것은 시야를 넓혀 작게 보이게 한다. maxTrueRs보다 멀면 거의 점이라 멈춘다.
    minRs: 12,
    maxRenderRs: 60,
    maxTrueRs: 2000,
    scaleBarTargetPx: 140,
    lookDegPerPixel: 0.1,
    lookPitchMaxDeg: 80,
    zoomPerWheelUnit: 0.0015,
  },
  ranges: {
    elevationDeg: { min: 0, max: 89, log: false },
    azimuthDeg: { min: 0, max: 360, log: false },
    massSolar: { min: 3, max: 1e10, log: true },
    distanceKm: { min: 30, max: 1e14, log: true },
    diskSpeed: { min: 0.1, max: 4, log: true },
  },
  disk: {
    outerRadius: 10,
    opacity: 0.9,
    swirlArms: 5,
    swirlTightness: 3,
    swirlRate: 8,
    exposure: 1.4,
    brightnessBase: 0.35,
    brightnessHeat: 1.8,
    heatFalloff: 1.3,
    // 도플러 밝기 ∝ g^beamingPower. 색은 g > 1이면 blueTint 쪽, g < 1이면 redTint 쪽으로 기운다.
    beamingPower: 3,
    blueTint: [0.75, 0.9, 1.4],
    redTint: [1.3, 0.8, 0.55],
  },
  stars: {
    scale: 80,
    density: 0.3,
    minSize: 0.05,
    maxSize: 0.16,
    brightness: 1.1,
    warm: [1.0, 0.85, 0.7],
    cool: [0.7, 0.85, 1.0],
    // 은하수 띠: 하늘을 한 바퀴 두르는 흐린 띠. 밝기는 별보다 약하게 둔다.
    milkyWay: {
      tiltDeg: 62,
      azimuthDeg: 20,
      bandWidth: 0.28,
      brightness: 0.4,
      noiseScaleLarge: 3,
      noiseScaleSmall: 9,
      dustWidth: 0.07,
      dustStrength: 0.6,
      warm: [1.0, 0.9, 0.75],
      cool: [0.55, 0.7, 1.0],
    },
  },
  // 눌러서 한 번에 바꾸는 예: 질량(태양 질량 단위)과 카메라 거리(rs)
  presets: {
    'bh-preset-stellar': { massSolar: 10, distanceRs: 25 },
    'bh-preset-sgr': { massSolar: 4.3e6, distanceRs: 25 },
    'bh-preset-m87': { massSolar: 6.5e9, distanceRs: 25 },
  },
  hints: {
    edgeOnMaxDeg: 5,
    faceOnMinDeg: 60,
  },
  tracing: {
    maxSteps: 320,
    stepScale: 0.04,
    minStep: 0.02,
    maxStep: 0.8,
    escapeMargin: 1.02,
    fovDeg: 40,
    renderScale: 0.7,
  },
};
