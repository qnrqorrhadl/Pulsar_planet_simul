// index.html의 :root 색 토큰을 읽는다. 색의 출처는 항상 CSS 토큰 하나.
export const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
