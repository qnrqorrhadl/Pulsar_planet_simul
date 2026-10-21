import test from 'node:test';
import assert from 'node:assert';
import {
  LIGHT_KM_PER_S,
  SOLAR_MASS_KM,
  beta,
  coalescenceTime,
  timeToContact,
  separationAt,
  orbitalOmega,
  orbitalPhaseAt,
  gravitationalWaveHz,
  relativeSpeed,
  starPositions,
  frequencyCurve,
  separationAtPhase,
} from '../src/inspiral/physics.js';

const near = (a, b, relative = 1e-6) =>
  assert.ok(Math.abs(a - b) <= relative * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('1.4+1.4 태양질량이 100 km에서 합쳐질 때까지 약 0.37초', () => {
  const t = coalescenceTime(1.4, 1.4, 100);
  assert.ok(t > 0.3 && t < 0.45, `${t}`);
});

test('거리는 시간에 따라 줄고, 끝 시각에는 0이 된다', () => {
  const full = coalescenceTime(1.4, 1.4, 80);
  near(separationAt(1.4, 1.4, 80, 0), 80);
  assert.ok(separationAt(1.4, 1.4, 80, full / 2) < 80);
  near(separationAt(1.4, 1.4, 80, full), 0);
});

test('거리의 변화율이 피터스 공식과 같다', () => {
  const m1 = 1.4;
  const m2 = 1.8;
  const t = 0.05;
  const dt = 1e-7;
  const a = separationAt(m1, m2, 80, t);
  const numeric = (separationAt(m1, m2, 80, t + dt) - separationAt(m1, m2, 80, t - dt)) / (2 * dt);
  const formula = (-LIGHT_KM_PER_S * beta(m1, m2)) / a ** 3;
  near(numeric, formula, 1e-4);
});

test('돈 각도의 변화율이 그 순간의 공전 각속도와 같다', () => {
  const m1 = 1.3;
  const m2 = 1.6;
  const t = 0.04;
  const dt = 1e-7;
  const numeric =
    (orbitalPhaseAt(m1, m2, 80, t + dt) - orbitalPhaseAt(m1, m2, 80, t - dt)) / (2 * dt);
  const omega = orbitalOmega(m1, m2, separationAt(m1, m2, 80, t));
  near(numeric, omega, 1e-4);
});

test('케플러 제3법칙: 각속도 = c·sqrt(M/a³)', () => {
  const omega = orbitalOmega(1.4, 1.4, 100);
  near(omega, LIGHT_KM_PER_S * Math.sqrt((2.8 * SOLAR_MASS_KM) / 1e6));
});

test('중력파 주파수는 공전 주파수의 두 배, 가까울수록 높다', () => {
  const omega = orbitalOmega(1.4, 1.4, 100);
  near(gravitationalWaveHz(omega), 2 * (omega / (2 * Math.PI)));
  assert.ok(gravitationalWaveHz(orbitalOmega(1.4, 1.4, 30)) > gravitationalWaveHz(omega));
});

test('맞닿기 직전 공전 속도는 광속의 수십 퍼센트', () => {
  const a = 24;
  const speed = relativeSpeed(orbitalOmega(1.4, 1.4, a), a);
  assert.ok(speed > 0.3 && speed < 0.6, `${speed}`);
});

test('무게중심 위치: 두 별 사이 거리가 a이고 질량 가중 합이 0', () => {
  const { a, b } = starPositions(1.2, 2.0, 50, 0.7);
  near(Math.hypot(b[0] - a[0], b[2] - a[2]), 50);
  for (const k of [0, 2]) near(1.2 * a[k] + 2.0 * b[k], 0, 1e-9);
});

test('맞닿는 시각은 전체 시간보다 조금 짧고, 그 시각의 거리가 맞닿는 거리', () => {
  const contact = 24;
  const end = timeToContact(1.4, 1.4, 80, contact);
  assert.ok(end < coalescenceTime(1.4, 1.4, 80));
  near(separationAt(1.4, 1.4, 80, end), contact, 1e-9);
});

test('주파수 곡선은 계속 오르고 개수는 구간 수 + 1', () => {
  const curve = frequencyCurve(1.4, 1.4, 80, 24, 100);
  assert.strictEqual(curve.length, 101);
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i] > curve[i - 1]);
});

test('돈 각도로 구한 거리가 시간으로 구한 거리와 같다', () => {
  const m1 = 1.2;
  const m2 = 1.9;
  for (const t of [0, 0.01, 0.05, 0.1]) {
    const phase = orbitalPhaseAt(m1, m2, 90, t);
    near(separationAtPhase(m1, m2, 90, phase), separationAt(m1, m2, 90, t), 1e-9);
  }
});
