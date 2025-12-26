/**
 * AI Battleship Arena - Main Application
 * 4K Cinematic Spectator Experience with Three.js
 */

// ============= CONFIGURATION =============
const CONFIG = {
  gridSize: 10,
  cellSize: 1,
  shipColors: {
    claude: 0x8b5cf6,
    gemini: 0x10b981,
    codex: 0xf97316,
  },
};

// ============= GLOBAL STATE =============
let socket = null;
let leftScene, rightScene;
let leftIsoScene, rightIsoScene;
let currentView = '3d'; // '3d' or 'iso'
let matchStartTime = null;
let timerInterval = null;
let comboCount = 0;
let lastHitPlayer = null;

// ============= AUDIO MANAGER =============
const AudioManager = {
  sounds: {},
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.sounds.hit = new Howl({
      src: ['https://cdn.freesound.org/previews/587/587199_12978606-lq.mp3'],
      volume: 0.5
    });
    this.sounds.miss = new Howl({
      src: ['https://cdn.freesound.org/previews/398/398032_7566783-lq.mp3'],
      volume: 0.3
    });
    this.sounds.explosion = new Howl({
      src: ['https://cdn.freesound.org/previews/514/514416_11395991-lq.mp3'],
      volume: 0.6
    });
    this.sounds.sonar = new Howl({
      src: ['https://cdn.freesound.org/previews/389/389815_5229247-lq.mp3'],
      volume: 0.2
    });
  },

  play(sound) {
    if (this.sounds[sound]) {
      this.sounds[sound].play();
    }
  }
};

// ============= EPIC BATTLE SCENE =============
class BattleScene {
  constructor(canvasId, playerType, playerColor) {
    this.canvas = document.getElementById(canvasId);
    this.playerType = playerType;
    this.playerColor = playerColor;
    this.ships = [];
    this.effects = [];
    this.markers = []; // Track hit/miss/sunk markers for clearing
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    // Scene with dark atmosphere
    this.scene = new THREE.Scene();

    // Epic gradient sky
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0a0a1a) },
        bottomColor: { value: new THREE.Color(0x001a33) },
        offset: { value: 20 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Fog for atmosphere
    this.scene.fog = new THREE.FogExp2(0x001a33, 0.015);

    // Camera with cinematic angle
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(5, 15, 18);
    this.camera.lookAt(5, 0, 5);

    // High-quality renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Cinematic lighting
    this.setupLighting();

    // Epic ocean
    this.createOcean();

    // Glowing grid
    this.createGrid();

    // Ambient particles
    this.createParticles();

    // Start animation loop
    this.animate();

    window.addEventListener('resize', () => this.onResize());
  }

  setupLighting() {
    // Moonlight
    const moonLight = new THREE.DirectionalLight(0x4466aa, 0.8);
    moonLight.position.set(-10, 30, -10);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 4096;
    moonLight.shadow.mapSize.height = 4096;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 100;
    moonLight.shadow.camera.left = -20;
    moonLight.shadow.camera.right = 20;
    moonLight.shadow.camera.top = 20;
    moonLight.shadow.camera.bottom = -20;
    this.scene.add(moonLight);

    // Ambient
    const ambient = new THREE.AmbientLight(0x112244, 0.4);
    this.scene.add(ambient);

    // Rim light (dramatic backlight)
    const rimLight = new THREE.DirectionalLight(0x00aaff, 0.5);
    rimLight.position.set(10, 5, -15);
    this.scene.add(rimLight);

    // Point lights for drama
    const pointLight1 = new THREE.PointLight(0x00d4ff, 1, 30);
    pointLight1.position.set(0, 5, 0);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff4400, 0.5, 20);
    pointLight2.position.set(10, 3, 10);
    this.scene.add(pointLight2);

    this.pointLight1 = pointLight1;
    this.pointLight2 = pointLight2;
  }

  createOcean() {
    // Ultra-high quality 4K ocean with caustics, subsurface scattering, and reflections
    const oceanGeo = new THREE.PlaneGeometry(100, 100, 512, 512);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        // Wave parameters
        uWaveHeight: { value: 0.12 },
        uWaveSpeed: { value: 0.4 },
        // Colors - tropical clear water
        uDeepColor: { value: new THREE.Color(0x001830) },
        uShallowColor: { value: new THREE.Color(0x006994) },
        uSurfaceColor: { value: new THREE.Color(0x00b4d8) },
        uFoamColor: { value: new THREE.Color(0xd4f1f9) },
        uCausticColor: { value: new THREE.Color(0x00ffff) },
        // Environment
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uSunColor: { value: new THREE.Color(0xfffaed) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWaveHeight;
        uniform float uWaveSpeed;

        varying float vElevation;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Simplex noise functions
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        float fbm(vec2 p) {
          float f = 0.0;
          float w = 0.5;
          for (int i = 0; i < 5; i++) {
            f += w * snoise(p);
            p *= 2.0;
            w *= 0.5;
          }
          return f;
        }

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);

          // Multi-octave wave displacement
          float t = uTime * uWaveSpeed;
          vec2 p1 = worldPos.xz * 0.15 + t * 0.5;
          vec2 p2 = worldPos.xz * 0.08 - t * 0.3;
          vec2 p3 = worldPos.xz * 0.25 + vec2(t * 0.2, -t * 0.4);

          float wave1 = sin(worldPos.x * 0.5 + t * 2.0) * sin(worldPos.z * 0.3 + t * 1.5) * 0.5;
          float wave2 = snoise(p1) * 0.4;
          float wave3 = snoise(p2) * 0.3;
          float wave4 = fbm(p3) * 0.2;

          float elevation = (wave1 + wave2 + wave3 + wave4) * uWaveHeight;
          worldPos.y += elevation;

          // Calculate displaced normal for proper lighting
          float eps = 0.01;
          float hL = snoise(p1 + vec2(-eps, 0.0)) * 0.4 + snoise(p2 + vec2(-eps, 0.0)) * 0.3;
          float hR = snoise(p1 + vec2(eps, 0.0)) * 0.4 + snoise(p2 + vec2(eps, 0.0)) * 0.3;
          float hD = snoise(p1 + vec2(0.0, -eps)) * 0.4 + snoise(p2 + vec2(0.0, -eps)) * 0.3;
          float hU = snoise(p1 + vec2(0.0, eps)) * 0.4 + snoise(p2 + vec2(0.0, eps)) * 0.3;
          vec3 calcNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

          gl_Position = projectionMatrix * viewMatrix * worldPos;
          vElevation = elevation;
          vWorldPosition = worldPos.xyz;
          vNormal = calcNormal;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uSurfaceColor;
        uniform vec3 uFoamColor;
        uniform vec3 uCausticColor;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;

        varying float vElevation;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Caustics pattern
        float causticPattern(vec2 p, float t) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float v = 0.0;
          for(int y = -1; y <= 1; y++) {
            for(int x = -1; x <= 1; x++) {
              vec2 g = vec2(float(x), float(y));
              vec2 o = fract(sin(vec2(dot(i + g, vec2(127.1, 311.7)), dot(i + g, vec2(269.5, 183.3)))) * 43758.5453);
              o = 0.5 + 0.5 * sin(t + 6.283 * o);
              vec2 r = g + o - f;
              float d = length(r);
              v += exp(-8.0 * d);
            }
          }
          return v * 0.25;
        }

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 normal = normalize(vNormal);

          // Fresnel effect
          float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);
          fresnel = mix(0.04, 1.0, fresnel);

          // Depth-based coloring
          float depthFactor = smoothstep(-0.1, 0.1, vElevation);
          vec3 waterColor = mix(uDeepColor, uShallowColor, depthFactor * 0.5);
          waterColor = mix(waterColor, uSurfaceColor, depthFactor);

          // Caustics
          float caustic1 = causticPattern(vWorldPosition.xz * 2.0, uTime * 0.8);
          float caustic2 = causticPattern(vWorldPosition.xz * 2.5 + 3.0, uTime * 0.6 + 1.0);
          float caustics = (caustic1 + caustic2) * 0.5;
          caustics = pow(caustics, 2.0) * 0.8;

          // Apply caustics more on shallow/bright areas
          waterColor += uCausticColor * caustics * (1.0 - fresnel) * 0.4;

          // Sun specular
          vec3 halfDir = normalize(uSunDirection + viewDir);
          float specular = pow(max(dot(normal, halfDir), 0.0), 256.0);
          vec3 sunReflection = uSunColor * specular * 2.0;

          // Scattered light (subsurface)
          float scatter = pow(max(dot(-uSunDirection, normal), 0.0), 2.0);
          vec3 subsurface = uShallowColor * scatter * 0.3;

          // Foam on peaks
          float foamMask = smoothstep(0.03, 0.08, vElevation);
          foamMask *= (1.0 + caustics * 0.5);
          vec3 foam = uFoamColor * foamMask * 0.6;

          // Combine
          vec3 finalColor = waterColor;
          finalColor += subsurface;
          finalColor += sunReflection;
          finalColor += foam;

          // Sky reflection via fresnel
          vec3 skyColor = vec3(0.1, 0.2, 0.4);
          finalColor = mix(finalColor, skyColor, fresnel * 0.5);

          // Tone mapping
          finalColor = finalColor / (finalColor + vec3(1.0));
          finalColor = pow(finalColor, vec3(0.9));

          gl_FragColor = vec4(finalColor, 0.92);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.ocean = new THREE.Mesh(oceanGeo, oceanMat);
    this.ocean.position.set(5, -0.3, 5);
    this.scene.add(this.ocean);
  }

  createGrid() {
    // Glowing grid lines
    const gridGroup = new THREE.Group();

    for (let i = 0; i <= 10; i++) {
      // Horizontal lines
      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.05, i),
        new THREE.Vector3(10, 0.05, i)
      ]);
      const hMat = new THREE.LineBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.3
      });
      gridGroup.add(new THREE.Line(hGeo, hMat));

      // Vertical lines
      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, 0.05, 0),
        new THREE.Vector3(i, 0.05, 10)
      ]);
      gridGroup.add(new THREE.Line(vGeo, hMat.clone()));
    }

    // Add column letters
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    // Would add sprite text here

    this.scene.add(gridGroup);
  }

  createParticles() {
    // Floating dust particles for atmosphere
    const particlesGeo = new THREE.BufferGeometry();
    const count = 500;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 50;
      positions[i + 1] = Math.random() * 20;
      positions[i + 2] = (Math.random() - 0.5) * 50;
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particlesMat = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    });

    this.particles = new THREE.Points(particlesGeo, particlesMat);
    this.scene.add(this.particles);
  }

  createShip(shipData, color) {
    const positions = shipData.positions;
    const length = positions.length;
    const startPos = positions[0];
    const endPos = positions[positions.length - 1];
    const isHorizontal = startPos.row === endPos.row;
    const shipType = shipData.type;

    // Ship group
    const shipGroup = new THREE.Group();

    // Materials
    const hullMat = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.7,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 0.1,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x333340,
      metalness: 0.5,
      roughness: 0.6,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x555566,
      metalness: 0.9,
      roughness: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
    });

    // Different ship configurations based on type
    if (shipType === 'carrier' || length === 5) {
      // AIRCRAFT CARRIER - flat deck with control tower
      const hullLength = length * 0.9;

      // Main hull
      const hullGeo = new THREE.BoxGeometry(hullLength, 0.25, 0.7);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.125;
      hull.castShadow = true;
      shipGroup.add(hull);

      // Flight deck (flat top)
      const deckGeo = new THREE.BoxGeometry(hullLength, 0.05, 0.75);
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.y = 0.275;
      shipGroup.add(deck);

      // Deck markings (runway lines)
      for (let i = -2; i <= 2; i++) {
        const lineGeo = new THREE.BoxGeometry(0.8, 0.01, 0.03);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set(i * 0.9, 0.31, 0);
        shipGroup.add(line);
      }

      // Island (control tower) - offset to side
      const islandGeo = new THREE.BoxGeometry(0.5, 0.5, 0.25);
      const island = new THREE.Mesh(islandGeo, metalMat);
      island.position.set(0.8, 0.55, 0.25);
      island.castShadow = true;
      shipGroup.add(island);

      // Radar dome
      const radarGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const radar = new THREE.Mesh(radarGeo, metalMat);
      radar.position.set(0.8, 0.9, 0.25);
      shipGroup.add(radar);

      // Antenna array
      const antennaGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.4);
      const antenna = new THREE.Mesh(antennaGeo, metalMat);
      antenna.position.set(0.8, 1.1, 0.25);
      shipGroup.add(antenna);

      // Aircraft on deck (small triangles)
      for (let i = 0; i < 3; i++) {
        const planeGeo = new THREE.ConeGeometry(0.06, 0.15, 3);
        planeGeo.rotateX(-Math.PI / 2);
        const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0x666688 }));
        plane.position.set(-1.5 + i * 0.8, 0.32, -0.15);
        shipGroup.add(plane);
      }

    } else if (shipType === 'battleship' || length === 4) {
      // BATTLESHIP - heavy with gun turrets
      const hullLength = length * 0.85;

      // Tapered hull
      const hullShape = new THREE.Shape();
      hullShape.moveTo(-hullLength / 2, -0.25);
      hullShape.lineTo(hullLength / 2 - 0.3, -0.25);
      hullShape.quadraticCurveTo(hullLength / 2, 0, hullLength / 2 - 0.3, 0.25);
      hullShape.lineTo(-hullLength / 2, 0.25);
      hullShape.lineTo(-hullLength / 2, -0.25);

      const extrudeSettings = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04 };
      const hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
      hullGeo.rotateX(-Math.PI / 2);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.castShadow = true;
      shipGroup.add(hull);

      // Deck
      const deckGeo = new THREE.BoxGeometry(hullLength * 0.9, 0.05, 0.45);
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.y = 0.32;
      shipGroup.add(deck);

      // Forward turrets (2 double guns)
      for (let i = 0; i < 2; i++) {
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1), metalMat);
        turretBase.position.set(hullLength * 0.15 + i * 0.45, 0.4, 0);
        shipGroup.add(turretBase);

        // Guns
        for (let g = -1; g <= 1; g += 2) {
          const gunGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35);
          gunGeo.rotateZ(Math.PI / 2);
          const gun = new THREE.Mesh(gunGeo, metalMat);
          gun.position.set(hullLength * 0.15 + i * 0.45 + 0.2, 0.42, g * 0.05);
          shipGroup.add(gun);
        }
      }

      // Bridge
      const bridgeGeo = new THREE.BoxGeometry(0.35, 0.4, 0.3);
      const bridge = new THREE.Mesh(bridgeGeo, metalMat);
      bridge.position.set(-0.3, 0.52, 0);
      bridge.castShadow = true;
      shipGroup.add(bridge);

      // Bridge windows
      const windowGeo = new THREE.BoxGeometry(0.3, 0.08, 0.02);
      const window = new THREE.Mesh(windowGeo, glassMat);
      window.position.set(-0.3, 0.6, 0.16);
      shipGroup.add(window);

      // Rear turret
      const rearTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1), metalMat);
      rearTurret.position.set(-hullLength * 0.3, 0.38, 0);
      shipGroup.add(rearTurret);

      // Funnel/smokestack
      const funnelGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.3);
      const funnel = new THREE.Mesh(funnelGeo, new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
      funnel.position.set(-0.1, 0.55, 0);
      shipGroup.add(funnel);

    } else if (shipType === 'submarine' || (length === 3 && shipData.type === 'submarine')) {
      // SUBMARINE - sleek cylindrical with conning tower
      const hullLength = length * 0.85;

      // Main hull (cylinder)
      const hullGeo = new THREE.CapsuleGeometry(0.15, hullLength - 0.3, 16, 16);
      hullGeo.rotateZ(Math.PI / 2);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.05;
      hull.castShadow = true;
      shipGroup.add(hull);

      // Conning tower (sail)
      const towerGeo = new THREE.BoxGeometry(0.25, 0.25, 0.15);
      const tower = new THREE.Mesh(towerGeo, hullMat);
      tower.position.set(0.2, 0.25, 0);
      tower.castShadow = true;
      shipGroup.add(tower);

      // Periscopes
      const scopeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2);
      const scope1 = new THREE.Mesh(scopeGeo, metalMat);
      scope1.position.set(0.25, 0.47, 0);
      shipGroup.add(scope1);

      const scope2 = new THREE.Mesh(scopeGeo, metalMat);
      scope2.position.set(0.15, 0.45, 0);
      shipGroup.add(scope2);

      // Propeller
      const propGeo = new THREE.CircleGeometry(0.1, 4);
      const prop = new THREE.Mesh(propGeo, metalMat);
      prop.position.set(-hullLength / 2 + 0.05, 0.05, 0);
      prop.rotation.y = Math.PI / 2;
      shipGroup.add(prop);

      // Diving planes
      for (let side = -1; side <= 1; side += 2) {
        const planeGeo = new THREE.BoxGeometry(0.15, 0.02, 0.08);
        const plane = new THREE.Mesh(planeGeo, hullMat);
        plane.position.set(0.2, 0.15, side * 0.18);
        shipGroup.add(plane);
      }

    } else if (shipType === 'cruiser' || length === 3) {
      // CRUISER - medium ship with guns
      const hullLength = length * 0.85;

      const hullGeo = new THREE.BoxGeometry(hullLength, 0.22, 0.4);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.11;
      hull.castShadow = true;
      shipGroup.add(hull);

      // Pointed bow
      const bowGeo = new THREE.ConeGeometry(0.2, 0.3, 4);
      bowGeo.rotateZ(-Math.PI / 2);
      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.position.set(hullLength / 2 + 0.1, 0.11, 0);
      shipGroup.add(bow);

      // Bridge
      const bridgeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.25);
      const bridge = new THREE.Mesh(bridgeGeo, metalMat);
      bridge.position.set(0, 0.37, 0);
      bridge.castShadow = true;
      shipGroup.add(bridge);

      // Forward gun
      const gunTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06), metalMat);
      gunTurret.position.set(hullLength * 0.3, 0.25, 0);
      shipGroup.add(gunTurret);

      const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25), metalMat);
      gunBarrel.rotateZ(Math.PI / 2);
      gunBarrel.position.set(hullLength * 0.3 + 0.15, 0.27, 0);
      shipGroup.add(gunBarrel);

      // Radar mast
      const mastGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.35);
      const mast = new THREE.Mesh(mastGeo, metalMat);
      mast.position.set(0, 0.7, 0);
      shipGroup.add(mast);

    } else {
      // DESTROYER - small, fast, single gun
      const hullLength = length * 0.85;

      const hullGeo = new THREE.BoxGeometry(hullLength, 0.18, 0.3);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.09;
      hull.castShadow = true;
      shipGroup.add(hull);

      // Sharp bow
      const bowGeo = new THREE.ConeGeometry(0.15, 0.25, 4);
      bowGeo.rotateZ(-Math.PI / 2);
      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.position.set(hullLength / 2 + 0.08, 0.09, 0);
      shipGroup.add(bow);

      // Small bridge
      const bridgeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.18);
      const bridge = new THREE.Mesh(bridgeGeo, metalMat);
      bridge.position.set(-0.1, 0.28, 0);
      bridge.castShadow = true;
      shipGroup.add(bridge);

      // Single gun turret
      const gunMount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05), metalMat);
      gunMount.position.set(hullLength * 0.25, 0.2, 0);
      shipGroup.add(gunMount);

      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2), metalMat);
      gun.rotateZ(Math.PI / 2);
      gun.position.set(hullLength * 0.25 + 0.12, 0.22, 0);
      shipGroup.add(gun);
    }

    // Navigation lights (all ships)
    const redLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.025),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    redLight.position.set(0, 0.5, -0.2);
    shipGroup.add(redLight);

    const greenLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.025),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    greenLight.position.set(0, 0.5, 0.2);
    shipGroup.add(greenLight);

    // Engine glow (all ships)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08), glowMat);
    const hullLength = length * 0.85;
    glow.position.set(-hullLength / 2 + 0.05, 0.1, 0);
    shipGroup.add(glow);

    // Position and rotate
    const centerX = (startPos.col + endPos.col) / 2 + 0.5;
    const centerZ = (startPos.row + endPos.row) / 2 + 0.5;
    shipGroup.position.set(centerX, 0.15, centerZ);

    if (!isHorizontal) {
      shipGroup.rotation.y = Math.PI / 2;
    }

    this.scene.add(shipGroup);
    this.ships.push({
      mesh: shipGroup,
      data: shipData,
      isHorizontal,
      originalY: 0.15,
    });

    return shipGroup;
  }

  createHitEffect(coord) {
    const x = coord.col + 0.5;
    const z = coord.row + 0.5;

    // Fire pillar
    const fireGroup = new THREE.Group();
    fireGroup.position.set(x, 0, z);

    // Core fire
    for (let i = 0; i < 8; i++) {
      const fireGeo = new THREE.ConeGeometry(0.15 + Math.random() * 0.1, 0.8 + Math.random() * 0.4, 8);
      const fireMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 1, 0.5),
        transparent: true,
        opacity: 0.8,
      });
      const fire = new THREE.Mesh(fireGeo, fireMat);
      fire.position.set((Math.random() - 0.5) * 0.2, 0.4, (Math.random() - 0.5) * 0.2);
      fire.rotation.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3);
      fireGroup.add(fire);
    }

    this.scene.add(fireGroup);
    this.effects.push({ mesh: fireGroup, type: 'fire', created: Date.now() });

    // Smoke
    this.createSmoke(x, z);

    // Screen shake effect
    this.shake(0.1, 200);

    AudioManager.play('hit');
  }

  createMissEffect(coord) {
    const x = coord.col + 0.5;
    const z = coord.row + 0.5;

    // Water column
    const splashGroup = new THREE.Group();
    splashGroup.position.set(x, 0, z);

    // Central column
    const columnGeo = new THREE.CylinderGeometry(0.1, 0.3, 1.5, 16);
    const columnMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.7,
    });
    const column = new THREE.Mesh(columnGeo, columnMat);
    column.position.y = 0.75;
    splashGroup.add(column);

    // Splash ring
    const ringGeo = new THREE.RingGeometry(0.2, 0.6, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.1;
    splashGroup.add(ring);

    this.scene.add(splashGroup);
    this.effects.push({ mesh: splashGroup, type: 'splash', created: Date.now() });

    // Animate
    gsap.to(column.scale, { x: 0.5, y: 0, z: 0.5, duration: 0.8, ease: "power2.out" });
    gsap.to(column.position, { y: 0, duration: 0.8, ease: "power2.out" });
    gsap.to(ring.scale, { x: 4, y: 4, z: 4, duration: 1, ease: "power2.out" });
    gsap.to(ringMat, { opacity: 0, duration: 1, ease: "power2.out", onComplete: () => {
      this.scene.remove(splashGroup);
    }});

    AudioManager.play('miss');
  }

  createExplosion(coord) {
    const x = coord.col + 0.5;
    const z = coord.row + 0.5;

    // Massive explosion
    const explosionGroup = new THREE.Group();
    explosionGroup.position.set(x, 0.5, z);

    // Core explosion sphere
    const coreGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    explosionGroup.add(core);

    // Outer ring
    const ringGeo = new THREE.TorusGeometry(0.5, 0.2, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    explosionGroup.add(ring);

    this.scene.add(explosionGroup);

    // Animate explosion
    gsap.to(core.scale, { x: 8, y: 8, z: 8, duration: 0.6, ease: "power2.out" });
    gsap.to(coreMat, { opacity: 0, duration: 0.6, ease: "power2.out" });
    gsap.to(ring.scale, { x: 6, y: 6, z: 6, duration: 0.5, ease: "power2.out" });
    gsap.to(ringMat, { opacity: 0, duration: 0.5, ease: "power2.out", onComplete: () => {
      this.scene.remove(explosionGroup);
    }});

    // Debris
    for (let i = 0; i < 30; i++) {
      this.createDebris(x, z);
    }

    // Screen shake
    this.shake(0.3, 500);

    // Heavy smoke
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.createSmoke(x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5), i * 100);
    }

    AudioManager.play('explosion');
  }

  createSmoke(x, z) {
    for (let i = 0; i < 8; i++) {
      const smokeGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 8, 8);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(
        x + (Math.random() - 0.5) * 0.3,
        0.3,
        z + (Math.random() - 0.5) * 0.3
      );
      this.scene.add(smoke);

      gsap.to(smoke.position, {
        y: 3 + Math.random() * 2,
        x: x + (Math.random() - 0.5) * 2,
        z: z + (Math.random() - 0.5) * 2,
        duration: 2 + Math.random(),
        ease: "power1.out"
      });
      gsap.to(smoke.scale, {
        x: 3, y: 3, z: 3,
        duration: 2,
      });
      gsap.to(smokeMat, {
        opacity: 0,
        duration: 2,
        onComplete: () => this.scene.remove(smoke)
      });
    }
  }

  createDebris(x, z) {
    const debrisGeo = new THREE.BoxGeometry(0.08, 0.08, 0.15);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.8,
      roughness: 0.3,
    });
    const debris = new THREE.Mesh(debrisGeo, debrisMat);
    debris.position.set(x, 0.5, z);
    this.scene.add(debris);

    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    const height = 3 + Math.random() * 3;

    gsap.to(debris.position, {
      x: x + Math.cos(angle) * speed,
      y: height,
      z: z + Math.sin(angle) * speed,
      duration: 0.4,
      ease: "power2.out"
    });
    gsap.to(debris.position, {
      y: -1,
      duration: 1,
      delay: 0.4,
      ease: "power2.in",
      onComplete: () => this.scene.remove(debris)
    });
    gsap.to(debris.rotation, {
      x: Math.random() * 15,
      y: Math.random() * 15,
      z: Math.random() * 15,
      duration: 1.4,
    });
  }

  shake(intensity, duration) {
    const startPos = this.camera.position.clone();
    const startTime = Date.now();

    const shakeLoop = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        const decay = 1 - elapsed / duration;
        this.camera.position.x = startPos.x + (Math.random() - 0.5) * intensity * decay;
        this.camera.position.y = startPos.y + (Math.random() - 0.5) * intensity * decay;
        requestAnimationFrame(shakeLoop);
      } else {
        this.camera.position.copy(startPos);
      }
    };
    shakeLoop();
  }

  updateShips(shipsData, color) {
    this.ships.forEach(s => this.scene.remove(s.mesh));
    this.ships = [];
    shipsData.forEach(ship => this.createShip(ship, color));
  }

  markHit(coord) {
    this.createHitEffect(coord);
  }

  markMiss(coord) {
    this.createMissEffect(coord);
  }

  markSunk(coord) {
    this.createExplosion(coord);
  }

  // Silent versions for state restoration (no sound/effects)
  markHitSilent(coord) {
    this.createHitMarker(coord);
  }

  markMissSilent(coord) {
    this.createMissMarker(coord);
  }

  markSunkSilent(coord) {
    this.createHitMarker(coord);
  }

  createHitMarker(coord) {
    const x = coord.col + 0.5;
    const z = coord.row + 0.5;
    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.set(x, 0.3, z);
    this.scene.add(marker);
    this.markers.push(marker);
  }

  clearMarkers() {
    // Remove all markers from scene
    this.markers.forEach(marker => {
      this.scene.remove(marker);
      if (marker.geometry) marker.geometry.dispose();
      if (marker.material) marker.material.dispose();
    });
    this.markers = [];

    // Also clear ships
    this.ships.forEach(ship => {
      this.scene.remove(ship.mesh);
    });
    this.ships = [];

    // Clear effects
    this.effects.forEach(effect => {
      this.scene.remove(effect);
    });
    this.effects = [];
  }

  createMissMarker(coord) {
    const x = coord.col + 0.5;
    const z = coord.row + 0.5;
    const geo = new THREE.RingGeometry(0.1, 0.2, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide });
    const marker = new THREE.Mesh(geo, mat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.1, z);
    this.scene.add(marker);
    this.markers.push(marker);
  }

  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = this.clock.getElapsedTime();

    // Update ocean
    if (this.ocean) {
      this.ocean.material.uniforms.uTime.value = time;
    }

    // Animate ships (bob and sway)
    this.ships.forEach((ship, i) => {
      ship.mesh.position.y = ship.originalY + Math.sin(time * 0.8 + i) * 0.04;
      ship.mesh.rotation.x = Math.sin(time * 0.5 + i) * 0.02;
      ship.mesh.rotation.z = Math.cos(time * 0.4 + i * 0.5) * 0.015;
    });

    // Animate particles
    if (this.particles) {
      this.particles.rotation.y = time * 0.02;
    }

    // Animate point lights
    if (this.pointLight1) {
      this.pointLight1.intensity = 0.8 + Math.sin(time * 2) * 0.2;
    }

    // Cleanup old effects
    this.effects = this.effects.filter(effect => {
      if (Date.now() - effect.created > 5000) {
        this.scene.remove(effect.mesh);
        return false;
      }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  }
}

// ============= SOCKET.IO HANDLING =============
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('checkPlayers');
  });

  // Handle reconnection - restore match state
  socket.on('matchState', (state) => {
    console.log('Restoring match state:', state);
    restoreMatchState(state);
  });

  socket.on('spectatorCount', (count) => {
    document.getElementById('spectator-num').textContent = count;
  });

  socket.on('matchStarting', (data) => {
    console.log('Match starting:', data);
    updatePlayerUI(data.player1, data.player2);
    startTimer();
    showEndMatchButton();
  });

  socket.on('matchPhase', (data) => {
    updatePhase(data.phase);
    // Reset combo on new match
    if (data.phase === 'setup' || data.phase === 'playing') {
      comboCount = 0;
      lastHitPlayer = null;
    }
  });

  socket.on('boardState', (data) => {
    if (data.player1) {
      leftScene.updateShips(data.player1.ships, CONFIG.shipColors.claude);
      if (leftIsoScene) leftIsoScene.updateShips(data.player1.ships, '#8b5cf6');
    }
    if (data.player2) {
      rightScene.updateShips(data.player2.ships, CONFIG.shipColors.gemini);
      if (rightIsoScene) rightIsoScene.updateShips(data.player2.ships, '#10b981');
    }
  });

  socket.on('turnStart', (data) => {
    document.getElementById('turn-number').textContent = data.turn;
    AudioManager.play('sonar');

    // Highlight active player
    const p1Info = document.querySelector('.player-info.player1');
    const p2Info = document.querySelector('.player-info.player2');
    p1Info.classList.remove('active-turn');
    p2Info.classList.remove('active-turn');

    if (data.player === 'claude') {
      p1Info.classList.add('active-turn');
    } else {
      p2Info.classList.add('active-turn');
    }
  });

  socket.on('turnEnd', (data) => {
    updateLastMove(data);

    const scene = data.player === 'claude' ? rightScene : leftScene;
    const isoScene = data.player === 'claude' ? rightIsoScene : leftIsoScene;

    if (data.result === 'sunk') {
      scene.markSunk(data.coordObj);
      if (isoScene) isoScene.markSunk(data.coordObj);
      showActionOverlay('SUNK!', 'sunk');
      addKillFeedEntry(data.player, 'DESTROYED', data.shipSunk || 'Ship', data.coordinate, true);
      showStreakBadge('DESTRUCTION!');
      screenFlash('rgba(255, 100, 0, 0.4)');
      cameraShake(2);
      showDamageNumbers(data.coordinate, 'SUNK', true);
      updateCombo(data.player, true);
      AudioManager.play('explosion');
    } else if (data.result === 'hit') {
      scene.markHit(data.coordObj);
      if (isoScene) isoScene.markHit(data.coordObj);
      showActionOverlay('HIT!', 'hit');
      addKillFeedEntry(data.player, 'hit', 'target', data.coordinate, false);
      screenFlash('rgba(255, 50, 50, 0.2)');
      cameraShake(1);
      showDamageNumbers(data.coordinate, 1, false);
      updateCombo(data.player, true);
      AudioManager.play('hit');
    } else {
      scene.markMiss(data.coordObj);
      if (isoScene) isoScene.markMiss(data.coordObj);
      updateCombo(data.player, false);
      AudioManager.play('miss');
      // Only show miss text occasionally to not spam
      if (Math.random() < 0.3) {
        showActionOverlay('MISS', 'miss');
      }
    }

    if (data.state) {
      updateShipCounts(data.state.player1Ships, data.state.player2Ships);
    }
  });

  socket.on('trashTalk', (data) => {
    addTrashTalkMessage(data.player, data.message);
  });

  socket.on('matchComplete', (result) => {
    stopTimer();
    showVictory(result);
    hideEndMatchButton();
  });

  socket.on('matchEnded', (data) => {
    console.log('Match ended:', data.reason);
    stopTimer();
    resetUI();
    hideEndMatchButton();
  });

  socket.on('serverRestarting', () => {
    console.log('Server is restarting...');
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0e17;color:white;font-family:Orbitron,sans-serif;font-size:2rem;">Server Restarting... Refresh in a moment.</div>';
  });

  socket.on('serverReset', (data) => {
    console.log('Server reset:', data.message);
    // Reset UI state
    resetMatchUI();
    showActionOverlay('RESET', 'miss');
  });
}

function resetMatchUI() {
  // Reset all UI elements to initial state
  updatePhase('waiting');
  updateShipCounts(5, 5);
  document.getElementById('turn-number').textContent = '0';
  document.getElementById('last-move').innerHTML = '<span class="move-waiting">Waiting for battle to begin...</span>';
  document.getElementById('match-timer').textContent = '00:00';
  document.getElementById('trash-talk-messages').innerHTML = '';
  document.getElementById('kill-feed').innerHTML = '';
  document.getElementById('victory-overlay').classList.add('hidden');
  hideEndMatchButton();
  stopTimer();

  // Reset combo
  comboCount = 0;
  lastHitPlayer = null;

  // Clear 3D scenes
  if (leftScene) leftScene.clearMarkers();
  if (rightScene) rightScene.clearMarkers();

  // Clear isometric scenes
  if (leftIsoScene) leftIsoScene.clearMarkers();
  if (rightIsoScene) rightIsoScene.clearMarkers();
}

function showEndMatchButton() {
  document.getElementById('end-match-btn').classList.remove('hidden');
  document.getElementById('start-demo-btn').classList.add('hidden');
  document.getElementById('start-match-btn').classList.add('hidden');
}

function hideEndMatchButton() {
  document.getElementById('end-match-btn').classList.add('hidden');
  document.getElementById('start-demo-btn').classList.remove('hidden');
  document.getElementById('start-match-btn').classList.remove('hidden');
}

function resetUI() {
  document.getElementById('turn-number').textContent = '0';
  document.getElementById('match-timer').textContent = '00:00';
  document.getElementById('last-move').innerHTML = '<span class="move-waiting">Waiting for battle...</span>';
  document.getElementById('trash-talk-messages').innerHTML = '';
  document.getElementById('victory-overlay').classList.add('hidden');
  document.getElementById('kill-feed').innerHTML = '';
  updatePhase('waiting');
  updateShipCounts(5, 5);
}

// ============= TWITCH FLAIR FUNCTIONS =============
function showActionOverlay(text, type) {
  const overlay = document.getElementById('action-overlay');
  const textEl = document.getElementById('action-text');

  // Remove previous classes and content
  textEl.className = 'action-text ' + type;
  textEl.textContent = text;

  // Force re-animation
  overlay.classList.remove('hidden');
  textEl.style.animation = 'none';
  textEl.offsetHeight; // Trigger reflow
  textEl.style.animation = '';

  // Hide after animation
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 1500);
}

function addKillFeedEntry(attacker, action, target, coord, isSunk) {
  const feed = document.getElementById('kill-feed');
  const entry = document.createElement('div');
  entry.className = 'kill-entry' + (isSunk ? ' sunk' : '');

  entry.innerHTML = `
    <span class="attacker ${attacker}">${attacker.toUpperCase()}</span>
    <span class="action">${action}</span>
    <span class="target">${target}</span>
    <span class="coord">[${coord}]</span>
  `;

  feed.appendChild(entry);

  // Remove after animation completes
  setTimeout(() => {
    entry.remove();
  }, 3500);

  // Keep only last 5 entries
  while (feed.children.length > 5) {
    feed.removeChild(feed.firstChild);
  }
}

function showStreakBadge(text) {
  const badge = document.createElement('div');
  badge.className = 'streak-badge';
  badge.textContent = text;
  document.body.appendChild(badge);

  setTimeout(() => {
    badge.remove();
  }, 1000);
}

function screenFlash(color) {
  const flash = document.createElement('div');
  flash.className = 'screen-flash';
  flash.style.background = color;
  document.body.appendChild(flash);

  setTimeout(() => {
    flash.remove();
  }, 300);
}

function cameraShake(intensity = 1) {
  const arena = document.getElementById('battle-arena');
  arena.style.animation = 'none';
  arena.offsetHeight; // Trigger reflow
  arena.style.animation = `cameraShake ${0.3 * intensity}s ease-out`;

  setTimeout(() => {
    arena.style.animation = '';
  }, 300 * intensity);
}

function updateCombo(player, isHit) {
  if (isHit) {
    if (lastHitPlayer === player) {
      comboCount++;
    } else {
      comboCount = 1;
      lastHitPlayer = player;
    }

    if (comboCount >= 2) {
      showComboBadge(comboCount);
    }
  } else {
    // Miss breaks combo
    comboCount = 0;
    lastHitPlayer = null;
  }
}

function showComboBadge(count) {
  const badge = document.createElement('div');
  badge.className = 'combo-badge';

  let text = `${count}x COMBO`;
  if (count >= 5) text = `${count}x ULTRA COMBO!`;
  else if (count >= 3) text = `${count}x COMBO STREAK!`;

  badge.textContent = text;
  badge.style.setProperty('--combo-scale', 1 + (count * 0.1));
  document.body.appendChild(badge);

  setTimeout(() => {
    badge.remove();
  }, 1200);
}

function showDamageNumbers(coord, damage, isCritical) {
  const arena = document.getElementById('battle-arena');
  const dmgEl = document.createElement('div');
  dmgEl.className = 'damage-number' + (isCritical ? ' critical' : '');
  dmgEl.textContent = isCritical ? 'CRITICAL!' : `-${damage}`;
  dmgEl.style.left = `${50 + (Math.random() - 0.5) * 20}%`;
  dmgEl.style.top = `${40 + (Math.random() - 0.5) * 10}%`;
  arena.appendChild(dmgEl);

  setTimeout(() => {
    dmgEl.remove();
  }, 1000);
}

// ============= UI FUNCTIONS =============
function updatePlayerUI(player1, player2) {
  const p1Name = player1.name.split(' ')[0].toUpperCase();
  const p2Name = player2.name.split(' ')[0].toUpperCase();
  document.getElementById('p1-name').textContent = p1Name;
  document.getElementById('p2-name').textContent = p2Name;
  document.getElementById('p1-label').textContent = `${p1Name}'S FLEET`;
  document.getElementById('p2-label').textContent = `${p2Name}'S FLEET`;
}

function updatePhase(phase) {
  const badge = document.getElementById('phase-badge');
  badge.textContent = phase.toUpperCase();
  badge.className = 'phase-badge ' + phase;
}

function updateLastMove(data) {
  const el = document.getElementById('last-move');
  const cls = data.result === 'hit' ? 'hit' : data.result === 'sunk' ? 'sunk' : 'miss';
  el.innerHTML = `<span class="player">${data.player.toUpperCase()}</span> → <strong>${data.coordinate}</strong> → <span class="${cls}">${data.result.toUpperCase()}</span>`;
}

function updateShipCounts(p1Ships, p2Ships) {
  document.getElementById('p1-ships').textContent = `${p1Ships}/5`;
  document.getElementById('p2-ships').textContent = `${p2Ships}/5`;

  document.querySelectorAll('.player1 .ship-pip').forEach((pip, i) => {
    pip.className = 'ship-pip ' + (i < p1Ships ? 'active' : 'destroyed');
  });
  document.querySelectorAll('.player2 .ship-pip').forEach((pip, i) => {
    pip.className = 'ship-pip ' + (i < p2Ships ? 'active' : 'destroyed');
  });
}

function addTrashTalkMessage(player, message) {
  const container = document.getElementById('trash-talk-messages');
  const div = document.createElement('div');
  div.className = `trash-message ${player}`;
  div.innerHTML = `<span class="trash-player">${player.toUpperCase()}</span><span class="trash-text">${message}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  while (container.children.length > 5) container.removeChild(container.firstChild);
}

function startTimer() {
  matchStartTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - matchStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    document.getElementById('match-timer').textContent =
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

function showVictory(result) {
  // Create victory burst effects
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const burst = document.createElement('div');
      burst.className = 'victory-burst';
      burst.style.left = `${30 + Math.random() * 40}%`;
      burst.style.top = `${30 + Math.random() * 40}%`;
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 1000);
    }, i * 200);
  }

  // Big screen flash for victory
  screenFlash('rgba(251, 191, 36, 0.5)');
  cameraShake(3);

  // Show giant victory text first
  showActionOverlay('VICTORY!', 'victory');

  // Then show the victory overlay
  setTimeout(() => {
    document.getElementById('victory-overlay').classList.remove('hidden');
    document.getElementById('winner-name').textContent = result.winner.toUpperCase();
    document.getElementById('final-turns').textContent = result.turns;
    const elapsed = Date.now() - matchStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    document.getElementById('final-time').textContent =
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Play explosion sound for victory
    AudioManager.play('explosion');
  }, 1500);
}

// ============= STATE RESTORATION =============
function restoreMatchState(state) {
  if (!state || state.phase === 'waiting') {
    return; // Nothing to restore
  }

  // Update player UI
  updatePlayerUI(
    { type: state.player1.type, name: state.player1.name },
    { type: state.player2.type, name: state.player2.name }
  );

  // Update phase
  updatePhase(state.phase);

  // Update turn number
  document.getElementById('turn-number').textContent = state.turn;

  // Update ship counts
  updateShipCounts(state.player1.ships, state.player2.ships);

  // Restore timer from start time
  if (state.startTime) {
    matchStartTime = state.startTime;
    if (state.phase !== 'finished') {
      startTimerFromTime(state.startTime);
    } else {
      // Show final time
      const elapsed = Date.now() - state.startTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      document.getElementById('match-timer').textContent =
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  // Restore last move display
  if (state.lastMove) {
    updateLastMove(state.lastMove);
  }

  // Restore board state (ships)
  if (state.boards) {
    const p1Color = CONFIG.shipColors[state.player1.type] || CONFIG.shipColors.claude;
    const p2Color = CONFIG.shipColors[state.player2.type] || CONFIG.shipColors.gemini;
    const p1HexColor = '#' + p1Color.toString(16).padStart(6, '0');
    const p2HexColor = '#' + p2Color.toString(16).padStart(6, '0');

    if (state.boards.player1) {
      leftScene.updateShips(state.boards.player1.ships, p1Color);
      if (leftIsoScene) leftIsoScene.updateShips(state.boards.player1.ships, p1HexColor);
    }
    if (state.boards.player2) {
      rightScene.updateShips(state.boards.player2.ships, p2Color);
      if (rightIsoScene) rightIsoScene.updateShips(state.boards.player2.ships, p2HexColor);
    }
  }

  // Restore all hits and misses from turn history
  if (state.turnHistory && state.turnHistory.length > 0) {
    state.turnHistory.forEach((turn) => {
      // Determine which scene was hit (opponent's scene)
      const scene = turn.player === state.player1.type ? rightScene : leftScene;
      const isoScene = turn.player === state.player1.type ? rightIsoScene : leftIsoScene;

      if (turn.result === 'sunk') {
        scene.markSunkSilent(turn.coordObj);
        if (isoScene) isoScene.markSunkSilent(turn.coordObj);
      } else if (turn.result === 'hit') {
        scene.markHitSilent(turn.coordObj);
        if (isoScene) isoScene.markHitSilent(turn.coordObj);
      } else {
        scene.markMissSilent(turn.coordObj);
        if (isoScene) isoScene.markMissSilent(turn.coordObj);
      }
    });
  }

  // Show victory overlay if finished
  if (state.phase === 'finished' && state.winner) {
    showVictoryFromState(state);
  }
}

function startTimerFromTime(startTime) {
  if (timerInterval) clearInterval(timerInterval);
  matchStartTime = startTime;
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - matchStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    document.getElementById('match-timer').textContent =
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function showVictoryFromState(state) {
  document.getElementById('victory-overlay').classList.remove('hidden');
  document.getElementById('winner-name').textContent = state.winner.toUpperCase();
  document.getElementById('final-turns').textContent = state.turn;
  if (state.startTime) {
    const elapsed = Date.now() - state.startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    document.getElementById('final-time').textContent =
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

function setupEventHandlers() {
  document.getElementById('start-demo-btn').addEventListener('click', () => {
    socket.emit('startDemo');
  });

  document.getElementById('start-match-btn').addEventListener('click', () => {
    document.getElementById('match-modal').classList.remove('hidden');
  });

  document.getElementById('cancel-match').addEventListener('click', () => {
    document.getElementById('match-modal').classList.add('hidden');
  });

  document.getElementById('confirm-match').addEventListener('click', () => {
    const p1 = document.getElementById('select-p1').value;
    const p2 = document.getElementById('select-p2').value;
    if (p1 === p2) { alert('Select different players!'); return; }
    socket.emit('startMatch', { player1: p1, player2: p2 });
    document.getElementById('match-modal').classList.add('hidden');
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    document.getElementById('victory-overlay').classList.add('hidden');
    document.getElementById('turn-number').textContent = '0';
    document.getElementById('match-timer').textContent = '00:00';
    document.getElementById('last-move').innerHTML = '<span class="move-waiting">Waiting for battle...</span>';
    document.getElementById('trash-talk-messages').innerHTML = '';
    updatePhase('waiting');
    updateShipCounts(5, 5);
  });

  document.getElementById('end-match-btn').addEventListener('click', () => {
    if (confirm('End the current match?')) {
      socket.emit('endMatch');
    }
  });

  document.getElementById('restart-server-btn').addEventListener('click', () => {
    if (confirm('Restart the server? All matches will be lost.')) {
      socket.emit('restartServer');
    }
  });

  // View toggle handlers
  document.getElementById('view-3d-btn').addEventListener('click', () => {
    switchView('3d');
  });

  document.getElementById('view-iso-btn').addEventListener('click', () => {
    switchView('iso');
  });
}

// ============= VIEW SWITCHING =============
function switchView(view) {
  if (currentView === view) return;
  currentView = view;

  const view3d = document.getElementById('view-3d');
  const viewIso = document.getElementById('view-iso');
  const btn3d = document.getElementById('view-3d-btn');
  const btnIso = document.getElementById('view-iso-btn');

  if (view === '3d') {
    view3d.classList.add('active');
    viewIso.classList.remove('active');
    btn3d.classList.add('active');
    btnIso.classList.remove('active');
  } else {
    view3d.classList.remove('active');
    viewIso.classList.add('active');
    btn3d.classList.remove('active');
    btnIso.classList.add('active');

    // Trigger resize on isometric canvases
    if (leftIsoScene) leftIsoScene.resize();
    if (rightIsoScene) rightIsoScene.resize();
  }
}

// ============= INIT =============
async function init() {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingProgress = document.querySelector('.loading-progress');
  const loadingStatus = document.querySelector('.loading-status');

  loadingStatus.textContent = 'Initializing audio...';
  loadingProgress.style.width = '20%';
  AudioManager.init();

  loadingStatus.textContent = 'Creating 3D battle scenes...';
  loadingProgress.style.width = '40%';

  leftScene = new BattleScene('canvas-left', 'player1', CONFIG.shipColors.claude);
  rightScene = new BattleScene('canvas-right', 'player2', CONFIG.shipColors.gemini);

  loadingStatus.textContent = 'Creating isometric scenes...';
  loadingProgress.style.width = '60%';

  // Initialize isometric scenes
  if (typeof IsometricBattleScene !== 'undefined') {
    leftIsoScene = new IsometricBattleScene('iso-canvas-left', {
      gridSize: 10,
      tileWidth: 64,
      tileHeight: 32,
      playerColor: '#8b5cf6', // Claude purple
      showWaterAnimation: true
    });

    rightIsoScene = new IsometricBattleScene('iso-canvas-right', {
      gridSize: 10,
      tileWidth: 64,
      tileHeight: 32,
      playerColor: '#10b981', // Gemini green
      showWaterAnimation: true
    });

    console.log('Isometric scenes initialized');
  } else {
    console.warn('IsometricBattleScene not available');
  }

  loadingStatus.textContent = 'Connecting to server...';
  loadingProgress.style.width = '80%';
  initSocket();

  loadingStatus.textContent = 'Ready for battle!';
  loadingProgress.style.width = '100%';
  setupEventHandlers();

  setTimeout(() => loadingScreen.classList.add('hidden'), 1000);
}

init();
