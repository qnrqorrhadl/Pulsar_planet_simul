import test from 'node:test';
import assert from 'node:assert';
import { parse } from '@shaderfrog/glsl-parser';
import { config } from '../src/blackhole/config.js';
import { BLACKHOLE_VERTEX, buildBlackHoleFragment } from '../src/blackhole/shader.js';

const fragment = buildBlackHoleFragment(config.tracing, config.disk, config.stars);

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

test('은하수 띠가 배경에 더해진다', () => {
  assert.match(fragment, /vec3 milkyWay\(vec3 dir\)/);
  assert.match(fragment, /uBackground \+ milkyWay\(sky\) \+ starfield\(sky\)/);
});

test('셰이더의 도플러 식은 계산 모듈과 같은 형태다', () => {
  assert.match(fragment, /sqrt\(0\.5 \* HORIZON \/ \(radius - HORIZON\)\)/);
  assert.match(fragment, /1\.0 \/ \(gamma \* \(1\.0 - speed \* dot\(tangent, toObserver\)\)\)/);
  assert.match(fragment, /sqrt\(1\.0 - HORIZON \/ radius\)/);
});
