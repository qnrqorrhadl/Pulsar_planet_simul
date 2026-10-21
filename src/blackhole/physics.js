// 회전하지 않는 블랙홀(슈바르츠실트). 길이 단위는 슈바르츠실트 반지름 rs = 1.
// 빛의 궤적은 가속도 a = -1.5 * h² * x / r⁵ (h = |x × v|, 한 궤적에서 일정)로 한 걸음씩 따라간다.
// 이 식은 슈바르츠실트 빛 궤적(u'' + u = 1.5 u²)과 같은 모양을 준다. 셰이더도 같은 걸음 규칙을 쓴다.

import { clamp } from '../shared/math.js';

export const SCHWARZSCHILD_RADIUS = 1;
export const PHOTON_SPHERE = 1.5;
export const ISCO = 3;
export const CRITICAL_IMPACT = (3 * Math.sqrt(3)) / 2;

// 슈바르츠실트 반지름 rs = 2GM/c². 태양 질량 1개일 때 약 2.953 km, 질량에 비례한다.
export const SCHWARZSCHILD_KM_PER_SOLAR_MASS = 2.95325;
export const rsKm = (solarMasses) => solarMasses * SCHWARZSCHILD_KM_PER_SOLAR_MASS;

// 실제 카메라 거리(km)를 계산용 거리로 바꾼다. 길이 단위는 rs.
// 계산은 render 거리에서 하고(너무 멀면 광선이 모자라서 minRs..maxRenderRs로 제한), 더 먼 만큼은
// 시야를 넓혀(zoom > 1) 블랙홀이 그만큼 작게 보이게 한다. 너무 가까우면 minRs에서 멈춘다.
export function viewPlan(distanceKm, solarMasses, limits) {
  const wanted = distanceKm / rsKm(solarMasses);
  const trueRs = clamp(wanted, limits.minRs, limits.maxTrueRs);
  const renderRs = clamp(trueRs, limits.minRs, limits.maxRenderRs);
  return {
    trueRs,
    renderRs,
    zoom: trueRs / renderRs,
    tooNear: wanted < limits.minRs,
    tooFar: wanted > limits.maxTrueRs,
  };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => scale(a, 1 / length(a));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function accelerationAt(position, h2) {
  const r = length(position);
  return scale(position, (-1.5 * h2) / r ** 5);
}

export function stepSize(r, tracing) {
  return clamp(tracing.stepScale * r, tracing.minStep, tracing.maxStep);
}

// 한 줄기 빛을 추적한다. outcome: 'horizon'(삼켜짐), 'escaped'(빠져나감), 'limit'(걸음 부족)
export function traceRay(origin, direction, tracing, escapeRadius, maxSteps) {
  let position = origin;
  let velocity = normalize(direction);
  const angular = cross(position, velocity);
  const h2 = dot(angular, angular);

  for (let i = 0; i < maxSteps; i++) {
    const dt = stepSize(length(position), tracing);
    velocity = add(velocity, scale(accelerationAt(position, h2), dt));
    position = add(position, scale(velocity, dt));
    const r = length(position);
    if (r < SCHWARZSCHILD_RADIUS) {
      return { outcome: 'horizon', steps: i + 1, direction: normalize(velocity) };
    }
    if (r > escapeRadius && dot(position, velocity) > 0) {
      return { outcome: 'escaped', steps: i + 1, direction: normalize(velocity) };
    }
  }
  return { outcome: 'limit', steps: maxSteps, direction: normalize(velocity) };
}

// 원반 물질의 회전 속도(광속 기준). 원반 면의 원 궤도에서 지역 관측자가 재는 값: v = sqrt(rs / (2(r - rs)))
export function orbitalSpeed(r) {
  return Math.sqrt((0.5 * SCHWARZSCHILD_RADIUS) / (r - SCHWARZSCHILD_RADIUS));
}

// 도플러 인자 g = 1 / (γ(1 - v·n)). tangent는 물질이 움직이는 방향, toObserver는 빛이 관측자로 가는 방향.
// g > 1이면 파랗고 밝아지고, g < 1이면 붉고 어두워진다.
export function dopplerFactor(r, tangent, toObserver) {
  const v = orbitalSpeed(r);
  const gamma = 1 / Math.sqrt(1 - v * v);
  return 1 / (gamma * (1 - v * dot(tangent, toObserver)));
}

export function gravitationalRedshift(r) {
  return Math.sqrt(1 - SCHWARZSCHILD_RADIUS / r);
}

// 관측자가 받는 전체 이동 인자. 셰이더의 diskSample이 같은 식을 쓴다.
export function observedShift(r, tangent, toObserver) {
  return dopplerFactor(r, tangent, toObserver) * gravitationalRedshift(r);
}

// 은하수 띠가 놓인 평면의 수직 방향(단위 벡터). 띠의 중심선은 이 방향과 직각인 큰 원이다.
export function milkyWayNormal(tiltDeg, azimuthDeg) {
  const tilt = (tiltDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  return [
    Math.sin(tilt) * Math.cos(azimuth),
    Math.cos(tilt),
    Math.sin(tilt) * Math.sin(azimuth),
  ];
}

// 관측자는 블랙홀을 바라본다. elevation은 원반 면(xz 평면)에서 위로 올라간 각도,
// azimuth는 위(y)축을 중심으로 돈 각도.
// lookYaw는 고개를 오른쪽으로, lookPitch는 위로 돌린 각도(0이면 블랙홀을 똑바로 봄).
export function cameraBasis(
  elevationRad,
  distance,
  azimuthRad = 0,
  lookYawRad = 0,
  lookPitchRad = 0
) {
  const position = [
    distance * Math.cos(elevationRad) * Math.cos(azimuthRad),
    distance * Math.sin(elevationRad),
    distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
  ];
  const toCenter = normalize(scale(position, -1));
  const baseRight = normalize(cross(toCenter, [0, 1, 0]));
  const baseUp = cross(baseRight, toCenter);

  const cosYaw = Math.cos(lookYawRad);
  const sinYaw = Math.sin(lookYawRad);
  const yawedForward = add(scale(toCenter, cosYaw), scale(baseRight, sinYaw));
  const right = add(scale(baseRight, cosYaw), scale(toCenter, -sinYaw));

  const cosPitch = Math.cos(lookPitchRad);
  const sinPitch = Math.sin(lookPitchRad);
  const forward = add(scale(yawedForward, cosPitch), scale(baseUp, sinPitch));
  const up = add(scale(baseUp, cosPitch), scale(yawedForward, -sinPitch));
  return { position, forward, right, up };
}
