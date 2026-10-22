// 은하 충돌의 순수 계산 (DOM·three 모름). 은하 중심 둘은 서로 끌어당기고, 원반 알갱이(별)는 두 중심의 중력만 받는다
// (알갱이끼리는 힘이 없음 = Toomre & Toomre 식 제한 계산). 곱셈 걸음 적분(leapfrog).

// 포물선 궤도의 상대 위치와 속도. 반통경 p = 2·rp, 총 질량 mu. 들어오는 쪽(ν < 0)에서 시작한다.
export function relativeParabola(periapsis, distance, mu) {
  const nu = -Math.acos(Math.min(Math.max((2 * periapsis) / distance - 1, -1), 1));
  const radial = Math.sqrt(mu / (2 * periapsis)) * Math.sin(nu);
  const tangential = Math.sqrt(2 * mu * periapsis) / distance;
  const c = Math.cos(nu);
  const s = Math.sin(nu);
  return {
    position: [distance * c, distance * s],
    velocity: [radial * c - tangential * s, radial * s + tangential * c],
  };
}

// 완화된 점질량의 원 궤도 속도
export function circularSpeed(radius, mass, softening) {
  return Math.sqrt((mass * radius * radius) / Math.pow(radius * radius + softening * softening, 1.5));
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

// 원반 하나를 만든다: 중심 위치·속도에 더하고, x축을 기준으로 tilt만큼 기울인다.
function fillDisk(out, from, to, { mass, radius, tilt, center, velocity, random, physics }) {
  const scale = radius / physics.diskScaleDivisor;
  const tailCut = 1 - Math.exp(-radius / scale);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  for (let i = from; i < to; i++) {
    let r;
    do {
      r = -scale * Math.log(1 - random() * tailCut);
    } while (r < physics.innerRadius * radius);
    const phi = random() * 2 * Math.PI;
    const speed = circularSpeed(r, mass, physics.softening);
    const x = r * Math.cos(phi);
    const y = r * Math.sin(phi);
    const z = gaussian(random) * physics.thickness * radius;
    const vx = -speed * Math.sin(phi);
    const vy = speed * Math.cos(phi);
    const k = i * 3;
    out.pos[k] = center[0] + x;
    out.pos[k + 1] = center[1] + y * cosT - z * sinT;
    out.pos[k + 2] = center[2] + y * sinT + z * cosT;
    out.vel[k] = velocity[0] + vx;
    out.vel[k + 1] = velocity[1] + vy * cosT;
    out.vel[k + 2] = velocity[2] + vy * sinT;
  }
}

export function buildEncounter({ count, massRatio, periapsis, tiltDeg, seed, physics }) {
  const random = seededRandom(seed);
  const m = [1, massRatio];
  const mu = m[0] + m[1];
  const rel = relativeParabola(periapsis, physics.startDistance, mu);
  const share = [-m[1] / mu, m[0] / mu];
  const centers = {
    mass: m,
    pos: share.map((f) => [rel.position[0] * f, rel.position[1] * f, 0]),
    vel: share.map((f) => [rel.velocity[0] * f, rel.velocity[1] * f, 0]),
  };
  const n1 = Math.round((count * m[0]) / mu);
  const radii = [1, Math.pow(massRatio, physics.radiusExponent)];
  const tilts = [0, (tiltDeg * Math.PI) / 180];
  const encounter = {
    count,
    split: n1,
    time: 0,
    physics,
    centers,
    periapsis,
    pos: new Float64Array(count * 3),
    vel: new Float64Array(count * 3),
    random,
    mergedAt: null,
  };
  const ranges = [
    [0, n1],
    [n1, count],
  ];
  for (let g = 0; g < 2; g++) {
    fillDisk(encounter, ranges[g][0], ranges[g][1], {
      mass: m[g],
      radius: radii[g],
      tilt: tilts[g],
      center: centers.pos[g],
      velocity: centers.vel[g],
      random,
      physics,
    });
  }
  return encounter;
}

// 합쳐진 순간을 기록한다. 이후부터 별들이 무작위로 흔들려 둥글게 자리 잡는다.
export function markMerged(encounter) {
  if (encounter.mergedAt === null) encounter.mergedAt = encounter.time;
}

function relax(encounter, h) {
  if (encounter.mergedAt === null) return;
  const { heating, decayTime } = encounter.physics.relaxation;
  if (heating <= 0) return;
  const sigma = heating * Math.exp(-(encounter.time - encounter.mergedAt) / decayTime) * Math.sqrt(h) * Math.sqrt(12);
  const { vel, count, random } = encounter;
  for (let i = 0; i < count * 3; i++) vel[i] += (random() - 0.5) * sigma;
}

export const separation = (encounter) => {
  const { pos } = encounter.centers;
  return Math.hypot(pos[0][0] - pos[1][0], pos[0][1] - pos[1][1], pos[0][2] - pos[1][2]);
};

// 중심 둘이 서로에게, 알갱이가 두 중심에게서 받는 가속도를 곱셈 걸음(kick-drift-kick)으로 한 걸음 나아간다.
export function step(encounter, h) {
  const { centers, pos, vel, count } = encounter;
  const eps2 = encounter.physics.softening ** 2;
  const [c1, c2] = centers.pos;
  const [m1, m2] = centers.mass;
  const centerEps2 = encounter.physics.centerSoftening ** 2;
  const acceleration = (center, other, otherMass) => {
    const dx = other[0] - center[0];
    const dy = other[1] - center[1];
    const dz = other[2] - center[2];
    const k = otherMass / Math.pow(dx * dx + dy * dy + dz * dz + centerEps2, 1.5);
    return [dx * k, dy * k, dz * k];
  };
  const kick = (dt) => {
    const a1 = acceleration(c1, c2, m2);
    const a2 = acceleration(c2, c1, m1);
    for (let d = 0; d < 3; d++) {
      centers.vel[0][d] += a1[d] * dt;
      centers.vel[1][d] += a2[d] * dt;
    }
    // 동적 마찰 근사: 상대 속도 w를 줄이되 운동량은 보존(Δv1 = +m2/μ·γw, Δv2 = −m1/μ·γw)
    const { strength, range } = encounter.physics.friction;
    if (strength > 0) {
      const gap = Math.hypot(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]);
      const gamma = strength * Math.exp(-((gap / range) ** 2));
      const total = m1 + m2;
      for (let d = 0; d < 3; d++) {
        const w = centers.vel[1][d] - centers.vel[0][d];
        centers.vel[0][d] += (m2 / total) * gamma * w * dt;
        centers.vel[1][d] -= (m1 / total) * gamma * w * dt;
      }
    }
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let g = 0; g < 2; g++) {
        const c = centers.pos[g];
        const dx = c[0] - pos[k];
        const dy = c[1] - pos[k + 1];
        const dz = c[2] - pos[k + 2];
        const f = centers.mass[g] / Math.pow(dx * dx + dy * dy + dz * dz + eps2, 1.5);
        ax += dx * f;
        ay += dy * f;
        az += dz * f;
      }
      vel[k] += ax * dt;
      vel[k + 1] += ay * dt;
      vel[k + 2] += az * dt;
    }
  };
  kick(h / 2);
  for (let d = 0; d < 3; d++) {
    c1[d] += centers.vel[0][d] * h;
    c2[d] += centers.vel[1][d] * h;
  }
  for (let i = 0; i < count * 3; i++) pos[i] += vel[i] * h;
  kick(h / 2);
  encounter.time += h;
  relax(encounter, h);
}

// 가장 가까운 점을 지나는 시각(포물선): t = sqrt(2 rp³ / mu) · (d + d³/3), d = sqrt(r/rp − 1)
export function timeToPeriapsis(periapsis, distance, mu) {
  const d = Math.sqrt(Math.max(distance / periapsis - 1, 0));
  return Math.sqrt((2 * periapsis ** 3) / mu) * (d + (d * d * d) / 3);
}
