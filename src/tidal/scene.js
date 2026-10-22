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
    star: new THREE.Color(cssVar('--tde-star-core')),
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
    // state: { time, periapsis, reach, debris, disrupted, horizonVisual, starHidden, starScale, starStretch, flash, collisionAt, rate, thickening, viewZoom, film, showParticles, clumpScale }
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

      if (state.showParticles) {
        // 연출 보기: 아직 흘려지지 않은 알갱이는 별 자리에 둥근 덩어리로 모여 있다가 하나씩 떨어져 나가 꼬리가 된다
        const film = state.film;
        const head = config.cinematic.head;
        const [starX, starY] = film ? parabolicPosition(time, periapsis) : [0, 0];
        for (let i = 0; i < count; i++) {
          const released = time >= debris.releaseTime[i];
          let x;
          let y;
          let z;
          let r;
          let starMix = 0;
          let level = 1;
          const age = Math.max(time - debris.releaseTime[i], 0);
          if (film) {
            const cx = debris.clump[i * 3];
            const cy = debris.clump[i * 3 + 1];
            const cz = debris.clump[i * 3 + 2];
            const size = head.radius * state.clumpScale;
            if (!released) {
              x = starX + cx * size;
              y = starY + cy * size;
              z = cz * size;
              starMix = 1;
              level = head.brightness * (1 + head.coreBoost * (1 - Math.hypot(cx, cy, cz)) ** 2);
            } else {
              debrisPosition(debris, i, time, state.thickening, scratch, config.disc.circularizeTime);
              const relax = Math.exp(-age / head.relax);
              x = scratch[0] + cx * size * relax;
              y = scratch[1] + cy * size * relax;
              z = scratch[2] + cz * size * relax;
              starMix = Math.exp(-age / head.cool);
            }
          } else {
            if (!released) {
              particleColors[i * 3] = 0;
              particleColors[i * 3 + 1] = 0;
              particleColors[i * 3 + 2] = 0;
              continue;
            }
            debrisPosition(debris, i, time, state.thickening, scratch, config.disc.circularizeTime);
            [x, y, z] = scratch;
          }
          r = Math.hypot(x, y, z);
          const world = toWorld(x, y, z);
          positions[i * 3] = world[0];
          positions[i * 3 + 1] = world[1];
          positions[i * 3 + 2] = world[2];
          // 블랙홀 가까이는 뜨겁고 푸르게, 멀면 주황으로. 방금 떨어져 나온 알갱이는 별 색에서 식어 간다.
          const heat = Math.exp(-r / v.heatRadius);
          mixed.copy(colors.cool).lerp(colors.hot, heat);
          if (starMix > 0) mixed.lerp(colors.star, starMix);
          const boost = 1 + v.headBoost * Math.exp(-age / v.headDecay);
          const visible = r < horizonVisual ? 0 : (0.55 + 0.45 * heat) * boost * level;
          particleColors[i * 3] = mixed.r * visible;
          particleColors[i * 3 + 1] = mixed.g * visible;
          particleColors[i * 3 + 2] = mixed.b * visible;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      }
      points.visible = Boolean(state.showParticles);
      starBody.visible = !state.film;

      orbit.setZoomFactor(state.viewZoom);
      orbit.place();
      renderer.render(scene, camera);
    },
  };
}
