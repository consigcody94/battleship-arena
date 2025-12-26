/**
 * Isometric Battleship Arena Renderer
 * Inspired by isometric-city techniques
 * Uses HTML5 Canvas with multi-layer rendering
 */

// ============= ISOMETRIC CONFIGURATION =============
const ISO_CONFIG = {
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  GRID_SIZE: 10,
  WATER_COLOR: '#0a3d62',
  WATER_HIGHLIGHT: '#1e5f74',
  WATER_DARK: '#052d47',
  GRID_COLOR: 'rgba(100, 200, 255, 0.3)',
  HIT_COLOR: '#ff4444',
  MISS_COLOR: '#4488ff',
  SHIP_COLORS: {
    claude: '#8b5cf6',
    gemini: '#10b981',
    codex: '#f97316'
  }
};

// Ship definitions with isometric sprites
const SHIP_DEFS = {
  CARRIER: { size: 5, name: 'Carrier', width: 2 },
  BATTLESHIP: { size: 4, name: 'Battleship', width: 1.5 },
  CRUISER: { size: 3, name: 'Cruiser', width: 1.2 },
  SUBMARINE: { size: 3, name: 'Submarine', width: 1 },
  DESTROYER: { size: 2, name: 'Destroyer', width: 1 }
};

// ============= ISOMETRIC MATH =============
class IsometricTransform {
  constructor(tileWidth, tileHeight, originX, originY) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.originX = originX;
    this.originY = originY;
  }

  // Grid coordinates to screen coordinates
  gridToScreen(gridX, gridY) {
    const screenX = this.originX + (gridX - gridY) * (this.tileWidth / 2);
    const screenY = this.originY + (gridX + gridY) * (this.tileHeight / 2);
    return { x: screenX, y: screenY };
  }

  // Screen coordinates to grid coordinates
  screenToGrid(screenX, screenY) {
    const relX = screenX - this.originX;
    const relY = screenY - this.originY;
    const gridX = (relX / (this.tileWidth / 2) + relY / (this.tileHeight / 2)) / 2;
    const gridY = (relY / (this.tileHeight / 2) - relX / (this.tileWidth / 2)) / 2;
    return { x: Math.floor(gridX), y: Math.floor(gridY) };
  }

  // Get diamond corners for a tile
  getDiamondCorners(gridX, gridY) {
    const center = this.gridToScreen(gridX + 0.5, gridY + 0.5);
    return {
      top: { x: center.x, y: center.y - this.tileHeight / 2 },
      right: { x: center.x + this.tileWidth / 2, y: center.y },
      bottom: { x: center.x, y: center.y + this.tileHeight / 2 },
      left: { x: center.x - this.tileWidth / 2, y: center.y }
    };
  }

  // Calculate depth for sorting (higher = render later = on top)
  getDepth(gridX, gridY, width = 1, height = 1) {
    return gridX + gridY + width + height - 2;
  }
}

// ============= PARTICLE SYSTEM =============
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  // Create explosion particles
  createExplosion(x, y, color = '#ff6600', count = 30) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 3 + Math.random() * 5,
        color,
        type: 'explosion'
      });
    }
  }

  // Create water splash
  createSplash(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed * 0.5,
        vy: Math.sin(angle) * speed - 3,
        life: 1,
        decay: 0.03,
        size: 2 + Math.random() * 3,
        color: '#6ab7ff',
        type: 'splash',
        gravity: 0.15
      });
    }
  }

  // Create smoke
  createSmoke(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.5 - Math.random() * 0.5,
        life: 1,
        decay: 0.01,
        size: 5 + Math.random() * 10,
        color: '#333333',
        type: 'smoke',
        growth: 0.3
      });
    }
  }

  // Create firework burst
  createFirework(x, y) {
    const colors = ['#ff0000', '#00ff00', '#0088ff', '#ffff00', '#ff00ff', '#00ffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.015,
        size: 2,
        color,
        type: 'firework',
        gravity: 0.05,
        trail: []
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Store trail for fireworks
      if (p.type === 'firework' && p.trail) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();
      }

      // Apply physics
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.gravity) p.vy += p.gravity;
      if (p.growth) p.size += p.growth;

      // Drag
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;

      if (p.type === 'firework' && p.trail) {
        // Draw trail
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < p.trail.length; i++) {
          const t = p.trail[i];
          if (i === 0) ctx.moveTo(t.x, t.y);
          else ctx.lineTo(t.x, t.y);
        }
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // Draw particle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect for explosions
      if (p.type === 'explosion' || p.type === 'firework') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

// ============= WATER RENDERER =============
class WaterRenderer {
  constructor(transform, gridSize) {
    this.transform = transform;
    this.gridSize = gridSize;
    this.time = 0;
    this.waveOffset = [];

    // Pre-calculate wave offsets for each tile
    for (let i = 0; i < gridSize * gridSize; i++) {
      this.waveOffset.push(Math.random() * Math.PI * 2);
    }
  }

  render(ctx, time) {
    this.time = time;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.drawWaterTile(ctx, x, y);
      }
    }
  }

  drawWaterTile(ctx, gridX, gridY) {
    const corners = this.transform.getDiamondCorners(gridX, gridY);
    const idx = gridY * this.gridSize + gridX;
    const wavePhase = this.waveOffset[idx];

    // Animated wave brightness
    const wave = Math.sin(this.time * 0.002 + wavePhase) * 0.1;
    const brightness = 0.5 + wave;

    // Create gradient for water depth effect
    const centerY = (corners.top.y + corners.bottom.y) / 2;
    const gradient = ctx.createLinearGradient(
      corners.left.x, centerY,
      corners.right.x, centerY
    );

    gradient.addColorStop(0, this.adjustBrightness(ISO_CONFIG.WATER_DARK, brightness));
    gradient.addColorStop(0.5, this.adjustBrightness(ISO_CONFIG.WATER_COLOR, brightness + 0.1));
    gradient.addColorStop(1, this.adjustBrightness(ISO_CONFIG.WATER_DARK, brightness));

    // Draw diamond
    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw wave highlights
    this.drawWaveHighlights(ctx, corners, wavePhase);
  }

  drawWaveHighlights(ctx, corners, phase) {
    const wave1 = Math.sin(this.time * 0.003 + phase) * 0.5 + 0.5;
    const wave2 = Math.sin(this.time * 0.002 + phase + 1) * 0.5 + 0.5;

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = ISO_CONFIG.WATER_HIGHLIGHT;
    ctx.lineWidth = 1;

    // Draw subtle wave lines
    const cx = (corners.left.x + corners.right.x) / 2;
    const cy = (corners.top.y + corners.bottom.y) / 2;

    ctx.beginPath();
    ctx.moveTo(
      corners.left.x + (corners.top.x - corners.left.x) * wave1,
      corners.left.y + (corners.top.y - corners.left.y) * wave1
    );
    ctx.quadraticCurveTo(
      cx, cy - 3,
      corners.top.x + (corners.right.x - corners.top.x) * wave1,
      corners.top.y + (corners.right.y - corners.top.y) * wave1
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(
      corners.left.x + (corners.bottom.x - corners.left.x) * wave2,
      corners.left.y + (corners.bottom.y - corners.left.y) * wave2
    );
    ctx.quadraticCurveTo(
      cx, cy + 3,
      corners.bottom.x + (corners.right.x - corners.bottom.x) * wave2,
      corners.bottom.y + (corners.right.y - corners.bottom.y) * wave2
    );
    ctx.stroke();

    ctx.restore();
  }

  adjustBrightness(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const nr = Math.min(255, Math.floor(r * factor));
    const ng = Math.min(255, Math.floor(g * factor));
    const nb = Math.min(255, Math.floor(b * factor));

    return `rgb(${nr}, ${ng}, ${nb})`;
  }
}

// ============= ISOMETRIC BATTLE SCENE =============
class IsometricBattleScene {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.playerType = options.playerType || 'player';
    this.playerColor = options.playerColor || '#8b5cf6';
    this.gridSize = options.gridSize || ISO_CONFIG.GRID_SIZE;
    this.tileWidth = options.tileWidth || ISO_CONFIG.TILE_WIDTH;
    this.tileHeight = options.tileHeight || ISO_CONFIG.TILE_HEIGHT;
    this.ships = [];
    this.markers = [];
    this.hoveredTile = null;

    if (!this.container) {
      console.warn(`Container ${containerId} not found`);
      return;
    }

    this.setupCanvases();
    this.setupTransform();
    this.setupSystems();
    this.startRenderLoop();
  }

  setupCanvases() {
    // Clear container
    this.container.innerHTML = '';
    this.container.style.position = 'relative';

    // Create layered canvases
    const layers = ['water', 'grid', 'ships', 'effects', 'ui'];
    this.canvases = {};
    this.contexts = {};

    layers.forEach((layer, index) => {
      const canvas = document.createElement('canvas');
      canvas.id = `${this.container.id}-${layer}`;
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = index;
      this.container.appendChild(canvas);
      this.canvases[layer] = canvas;
      this.contexts[layer] = canvas.getContext('2d');
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Mouse events for hover
    this.canvases.ui.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvases.ui.addEventListener('mouseleave', () => this.hoveredTile = null);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    Object.values(this.canvases).forEach(canvas => {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    });

    Object.values(this.contexts).forEach(ctx => {
      ctx.scale(dpr, dpr);
    });

    this.width = rect.width;
    this.height = rect.height;

    // Recalculate transform origin
    if (this.transform) {
      this.transform.originX = this.width / 2;
      this.transform.originY = this.height * 0.3;
    }
  }

  setupTransform() {
    this.transform = new IsometricTransform(
      this.tileWidth,
      this.tileHeight,
      this.width / 2,
      this.height * 0.3
    );
  }

  setupSystems() {
    this.waterRenderer = new WaterRenderer(this.transform, this.gridSize);
    this.particles = new ParticleSystem();
    this.animationTime = 0;
    this.lastTime = performance.now();
  }

  startRenderLoop() {
    const loop = (time) => {
      const delta = time - this.lastTime;
      this.lastTime = time;
      this.animationTime += delta;

      this.update(delta);
      this.render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(delta) {
    this.particles.update();
  }

  render() {
    // Clear all canvases
    Object.entries(this.contexts).forEach(([layer, ctx]) => {
      ctx.clearRect(0, 0, this.width, this.height);
    });

    // Render layers
    this.renderWater();
    this.renderGrid();
    this.renderShips();
    this.renderMarkers();
    this.renderEffects();
    this.renderUI();
  }

  renderWater() {
    this.waterRenderer.render(this.contexts.water, this.animationTime);
  }

  renderGrid() {
    const ctx = this.contexts.grid;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const corners = this.transform.getDiamondCorners(x, y);

        ctx.beginPath();
        ctx.moveTo(corners.top.x, corners.top.y);
        ctx.lineTo(corners.right.x, corners.right.y);
        ctx.lineTo(corners.bottom.x, corners.bottom.y);
        ctx.lineTo(corners.left.x, corners.left.y);
        ctx.closePath();

        ctx.strokeStyle = ISO_CONFIG.GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw coordinate labels
    ctx.font = '10px Orbitron, monospace';
    ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
    ctx.textAlign = 'center';

    const cols = 'ABCDEFGHIJ';
    for (let i = 0; i < this.gridSize; i++) {
      // Column labels (top edge)
      const topPos = this.transform.gridToScreen(i + 0.5, -0.3);
      ctx.fillText(cols[i] || i.toString(), topPos.x, topPos.y);

      // Row labels (left edge)
      const leftPos = this.transform.gridToScreen(-0.3, i + 0.5);
      ctx.fillText((i + 1).toString(), leftPos.x, leftPos.y);
    }
  }

  renderShips() {
    const ctx = this.contexts.ships;

    // Sort ships by depth for proper rendering order
    const sortedShips = [...this.ships].sort((a, b) => {
      const depthA = this.transform.getDepth(a.positions[0].row, a.positions[0].col, a.positions.length, 1);
      const depthB = this.transform.getDepth(b.positions[0].row, b.positions[0].col, b.positions.length, 1);
      return depthA - depthB;
    });

    for (const ship of sortedShips) {
      this.drawShip(ctx, ship);
    }
  }

  drawShip(ctx, ship) {
    const positions = ship.positions;
    if (positions.length === 0) return;

    // Determine ship orientation
    const isHorizontal = positions.length > 1 && positions[0].row === positions[1].row;
    const shipDef = SHIP_DEFS[ship.type] || { width: 1 };

    // Get ship bounds
    const startPos = this.transform.gridToScreen(
      positions[0].col + 0.5,
      positions[0].row + 0.5
    );
    const endPos = this.transform.gridToScreen(
      positions[positions.length - 1].col + 0.5,
      positions[positions.length - 1].row + 0.5
    );

    // Draw ship hull
    ctx.save();

    // Ship shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.drawShipHull(ctx, positions, shipDef.width, 4);

    // Ship body
    const shipColor = this.playerColor;
    const gradient = ctx.createLinearGradient(startPos.x, startPos.y - 20, endPos.x, endPos.y);
    gradient.addColorStop(0, this.lightenColor(shipColor, 30));
    gradient.addColorStop(0.5, shipColor);
    gradient.addColorStop(1, this.darkenColor(shipColor, 30));

    ctx.fillStyle = gradient;
    this.drawShipHull(ctx, positions, shipDef.width, 0);

    // Ship deck details
    ctx.strokeStyle = this.darkenColor(shipColor, 20);
    ctx.lineWidth = 1;
    this.drawShipHull(ctx, positions, shipDef.width * 0.7, -3, true);

    // Add ship details based on type
    this.drawShipDetails(ctx, ship, positions);

    // Damage indicator
    if (ship.hits > 0) {
      this.drawDamage(ctx, ship);
    }

    ctx.restore();
  }

  drawShipHull(ctx, positions, widthFactor, yOffset, strokeOnly = false) {
    const halfWidth = (ISO_CONFIG.TILE_WIDTH * widthFactor) / 4;

    ctx.beginPath();

    // Build hull outline
    const topPoints = [];
    const bottomPoints = [];

    for (let i = 0; i < positions.length; i++) {
      const pos = this.transform.gridToScreen(
        positions[i].col + 0.5,
        positions[i].row + 0.5
      );

      // Calculate perpendicular offset for width
      let dx = 0, dy = -1;
      if (i < positions.length - 1) {
        const nextPos = this.transform.gridToScreen(
          positions[i + 1].col + 0.5,
          positions[i + 1].row + 0.5
        );
        dx = nextPos.x - pos.x;
        dy = nextPos.y - pos.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
      }

      // Perpendicular
      const px = -dy * halfWidth;
      const py = dx * halfWidth;

      topPoints.push({ x: pos.x + px, y: pos.y + py + yOffset - 8 });
      bottomPoints.push({ x: pos.x - px, y: pos.y - py + yOffset - 8 });
    }

    // Draw bow (front)
    const bow = this.transform.gridToScreen(
      positions[0].col + 0.5,
      positions[0].row + 0.5
    );

    ctx.moveTo(bow.x, bow.y - 15 + yOffset);

    // Top edge
    for (const p of topPoints) {
      ctx.lineTo(p.x, p.y);
    }

    // Stern
    const stern = this.transform.gridToScreen(
      positions[positions.length - 1].col + 0.5,
      positions[positions.length - 1].row + 0.5
    );
    ctx.lineTo(stern.x, stern.y - 5 + yOffset);

    // Bottom edge (reverse)
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }

    ctx.closePath();

    if (strokeOnly) {
      ctx.stroke();
    } else {
      ctx.fill();
    }
  }

  drawShipDetails(ctx, ship, positions) {
    const center = this.transform.gridToScreen(
      positions[Math.floor(positions.length / 2)].col + 0.5,
      positions[Math.floor(positions.length / 2)].row + 0.5
    );

    switch (ship.type) {
      case 'CARRIER':
        // Flight deck markings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(center.x - 30, center.y - 10);
        ctx.lineTo(center.x + 30, center.y - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Island/tower
        ctx.fillStyle = this.darkenColor(this.playerColor, 20);
        ctx.fillRect(center.x + 15, center.y - 25, 8, 12);
        break;

      case 'BATTLESHIP':
        // Gun turrets
        ctx.fillStyle = this.darkenColor(this.playerColor, 30);
        this.drawTurret(ctx, center.x - 20, center.y - 15);
        this.drawTurret(ctx, center.x + 15, center.y - 15);
        break;

      case 'SUBMARINE':
        // Conning tower
        ctx.fillStyle = this.darkenColor(this.playerColor, 20);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y - 15, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Periscope
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - 20);
        ctx.lineTo(center.x, center.y - 30);
        ctx.stroke();
        break;

      case 'CRUISER':
      case 'DESTROYER':
        // Single turret
        ctx.fillStyle = this.darkenColor(this.playerColor, 30);
        this.drawTurret(ctx, center.x, center.y - 15);
        break;
    }

    // Navigation lights
    const bow = this.transform.gridToScreen(
      positions[0].col + 0.5,
      positions[0].row + 0.5
    );

    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(bow.x - 5, bow.y - 12, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(bow.x + 5, bow.y - 12, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTurret(ctx, x, y) {
    // Turret base
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gun barrel
    ctx.fillRect(x - 1, y - 10, 2, 8);
  }

  drawDamage(ctx, ship) {
    // Draw fire/smoke at hit locations
    for (let i = 0; i < ship.hits; i++) {
      if (i < ship.positions.length) {
        const pos = this.transform.gridToScreen(
          ship.positions[i].col + 0.5,
          ship.positions[i].row + 0.5
        );

        // Fire glow
        const gradient = ctx.createRadialGradient(pos.x, pos.y - 10, 0, pos.x, pos.y - 10, 15);
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(pos.x - 15, pos.y - 25, 30, 30);
      }
    }
  }

  renderMarkers() {
    const ctx = this.contexts.ships;

    for (const marker of this.markers) {
      const pos = this.transform.gridToScreen(marker.col + 0.5, marker.row + 0.5);

      if (marker.type === 'hit') {
        // Hit marker - explosion mark
        ctx.save();
        ctx.fillStyle = ISO_CONFIG.HIT_COLOR;
        ctx.shadowColor = ISO_CONFIG.HIT_COLOR;
        ctx.shadowBlur = 10;

        // X mark
        ctx.lineWidth = 3;
        ctx.strokeStyle = ISO_CONFIG.HIT_COLOR;
        ctx.beginPath();
        ctx.moveTo(pos.x - 8, pos.y - 8);
        ctx.lineTo(pos.x + 8, pos.y + 8);
        ctx.moveTo(pos.x + 8, pos.y - 8);
        ctx.lineTo(pos.x - 8, pos.y + 8);
        ctx.stroke();

        ctx.restore();
      } else if (marker.type === 'miss') {
        // Miss marker - splash ring
        ctx.save();
        ctx.strokeStyle = ISO_CONFIG.MISS_COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;

        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 10, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 6, 4, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else if (marker.type === 'sunk') {
        // Sunk marker - skull or wreckage
        ctx.save();
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;

        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('☠', pos.x, pos.y + 5);

        ctx.restore();
      }
    }
  }

  renderEffects() {
    this.particles.render(this.contexts.effects);
  }

  renderUI() {
    const ctx = this.contexts.ui;

    // Hover highlight
    if (this.hoveredTile) {
      const corners = this.transform.getDiamondCorners(this.hoveredTile.x, this.hoveredTile.y);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(corners.top.x, corners.top.y);
      ctx.lineTo(corners.right.x, corners.right.y);
      ctx.lineTo(corners.bottom.x, corners.bottom.y);
      ctx.lineTo(corners.left.x, corners.left.y);
      ctx.closePath();
      ctx.fill();

      // Coordinate tooltip
      const cols = 'ABCDEFGHIJ';
      const coord = `${cols[this.hoveredTile.x]}${this.hoveredTile.y + 1}`;
      const center = this.transform.gridToScreen(this.hoveredTile.x + 0.5, this.hoveredTile.y + 0.5);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(center.x - 15, center.y - 30, 30, 18);

      ctx.fillStyle = '#fff';
      ctx.font = '12px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(coord, center.x, center.y - 17);
    }
  }

  onMouseMove(e) {
    const rect = this.canvases.ui.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const grid = this.transform.screenToGrid(x, y);

    if (grid.x >= 0 && grid.x < this.gridSize &&
        grid.y >= 0 && grid.y < this.gridSize) {
      this.hoveredTile = grid;
    } else {
      this.hoveredTile = null;
    }
  }

  // Public API methods
  updateShips(shipsData, color) {
    this.playerColor = color;
    this.ships = shipsData.map(s => ({
      ...s,
      hits: s.hits || 0
    }));
  }

  markHit(coord) {
    this.markers.push({ ...coord, type: 'hit' });
    const pos = this.transform.gridToScreen(coord.col + 0.5, coord.row + 0.5);
    this.particles.createExplosion(pos.x, pos.y, '#ff6600', 25);
    this.particles.createSmoke(pos.x, pos.y - 10, 8);
  }

  markMiss(coord) {
    this.markers.push({ ...coord, type: 'miss' });
    const pos = this.transform.gridToScreen(coord.col + 0.5, coord.row + 0.5);
    this.particles.createSplash(pos.x, pos.y, 20);
  }

  markSunk(coord) {
    this.markers.push({ ...coord, type: 'sunk' });
    const pos = this.transform.gridToScreen(coord.col + 0.5, coord.row + 0.5);
    this.particles.createExplosion(pos.x, pos.y, '#ff0000', 50);
    this.particles.createExplosion(pos.x, pos.y - 20, '#ff6600', 30);
    this.particles.createSmoke(pos.x, pos.y - 15, 15);
  }

  markHitSilent(coord) {
    this.markers.push({ ...coord, type: 'hit' });
  }

  markMissSilent(coord) {
    this.markers.push({ ...coord, type: 'miss' });
  }

  markSunkSilent(coord) {
    this.markers.push({ ...coord, type: 'sunk' });
  }

  clearMarkers() {
    this.markers = [];
    this.ships = [];
    this.particles.clear();
  }

  triggerFirework(x, y) {
    this.particles.createFirework(x, y);
  }

  // Helper color functions
  lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  }

  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  }
}

// Export for use
window.IsometricBattleScene = IsometricBattleScene;
window.ISO_CONFIG = ISO_CONFIG;
