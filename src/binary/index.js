import { config } from './config.js';
import { degToRad } from '../shared/math.js';
import { bindSliders, bindPauseButton, formatDegrees } from '../shared/ui.js';
import { eclipseDepths, fluxAt, lightCurve } from './physics.js';
import { createBinaryScene } from './scene.js';
import { createGraph } from './graph.js';

const FULL_TURN = 2 * Math.PI;

const formatSeconds = (value) => `${value < 10 ? value.toFixed(1) : Math.round(value)}초`;
const formatMassRatio = (value) => `B/A = ${value.toFixed(2)}`;
const formatSeparation = (value) => `×${value.toFixed(1)}`;
const formatEccentricity = (value) => value.toFixed(2);
const formatPercent = (fraction) => `${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`;

const SLIDERS = [
  { id: 'bn-ctl-period', key: 'periodSec', format: formatSeconds },
  { id: 'bn-ctl-incl', key: 'inclinationDeg', format: formatDegrees },
  { id: 'bn-ctl-mass', key: 'massRatio', format: formatMassRatio },
  { id: 'bn-ctl-sep', key: 'separation', format: formatSeparation },
  { id: 'bn-ctl-ecc', key: 'eccentricity', format: formatEccentricity },
  { id: 'bn-ctl-peri', key: 'periastronDeg', format: formatDegrees },
];

function describeEclipses(depths, threshold) {
  const hiddenA = depths.a >= threshold;
  const hiddenB = depths.b >= threshold;
  if (hiddenA && hiddenB) {
    return '한 바퀴에 두 번 어두워져요. 뜨거운 별 B가 가려질 때가 더 깊어요.';
  }
  if (hiddenB) return '별 B가 가려질 때만 어두워져요. 별 A는 B 앞을 지나지 않아요.';
  if (hiddenA) return '별 A가 가려질 때만 어두워져요.';
  return '식이 일어나지 않아요. 기울기를 90°(옆에서 봄)에 가깝게 해 보세요.';
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

// 식쌍성 모드: 서로 도는 두 별과, 서로를 가릴 때 줄어드는 전체 밝기
export function createBinaryMode(doc) {
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    meanAnomaly: 0,
  };

  const scene = createBinaryScene(doc.getElementById('bn-scene'), config);
  const graph = createGraph(doc.getElementById('bn-graph'), config);
  bindSliders(doc, SLIDERS, config.ranges, state);
  bindPauseButton(doc, 'bn-btn-pause', state);

  const viewButton = doc.getElementById('bn-btn-view');
  viewButton.addEventListener('click', () => scene.setFollowObserver(!scene.isFollowingObserver()));
  scene.onViewChange((following) => {
    viewButton.textContent = following ? '자유 시점' : '관측자 시점';
    viewButton.setAttribute('aria-pressed', String(following));
  });

  const readNow = doc.getElementById('bn-read-now');
  const readMin = doc.getElementById('bn-read-min');
  const readA = doc.getElementById('bn-read-a');
  const readB = doc.getElementById('bn-read-b');
  const readStatus = doc.getElementById('bn-read-status');

  let analysisKey = '';
  let analysis = null;

  function analyze(params) {
    const key = [
      state.inclinationDeg,
      state.massRatio,
      state.separation,
      state.eccentricity,
      state.periastronDeg,
    ].join('|');
    if (key !== analysisKey) {
      analysisKey = key;
      const curve = lightCurve(params, config.curve.points);
      analysis = {
        curve,
        darkest: Math.min(...curve),
        depths: eclipseDepths(params, config.curve.depthSamples),
      };
    }
    return analysis;
  }

  return {
    start() {},
    stop() {},
    frame(dt) {
      if (!state.paused) {
        state.meanAnomaly = (state.meanAnomaly + (FULL_TURN * dt) / state.periodSec) % FULL_TURN;
      }
      const params = {
        massRatio: state.massRatio,
        separation: state.separation,
        eccentricity: state.eccentricity,
        periastronRad: degToRad(state.periastronDeg),
        inclinationRad: degToRad(state.inclinationDeg),
        stars: config.stars,
      };
      const { curve, darkest, depths } = analyze(params);
      const flux = fluxAt(params, state.meanAnomaly);

      scene.update({ params, meanAnomaly: state.meanAnomaly, flux });
      graph.draw({ curve, fraction: state.meanAnomaly / FULL_TURN, flux });

      setText(readNow, formatPercent(flux));
      setText(readMin, formatPercent(darkest));
      setText(readA, formatPercent(depths.a));
      setText(readB, formatPercent(depths.b));
      setText(readStatus, describeEclipses(depths, config.curve.minDepthShown));
    },
  };
}
