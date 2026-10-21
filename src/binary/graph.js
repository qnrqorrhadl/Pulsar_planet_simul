import { cssVar } from '../shared/css.js';

const LAYOUT = { left: 44, right: 10, top: 10, bottom: 26 };
const PHASE_TICKS = [
  { at: 0, label: '0' },
  { at: 0.25, label: '0.25' },
  { at: 0.5, label: '0.5' },
  { at: 0.75, label: '0.75' },
  { at: 1, label: '1' },
];

// 가로축: 공전 위상(한 바퀴 = 1), 세로축: 전체 밝기. 곡선은 한 바퀴 분량을 고정으로 그리고 지금 위치만 움직인다.
export function createGraph(canvas, config) {
  const ctx = canvas.getContext('2d');
  const colors = {
    grid: cssVar('--line'),
    text: cssVar('--muted'),
    line: cssVar('--observed'),
  };
  const font = `11px ${cssVar('--font-data')}`;
  const { floorStep, floorMargin } = config.graph;

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

  // curve: 한 바퀴 밝기 값들, fraction: 지금 위상(0..1), flux: 지금 밝기
  function draw({ curve, fraction, flux }) {
    fitCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const plotWidth = width - LAYOUT.left - LAYOUT.right;
    const plotHeight = height - LAYOUT.top - LAYOUT.bottom;

    // 세로 범위는 가장 어두운 값에 맞춰 아래를 잘라 얕은 식도 보이게 한다
    const darkest = Math.min(...curve);
    const floor = Math.max(0, Math.floor((darkest - floorMargin) / floorStep) * floorStep);
    const x = (f) => LAYOUT.left + f * plotWidth;
    const y = (level) => LAYOUT.top + (1 - (level - floor) / (1 - floor)) * plotHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.lineWidth = 1;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const level of [floor, (floor + 1) / 2, 1]) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(0), y(level));
      ctx.lineTo(x(1), y(level));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(`${Math.round(level * 100)}%`, LAYOUT.left - 6, y(level));
    }

    ctx.textBaseline = 'top';
    for (const { at, label } of PHASE_TICKS) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(at), y(1));
      ctx.lineTo(x(at), y(floor));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.textAlign = at === 0 ? 'left' : at === 1 ? 'right' : 'center';
      ctx.fillText(label, x(at), y(floor) + 8);
    }

    const last = curve.length - 1;
    ctx.beginPath();
    curve.forEach((level, i) => {
      if (i === 0) ctx.moveTo(x(i / last), y(level));
      else ctx.lineTo(x(i / last), y(level));
    });
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(x(1), y(floor));
    ctx.lineTo(x(0), y(floor));
    ctx.closePath();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = colors.line;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 지금 위치
    ctx.strokeStyle = colors.text;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x(fraction), y(1));
    ctx.lineTo(x(fraction), y(floor));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    ctx.arc(x(fraction), y(flux), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  return { draw };
}
