import test from 'node:test';
import assert from 'node:assert';
import { formatLength, formatSolarMass, niceNumber, niceScaleBar } from '../src/shared/units.js';
import { rsKm, viewPlan, SCHWARZSCHILD_KM_PER_SOLAR_MASS } from '../src/blackhole/physics.js';
import { config } from '../src/blackhole/config.js';

const near = (a, b, relative = 1e-3) => assert.ok(Math.abs(a - b) <= relative * Math.abs(b), `${a} vs ${b}`);

test('사건의 지평선 반지름: 태양 10배 ≈ 29.5 km, 궁수자리 A* ≈ 1270만 km, M87* ≈ 128 AU', () => {
  near(rsKm(10), 29.5325);
  near(rsKm(4.3e6), 1.27e7, 5e-3);
  near(rsKm(6.5e9) / 149597870.7, 128.3, 5e-3);
  assert.strictEqual(SCHWARZSCHILD_KM_PER_SOLAR_MASS, 2.95325);
});

test('길이 표기: km, 만 km, AU', () => {
  assert.strictEqual(formatLength(29.5), '29.5 km');
  assert.strictEqual(formatLength(738), '738 km');
  assert.strictEqual(formatLength(12000), '1.2만 km');
  assert.strictEqual(formatLength(1.27e7), '1,270만 km');
  assert.strictEqual(formatLength(2.99e8), '2 AU');
  assert.strictEqual(formatLength(1.9e10), '127 AU');
});

test('질량 표기', () => {
  assert.strictEqual(formatSolarMass(10), '10 태양');
  assert.strictEqual(formatSolarMass(4.3e6), '430만 태양');
  assert.strictEqual(formatSolarMass(6.5e9), '65억 태양');
});

test('읽기 쉬운 수: 1, 2, 5 × 10^n 중 목표 이하에서 가장 큰 값', () => {
  assert.strictEqual(niceNumber(1), 1);
  assert.strictEqual(niceNumber(1.9), 1);
  assert.strictEqual(niceNumber(2), 2);
  assert.strictEqual(niceNumber(4.9), 2);
  assert.strictEqual(niceNumber(7), 5);
  assert.strictEqual(niceNumber(130), 100);
  assert.strictEqual(niceNumber(0.3), 0.2);
});

test('눈금자는 목표보다 길지 않고, 목표의 40% 이상이다', () => {
  for (const target of [3, 29, 130, 4500, 2.2e4, 8e5, 3e7, 5e9, 7e10, 4e12]) {
    const bar = niceScaleBar(target);
    assert.ok(bar.km <= target * 1.0000001, `${target} -> ${bar.km}`);
    assert.ok(bar.km >= target * 0.4, `${target} -> ${bar.km}`);
    assert.ok(bar.label.length > 0);
  }
});

const limits = config.view;
test('카메라 거리 변환: 범위 안이면 그대로, 멀면 시야를 넓히고, 가까우면 멈춘다', () => {
  const mass = 10;
  const rs = rsKm(mass);
  const inside = viewPlan(25 * rs, mass, limits);
  near(inside.trueRs, 25);
  near(inside.renderRs, 25);
  assert.strictEqual(inside.zoom, 1);

  const far = viewPlan(300 * rs, mass, limits);
  near(far.trueRs, 300);
  assert.strictEqual(far.renderRs, limits.maxRenderRs);
  near(far.zoom, 300 / limits.maxRenderRs);

  const close = viewPlan(10 * rs, mass, limits);
  near(close.trueRs, 10);
  assert.strictEqual(close.renderRs, limits.minRs);
  near(close.zoom, 10 / limits.minRs);
  assert.ok(close.zoom < 1);
  assert.ok(!close.tooNear);

  const near1 = viewPlan(3 * rs, mass, limits);
  assert.strictEqual(near1.trueRs, limits.minTrueRs);
  assert.ok(near1.tooNear);

  const tooFar = viewPlan(1e6 * rs, mass, limits);
  assert.strictEqual(tooFar.trueRs, limits.maxTrueRs);
  assert.ok(tooFar.tooFar);
});

test('질량을 두 배로 하면 같은 거리에서 화면 속 크기도 두 배(거리는 절반)', () => {
  const a = viewPlan(2000, 10, limits);
  const b = viewPlan(2000, 20, limits);
  near(a.trueRs / b.trueRs, 2);
});

test('카메라 최소 거리는 원반 바깥 반지름보다 크다', () => {
  assert.ok(config.view.minRs > config.disk.outerRadius);
  for (const style of Object.values(config.diskStyles)) {
    assert.ok(config.view.minRs > style.outerRadius);
  }
});
