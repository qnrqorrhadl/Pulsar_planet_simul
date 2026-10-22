import { cssVar } from '../shared/css.js';
import { createOrbitCamera } from '../shared/orbit-camera.js';
import { makeBackgroundStars, makeGlowSprite, makeGlowTexture, makeStarBody } from '../shared/sky3d.js';
import { debrisPosition, parabolicPosition } from './physics.js';

const THREE = window.THREE;

// 궤도 평면(x, y) → 화면 3D: 평면을 바닥(x, z)에 눕히고 수직 방향을 위(y)로 쓴다.
const toWorld = (x, y, z) => [x, z, -y];

export function createTidalScene(canvas, config) {
  const v = config.visual;
  const colors = {
    bg: cssVar('--bg'),
    axis: cssVar('--axis'),
    hot: new THREE.Color(cssVar('--tde-hot')),
    cool: new THREE.Color(cssVar('--tde-cool')),
    glow: cssVar('--tde-glow'),
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

  // 블랙홀: 검은 구와, 떨어지는 물질이 많을수록 밝아지는 번짐
  const hole = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  const holeGlow = makeGlowSprite(colors.glow, 0);
  scene.add(holeGlow, hole);

  // 별
  const star = makeStarBody({
    radius: v.starVisualRadius,
    coreCss: cssVar('--tde-star-core'),
    edgeCss: cssVar('--tde-star-edge'),
    limbPower: v.limbPower,
    corona: v.corona,
  });
  scene.add(star);
  const starBody = star.children[0]; // 공 모양 몸통만 늘어난다(둘레 빛은 둥글게 둔다)

  // 되돌아온 띠가 자기 길과 부딪히는 자리의 섬광
  const flash = makeGlowSprite(cssVar(config.collision.flashColorToken), 0);
  flash.visible = false;
  scene.add(flash);

  // 별이 오는 포물선 길(참고선)
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: new THREE.Color(colors.axis),
      transparent: true,
      opacity: v.orbitOpacity,
      depthWrite: false,
    })
  );
  scene.add(orbitLine);
  let orbitKey = '';

  function rebuildOrbit(periapsis, reach) {
    const key = `${periapsis}|${reach}`;
    if (key === orbitKey) return;
    orbitKey = key;
    const points = new Float32Array((v.orbitSegments + 1) * 3);
    for (let i = 0; i <= v.orbitSegments; i++) {
      const t = (i / v.orbitSegments * 2 - 1) * reach;
      const [x, y] = parabolicPosition(t, periapsis);
      points.set(toWorld(x, y, 0), i * 3);
    }
    orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    orbitLine.geometry.computeBoundingSphere();
  }

  // 부스러기 알갱이
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

  const scratch = [0, 0, 0];
  const mixed = new THREE.Color();

  return {
    // state: { time, periapsis, reach, debris, disrupted, horizonVisual, starHidden, starScale, starStretch, flash, collisionAt, rate }
    update(state) {
      const { time, periapsis, debris, horizonVisual } = state;
      rebuildOrbit(periapsis, state.reach);

      hole.scale.setScalar(horizonVisual);
      holeGlow.scale.setScalar(horizonVisual * v.glowScale * 4);
      holeGlow.material.opacity = Math.min(state.rate, 1);

      star.visible = !state.starHidden;
      if (star.visible) {
        const [x, y] = parabolicPosition(time, periapsis);
        star.position.set(...toWorld(x, y, 0));
        star.scale.setScalar(state.starScale);
        star.rotation.y = Math.atan2(y, x);
        starBody.scale.set(state.starStretch.along, state.starStretch.across, state.starStretch.across);
      }

      const showFlash = state.disrupted && state.flash > 0.01 && state.collisionAt;
      flash.visible = Boolean(showFlash);
      if (showFlash) {
        flash.position.set(...toWorld(state.collisionAt[0], state.collisionAt[1], 0));
        flash.scale.setScalar(config.collision.flashScale * (0.5 + 0.5 * state.flash));
        flash.material.opacity = config.collision.flashOpacity * state.flash;
      }

      if (state.disrupted) {
        for (let i = 0; i < count; i++) {
          if (time < debris.releaseTime[i]) {
            particleColors[i * 3] = 0;
            particleColors[i * 3 + 1] = 0;
            particleColors[i * 3 + 2] = 0;
            continue;
          }
          debrisPosition(debris, i, time, config.particles.thickening, scratch);
          const world = toWorld(scratch[0], scratch[1], scratch[2]);
          const r = Math.hypot(scratch[0], scratch[1], scratch[2]);
          positions[i * 3] = world[0];
          positions[i * 3 + 1] = world[1];
          positions[i * 3 + 2] = world[2];
          // 블랙홀 가까이는 뜨겁고 푸르게, 멀면 주황으로
          const heat = Math.exp(-r / v.heatRadius);
          mixed.copy(colors.cool).lerp(colors.hot, heat);
          const swallowed = r < horizonVisual ? 0 : 0.55 + 0.45 * heat;
          particleColors[i * 3] = mixed.r * swallowed;
          particleColors[i * 3 + 1] = mixed.g * swallowed;
          particleColors[i * 3 + 2] = mixed.b * swallowed;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      }
      points.visible = state.disrupted;

      orbit.place();
      renderer.render(scene, camera);
    },
  };
}
