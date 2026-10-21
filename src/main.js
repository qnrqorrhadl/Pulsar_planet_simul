import { createPulsarMode } from './pulsar/index.js';
import { createBlackHoleMode } from './blackhole/index.js';
import { createBinaryMode } from './binary/index.js';

const MAX_FRAME_SECONDS = 0.1;
const ERROR_MESSAGE =
  '이 화면을 만들지 못했어요. 브라우저가 3D 그래픽을 지원하는지 확인해 주세요.';

const MODE_FACTORIES = {
  pulsar: createPulsarMode,
  blackhole: createBlackHoleMode,
  binary: createBinaryMode,
};

const instances = {};
let currentName = null;

const errorBox = document.getElementById('mode-error');
const switchButtons = document.querySelectorAll('[data-target]');

// data-mode가 붙은 모든 요소(그림, 제목, 버튼, 조절판)를 현재 모드 것만 보이게 한다.
function showMode(name) {
  for (const element of document.querySelectorAll('[data-mode]')) {
    element.hidden = element.dataset.mode !== name;
  }
  for (const button of switchButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.target === name));
  }
}

function switchTo(name) {
  if (name === currentName) return;
  const previousName = currentName;
  showMode(name);
  try {
    instances[name] ??= MODE_FACTORIES[name](document);
  } catch (error) {
    console.error(error);
    if (previousName) showMode(previousName);
    errorBox.textContent = ERROR_MESSAGE;
    errorBox.hidden = false;
    return;
  }
  errorBox.hidden = true;
  if (previousName) instances[previousName].stop();
  currentName = name;
  instances[name].start();
}

for (const button of switchButtons) {
  button.addEventListener('click', () => switchTo(button.dataset.target));
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
  lastTime = now;
  if (currentName) instances[currentName].frame(dt);
  requestAnimationFrame(frame);
}

switchTo('pulsar');
requestAnimationFrame(frame);
