// 은하 충돌 모드의 기본값과 범위. 길이 단위는 첫 번째 은하의 원반 반지름 = 1, 중력 상수와 첫 은하 질량 GM = 1.
// 시간 단위는 sqrt(R³ / GM). 두 은하는 포물선 궤도로 다가와 서로의 조석력으로 꼬리를 뽑아낸다.
export const config = {
  defaults: {
    massRatio: 1,
    periapsis: 1.5,
    tiltDeg: 30,
    speed: 1,
  },
  ranges: {
    // 두 번째 은하 질량 ÷ 첫 번째 은하 질량
    massRatio: { min: 0.2, max: 1.5, log: true },
    // 가장 가까이 지나가는 거리(원반 반지름의 배수)
    periapsis: { min: 0.8, max: 4, log: false },
    // 두 번째 은하 원반의 기울기(0° = 같은 방향으로 도는 나란한 원반, 180° = 거꾸로 도는 원반)
    tiltDeg: { min: 0, max: 180, log: false },
    speed: { min: 0.25, max: 4, log: true },
  },
  physics: {
    // 처음 두 은하 사이 거리(원반 반지름 단위)
    startDistance: 12,
    // 은하 중심의 중력이 가까이에서 무한해지지 않게 하는 완화 길이
    softening: 0.06,
    // 두 은하 중심끼리의 완화 길이(은하는 점이 아니라 크기가 있으므로 더 크게)
    centerSoftening: 0.4,
    // 원반 알갱이를 놓는 가장 안쪽 반지름(원반 반지름 단위)
    innerRadius: 0.12,
    // 원반 밀도 분포의 척도 길이 = 원반 반지름 ÷ 이 값(클수록 가운데에 몰림)
    diskScaleDivisor: 3,
    // 원반 두께(원반 반지름의 비율)
    thickness: 0.02,
    // 적분 걸음(시뮬레이션 시간) 과 한 프레임에 허용하는 최대 걸음 수
    step: 0.015,
    maxStepsPerFrame: 60,
    // 두 번째 은하 반지름 = 질량비^이 값
    radiusExponent: 0.5,
    // 가장 가까운 점을 지난 뒤 이 시간이 지나면 처음부터 다시(시뮬레이션 시간)
    afterPeriapsis: 60,
    // 중심 사이가 이 거리(원반 반지름 배수)보다 가까워지면 합쳐진 것으로 본다. 합쳐진 뒤에도 멈추지 않고 계속 이어진다.
    mergedDistance: 0.6,
    // 합쳐진 뒤 별들이 서로 뒤섞여 둥글게 자리 잡는 과정을 흉내 낸다(별끼리 힘이 없어서 대신 무작위 속도 흔들림을 준다).
    // heating: 흔들림 세기(속도/√시간), decayTime: 이 시간이 지나면 1/e로 약해진다. 0이면 끈다.
    relaxation: { heating: 0.04, decayTime: 20 },
    // 동적 마찰(근사): 두 은하가 겹치면 상대 속도가 줄어 서로 묶이고 결국 합쳐진다. 세기(1/시간)와 작용 거리(원반 반지름 배수).
    // 제한 N체 계산에는 이 효과가 없어서 연출용으로 더했다. strength 0이면 끈다.
    friction: { strength: 0.3, range: 1.2 },
  },
  // 화면 속도: 배속 ×1에서 초당 흐르는 시뮬레이션 시간
  pace: { timeUnitsPerSecond: 2.4 },
  // 실제 값으로 바꿔 보여 줄 때 쓰는 기준(은하 하나가 태양 1천억 개 질량, 원반 반지름 1.5만 파섹 = 4.9만 광년)
  real: { massSolar: 1e11, radiusLightYears: 48900, timeUnitYears: 8.65e7 },
  particles: { count: 14000, seed: 11 },
  graph: { samplesPerTimeUnit: 4 },
  visual: {
    cameraDistance: 19,
    cameraDistanceMin: 4,
    cameraDistanceMax: 60,
    defaultYawDeg: 20,
    defaultPitchDeg: 48,
    maxPitchDeg: 88,
    dragSensitivity: 0.006,
    zoomSensitivity: 0.0015,
    pointSize: 0.12,
    pointOpacity: 0.8,
    // 알갱이 밝기가 이 범위에서 무작위로 달라진다
    brightnessMin: 0.45,
    brightnessMax: 1,
    coreScale: 1.6,
    coreOpacity: 0.85,
    backgroundStars: 600,
    backgroundSeed: 31,
    backgroundStarRadius: 120,
  },
};
