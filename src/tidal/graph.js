import { cssVar } from '../shared/css.js';
import { fallbackRate } from './physics.js';

const LAYOUT = { left: 44, right: 10, top: 10, bottom: 26 };
const CURVE_POINTS = 240;

// 가로축: 가장 가까운 점을 지난 뒤 시간(첫 귀환 시간의 배수), 세로축: 블랙홀로 떨어지는 양(첫 귀환 때 100%).
// 곡선은 고정이고 지금 시각만 움직인다.
export function createGraph(canvas, config) {
  const ctx = canvas.getContext('2d');
  const colors = { grid: cssVar('--line'), text: cssVar('--muted'), line: cssVar('--tde-glow') };
  const font = `11px ${cssVar('--font-data')}`;
  const { maxFirstReturns, riseStart } = config.graph;

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

  // inFirstReturns: 지금 시각(첫 귀환 시간의 배수, 가장 가까운 점 기준). null이면 표시 안 함.
  function draw({ inFirstReturns }) {
    fitCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const plotWidth = width - LAYOUT.left - LAYOUT.right;
    const plotHeight = height - LAYOUT.top - LAYOUT.bottom;
    const x = (t) => LAYOUT.left + (t / maxFirstReturns) * plotWidth;
    const y = (level) => LAYOUT.top + (1 - level) * plotHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.lineWidth = 1;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const level of [0, 0.5, 1]) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(0), y(level));
      ctx.lineTo(x(maxFirstReturns), y(level));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(`${Math.round(level * 100)}%`, LAYOUT.left - 6, y(level));
    }

    ctx.textBaseline = 'top';
    for (let tick = 0; tick <= Math.floor(maxFirstReturns); tick++) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(tick), y(1));
      ctx.lineTo(x(tick), y(0));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.textAlign = tick === 0 ? 'left' : 'center';
      ctx.fillText(tick === 0 ? '0' : `×${tick}`, x(tick), y(0) + 8);
    }

    ctx.beginPath();
    for (let i = 0; i <= CURVE_POINTS; i++) {
      const t = (i / CURVE_POINTS) * maxFirstReturns;
      const level = fallbackRate(t, riseStart);
      if (i === 0) ctx.moveTo(x(t), y(level));
      else ctx.lineTo(x(t), y(level));
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (inFirstReturns !== null && inFirstReturns >= 0 && inFirstReturns <= maxFirstReturns) {
      const level = fallbackRate(inFirstReturns, riseStart);
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x(inFirstReturns), y(1));
      ctx.lineTo(x(inFirstReturns), y(0));
      ctx.stroke();
      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.arc(x(inFirstReturns), y(level), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { draw };
}
