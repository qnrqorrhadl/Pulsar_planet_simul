import { clamp, degToRad } from './math.js';

// 마우스 드래그로 돌리고 휠로 가까이·멀리 보는 3D 시점. 모드마다 같은 조작을 쓴다.
// v: { defaultYawDeg, defaultPitchDeg, maxPitchDeg, cameraDistance, cameraDistanceMin, cameraDistanceMax,
//      dragSensitivity, zoomSensitivity }
// onUserDrag: 사용자가 끌기 시작해 움직였을 때 불린다(예: 자동 따라가기 해제).
export function createOrbitCamera(canvas, camera, v, onUserDrag = () => {}) {
  let yaw = degToRad(v.defaultYawDeg);
  let pitch = degToRad(v.defaultPitchDeg);
  let distance = v.cameraDistance;

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
    yaw -= (event.clientX - lastX) * v.dragSensitivity;
    pitch += (event.clientY - lastY) * v.dragSensitivity;
    lastX = event.clientX;
    lastY = event.clientY;
    onUserDrag();
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
      distance = clamp(
        distance * (1 + event.deltaY * v.zoomSensitivity),
        v.cameraDistanceMin,
        v.cameraDistanceMax
      );
    },
    { passive: false }
  );

  return {
    setView(newYaw, newPitch) {
      yaw = newYaw;
      pitch = newPitch;
    },
    place() {
      const maxPitch = degToRad(v.maxPitchDeg);
      pitch = clamp(pitch, -maxPitch, maxPitch);
      camera.position.set(
        distance * Math.cos(pitch) * Math.sin(yaw),
        distance * Math.sin(pitch),
        distance * Math.cos(pitch) * Math.cos(yaw)
      );
      camera.lookAt(0, 0, 0);
    },
  };
}
