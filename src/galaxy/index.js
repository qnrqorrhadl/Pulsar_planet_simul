import { config } from './config.js';
import { bindSliders, bindPauseButton } from '../shared/ui.js';
import { buildEncounter, markMerged, separation, step, timeToPeriapsis } from './physics.js';
import { createGalaxyScene } from './scene.js';
import { createGraph } from './graph.js';

const formatRatio = (value) => `${value.toFixed(2)}배`;
const formatPeriapsis = (value) => `반지름의 ${value.toFixed(1)}배`;
const formatTilt = (value) => `${Math.round(value)}°`;
const formatSpeed = (value) => `×${value < 1 ? value.toFixed(2) : value.toFixed(1)}`;

const SLIDERS = [
  { id: 'gx-ctl-ratio', key: 'massRatio', format: formatRatio },
  { id: 'gx-ctl-periapsis', key: 'periapsis', format: formatPeriapsis },
  { id: 'gx-ctl-tilt', key: 'tiltDeg', format: formatTilt },
  { id: 'gx-ctl-speed', key: 'speed', format: formatSpeed },
];

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

const toYears = (time) => time * config.real.timeUnitYears;
// 억 년 단위로 읽기 좋게
const formatAge = (time) => `${(toYears(time) / 1e8).toFixed(1)}억 년`;
const formatLightYears = (distance) => {
  const ly = distance * config.real.radiusLightYears;
  return ly >= 1e5 ? `${Math.round(ly / 1e4)}만 광년` : `${(ly / 1e4).toFixed(1)}만 광년`;
};

const ticksUpTo = (max) => Array.from({ length: Math.floor(max / 10) + 1 }, (_, i) => i * 10);

// 이 값들이 바뀌면 계산을 다시 하고 처음부터 시작한다.
function buildRun(state) {
  const { physics, particles } = config;
  const encounter = buildEncounter({
    count: particles.count,
    massRatio: state.massRatio,
    periapsis: state.periapsis,
    tiltDeg: state.tiltDeg,
    seed: particles.seed,
    physics,
  });
  const arrival = timeToPeriapsis(state.periapsis, physics.startDistance, 1 + state.massRatio);
  return { encounter, arrival, end: arrival + physics.afterPeriapsis, history: [], nextSample: 0, closest: Infinity, carry: 0, merged: false };
}

function describe(run) {
  const { encounter, arrival } = run;
  const time = encounter.time;
  if (run.merged) return '두 은하가 하나로 합쳐졌어요. 별들은 흩어져 둥근 타원 은하 같은 모양으로 자리 잡아 가요.';
  if (time < arrival * 0.7) return '두 은하가 서로 끌어당기며 다가와요.';
  if (time < arrival * 1.15) return '가장 가까이 스쳐 지나가요. 서로의 중력(조석력)이 별들을 잡아당겨요.';
  const d = separation(encounter);
  if (d > run.closest * 3 && time < arrival + 30) return '조석력에 별이 끌려 나와 긴 꼬리가 생겼어요. 두 은하는 다시 멀어져 가요.';
  return '서로 다시 끌려 돌아오며 하나로 합쳐져 가요. 꼬리와 껍질 같은 흔적이 남아요.';
}

// 은하 충돌 모드: 원반 은하 둘이 포물선으로 다가와 서로 스치며 조석 꼬리를 뽑고 합쳐지는 모습
export function createGalaxyMode(doc) {
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  const scene = createGalaxyScene(doc.getElementById('gx-scene'), config);
  const graph = createGraph(doc.getElementById('gx-graph'));
  bindSliders(doc, SLIDERS, config.ranges, state);
  bindPauseButton(doc, 'gx-btn-pause', state);

  let run = null;
  let runKey = '';
  function refresh(force = false) {
    const key = `${state.massRatio}|${state.periapsis}|${state.tiltDeg}`;
    if (force || key !== runKey || !run) {
      runKey = key;
      run = buildRun(state);
    }
    return run;
  }
  doc.getElementById('gx-btn-restart').addEventListener('click', () => refresh(true));

  const readTime = doc.getElementById('gx-read-time');
  const readDistance = doc.getElementById('gx-read-distance');
  const readClosest = doc.getElementById('gx-read-closest');
  const readStatus = doc.getElementById('gx-read-status');

  return {
    start() {},
    stop() {},
    frame(dt) {
      const r = refresh();
      const { physics, pace } = config;
      if (!state.paused) {
        r.carry += dt * state.speed * pace.timeUnitsPerSecond;
        let steps = 0;
        while (r.carry >= physics.step && steps < physics.maxStepsPerFrame) {
          step(r.encounter, physics.step);
          r.carry -= physics.step;
          steps++;
          if (r.encounter.time >= r.nextSample && r.encounter.time <= r.end * 1.5) {
            r.history.push([toYears(r.encounter.time) / 1e8, separation(r.encounter)]);
            r.nextSample += 1 / config.graph.samplesPerTimeUnit;
          }
          const gap = separation(r.encounter);
          r.closest = Math.min(r.closest, gap);
          if (!r.merged && r.encounter.time > r.arrival * 1.5 && gap < physics.mergedDistance) {
            r.merged = true;
            markMerged(r.encounter);
          }
        }
        if (steps === physics.maxStepsPerFrame) r.carry = 0;
      }

      scene.update(r.encounter);
      graph.draw({
        history: r.history,
        maxTime: Math.max(toYears(r.end) / 1e8, r.history.length ? r.history[r.history.length - 1][0] : 0),
        maxDistance: physics.startDistance,
        timeTicks: ticksUpTo(Math.max(toYears(r.end) / 1e8, r.history.length ? r.history[r.history.length - 1][0] : 0)),
      });

      const d = separation(r.encounter);
      setText(readTime, formatAge(r.encounter.time));
      setText(readDistance, formatLightYears(d));
      setText(readClosest, r.closest === Infinity ? '-' : formatLightYears(r.closest));
      setText(readStatus, describe(r));
    },
  };
}
