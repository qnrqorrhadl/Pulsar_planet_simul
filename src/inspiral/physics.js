// 두 별이 중력파를 내며 에너지를 잃고 다가가는 과정(피터스 공식, 원 궤도 근사).
// 길이는 km. 질량은 길이로 바꿔서(G·M/c², 태양 질량 1개 ≈ 1.4766 km) 쓰면 식이 간단해진다.
//   da/d(ct) = -(64/5) m1 m2 (m1 + m2) / a³
// 이 식은 합쳐지기 직전(별이 맞닿기 전)까지만 맞는다. 합쳐지는 순간의 물리는 계산하지 않는다.

export const LIGHT_KM_PER_S = 299792.458;
export const SOLAR_MASS_KM = 1.476625;

const massKm = (solarMasses) => solarMasses * SOLAR_MASS_KM;

// β = (64/5) m1 m2 (m1 + m2) [km³]
export function beta(mass1, mass2) {
  const m1 = massKm(mass1);
  const m2 = massKm(mass2);
  return (64 / 5) * m1 * m2 * (m1 + m2);
}

// 거리가 a0에서 0이 될 때까지 걸리는 이론상 시간 [초]. 실제로는 맞닿는 거리에서 끝난다.
export function coalescenceTime(mass1, mass2, startKm) {
  return startKm ** 4 / (4 * beta(mass1, mass2)) / LIGHT_KM_PER_S;
}

// 시작 거리에서 맞닿는 거리까지 걸리는 시간 [초]
export function timeToContact(mass1, mass2, startKm, contactKm) {
  const full = coalescenceTime(mass1, mass2, startKm);
  return full * (1 - (contactKm / startKm) ** 4);
}

// t초 뒤 두 별 사이 거리 [km]
export function separationAt(mass1, mass2, startKm, t) {
  const full = coalescenceTime(mass1, mass2, startKm);
  return startKm * Math.max(0, 1 - t / full) ** 0.25;
}

// 거리 a에서 공전 각속도 [rad/s]
export function orbitalOmega(mass1, mass2, a) {
  const total = massKm(mass1 + mass2);
  return LIGHT_KM_PER_S * Math.sqrt(total / a ** 3);
}

// 시작부터 t초 동안 돈 각도 [rad]. 각속도를 시간으로 적분한 닫힌 식.
export function orbitalPhaseAt(mass1, mass2, startKm, t) {
  const full = coalescenceTime(mass1, mass2, startKm);
  const omega0 = orbitalOmega(mass1, mass2, startKm);
  return (8 / 5) * omega0 * full * (1 - Math.max(0, 1 - t / full) ** (5 / 8));
}

// 돈 각도가 phase일 때의 두 별 사이 거리 [km]. 시간 식 두 개를 합쳐서 얻는다: a = a0 (1 - φ/K)^(2/5), K = (8/5)·Ω0·τ.
// 지나온 궤적을 각도 간격이 일정하게(프레임 속도와 무관하게) 그릴 때 쓴다.
export function separationAtPhase(mass1, mass2, startKm, phase) {
  const full = coalescenceTime(mass1, mass2, startKm);
  const k = (8 / 5) * orbitalOmega(mass1, mass2, startKm) * full;
  return startKm * Math.max(0, 1 - phase / k) ** 0.4;
}

// 중력파는 공전 주파수의 두 배로 나온다. f = Ω / π
export const gravitationalWaveHz = (omega) => omega / Math.PI;

// 서로에 대한 공전 속도(광속 대비)
export const relativeSpeed = (omega, a) => (omega * a) / LIGHT_KM_PER_S;

// 무게중심이 원점. 무거운 별일수록 중심에 가깝다. phase는 공전 각도.
export function starPositions(mass1, mass2, a, phase) {
  const total = mass1 + mass2;
  const dx = Math.cos(phase);
  const dz = Math.sin(phase);
  const share1 = mass2 / total;
  const share2 = mass1 / total;
  return {
    a: [-dx * a * share1, 0, -dz * a * share1],
    b: [dx * a * share2, 0, dz * a * share2],
  };
}

// 시간 0..끝 사이를 count 구간으로 나눠, 각 시점의 중력파 주파수 [Hz]
export function frequencyCurve(mass1, mass2, startKm, contactKm, count) {
  const end = timeToContact(mass1, mass2, startKm, contactKm);
  const values = new Array(count + 1);
  for (let i = 0; i <= count; i++) {
    const a = separationAt(mass1, mass2, startKm, (end * i) / count);
    values[i] = gravitationalWaveHz(orbitalOmega(mass1, mass2, a));
  }
  return values;
}
