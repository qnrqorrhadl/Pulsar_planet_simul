import { config } from './config.js';
import { degToRad } from '../shared/math.js';
import { bindSliders, bindPauseButton, formatDegrees } from '../shared/ui.js';
import { SCHWARZSCHILD_RADIUS, PHOTON_SPHERE, ISCO, CRITICAL_IMPACT } from './physics.js';
import { createBlackHoleScene } from './scene.js';
import { attachViewControls } from './view.js';

const formatDistance = (value) => `${Math.round(value)} rs`;
const formatSpeed = (value) => `×${value < 1 ? value.toFixed(2) : value.toFixed(1)}`;

const SLIDERS = [
  { id: 'bh-ctl-angle', key: 'elevationDeg', format: formatDegrees },
  { id: 'bh-ctl-azimuth', key: 'azimuthDeg', format: formatDegrees },
  { id: 'bh-ctl-distance', key: 'distance', format: formatDistance },
  { id: 'bh-ctl-speed', key: 'diskSpeed', format: formatSpeed },
];

function describeView(elevationDeg) {
  if (elevationDeg <= config.hints.edgeOnMaxDeg) {
    return '원반을 거의 옆에서 봐요. 블랙홀 뒤쪽 원반의 빛이 휘어서 위아래로 둥글게 솟아 보여요.';
  }
  if (elevationDeg >= config.hints.faceOnMinDeg) {
    return '위에서 내려다봐요. 원반이 둥근 고리로 보이고, 한가운데 검은 그림자가 생겨요.';
  }
  return '비스듬히 봐요. 뒤쪽 원반이 블랙홀 위로 휘어 올라와 보여요.';
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

// 블랙홀 모드: 회전하지 않는 블랙홀과 얇은 강착원반을 빛 추적으로 그린다.
export function createBlackHoleMode(doc) {
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    diskTime: 0,
  };

  const canvas = doc.getElementById('bh-scene');
  const scene = createBlackHoleScene(canvas, config);
  const sliders = bindSliders(doc, SLIDERS, config.ranges, state);
  bindPauseButton(doc, 'bh-btn-pause', state);
  attachViewControls(canvas, state, config, sliders.syncAll);

  doc.getElementById('bh-btn-reset').addEventListener('click', () => {
    const { elevationDeg, azimuthDeg, distance, lookYawDeg, lookPitchDeg } = config.defaults;
    Object.assign(state, { elevationDeg, azimuthDeg, distance, lookYawDeg, lookPitchDeg });
    sliders.syncAll();
  });

  doc.getElementById('bh-read-horizon').textContent = `${SCHWARZSCHILD_RADIUS} rs`;
  doc.getElementById('bh-read-ring').textContent = `${PHOTON_SPHERE} rs`;
  doc.getElementById('bh-read-isco').textContent = `${ISCO} rs`;
  doc.getElementById('bh-read-shadow').textContent = `${CRITICAL_IMPACT.toFixed(2)} rs`;
  const readStatus = doc.getElementById('bh-read-status');

  return {
    start() {
      scene.invalidate();
    },
    stop() {},
    frame(dt) {
      if (!state.paused) state.diskTime += dt * state.diskSpeed;
      scene.update({
        elevationRad: degToRad(state.elevationDeg),
        azimuthRad: degToRad(state.azimuthDeg),
        distance: state.distance,
        lookYawRad: degToRad(state.lookYawDeg),
        lookPitchRad: degToRad(state.lookPitchDeg),
        diskTime: state.diskTime,
      });
      setText(readStatus, describeView(state.elevationDeg));
    },
  };
}
