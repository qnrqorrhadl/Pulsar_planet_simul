// 조석 파괴 모드의 기본값과 범위. 길이 단위는 조석 반지름 r_t = 1, 중력 상수 GM(블랙홀) = 1.
// 시간 단위는 sqrt(r_t³ / GM). 별이 블랙홀에 r_t보다 가까이 가면 찢긴다.
export const config = {
  defaults: {
    bhMassSolar: 1e6,
    starMassSolar: 1,
    beta: 2.2,
    speed: 1,
  },
  ranges: {
    bhMassSolar: { min: 1e4, max: 1e9, log: true },
    starMassSolar: { min: 0.1, max: 10, log: true },
    // 침투 정도 β = r_t ÷ 가장 가까워질 때 거리. 1보다 작으면 찢어지지 않는다.
    beta: { min: 0.5, max: 6, log: false },
    speed: { min: 0.25, max: 4, log: true },
  },
  physics: {
    // 별 질량 → 반지름(태양 반지름 단위): 주계열 근사 R ∝ M^0.8
    radiusExponent: 0.8,
    // 별이 찢기기 시작하는 침투 정도
    disruptBeta: 1,
    // 별을 처음 놓는 거리(r_t 단위)
    startRadius: 14,
    // 부스러기 에너지 퍼짐 = 실제 값(별 반지름 ÷ r_t)을 이만큼 부풀려서 한 번에 보이게 한다. 실제 시간은 이 값만큼 줄여 계산해 표시한다.
    spreadExaggeration: 8,
    // 첫 귀환이 화면에서 걸리는 시간(초, 배속 ×1일 때)
    firstReturnSeconds: 12,
    // 첫 귀환 시간의 몇 배가 지나면 처음부터 다시 시작하나
    loopFirstReturns: 3.5,
    // 별이 사라지는 데 걸리는 시간(시뮬레이션 단위)
    starFadeTime: 0.6,
  },
  particles: {
    count: 10000,
    // 처음 별 덩어리의 크기(r_t 단위, 보이는 크기)
    cloudRadius: 0.2,
    // 부스러기가 퍼지면서 두꺼워지는 정도(1 + 이 값 × 지나온 비율)
    thickening: 2.5,
    seed: 7,
  },
  // 별이 찢기기 직전의 늘어남(스파게티화)
  stretch: { startRadius: 3.2, maxStretch: 5 },
  // 근점 이동(한 바퀴마다 타원이 돌아가는 각도)의 한계(rad). 일반상대론 식이 지평선 가까이에서는 맞지 않아서 제한한다.
  collision: { maxShiftPerOrbit: 1.2, burstCenter: 1.1, burstWidth: 0.25, flashScale: 5, flashOpacity: 0.9, flashColorToken: '--tde-flash' },
  graph: { maxFirstReturns: 3.5, riseStart: 0.7 },
  visual: {
    cameraDistance: 40,
    cameraDistanceMin: 2,
    cameraDistanceMax: 70,
    defaultYawDeg: 25,
    defaultPitchDeg: 38,
    maxPitchDeg: 88,
    dragSensitivity: 0.006,
    zoomSensitivity: 0.0015,
    starVisualRadius: 0.3,
    // 블랙홀이 너무 작으면 보이도록 하는 최소 반지름(r_t 단위)
    minHorizonVisual: 0.07,
    glowScale: 1.6,
    pointSize: 0.13,
    pointOpacity: 0.85,
    heatRadius: 1.8,
    orbitSegments: 220,
    orbitOpacity: 0.35,
    limbPower: 0.5,
    backgroundStars: 600,
    backgroundSeed: 23,
    backgroundStarRadius: 120,
    corona: [
      { scale: 4, opacity: 0.45 },
      { scale: 8, opacity: 0.15 },
    ],
  },
};
