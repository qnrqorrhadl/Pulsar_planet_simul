import test from 'node:test';
import assert from 'node:assert';
import { config } from '../src/binary/config.js';
import {
  solveKepler,
  starPositions,
  positionsAt,
  circleOverlapArea,
  skyAt,
  fluxAt,
  lightCurve,
  eclipseDepths,
  observerDir,
} from '../src/binary/physics.js';

const DEG = Math.PI / 180;
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);

function paramsFor(overrides = {}) {
  return {
    massRatio: 0.6,
    separation: 5,
    eccentricity: 0,
    periastronRad: 0,
    inclinationRad: 90 * DEG,
    stars: config.stars,
    ...overrides,
  };
}

const lightOf = (star) => star.surfaceBrightness * star.radius ** 2;
const { a: starA, b: starB } = config.stars;
const total = lightOf(starA) + lightOf(starB);

test('케플러 방정식의 해가 식을 만족한다', () => {
  for (const ecc of [0, 0.2, 0.5, 0.9]) {
    for (const m of [0, 0.7, 2, 3.1, 5, 6.2]) {
      const e = solveKepler(m, ecc);
      near(e - ecc * Math.sin(e), ((m % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 1e-9);
    }
  }
});

test('원 궤도에서 두 별 사이 거리는 일정하고, 무게중심이 원점이다', () => {
  const p = paramsFor({ massRatio: 0.6 });
  for (const m of [0, 1, 2.5, 4]) {
    const { a, b } = positionsAt(p, m);
    near(Math.hypot(b[0] - a[0], b[2] - a[2]), 5, 1e-9);
    // 질량 A = 1, 질량 B = 0.6 → 1·a + 0.6·b = 0
    for (let k = 0; k < 3; k++) near(1 * a[k] + 0.6 * b[k], 0, 1e-9);
  }
});

test('타원 궤도: 가장 가까울 때 a(1-e), 가장 멀 때 a(1+e)', () => {
  const p = paramsFor({ eccentricity: 0.4, periastronRad: 0.7 });
  const near1 = positionsAt(p, 0);
  const far = positionsAt(p, Math.PI);
  const gap = (s) => Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2]);
  near(gap(near1), 5 * 0.6);
  near(gap(far), 5 * 1.4);
});

test('무거운 별일수록 무게중심에 가깝다', () => {
  const { a, b } = starPositions([6, 0], 3);
  assert.ok(Math.abs(b[0]) < Math.abs(a[0]));
  near(a[0], -4.5);
  near(b[0], 1.5);
});

test('두 원판 겹침 면적: 멀면 0, 안에 있으면 작은 원, 반쯤 겹치면 알려진 값', () => {
  near(circleOverlapArea(5, 1, 0.6), 0);
  near(circleOverlapArea(0.2, 1, 0.6), Math.PI * 0.36);
  near(circleOverlapArea(1, 1, 1), (2 * Math.PI) / 3 - Math.sqrt(3) / 2, 1e-9);
});

test('위에서 내려다보면(기울기 0) 별이 서로 가리지 않아 밝기는 늘 1', () => {
  const p = paramsFor({ inclinationRad: 0 });
  for (let i = 0; i < 24; i++) near(fluxAt(p, (i * 2 * Math.PI) / 24), 1);
});

test('옆에서 보면: 작은 별 B가 앞을 지날 때와 뒤로 숨을 때의 밝기', () => {
  const p = paramsFor();
  // M = π/2에서 B가 관측자 쪽 → A가 가려짐(B가 A 앞을 지나감)
  const transit = skyAt(p, Math.PI / 2);
  assert.strictEqual(transit.behind, 'a');
  near(transit.flux, (total - lightOf(starA) * (starB.radius / starA.radius) ** 2) / total);
  // M = 3π/2에서 B가 A 뒤로 완전히 숨음
  const hidden = skyAt(p, (3 * Math.PI) / 2);
  assert.strictEqual(hidden.behind, 'b');
  near(hidden.flux, lightOf(starA) / total);
});

test('식의 깊이: 뜨거운 작은 별이 가려질 때가 더 깊다', () => {
  const depths = eclipseDepths(paramsFor(), 720);
  near(depths.b, lightOf(starB) / total, 1e-6);
  near(depths.a, (lightOf(starA) * (starB.radius / starA.radius) ** 2) / total, 1e-6);
  assert.ok(depths.b > depths.a);
});

test('기울기가 충분히 작으면 식이 일어나지 않는다', () => {
  const depths = eclipseDepths(paramsFor({ inclinationRad: 60 * DEG }), 720);
  near(depths.a, 0);
  near(depths.b, 0);
});

test('밝기 곡선: 구간 수 + 1개 값, 처음과 끝이 같고 모두 0..1', () => {
  const curve = lightCurve(paramsFor(), config.curve.points);
  assert.strictEqual(curve.length, config.curve.points + 1);
  near(curve[0], curve[curve.length - 1], 1e-9);
  for (const value of curve) assert.ok(value > 0 && value <= 1 + 1e-12);
});

test('이심률이 있으면 두 식 사이 시간이 달라진다(반 바퀴가 아님)', () => {
  const p = paramsFor({ eccentricity: 0.4 });
  const curve = lightCurve(p, 720);
  const half = curve.length / 2;
  const argMin = (from, to) => {
    let best = from;
    for (let i = from; i < to; i++) if (curve[i] < curve[best]) best = i;
    return best;
  };
  const first = argMin(0, half);
  const second = argMin(half, curve.length);
  assert.ok(Math.abs(second - first - 360) > 20, `${first}, ${second}`);
});

test('관측자 방향은 단위 벡터', () => {
  const o = observerDir(37 * DEG);
  near(Math.hypot(...o), 1);
});

test('가장 가까울 때도 두 별이 서로 겹치지 않는 범위다', () => {
  const { ranges, stars } = config;
  const closest = ranges.separation.min * (1 - ranges.eccentricity.max);
  assert.ok(closest > stars.a.radius + stars.b.radius);
});
