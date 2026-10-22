import { config } from './config.js';
import { degToRad } from '../shared/math.js';
import { bindSliders, bindPauseButton, formatDegrees } from '../shared/ui.js';
import {
  SCHWARZSCHILD_RADIUS,
  PHOTON_SPHERE,
  ISCO,
  CRITICAL_IMPACT,
  rsKm,
  viewPlan,
} from './physics.js';
import { formatLength, formatSolarMass, niceScaleBar } from '../shared/units.js';
import { createBlackHoleScene } from './scene.js';
import { attachViewControls } from './view.js';

const formatSpeed = (value) => `×${value < 1 ? value.toFixed(2) : value.toFixed(1)}`;

const SLIDERS = [
  { id: 'bh-ctl-angle', key: 'elevationDeg', format: formatDegrees },
  { id: 'bh-ctl-azimuth', key: 'azimuthDeg', format: formatDegrees },
  { id: 'bh-ctl-mass', key: 'massSolar', format: formatSolarMass },
  { id: 'bh-ctl-distance', key: 'distanceKm', format: formatLength },
  { id: 'bh-ctl-speed', key: 'diskSpeed', format: formatSpeed },
];

const SHAPE_NOTES = {
  straight: ' 위아래로 뿜는 제트는 다가오는 쪽이 더 밝아요.',
  precessing:
    ' 제트가 나선으로 감겨 뻗고(축이 천천히 돌아요), 다가오는 쪽은 푸르고 멀어지는 쪽은 붉게 보여요. SS 433이 그래요.',
};

function describeView(elevationDeg, shape) {
  if (shape.cloud) {
    const text =
      '얇은 원반 대신 부풀어 오른 뜨거운 구름이 돌아요. 다가오는 쪽이 훨씬 밝아서 한쪽이 초승달처럼 보이고, 가운데는 검은 그림자예요.';
    return text + (SHAPE_NOTES[shape.jet] ?? '');
  }
  if (!shape.disk) {
    return '원반이 없어서 블랙홀은 보이지 않아요. 뒤쪽 별빛이 휘어서 검은 그림자와 둥글게 감긴 별들이 보여요.';
  }
  return describeDisk(elevationDeg) + (SHAPE_NOTES[shape.jet] ?? '');
}

function describeDisk(elevationDeg) {
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
// 질량을 정하면 실제 크기(km)가 정해지고, 카메라 거리도 실제 km로 정한다.
export function createBlackHoleMode(doc) {
  const { view } = config;
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    diskTime: 0,
  };
  state.distanceKm = view.defaultDistanceRs * rsKm(state.massSolar);

  const canvas = doc.getElementById('bh-scene');
  const scene = createBlackHoleScene(canvas, config);
  const sliders = bindSliders(doc, SLIDERS, config.ranges, state);

  // 블랙홀 주변 모양(원반, 구름, 제트)은 프리셋이 정한다
  const selectShape = (name) => {
    state.shape = config.shapes[name];
  };
  selectShape(config.defaultShape);
  const selectDiskStyle = (name) => {
    state.diskStyle = config.diskStyles[name];
    scene.setDiskStyle(state.diskStyle);
  };
  selectDiskStyle(config.defaultDiskStyle);

  // 질량을 키우면 같은 거리가 rs로는 가까워진다. 최소 거리보다 가까워지면 카메라를 뒤로 민다.
  function enforceLimits() {
    const nearest = view.minRs * rsKm(state.massSolar);
    if (state.distanceKm < nearest) {
      state.distanceKm = nearest;
      sliders.syncAll();
    }
  }
  const onViewChange = () => {
    enforceLimits();
    sliders.syncAll();
  };

  bindPauseButton(doc, 'bh-btn-pause', state);
  attachViewControls(canvas, state, config, onViewChange);

  doc.getElementById('bh-btn-reset').addEventListener('click', () => {
    const { elevationDeg, azimuthDeg } = config.defaults;
    Object.assign(state, {
      elevationDeg,
      azimuthDeg,
      distanceKm: view.defaultDistanceRs * rsKm(state.massSolar),
    });
    sliders.syncAll();
  });

  for (const [id, preset] of Object.entries(config.presets)) {
    doc.getElementById(id).addEventListener('click', () => {
      state.massSolar = preset.massSolar;
      state.distanceKm = preset.distanceRs * rsKm(preset.massSolar);
      selectShape(preset.shape);
      selectDiskStyle(preset.diskStyle ?? config.defaultDiskStyle);
      if (preset.elevationDeg !== undefined) state.elevationDeg = preset.elevationDeg;
      sliders.syncAll();
    });
  }

  const readouts = {
    horizon: doc.getElementById('bh-read-horizon'),
    ring: doc.getElementById('bh-read-ring'),
    isco: doc.getElementById('bh-read-isco'),
    shadow: doc.getElementById('bh-read-shadow'),
    disk: doc.getElementById('bh-read-disk'),
    camera: doc.getElementById('bh-read-camera'),
  };
  const readStatus = doc.getElementById('bh-read-status');
  const scaleLine = doc.getElementById('bh-scale-line');
  const scaleLabel = doc.getElementById('bh-scale-label');
  const tanHalfFov = Math.tan(degToRad(config.tracing.fovDeg) / 2);

  // 화면 가운데(블랙홀 거리)에서 km를 화면 길이로 바꿔서 눈금자를 그린다
  function updateScaleBar(trueRs, km) {
    const heightPx = canvas.clientHeight;
    if (!heightPx) return;
    const pxPerRs = heightPx / 2 / (trueRs * tanHalfFov);
    const bar = niceScaleBar((view.scaleBarTargetPx / pxPerRs) * km);
    const widthPx = Math.round((bar.km / km) * pxPerRs);
    const width = `${widthPx}px`;
    if (scaleLine.style.width !== width) scaleLine.style.width = width;
    setText(scaleLabel, bar.label);
  }

  return {
    start() {
      scene.invalidate();
    },
    stop() {},
    frame(dt) {
      enforceLimits();
      if (!state.paused) state.diskTime += dt * state.diskSpeed;
      const km = rsKm(state.massSolar);
      const plan = viewPlan(state.distanceKm, state.massSolar, view);

      scene.update({
        elevationRad: degToRad(state.elevationDeg),
        azimuthRad: degToRad(state.azimuthDeg),
        distance: plan.renderRs,
        zoom: plan.zoom,
        diskTime: state.diskTime,
        diskOn: state.shape.disk,
        cloudOn: state.shape.cloud,
        jetMode: state.shape.jet,
      });
      updateScaleBar(plan.trueRs, km);

      setText(readouts.horizon, formatLength(SCHWARZSCHILD_RADIUS * km));
      setText(readouts.ring, formatLength(PHOTON_SPHERE * km));
      const diskLength = (rs) => (state.shape.disk ? formatLength(rs * km) : '없음');
      setText(readouts.isco, diskLength(ISCO));
      setText(readouts.shadow, formatLength(CRITICAL_IMPACT * km));
      setText(readouts.disk, diskLength(state.diskStyle.outerRadius));
      setText(readouts.camera, `${Math.round(plan.trueRs)} rs`);

      let status = describeView(state.elevationDeg, state.shape);
      if (plan.tooFar) status += ' 너무 멀어서 점처럼 보여요.';
      setText(readStatus, status);
    },
  };
}
