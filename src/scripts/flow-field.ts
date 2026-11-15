// Three.js is bundled locally by Vite; the deployed page does not load a CDN.
// @ts-ignore The runtime package works without a separate @types dependency.
import * as THREE from 'three';

interface FlowFieldController {
  dispose: () => void;
}

const mountedFields = new WeakMap<HTMLElement, FlowFieldController>();

const vertexShader = `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uShape;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vEnergy;
  const float PI = 3.14159265359;

  void main() {
    vUv = uv;
    float a = uv.x * 2.0 * PI;
    float w = (uv.y - .5) * 2.0;
    float twist = 1.0 + uShape * .14;
    float ripple = .18 * sin(a * (3.0 + uShape * .25) + uTime * .32);
    float radius = 1.66 + .14 * sin(a * 2.0 + uShape * .7);
    vec3 center = vec3(cos(a) * radius, sin(a) * radius * .73, .30 * sin(a * 2.0 + uShape * .45));
    vec3 side = vec3(cos(a) * cos(a * twist + uShape * .25), sin(a) * cos(a * twist + uShape * .25), sin(a * twist + uShape * .25));
    vec3 p = center + side * w * (.55 + ripple);
    float distanceToPointer = length(p.xy - uPointer * 2.35);
    float wave = sin(distanceToPointer * 7.0 - uTime * 3.2) * exp(-distanceToPointer * 1.25);
    p.z += wave * .33;
    p.xy += normalize(p.xy + .001) * wave * .08;
    p.x *= 1.08 + .06 * sin(uShape);
    p.y += .12 * sin(a * 4.0 + uTime * .25 + uShape) * w;
    vEnergy = wave;
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vEnergy;

  void main() {
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (!gl_FrontFacing) normal = -normal;
    vec3 eye = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(dot(normal, eye)), 2.2);
    vec3 lightA = normalize(vec3(-.5, .85, 1.0));
    vec3 lightB = normalize(vec3(.9, -.4, .3));
    float diffuse = max(dot(normal, lightA), 0.0) * .55 + max(dot(normal, lightB), 0.0) * .3;
    float specular = pow(max(dot(reflect(-lightA, normal), eye), 0.0), 35.0);
    float rim = pow(abs(vUv.y - .5) * 2.0, 9.0);
    float contour = 1.0 - smoothstep(.0, .07, abs(fract(vUv.y * 22.0) - .5));
    vec3 color = mix(vec3(.055, .115, .22), vec3(.64, .77, .91), diffuse);
    color += specular * vec3(.88, .96, 1.0) + fresnel * vec3(.17, .44, .80) + rim * vec3(.33, .70, 1.0);
    color += contour * .06 + max(vEnergy, 0.0) * vec3(.06, .12, .2);
    gl_FragColor = vec4(color, .96);
  }
`;

/** Mount one decorative, progressively enhanced field and its native controls. */
export function mountFlowField(root: HTMLElement): FlowFieldController {
  const mounted = mountedFields.get(root);
  if (mounted) return mounted;

  const mount = root.querySelector<HTMLElement>('[data-flow-mount]');
  const fallback = root.querySelector<HTMLElement>('[data-flow-fallback]');
  const controls = root.querySelector<HTMLElement>('[data-flow-controls]');
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-flow-pause]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-flow-reset]');
  if (!mount || !fallback || !controls || !pauseButton || !resetButton) {
    return { dispose() {} };
  }

  const abort = new AbortController();
  const { signal } = abort;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: any;
  let scene: any;
  let camera: any;
  let surfaceGeometry: any;
  let surfaceMaterial: any;
  let edgeGeometry: any;
  let edgeMaterial: any;
  let resizeObserver: ResizeObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let paused = media.matches;
  let inView = true;
  let disposed = false;
  let contextLost = false;
  let failed = false;
  let targetShape = 0;
  const pointerTarget = new THREE.Vector2();
  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uShape: { value: 0 },
  };

  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function showFallback() {
    stopFrame();
    root.dataset.flowStatus = 'fallback';
    fallback!.hidden = false;
    controls!.hidden = true;
    if (renderer) renderer.domElement.hidden = true;
  }

  function updateControls() {
    pauseButton!.textContent = paused ? '开启动效' : '暂停动效';
    pauseButton!.setAttribute('aria-pressed', String(!paused));
    root.dataset.flowMotion = paused ? 'paused' : 'playing';
  }

  function requestFrame() {
    if (!frame && !disposed && !failed && !contextLost && inView && !document.hidden) {
      lastTime = performance.now();
      frame = requestAnimationFrame(draw);
    }
  }

  function draw(time: number) {
    frame = 0;
    if (disposed || failed || contextLost || !inView || document.hidden) return;
    const delta = Math.min(.05, (time - lastTime) / 1000 || .016);
    lastTime = time;
    if (!paused) elapsed += delta;
    const easing = paused ? 1 : 1 - Math.exp(-delta * 7);
    uniforms.uTime.value = elapsed;
    uniforms.uShape.value += (targetShape - uniforms.uShape.value) * easing;
    uniforms.uPointer.value.lerp(pointerTarget, easing);
    try {
      renderer.render(scene, camera);
      if (failed || contextLost) return;
      root.dataset.flowStatus = 'ready';
      fallback!.hidden = true;
      controls!.hidden = false;
    } catch {
      failed = true;
      showFallback();
      return;
    }
    if (!paused) frame = requestAnimationFrame(draw);
  }

  function resize() {
    if (!renderer || disposed || contextLost || failed) return;
    const bounds = mount!.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    camera.aspect = bounds.width / bounds.height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalfFov = Math.atan(Math.tan(halfFov) * camera.aspect);
    camera.position.z = 2.65 / Math.sin(Math.min(halfFov, horizontalHalfFov));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5));
    renderer.setSize(bounds.width, bounds.height, false);
    requestFrame();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopFrame();
    abort.abort();
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    surfaceGeometry?.dispose();
    surfaceMaterial?.dispose();
    edgeGeometry?.dispose();
    edgeMaterial?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    fallback!.hidden = false;
    controls!.hidden = true;
    root.dataset.flowStatus = 'static';
    mountedFields.delete(root);
  }

  const controller = { dispose };
  mountedFields.set(root, controller);
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x080d15, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.debug.onShaderError = () => {
      failed = true;
      showFallback();
    };
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.append(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(33, 1, .1, 60);
    camera.position.set(0, .2, 9.3);
    camera.lookAt(0, 0, 0);
    const field = new THREE.Group();
    field.rotation.z = -.18;
    scene.add(field);
    surfaceGeometry = new THREE.PlaneGeometry(1, 1, 220, 52);
    surfaceMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true });
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surface.frustumCulled = false;
    field.add(surface);
    edgeGeometry = new THREE.PlaneGeometry(1, 1, 220, 1);
    edgeMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader: 'varying vec2 vUv; void main() { float edge = pow(abs(vUv.y-.5)*2.0,18.0); gl_FragColor = vec4(.36,.68,1.0,edge*.35); }',
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.frustumCulled = false;
    field.add(edge);

    mount.addEventListener('pointermove', (event: PointerEvent) => {
      if (paused || contextLost || event.pointerType === 'touch') return;
      const bounds = mount.getBoundingClientRect();
      pointerTarget.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
      requestFrame();
    }, { signal });
    mount.addEventListener('pointerleave', () => {
      if (!paused) { pointerTarget.set(0, 0); requestFrame(); }
    }, { signal });
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      updateControls();
      stopFrame();
      requestFrame();
    }, { signal });
    resetButton.addEventListener('click', () => {
      elapsed = 0;
      pointerTarget.set(0, 0);
      // Keep the selected subject in sync with the external category buttons.
      uniforms.uShape.value = targetShape;
      uniforms.uPointer.value.set(0, 0);
      requestFrame();
    }, { signal });
    const experience = root.closest<HTMLElement>('[data-home-experience]') || root;
    const initialTopic = Number(experience.querySelector('[data-flow-topic][aria-pressed="true"]')?.getAttribute('data-flow-topic'));
    if (Number.isInteger(initialTopic) && initialTopic >= 0 && initialTopic <= 5) {
      targetShape = initialTopic;
      uniforms.uShape.value = initialTopic;
    }
    experience.addEventListener('flow-topic', (event: Event) => {
      const index = (event as CustomEvent<{ index: number }>).detail?.index;
      if (!Number.isInteger(index) || index < 0 || index > 5) return;
      targetShape = index;
      requestFrame();
    }, { signal });
    media.addEventListener('change', () => {
      paused = media.matches;
      pointerTarget.set(0, 0);
      updateControls();
      stopFrame();
      requestFrame();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopFrame(); else requestFrame();
    }, { signal });
    document.addEventListener('astro:before-swap', dispose, { once: true, signal });
    window.addEventListener('pagehide', (event: PageTransitionEvent) => {
      if (!event.persisted) dispose(); else stopFrame();
    }, { signal });
    window.addEventListener('pageshow', requestFrame, { signal });
    renderer.domElement.addEventListener('webglcontextlost', (event: Event) => {
      event.preventDefault();
      contextLost = true;
      showFallback();
    }, { signal });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      renderer.domElement.hidden = false;
      resize();
    }, { signal });
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    visibilityObserver = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) requestFrame(); else stopFrame();
    }, { threshold: .01 });
    visibilityObserver.observe(root);
    updateControls();
    resize();
  } catch {
    failed = true;
    showFallback();
  }
  return controller;
}
