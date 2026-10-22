import { cssVar } from '../shared/css.js';
import { createOrbitCamera } from '../shared/orbit-camera.js';
import { makeBackgroundStars, makeGlowSprite, makeGlowTexture } from '../shared/sky3d.js';

const THREE = window.THREE;

// 궤도 평면(x, y) → 화면 3D: 평면을 바닥(x, z)에 눕히고 수직 방향을 위(y)로 쓴다.
const toWorld = (x, y, z) => [x, z, -y];

export function createGalaxyScene(canvas, config) {
  const v = config.visual;
  const colors = {
    bg: cssVar('--bg'),
    axis: cssVar('--axis'),
    a: new THREE.Color(cssVar('--gal-a')),
    b: new THREE.Color(cssVar('--gal-b')),
    core: cssVar('--gal-core'),
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color(colors.bg));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 600);
  scene.add(
    makeBackgroundStars(
      { count: v.backgroundStars, radius: v.backgroundStarRadius, seed: v.backgroundSeed },
      colors.axis
    )
  );

  const cores = [makeGlowSprite(colors.core, v.coreOpacity), makeGlowSprite(colors.core, v.coreOpacity)];
  scene.add(...cores);

  // 알갱이: 개수와 은하별 색은 처음 한 번 정하고, 위치만 매 프레임 바꾼다
  const count = config.particles.count;
  const positions = new Float32Array(count * 3);
  const particleColors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: v.pointSize,
      map: makeGlowTexture('#ffffff'),
      vertexColors: true,
      transparent: true,
      opacity: v.pointOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  points.frustumCulled = false;
  scene.add(points);

  const orbit = createOrbitCamera(canvas, camera, v);

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

  let paintedFor = null;
  function paint(encounter) {
    // 같은 계산 결과(은하 둘로 나뉜 알갱이)에는 같은 색을 쓰고, 밝기만 알갱이마다 조금씩 다르게
    let seed = 12345;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const base = i < encounter.split ? colors.a : colors.b;
      const level = v.brightnessMin + (v.brightnessMax - v.brightnessMin) * random();
      particleColors[i * 3] = base.r * level;
      particleColors[i * 3 + 1] = base.g * level;
      particleColors[i * 3 + 2] = base.b * level;
    }
    geometry.attributes.color.needsUpdate = true;
    paintedFor = encounter.split;
  }

  return {
    // encounter: physics.buildEncounter의 결과(위치가 계속 바뀜)
    update(encounter) {
      if (paintedFor !== encounter.split) paint(encounter);
      const { pos, centers } = encounter;
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        const world = toWorld(pos[k], pos[k + 1], pos[k + 2]);
        positions[k] = world[0];
        positions[k + 1] = world[1];
        positions[k + 2] = world[2];
      }
      geometry.attributes.position.needsUpdate = true;
      for (let g = 0; g < 2; g++) {
        const c = centers.pos[g];
        cores[g].position.set(...toWorld(c[0], c[1], c[2]));
        cores[g].scale.setScalar(v.coreScale * Math.sqrt(centers.mass[g]));
      }
      orbit.place();
      renderer.render(scene, camera);
    },
  };
}
