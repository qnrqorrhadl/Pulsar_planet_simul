// 모드마다 같은 슬라이더, 일시정지 버튼 동작을 쓴다.
const SLIDER_STEPS = 1000;

const toPosition = (range, value) =>
  range.log
    ? Math.log(value / range.min) / Math.log(range.max / range.min)
    : (value - range.min) / (range.max - range.min);

const fromPosition = (range, position) =>
  range.log
    ? range.min * Math.pow(range.max / range.min, position)
    : range.min + position * (range.max - range.min);

// definitions: [{ id, key, format }]  id는 슬라이더, `${id}-value`는 값 표시 칸
// 돌려주는 syncAll()은 코드에서 state 값을 바꾼 뒤(예: 마우스 드래그) 슬라이더 위치와 값 표시에 반영한다.
export function bindSliders(doc, definitions, ranges, state) {
  const syncers = [];
  for (const { id, key, format } of definitions) {
    const input = doc.getElementById(id);
    const output = doc.getElementById(`${id}-value`);
    const range = ranges[key];
    input.min = 0;
    input.max = SLIDER_STEPS;
    input.step = 1;
    const sync = () => {
      input.value = Math.round(toPosition(range, state[key]) * SLIDER_STEPS);
      output.textContent = format(state[key]);
    };
    sync();
    input.addEventListener('input', () => {
      state[key] = fromPosition(range, Number(input.value) / SLIDER_STEPS);
      output.textContent = format(state[key]);
    });
    syncers.push(sync);
  }
  return { syncAll: () => syncers.forEach((sync) => sync()) };
}

export function bindPauseButton(doc, id, state) {
  const button = doc.getElementById(id);
  function sync() {
    button.textContent = state.paused ? '재생' : '일시정지';
    button.setAttribute('aria-pressed', String(state.paused));
  }
  button.addEventListener('click', () => {
    state.paused = !state.paused;
    sync();
  });
  sync();
}

export const formatDegrees = (value) => `${Math.round(value)}°`;
