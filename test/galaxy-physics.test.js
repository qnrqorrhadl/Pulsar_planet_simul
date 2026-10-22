import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { config } from '../src/galaxy/config.js';
import {
  relativeParabola,
  circularSpeed,
  buildEncounter,
  step,
  separation,
  timeToPeriapsis,
  markMerged,
} from '../src/galaxy/physics.js';

const P = { ...config.physics, friction: { strength: 0, range: 1 }, relaxation: { heating: 0, decayTime: 1 } };
const make = (overrides = {}) =>
  buildEncounter({ count: 600, massRatio: 1, periapsis: 1.5, tiltDeg: 30, seed: 3, physics: P, ...overrides });

test('포물선: 에너지 0, 각운동량 = sqrt(2 mu rp)', () => {
  const mu = 2;
  const { position, velocity } = relativeParabola(1.5, 12, mu);
  const r = Math.hypot(...position);
  const v2 = velocity[0] ** 2 + velocity[1] ** 2;
  assert.ok(Math.abs(r - 12) < 1e-9);
  assert.ok(Math.abs(v2 / 2 - mu / r) < 1e-9);
  const h = position[0] * velocity[1] - position[1] * velocity[0];
  assert.ok(Math.abs(h - Math.sqrt(2 * mu * 1.5)) < 1e-9);
  assert.ok(position[0] * velocity[0] + position[1] * velocity[1] < 0, '다가오는 중');
});

test('두 중심의 질량 중심은 원점에 머문다', () => {
  const e = make({ massRatio: 0.5 });
  for (let i = 0; i < 400; i++) step(e, P.step);
  const [c1, c2] = e.centers.pos;
  const [m1, m2] = e.centers.mass;
  for (let d = 0; d < 3; d++) assert.ok(Math.abs(m1 * c1[d] + m2 * c2[d]) < 1e-6);
});

test('가장 가까운 거리와 시각이 포물선 식과 맞다', () => {
  const e = make();
  const mu = 2;
  const expected = timeToPeriapsis(1.5, P.startDistance, mu);
  let minimum = Infinity;
  let at = 0;
  while (e.time < expected * 1.3) {
    step(e, P.step);
    const d = separation(e);
    if (d < minimum) {
      minimum = d;
      at = e.time;
    }
  }
  assert.ok(Math.abs(minimum - 1.5) / 1.5 < 0.05, `최소 ${minimum}`);
  assert.ok(Math.abs(at - expected) / expected < 0.05, `시각 ${at} vs ${expected}`);
});

test('혼자 있는 원반 알갱이는 한 바퀴 동안 반지름이 거의 안 변한다', () => {
  const e = buildEncounter({ count: 300, massRatio: 0.2, periapsis: 1, tiltDeg: 0, seed: 5, physics: { ...P, startDistance: 5000 } });
  const radius = (i) => {
    const k = i * 3;
    const c = e.centers.pos[0];
    return Math.hypot(e.pos[k] - c[0], e.pos[k + 1] - c[1], e.pos[k + 2] - c[2]);
  };
  const before = [];
  for (let i = 0; i < 100; i++) before.push(radius(i));
  const period = (2 * Math.PI * 0.8) / circularSpeed(0.8, 1, P.softening);
  while (e.time < period) step(e, P.step);
  for (let i = 0; i < 100; i++) assert.ok(Math.abs(radius(i) - before[i]) / before[i] < 0.08, `알갱이 ${i}`);
});

test('알갱이 수와 두 원반의 나눔은 질량에 비례한다', () => {
  const e = make({ massRatio: 0.5 });
  assert.equal(e.count, 600);
  assert.equal(e.split, 400);
});

test('기울기 0이면 두 원반이 같은 방향으로, 180이면 반대로 돈다', () => {
  const spin = (tiltDeg) => {
    const e = make({ tiltDeg });
    let sum = 0;
    const c = e.centers;
    for (let i = e.split; i < e.count; i++) {
      const k = i * 3;
      const x = e.pos[k] - c.pos[1][0];
      const y = e.pos[k + 1] - c.pos[1][1];
      const vx = e.vel[k] - c.vel[1][0];
      const vy = e.vel[k + 1] - c.vel[1][1];
      sum += x * vy - y * vx;
    }
    return sum;
  };
  assert.ok(spin(0) > 0);
  assert.ok(spin(180) < 0);
});

test('설정이 올바르다', () => {
  for (const r of Object.values(config.ranges)) assert.ok(r.min < r.max);
  assert.ok(config.defaults.periapsis >= config.ranges.periapsis.min);
  assert.ok(P.startDistance > config.ranges.periapsis.max * 2);
});

test('화면 코드가 찾는 id가 index.html에 모두 있다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../src/galaxy/index.js', import.meta.url), 'utf8');
  const ids = [...code.matchAll(/'(gx-[a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 8);
  for (const id of new Set(ids)) assert.ok(html.includes(`id="${id}"`), id);
});

test('동적 마찰은 상대 속도를 줄이고 운동량은 보존한다', () => {
  const physics = { ...config.physics, friction: { strength: 0.5, range: 5 } };
  const e = buildEncounter({ count: 10, massRatio: 0.5, periapsis: 2, tiltDeg: 0, seed: 1, physics: { ...physics, startDistance: 4 } });
  const momentum = () => e.centers.vel[0].map((v, d) => e.centers.mass[0] * v + e.centers.mass[1] * e.centers.vel[1][d]);
  const relative = () => Math.hypot(...e.centers.vel[1].map((v, d) => v - e.centers.vel[0][d]));
  const before = { p: momentum(), w: relative() };
  const withoutFriction = buildEncounter({ count: 10, massRatio: 0.5, periapsis: 2, tiltDeg: 0, seed: 1, physics: { ...P, startDistance: 4 } });
  for (let i = 0; i < 20; i++) {
    step(e, physics.step);
    step(withoutFriction, physics.step);
  }
  const relNo = Math.hypot(...withoutFriction.centers.vel[1].map((v, d) => v - withoutFriction.centers.vel[0][d]));
  assert.ok(relative() < relNo);
  momentum().forEach((v, d) => assert.ok(Math.abs(v - before.p[d]) < 1e-9));
});

test('합쳐진 뒤 흔들림은 별을 퍼뜨리고 시간이 지나며 약해진다', () => {
  const physics = { ...config.physics, friction: { strength: 0, range: 1 }, relaxation: { heating: 0.3, decayTime: 5 } };
  const rms = (e) => {
    const c = e.centers.pos[0];
    let s = 0;
    for (let i = 0; i < 200; i++) s += (e.pos[i * 3] - c[0]) ** 2 + (e.pos[i * 3 + 1] - c[1]) ** 2 + (e.pos[i * 3 + 2] - c[2]) ** 2;
    return Math.sqrt(s / 200);
  };
  const run = (merge) => {
    const e = buildEncounter({ count: 400, massRatio: 0.2, periapsis: 1, tiltDeg: 0, seed: 4, physics: { ...physics, startDistance: 5000 } });
    if (merge) markMerged(e);
    while (e.time < 12) step(e, physics.step);
    return rms(e);
  };
  assert.ok(run(true) > run(false) * 1.05);
});
