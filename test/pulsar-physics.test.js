import test from 'node:test';
import assert from 'node:assert';
import {
  degToRad,
  beamIntensity,
  pulseIntensity,
  intensityAtPhase,
  pulsesPerRotation,
  peakIntensity,
} from '../src/pulsar/physics.js';

const threshold = 0.5;

const period = 0.033;

function params(tiltDeg, observerDeg, halfWidthDeg = 12) {
  return {
    periodSec: period,
    tiltRad: degToRad(tiltDeg),
    observerRad: degToRad(observerDeg),
    halfWidthRad: degToRad(halfWidthDeg),
  };
}

function sampleOnePeriod(p, count = 3600) {
  return Array.from({ length: count }, (_, i) => pulseIntensity((i / count) * period, p));
}

function countPeaks(values, threshold) {
  let peaks = 0;
  for (let i = 0; i < values.length; i++) {
    const prev = values[(i - 1 + values.length) % values.length];
    const next = values[(i + 1) % values.length];
    if (values[i] > threshold && values[i] > prev && values[i] >= next) peaks++;
  }
  return peaks;
}

test('빔 반폭에서 밝기는 정확히 절반이다', () => {
  const w = degToRad(12);
  assert.ok(Math.abs(beamIntensity(w, w) - 0.5) < 1e-12);
  assert.strictEqual(beamIntensity(0, w), 1);
});

test('자기축이 기울지 않으면 밝기가 변하지 않는다', () => {
  const values = sampleOnePeriod(params(0, 90));
  const spread = Math.max(...values) - Math.min(...values);
  assert.ok(spread < 1e-9);
});

test('자기축 기울기와 관측 각도가 같으면 한 바퀴에 한 번 최대(1)가 된다', () => {
  const p = params(50, 50);
  assert.ok(Math.abs(pulseIntensity(0, p) - 1) < 1e-9);
});

test('밝기는 주기마다 반복된다', () => {
  const p = params(60, 70);
  for (const t of [0.001, 0.0123, 0.02]) {
    assert.ok(Math.abs(pulseIntensity(t, p) - pulseIntensity(t + period, p)) < 1e-9);
  }
});

test('계산한 최대 밝기가 표본에서 찾은 최대와 같다', () => {
  for (const [tilt, obs] of [[30, 45], [60, 100], [80, 20], [45, 150], [90, 90]]) {
    const p = params(tilt, obs);
    const sampled = Math.max(...sampleOnePeriod(p, 7200));
    assert.ok(Math.abs(sampled - peakIntensity(p)) < 1e-3, `${tilt}/${obs}`);
  }
});

test('빛줄기가 관측자와 멀면 거의 보이지 않는다', () => {
  assert.ok(peakIntensity(params(60, 0)) < 0.001);
});

test('자기축 90도, 관측 90도면 양쪽 빛줄기가 번갈아 지나가 두 번 깜빡인다', () => {
  const values = sampleOnePeriod(params(90, 90));
  assert.strictEqual(countPeaks(values, 0.5), 2);
});

test('한쪽 빛줄기만 지나가면 한 번 깜빡인다', () => {
  const values = sampleOnePeriod(params(40, 40));
  assert.strictEqual(countPeaks(values, 0.5), 1);
});

test('위상으로 계산한 밝기와 시간으로 계산한 밝기가 같다', () => {
  const p = params(55, 80);
  const t = 0.0071;
  const phase = (2 * Math.PI * t) / period;
  assert.ok(Math.abs(intensityAtPhase(phase, p) - pulseIntensity(t, p)) < 1e-12);
});

test('깜빡임 횟수: 한쪽 빛줄기면 1, 양쪽이면 2', () => {
  assert.strictEqual(pulsesPerRotation(params(40, 40), threshold).count, 1);
  assert.strictEqual(pulsesPerRotation(params(90, 90), threshold).count, 2);
});

test('깜빡임 횟수: 빛줄기가 멀면 0이고 일정한 밝기도 아니다', () => {
  const result = pulsesPerRotation(params(60, 0), threshold);
  assert.strictEqual(result.count, 0);
  assert.strictEqual(result.steady, false);
});

test('자기축이 자전축과 같고 관측자가 그 방향이면 일정하게 밝다', () => {
  const result = pulsesPerRotation(params(0, 0), threshold);
  assert.strictEqual(result.steady, true);
  assert.strictEqual(result.count, 0);
});
