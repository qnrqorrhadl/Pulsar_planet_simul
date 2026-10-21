import { clamp } from '../shared/math.js';

const FULL_TURN_DEG = 360;

// 드래그는 블랙홀 둘레를 돈다(방위각과 관측 각도가 바뀌고 블랙홀은 항상 가운데에 있다). 슬라이더와 같은 값을 바꾼다.
// 휠은 카메라 거리(실제 km).
// state를 직접 바꾸고, 바꾼 뒤 onChange()를 불러 화면 표시를 맞추게 한다.
export function attachViewControls(canvas, state, config, onChange) {
  const { ranges, view } = config;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const azimuth = state.azimuthDeg - (event.clientX - lastX) * view.dragDegPerPixel;
    // 한 바퀴를 넘으면 반대쪽에서 이어지게 한다
    state.azimuthDeg = ((azimuth % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
    state.elevationDeg = clamp(
      state.elevationDeg + (event.clientY - lastY) * view.dragDegPerPixel,
      ranges.elevationDeg.min,
      ranges.elevationDeg.max
    );
    lastX = event.clientX;
    lastY = event.clientY;
    onChange();
  });

  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      state.distanceKm = clamp(
        state.distanceKm * (1 + event.deltaY * view.zoomPerWheelUnit),
        ranges.distanceKm.min,
        ranges.distanceKm.max
      );
      onChange();
    },
    { passive: false }
  );
}
