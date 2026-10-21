import test from 'node:test';
import assert from 'node:assert';
import { config } from '../src/blackhole/config.js';
import {
  traceRay,
  stepSize,
  cameraBasis,
  orbitalSpeed,
  dopplerFactor,
  gravitationalRedshift,
  observedShift,
  milkyWayNormal,
  CRITICAL_IMPACT,
  ISCO,
  PHOTON_SPHERE,
  SCHWARZSCHILD_RADIUS,
} from '../src/blackhole/physics.js';

const FAR = 1000;
const MAX_STEPS = 100000;
const tracing = config.tracing;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);

// 멀리서 +x 방향으로 날아오는 빛. b는 블랙홀 중심에서 빗나간 거리(충격 매개변수).
function rayWithImpact(b) {
  return traceRay([-FAR, b, 0], [1, 0, 0], tracing, FAR, MAX_STEPS);
}

function deflection(result) {
  return Math.acos(dot(result.direction, [1, 0, 0]));
}

test('약한 중력에서 휘어지는 각도는 2rs/b에 가깝다', () => {
  const b = 50;
  const result = rayWithImpact(b);
  assert.strictEqual(result.outcome, 'escaped');
  const expected = (2 * SCHWARZSCHILD_RADIUS) / b;
  // 2차 항이 약 3% 더하므로 위쪽 여유를 둔다
  assert.ok(deflection(result) > expected * 0.95, `${deflection(result)}`);
  assert.ok(deflection(result) < expected * 1.1, `${deflection(result)}`);
});

test('임계 충격 매개변수 안쪽으로 오는 빛은 삼켜진다', () => {
  assert.strictEqual(rayWithImpact(CRITICAL_IMPACT * 0.9).outcome, 'horizon');
});

test('임계 충격 매개변수 바깥으로 오는 빛은 크게 휘어 빠져나간다', () => {
  const result = rayWithImpact(CRITICAL_IMPACT * 1.08);
  assert.strictEqual(result.outcome, 'escaped');
  assert.ok(deflection(result) > Math.PI / 2);
});

test('중심을 향해 곧장 오는 빛은 삼켜진다', () => {
  assert.strictEqual(rayWithImpact(0).outcome, 'horizon');
});

test('광자 구, 마지막 안정 궤도, 그림자 크기의 관계', () => {
  assert.strictEqual(PHOTON_SPHERE, 1.5 * SCHWARZSCHILD_RADIUS);
  assert.strictEqual(ISCO, 3 * SCHWARZSCHILD_RADIUS);
  assert.ok(Math.abs(CRITICAL_IMPACT - PHOTON_SPHERE * Math.sqrt(3)) < 1e-12);
  assert.ok(Math.abs(CRITICAL_IMPACT - 2.598) < 0.001);
});

test('걸음 크기는 최소와 최대 사이에서 거리에 비례한다', () => {
  assert.strictEqual(stepSize(0.01, tracing), tracing.minStep);
  assert.strictEqual(stepSize(100000, tracing), tracing.maxStep);
  assert.ok(Math.abs(stepSize(5, tracing) - tracing.stepScale * 5) < 1e-12);
});

test('카메라는 블랙홀을 바라보고 세 축이 서로 직각이다', () => {
  for (const elevationDeg of [0, 10, 40, 89]) {
    const e = (elevationDeg * Math.PI) / 180;
    const { position, forward, right, up } = cameraBasis(e, 25);
    assert.ok(Math.abs(length(position) - 25) < 1e-9);
    assert.ok(Math.abs(dot(forward, position) + 25) < 1e-9);
    assert.ok(Math.abs(dot(forward, right)) < 1e-9);
    assert.ok(Math.abs(dot(forward, up)) < 1e-9);
    assert.ok(Math.abs(dot(right, up)) < 1e-9);
    assert.ok(Math.abs(length(right) - 1) < 1e-9);
    assert.ok(Math.abs(length(up) - 1) < 1e-9);
  }
});

test('고도 0도에서 카메라는 원반 면 위에 있고 위쪽이 y축이다', () => {
  const { position, up } = cameraBasis(0, 25);
  assert.ok(Math.abs(position[1]) < 1e-12);
  assert.ok(Math.abs(up[1] - 1) < 1e-9);
});

test('방위각을 돌려도 거리와 높이는 그대로이고 세 축은 직각이다', () => {
  const elevation = (25 * Math.PI) / 180;
  const base = cameraBasis(elevation, 30, 0);
  for (const azimuthDeg of [0, 90, 137, 270]) {
    const a = (azimuthDeg * Math.PI) / 180;
    const { position, forward, right, up } = cameraBasis(elevation, 30, a);
    assert.ok(Math.abs(length(position) - 30) < 1e-9);
    assert.ok(Math.abs(position[1] - base.position[1]) < 1e-9);
    assert.ok(Math.abs(dot(forward, position) + 30) < 1e-9);
    assert.ok(Math.abs(dot(forward, right)) < 1e-9);
    assert.ok(Math.abs(dot(forward, up)) < 1e-9);
    assert.ok(Math.abs(dot(right, up)) < 1e-9);
  }
});

test('고개를 돌려도 카메라 위치와 세 축의 직각은 유지된다', () => {
  const e = (20 * Math.PI) / 180;
  const base = cameraBasis(e, 30, 1, 0, 0);
  for (const [yawDeg, pitchDeg] of [[0, 0], [40, 0], [-75, 20], [160, -50]]) {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const { position, forward, right, up } = cameraBasis(e, 30, 1, yaw, pitch);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(position[i] - base.position[i]) < 1e-12);
    assert.ok(Math.abs(length(forward) - 1) < 1e-9);
    assert.ok(Math.abs(length(right) - 1) < 1e-9);
    assert.ok(Math.abs(length(up) - 1) < 1e-9);
    assert.ok(Math.abs(dot(forward, right)) < 1e-9);
    assert.ok(Math.abs(dot(forward, up)) < 1e-9);
    assert.ok(Math.abs(dot(right, up)) < 1e-9);
  }
});

test('고개를 오른쪽으로 90도 돌리면 시선이 원래의 오른쪽을 향한다', () => {
  const e = (15 * Math.PI) / 180;
  const base = cameraBasis(e, 25, 0.5);
  const turned = cameraBasis(e, 25, 0.5, Math.PI / 2, 0);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(turned.forward[i] - base.right[i]) < 1e-9);
});

test('고개를 오른쪽으로 돌리면 블랙홀은 화면 왼쪽으로, 위로 돌리면 아래쪽으로 간다', () => {
  const e = (15 * Math.PI) / 180;
  const base = cameraBasis(e, 25, 0);
  const toHole = base.forward;

  const lookRight = cameraBasis(e, 25, 0, (20 * Math.PI) / 180, 0);
  assert.ok(dot(toHole, lookRight.right) < 0);

  const lookUp = cameraBasis(e, 25, 0, 0, (20 * Math.PI) / 180);
  assert.ok(dot(toHole, lookUp.up) < 0);
});

test('고개를 돌린 각도만큼 블랙홀이 시선 중심에서 벗어난다', () => {
  const e = (15 * Math.PI) / 180;
  const base = cameraBasis(e, 25, 0);
  const yaw = (30 * Math.PI) / 180;
  const turned = cameraBasis(e, 25, 0, yaw, 0);
  assert.ok(Math.abs(Math.acos(dot(base.forward, turned.forward)) - yaw) < 1e-9);
});

test('방위각 90도에서 카메라는 z축 위에 온다', () => {
  const { position } = cameraBasis(0, 20, Math.PI / 2);
  assert.ok(Math.abs(position[0]) < 1e-9);
  assert.ok(Math.abs(position[2] - 20) < 1e-9);
});

test('원반 물질의 속도: 마지막 안정 궤도에서 광속의 절반, 바깥일수록 느리다', () => {
  assert.ok(Math.abs(orbitalSpeed(ISCO) - 0.5) < 1e-12);
  assert.ok(orbitalSpeed(5) < orbitalSpeed(4));
  assert.ok(orbitalSpeed(10) < orbitalSpeed(5));
});

test('도플러: 다가오는 쪽은 밝고 푸르게(g>1), 멀어지는 쪽은 어둡고 붉게(g<1)', () => {
  const v = orbitalSpeed(ISCO);
  const toward = dopplerFactor(ISCO, [1, 0, 0], [1, 0, 0]);
  const away = dopplerFactor(ISCO, [-1, 0, 0], [1, 0, 0]);
  assert.ok(Math.abs(toward - Math.sqrt((1 + v) / (1 - v))) < 1e-12);
  assert.ok(Math.abs(away - Math.sqrt((1 - v) / (1 + v))) < 1e-12);
  assert.ok(toward > 1 && away < 1);
});

test('도플러: 시선에 수직으로 움직이면 약간 붉어진다(1/γ)', () => {
  const v = orbitalSpeed(ISCO);
  const transverse = dopplerFactor(ISCO, [0, 0, 1], [1, 0, 0]);
  assert.ok(Math.abs(transverse - Math.sqrt(1 - v * v)) < 1e-12);
});

test('중력 적색편이: 지평선에서 0, 멀수록 1에 가깝다', () => {
  assert.strictEqual(gravitationalRedshift(SCHWARZSCHILD_RADIUS), 0);
  assert.ok(Math.abs(gravitationalRedshift(ISCO) - Math.sqrt(2 / 3)) < 1e-12);
  assert.ok(gravitationalRedshift(1000) > 0.999);
});

test('전체 이동 인자는 도플러와 중력 적색편이의 곱이다', () => {
  const t = [1, 0, 0];
  const n = [1, 0, 0];
  const expected = dopplerFactor(4, t, n) * gravitationalRedshift(4);
  assert.ok(Math.abs(observedShift(4, t, n) - expected) < 1e-12);
});

test('은하수 띠의 수직 방향은 단위 벡터이고, 기울기 0이면 위(y)를 향한다', () => {
  for (const [tilt, azimuth] of [[0, 0], [62, 20], [90, 200], [30, 359]]) {
    assert.ok(Math.abs(length(milkyWayNormal(tilt, azimuth)) - 1) < 1e-12);
  }
  const flat = milkyWayNormal(0, 123);
  assert.ok(Math.abs(flat[1] - 1) < 1e-12);
});
