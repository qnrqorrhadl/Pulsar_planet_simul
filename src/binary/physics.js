// 식쌍성: 두 별이 공통 무게중심을 돌고, 관측자 쪽에서 볼 때 서로를 가리면 전체 밝기가 줄어든다.
// 궤도면은 xz 면(위쪽 y가 궤도의 수직). 관측자 방향 o = (0, cos i, sin i): i = 0이면 위에서, 90이면 옆에서 본다.
// 별은 균일한 원판으로 보고(가장자리 어두워짐은 무시), 뒤에 있는 별의 가려진 면적 비율만큼 빛이 줄어든다.

const TWO_PI = 2 * Math.PI;

// 케플러 방정식 M = E - e sin E 를 뉴턴 방법으로 푼다. 반환: 이심 근점 이각 E
export function solveKepler(meanAnomaly, ecc) {
  const m = ((meanAnomaly % TWO_PI) + TWO_PI) % TWO_PI;
  let e = ecc < 0.8 ? m : Math.PI;
  for (let i = 0; i < 30; i++) {
    const step = (e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e));
    e -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return e;
}

// 별 A에서 본 별 B의 상대 위치(궤도면 안, [x, z])
export function relativeFromEccentric(eccAnomaly, ecc, semiMajor, periastronRad) {
  const x = semiMajor * (Math.cos(eccAnomaly) - ecc);
  const y = semiMajor * Math.sqrt(1 - ecc * ecc) * Math.sin(eccAnomaly);
  const cos = Math.cos(periastronRad);
  const sin = Math.sin(periastronRad);
  return [x * cos - y * sin, x * sin + y * cos];
}

// 무게중심이 원점. massRatio = 질량 B / 질량 A. 무거운 별일수록 중심에 가깝다.
export function starPositions(relative, massRatio) {
  const [x, z] = relative;
  const shareA = massRatio / (1 + massRatio);
  const shareB = 1 / (1 + massRatio);
  return { a: [-x * shareA, 0, -z * shareA], b: [x * shareB, 0, z * shareB] };
}

export function observerDir(inclinationRad) {
  return [0, Math.cos(inclinationRad), Math.sin(inclinationRad)];
}

// 하늘에 비친 위치: [가로, 세로], 깊이는 관측자 쪽이 클수록 가깝다
export function projectToSky(position, inclinationRad) {
  const [x, y, z] = position;
  const cos = Math.cos(inclinationRad);
  const sin = Math.sin(inclinationRad);
  return { x, y: -y * sin + z * cos, depth: y * cos + z * sin };
}

// 두 원판이 겹친 면적. d는 두 중심 사이 거리.
export function circleOverlapArea(d, r1, r2) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const part1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const part2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const kite = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return part1 + part2 - kite;
}

// params: { massRatio, separation, eccentricity, periastronRad, inclinationRad, stars: { a: {radius, surfaceBrightness}, b: {...} } }
export function positionsAt(params, meanAnomaly) {
  const eccAnomaly = solveKepler(meanAnomaly, params.eccentricity);
  const relative = relativeFromEccentric(
    eccAnomaly,
    params.eccentricity,
    params.separation,
    params.periastronRad
  );
  return starPositions(relative, params.massRatio);
}

// 평균 근점 이각(시간에 비례)에서의 전체 밝기(가려지지 않은 두 별의 합 = 1)와 가려지는 별
export function skyAt(params, meanAnomaly) {
  const { a, b } = positionsAt(params, meanAnomaly);
  const skyA = projectToSky(a, params.inclinationRad);
  const skyB = projectToSky(b, params.inclinationRad);
  const starA = params.stars.a;
  const starB = params.stars.b;
  const lightA = starA.surfaceBrightness * starA.radius ** 2;
  const lightB = starB.surfaceBrightness * starB.radius ** 2;
  const total = lightA + lightB;

  const distance = Math.hypot(skyA.x - skyB.x, skyA.y - skyB.y);
  const overlap = circleOverlapArea(distance, starA.radius, starB.radius);
  const behind = skyA.depth < skyB.depth ? 'a' : 'b';
  const behindStar = behind === 'a' ? starA : starB;
  const hiddenFraction = overlap / (Math.PI * behindStar.radius ** 2);
  const behindLight = behind === 'a' ? lightA : lightB;
  return { flux: (total - behindLight * hiddenFraction) / total, behind };
}

export const fluxAt = (params, meanAnomaly) => skyAt(params, meanAnomaly).flux;

// 한 바퀴의 밝기 곡선: 0..2π를 count 구간으로 나눈 count + 1개 값
export function lightCurve(params, count) {
  const values = new Array(count + 1);
  for (let i = 0; i <= count; i++) values[i] = fluxAt(params, (TWO_PI * i) / count);
  return values;
}

// 각 별이 가려질 때 전체 밝기가 얼마나 줄어드는지(0..1). 가려지지 않으면 0.
export function eclipseDepths(params, samples) {
  let minA = 1;
  let minB = 1;
  for (let i = 0; i < samples; i++) {
    const { flux, behind } = skyAt(params, (TWO_PI * i) / samples);
    if (behind === 'a') minA = Math.min(minA, flux);
    else minB = Math.min(minB, flux);
  }
  return { a: 1 - minA, b: 1 - minB };
}
