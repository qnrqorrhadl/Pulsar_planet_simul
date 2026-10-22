import test from 'node:test';
import assert from 'node:assert';
import { config } from '../src/tidal/config.js';
import {
  parabolicPosition,
  parabolicTimeAtRadius,
  orbitElements,
  orbitPosition,
  timeAtRadius,
  buildDebris,
  debrisPosition,
  tidalRadiusKm,
  horizonInTidal,
  realFirstReturnSeconds,
  energySpread,
  firstReturnTime,
  fallbackRate,
  solveEllipticAnomaly,
  solveHyperbolicAnomaly,
  starStretch,
  periapsisShiftPerOrbit,
  collisionPoint,
  collisionFlash,
  buildStream,
} from '../src/tidal/physics.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const radius = ([x, y]) => Math.hypot(x, y);
const P = config.physics;

test('조석 반지름: 태양 1개와 백만 태양 블랙홀이면 태양 반지름의 약 100배', () => {
  near(tidalRadiusKm(1e6, 1, P), 695700 * 100, 1e-6);
});

test('조석 반지름은 별 반지름 × (M_bh/M★)^(1/3)이고 더 무거운 블랙홀일수록 커진다', () => {
  assert.ok(tidalRadiusKm(1e8, 1, P) > tidalRadiusKm(1e6, 1, P));
});

test('블랙홀이 충분히 크면 지평선이 조석 반지름보다 커진다(통째로 삼킴)', () => {
  assert.ok(horizonInTidal(1e6, 1, P) < 1);
  assert.ok(horizonInTidal(1e9, 1, P) > 1);
});

test('실제 첫 귀환 시간: 태양 + 백만 태양 블랙홀이면 약 한 달 반(30~60일)', () => {
  const days = realFirstReturnSeconds(1e6, 1, P) / 86400;
  assert.ok(days > 30 && days < 60, days);
});

test('포물선 궤도: 가장 가까운 순간 거리가 rp이고, 지나기 전후가 y 반대, x 같음', () => {
  const rp = 0.5;
  near(radius(parabolicPosition(0, rp)), rp);
  const before = parabolicPosition(-3, rp);
  const after = parabolicPosition(3, rp);
  near(before[0], after[0]);
  near(before[1], -after[1]);
});

test('포물선 궤도: 에너지 0 (속력² = 2/r)', () => {
  const rp = 0.4;
  const dt = 1e-5;
  const t = -2;
  const a = parabolicPosition(t - dt, rp);
  const b = parabolicPosition(t + dt, rp);
  const v = Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * dt);
  const r = radius(parabolicPosition(t, rp));
  near(v * v, 2 / r, 1e-4);
});

test('r = 1에 닿는 시간을 거꾸로 넣으면 거리가 1이다', () => {
  const rp = 0.5;
  near(radius(parabolicPosition(parabolicTimeAtRadius(1, rp), rp)), 1, 1e-9);
});

test('케플러 방정식 풀이가 방정식을 만족한다', () => {
  for (const e of [0.1, 0.9, 0.999]) {
    for (const m of [-3, -0.5, 0.01, 2, 3.1]) {
      const anomaly = solveEllipticAnomaly(m, e);
      near(anomaly - e * Math.sin(anomaly), m, 1e-8);
    }
  }
  for (const e of [1.0005, 1.5, 3]) {
    for (const m of [-6, -0.5, 0.01, 4]) {
      const anomaly = solveHyperbolicAnomaly(m, e);
      near(e * Math.sinh(anomaly) - anomaly, m, 1e-8);
    }
  }
});

test('에너지가 다른 모든 궤도가 가장 가까운 점에서 같은 거리 rp를 지난다', () => {
  const rp = 0.45;
  for (const epsilon of [-0.2, -0.01, 0.01, 0.2]) {
    const el = orbitElements(epsilon, rp);
    near(radius(orbitPosition(el, 0)), rp, 1e-8);
  }
});

test('에너지 보존: 속력²/2 - 1/r = ε (묶인 궤도와 날아가는 궤도)', () => {
  const rp = 0.5;
  for (const epsilon of [-0.08, 0.08]) {
    const el = orbitElements(epsilon, rp);
    const t = 3;
    const dt = 1e-5;
    const a = orbitPosition(el, t - dt);
    const b = orbitPosition(el, t + dt);
    const v = Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * dt);
    near(0.5 * v * v - 1 / radius(orbitPosition(el, t)), epsilon, 1e-4);
  }
});

test('묶인 궤도는 한 바퀴(2π a^1.5) 뒤에 같은 자리로 돌아온다', () => {
  const el = orbitElements(-0.08, 0.5);
  const period = 2 * Math.PI * el.a ** 1.5;
  const first = orbitPosition(el, 1.3);
  const later = orbitPosition(el, 1.3 + period);
  near(first[0], later[0], 1e-6);
  near(first[1], later[1], 1e-6);
});

test('알갱이는 모두 별이 r = 1에 닿는 순간 거의 같은 자리(r = 1)에서 출발한다', () => {
  const rp = 0.5;
  const debris = buildDebris({ count: 50, periapsis: rp, spread: 0.08, cloudRadius: 0, seed: 1 });
  const out = [0, 0, 0];
  for (let i = 0; i < debris.count; i += 7) {
    debrisPosition(debris, i, debris.disruptionTime, 0, out);
    near(Math.hypot(out[0], out[1]), 1, 1e-6);
  }
});

test('시간이 지나면 묶인 알갱이는 가까이 남고 날아가는 알갱이는 멀어진다', () => {
  const debris = buildDebris({ count: 40, periapsis: 0.5, spread: 0.08, cloudRadius: 0, seed: 1 });
  const out = [0, 0, 0];
  const t = 80;
  debrisPosition(debris, 0, t, 0, out);
  const boundDistance = Math.hypot(out[0], out[1]);
  debrisPosition(debris, 39, t, 0, out);
  const unboundDistance = Math.hypot(out[0], out[1]);
  assert.ok(boundDistance < 2 * (1 / (2 * 0.08)) * 1.01);
  assert.ok(unboundDistance > 10);
});

test('첫 귀환 시간: 에너지 퍼짐이 클수록 짧고 묶인 가장 안쪽 궤도의 주기와 같다', () => {
  const s = energySpread(1e6, 1, P);
  const el = orbitElements(-s, 0.5);
  near(firstReturnTime(s), 2 * Math.PI * el.a ** 1.5, 1e-9);
  assert.ok(firstReturnTime(0.2) < firstReturnTime(0.1));
});

test('귀환량: 첫 귀환 전에는 0, 이후 t^(-5/3)로 줄어든다', () => {
  assert.strictEqual(fallbackRate(0.3, 0.7), 0);
  near(fallbackRate(1, 0.7), 1);
  near(fallbackRate(2, 0.7) / fallbackRate(1, 0.7), 2 ** (-5 / 3), 1e-9);
});

test('설정이 올바르다', () => {
  assert.ok(config.particles.count > 0);
  assert.ok(config.physics.disruptBeta > 0);
  for (const key of Object.keys(config.ranges)) {
    assert.ok(config.ranges[key].min < config.ranges[key].max);
  }
  assert.ok(config.defaults.beta >= config.physics.disruptBeta);
});

test('화면 코드가 찾는 id가 index.html에 모두 있다', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../src/tidal/index.js', import.meta.url), 'utf8');
  const ids = [...code.matchAll(/'(td-[a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 8);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('data-target="tidal"'));
  assert.ok(html.includes('id="td-scene"') && html.includes('id="td-graph"'));
});

test('별 늘어남: 멀리서는 1배, 조석 반지름에서 최대, 부피는 보존', () => {
  const s = { startRadius: 3.2, maxStretch: 4 };
  const far = starStretch(10, s);
  assert.equal(far.along, 1);
  const near = starStretch(1, s);
  assert.ok(Math.abs(near.along - 4) < 1e-9);
  assert.ok(Math.abs(near.along * near.across * near.across - 1) < 1e-9);
});

test('근점 이동은 가까울수록 크고 한계를 넘지 않는다', () => {
  assert.ok(periapsisShiftPerOrbit(0.1, 2, 5) > periapsisShiftPerOrbit(0.05, 2, 5));
  assert.equal(periapsisShiftPerOrbit(10, 2, 1.2), 1.2);
});

test('충돌 지점은 타원 위에 있고 이동이 0이면 근점', () => {
  const el = orbitElements(-0.05, 1);
  const p = 2 * 1 - 2 * 0.05;
  const [x0, y0] = collisionPoint(el, p, 0);
  assert.ok(Math.abs(x0 - p / (1 + el.e)) < 1e-9 && Math.abs(y0) < 1e-12);
  const [x, y] = collisionPoint(el, p, 0.8);
  assert.ok(y > 0 && Math.hypot(x, y) > Math.hypot(x0, y0) - 1e-9);
});

test('충돌 섬광은 첫 귀환 직후 가장 세고 0~1 범위', () => {
  const peak = collisionFlash(1.05, 0.7);
  assert.ok(peak > collisionFlash(0.3, 0.7));
  assert.ok(peak > collisionFlash(2.5, 0.7));
  for (const t of [0, 0.5, 1, 1.05, 2, 3.5]) {
    const f = collisionFlash(t, 0.7);
    assert.ok(f >= 0 && f <= 1);
  }
});

test('늘어난 구름: 반지름 방향이 옆 방향보다 길다', () => {
  const periapsis = 1;
  const d = buildDebris({ count: 2000, periapsis, spread: 0.05, cloudRadius: 0.2, seed: 3, stretch: { along: 4, across: 0.5 } });
  const [rx, ry] = parabolicPosition(d.disruptionTime, periapsis);
  const len = Math.hypot(rx, ry);
  let a = 0;
  let b = 0;
  for (let i = 0; i < d.count; i++) {
    const ox = d.offset[i * 3];
    const oy = d.offset[i * 3 + 1];
    a += (ox * rx + oy * ry) ** 2 / (len * len);
    b += (-ox * ry + oy * rx) ** 2 / (len * len);
  }
  assert.ok(a > 4 * b);
});

test('연출 꼬리: 흘려진 순간 알갱이는 별 위치에 있다', () => {
  const periapsis = 0.8;
  const d = buildStream({ count: 400, periapsis, spread: 0.08, cloudRadius: 0, seed: 1, startRadius: 4.5, endFactor: 1.2 });
  const out = [0, 0, 0];
  for (const i of [0, 100, 199, 200, 300, 399]) {
    const t = d.releaseTime[i];
    debrisPosition(d, i, t, 0, out);
    const [sx, sy] = parabolicPosition(t, periapsis);
    assert.ok(Math.hypot(out[0] - sx, out[1] - sy) < 1e-6, `입자 ${i}`);
  }
});

test('연출 꼬리: 일찍 흘린 알갱이일수록 더 묶여 있다', () => {
  const d = buildStream({ count: 100, periapsis: 1, spread: 0.08, cloudRadius: 0, seed: 1, startRadius: 4.5, endFactor: 1.2 });
  assert.ok(d.el[0].a < d.el[49].a || d.el[49].hyperbolic);
  assert.ok(d.releaseTime[0] < d.releaseTime[99]);
});

test('원반 형성: 돌아온 뒤 반지름이 반통경으로 정리되고 처음엔 근점에서 이어진다', () => {
  const periapsis = 0.8;
  const d = buildDebris({ count: 200, periapsis, spread: 0.08, cloudRadius: 0, seed: 2 });
  const i = 20; // 묶인 알갱이
  const c = d.circular;
  assert.ok(Number.isFinite(c.time[i]));
  const out = [0, 0, 0];
  debrisPosition(d, i, c.time[i] + 1e-9, 0, out, 5);
  near(Math.hypot(out[0], out[1]), periapsis, 1e-3);
  debrisPosition(d, i, c.time[i] + 100, 0, out, 5);
  near(Math.hypot(out[0], out[1]), c.semiLatus[i], 1e-3);
  // 끄면(circularizeTime 0) 타원을 계속 따라가므로 반지름이 반통경이 아니다
  debrisPosition(d, i, c.time[i] + 0.5 * 2 * Math.PI * d.el[i].a ** 1.5, 0, out, 0);
  assert.ok(Math.hypot(out[0], out[1]) > c.semiLatus[i] * 1.5);
});

test('날아가는 알갱이는 원반이 되지 않는다', () => {
  const d = buildDebris({ count: 100, periapsis: 1, spread: 0.08, cloudRadius: 0, seed: 2 });
  assert.equal(d.circular.time[99], Infinity);
});

test('꼬리 묶임 배수가 클수록 첫 알갱이가 빨리 돌아온다', () => {
  const slow = buildStream({ count: 100, periapsis: 1, spread: 0.08, cloudRadius: 0, seed: 1, startRadius: 4.5, endFactor: 1.2, tailBind: 1 });
  const fast = buildStream({ count: 100, periapsis: 1, spread: 0.08, cloudRadius: 0, seed: 1, startRadius: 4.5, endFactor: 1.2, tailBind: 2 });
  assert.ok(fast.circular.time[0] < slow.circular.time[0] * 0.8);
});

test('연출 꼬리는 별보다 앞서지 않고 뒤에 처진다', () => {
  const periapsis = 0.455;
  const d = buildStream({
    count: 300, periapsis, spread: 0.08, cloudRadius: 0, seed: 1,
    startRadius: config.cinematic.startRadius, endFactor: config.cinematic.endFactor,
    tailBind: config.cinematic.tailBind, bindLimit: config.cinematic.bindLimit,
  });
  const out = [0, 0, 0];
  for (let i = 0; i < 100; i += 5) {
    for (const dt of [0.5, 1.5]) {
      const t = d.releaseTime[i] + dt;
      if (t > 0) continue; // 가장 가까운 점 앞(들어오는 중)만 비교
      debrisPosition(d, i, t, 0, out, 0);
      const [sx, sy] = parabolicPosition(t, periapsis);
      assert.ok(Math.hypot(out[0], out[1]) >= Math.hypot(sx, sy) - 0.02, `입자 ${i} +${dt}`);
    }
  }
});

test('연출 꼬리는 끝이 가늘고 머리 쪽으로 갈수록 두껍다', () => {
  const d = buildStream({ count: 2000, periapsis: 0.455, spread: 0.08, cloudRadius: 0.1, seed: 5, startRadius: 4.5, endFactor: 1.2, tipWidth: 0.1 });
  const meanSize = (from, to) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.hypot(d.offset[i * 3], d.offset[i * 3 + 1], d.offset[i * 3 + 2]);
    return sum / (to - from);
  };
  const tip = meanSize(0, 200);
  const middle = meanSize(900, 1100);
  const head = meanSize(1800, 2000);
  assert.ok(tip < middle && middle < head);
  assert.ok(head > tip * 4);
});

test('별 덩어리는 중심에 몰리고 반지름 1 안에 있다', () => {
  const d = buildStream({ count: 2000, periapsis: 0.455, spread: 0.08, cloudRadius: 0.1, seed: 5, startRadius: 4.5, endFactor: 1.2 });
  let inner = 0;
  for (let i = 0; i < d.count; i++) {
    const r = Math.hypot(d.clump[i * 3], d.clump[i * 3 + 1], d.clump[i * 3 + 2]);
    assert.ok(r <= 1 + 1e-6);
    if (r < 0.5) inner++;
  }
  assert.ok(inner / d.count > 0.3); // 고르게 퍼지면 0.125, 중심에 몰리면 약 0.35
});
