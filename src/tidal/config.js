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
    cloudRadius: 0.16,
    // 부스러기가 퍼지면서 두꺼워지는 정도(1 + 이 값 × 지나온 비율)
    thickening: 2.5,
    seed: 7,
  },
  // 연출 방식(별이 꼬리를 흘리며 지나감): 흘리기 시작하는 거리, 끝나는 때(시작 시각의 몇 배), 머리가 줄어드는 최소 크기, 구름 굵기, 화면 속도
  // tailBind: 먼저 흘린 꼬리가 더 단단히 묶여 빨리 떨어지게 하는 배수(클수록 꼬리가 빨리 빨려 들어감). thickening: 꼬리가 시간이 갈수록 두꺼워지는 정도(작을수록 가늘게 유지).
  cinematic: {
    startRadius: 4.5,
    endFactor: 1.2,
    headMinScale: 0.45,
    // cloudRadius: 머리 쪽 굵기, tipWidth: 꼬리 끝 굵기의 비율(0에 가까울수록 끝이 뾰족하게 가늘다)
    cloudRadius: 0.07,
    tipWidth: 0.12,
    thickening: 0.3,
    tailBind: 2,
    // 별 덩어리(구체 대신 아직 흘려지지 않은 알갱이가 모여 별을 나타냄): radius 크기, brightness 덩어리 밝기, coreBoost 가운데가 더 밝은 정도,
    // relax 떨어져 나온 알갱이가 덩어리 모양을 풀고 꼬리가 되는 시간, cool 별 색에서 식는 시간(시뮬레이션 단위)
    head: { radius: 0.3, brightness: 0.3, coreBoost: 2.5, relax: 1, cool: 2.5 },
    // 꼬리가 별 위치에서 가질 수 있는 가장 단단한 묶임의 비율(1이면 속도 0). 작을수록 꼬리가 확실히 별 뒤에 처진다.
    bindLimit: 0.8,
    firstReturnSeconds: 22,
    loopFirstReturns: 2.6,
  },
  // 원반 형성: circularizeTime = 돌아온 알갱이가 원 궤도로 정리되는 시간(시뮬레이션 단위, 작을수록 빨리 원반이 됨).
  // radiusSpread: 정리되는 반지름이 반통경 둘레로 흩어지는 폭(0이면 얇은 고리 하나, 클수록 넓은 원반).
  // 카메라는 첫 귀환의 zoomStart~zoomEnd배 사이에 원반 크기에 맞게 다가가 배율 zoomFactor(작을수록 가까이)가 된다.
  disc: { circularizeTime: 5, radiusSpread: 0.7, zoomFactor: 0.2, zoomStart: 0.8, zoomEnd: 1.6 },
  // 별이 찢기기 직전의 늘어남(스파게티화). maxStretch 1 = 끔 (어색해서 꺼 둠)
  stretch: { startRadius: 4.5, maxStretch: 1 },
  // 근점 이동(한 바퀴마다 타원이 돌아가는 각도)의 한계(rad). 일반상대론 식이 지평선 가까이에서는 맞지 않아서 제한한다.
  collision: { maxShiftPerOrbit: 1.2, burstCenter: 1.1, burstWidth: 0.45, flashScale: 3.5, flashOpacity: 0.45, flashColorToken: '--tde-flash' },
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
    // 방금 흘려진 알갱이를 더 밝게(배수 headBoost, 사라지는 시간 headDecay: 시뮬레이션 단위)
    headBoost: 0.8,
    headDecay: 2,
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
