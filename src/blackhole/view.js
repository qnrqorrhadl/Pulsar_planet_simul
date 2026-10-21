import { clamp } from '../shared/math.js';

const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;

// 고개 돌리기: 드래그는 카메라 위치를 두고 시선만 돌린다(잡아끈 쪽으로 하늘이 딸려 온다).
// 휠은 카메라 거리. 위치(관측 각도, 방위각)는 슬라이더가 맡는다.
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
    const yaw = state.lookYawDeg - (event.clientX - lastX) * view.lookDegPerPixel;
    // 180도를 넘으면 반대쪽에서 이어지게 한다
    state.lookYawDeg =
      ((((yaw + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG;
    state.lookPitchDeg = clamp(
      state.lookPitchDeg + (event.clientY - lastY) * view.lookDegPerPixel,
      -view.lookPitchMaxDeg,
      view.lookPitchMaxDeg
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
      state.distance = clamp(
        state.distance * (1 + event.deltaY * view.zoomPerWheelUnit),
        ranges.distance.min,
        ranges.distance.max
      );
      onChange();
    },
    { passive: false }
  );
}
