import { cssVar } from '../shared/css.js';

const LAYOUT = { left: 44, right: 10, top: 10, bottom: 26 };

// 가로축: 시간(억 년), 세로축: 두 은하 중심 사이 거리(원반 반지름의 배수). 재생하며 곡선이 자란다.
export function createGraph(canvas) {
  const ctx = canvas.getContext('2d');
  const colors = { grid: cssVar('--line'), text: cssVar('--muted'), line: cssVar('--gal-a'), now: cssVar('--gal-b') };
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

  // history: [[시간(억 년), 거리], ...], maxTime: 가로 끝(억 년), maxDistance: 세로 끝
  function draw({ history, maxTime, maxDistance, timeTicks }) {
    fitCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const plotWidth = width - LAYOUT.left - LAYOUT.right;
    const plotHeight = height - LAYOUT.top - LAYOUT.bottom;
    const x = (t) => LAYOUT.left + (t / maxTime) * plotWidth;
    const y = (d) => LAYOUT.top + (1 - d / maxDistance) * plotHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const d of [0, maxDistance / 2, maxDistance]) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(0), y(d));
      ctx.lineTo(x(maxTime), y(d));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(`${Math.round(d)}`, LAYOUT.left - 6, y(d));
    }
    ctx.textBaseline = 'top';
    for (const tick of timeTicks) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(x(tick), y(maxDistance));
      ctx.lineTo(x(tick), y(0));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.textAlign = tick === 0 ? 'left' : 'center';
      ctx.fillText(`${tick}`, x(tick), y(0) + 8);
    }

    if (history.length > 1) {
      ctx.beginPath();
      history.forEach(([t, d], i) => {
        if (i === 0) ctx.moveTo(x(t), y(Math.min(d, maxDistance)));
        else ctx.lineTo(x(t), y(Math.min(d, maxDistance)));
      });
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      const [t, d] = history[history.length - 1];
      ctx.fillStyle = colors.now;
      ctx.beginPath();
      ctx.arc(x(t), y(Math.min(d, maxDistance)), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { draw };
}
