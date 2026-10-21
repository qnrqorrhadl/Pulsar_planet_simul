import { cssVar } from '../shared/css.js';
import { degToRad } from '../shared/math.js';
import { ISCO, cameraBasis } from './physics.js';
import { BLACKHOLE_VERTEX, buildBlackHoleFragment } from './shader.js';

const THREE = window.THREE;

// 화면 전체를 덮는 사각형 하나에 셰이더를 입혀 그린다.
export function createBlackHoleScene(canvas, config) {
  const { tracing, disk } = config;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(tracing.renderScale);

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCamPos: { value: new THREE.Vector3() },
    uCamForward: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() },
    uCamUp: { value: new THREE.Vector3() },
    uTanHalfFov: { value: Math.tan(degToRad(tracing.fovDeg) / 2) },
    uEscape: { value: 1 },
    uInner: { value: ISCO },
    uOuter: { value: disk.outerRadius },
    uTime: { value: 0 },
    uHot: { value: new THREE.Color(cssVar('--disk-hot')) },
    uCool: { value: new THREE.Color(cssVar('--disk-cool')) },
    uBackground: { value: new THREE.Color(cssVar('--bg')) },
  };

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: BLACKHOLE_VERTEX,
      fragmentShader: buildBlackHoleFragment(tracing, disk, config.stars),
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
  );
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();

  // 그릴 필요가 없으면(멈춤 상태에서 값이 그대로면) 다시 그리지 않는다.
  let dirty = true;
  let lastKey = '';

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(uniforms.uResolution.value);
    dirty = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    invalidate() {
      dirty = true;
    },
    update({ elevationRad, azimuthRad, distance, lookYawRad, lookPitchRad, diskTime }) {
      const key = `${elevationRad}|${azimuthRad}|${distance}|${lookYawRad}|${lookPitchRad}|${diskTime}`;
      if (!dirty && key === lastKey) return;
      lastKey = key;
      dirty = false;

      const basis = cameraBasis(elevationRad, distance, azimuthRad, lookYawRad, lookPitchRad);
      uniforms.uCamPos.value.set(...basis.position);
      uniforms.uCamForward.value.set(...basis.forward);
      uniforms.uCamRight.value.set(...basis.right);
      uniforms.uCamUp.value.set(...basis.up);
      uniforms.uEscape.value = distance * tracing.escapeMargin;
      uniforms.uTime.value = diskTime;
      renderer.render(scene, camera);
    },
  };
}
