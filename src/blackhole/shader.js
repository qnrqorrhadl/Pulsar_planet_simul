import { SCHWARZSCHILD_RADIUS, milkyWayNormal } from './physics.js';

const glFloat = (value) => value.toFixed(4);
const glVec3 = (values) => `vec3(${values.map(glFloat).join(', ')})`;

// 화면 전체를 덮는 사각형. 정점은 그대로 화면 좌표로 쓴다.
export const BLACKHOLE_VERTEX = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 화면의 모든 점에서 빛을 거꾸로 추적한다. 걸음 규칙은 physics.js의 traceRay와 같고,
// 도플러와 중력 적색편이는 physics.js의 observedShift와 같은 식이다.
export function buildBlackHoleFragment(tracing, disk, stars, jet, cloud, precessing) {
  return `
  uniform vec2 uResolution;
  uniform vec3 uCamPos;
  uniform vec3 uCamForward;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  uniform float uTanHalfFov;
  uniform float uTanHalfTrue;
  uniform float uEscape;
  uniform float uInner;
  uniform float uOuter;
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uCool;
  uniform vec3 uBackground;
  uniform float uDiskOn;
  uniform float uCloudOn;
  uniform float uJetMode;
  uniform vec3 uJetColor;
  uniform vec3 uJetBlue;
  uniform vec3 uJetRed;

  const int MAX_STEPS = ${tracing.maxSteps};
  const float STEP_SCALE = ${glFloat(tracing.stepScale)};
  const float MIN_STEP = ${glFloat(tracing.minStep)};
  const float MAX_STEP = ${glFloat(tracing.maxStep)};
  const float HORIZON = ${glFloat(SCHWARZSCHILD_RADIUS)};
  const float DISK_OPACITY = ${glFloat(disk.opacity)};
  const float SWIRL_ARMS = ${glFloat(disk.swirlArms)};
  const float SWIRL_TIGHTNESS = ${glFloat(disk.swirlTightness)};
  const float SWIRL_RATE = ${glFloat(disk.swirlRate)};
  const float EXPOSURE = ${glFloat(disk.exposure)};
  const float BRIGHT_BASE = ${glFloat(disk.brightnessBase)};
  const float BRIGHT_HEAT = ${glFloat(disk.brightnessHeat)};
  const float HEAT_FALLOFF = ${glFloat(disk.heatFalloff)};
  const float BEAMING_POWER = ${glFloat(disk.beamingPower)};
  const float JET_START = ${glFloat(jet.startHeight)};
  const float JET_BASE_WIDTH = ${glFloat(jet.baseWidth)};
  const float JET_SPREAD = ${glFloat(jet.spread)};
  const float JET_LENGTH = ${glFloat(jet.length)};
  const float JET_GAIN = ${glFloat(jet.gain)};
  const float JET_SPEED = ${glFloat(jet.speed)};
  const float JET_BEAMING = ${glFloat(jet.beamingPower)};
  const float JET_KNOT_SPACING = ${glFloat(jet.knotSpacing)};
  const float JET_KNOT_RATE = ${glFloat(jet.knotRate)};
  const float JET_KNOT_SHARP = ${glFloat(jet.knotSharpness)};
  const float JET_KNOT_FLOOR = ${glFloat(jet.knotFloor)};
  const float CLOUD_INNER_A = ${glFloat(cloud.innerStart)};
  const float CLOUD_INNER_B = ${glFloat(cloud.innerEnd)};
  const float CLOUD_OUTER_A = ${glFloat(cloud.outerStart)};
  const float CLOUD_OUTER_B = ${glFloat(cloud.outerEnd)};
  const float CLOUD_HEIGHT = ${glFloat(cloud.heightRatio)};
  const float CLOUD_FALLOFF = ${glFloat(cloud.falloff)};
  const float CLOUD_GAIN = ${glFloat(cloud.gain)};
  const float CLOUD_SPEED = ${glFloat(cloud.speedScale)};
  const float CLOUD_BEAMING = ${glFloat(cloud.beamingPower)};

  const float PREC_START = ${glFloat(precessing.startRadius)};
  const float PREC_BASE_WIDTH = ${glFloat(precessing.baseWidth)};
  const float PREC_SPREAD = ${glFloat(precessing.spread)};
  const float PREC_LENGTH = ${glFloat(precessing.length)};
  const float PREC_GAIN = ${glFloat(precessing.gain)};
  const float PREC_SPEED = ${glFloat(precessing.speed)};
  const float PREC_BEAMING = ${glFloat(precessing.beamingPower)};
  const float PREC_KNOT_SPACING = ${glFloat(precessing.knotSpacing)};
  const float PREC_KNOT_RATE = ${glFloat(precessing.knotRate)};
  const float PREC_KNOT_SHARP = ${glFloat(precessing.knotSharpness)};
  const float PREC_KNOT_FLOOR = ${glFloat(precessing.knotFloor)};
  const float PREC_RATE = ${glFloat(precessing.rate)};
  const float PREC_PITCH = ${glFloat(precessing.pitch)};
  const float PREC_SIN = ${glFloat(Math.sin((precessing.coneDeg * Math.PI) / 180))};
  const float PREC_COS = ${glFloat(Math.cos((precessing.coneDeg * Math.PI) / 180))};
  const vec3 BLUE_TINT = ${glVec3(disk.blueTint)};
  const vec3 RED_TINT = ${glVec3(disk.redTint)};

  const float STAR_SCALE = ${glFloat(stars.scale)};
  const float STAR_DENSITY = ${glFloat(stars.density)};
  const float STAR_MIN_SIZE = ${glFloat(stars.minSize)};
  const float STAR_MAX_SIZE = ${glFloat(stars.maxSize)};
  const float STAR_BRIGHTNESS = ${glFloat(stars.brightness)};
  const vec3 STAR_WARM = ${glVec3(stars.warm)};
  const vec3 STAR_COOL = ${glVec3(stars.cool)};

  const vec3 BAND_NORMAL = ${glVec3(milkyWayNormal(stars.milkyWay.tiltDeg, stars.milkyWay.azimuthDeg))};
  const float BAND_WIDTH = ${glFloat(stars.milkyWay.bandWidth)};
  const float BAND_BRIGHTNESS = ${glFloat(stars.milkyWay.brightness)};
  const float BAND_NOISE_LARGE = ${glFloat(stars.milkyWay.noiseScaleLarge)};
  const float BAND_NOISE_SMALL = ${glFloat(stars.milkyWay.noiseScaleSmall)};
  const float DUST_WIDTH = ${glFloat(stars.milkyWay.dustWidth)};
  const float DUST_STRENGTH = ${glFloat(stars.milkyWay.dustStrength)};
  const vec3 BAND_WARM = ${glVec3(stars.milkyWay.warm)};
  const vec3 BAND_COOL = ${glVec3(stars.milkyWay.cool)};

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  // 하늘의 별. 빛이 휘어서 도착한 방향(dir)에 따라 별을 찍으므로 렌즈처럼 휘어 보인다.
  vec3 starfield(vec3 dir) {
    vec3 p = dir * STAR_SCALE;
    vec3 cell = floor(p);
    vec3 local = fract(p) - 0.5;
    if (hash13(cell) > STAR_DENSITY) return vec3(0.0);
    vec3 jitter = (hash33(cell) - 0.5) * 0.6;
    float size = mix(STAR_MIN_SIZE, STAR_MAX_SIZE, hash13(cell + 17.0));
    float glow = smoothstep(size, 0.0, length(local - jitter));
    vec3 tint = mix(STAR_WARM, STAR_COOL, hash13(cell + 41.0));
    return tint * glow * STAR_BRIGHTNESS * (0.4 + hash13(cell + 5.0));
  }

  float valueNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  // 은하수 띠: 하늘의 한 큰 원 둘레에 퍼진 흐린 빛. 가운데는 따뜻하고 바깥은 푸르며, 중심선에 어두운 먼지 줄이 있다.
  // 별처럼 빛이 휜 방향(dir)으로 찍어서, 블랙홀 둘레에서 둥근 호로 휘어 보인다.
  vec3 milkyWay(vec3 dir) {
    float lat = dot(dir, BAND_NORMAL);
    float body = exp(-(lat * lat) / (BAND_WIDTH * BAND_WIDTH));
    float dust = exp(-(lat * lat) / (DUST_WIDTH * DUST_WIDTH));
    float clouds = valueNoise(dir * BAND_NOISE_LARGE) * 0.65 + valueNoise(dir * BAND_NOISE_SMALL) * 0.35;
    float density = body * (0.35 + 0.9 * clouds) * (1.0 - DUST_STRENGTH * dust * (0.4 + clouds));
    return mix(BAND_COOL, BAND_WARM, body) * max(density, 0.0) * BAND_BRIGHTNESS;
  }

  // 원반의 한 점: 안쪽일수록 뜨겁고 밝고, 바깥은 주황. 소용돌이 무늬가 안쪽일수록 빨리 돈다.
  // 물질은 원반을 따라 돌고 있어서, 다가오는 쪽은 밝고 푸르게, 멀어지는 쪽은 어둡고 붉게 보인다.
  vec4 diskSample(vec3 hit, float radius, vec3 toObserver) {
    float t = (radius - uInner) / (uOuter - uInner);
    float heat = pow(1.0 - t, HEAT_FALLOFF);
    float angle = atan(hit.z, hit.x);
    float swirl = 0.5 + 0.5 * sin(
      SWIRL_ARMS * angle + SWIRL_TIGHTNESS * radius - uTime * SWIRL_RATE * pow(radius, -1.5)
    );
    float brightness = (BRIGHT_BASE + BRIGHT_HEAT * heat) * (0.7 + 0.3 * swirl);

    vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
    float speed = sqrt(0.5 * HORIZON / (radius - HORIZON));
    float gamma = 1.0 / sqrt(1.0 - speed * speed);
    float doppler = 1.0 / (gamma * (1.0 - speed * dot(tangent, toObserver)));
    float shift = doppler * sqrt(1.0 - HORIZON / radius);

    vec3 base = mix(uCool, uHot, clamp(heat * shift, 0.0, 1.0));
    base *= mix(vec3(1.0), RED_TINT, clamp(1.0 - shift, 0.0, 1.0));
    base *= mix(vec3(1.0), BLUE_TINT, clamp(shift - 1.0, 0.0, 1.0));
    brightness *= pow(shift, BEAMING_POWER);

    float edge = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.8, 1.0, t));
    return vec4(base * brightness, DISK_OPACITY * edge);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
    vec3 velocity = normalize(
      uCamForward + 2.0 * uTanHalfFov * (uv.x * uCamRight + uv.y * uCamUp)
    );
    // 실제 카메라가 이보다 멀면(uTanHalfFov > uTanHalfTrue) 같은 화소의 실제 시선 방향은 중심 쪽으로 더 모여 있다.
    vec3 initial = velocity;
    vec3 initialTrue = normalize(
      uCamForward + 2.0 * uTanHalfTrue * (uv.x * uCamRight + uv.y * uCamUp)
    );
    vec3 position = uCamPos;
    vec3 angular = cross(position, velocity);
    float h2 = dot(angular, angular);

    vec3 color = vec3(0.0);
    float transmit = 1.0;
    bool escaped = false;

    for (int i = 0; i < MAX_STEPS; i++) {
      float r = length(position);
      float dt = clamp(STEP_SCALE * r, MIN_STEP, MAX_STEP);
      vec3 previous = position;
      velocity += -1.5 * h2 * position / (r * r * r * r * r) * dt;
      position += velocity * dt;

      float rNow = length(position);
      if (rNow < HORIZON) break;

      // 제트: 블랙홀 위아래 축을 따라 뿜는 가는 빛줄기. 빛이 지나는 길을 따라 조금씩 더한다(옅은 기체라 가리지 않는다).
      // 폭은 높이에 따라 조금 퍼지고, 세기는 멀수록 약해지며, 덩어리(매듭)들이 바깥으로 흘러간다. 관측자 쪽으로 오는 줄기가 더 밝다(도플러).
      if (uJetMode > 0.5 && uJetMode < 1.5) {
        float height = abs(position.y);
        if (height > JET_START) {
          float width = JET_BASE_WIDTH + JET_SPREAD * (height - JET_START);
          float across = dot(position.xz, position.xz) / (width * width);
          if (across < 9.0) {
            float fade = exp(-(height - JET_START) / JET_LENGTH) * (JET_BASE_WIDTH * JET_BASE_WIDTH) / (width * width);
            float knot = pow(0.5 + 0.5 * cos(6.2831853 * ((height - JET_START) / JET_KNOT_SPACING - uTime * JET_KNOT_RATE)), JET_KNOT_SHARP);
            fade *= JET_KNOT_FLOOR + (1.0 - JET_KNOT_FLOOR) * knot;
            vec3 flow = vec3(0.0, position.y >= 0.0 ? 1.0 : -1.0, 0.0);
            float jetGamma = 1.0 / sqrt(1.0 - JET_SPEED * JET_SPEED);
            float jetShift = 1.0 / (jetGamma * (1.0 - JET_SPEED * dot(flow, -normalize(velocity))));
            color += transmit * uJetColor * (exp(-across * across) * fade * pow(jetShift, JET_BEAMING) * JET_GAIN * dt);
          }
        }
      }

      // SS 433형 제트: 줄기가 축에서 비스듬히 나가고 그 축이 천천히 돈다(세차 운동). 같은 줄기 위의 물질은
      // 멀수록 더 일찍 나온 것이라 나선(코르크 마개 모양)을 그린다. 아래위 두 줄기가 서로 반대로 나간다.
      // 속도 0.26c의 도플러로 다가오는 쪽은 푸르고 밝게, 멀어지는 쪽은 붉고 어둡게 보인다.
      if (uJetMode > 1.5) {
        float away = length(position);
        if (away > PREC_START) {
          float phase = uTime * PREC_RATE - away * PREC_PITCH;
          vec3 axis = vec3(PREC_SIN * cos(phase), PREC_COS, PREC_SIN * sin(phase));
          vec3 flow = dot(position, axis) >= 0.0 ? axis : -axis;
          vec3 lateral = position - flow * dot(position, flow);
          float width = PREC_BASE_WIDTH + PREC_SPREAD * away;
          float across = dot(lateral, lateral) / (width * width);
          if (across < 9.0) {
            float fade = exp(-away / PREC_LENGTH) * (PREC_BASE_WIDTH * PREC_BASE_WIDTH) / (width * width);
            float knot = pow(0.5 + 0.5 * cos(6.2831853 * ((away - PREC_START) / PREC_KNOT_SPACING - uTime * PREC_KNOT_RATE)), PREC_KNOT_SHARP);
            fade *= PREC_KNOT_FLOOR + (1.0 - PREC_KNOT_FLOOR) * knot;
            float flowGamma = 1.0 / sqrt(1.0 - PREC_SPEED * PREC_SPEED);
            float flowShift = 1.0 / (flowGamma * (1.0 - PREC_SPEED * dot(flow, -normalize(velocity))));
            vec3 tint = mix(uJetRed, uJetBlue, clamp(0.5 + 3.0 * (flowShift - 1.0), 0.0, 1.0));
            color += transmit * tint * (exp(-across * across) * fade * pow(flowShift, PREC_BEAMING) * PREC_GAIN * dt);
          }
        }
      }

      // 도넛 모양 뜨거운 구름: 원반 면 둘레로 부풀어 오른 옅은 기체. 빛이 지나는 길마다 더한다.
      // 안쪽은 블랙홀 가까이까지, 두께는 중심에서 멀수록 두꺼워진다. 도는 방향 도플러로 한쪽이 훨씬 밝다.
      if (uCloudOn > 0.5) {
        float ringRadius = length(position.xz);
        float thick = CLOUD_HEIGHT * max(ringRadius, 1.5);
        float lift = position.y / thick;
        if (lift * lift < 9.0 && rNow < CLOUD_OUTER_B) {
          float radial = pow(max(ringRadius, 1.0), -CLOUD_FALLOFF)
            * smoothstep(CLOUD_INNER_A, CLOUD_INNER_B, rNow)
            * (1.0 - smoothstep(CLOUD_OUTER_A, CLOUD_OUTER_B, ringRadius));
          float cloudSpeed = min(CLOUD_SPEED * sqrt(0.5 * HORIZON / max(ringRadius - HORIZON, 0.6)), 0.6);
          vec3 around = normalize(vec3(-position.z, 0.0, position.x) + vec3(1e-4, 0.0, 0.0));
          float cloudGamma = 1.0 / sqrt(1.0 - cloudSpeed * cloudSpeed);
          float cloudShift = 1.0 / (cloudGamma * (1.0 - cloudSpeed * dot(around, -normalize(velocity))))
            * sqrt(max(1.0 - HORIZON / rNow, 0.0));
          vec3 glow = mix(uCool, uHot, clamp(0.35 + 0.6 * (cloudShift - 0.8), 0.0, 1.0));
          color += transmit * glow * (radial * exp(-0.5 * lift * lift) * pow(cloudShift, CLOUD_BEAMING) * CLOUD_GAIN * dt);
        }
      }

      // 원반 면(y = 0)을 지나는 순간
      if (uDiskOn > 0.5 && previous.y * position.y < 0.0) {
        float along = previous.y / (previous.y - position.y);
        vec3 hit = mix(previous, position, along);
        float radius = length(hit.xz);
        if (radius > uInner && radius < uOuter) {
          vec4 emit = diskSample(hit, radius, -normalize(velocity));
          color += transmit * emit.rgb * emit.a;
          transmit *= 1.0 - emit.a;
          if (transmit < 0.02) break;
        }
      }

      if (rNow > uEscape && dot(position, velocity) > 0.0) {
        escaped = true;
        break;
      }
    }

    color = vec3(1.0) - exp(-EXPOSURE * color);
    vec3 backdrop = vec3(0.0);
    if (escaped) {
      vec3 sky = normalize(velocity);
      // 빛이 휜 각도는 그대로 두고, 휘기 전 방향만 실제 시선으로 바꿔 하늘의 어느 곳이 보이는지 맞춘다.
      // (시야를 넓히지 않았으면 initialTrue == initial이라 sky가 그대로다.)
      vec3 turnAxis = cross(initial, sky);
      if (length(turnAxis) > 1e-6) {
        vec3 k = normalize(turnAxis);
        float turn = acos(clamp(dot(initial, sky), -1.0, 1.0));
        sky = normalize(
          initialTrue * cos(turn) + cross(k, initialTrue) * sin(turn)
          + k * dot(k, initialTrue) * (1.0 - cos(turn))
        );
      } else {
        sky = initialTrue;
      }
      backdrop = transmit * (uBackground + milkyWay(sky) + starfield(sky));
    }
    gl_FragColor = vec4(color + backdrop, 1.0);
  }
`;
}
