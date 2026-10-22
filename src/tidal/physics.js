// 별이 블랙홀의 조석력에 찢기는 현상의 순수 계산 (DOM, three를 모른다).
// 길이 단위 r_t(조석 반지름) = 1, 블랙홀 GM = 1, 시간 단위 sqrt(r_t³/GM). 궤도는 평면 (x, y)이고 가장 가까운 점이 +x 쪽이다.
// 찢긴 부스러기는 저마다 다른 에너지 ε를 가지고 케플러 궤도를 돈다. ε < 0이면 묶여서 돌아오고, ε > 0이면 날아간다.

import { SCHWARZSCHILD_KM_PER_SOLAR_MASS, SOLAR_GM_KM3_S2, SOLAR_RADIUS_KM } from '../shared/units.js';

const FULL_TURN = 2 * Math.PI;
const SOLVER_STEPS = 60;
const SOLVER_TOLERANCE = 1e-12;

export const starRadiusKm = (starMass, physics) =>
  SOLAR_RADIUS_KM * starMass ** physics.radiusExponent;

// 조석 반지름 r_t = R★ (M_bh / M★)^(1/3): 이보다 가까이 가면 블랙홀의 조석력이 별 자신의 중력을 이긴다.
export const tidalRadiusKm = (bhMass, starMass, physics) =>
  starRadiusKm(starMass, physics) * (bhMass / starMass) ** (1 / 3);

export const horizonKm = (bhMass) => bhMass * SCHWARZSCHILD_KM_PER_SOLAR_MASS;

// 사건의 지평선 반지름을 r_t 단위로. 1 이상이면 별이 찢기기 전에 통째로 삼켜진다.
export const horizonInTidal = (bhMass, starMass, physics) =>
  horizonKm(bhMass) / tidalRadiusKm(bhMass, starMass, physics);

export const periapsisOf = (beta) => 1 / beta;

export const disrupts = (beta, physics) => beta >= physics.disruptBeta;

// 부스러기 에너지가 퍼지는 폭 ΔE = GM R★ / r_t² = (M★ / M_bh)^(1/3) (r_t 단위). exaggeration으로 부풀려 보기 좋게 한다.
export const realEnergySpread = (bhMass, starMass) => (starMass / bhMass) ** (1 / 3);
export const energySpread = (bhMass, starMass, physics) =>
  realEnergySpread(bhMass, starMass) * physics.spreadExaggeration;

// 가장 단단히 묶인 부스러기(ε = -ΔE)가 한 바퀴 도는 시간 = 첫 귀환 시간
export const firstReturnTime = (spread) => FULL_TURN * (2 * spread) ** -1.5;

// 시뮬레이션 시간 단위 하나가 실제로 몇 초인지
export const timeUnitSeconds = (bhMass, starMass, physics) =>
  Math.sqrt(tidalRadiusKm(bhMass, starMass, physics) ** 3 / (SOLAR_GM_KM3_S2 * bhMass));

// 실제 첫 귀환 시간(초): 부풀리지 않은 에너지 퍼짐으로 계산한다.
export const realFirstReturnSeconds = (bhMass, starMass, physics) =>
  firstReturnTime(realEnergySpread(bhMass, starMass)) * timeUnitSeconds(bhMass, starMass, physics);

// 포물선 궤도(ε = 0)의 별 위치. t는 가장 가까운 점을 지나는 순간부터 잰 시간(지나기 전은 음수). 바커 방정식.
export function parabolicPosition(t, periapsis) {
  const k = t / Math.sqrt(2 * periapsis ** 3);
  const y = Math.cbrt((3 * k + Math.sqrt(9 * k * k + 4)) / 2);
  const d = y - 1 / y;
  return [periapsis * (1 - d * d), 2 * periapsis * d];
}

// 포물선 위에서 중심 거리가 r인 지점의 시간(들어오는 쪽이 음수)
export function parabolicTimeAtRadius(r, periapsis) {
  const d = -Math.sqrt(Math.max(r / periapsis - 1, 0));
  return Math.sqrt(2 * periapsis ** 3) * (d + (d * d * d) / 3);
}

// 에너지 ε, 가장 가까운 거리 rp인 궤도의 모양
export function orbitElements(epsilon, periapsis) {
  const h2 = 2 * periapsis + 2 * epsilon * periapsis * periapsis;
  const e = Math.sqrt(Math.max(1 + 2 * epsilon * h2, 0));
  const hyperbolic = epsilon > 0;
  const a = hyperbolic ? 1 / (2 * epsilon) : -1 / (2 * epsilon);
  return { e, a, n: Math.sqrt(1 / a ** 3), hyperbolic };
}

// 늘어나기만 하는 함수 f(x) = target의 해를 [low, high]에서 찾는다. 뉴턴 걸음이 구간을 벗어나면 이분법으로 대신한다.
// (이심률이 1에 가까운 궤도에서도 흔들리지 않게 한다)
function solveMonotonic(f, slope, target, low, high) {
  let x = 0.5 * (low + high);
  for (let i = 0; i < SOLVER_STEPS; i++) {
    const error = f(x) - target;
    if (error > 0) high = x;
    else low = x;
    let next = x - error / slope(x);
    if (!(next > low && next < high)) next = 0.5 * (low + high);
    if (Math.abs(next - x) < SOLVER_TOLERANCE) return next;
    x = next;
  }
  return x;
}

// 타원: E - e sinE = M (M은 한 바퀴로 접어서 -π ~ π, 부호는 대칭)
export function solveEllipticAnomaly(meanAnomaly, e) {
  let m = ((meanAnomaly % FULL_TURN) + FULL_TURN) % FULL_TURN;
  if (m > Math.PI) m -= FULL_TURN;
  const sign = m < 0 ? -1 : 1;
  const anomaly = solveMonotonic(
    (x) => x - e * Math.sin(x),
    (x) => 1 - e * Math.cos(x),
    Math.abs(m),
    0,
    Math.PI
  );
  return sign * anomaly;
}

// 쌍곡선: e sinhH - H = M (부호는 대칭)
export function solveHyperbolicAnomaly(meanAnomaly, e) {
  const target = Math.abs(meanAnomaly);
  let high = 1;
  while (e * Math.sinh(high) - high < target) high *= 2;
  const anomaly = solveMonotonic(
    (x) => e * Math.sinh(x) - x,
    (x) => e * Math.cosh(x) - 1,
    target,
    0,
    high
  );
  return Math.sign(meanAnomaly || 1) * anomaly;
}

// 가장 가까운 점을 지난 뒤 tau 시간에서의 위치 [x, y]
export function orbitPosition(el, tau) {
  const mean = el.n * tau;
  if (el.hyperbolic) {
    const h = solveHyperbolicAnomaly(mean, el.e);
    return [el.a * (el.e - Math.cosh(h)), el.a * Math.sqrt(el.e * el.e - 1) * Math.sinh(h)];
  }
  const anomaly = solveEllipticAnomaly(mean, el.e);
  return [el.a * (Math.cos(anomaly) - el.e), el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(anomaly)];
}

// 들어오는 쪽에서 중심 거리가 r인 지점의 시간(가장 가까운 점 기준, 음수)
export function timeAtRadius(el, r) {
  if (el.hyperbolic) {
    const h = -Math.acosh(Math.max((r / el.a + 1) / el.e, 1));
    return (el.e * Math.sinh(h) - h) / el.n;
  }
  const anomaly = -Math.acos(Math.min(Math.max((1 - r / el.a) / el.e, -1), 1));
  return (anomaly - el.e * Math.sin(anomaly)) / el.n;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 부스러기 알갱이들을 만든다. 모든 알갱이는 별이 r = 1(조석 반지름)에 닿는 순간 같은 자리에서 출발하고,
// 에너지만 다르다(균일하게 -ΔE ~ +ΔE). 시작 위치 흔들림은 별 덩어리의 크기 안에서 무작위.
export function buildDebris({ count, periapsis, spread, cloudRadius, seed }) {
  const random = seededRandom(seed);
  const disruptionTime = parabolicTimeAtRadius(1, periapsis);
  const debris = {
    count,
    disruptionTime,
    el: new Array(count),
    periapsisTime: new Float64Array(count),
    offset: new Float32Array(count * 3),
  };
  for (let i = 0; i < count; i++) {
    const epsilon = spread * (2 * ((i + 0.5) / count) - 1);
    const el = orbitElements(epsilon, periapsis);
    debris.el[i] = el;
    debris.periapsisTime[i] = disruptionTime - timeAtRadius(el, 1);
    // 구 안의 무작위 점
    let x;
    let y;
    let z;
    do {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      z = random() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    debris.offset[i * 3] = x * cloudRadius;
    debris.offset[i * 3 + 1] = y * cloudRadius;
    debris.offset[i * 3 + 2] = z * cloudRadius;
  }
  return debris;
}

// t 시각의 알갱이 i 위치를 out에 [x, y, z]로 쓴다(궤도 평면 x, y와 수직 방향 z). 흔들림은 퍼질수록 조금 커진다.
export function debrisPosition(debris, i, t, thickening, out) {
  const tau = t - debris.periapsisTime[i];
  const [x, y] = orbitPosition(debris.el[i], tau);
  const grown = 1 + thickening * Math.min(Math.max((t - debris.disruptionTime) / 20, 0), 1);
  out[0] = x + debris.offset[i * 3] * grown;
  out[1] = y + debris.offset[i * 3 + 1] * grown;
  out[2] = debris.offset[i * 3 + 2] * grown;
  return out;
}

// 블랙홀로 떨어져 돌아오는 양의 변화(상대값, 첫 귀환 때 1). 에너지가 고르게 퍼져 있으면 t^(-5/3)로 줄어든다.
// timeInFirstReturns: 가장 가까운 점을 지난 뒤 시간을 첫 귀환 시간으로 나눈 값. riseStart ~ 1 사이는 부드럽게 켜진다.
export function fallbackRate(timeInFirstReturns, riseStart) {
  if (timeInFirstReturns <= riseStart) return 0;
  const rise = Math.min((timeInFirstReturns - riseStart) / (1 - riseStart), 1);
  const smooth = rise * rise * (3 - 2 * rise);
  return smooth * Math.min(1, timeInFirstReturns ** (-5 / 3));
}

// 시뮬레이션 시간 범위: 시작(별이 startRadius에 있을 때)부터, 가장 가까운 점 뒤 첫 귀환 × loopFirstReturns까지
export function timeline(periapsis, startRadius, firstReturn, loopFirstReturns) {
  return {
    start: parabolicTimeAtRadius(startRadius, periapsis),
    end: firstReturn * loopFirstReturns,
  };
}
