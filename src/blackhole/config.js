// 블랙홀 모드의 기본값과 범위. 길이 단위는 슈바르츠실트 반지름(rs) 1.
export const config = {
  defaults: {
    elevationDeg: 10,
    azimuthDeg: 0,
    massSolar: 10,
    diskSpeed: 1,
  },
  view: {
    // 처음과 "시점 초기화"의 카메라 거리(rs). 실제 거리는 질량을 곱해서 km로 바꾼다.
    defaultDistanceRs: 25,
    // 카메라 거리 제한(rs): 원반 바깥(가장 큰 원반 옷의 outerRadius)보다 멀어야 하고, 계산은 maxRenderRs까지만 직접 하며
    // 그보다 먼 것은 시야를 넓혀 작게 보이게 한다. maxTrueRs보다 멀면 거의 점이라 멈춘다.
    minRs: 16,
    maxRenderRs: 60,
    maxTrueRs: 2000,
    scaleBarTargetPx: 140,
    dragDegPerPixel: 0.3,
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
  // 원반 옷(프리셋이 고른다): 뜨거운 쪽·식은 쪽 색(index.html 토큰), 바깥 반지름(rs, 카메라 최소 거리보다 작게), 밝기 배율
  diskStyles: {
    standard: { hotToken: '--disk-hot', coolToken: '--disk-cool', outerRadius: 10, gain: 1 },
    // 궁수자리 A*: 먹는 양이 아주 적어 작고 어둡고 붉다
    hungry: { hotToken: '--disk-sgr-hot', coolToken: '--disk-sgr-cool', outerRadius: 8, gain: 0.55 },
    // SS 433: 한계 이상으로 먹어서 크고 뜨겁고 푸른 흰색이다
    // 얇은 원반 위에 옅은 구름 층을 얹어 부푼 느낌을 낸다(구름 값은 원반 옷마다 따로 둔다: 높이 heightRatio, 밝기 gain)
    feasting: {
      hotToken: '--disk-ss-hot',
      coolToken: '--disk-ss-cool',
      outerRadius: 14,
      gain: 1.35,
      cloud: {
        innerStart: 3.0,
        innerEnd: 3.8,
        outerStart: 8,
        outerEnd: 14,
        heightRatio: 0.16,
        flare: 1.4,
        falloff: 0.6,
        gain: 0.65,
      },
    },
  },
  defaultDiskStyle: 'standard',
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
  // 블랙홀 주변 모양(프리셋이 고른다). 이름 → 얇은 원반, 도넛 구름, 제트('none', 'straight', 'precessing')를 켤지
  shapes: {
    disk: { id: 'disk', disk: true, cloud: false, jet: 'none' },
    bare: { id: 'bare', disk: false, cloud: false, jet: 'none' },
    jet: { id: 'jet', disk: true, cloud: false, jet: 'straight' },
    cloud: { id: 'cloud', disk: false, cloud: true, jet: 'none' },
    cloudjet: { id: 'cloudjet', disk: false, cloud: true, jet: 'straight' },
    precess: { id: 'precess', disk: true, cloud: true, jet: 'precessing' },
  },
  defaultShape: 'disk',
  // 제트 불규칙함 조절(아래 두 제트 공통 뜻): wobble=줄기가 휘는 정도(높이의 비율), wobbleScale=휘는 마디 길이(rs), wobbleSpeed=마디가 흐르는 빠르기,
  // swell=굵기가 들쭉날쭉한 정도, knotJitter=덩어리 간격·밝기가 제각각인 정도(0~1), ragged=가장자리 거칠기, raggedScale=거친 결의 잘기(클수록 잘다), raggedSpeed=결이 흐르는 빠르기
  // 제트(연출용 모양): 원반과 수직인 축을 따라 가늘게 퍼지는 빛줄기. 정해진 공식이 없어 모양과 밝기는 보기 좋게 정한 값이다.
  jet: {
    startHeight: 1.5,
    baseWidth: 0.2,
    spread: 0.03,
    length: 30,
    gain: 3.4,
    knotSpacing: 3.2,
    knotRate: 0.9,
    knotSharpness: 2.5,
    knotFloor: 0.3,
    // ── 빠른 조절판 (0이면 꺼서 매끈해진다) ──
    wobble: 0.08,
    wobbleScale: 4,
    wobbleSpeed: 0.6,
    swell: 0.5,
    knotJitter: 0.7,
    ragged: 0.5,
    raggedScale: 5,
    raggedSpeed: 0.8,
    speed: 0.7,
    beamingPower: 2.5,
    colorToken: '--jet',
  },
  // 도넛 구름(연출용 모양): 얇은 원반 대신 부풀어 오른 뜨겁고 옅은 기체. 실제 EHT 사진처럼 도는 방향으로 한쪽이 밝다.
  // 안쪽은 innerStart~innerEnd(rs)에서 서서히 켜지고, 바깥은 outerStart~outerEnd에서 서서히 꺼진다(카메라 최소 거리 12보다 안쪽).
  cloud: {
    innerStart: 1.6,
    innerEnd: 2.8,
    outerStart: 4,
    outerEnd: 8,
    heightRatio: 0.3,
    // 두께가 반지름에 따라 늘어나는 정도: 1이면 정비례, 클수록 바깥이 나팔처럼 더 두꺼워진다
    flare: 1,
    falloff: 1.5,
    gain: 1.3,
    speedScale: 0.8,
    beamingPower: 3.5,
  },
  // SS 433형 제트(연출용 모양): 속도 0.26c의 두 줄기가 축에서 coneDeg만큼 기울어 나가고, 축이 돌아 나선이 된다.
  // rate: 축이 도는 빠르기(원반 시간 1초당 라디안), pitch: 멀어질수록 늦게 돌아 생기는 나선 간격(rs당 라디안)
  jetPrecessing: {
    startRadius: 1.5,
    baseWidth: 0.16,
    spread: 0.012,
    length: 40,
    gain: 5,
    knotSpacing: 2.4,
    knotRate: 0.7,
    knotSharpness: 2.5,
    knotFloor: 0.3,
    // ── 빠른 조절판 (0이면 꺼서 매끈해진다) ──
    wobble: 0.06,
    wobbleScale: 4,
    wobbleSpeed: 0.6,
    swell: 0.5,
    knotJitter: 0.7,
    ragged: 0.5,
    raggedScale: 5,
    raggedSpeed: 0.8,
    speed: 0.26,
    beamingPower: 3,
    coneDeg: 20,
    rate: 0.5,
    pitch: 0.2,
    approachToken: '--jet-approach',
    recedeToken: '--jet-recede',
  },
  // 눌러서 한 번에 바꾸는 예: 질량(태양 질량 단위), 카메라 거리(rs), 주변 모양(shapes의 이름)
  // 홀로 떠도는 별 블랙홀은 보이지 않고, 궁수자리 A*는 흐릿한 원반, M87*은 도넛 모양 구름과 제트(EHT 사진),
  // SS 433은 원반과 나선으로 도는 제트를 가진다.
  presets: {
    'bh-preset-stellar': { massSolar: 10, distanceRs: 25, shape: 'bare', diskStyle: 'standard' },
    'bh-preset-sgr': { massSolar: 4.3e6, distanceRs: 25, shape: 'disk', diskStyle: 'hungry' },
    // M87*은 EHT 사진처럼 거의 위에서(제트 축에서 약 17°) 본다
    'bh-preset-m87': { massSolar: 6.5e9, distanceRs: 25, shape: 'cloudjet', diskStyle: 'standard', elevationDeg: 73 },
    // 질량은 아직 정확히 모른다(대략 10~20배)
    // SS 433은 원반을 거의 옆에서(약 11°) 본다
    'bh-preset-ss433': { massSolar: 15, distanceRs: 40, shape: 'precess', diskStyle: 'feasting', elevationDeg: 11 },
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
