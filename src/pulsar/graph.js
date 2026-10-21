import { intensityAtPhase } from './physics.js';

const LAYOUT = { left: 40, right: 10, top: 10, bottom: 26 };
const GRID_LEVELS = [0, 0.5, 1];

function formatMs(valueMs) {
  if (valueMs >= 1000) return `${(valueMs / 1000).toFixed(1)} s`;
  return `${valueMs < 10 ? valueMs.toFixed(1) : Math.round(valueMs)} ms`;
}

export function createGraph(canvas, config) {
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const colors = {
    grid: token('--line'),
    text: token('--muted'),
    line: token('--observed'),
  };
  const font = `11px ${token('--font-data')}`;
  const { periods, points } = config.graph;

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw({ phase, params, periodMs }) {
    fitCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const plotWidth = width - LAYOUT.left - LAYOUT.right;
    const plotHeight = height - LAYOUT.top - LAYOUT.bottom;
    const x = (fraction) => LAYOUT.left + fraction * plotWidth;
    const y = (level) => LAYOUT.top + (1 - level) * plotHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.lineWidth = 1;

    // 가로 눈금: 밝기 0, 50, 100%
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const level of GRID_LEVELS) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(0), y(level));
      ctx.lineTo(x(1), y(level));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(`${Math.round(level * 100)}%`, LAYOUT.left - 6, y(level));
    }

    // 세로 눈금: 한 주기마다, 지금을 기준으로 얼마나 전인지
    ctx.textBaseline = 'top';
    for (let k = 0; k <= periods; k++) {
      const fraction = k / periods;
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(fraction), y(1));
      ctx.lineTo(x(fraction), y(0));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.textAlign = k === 0 ? 'left' : k === periods ? 'right' : 'center';
      const label = k === periods ? '지금' : `-${formatMs((periods - k) * periodMs)}`;
      ctx.fillText(label, x(fraction), y(0) + 8);
    }

    // 밝기 곡선: 지금 위상에서 거꾸로 periods 바퀴만큼
    const span = periods * 2 * Math.PI;
    ctx.beginPath();
    let lastLevel = 0;
    for (let i = 0; i <= points; i++) {
      const fraction = i / points;
      lastLevel = intensityAtPhase(phase - span * (1 - fraction), params);
      if (i === 0) ctx.moveTo(x(fraction), y(lastLevel));
      else ctx.lineTo(x(fraction), y(lastLevel));
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo(x(1), y(0));
    ctx.lineTo(x(0), y(0));
    ctx.closePath();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = colors.line;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 지금 값
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    ctx.arc(x(1), y(lastLevel), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  return { draw };
}
