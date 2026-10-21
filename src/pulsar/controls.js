import { bindSliders, bindPauseButton, formatDegrees } from '../shared/ui.js';

function formatPeriod(valueMs) {
  if (valueMs >= 1000) return `${(valueMs / 1000).toFixed(2)} s`;
  return `${valueMs < 10 ? valueMs.toFixed(1) : Math.round(valueMs)} ms`;
}

function formatSlowMotion(value) {
  return value >= 0.95 ? '×1 (실시간)' : `×1/${Math.round(1 / value)}`;
}

const SLIDERS = [
  { id: 'ctl-period', key: 'periodMs', format: formatPeriod },
  { id: 'ctl-slow', key: 'slowMotion', format: formatSlowMotion },
  { id: 'ctl-tilt', key: 'tiltDeg', format: formatDegrees },
  { id: 'ctl-observer', key: 'observerDeg', format: formatDegrees },
];

export function createControls(doc, config, state, handlers) {
  bindSliders(doc, SLIDERS, config.ranges, state);
  bindPauseButton(doc, 'btn-pause', state);

  const viewButton = doc.getElementById('btn-view');
  viewButton.addEventListener('click', handlers.onToggleView);

  return {
    syncViewButton(following) {
      viewButton.textContent = following ? '자유 시점' : '관측자 시점';
      viewButton.setAttribute('aria-pressed', String(following));
    },
  };
}
