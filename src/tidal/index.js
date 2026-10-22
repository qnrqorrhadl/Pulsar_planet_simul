import { config } from './config.js';
import { bindSliders, bindPauseButton } from '../shared/ui.js';
import { formatLength, formatSolarMass } from '../shared/units.js';
import {
  buildDebris,
  disrupts as disruptsAt,
  energySpread,
  fallbackRate,
  firstReturnTime,
  horizonInTidal,
  horizonKm,
  parabolicPosition,
  parabolicTimeAtRadius,
  periapsisOf,
  realFirstReturnSeconds,
  tidalRadiusKm,
} from './physics.js';
import { createTidalScene } from './scene.js';
import { createGraph } from './graph.js';

const SECONDS = { minute: 60, hour: 3600, day: 86400, year: 365.25 * 86400 };
const MAX_HORIZON_VISUAL = 6;
const SWALLOW_LINGER = 2; // 통째로 삼켜진 뒤 처음으로 돌아가기 전에 머무는 시간(시뮬레이션 단위)

const formatStarMass = (value) => `${value.toFixed(value < 1 ? 2 : 1)} 태양`;
const formatBeta = (value) => `β = ${value.toFixed(1)}`;
const formatSpeed = (value) => `×${value < 1 ? value.toFixed(2) : value.toFixed(1)}`;
const formatPercent = (fraction) => `${Math.round(fraction * 100)}%`;

function formatDuration(seconds) {
  if (seconds < 1.5 * SECONDS.minute) return `${Math.round(seconds)}초`;
  if (seconds < 1.5 * SECONDS.hour) return `${Math.round(seconds / SECONDS.minute)}분`;
  if (seconds < 2 * SECONDS.day) return `${Math.round(seconds / SECONDS.hour)}시간`;
  if (seconds < 2 * SECONDS.year) return `${Math.round(seconds / SECONDS.day)}일`;
  return `${(seconds / SECONDS.year).toFixed(1)}년`;
}

const SLIDERS = [
  { id: 'td-ctl-bh', key: 'bhMassSolar', format: formatSolarMass },
  { id: 'td-ctl-star', key: 'starMassSolar', format: formatStarMass },
  { id: 'td-ctl-beta', key: 'beta', format: formatBeta },
  { id: 'td-ctl-speed', key: 'speed', format: formatSpeed },
];

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

// 이 값들이 바뀌면 계산을 다시 하고 처음부터 시작한다.
function analyze(state) {
  const { physics, particles, visual } = config;
  const periapsis = periapsisOf(state.beta);
  const horizonRatio = horizonInTidal(state.bhMassSolar, state.starMassSolar, physics);
  const swallowedWhole = horizonRatio >= 1;
  const disrupts = !swallowedWhole && disruptsAt(state.beta, physics);
  const spread = energySpread(state.bhMassSolar, state.starMassSolar, physics);
  const firstReturn = firstReturnTime(spread);
  const start = parabolicTimeAtRadius(physics.startRadius, periapsis);
  let end;
  if (disrupts) end = firstReturn * physics.loopFirstReturns;
  else if (swallowedWhole) end = parabolicTimeAtRadius(Math.max(horizonRatio, periapsis), periapsis) + SWALLOW_LINGER;
  else end = -start;
  return {
    periapsis,
    horizonRatio,
    horizonVisual: Math.min(Math.max(horizonRatio, visual.minHorizonVisual), MAX_HORIZON_VISUAL),
    swallowedWhole,
    disrupts,
    firstReturn,
    start,
    end,
    disruptionTime: parabolicTimeAtRadius(1, periapsis),
    debris: disrupts
      ? buildDebris({
          count: particles.count,
          periapsis,
          spread,
          cloudRadius: particles.cloudRadius,
          seed: particles.seed,
        })
      : null,
    tidalKm: tidalRadiusKm(state.bhMassSolar, state.starMassSolar, physics),
    realReturn: realFirstReturnSeconds(state.bhMassSolar, state.starMassSolar, physics),
  };
}

function describe(a, disrupted) {
  if (a.swallowedWhole) {
    return '블랙홀이 너무 커서 사건의 지평선이 조석 반지름보다 커요. 별이 찢기기 전에 통째로 삼켜져서 밝은 빛이 거의 나지 않아요.';
  }
  if (!a.disrupts) {
    return '침투 정도 β가 1보다 작아서 조석력이 별 자신의 중력을 이기지 못해요. 별은 찢어지지 않고 그냥 지나가요.';
  }
  if (!disrupted) return '별이 블랙홀에 다가가요. 조석 반지름 안으로 들어가면 찢겨요.';
  const swallowed = a.periapsis < a.horizonRatio ? ' 가장 가까운 곳이 사건의 지평선 안이라 대부분 삼켜져요.' : '';
  return `조석력에 별이 늘어나 찢겼어요. 절반은 묶여서 블랙홀로 돌아오고 절반은 날아가요. 돌아온 물질이 뜨겁게 빛나는 것이 오른쪽 곡선이에요.${swallowed} 퍼지는 폭은 보기 좋게 부풀렸어요.`;
}

// 조석 파괴 모드: 별이 블랙홀에 너무 가까이 가서 찢기고, 부스러기가 띠로 늘어나 감겨 드는 모습
export function createTidalMode(doc) {
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    time: 0,
  };

  const scene = createTidalScene(doc.getElementById('td-scene'), config);
  const graph = createGraph(doc.getElementById('td-graph'), config);
  bindSliders(doc, SLIDERS, config.ranges, state);
  bindPauseButton(doc, 'td-btn-pause', state);

  let analysis = null;
  let analysisKey = '';
  function refresh() {
    const key = `${state.bhMassSolar}|${state.starMassSolar}|${state.beta}`;
    if (key !== analysisKey) {
      analysisKey = key;
      analysis = analyze(state);
      state.time = analysis.start;
    }
    return analysis;
  }
  doc.getElementById('td-btn-restart').addEventListener('click', () => {
    state.time = refresh().start;
  });

  const readTidal = doc.getElementById('td-read-tidal');
  const readHorizon = doc.getElementById('td-read-horizon');
  const readReturn = doc.getElementById('td-read-return');
  const readRate = doc.getElementById('td-read-rate');
  const readStatus = doc.getElementById('td-read-status');

  return {
    start() {},
    stop() {},
    frame(dt) {
      const a = refresh();
      const { physics } = config;
      if (!state.paused) {
        state.time += (dt * state.speed * a.firstReturn) / physics.firstReturnSeconds;
        if (state.time > a.end) state.time = a.start;
      }

      const disrupted = a.disrupts && state.time >= a.disruptionTime;
      const sinceDisruption = state.time - a.disruptionTime;
      let starScale = 1;
      let starHidden = false;
      if (a.disrupts) {
        const fade = Math.min(Math.max(sinceDisruption / physics.starFadeTime, 0), 1);
        starScale = 1 - fade;
        starHidden = fade >= 1;
      } else {
        const [x, y] = parabolicPosition(state.time, a.periapsis);
        starHidden = Math.hypot(x, y) < a.horizonVisual;
      }

      const inFirstReturns = state.time / a.firstReturn;
      const rate = a.disrupts ? fallbackRate(inFirstReturns, config.graph.riseStart) : 0;

      scene.update({
        time: state.time,
        periapsis: a.periapsis,
        reach: -a.start,
        debris: a.debris,
        disrupted,
        horizonVisual: a.horizonVisual,
        starHidden,
        starScale,
        rate,
      });
      graph.draw({ inFirstReturns: a.disrupts ? inFirstReturns : null });

      setText(readTidal, formatLength(a.tidalKm));
      setText(readHorizon, formatLength(horizonKm(state.bhMassSolar)));
      setText(readReturn, a.disrupts ? formatDuration(a.realReturn) : '-');
      setText(readRate, a.disrupts ? formatPercent(rate) : '-');
      setText(readStatus, describe(a, disrupted));
    },
  };
}
