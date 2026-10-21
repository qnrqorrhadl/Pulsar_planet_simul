import { cssVar } from '../shared/css.js';
import { degToRad } from '../shared/math.js';
import { ISCO, cameraBasis } from './physics.js';
import { BLACKHOLE_VERTEX, buildBlackHoleFragment } from './shader.js';

const THREE = window.THREE;

const JET_MODES = { none: 0, straight: 1, precessing: 2 };

// 화면 전체를 덮는 사각형 하나에 셰이더를 입혀 그린다.
export function createBlackHoleScene(canvas, config) {
  const { tracing, disk } = config;
  const trueTanHalf = Math.tan(degToRad(tracing.fovDeg) / 2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(tracing.renderScale);

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCamPos: { value: new THREE.Vector3() },
    uCamForward: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() },
    uCamUp: { value: new THREE.Vector3() },
    uTanHalfFov: { value: Math.tan(degToRad(tracing.fovDeg) / 2) },
    uTanHalfTrue: { value: Math.tan(degToRad(tracing.fovDeg) / 2) },
    uEscape: { value: 1 },
    uInner: { value: ISCO },
    uOuter: { value: disk.outerRadius },
    uDiskGain: { value: 1 },
    uTime: { value: 0 },
    uHot: { value: new THREE.Color(cssVar('--disk-hot')) },
    uCool: { value: new THREE.Color(cssVar('--disk-cool')) },
    uBackground: { value: new THREE.Color(cssVar('--bg')) },
    uDiskOn: { value: 1 },
    uCloudOn: { value: 0 },
    uJetMode: { value: 0 },
    uJetBlue: { value: new THREE.Color(cssVar(config.jetPrecessing.approachToken)) },
    uJetRed: { value: new THREE.Color(cssVar(config.jetPrecessing.recedeToken)) },
    uJetColor: { value: new THREE.Color(cssVar(config.jet.colorToken)) },
  };

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: BLACKHOLE_VERTEX,
      fragmentShader: buildBlackHoleFragment(tracing, disk, config.stars, config.jet, config.cloud, config.jetPrecessing),
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
    // 원반 옷 바꾸기: 색, 바깥 반지름, 밝기
    setDiskStyle(style) {
      uniforms.uHot.value.set(cssVar(style.hotToken));
      uniforms.uCool.value.set(cssVar(style.coolToken));
      uniforms.uOuter.value = style.outerRadius;
      uniforms.uDiskGain.value = style.gain;
      dirty = true;
    },
    invalidate() {
      dirty = true;
    },
    // distance: 계산할 카메라 거리(rs), zoom: 실제 카메라가 그보다 먼 정도(1이면 같음)
    update({ elevationRad, azimuthRad, distance, zoom, diskTime, diskOn, cloudOn, jetMode }) {
      const key = `${elevationRad}|${azimuthRad}|${distance}|${zoom}|${diskTime}|${diskOn}|${cloudOn}|${jetMode}`;
      if (!dirty && key === lastKey) return;
      lastKey = key;
      dirty = false;

      const basis = cameraBasis(elevationRad, distance, azimuthRad);
      uniforms.uCamPos.value.set(...basis.position);
      uniforms.uCamForward.value.set(...basis.forward);
      uniforms.uCamRight.value.set(...basis.right);
      uniforms.uCamUp.value.set(...basis.up);
      uniforms.uTanHalfFov.value = trueTanHalf * zoom;
      uniforms.uEscape.value = distance * tracing.escapeMargin;
      uniforms.uTime.value = diskTime;
      uniforms.uDiskOn.value = diskOn ? 1 : 0;
      uniforms.uCloudOn.value = cloudOn ? 1 : 0;
      uniforms.uJetMode.value = JET_MODES[jetMode];
      renderer.render(scene, camera);
    },
  };
}
