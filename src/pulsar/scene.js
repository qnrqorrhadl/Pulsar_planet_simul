import { cssVar } from '../shared/css.js';
import { clamp } from '../shared/math.js';
import { createOrbitCamera } from '../shared/orbit-camera.js';
import { makeBackgroundStars, makeGlowSprite } from '../shared/sky3d.js';
import { observerDir, degToRad } from './physics.js';

const THREE = window.THREE;

// 별 표면: 가운데는 흰빛, 가장자리는 푸르고 어둡게(림 다크닝), 은은한 얼룩은 별과 함께 돈다.
const STAR_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vPos = position;
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAGMENT = `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uLimbPower;
  uniform float uMottle;
  uniform float uScaleLarge;
  uniform float uScaleSmall;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float n = noise(vPos * uScaleLarge) * 0.6 + noise(vPos * uScaleSmall) * 0.4;
    vec3 color = mix(uEdge, uCore, pow(mu, uLimbPower));
    color *= mix(1.0, 0.75 + 0.5 * n, uMottle);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function makeStarMesh(config) {
  const { star, starRadius } = config.visual;
  return new THREE.Mesh(
    new THREE.SphereGeometry(starRadius, 64, 48),
    new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: {
        uCore: { value: new THREE.Color(cssVar('--star-core')) },
        uEdge: { value: new THREE.Color(cssVar('--star-edge')) },
        uLimbPower: { value: star.limbPower },
        uMottle: { value: star.mottle },
        uScaleLarge: { value: star.noiseScaleLarge },
        uScaleSmall: { value: star.noiseScaleSmall },
      },
    })
  );
}

// 빛줄기: 별에서 멀어질수록, 그리고 가장자리로 갈수록 옅어진다.
const BEAM_VERTEX = `
  uniform float uLength;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vAlong = position.y / uLength;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFalloff;
  uniform float uEdge;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float along = pow(clamp(1.0 - vAlong, 0.0, 1.0), uFalloff);
    float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), uEdge);
    gl_FragColor = vec4(uColor, uOpacity * along * edge);
  }
`;

function makeBeam(config, colorCss, direction) {
  const length = config.visual.beamLength;
  const radius = length * Math.tan(degToRad(config.beamHalfWidthDeg));
  const geometry = new THREE.ConeGeometry(radius, length, 48, 1, true);
  geometry.translate(0, -length / 2, 0);
  geometry.rotateX(Math.PI);
  const beam = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: {
        uLength: { value: length },
        uColor: { value: new THREE.Color(colorCss) },
        uOpacity: { value: config.visual.beam.opacity },
        uFalloff: { value: config.visual.beam.falloff },
        uEdge: { value: config.visual.beam.edgeSoftness },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  beam.position.y = direction * config.visual.starRadius;
  if (direction < 0) beam.rotation.x = Math.PI;
  return beam;
}

// 쌍극자 자기장 곡선: r = L * sin²θ. 별 표면에서 시작해 반대쪽 극으로 돌아온다.
function makeFieldLines(config, colorCss) {
  const { count, shells, segments, opacity } = config.visual.fieldLines;
  const radius = config.visual.starRadius;
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorCss),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const group = new THREE.Group();
  for (const shell of shells) {
    const startAngle = Math.asin(Math.sqrt(radius / shell));
    for (let k = 0; k < count; k++) {
      const azimuth = (k * 2 * Math.PI) / count;
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const theta = startAngle + ((Math.PI - 2 * startAngle) * i) / segments;
        const r = shell * Math.sin(theta) ** 2;
        points.push(
          new THREE.Vector3(
            r * Math.sin(theta) * Math.cos(azimuth),
            r * Math.cos(theta),
            r * Math.sin(theta) * Math.sin(azimuth)
          )
        );
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  }
  return group;
}

export function createScene(canvas, config) {
  const v = config.visual;
  const beamCss = cssVar('--beam');
  const observedCss = cssVar('--observed');
  const axisCss = cssVar('--axis');
  const glowCss = cssVar('--star-glow');
  const hotspotCss = cssVar('--hotspot');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color(cssVar('--bg')));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  scene.add(
    makeBackgroundStars(
      { count: v.backgroundStars, radius: v.backgroundStarRadius, seed: v.backgroundSeed },
      axisCss
    )
  );

  // 고정된 자전축
  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -v.axisLength, 0),
    new THREE.Vector3(0, v.axisLength, 0),
  ]);
  const axisLine = new THREE.Line(
    axisGeometry,
    new THREE.LineDashedMaterial({
      color: new THREE.Color(axisCss),
      dashSize: 0.12,
      gapSize: 0.1,
    })
  );
  axisLine.computeLineDistances();
  scene.add(axisLine);

  // 자전하는 별: 발광 표면, 기울어진 자기축, 자기극 핫스팟, 자기장 곡선, 양쪽 빛줄기
  const starGroup = new THREE.Group();
  scene.add(starGroup);
  starGroup.add(makeStarMesh(config));

  for (const { scale, opacity } of v.corona) {
    const corona = makeGlowSprite(glowCss, opacity);
    corona.scale.setScalar(v.starRadius * scale);
    scene.add(corona);
  }

  const tiltGroup = new THREE.Group();
  starGroup.add(tiltGroup);
  const beamColor = new THREE.Color(beamCss);
  tiltGroup.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, v.axisLength * 2, 8),
      new THREE.MeshBasicMaterial({ color: beamColor })
    )
  );
  tiltGroup.add(makeFieldLines(config, beamCss));
  for (const direction of [1, -1]) {
    const poleY = direction * (v.starRadius + 0.01);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(v.pointHaloRadius, 16, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hotspotCss) })
    );
    core.position.y = poleY;
    tiltGroup.add(core);

    const hotspot = makeGlowSprite(hotspotCss, v.star.hotspotGlowOpacity);
    hotspot.scale.setScalar(v.star.hotspotGlowScale);
    hotspot.position.y = poleY;
    tiltGroup.add(hotspot);

    tiltGroup.add(makeBeam(config, beamCss, direction));
  }

  // 지구 방향: 화살표와 끝의 깜빡이는 표시
  const observedColor = new THREE.Color(observedCss);
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    v.observerLength,
    observedColor,
    0.35,
    0.18
  );
  scene.add(arrow);
  const flashCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 16),
    new THREE.MeshBasicMaterial({ color: observedColor, transparent: true })
  );
  const flashGlow = makeGlowSprite(observedCss, 1);
  scene.add(flashCore, flashGlow);

  // 시점
  let followObserver = false;
  const viewListeners = [];
  const notifyView = () => viewListeners.forEach((listener) => listener(followObserver));
  const orbit = createOrbitCamera(canvas, camera, v, () => {
    if (followObserver) {
      followObserver = false;
      notifyView();
    }
  });

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    onViewChange: (listener) => viewListeners.push(listener),
    isFollowingObserver: () => followObserver,
    setFollowObserver(value) {
      followObserver = value;
      notifyView();
    },
    update({ phase, tiltRad, observerRad, intensity }) {
      starGroup.rotation.y = -phase;
      tiltGroup.rotation.z = -tiltRad;

      const [x, y, z] = observerDir(observerRad);
      const direction = new THREE.Vector3(x, y, z);
      arrow.setDirection(direction);
      const tip = direction.clone().multiplyScalar(v.observerLength + 0.25);
      flashCore.position.copy(tip);
      flashGlow.position.copy(tip);
      flashCore.material.opacity = 0.25 + 0.75 * intensity;
      flashCore.scale.setScalar(1 + 0.8 * intensity);
      flashGlow.material.opacity = intensity;
      flashGlow.scale.setScalar(0.6 + 2.2 * intensity);

      if (followObserver) orbit.setView(Math.atan2(x, z), Math.asin(clamp(y, -1, 1)));
      orbit.place();
      renderer.render(scene, camera);
    },
  };
}
