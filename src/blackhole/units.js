// 크기를 사람이 읽기 좋게 쓰는 도구 (순수 계산, 화면 요소를 모른다).
const KM_PER_AU = 149597870.7;
const KM_PER_MAN = 1e4; // 만 km
const MAN_FROM_KM = 1e4; // 이 길이(km) 이상이면 만 km로 쓴다
const AU_FROM_KM = 1.5e7; // 이 길이(km) 이상이면 AU로 쓴다
const MASS_MAN = 1e4;
const MASS_EOK = 1e8;

// 유효숫자 3자리 안팎으로, 끝의 0은 지운다
function sig(value) {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return String(Number(value.toFixed(digits)));
}

const withGroups = (value) => Number(value.toFixed(0)).toLocaleString('ko-KR');

// 길이(km)를 km, 만 km, AU 중 알맞은 단위로 쓴다
export function formatLength(km) {
  if (km >= AU_FROM_KM) {
    const au = km / KM_PER_AU;
    return `${au >= 100 ? withGroups(au) : sig(au)} AU`;
  }
  if (km >= MAN_FROM_KM) {
    const man = km / KM_PER_MAN;
    return `${man >= 100 ? withGroups(man) : sig(man)}만 km`;
  }
  return `${km >= 100 ? withGroups(km) : sig(km)} km`;
}

// 질량(태양 질량 단위)
export function formatSolarMass(mass) {
  if (mass >= MASS_EOK) return `${sig(mass / MASS_EOK)}억 태양`;
  if (mass >= MASS_MAN) return `${mass / MASS_MAN >= 100 ? withGroups(mass / MASS_MAN) : sig(mass / MASS_MAN)}만 태양`;
  return `${mass >= 100 ? withGroups(mass) : sig(mass)} 태양`;
}

// 1, 2, 5 × 10^n 중 target 이하에서 가장 큰 값
export function niceNumber(target) {
  const exponent = Math.floor(Math.log10(target));
  const base = 10 ** exponent;
  const ratio = target / base;
  const step = ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1;
  return step * base;
}

// 눈금자: 길이가 targetKm 이하이면서 읽기 쉬운 값(단위 안에서 1, 2, 5 × 10^n)
export function niceScaleBar(targetKm) {
  const unit = targetKm >= AU_FROM_KM ? KM_PER_AU : targetKm >= MAN_FROM_KM ? KM_PER_MAN : 1;
  const km = niceNumber(targetKm / unit) * unit;
  return { km, label: formatLength(km) };
}
