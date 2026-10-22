// 3D 장면에서 두 모드가 같이 쓰는 도구: 배경 별, 번지는 빛 스프라이트. (three.js는 index.html이 먼저 불러온다)
const THREE = window.THREE;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeGlowTexture(colorCss) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, colorCss);
  gradient.addColorStop(1, '#000000');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function makeGlowSprite(colorCss, opacity) {
  return new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(colorCss),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
}

// 구면 위에 고르게 흩어진 점. { count, radius, seed }
export function makeBackgroundStars({ count, radius, seed }, colorCss) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * ring * Math.cos(angle);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * ring * Math.sin(angle);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: new THREE.Color(colorCss),
      size: 0.28,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
}

// 별 표면: 가운데는 밝고 가장자리는 어둡게(림 다크닝). corona: [{ scale, opacity }]로 번지는 빛을 겹친다.
const STAR_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAGMENT = `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uLimbPower;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    gl_FragColor = vec4(mix(uEdge, uCore, pow(mu, uLimbPower)), 1.0);
  }
`;

export function makeStarBody({ radius, coreCss, edgeCss, limbPower, corona }) {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        uniforms: {
          uCore: { value: new THREE.Color(coreCss) },
          uEdge: { value: new THREE.Color(edgeCss) },
          uLimbPower: { value: limbPower },
        },
      })
    )
  );
  for (const { scale, opacity } of corona) {
    const glow = makeGlowSprite(edgeCss, opacity);
    glow.scale.setScalar(radius * scale);
    group.add(glow);
  }
  return group;
}
