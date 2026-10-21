import { config } from './config.js';
import { bindSliders, bindPauseButton } from '../shared/ui.js';
import {
  frequencyCurve,
  gravitationalWaveHz,
  orbitalOmega,
  orbitalPhaseAt,
  relativeSpeed,
  separationAt,
  separationAtPhase,
  starPositions,
  timeToContact,
} from './physics.js';
import { createInspiralScene } from './scene.js';
import { createGraph } from './graph.js';

const formatSolarMass = (value) => `${value.toFixed(2)} 태양`;
const formatKm = (value) => `${Math.round(value)} km`;
const formatSlow = (value) => `×1/${Math.round(1 / value)}`;
const formatSeconds = (seconds) =>
  seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;

const SLIDERS = [
  { id: 'in-ctl-mass1', key: 'mass1', format: formatSolarMass },
  { id: 'in-ctl-mass2', key: 'mass2', format: formatSolarMass },
  { id: 'in-ctl-start', key: 'startSeparationKm', format: formatKm },
  { id: 'in-ctl-slow', key: 'slowMotion', format: formatSlow },
];

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

// 쌍성 병합 모드: 중력파를 내며 점점 빨리 돌고 다가가다 합쳐지는 두 중성자별
export function createInspiralMode(doc) {
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    elapsed: 0, // 시작부터 지난 실제 시간(초)
    mergeAge: 0, // 합쳐진 뒤 화면에서 지난 시간(초)
  };
  const contactKm = 2 * config.star.radiusKm;

  const scene = createInspiralScene(doc.getElementById('in-scene'), config);
  const graph = createGraph(doc.getElementById('in-graph'));
  bindSliders(doc, SLIDERS, config.ranges, state);
  bindPauseButton(doc, 'in-btn-pause', state);

  const readSep = doc.getElementById('in-read-sep');
  const readSpeed = doc.getElementById('in-read-speed');
  const readFreq = doc.getElementById('in-read-freq');
  const readLeft = doc.getElementById('in-read-left');
  const readStatus = doc.getElementById('in-read-status');

  const trailMax = config.visual.trail.maxPoints;
  const trailA = new Float32Array(trailMax * 3);
  const trailB = new Float32Array(trailMax * 3);

  // 시작부터 지금까지의 궤적. 각도 간격이 일정해서 프레임 속도와 상관없이 매끈하다.
  function buildTrails(phaseNow) {
    const { mass1, mass2, startSeparationKm } = state;
    const count = Math.min(
      trailMax,
      Math.max(2, Math.ceil(phaseNow / config.visual.trail.stepRad) + 1)
    );
    const unit = config.visual.unitKm;
    for (let i = 0; i < count; i++) {
      const phase = (phaseNow * i) / (count - 1);
      const a = separationAtPhase(mass1, mass2, startSeparationKm, phase);
      const { a: pa, b: pb } = starPositions(mass1, mass2, a, phase);
      for (let k = 0; k < 3; k++) {
        trailA[i * 3 + k] = pa[k] / unit;
        trailB[i * 3 + k] = pb[k] / unit;
      }
    }
    scene.setTrails(trailA, trailB, count);
  }

  let setupKey = '';
  let setup = null;

  // 질량이나 시작 거리가 바뀌면 처음부터 다시 시작한다
  function ensureSetup() {
    const key = `${state.mass1}|${state.mass2}|${state.startSeparationKm}`;
    if (key === setupKey) return;
    setupKey = key;
    const end = timeToContact(state.mass1, state.mass2, state.startSeparationKm, contactKm);
    setup = {
      end,
      curve: frequencyCurve(
        state.mass1,
        state.mass2,
        state.startSeparationKm,
        contactKm,
        config.graph.points
      ),
    };
    restart();
  }

  function restart() {
    state.elapsed = 0;
    state.mergeAge = 0;
    scene.reset();
  }
  doc.getElementById('in-btn-restart').addEventListener('click', restart);

  return {
    start() {},
    stop() {},
    frame(dt) {
      ensureSetup();
      const { mass1, mass2, startSeparationKm } = state;
      let merged = state.elapsed >= setup.end;
      if (!state.paused) {
        if (merged) state.mergeAge += dt;
        else state.elapsed = Math.min(setup.end, state.elapsed + dt * state.slowMotion);
      }
      merged = state.elapsed >= setup.end;

      const t = state.elapsed;
      const a = merged ? contactKm : separationAt(mass1, mass2, startSeparationKm, t);
      const phase = orbitalPhaseAt(mass1, mass2, startSeparationKm, t);
      const omega = orbitalOmega(mass1, mass2, a);

      buildTrails(phase);
      scene.update({
        positions: starPositions(mass1, mass2, a, phase),
        merged,
        mergeAge: state.mergeAge,
      });
      graph.draw({ curve: setup.curve, endSeconds: setup.end, fraction: t / setup.end });

      setText(readSep, `${Math.round(a)} km`);
      setText(readSpeed, `${Math.round(relativeSpeed(omega, a) * 100)}% 광속`);
      setText(readFreq, `${Math.round(gravitationalWaveHz(omega))} Hz`);
      setText(readLeft, merged ? '합쳐짐' : formatSeconds(setup.end - t));
      setText(
        readStatus,
        merged
          ? '두 별이 맞닿았어요. 실제로는 이때 강한 중력파와 빛이 나와요. 이 화면은 맞닿기 직전까지만 계산해요. "다시 시작"으로 처음부터 볼 수 있어요.'
          : '중력파로 에너지를 잃어 점점 가까워지고, 가까울수록 빨리 돌아요. 오른쪽 위로 휘는 곡선이 그 소리의 높아짐(처프)이에요.'
      );
    },
  };
}
