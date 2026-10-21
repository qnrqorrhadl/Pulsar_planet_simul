import { cssVar } from '../shared/css.js';
import { clamp, degToRad } from '../shared/math.js';
import { makeBackgroundStars, makeGlowSprite } from '../shared/sky3d.js';
import { observerDir, positionsAt, relativeFromEccentric, starPositions } from './physics.js';

const THREE = window.THREE;

// 별 표면: 가운데는 밝고 가장자리는 어둡게(림 다크닝)
const STAR_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAGMENT = `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uLimbPower;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    gl_FragColor = vec4(mix(uEdge, uCore, pow(mu, uLimbPower)), 1.0);
  }
`;

function makeStar(starConfig, visual) {
  const edgeCss = cssVar(starConfig.edgeToken);
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(starConfig.radius, 64, 48),
    new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: {
        uCore: { value: new THREE.Color(cssVar(starConfig.coreToken)) },
        uEdge: { value: new THREE.Color(edgeCss) },
        uLimbPower: { value: visual.limbPower },
      },
    })
  );
  group.add(body);
  for (const { scale, opacity } of visual.corona) {
    const corona = makeGlowSprite(edgeCss, opacity);
    corona.scale.setScalar(starConfig.radius * scale);
    group.add(corona);
  }
  return group;
}

function makeOrbitLine(colorCss, opacity, segments) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array((segments + 1) * 3), 3)
  );
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(colorCss),
      transparent: true,
      opacity,
      depthWrite: false,
    })
  );
}

export function createBinaryScene(canvas, config) {
  const v = config.visual;
  const colors = {
    bg: cssVar('--bg'),
    axis: cssVar('--axis'),
    observed: cssVar('--observed'),
    orbitA: cssVar(config.stars.a.edgeToken),
    orbitB: cssVar(config.stars.b.edgeToken),
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color(colors.bg));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  scene.add(
    makeBackgroundStars(
      { count: v.backgroundStars, radius: v.backgroundStarRadius, seed: v.backgroundSeed },
      colors.axis
    )
  );

  const starA = makeStar(config.stars.a, v);
  const starB = makeStar(config.stars.b, v);
  scene.add(starA, starB);

  // 무게중심 표시와 두 별의 궤도 자취
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.axis) })
  );
  scene.add(center);
  const orbitA = makeOrbitLine(colors.orbitA, v.orbitOpacity, v.orbitSegments);
  const orbitB = makeOrbitLine(colors.orbitB, v.orbitOpacity, v.orbitSegments);
  scene.add(orbitA, orbitB);
  let orbitKey = '';

  function rebuildOrbits(params) {
    const key = `${params.massRatio}|${params.separation}|${params.eccentricity}|${params.periastronRad}`;
    if (key === orbitKey) return;
    orbitKey = key;
    const attrA = orbitA.geometry.attributes.position;
    const attrB = orbitB.geometry.attributes.position;
    for (let i = 0; i <= v.orbitSegments; i++) {
      const relative = relativeFromEccentric(
        (2 * Math.PI * i) / v.orbitSegments,
        params.eccentricity,
        params.separation,
        params.periastronRad
      );
      const { a, b } = starPositions(relative, params.massRatio);
      attrA.setXYZ(i, ...a);
      attrB.setXYZ(i, ...b);
    }
    attrA.needsUpdate = true;
    attrB.needsUpdate = true;
  }

  // 지구 방향: 화살표와 끝의 표시(밝기에 따라 켜짐)
  const observedColor = new THREE.Color(colors.observed);
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    v.observerLength,
    observedColor,
    0.6,
    0.3
  );
  scene.add(arrow);
  const flashCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 16),
    new THREE.MeshBasicMaterial({ color: observedColor, transparent: true })
  );
  const flashGlow = makeGlowSprite(colors.observed, 1);
  scene.add(flashCore, flashGlow);

  // 시점
  let yaw = degToRad(v.defaultYawDeg);
  let pitch = degToRad(v.defaultPitchDeg);
  let distance = v.cameraDistance;
  let followObserver = false;
  const viewListeners = [];
  const notifyView = () => viewListeners.forEach((listener) => listener(followObserver));

  function placeCamera() {
    const maxPitch = degToRad(v.maxPitchDeg);
    pitch = clamp(pitch, -maxPitch, maxPitch);
    camera.position.set(
      distance * Math.cos(pitch) * Math.sin(yaw),
      distance * Math.sin(pitch),
      distance * Math.cos(pitch) * Math.cos(yaw)
    );
    camera.lookAt(0, 0, 0);
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * v.dragSensitivity;
    pitch += (event.clientY - lastY) * v.dragSensitivity;
    lastX = event.clientX;
    lastY = event.clientY;
    if (followObserver) {
      followObserver = false;
      notifyView();
    }
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      distance = clamp(
        distance * (1 + event.deltaY * v.zoomSensitivity),
        v.cameraDistanceMin,
        v.cameraDistanceMax
      );
    },
    { passive: false }
  );

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
    update({ params, meanAnomaly, flux }) {
      rebuildOrbits(params);
      const { a, b } = positionsAt(params, meanAnomaly);
      starA.position.set(...a);
      starB.position.set(...b);

      const [x, y, z] = observerDir(params.inclinationRad);
      const direction = new THREE.Vector3(x, y, z);
      arrow.setDirection(direction);
      const tip = direction.clone().multiplyScalar(v.observerLength + 0.4);
      flashCore.position.copy(tip);
      flashGlow.position.copy(tip);
      flashCore.material.opacity = 0.25 + 0.75 * flux;
      flashCore.scale.setScalar(0.6 + 0.6 * flux);
      flashGlow.material.opacity = flux;
      flashGlow.scale.setScalar(0.6 + 1.2 * flux);

      if (followObserver) {
        yaw = Math.atan2(x, z);
        pitch = Math.asin(clamp(y, -1, 1));
      }
      placeCamera();
      renderer.render(scene, camera);
    },
  };
}
