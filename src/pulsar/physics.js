// 자전축은 y축. 자기축은 자전축에서 tilt만큼 기울고, 자전과 함께 돈다.
// 관측자는 자전축에서 observer만큼 떨어진 고정 방향에 있다.
// 빛줄기는 자기축 양쪽 끝에서 나가고, 축과 관측자 사이 각도 gamma로 밝기가 정해진다.

export { degToRad } from '../shared/math.js';

export function magneticAxis(tiltRad, phaseRad) {
  return [
    Math.sin(tiltRad) * Math.cos(phaseRad),
    Math.cos(tiltRad),
    Math.sin(tiltRad) * Math.sin(phaseRad),
  ];
}

export function observerDir(observerRad) {
  return [Math.sin(observerRad), Math.cos(observerRad), 0];
}

export function angleBetween(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

// gamma가 halfWidth일 때 밝기가 절반이 되는 가우스형 빔
export function beamIntensity(gammaRad, halfWidthRad) {
  return Math.exp(-Math.LN2 * (gammaRad / halfWidthRad) ** 2);
}

export function phaseAt(timeSec, periodSec) {
  return (2 * Math.PI * timeSec) / periodSec;
}

// 자전 위상이 phaseRad일 때 관측자가 보는 밝기(0~1). 양쪽 빛줄기 중 센 쪽을 쓴다.
export function intensityAtPhase(phaseRad, params) {
  const { tiltRad, observerRad, halfWidthRad } = params;
  const m = magneticAxis(tiltRad, phaseRad);
  const gamma = angleBetween(m, observerDir(observerRad));
  return Math.max(
    beamIntensity(gamma, halfWidthRad),
    beamIntensity(Math.PI - gamma, halfWidthRad)
  );
}

export function pulseIntensity(timeSec, params) {
  return intensityAtPhase(phaseAt(timeSec, params.periodSec), params);
}

// 한 바퀴 동안 밝기가 threshold를 아래에서 위로 넘는 횟수(= 깜빡임 횟수).
// steady는 한 바퀴 내내 threshold 이상이라 깜빡임으로 보이지 않는 경우.
export function pulsesPerRotation(params, threshold, samples = 720) {
  const values = Array.from({ length: samples }, (_, i) =>
    intensityAtPhase((2 * Math.PI * i) / samples, params)
  );
  const steady = Math.min(...values) >= threshold;
  let count = 0;
  for (let i = 0; i < samples; i++) {
    const prev = values[(i - 1 + samples) % samples];
    if (prev < threshold && values[i] >= threshold) count++;
  }
  return { count, steady };
}

// 한 바퀴 동안 가장 밝아지는 값(0~1). 빛줄기가 관측자에 가까이 올수록 1에 가깝다.
export function peakIntensity(params) {
  const { tiltRad, observerRad, halfWidthRad } = params;
  const closest = Math.abs(observerRad - tiltRad);
  const farthest = Math.min(observerRad + tiltRad, 2 * Math.PI - observerRad - tiltRad);
  return Math.max(
    beamIntensity(closest, halfWidthRad),
    beamIntensity(Math.PI - farthest, halfWidthRad)
  );
}
