import { cssVar } from '../shared/css.js';

const LAYOUT = { left: 52, right: 10, top: 10, bottom: 26 };

const formatTime = (seconds) =>
  seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(1)} s`;

// 가로축: 합쳐지기까지의 실제 시간, 세로축: 중력파 주파수. 곡선은 고정이고 지금 위치만 움직인다.
export function createGraph(canvas) {
  const ctx = canvas.getContext('2d');
  const colors = {
    grid: cssVar('--line'),
    text: cssVar('--muted'),
    line: cssVar('--observed'),
  };
  const font = `11px ${cssVar('--font-data')}`;

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

  // curve: 주파수 값들(Hz), endSeconds: 곡선 전체가 걸리는 실제 시간, fraction: 지금 진행(0..1)
  function draw({ curve, endSeconds, fraction }) {
    fitCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const plotWidth = width - LAYOUT.left - LAYOUT.right;
    const plotHeight = height - LAYOUT.top - LAYOUT.bottom;
    const top = curve[curve.length - 1];
    const x = (f) => LAYOUT.left + f * plotWidth;
    const y = (hz) => LAYOUT.top + (1 - hz / top) * plotHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.lineWidth = 1;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const hz of [0, top / 2, top]) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(0), y(hz));
      ctx.lineTo(x(1), y(hz));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(`${Math.round(hz)} Hz`, LAYOUT.left - 6, y(hz));
    }

    ctx.textBaseline = 'top';
    for (const at of [0, 0.5, 1]) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(at), y(top));
      ctx.lineTo(x(at), y(0));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.textAlign = at === 0 ? 'left' : at === 1 ? 'right' : 'center';
      ctx.fillText(at === 0 ? '시작' : formatTime(endSeconds * at), x(at), y(0) + 8);
    }

    const last = curve.length - 1;
    ctx.beginPath();
    curve.forEach((hz, i) => {
      if (i === 0) ctx.moveTo(x(i / last), y(hz));
      else ctx.lineTo(x(i / last), y(hz));
    });
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 지금 위치(곡선 위)
    const index = Math.min(last, Math.round(fraction * last));
    ctx.strokeStyle = colors.text;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x(fraction), y(top));
    ctx.lineTo(x(fraction), y(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    ctx.arc(x(fraction), y(curve[index]), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  return { draw };
}
