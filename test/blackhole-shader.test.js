import test from 'node:test';
import assert from 'node:assert';
import { parse } from '@shaderfrog/glsl-parser';
import { config } from '../src/blackhole/config.js';
import { BLACKHOLE_VERTEX, buildBlackHoleFragment } from '../src/blackhole/shader.js';

const fragment = buildBlackHoleFragment(
  config.tracing,
  config.disk,
  config.stars,
  config.jet,
  config.cloud,
  config.jetPrecessing
);

test('블랙홀 정점 셰이더는 문법 오류가 없다', () => {
  assert.doesNotThrow(() => parse(BLACKHOLE_VERTEX, { quiet: true }));
});

test('블랙홀 프래그먼트 셰이더는 문법 오류가 없다', () => {
  assert.doesNotThrow(() => parse(fragment, { quiet: true }));
});

test('설정 값이 셰이더에 들어간다', () => {
  assert.match(fragment, new RegExp(`MAX_STEPS = ${config.tracing.maxSteps};`));
  assert.match(fragment, /HORIZON = 1\.0000;/);
  assert.match(fragment, /BEAMING_POWER = 3\.0000;/);
  assert.match(fragment, /STAR_DENSITY = 0\.3000;/);
  assert.match(fragment, /BLUE_TINT = vec3\(0\.7500, 0\.9000, 1\.4000\);/);
  const band = config.stars.milkyWay;
  assert.match(fragment, new RegExp(`BAND_BRIGHTNESS = ${band.brightness.toFixed(4)};`));
  assert.match(fragment, new RegExp(`BAND_WIDTH = ${band.bandWidth.toFixed(4)};`));
});

test('먼 카메라의 시선 보정이 셰이더에 들어간다', () => {
  assert.match(fragment, /uniform float uTanHalfTrue;/);
  assert.match(fragment, /vec3 initialTrue/);
  assert.match(fragment, /backdrop = transmit \* \(uBackground \+ milkyWay\(sky\) \+ starfield\(sky\)\)/);
});

test('제트와 원반 켜기·끄기 스위치가 셰이더에 있다', () => {
  assert.match(fragment, /uniform float uJetMode;/);
  assert.match(fragment, /uniform float uCloudOn;/);
  assert.match(fragment, /uniform float uDiskOn;/);
  assert.match(fragment, /if \(uDiskOn > 0\.5 && previous\.y \* position\.y < 0\.0\)/);
  assert.match(fragment, new RegExp(`JET_SPEED = ${config.jet.speed.toFixed(4)};`));
});

test('설정한 모양이 모두 원반·제트 켜기 값을 가진다', () => {
  for (const shape of Object.values(config.shapes)) {
    assert.strictEqual(typeof shape.disk, 'boolean');
    assert.strictEqual(typeof shape.cloud, 'boolean');
    assert.ok(['none', 'straight', 'precessing'].includes(shape.jet), shape.jet);
  }
  assert.ok(Object.values(config.shapes).some((s) => s.id === config.defaultShape));
});

test('SS 433형 제트의 설정 값이 셰이더에 들어간다', () => {
  assert.match(fragment, new RegExp(`PREC_SPEED = ${config.jetPrecessing.speed.toFixed(4)};`));
  assert.match(fragment, /uniform vec3 uJetBlue;/);
  assert.match(fragment, /if \(uJetMode > 1\.5\)/);
});

test('두 제트의 덩어리(매듭) 설정이 셰이더에 들어가고 값이 올바르다', () => {
  for (const [jet, name] of [[config.jet, 'JET'], [config.jetPrecessing, 'PREC']]) {
    assert.ok(jet.knotSpacing > 0 && jet.knotFloor >= 0 && jet.knotFloor < 1);
    assert.match(fragment, new RegExp(`${name}_KNOT_SPACING = ${jet.knotSpacing.toFixed(4)};`));
  }
});

test('제트 불규칙함 조절 값이 모두 있고 셰이더에 들어간다', () => {
  for (const [jet, name] of [[config.jet, 'JET'], [config.jetPrecessing, 'PREC']]) {
    for (const key of ['wobble', 'wobbleScale', 'wobbleSpeed', 'swell', 'knotJitter', 'ragged', 'raggedScale', 'raggedSpeed']) {
      assert.strictEqual(typeof jet[key], 'number', `${name} ${key}`);
    }
    assert.ok(jet.wobbleScale > 0 && jet.raggedScale > 0);
    assert.match(fragment, new RegExp(`${name}_WOBBLE = ${jet.wobble.toFixed(4)};`));
  }
});

test('프리셋이 가리키는 원반 옷이 실제로 있고 값이 올바르다', () => {
  assert.ok(config.diskStyles[config.defaultDiskStyle]);
  for (const preset of Object.values(config.presets)) {
    if (preset.diskStyle !== undefined) assert.ok(config.diskStyles[preset.diskStyle], preset.diskStyle);
  }
  for (const style of Object.values(config.diskStyles)) {
    assert.ok(style.gain > 0 && style.outerRadius > 3);
    assert.match(fragment, /uniform float uDiskGain;/);
  }
});

test('프리셋이 가리키는 모양이 실제로 있다', () => {
  for (const preset of Object.values(config.presets)) {
    assert.ok(config.shapes[preset.shape], preset.shape);
    const { elevationDeg } = preset;
    if (elevationDeg !== undefined) {
      assert.ok(elevationDeg >= config.ranges.elevationDeg.min && elevationDeg <= config.ranges.elevationDeg.max);
    }
  }
});

test('은하수 띠가 배경에 더해진다', () => {
  assert.match(fragment, /vec3 milkyWay\(vec3 dir\)/);
  assert.match(fragment, /uBackground \+ milkyWay\(sky\) \+ starfield\(sky\)/);
});

test('셰이더의 도플러 식은 계산 모듈과 같은 형태다', () => {
  assert.match(fragment, /sqrt\(0\.5 \* HORIZON \/ \(radius - HORIZON\)\)/);
  assert.match(fragment, /1\.0 \/ \(gamma \* \(1\.0 - speed \* dot\(tangent, toObserver\)\)\)/);
  assert.match(fragment, /sqrt\(1\.0 - HORIZON \/ radius\)/);
});
