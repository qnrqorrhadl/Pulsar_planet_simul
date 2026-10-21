import { cssVar } from '../shared/css.js';
import { createOrbitCamera } from '../shared/orbit-camera.js';
import { makeBackgroundStars, makeGlowSprite, makeStarBody } from '../shared/sky3d.js';

const THREE = window.THREE;

function makeTrail(colorCss, trail) {
  const positions = new Float32Array(trail.maxPoints * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(colorCss),
      transparent: true,
      opacity: trail.opacity,
      depthWrite: false,
    })
  );
  line.frustumCulled = false;
  return { line, positions };
}

// 두 중성자별, 지나온 궤적, 합쳐진 뒤의 한 덩어리와 번쩍임
export function createInspiralScene(canvas, config) {
  const v = config.visual;
  const unit = v.unitKm;
  const radius = config.star.radiusKm / unit;
  const css = {
    bg: cssVar('--bg'),
    axis: cssVar('--axis'),
    a: cssVar('--ns-a-edge'),
    b: cssVar('--ns-b-edge'),
    merge: cssVar('--ns-merge'),
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color(css.bg));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  scene.add(
    makeBackgroundStars(
      { count: v.backgroundStars, radius: v.backgroundStarRadius, seed: v.backgroundSeed },
      css.axis
    )
  );

  const starParts = (coreToken, edgeToken) => ({
    radius,
    coreCss: cssVar(coreToken),
    edgeCss: cssVar(edgeToken),
    limbPower: v.limbPower,
    corona: v.corona,
  });
  const starA = makeStarBody(starParts('--ns-a-core', '--ns-a-edge'));
  const starB = makeStarBody(starParts('--ns-b-core', '--ns-b-edge'));
  const remnant = makeStarBody({
    ...starParts('--ns-merge', '--ns-merge'),
    radius: radius * v.merge.remnantScale,
  });
  remnant.visible = false;
  scene.add(starA, starB, remnant);

  const flash = makeGlowSprite(css.merge, 1);
  flash.visible = false;
  scene.add(flash);

  const trailA = makeTrail(css.a, v.trail);
  const trailB = makeTrail(css.b, v.trail);
  scene.add(trailA.line, trailB.line);

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

  return {
    // 처음부터 다시: 궤적을 지우고 두 별을 보이게 한다
    reset() {
      trailA.line.geometry.setDrawRange(0, 0);
      trailB.line.geometry.setDrawRange(0, 0);
      remnant.visible = false;
      flash.visible = false;
      starA.visible = true;
      starB.visible = true;
    },
    // 지나온 궤적: 점 count개(장면 단위, xyz 차례로)를 받아 그린다
    setTrails(pointsA, pointsB, count) {
      trailA.positions.set(pointsA.subarray(0, count * 3));
      trailB.positions.set(pointsB.subarray(0, count * 3));
      for (const trail of [trailA, trailB]) {
        trail.line.geometry.attributes.position.needsUpdate = true;
        trail.line.geometry.setDrawRange(0, count);
      }
    },
    // positions는 km. merged가 되면 한 덩어리를 보이고, mergeAge(화면 초)가 지날수록 번쩍임이 잦아든다.
    update({ positions, merged, mergeAge }) {
      if (!merged) {
        starA.position.set(...positions.a.map((value) => value / unit));
        starB.position.set(...positions.b.map((value) => value / unit));
      }
      starA.visible = !merged;
      starB.visible = !merged;
      remnant.visible = merged;

      const fade = merged ? Math.max(0, 1 - mergeAge / v.merge.flashSeconds) : 0;
      flash.visible = fade > 0;
      flash.material.opacity = fade;
      flash.scale.setScalar(radius * v.merge.flashScale * (1.2 - 0.6 * fade));

      orbit.place();
      renderer.render(scene, camera);
    },
  };
}
