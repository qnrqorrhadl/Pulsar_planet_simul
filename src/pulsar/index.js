import { config } from './config.js';
import {
  degToRad,
  intensityAtPhase,
  peakIntensity,
  pulsesPerRotation,
} from './physics.js';
import { createScene } from './scene.js';
import { createGraph } from './graph.js';
import { createControls } from './controls.js';

const FULL_TURN = 2 * Math.PI;

function describePulses({ count, steady }) {
  if (steady) return '밝기가 거의 일정해서 깜빡임으로 보이지 않아요.';
  if (count === 0) return '빛줄기가 지구를 비켜가요. 거의 보이지 않아요.';
  if (count === 1) return '한 바퀴에 한 번 깜빡여요.';
  if (count === 2) return '한 바퀴에 두 번 깜빡여요. 양쪽 빛줄기가 번갈아 지나가요.';
  return `한 바퀴에 ${count}번 깜빡여요.`;
}

function formatSeconds(seconds) {
  return `${seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)}초`;
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

// 펄서 모드: start/stop은 화면에 보이거나 가려질 때, frame은 보이는 동안 매 프레임 호출된다.
export function createPulsarMode(doc) {
  const state = {
    ...config.defaults,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    phase: 0,
  };

  const scene = createScene(doc.getElementById('scene'), config);
  const graph = createGraph(doc.getElementById('graph'), config);
  const controls = createControls(doc, config, state, {
    onToggleView: () => scene.setFollowObserver(!scene.isFollowingObserver()),
  });
  scene.onViewChange(controls.syncViewButton);
  controls.syncViewButton(false);

  const readPeak = doc.getElementById('read-peak');
  const readRotation = doc.getElementById('read-rotation');
  const readStatus = doc.getElementById('read-status');

  let analysisKey = '';
  let analysis = null;

  function updateReadouts(params, rotationSeconds) {
    const key = `${state.tiltDeg}|${state.observerDeg}`;
    if (key !== analysisKey) {
      analysisKey = key;
      analysis = {
        peak: peakIntensity(params),
        pulses: pulsesPerRotation(params, config.pulseThreshold),
      };
    }
    setText(readPeak, `${Math.round(analysis.peak * 100)}%`);
    setText(readRotation, formatSeconds(rotationSeconds));

    let status = describePulses(analysis.pulses);
    if (rotationSeconds < config.visual.fastRotationWarnSeconds) {
      status += ' 화면 회전이 너무 빨라요. 슬로모션을 더 낮춰 보세요.';
    }
    setText(readStatus, status);
  }

  return {
    start() {},
    stop() {},
    frame(dt) {
      const periodSec = state.periodMs / 1000;
      const params = {
        periodSec,
        tiltRad: degToRad(state.tiltDeg),
        observerRad: degToRad(state.observerDeg),
        halfWidthRad: degToRad(config.beamHalfWidthDeg),
      };

      if (!state.paused) {
        state.phase =
          (state.phase + (FULL_TURN * dt * state.slowMotion) / periodSec) % FULL_TURN;
      }

      scene.update({
        phase: state.phase,
        tiltRad: params.tiltRad,
        observerRad: params.observerRad,
        intensity: intensityAtPhase(state.phase, params),
      });
      graph.draw({ phase: state.phase, params, periodMs: state.periodMs });
      updateReadouts(params, periodSec / state.slowMotion);
    },
  };
}
