/**
 * island3d.js — 3D Floating-Island SimCity (Three.js)
 * Real 3D island, volumetric buildings (Lv.0~3), walking pedestrians,
 * your pawn, other players' avatars, orbit camera and click-to-pick buildings.
 */
(function () {
  window.ExecVoice = window.ExecVoice || {};
  const T = window.THREE;

  const SPACING = 7; // distance between tile centers
  const PAD = 6.2;
  const PAD_H = 0.35;
  const SIDEWALKS = [10.0, 18.0]; // half-sizes of pedestrian loops

  /* ------------------------------------------------------------------ utils */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const matCache = new Map();
  function mat(color, extra) {
    const key = color + (extra ? JSON.stringify(extra) : '');
    if (!matCache.has(key)) {
      matCache.set(key, new T.MeshLambertMaterial(Object.assign({ color }, extra || {})));
    }
    return matCache.get(key);
  }

  function box(parent, w, h, d, color, x, y, z, extra) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, extra));
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }

  /* --------------------------------------------- rounded geometry & textures */
  const geoCache = new Map();
  function getRoundedBoxGeometry(w, h, d, r, bevel) {
    const b = bevel !== undefined ? bevel : 0.05;
    const rad = Math.min(r !== undefined ? r : 0.35, w / 2 - b - 0.01, d / 2 - b - 0.01);
    const safeRad = Math.max(0.01, rad);
    const key = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}_${safeRad.toFixed(2)}_${b.toFixed(2)}`;
    if (geoCache.has(key)) return geoCache.get(key);
    const shape = new T.Shape();
    const x = -w / 2;
    const z = -d / 2;
    shape.moveTo(x + safeRad, z);
    shape.lineTo(x + w - safeRad, z);
    shape.quadraticCurveTo(x + w, z, x + w, z + safeRad);
    shape.lineTo(x + w, z + d - safeRad);
    shape.quadraticCurveTo(x + w, z + d, x + w - safeRad, z + d);
    shape.lineTo(x + safeRad, z + d);
    shape.quadraticCurveTo(x, z + d, x, z + d - safeRad);
    shape.lineTo(x, z + safeRad);
    shape.quadraticCurveTo(x, z, x + safeRad, z);
    const depth = Math.max(0.02, h - b * 2);
    const geo = new T.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: b > 0.001,
      bevelSegments: 2,
      bevelSize: b,
      bevelThickness: b
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, b, 0);
    geoCache.set(key, geo);
    return geo;
  }

  function roundedBox(parent, w, h, d, r, color, x, y, z, extra) {
    const geo = getRoundedBoxGeometry(w, h, d, r);
    const m = new T.Mesh(geo, mat(color, extra));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function curvedTower(parent, w, h, d, r, wall, roof, x, y, z, opts) {
    opts = opts || {};
    const rad = r !== undefined ? r : 0.45;
    const geo = getRoundedBoxGeometry(w, h, d, rad);
    let m;
    if (opts.glass) {
      const tex = glassTowerTexture(opts.tint || 'blue');
      m = new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex }));
    } else {
      m = new T.Mesh(geo, mat(wall));
    }
    m.position.set(x, y, z);
    parent.add(m);
    roundedBox(parent, w + 0.16, 0.16, d + 0.16, rad + 0.05, roof, x, y + h, z);
    return m;
  }

  function cyl(parent, rt, rb, h, color, x, y, z, seg, extra) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 16), mat(color, extra));
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }

  function sphere(parent, r, color, x, y, z, extra) {
    const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat(color, extra));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  const texCache = new Map();

  function convenienceFasciaTexture() {
    const key = 'tex_mart_fascia';
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#ea580c';
    g.fillRect(0, 4, 256, 14);
    g.fillStyle = '#16a34a';
    g.fillRect(0, 20, 256, 14);
    g.fillStyle = '#0f172a';
    g.font = 'bold 24px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('24H SIM-MART', 128, 48);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }

  function vendingMachineTexture() {
    const key = 'tex_vending';
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#0284c7';
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#ef4444';
    g.fillRect(4, 4, 56, 20);
    g.fillStyle = '#ffffff';
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'center';
    g.fillText('COLD', 32, 18);
    g.fillStyle = '#f8fafc';
    g.fillRect(6, 28, 52, 60);
    const cols = ['#ef4444', '#16a34a', '#eab308', '#3b82f6'];
    for (let r = 0; r < 3; r++) {
      for (let cl = 0; cl < 4; cl++) {
        g.fillStyle = cols[cl % cols.length];
        g.fillRect(10 + cl * 12, 34 + r * 18, 8, 12);
      }
    }
    g.fillStyle = '#1e293b';
    g.fillRect(18, 96, 28, 18);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }

  function helipadTexture() {
    const key = 'tex_helipad';
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#334155';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#eab308';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.arc(64, 64, 42, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffffff';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('H', 64, 66);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }

  function solarPanelTexture() {
    const key = 'tex_solar';
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#1e3a8a';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#93c5fd';
    g.lineWidth = 2;
    for (let i = 0; i <= 64; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }

  function storefrontGlassTexture(type) {
    const key = 'tex_glass_' + (type || 'store');
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#fef08a');
    gr.addColorStop(0.3, '#fed7aa');
    gr.addColorStop(1, '#64748b');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 124, 60);
    g.beginPath();
    g.moveTo(64, 0); g.lineTo(64, 64);
    g.moveTo(32, 0); g.lineTo(32, 64);
    g.moveTo(96, 0); g.lineTo(96, 64);
    g.stroke();
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.beginPath();
    g.moveTo(10, 0); g.lineTo(35, 0); g.lineTo(15, 64); g.lineTo(-10, 64);
    g.fill();
    g.beginPath();
    g.moveTo(70, 0); g.lineTo(95, 0); g.lineTo(75, 64); g.lineTo(50, 64);
    g.fill();
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }

  function awningTexture(c1, c2) {
    const key = 'tex_awn_' + c1 + '_' + c2;
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const cols = [c1 || '#ffffff', c2 || '#ef4444'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = cols[i % 2];
      g.fillRect(i * 16, 0, 16, 64);
      g.fillStyle = 'rgba(0,0,0,0.1)';
      g.fillRect(i * 16, 0, 2, 64);
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }

  function glassTowerTexture(tint) {
    const key = 'tex_tower_' + (tint || 'blue');
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#7dd3fc');
    gr.addColorStop(0.45, '#38bdf8');
    gr.addColorStop(0.55, '#0284c7');
    gr.addColorStop(1, '#075985');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    g.lineWidth = 2;
    for (let y = 0; y < 128; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    }
    for (let x = 0; x < 128; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke();
    }
    g.fillStyle = '#fef08a';
    g.fillRect(6, 6, 20, 20);
    g.fillRect(70, 38, 20, 20);
    g.fillRect(38, 70, 20, 20);
    g.fillRect(102, 102, 20, 20);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    texCache.set(key, tex);
    return tex;
  }

  function wallTexture(wall, glass) {
    const key = wall + (glass ? 'g' : '');
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = wall;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 60, 64, 4);
    const lit = glass ? '#a5e3ff' : '#ffe9a3';
    const dark = glass ? '#5aa9d6' : '#f6c85f';
    for (let i = 0; i < 2; i++) {
      const x = 6 + i * 31;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x - 2, 14, 28, 36);
      const grd = g.createLinearGradient(0, 16, 0, 48);
      grd.addColorStop(0, lit);
      grd.addColorStop(1, dark);
      g.fillStyle = grd;
      g.fillRect(x, 16, 24, 32);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 2, 18, 6, 28);
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    texCache.set(key, tex);
    return tex;
  }

  /** Volumetric box with windowed walls + plain roof. */
  function tower(parent, w, h, d, wall, roof, x, y, z, opts) {
    opts = opts || {};
    const floors = Math.max(1, Math.round(h / (opts.floorH || 1.5)));
    const colsX = Math.max(1, Math.round(w / 2));
    const colsZ = Math.max(1, Math.round(d / 2));
    const base = wallTexture(wall, opts.glass);
    const tx = base.clone();
    tx.needsUpdate = true;
    tx.repeat.set(colsX, floors);
    const tz = base.clone();
    tz.needsUpdate = true;
    tz.repeat.set(colsZ, floors);
    const sideX = new T.MeshLambertMaterial({ map: tz });
    const sideZ = new T.MeshLambertMaterial({ map: tx });
    const roofM = mat(roof);
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), [sideX, sideX, roofM, roofM, sideZ, sideZ]);
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }

  function labelTexture(lines, opts) {
    opts = opts || {};
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = lines.length > 1 ? 150 : 100;
    const g = c.getContext('2d');
    const r = 26;
    g.fillStyle = opts.bg || 'rgba(15,23,42,0.88)';
    g.beginPath();
    g.moveTo(r, 4);
    g.arcTo(508, 4, 508, c.height - 4, r);
    g.arcTo(508, c.height - 4, 4, c.height - 4, r);
    g.arcTo(4, c.height - 4, 4, 4, r);
    g.arcTo(4, 4, 508, 4, r);
    g.closePath();
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = opts.border || '#fde047';
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = opts.fg || '#fff';
    g.font = 'bold 44px "Noto Sans TC", "PingFang TC", sans-serif';
    let name = lines[0];
    while (g.measureText(name).width > 470 && name.length > 3) name = name.slice(0, -2) + '…';
    g.fillText(name, 256, lines.length > 1 ? 52 : c.height / 2);
    if (lines.length > 1) {
      g.font = 'bold 38px "Noto Sans TC", sans-serif';
      g.fillStyle = opts.fg2 || '#fde047';
      g.fillText(lines[1], 256, 108);
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return { tex, ratio: c.height / c.width };
  }

  function makeLabel(lines, opts) {
    const { tex, ratio } = labelTexture(lines, opts);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const wd = (opts && opts.width) || 6.2;
    sp.scale.set(wd, wd * ratio, 1);
    sp.renderOrder = 10;
    sp.userData.width = wd;
    return sp;
  }

  function setLabel(sp, lines, opts) {
    const { tex, ratio } = labelTexture(lines, opts);
    if (sp.material.map) sp.material.map.dispose();
    sp.material.map = tex;
    sp.material.needsUpdate = true;
    const wd = sp.userData.width || 6.2;
    sp.scale.set(wd, wd * ratio, 1);
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  /* ----------------------------------------------------------------- avatar */
  const SKINS = ['#ffd9b3', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
  const HAIRS = ['#2b1d0e', '#4a2c13', '#111827', '#7c3f12', '#b45309'];

  function makeAvatar(color, seed, scale) {
    const r = rng(seed || 1);
    const g = new T.Group();
    const skin = SKINS[Math.floor(r() * SKINS.length)];
    const hair = HAIRS[Math.floor(r() * HAIRS.length)];
    const body = new T.Mesh(new T.CapsuleGeometry(0.27, 0.45, 4, 10), mat(color));
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.27, 14, 12), mat(skin));
    head.position.y = 1.62;
    head.castShadow = true;
    g.add(head);
    const cap = new T.Mesh(
      new T.SphereGeometry(0.29, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mat(hair)
    );
    cap.position.y = 1.64;
    g.add(cap);
    const pack = box(g, 0.34, 0.42, 0.16, color === '#334155' ? '#1e293b' : '#334155', 0, 0.78, -0.3);
    pack.castShadow = true;
    function limb(x, y, w, h, c) {
      const piv = new T.Group();
      piv.position.set(x, y, 0);
      const m = new T.Mesh(new T.BoxGeometry(w, h, w), mat(c));
      m.position.y = -h / 2;
      m.castShadow = true;
      piv.add(m);
      g.add(piv);
      return piv;
    }
    g.userData.legL = limb(-0.12, 0.62, 0.15, 0.62, '#1f2937');
    g.userData.legR = limb(0.12, 0.62, 0.15, 0.62, '#1f2937');
    g.userData.armL = limb(-0.36, 1.22, 0.12, 0.5, skin);
    g.userData.armR = limb(0.36, 1.22, 0.12, 0.5, skin);
    g.scale.setScalar(scale || 1);
    return g;
  }

  function animateAvatar(av, time, moving, phase) {
    const u = av.userData;
    if (!u || !u.legL) return;
    const ph = phase || 0;
    if (moving) {
      const sw = Math.sin(time * 11 + ph) * 0.7;
      u.legL.rotation.x = sw;
      u.legR.rotation.x = -sw;
      u.armL.rotation.x = -sw * 0.8;
      u.armR.rotation.x = sw * 0.8;
    } else {
      // Idle natural breathing and limb relaxation
      u.legL.rotation.x = 0;
      u.legR.rotation.x = 0;
      u.armL.rotation.x = Math.sin(time * 2.2 + ph) * 0.08;
      u.armR.rotation.x = -Math.sin(time * 2.2 + ph) * 0.08;
    }
  }

  /** Moves an object along queued waypoints (hops optional). */
  class Mover {
    constructor(obj, baseY) {
      this.obj = obj;
      this.baseY = baseY;
      this.queue = [];
      this.active = null;
      this.moving = false;
      this.facing = 0;
    }
    push(x, z, dur, hop) {
      this.queue.push({ x, z, dur: dur || 0.3, hop: hop || 0 });
    }
    snap(x, z) {
      this.queue.length = 0;
      this.active = null;
      this.obj.position.set(x, this.baseY, z);
    }
    update(dt) {
      if (!this.active && this.queue.length) {
        this.active = this.queue.shift();
        this.active.t = 0;
        this.active.fx = this.obj.position.x;
        this.active.fz = this.obj.position.z;
        const dx = this.active.x - this.active.fx;
        const dz = this.active.z - this.active.fz;
        if (Math.abs(dx) + Math.abs(dz) > 0.01) this.facing = Math.atan2(dx, dz);
      }
      const a = this.active;
      this.moving = !!a;
      if (a) {
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this.obj.position.x = a.fx + (a.x - a.fx) * e;
        this.obj.position.z = a.fz + (a.z - a.fz) * e;
        this.obj.position.y = this.baseY + Math.sin(Math.PI * p) * a.hop;
        if (p >= 1) this.active = null;
      }
      // smooth turn
      let d = this.facing - this.obj.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.obj.rotation.y += d * Math.min(1, dt * 10);
    }
  }

  /* -------------------------------------------------------- SimCity building models */
  const CRATE = '#c08a4a';

  function buildSoftTree(parent, x, z, s) {
    const g = new T.Group();
    cyl(g, 0.12 * s, 0.18 * s, 0.8 * s, '#6e4726', 0, 0, 0, 10);
    const m1 = sphere(g, 0.85 * s, '#2f9e44', 0, 1.4 * s, 0);
    m1.scale.set(1.15, 0.88, 1.15);
    const m2 = sphere(g, 0.62 * s, '#37b24d', 0, 2.05 * s, 0);
    m2.scale.set(0.95, 0.85, 0.95);
    const m3 = sphere(g, 0.42 * s, '#40c057', 0, 2.55 * s, 0);
    g.position.set(x, 0, z);
    g.traverse((o) => (o.castShadow = true));
    parent.add(g);
    return g;
  }
  const buildTree = buildSoftTree;

  function questionTexture() {
    const key = 'tex_question';
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 128);
    gr.addColorStop(0, '#fde047');
    gr.addColorStop(1, '#f59e0b');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#7c2d12';
    g.font = 'bold 96px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 64, 70);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    texCache.set(key, t);
    return t;
  }

  function buildConstruction(g, accent) {
    roundedBox(g, 5.0, 0.15, 4.4, 0.45, '#78716c', 0, 0, 0);
    roundedBox(g, 4.8, 0.8, 0.1, 0.05, '#facc15', 0, 0.15, 2.05);
    box(g, 4.8, 0.18, 0.12, '#ea580c', 0, 0.45, 2.05);
    roundedBox(g, 0.1, 0.8, 4.0, 0.05, '#facc15', 2.35, 0.15, 0);
    roundedBox(g, 0.1, 0.8, 4.0, 0.05, '#facc15', -2.35, 0.15, 0);
    const ex = new T.Group();
    ex.position.set(-1.2, 0.15, 0.8);
    roundedBox(ex, 1.3, 0.28, 0.9, 0.12, '#1e293b', 0, 0, 0);
    roundedBox(ex, 0.9, 0.75, 0.7, 0.18, '#eab308', -0.1, 0.28, 0);
    box(ex, 0.45, 0.4, 0.5, '#0284c7', 0.15, 0.45, 0, { transparent: true, opacity: 0.85 });
    const boom = box(ex, 1.4, 0.15, 0.15, '#eab308', 0.8, 0.55, 0);
    boom.rotation.z = -0.35;
    g.add(ex);
    cyl(g, 0.32, 0.32, 1.4, '#94a3b8', 1.2, 0.32, 1.1, 16).rotation.z = Math.PI / 2;
    cyl(g, 0.32, 0.32, 1.4, '#94a3b8', 1.2, 0.32, 0.4, 16).rotation.z = Math.PI / 2;
    cyl(g, 0.32, 0.32, 1.4, '#94a3b8', 1.2, 0.85, 0.75, 16).rotation.z = Math.PI / 2;
    cyl(g, 0.05, 0.05, 1.8, '#78350f', -1.7, 0.15, -1.2, 8);
    cyl(g, 0.05, 0.05, 1.8, '#78350f', -0.7, 0.15, -1.2, 8);
    const sign = roundedBox(g, 1.3, 0.9, 0.08, 0.1, '#0284c7', -1.2, 1.1, -1.2);
    box(sign, 1.15, 0.75, 0.02, '#e0f2fe', 0, 0.45, 0.04);
    box(g, 0.32, 4.6, 0.32, '#eab308', 1.5, 0.15, -1.2);
    const jib = new T.Group();
    jib.position.set(1.5, 4.85, -1.2);
    box(jib, 4.4, 0.22, 0.22, '#eab308', -1.0, 0, 0);
    box(jib, 0.9, 0.5, 0.5, '#475569', 1.5, -0.1, 0);
    box(jib, 0.04, 1.4, 0.04, '#1f2937', -2.4, -1.4, 0);
    box(jib, 0.4, 0.3, 0.4, '#ef4444', -2.4, -1.7, 0);
    g.add(jib);
    g.userData.spin = jib;
  }

  function buildConvenienceStore(g, c, lv) {
    if (lv <= 0) {
      buildConstruction(g, '#16a34a');
      return;
    }
    if (lv === 1) {
      box(g, 4.8, 0.04, 1.8, '#334155', 0, 0, 1.7);
      for (let i = -1; i <= 1; i += 2) {
        box(g, 0.08, 0.05, 1.4, '#ffffff', i * 1.3, 0.02, 1.7);
        roundedBox(g, 0.9, 0.12, 0.16, 0.06, '#facc15', i * 1.3, 0.04, 1.05);
      }
      roundedBox(g, 4.4, 2.4, 3.2, 0.4, '#f8fafc', 0, 0, -0.6);
      const fascia = box(g, 4.5, 0.65, 0.35, '#ffffff', 0, 2.05, 0.95);
      fascia.material = new T.MeshLambertMaterial({ map: convenienceFasciaTexture() });
      const glassFront = box(g, 3.8, 1.7, 0.05, '#ffffff', 0, 0.1, 0.98);
      glassFront.material = new T.MeshLambertMaterial({ map: storefrontGlassTexture('mart') });
      const vm = roundedBox(g, 0.7, 1.5, 0.6, 0.08, '#0284c7', 2.4, 0, 0.8);
      vm.material = new T.MeshLambertMaterial({ map: vendingMachineTexture() });
      cyl(g, 0.18, 0.16, 0.6, '#16a34a', -2.3, 0, 1.8, 14);
      cyl(g, 0.18, 0.16, 0.6, '#0284c7', -2.6, 0, 1.8, 14);
      cyl(g, 0.08, 0.08, 3.6, '#cbd5e1', -2.2, 0, 2.2, 12);
      const signHead = roundedBox(g, 0.85, 0.75, 0.25, 0.15, '#ea580c', -2.2, 3.6, 2.2);
      signHead.material = new T.MeshLambertMaterial({ map: convenienceFasciaTexture() });
      roundedBox(g, 1.0, 0.6, 0.8, 0.1, '#94a3b8', -1.2, 2.4, -0.6);
      cyl(g, 0.25, 0.25, 0.15, '#475569', -1.2, 3.0, -0.6, 16);
      return;
    }
    if (lv === 2) {
      roundedBox(g, 5.0, 2.2, 4.4, 0.45, '#f8fafc', 0, 0, 0);
      box(g, 5.0, 0.04, 1.4, '#334155', 0, 0, 2.6);
      const fascia = box(g, 5.1, 0.7, 0.35, '#ffffff', 0, 1.85, 2.15);
      fascia.material = new T.MeshLambertMaterial({ map: convenienceFasciaTexture() });
      const glassFront = box(g, 4.2, 1.5, 0.05, '#ffffff', 0, 0.1, 2.18);
      glassFront.material = new T.MeshLambertMaterial({ map: storefrontGlassTexture('mart') });
      curvedTower(g, 4.2, 3.2, 3.6, 0.45, '#f8fafc', '#e2e8f0', 0, 2.2, -0.3, { glass: true });
      box(g, 4.2, 0.4, 0.06, '#94a3b8', 0, 2.2, 1.7);
      buildSoftTree(g, -2.4, 2.6, 0.7);
      buildSoftTree(g, 2.4, 2.6, 0.7);
      const vm = roundedBox(g, 0.7, 1.5, 0.6, 0.08, '#0284c7', 2.3, 0, 2.6);
      vm.material = new T.MeshLambertMaterial({ map: vendingMachineTexture() });
      roundedBox(g, 1.4, 0.7, 1.2, 0.12, '#64748b', -0.8, 5.4, -0.4);
      cyl(g, 0.35, 0.35, 0.2, '#334155', -0.8, 6.1, -0.4, 16);
      return;
    }
    buildSkyscraperWithRetail(g, c, convenienceFasciaTexture(), 'mart');
  }

  function buildCafeBoba(g, c, lv, isBoba) {
    if (lv <= 0) {
      buildConstruction(g, c.roof);
      return;
    }
    const wood = isBoba ? '#1e3a8a' : '#78350f';
    const accent = isBoba ? '#0284c7' : '#d97706';
    if (lv === 1) {
      roundedBox(g, 4.8, 0.08, 1.8, 0.2, '#b45309', 0, 0, 1.7);
      roundedBox(g, 4.4, 2.6, 3.4, 0.4, wood, 0, 0, -0.5);
      const awn = box(g, 4.2, 0.28, 1.2, '#ffffff', 0, 2.15, 1.45);
      awn.rotation.x = 0.22;
      awn.material = new T.MeshLambertMaterial({ map: awningTexture('#ffffff', accent) });
      const glassFront = box(g, 3.6, 1.6, 0.05, '#ffffff', 0, 0.1, 1.18);
      glassFront.material = new T.MeshLambertMaterial({ map: storefrontGlassTexture('cafe') });
      const logo = cyl(g, 0.5, 0.5, 0.08, '#ffffff', 0, 2.7, 1.2, 24);
      logo.rotation.x = Math.PI / 2;
      cyl(g, 0.42, 0.42, 0.09, accent, 0, 2.7, 1.22, 24).rotation.x = Math.PI / 2;
      cyl(g, 0.04, 0.04, 2.0, '#cbd5e1', -1.5, 0.08, 1.7, 8);
      cyl(g, 0, 1.1, 0.42, accent, -1.5, 1.95, 1.7, 18);
      cyl(g, 0.35, 0.35, 0.65, '#94a3b8', -1.5, 0.08, 1.7, 14);
      cyl(g, 0.18, 0.18, 0.35, '#78350f', -1.9, 0.08, 1.7, 10);
      cyl(g, 0.18, 0.18, 0.35, '#78350f', -1.1, 0.08, 1.7, 10);
      roundedBox(g, 1.4, 0.35, 0.4, 0.1, '#16a34a', 1.5, 0.08, 1.8);
      return;
    }
    if (lv === 2) {
      roundedBox(g, 5.0, 2.2, 4.6, 0.45, wood, 0, 0, 0);
      curvedTower(g, 4.0, 2.8, 3.4, 0.4, '#ffffff', accent, 0, 2.2, -0.4, { glass: true });
      roundedBox(g, 4.8, 0.08, 1.6, 0.15, '#b45309', 0, 2.2, 1.6);
      box(g, 4.8, 0.4, 0.06, '#94a3b8', 0, 2.25, 2.38);
      cyl(g, 0.04, 0.04, 1.8, '#cbd5e1', 1.3, 2.28, 1.6, 8);
      cyl(g, 0, 0.9, 0.4, accent, 1.3, 3.8, 1.6, 16);
      buildSoftTree(g, -2.4, 2.4, 0.7);
      return;
    }
    buildSkyscraperWithRetail(g, c, null, isBoba ? 'boba' : 'cafe');
  }

  function buildSkyscraperWithRetail(g, c, fasciaTex, type) {
    const gold = '#d9a21b';
    curvedTower(g, 5.4, 2.4, 5.0, 0.55, c.wall, c.roof, 0, 0, 0, {});
    if (fasciaTex) {
      const f = box(g, 4.8, 0.7, 0.3, '#ffffff', 0, 1.9, 2.45);
      f.material = new T.MeshLambertMaterial({ map: fasciaTex });
    } else {
      box(g, 3.2, 0.14, 1.4, '#ffffff', 0, 1.8, 2.6);
      cyl(g, 0.14, 0.14, 1.8, '#cbd5e1', -1.3, 0, 3.1, 12);
      cyl(g, 0.14, 0.14, 1.8, '#cbd5e1', 1.3, 0, 3.1, 12);
    }
    curvedTower(g, 4.2, 5.4, 4.0, 0.5, '#0284c7', '#38bdf8', 0, 2.4, 0, { glass: true });
    curvedTower(g, 3.2, 3.6, 3.0, 0.45, gold, '#fde047', 0, 7.8, 0, { glass: true });
    const heli = box(g, 2.2, 0.08, 2.2, '#334155', 0, 11.4, 0);
    heli.material = new T.MeshLambertMaterial({ map: helipadTexture() });
    cyl(g, 0.06, 0.1, 2.6, '#e2e8f0', 0, 11.48, 0, 12);
    const beacon = sphere(g, 0.22, '#ef4444', 0, 14.1, 0, { emissive: '#ef4444', emissiveIntensity: 1 });
    g.userData.beacon = beacon;
    const ring = new T.Mesh(new T.TorusGeometry(3.6, 0.08, 8, 48), new T.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    g.userData.glow = ring;
  }

  function buildCommercialTower(g, c, lv, tile) {
    if (lv <= 0) {
      buildConstruction(g, c.roof);
      return;
    }
    if (lv === 1) {
      curvedTower(g, 4.6, 3.2, 3.8, 0.45, c.wall, c.roof, 0, 0, 0, { glass: true });
      box(g, 2.6, 0.14, 1.4, '#e0f2fe', 0, 1.7, 2.2);
      cyl(g, 0.14, 0.14, 1.7, '#cbd5e1', -1.1, 0, 2.7, 12);
      cyl(g, 0.14, 0.14, 1.7, '#cbd5e1', 1.1, 0, 2.7, 12);
      cyl(g, 0.65, 0.65, 1.3, '#0284c7', 0, 0.1, 1.9, 16, { transparent: true, opacity: 0.85 });
      buildSoftTree(g, -2.4, 2.4, 0.7);
      buildSoftTree(g, 2.4, 2.4, 0.7);
      return;
    }
    if (lv === 2) {
      curvedTower(g, 5.2, 2.0, 4.8, 0.5, c.wall, c.roof, 0, 0, 0, {});
      curvedTower(g, 4.4, 5.4, 4.0, 0.45, '#0284c7', c.roof, 0, 2.0, 0, { glass: true });
      box(g, 2.8, 0.16, 1.5, '#ffffff', 0, 1.7, 2.8);
      cyl(g, 0.15, 0.15, 1.7, '#cbd5e1', -1.2, 0, 3.3, 12);
      cyl(g, 0.15, 0.15, 1.7, '#cbd5e1', 1.2, 0, 3.3, 12);
      roundedBox(g, 1.4, 0.75, 1.2, 0.12, '#64748b', -0.8, 7.4, 0);
      cyl(g, 0.35, 0.35, 0.2, '#334155', -0.8, 8.15, 0, 16);
      const dish = new T.Mesh(new T.SphereGeometry(0.65, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2e8f0'));
      dish.rotation.x = Math.PI / 3;
      dish.position.set(1.0, 7.5, -0.6);
      g.add(dish);
      buildSoftTree(g, -2.5, 2.6, 0.8);
      buildSoftTree(g, 2.5, 2.6, 0.8);
      return;
    }
    buildSkyscraperWithRetail(g, c, null, 'office');
  }

  function buildTechPark(g, c, lv) {
    if (lv <= 0) {
      buildConstruction(g, '#8b5cf6');
      return;
    }
    if (lv === 1) {
      curvedTower(g, 4.6, 2.8, 3.6, 0.4, '#1e293b', '#06b6d4', 0, 0, 0, { glass: true });
      const sol = box(g, 3.2, 0.08, 1.6, '#1e3a8a', 0, 2.85, -0.2);
      sol.rotation.x = -0.25;
      sol.material = new T.MeshLambertMaterial({ map: solarPanelTexture() });
      roundedBox(g, 0.35, 0.85, 0.25, 0.08, '#ffffff', 2.0, 0, 1.8);
      box(g, 0.25, 0.25, 0.05, '#10b981', 2.0, 0.5, 1.95, { emissive: '#10b981', emissiveIntensity: 0.8 });
      buildSoftTree(g, -2.2, 2.0, 0.7);
      return;
    }
    if (lv === 2) {
      curvedTower(g, 2.4, 4.2, 3.8, 0.4, '#0f172a', '#06b6d4', -1.3, 0, 0, { glass: true });
      curvedTower(g, 2.4, 3.4, 3.8, 0.4, '#1e293b', '#06b6d4', 1.3, 0, 0, { glass: true });
      roundedBox(g, 1.2, 1.0, 1.8, 0.25, '#38bdf8', 0, 2.1, 0, { transparent: true, opacity: 0.88 });
      const sol = box(g, 2.0, 0.08, 2.6, '#1e3a8a', 1.3, 3.45, 0);
      sol.rotation.x = -0.2;
      sol.material = new T.MeshLambertMaterial({ map: solarPanelTexture() });
      buildSoftTree(g, 0, 2.4, 0.8);
      return;
    }
    buildSkyscraperWithRetail(g, c, null, 'tech');
  }

  function buildShop(g, c) {
    buildCafeBoba(g, c, 1, false);
  }

  function buildMidrise(g, c) {
    buildCommercialTower(g, c, 2, {});
  }

  function buildSkyscraper(g, c) {
    buildCommercialTower(g, c, 3, {});
  }

  function buildSpecial(g, tile) {
    const accent = tile.zoneColor || '#64748b';
    switch (tile.type) {
      case 'corner-start': {
        roundedBox(g, 5.0, 0.25, 4.0, 0.45, '#e7e0cc', 0, 0, 0);
        roundedBox(g, 4.4, 2.2, 3.2, 0.35, '#f5efe0', 0, 0.25, -0.2);
        for (let i = 0; i < 4; i++) {
          cyl(g, 0.16, 0.16, 2.2, '#fffaf0', -1.5 + i * 1.0, 0.25, 1.45, 16);
        }
        const ped = new T.Mesh(new T.ConeGeometry(2.6, 0.9, 3), mat('#d9cfae'));
        ped.position.set(0, 2.9, 1.45);
        ped.scale.set(1, 0.3, 1);
        g.add(ped);
        const dome = new T.Mesh(new T.SphereGeometry(1.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#0d9488'));
        dome.position.set(0, 2.45, -0.2);
        g.add(dome);
        cyl(g, 0.06, 0.06, 1.8, '#f59e0b', 0, 3.65, -0.2, 8);
        const flag = box(g, 0.9, 0.5, 0.05, '#ef4444', 0.45, 4.8, -0.2);
        g.userData.flag = flag;
        break;
      }
      case 'chance': {
        if (tile.icon === '📺') {
          roundedBox(g, 4.4, 0.4, 3.6, 0.4, '#334155', 0, 0, 0);
          curvedTower(g, 3.6, 3.8, 3.0, 0.4, '#1e293b', '#ec4899', 0, 0.4, -0.2, { glass: true });
          const sc = roundedBox(g, 3.2, 1.8, 0.25, 0.15, '#ec4899', 0, 2.2, 1.4, { emissive: '#ec4899', emissiveIntensity: 0.9 });
          g.userData.screen = sc;
          const dish1 = new T.Mesh(new T.SphereGeometry(0.65, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2e8f0'));
          dish1.rotation.x = Math.PI / 3;
          dish1.position.set(-1.0, 4.3, 0);
          g.add(dish1);
          const dish2 = new T.Mesh(new T.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2e8f0'));
          dish2.rotation.x = Math.PI / 4;
          dish2.position.set(1.0, 4.3, -0.5);
          g.add(dish2);
          cyl(g, 0.05, 0.08, 2.2, '#94a3b8', 0, 4.2, 0, 8);
          sphere(g, 0.15, '#ef4444', 0, 6.4, 0, { emissive: '#ef4444', emissiveIntensity: 1 });
        } else {
          cyl(g, 1.9, 2.1, 0.4, accent, 0, 0, 0, 32);
          cyl(g, 1.3, 1.5, 0.45, '#fff7ed', 0, 0.4, 0, 32);
          const q = new T.Mesh(new T.BoxGeometry(1.7, 1.7, 1.7), new T.MeshLambertMaterial({ map: questionTexture(), emissive: '#f59e0b', emissiveIntensity: 0.4 }));
          q.position.y = 2.2;
          q.castShadow = true;
          g.add(q);
          g.userData.spin = q;
          g.userData.bob = q;
        }
        break;
      }
      case 'corner-transit': {
        roundedBox(g, 5.2, 0.25, 4.2, 0.4, '#475569', 0, 0, 0);
        const arch = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 4.8, 24, 1, true, 0, Math.PI), mat('#38bdf8', { transparent: true, opacity: 0.6 }));
        arch.rotation.z = Math.PI / 2;
        arch.position.set(0, 1.8, -0.4);
        g.add(arch);
        box(g, 5.0, 0.15, 1.8, '#cbd5e1', 0, 0.25, 1.0);
        box(g, 5.0, 0.05, 0.12, '#eab308', 0, 0.4, 0.15);
        const train = new T.Group();
        for (let i = 0; i < 3; i++) {
          roundedBox(train, 1.4, 0.9, 0.85, 0.18, i === 0 ? '#0284c7' : '#e2e8f0', i * 1.5 - 1.5, 0.35, 0.9);
          box(train, 1.1, 0.25, 0.06, '#7dd3fc', i * 1.5 - 1.5, 0.7, 1.34);
        }
        g.add(train);
        g.userData.train = train;
        break;
      }
      case 'corner-park': {
        cyl(g, 2.2, 2.4, 0.35, '#e2e8f0', 0, 0, 0.2, 32);
        cyl(g, 1.95, 1.95, 0.3, '#38bdf8', 0, 0.2, 0.2, 32, { transparent: true, opacity: 0.88 });
        cyl(g, 0.7, 0.8, 0.65, '#cbd5e1', 0, 0.3, 0.2, 20);
        const jet = cyl(g, 0.12, 0.12, 1.8, '#bae6fd', 0, 1.1, 0.2, 12, { transparent: true, opacity: 0.85 });
        g.userData.jet = jet;
        buildSoftTree(g, -2.2, -1.8, 1.0);
        buildSoftTree(g, 2.2, -1.9, 0.9);
        buildSoftTree(g, -2.3, 2.0, 0.85);
        roundedBox(g, 1.2, 0.14, 0.4, 0.08, '#8b5a2b', 2.2, 0.3, 2.0);
        break;
      }
      case 'corner-builder': {
        roundedBox(g, 5.0, 0.25, 4.2, 0.45, '#e9d5ff', 0, 0, 0);
        curvedTower(g, 4.4, 2.8, 3.4, 0.45, '#7c3aed', '#c4b5fd', 0, 0.25, -0.3, { glass: true });
        cyl(g, 0.6, 0.7, 0.4, '#a16207', 0, 2.5, 1.1, 20);
        cyl(g, 0.15, 0.15, 0.6, '#facc15', 0, 2.9, 1.1, 10);
        cyl(g, 0.7, 0.4, 0.9, '#facc15', 0, 3.4, 1.1, 20, { emissive: '#ca8a04', emissiveIntensity: 0.5 });
        break;
      }
      case 'academy': {
        roundedBox(g, 4.8, 0.25, 3.8, 0.4, '#f5efe0', 0, 0, 0);
        curvedTower(g, 4.4, 2.6, 3.2, 0.4, '#b45309', '#78350f', 0, 0.25, -0.2, { glass: true });
        curvedTower(g, 1.3, 4.4, 1.3, 0.2, '#9a3412', '#78350f', -1.5, 0.25, 1.1, {});
        cyl(g, 0.38, 0.38, 0.08, '#ffffff', -1.5, 3.6, 1.78, 24).rotation.x = Math.PI / 2;
        box(g, 1.8, 0.15, 1.8, '#1e293b', 1.1, 2.85, 0);
        break;
      }
      default:
        roundedBox(g, 4.2, 0.4, 4.2, 0.4, accent, 0, 0, 0);
    }
  }

  /* ---------------------------------------------------------------- class */
  class IslandCity {
    constructor(container, opts) {
      this.container = container;
      this.tiles = opts.tiles;
      this.onTileClick = opts.onTileClick || (() => {});
      this.infos = [];
      this.tileGroups = [];
      this.tileRoots = [];
      this.paused = false;
      this.time = 0;
      this.remote = new Map();
      this.walkers = [];
      this.clouds = [];
      this.hoverIndex = -1;
      this.playerTile = 0;
      this.ok = false;

      try {
        this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      } catch (e) {
        container.innerHTML =
          '<div class="island-fallback">⚠️ 你的瀏覽器不支援 WebGL，無法顯示 3D 島城。請改用最新版 Chrome / Edge / Safari。</div>';
        return;
      }
      this.ok = true;
      const r = this.renderer;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      r.domElement.className = 'island-canvas';
      container.appendChild(r.domElement);

      this.scene = new T.Scene();
      this.scene.background = this._skyTexture();
      this.scene.fog = new T.Fog(0xcfeaff, 110, 300);
      this.camera = new T.PerspectiveCamera(42, 1, 0.5, 600);
      this.cam = {
        az: 0.75, el: 0.72, dist: 62,
        tAz: 0.75, tEl: 0.72, tDist: 62,
        target: new T.Vector3(0, 1, 2), tTarget: new T.Vector3(0, 1, 2)
      };

      this._buildLights();
      this._buildIsland();
      this._buildRoads();
      this._buildTiles();
      this._buildDecor();
      this._buildWalkers();
      this._buildSea();
      this._buildPlayer();
      this._bindInput();

      this.clock = new T.Clock();
      this._resize();
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(container);
      this._raf = requestAnimationFrame(() => this._loop());
    }

    /* ---------------------------------------------------------- scene build */
    _skyTexture() {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#5bb6f5');
      gr.addColorStop(0.6, '#a9dcff');
      gr.addColorStop(1, '#e6f6ff');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 256);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    }

    _buildLights() {
      this.scene.add(new T.HemisphereLight(0xdff0ff, 0x82a56c, 1.05));
      const sun = new T.DirectionalLight(0xfff5dd, 1.25);
      sun.position.set(-26, 42, 22);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera;
      sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 120;
      sun.shadow.bias = -0.0006;
      sun.shadow.radius = 2.0;
      this.scene.add(sun);
      const ambient = new T.AmbientLight(0xffffff, 0.25);
      this.scene.add(ambient);
    }

    _buildIsland() {
      this.island = new T.Group();
      this.scene.add(this.island);
      const rock = new T.Mesh(
        new T.CylinderGeometry(29.5, 25, 12, 48, 1),
        new T.MeshLambertMaterial({ color: '#9a8571' })
      );
      rock.position.y = -6.3;
      rock.receiveShadow = true;
      this.island.add(rock);
      const under = new T.Mesh(
        new T.ConeGeometry(25, 14, 32),
        new T.MeshLambertMaterial({ color: '#7d6b59' })
      );
      under.rotation.x = Math.PI;
      under.position.y = -19;
      this.island.add(under);
      const grass = new T.Mesh(
        new T.CylinderGeometry(29.5, 29.5, 0.6, 48),
        new T.MeshLambertMaterial({ color: '#86cf5b' })
      );
      grass.position.y = -0.3;
      grass.receiveShadow = true;
      this.island.add(grass);
      const sand = new T.Mesh(
        new T.CylinderGeometry(30.3, 30.5, 0.5, 48),
        new T.MeshLambertMaterial({ color: '#f1deaa' })
      );
      sand.position.y = -0.55;
      this.island.add(sand);
      const inner = new T.Mesh(
        new T.CylinderGeometry(9.4, 9.4, 0.04, 48),
        new T.MeshLambertMaterial({ color: '#9ae06b' })
      );
      inner.position.y = 0.02;
      inner.receiveShadow = true;
      this.island.add(inner);
      // pond
      const pond = new T.Mesh(
        new T.CylinderGeometry(2.6, 2.6, 0.06, 32),
        new T.MeshLambertMaterial({ color: '#4cc3f0', transparent: true, opacity: 0.9 })
      );
      pond.position.set(-5, 0.07, -4.5);
      this.island.add(pond);
      // rocks at cliffs - smooth rounded pebbles
      const r = rng(7);
      for (let i = 0; i < 14; i++) {
        const a = r() * Math.PI * 2;
        const rr = 26 + r() * 3;
        const m = new T.Mesh(
          new T.SphereGeometry(0.8 + r() * 0.9, 12, 10),
          new T.MeshLambertMaterial({ color: '#8b7d6b' })
        );
        m.scale.set(1.2, 0.6, 1.0);
        m.position.set(Math.cos(a) * rr, -0.4 + r() * 0.3, Math.sin(a) * rr);
        m.castShadow = true;
        this.island.add(m);
      }
    }

    _ring(outer, inner, depth, color, y, rOut = 3.2, rIn = 2.0) {
      const s = new T.Shape();
      const ro = Math.min(rOut, outer * 0.45);
      s.moveTo(-outer + ro, -outer);
      s.lineTo(outer - ro, -outer);
      s.quadraticCurveTo(outer, -outer, outer, -outer + ro);
      s.lineTo(outer, outer - ro);
      s.quadraticCurveTo(outer, outer, outer - ro, outer);
      s.lineTo(-outer + ro, outer);
      s.quadraticCurveTo(-outer, outer, -outer, outer - ro);
      s.lineTo(-outer, -outer + ro);
      s.quadraticCurveTo(-outer, -outer, -outer + ro, -outer);
      s.closePath();

      const h = new T.Path();
      const ri = Math.min(rIn, inner * 0.45);
      h.moveTo(-inner + ri, -inner);
      h.lineTo(inner - ri, -inner);
      h.quadraticCurveTo(inner, -inner, inner, -inner + ri);
      h.lineTo(inner, inner - ri);
      h.quadraticCurveTo(inner, inner, inner - ri, inner);
      h.lineTo(-inner + ri, inner);
      h.quadraticCurveTo(-inner, inner, -inner, inner - ri);
      h.lineTo(-inner, -inner + ri);
      h.quadraticCurveTo(-inner, -inner, -inner + ri, -inner);
      h.closePath();
      s.holes.push(h);

      const m = new T.Mesh(
        new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }),
        new T.MeshLambertMaterial({ color })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.receiveShadow = true;
      this.island.add(m);
      return m;
    }

    _buildRoads() {
      // Main asphalt boulevard with rounded corner curves
      this._ring(18.5, 9.5, 0.1, '#475569', 0, 3.5, 2.2);
      // Outer sidewalk curb
      this._ring(18.5, 17.7, 0.14, '#cbd5e1', 0, 3.5, 3.2);
      // Inner sidewalk curb
      this._ring(10.3, 9.5, 0.14, '#cbd5e1', 0, 2.4, 2.2);

      // Lane dashes on straight sections of the avenue
      const dash = new T.MeshBasicMaterial({ color: '#f8fafc' });
      for (let i = -13.5; i <= 13.5; i += 2.4) {
        [[i, -13.6], [i, 13.6], [-13.6, i], [13.6, i]].forEach(([x, z]) => {
          const d = new T.Mesh(new T.PlaneGeometry(1.1, 0.14), dash);
          d.rotation.x = -Math.PI / 2;
          if (Math.abs(z) === 13.6) {
            d.position.set(x, 0.115, z > 0 ? z - 0.2 : z + 0.2);
          } else {
            d.rotation.z = Math.PI / 2;
            d.position.set(x > 0 ? x - 0.2 : x + 0.2, 0.115, z);
          }
          this.island.add(d);
        });
      }
    }

    tilePos(index) {
      const t = this.tiles[index];
      return { x: (t.gridCol - 3) * SPACING, z: (t.gridRow - 3) * SPACING };
    }

    _buildTiles() {
      this.tiles.forEach((tile) => {
        const root = new T.Group();
        const p = this.tilePos(tile.index);
        root.position.set(p.x, 0.1, p.z);
        root.userData.tileIndex = tile.index;
        this.island.add(root);

        // Smooth rounded tile pedestal instead of sharp square slab
        const edge = roundedBox(root, PAD + 0.36, 0.14, PAD + 0.36, 0.65, '#ffffff', 0, 0, 0);
        edge.receiveShadow = true;
        const pad = roundedBox(root, PAD, 0.3, PAD, 0.55, tile.zoneColor || '#64748b', 0, 0, 0);
        pad.receiveShadow = true;
        pad.material = pad.material.clone();
        root.userData.pad = pad;

        const bldg = new T.Group();
        bldg.position.y = PAD_H - 0.1;
        root.add(bldg);
        root.userData.bldg = bldg;
        const label = makeLabel([tile.name], { border: tile.zoneColor });
        root.add(label);
        root.userData.label = label;
        this.tileRoots[tile.index] = root;
        this.tileGroups.push(root);
        this._rebuildBuilding(tile.index, { level: 0, isBuilding: false });
      });

      // "you are here" ring + bouncing arrow
      this.hereRing = new T.Mesh(
        new T.TorusGeometry(3.3, 0.14, 10, 48),
        new T.MeshBasicMaterial({ color: '#34d399', transparent: true, opacity: 0.95 })
      );
      this.hereRing.rotation.x = Math.PI / 2;
      this.island.add(this.hereRing);
      this.arrow = new T.Mesh(
        new T.ConeGeometry(0.55, 1.1, 8),
        new T.MeshLambertMaterial({ color: '#facc15', emissive: '#ca8a04', emissiveIntensity: 0.6 })
      );
      this.arrow.rotation.x = Math.PI;
      this.island.add(this.arrow);
    }

    _rebuildBuilding(index, info) {
      const tile = this.tiles[index];
      const root = this.tileRoots[index];
      if (!root) return;
      const bldg = root.userData.bldg;
      while (bldg.children.length) {
        const c = bldg.children.pop();
        bldg.remove(c);
        disposeTree(c);
      }
      bldg.userData = {};
      const colors = info.colors || {};
      const c = {
        wall: colors.wall || tile.zoneColor || '#3b82f6',
        roof: colors.roof || '#2563eb'
      };
      const lv = Number(info.level || 0);
      const isBld = tile.type === 'scenario' || (tile.type === 'ai-lot' && info.isBuilding);

      if (isBld) {
        const sId = tile.scenarioId || '';
        const name = tile.name || '';
        const icon = tile.icon || '';

        // Display base building (Lv 1) so city is vibrant from the start, upgrading to Lv 2 / Lv 3 on success
        const visLevel = Math.max(1, lv);

        if (sId === 'shift-swap-request' || icon === '🏪' || name.includes('超商')) {
          buildConvenienceStore(bldg, c, visLevel);
        } else if (sId === 'cafe-barista-order' || icon === '☕' || name.includes('咖啡')) {
          buildCafeBoba(bldg, c, visLevel, false);
        } else if (sId === 'bubble-tea-order' || icon === '🧋' || name.includes('奶茶')) {
          buildCafeBoba(bldg, c, visLevel, true);
        } else if (sId === 'summer-internship-interview' || icon === '🚀' || name.includes('矽谷') || name.includes('新創')) {
          buildTechPark(bldg, c, visLevel);
        } else {
          buildCommercialTower(bldg, c, visLevel, tile);
        }
      } else if (tile.type === 'ai-lot') {
        buildConstruction(bldg, tile.zoneColor || '#8b5cf6');
      } else {
        buildSpecial(bldg, tile);
      }

      bldg.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const bb = new T.Box3().setFromObject(bldg);
      const top = Math.max(2.6, bb.max.y - root.position.y);
      root.userData.top = top;
      root.userData.label.position.set(0, top + 1.25, 0);
      root.userData.level = lv;
      bldg.userData.popT = 0;
    }

    _buildDecor() {
      const g = new T.Group();
      this.island.add(g);
      const r = rng(42);
      // inner park trees
      let placed = 0;
      while (placed < 14) {
        const x = (r() - 0.5) * 17;
        const z = (r() - 0.5) * 17;
        if (Math.hypot(x - 2.5, z + 0.5) < 6) continue;
        if (Math.hypot(x + 5, z + 4.5) < 4) continue;
        buildTree(g, x, z, 0.8 + r() * 0.5);
        placed++;
      }
      // outer ring trees & houses
      placed = 0;
      while (placed < 34) {
        const a = r() * Math.PI * 2;
        const rr = 21 + r() * 7;
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr;
        if (Math.max(Math.abs(x), Math.abs(z)) < 19.6) continue;
        buildTree(g, x, z, 0.8 + r() * 0.6);
        placed++;
      }
      const colors = ['#fca5a5', '#fcd34d', '#a5b4fc', '#86efac', '#f9a8d4'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const rr = 25.2;
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr;
        if (Math.max(Math.abs(x), Math.abs(z)) < 19.8) continue;
        const h = new T.Group();
        box(h, 1.6, 1.2, 1.4, colors[i % colors.length], 0, 0, 0);
        const roof = new T.Mesh(new T.ConeGeometry(1.35, 0.9, 4), mat('#b45309'));
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 1.65;
        h.add(roof);
        box(h, 0.3, 0.5, 0.05, '#5b3a1e', 0, 0, 0.72);
        h.position.set(x, 0, z);
        h.rotation.y = -a + Math.PI / 2;
        h.traverse((o) => (o.castShadow = true));
        g.add(h);
      }
      // lamp posts
      for (let i = -16; i <= 16; i += 8) {
        [[i, -18], [i, 18], [-18, i], [18, i]].forEach(([x, z]) => {
          cyl(g, 0.06, 0.08, 1.6, '#475569', x, 0.1, z, 6);
          sphere(g, 0.2, '#fff7c2', x, 1.8, z, { emissive: '#ffe58a', emissiveIntensity: 0.9 });
        });
      }
      // ferris wheel
      const wheel = new T.Group();
      wheel.position.set(2.5, 0, -0.5);
      const rim1 = new T.Mesh(new T.TorusGeometry(3.6, 0.1, 8, 40), mat('#f8fafc'));
      rim1.position.y = 4.4;
      const rim2 = new T.Mesh(new T.TorusGeometry(2.2, 0.07, 8, 32), mat('#f8fafc'));
      rim2.position.y = 4.4;
      const spin = new T.Group();
      spin.position.y = 4.4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spoke = box(spin, 0.07, 7.2, 0.07, '#e2e8f0', 0, -3.6, 0);
        spoke.position.set(0, 0, 0);
        spoke.rotation.z = a;
        spoke.position.y = 0;
        spoke.geometry.translate(0, 0, 0);
        const cab = new T.Group();
        cab.position.set(Math.sin(a) * 3.6, Math.cos(a) * 3.6, 0);
        box(cab, 0.7, 0.55, 0.7, ['#ef4444', '#3b82f6', '#facc15', '#22c55e'][i % 4], 0, -0.6, 0);
        cab.userData.cab = true;
        spin.add(cab);
      }
      rim1.position.y = 0;
      rim2.position.y = 0;
      spin.add(rim1);
      spin.add(rim2);
      wheel.add(spin);
      box(wheel, 0.25, 4.6, 0.25, '#94a3b8', -1.2, 0, 0.5).rotation.z = 0.28;
      box(wheel, 0.25, 4.6, 0.25, '#94a3b8', 1.2, 0, 0.5).rotation.z = -0.28;
      box(wheel, 0.25, 4.6, 0.25, '#94a3b8', -1.2, 0, -0.5).rotation.z = 0.28;
      box(wheel, 0.25, 4.6, 0.25, '#94a3b8', 1.2, 0, -0.5).rotation.z = -0.28;
      wheel.traverse((o) => (o.castShadow = true));
      this.island.add(wheel);
      this.wheelSpin = spin;
    }

    _buildSea() {
      const geo = new T.PlaneGeometry(500, 500, 50, 50);
      geo.rotateX(-Math.PI / 2);
      this.sea = new T.Mesh(
        geo,
        new T.MeshPhongMaterial({
          color: '#39a9e6', transparent: true, opacity: 0.93, flatShading: true, shininess: 60
        })
      );
      this.sea.position.y = -5.2;
      this.sea.receiveShadow = true;
      this.scene.add(this.sea);
      this.seaBase = Float32Array.from(geo.attributes.position.array);
      this.foam = new T.Mesh(
        new T.TorusGeometry(26.6, 0.35, 8, 48),
        new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })
      );
      this.foam.rotation.x = Math.PI / 2;
      this.foam.position.y = -5.15;
      this.scene.add(this.foam);

      // clouds
      const cr = rng(5);
      for (let i = 0; i < 9; i++) {
        const c = new T.Group();
        const n = 3 + Math.floor(cr() * 3);
        for (let k = 0; k < n; k++) {
          const s = new T.Mesh(new T.SphereGeometry(2 + cr() * 2, 10, 8), new T.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 }));
          s.position.set(k * 2.6 - n, cr() * 0.8, cr() * 1.5);
          s.scale.y = 0.6;
          c.add(s);
        }
        c.position.set(-120 + cr() * 240, 22 + cr() * 14, -90 + cr() * 140);
        c.userData.speed = 0.8 + cr() * 1.2;
        this.scene.add(c);
        this.clouds.push(c);
      }
      // boats
      this.boats = [];
      for (let i = 0; i < 3; i++) {
        const b = new T.Group();
        box(b, 2.4, 0.6, 1.0, ['#ef4444', '#facc15', '#3b82f6'][i], 0, 0, 0);
        box(b, 0.1, 2.2, 0.1, '#f8fafc', 0, 0.6, 0);
        const sail = box(b, 0.04, 1.8, 1.2, '#ffffff', 0, 0.9, 0.5);
        b.userData.r = 38 + i * 6;
        b.userData.a = i * 2.1;
        b.userData.sp = (0.12 + i * 0.03) * (i % 2 ? -1 : 1);
        this.scene.add(b);
        this.boats.push(b);
      }
    }

    _buildWalkers() {
      const palette = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
      const r = rng(99);
      for (let i = 0; i < 30; i++) {
        const H = SIDEWALKS[i % 2] + (r() - 0.5) * 0.5;
        const av = makeAvatar(palette[Math.floor(r() * palette.length)], 100 + i, 0.62 + r() * 0.12);
        av.position.y = 0.14;
        this.island.add(av);
        this.walkers.push({
          av, H, s: r() * 8 * H, dir: r() < 0.5 ? 1 : -1, speed: 0.8 + r() * 0.9,
          phase: r() * 6, pause: 0
        });
      }
    }

    _loopPos(H, s) {
      const L = 2 * H;
      s = ((s % (8 * H)) + 8 * H) % (8 * H);
      if (s < L) return { x: -H + s, z: -H, vx: 1, vz: 0 };
      if (s < 2 * L) return { x: H, z: -H + (s - L), vx: 0, vz: 1 };
      if (s < 3 * L) return { x: H - (s - 2 * L), z: H, vx: -1, vz: 0 };
      return { x: -H, z: H - (s - 3 * L), vx: 0, vz: -1 };
    }

    _buildPlayer() {
      this.me = makeAvatar('#f97316', 5, 1.15);
      this.island.add(this.me);
      this.meMover = new Mover(this.me, PAD_H + 0.1);
      this.meLabel = makeLabel(['YOU'], { bg: 'rgba(249,115,22,0.95)', border: '#fff', width: 2.6 });
      this.meLabel.position.y = 3.3;
      this.me.add(this.meLabel);
      this.meLabel.scale.multiplyScalar(1 / 1.15);
      const beam = new T.Mesh(
        new T.CylinderGeometry(0.9, 0.9, 6, 20, 1, true),
        new T.MeshBasicMaterial({ color: '#fdba74', transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false })
      );
      beam.position.y = 3;
      this.me.add(beam);
      this.setPlayerTile(this.playerTile, false);
    }

    /* --------------------------------------------------------------- public */
    _slot(index, slot) {
      const p = this.tilePos(index);
      // Position avatars along the open sidewalk plaza and street front in full camera view
      const offs = [
        [ 0.0, 2.7 ],   // Slot 0: Main player (front center entrance)
        [-1.7, 2.6 ],   // Slot 1: Classmate left entrance
        [ 1.7, 2.6 ],   // Slot 2: Classmate right entrance
        [-2.8, 2.4 ],   // Slot 3: Sidewalk left curb
        [ 2.8, 2.4 ],   // Slot 4: Sidewalk right curb
        [ 0.0, 3.5 ],   // Slot 5: Avenue pedestrian crosswalk
        [-1.8, 3.4 ],   // Slot 6: Avenue bike lane left
        [ 1.8, 3.4 ]    // Slot 7: Avenue bike lane right
      ];
      const o = offs[slot % offs.length];
      return { x: p.x + o[0], z: p.z + o[1] };
    }

    setTileInfos(infos) {
      if (!this.ok || !this.tileRoots) return;
      infos.forEach((info) => {
        if (!info) return;
        const root = this.tileRoots[info.index];
        if (!root) return;
        const key = [info.level, info.isBuilding ? 1 : 0, info.colors && info.colors.wall, info.colors && info.colors.roof].join('|');
        if (root.userData.key !== key) {
          const first = root.userData.key === undefined;
          root.userData.key = key;
          this._rebuildBuilding(info.index, info);
          if (!first) root.userData.bldg.userData.popT = 0.001;
        }
        const tile = this.tiles[info.index];
        const lines = info.isBuilding
          ? [info.name, info.level > 0 ? ('★'.repeat(info.level) + '☆'.repeat(3 - info.level) + '  Lv.' + info.level) : '💼 點擊展開任務']
          : [info.name];
        const lkey = lines.join('/');
        if (root.userData.lkey !== lkey) {
          root.userData.lkey = lkey;
          setLabel(root.userData.label, lines, { border: tile.zoneColor });
        }
      });
      this._updateHere();
    }

    setPlayerTile(index, animate) {
      if (!this.ok) return;
      this.playerTile = index;
      const s = this._slot(index, 0);
      if (!this.meMover) return;
      if (animate) this.meMover.push(s.x, s.z, 0.28, 0.9);
      else this.meMover.snap(s.x, s.z);
      this._updateHere();
    }

    _updateHere() {
      if (!this.ok || !this.hereRing) return;
      const p = this.tilePos(this.playerTile);
      const root = this.tileRoots[this.playerTile];
      this.hereRing.position.set(p.x, 0.62, p.z);
      this.arrow.position.set(p.x, (root ? root.userData.top : 3) + 3.2, p.z);
      const tile = this.tiles[this.playerTile];
      const isBld = tile.type === 'scenario' || (tile.type === 'ai-lot' && root && root.userData.key && root.userData.key.split('|')[1] === '1');
      this.arrow.visible = !!isBld;
    }

    setRemotePlayers(list) {
      if (!this.ok || !this.island) return;
      const seen = new Set();
      (list || []).forEach((u, i) => {
        seen.add(u.id);
        let rp = this.remote.get(u.id);
        const slot = 1 + ((hashStr(u.id) + i) % 7);
        if (!rp) {
          // Scale avatar up to 1.25 for prominent visibility on the street
          const av = makeAvatar(u.color || '#6366f1', hashStr(u.id), 1.25);

          // Glowing circular shadow / pedestal under feet
          const disc = new T.Mesh(
            new T.RingGeometry(0.2, 0.72, 24),
            new T.MeshBasicMaterial({ color: u.color || '#38bdf8', transparent: true, opacity: 0.75, side: T.DoubleSide })
          );
          disc.rotation.x = -Math.PI / 2;
          disc.position.y = 0.04;
          av.add(disc);

          const label = makeLabel([u.name || '同學'], {
            bg: 'rgba(15,23,42,0.92)',
            border: u.color || '#38bdf8',
            width: 3.6
          });
          label.position.y = 3.2;
          av.add(label);
          this.island.add(av);
          const s = this._slot(u.tile, slot);
          rp = { av, label, mover: new Mover(av, PAD_H + 0.1), tile: u.tile, name: u.name, slot };
          rp.mover.snap(s.x, s.z);
          this.remote.set(u.id, rp);
        }
        if (rp.name !== u.name) {
          rp.name = u.name;
          setLabel(rp.label, [u.name || '同學'], {
            bg: 'rgba(15,23,42,0.92)',
            border: u.color || '#38bdf8',
            width: 3.6
          });
        }
        if (rp.tile !== u.tile) {
          const n = this.tiles.length;
          let steps = (u.tile - rp.tile + n) % n;
          if (steps > 8) {
            const s = this._slot(u.tile, slot);
            rp.mover.snap(s.x, s.z);
          } else {
            let t = rp.tile;
            for (let j = 0; j < steps; j++) {
              t = (t + 1) % n;
              const s = this._slot(t, slot);
              rp.mover.push(s.x, s.z, 0.38, 0.28);
            }
          }
          rp.tile = u.tile;
        }
      });
      this.remote.forEach((rp, id) => {
        if (!seen.has(id)) {
          this.island.remove(rp.av);
          disposeTree(rp.av);
          this.remote.delete(id);
        }
      });
    }

    focusRemotePlayer(id) {
      if (!this.ok || !this.cam) return null;
      const rp = this.remote.get(id);
      if (!rp) return null;
      this.cam.tTarget.set(rp.av.position.x, 1.8, rp.av.position.z);
      this.cam.tDist = 32;
      return rp;
    }

    focusPlayer() {
      if (!this.ok) return;
      const p = this.tilePos(this.playerTile);
      this.cam.tTarget.set(p.x, 1.5, p.z);
      this.cam.tDist = 34;
    }

    resetView() {
      if (!this.ok) return;
      const isNarrow = (this.container.clientWidth / Math.max(1, this.container.clientHeight)) < 0.85;
      this.cam.tTarget.set(0, 1, 2);
      this.cam.tDist = isNarrow ? 76 : 62;
      this.cam.tAz = 0.75;
      this.cam.tEl = 0.72;
    }

    setPaused(p) {
      if (!this.ok) return;
      this.paused = p;
    }

    /* ---------------------------------------------------------------- input */
    _bindInput() {
      const el = this.renderer.domElement;
      el.style.touchAction = 'none';
      const pointers = new Map();
      let down = null;
      let pinch = 0;
      this.mouse = new T.Vector2(-9, -9);
      this.mouseClient = { x: 0, y: 0, inside: false };
      this.ray = new T.Raycaster();

      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = Math.hypot(a.x - b.x, a.y - b.y);
        }
      });
      el.addEventListener('pointermove', (e) => {
        this._setMouse(e);
        const p = pointers.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;
        if (down) down.moved += Math.abs(dx) + Math.abs(dy);
        if (pointers.size === 1) {
          this.cam.tAz -= dx * 0.006;
          this.cam.tEl = Math.min(1.3, Math.max(0.3, this.cam.tEl + dy * 0.005));
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) this.cam.tDist = Math.min(95, Math.max(20, this.cam.tDist * (pinch / d)));
          pinch = d;
        }
      });
      const up = (e) => {
        pointers.delete(e.pointerId);
        pinch = 0;
        if (down && down.moved < 18 && performance.now() - down.t < 650 && e.type === 'pointerup') {
          this._setMouse(e);
          const idx = this._pick();
          if (idx >= 0) this.onTileClick(idx);
        }
        if (!pointers.size) down = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', () => {
        this.mouseClient.inside = false;
      });
      el.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.cam.tDist = Math.min(95, Math.max(20, this.cam.tDist * Math.exp(e.deltaY * 0.001)));
        },
        { passive: false }
      );
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _setMouse(e) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.mouseClient = { x: e.clientX - rect.left, y: e.clientY - rect.top, inside: true };
    }

    _pick() {
      this.ray.setFromCamera(this.mouse, this.camera);
      const hits = this.ray.intersectObjects(this.tileGroups, true);
      for (const h of hits) {
        let o = h.object;
        while (o && o.userData.tileIndex === undefined) o = o.parent;
        if (o && o.userData.tileIndex !== undefined && !(h.object.isSprite)) return o.userData.tileIndex;
      }
      return -1;
    }

    /* ----------------------------------------------------------------- loop */
    _resize() {
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 500;
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.camera.aspect = w / h;
      if (this.camera.aspect < 0.85) {
        const factor = Math.min(1.4, 0.85 / this.camera.aspect);
        this.cam.tDist = Math.max(this.cam.tDist, 60 * factor);
      }
      this.camera.updateProjectionMatrix();
    }

    _loop() {
      this._raf = requestAnimationFrame(() => this._loop());
      if (this.paused || !this.container.offsetParent || document.hidden) {
        this.clock.getDelta();
        return;
      }
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.time += dt;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    _update(dt) {
      const t = this.time;
      // camera easing
      const c = this.cam;
      const k = 1 - Math.pow(0.0015, dt);
      c.az += (c.tAz - c.az) * k;
      c.el += (c.tEl - c.el) * k;
      c.dist += (c.tDist - c.dist) * k;
      c.target.lerp(c.tTarget, k);
      this.camera.position.set(
        c.target.x + c.dist * Math.sin(c.az) * Math.cos(c.el),
        c.target.y + c.dist * Math.sin(c.el),
        c.target.z + c.dist * Math.cos(c.az) * Math.cos(c.el)
      );
      this.camera.lookAt(c.target);

      // sea
      const pos = this.sea.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = this.seaBase[i * 3];
        const z = this.seaBase[i * 3 + 2];
        pos.setY(i, Math.sin(x * 0.12 + t * 1.2) * 0.25 + Math.cos(z * 0.1 + t * 0.9) * 0.25);
      }
      pos.needsUpdate = true;
      this.sea.geometry.computeVertexNormals();
      this.foam.scale.setScalar(1 + Math.sin(t * 1.3) * 0.012);
      this.island.position.y = Math.sin(t * 0.7) * 0.12;

      this.clouds.forEach((cl) => {
        cl.position.x += cl.userData.speed * dt;
        if (cl.position.x > 130) cl.position.x = -130;
      });
      this.boats.forEach((b) => {
        b.userData.a += b.userData.sp * dt;
        const a = b.userData.a;
        b.position.set(Math.cos(a) * b.userData.r, -5.0 + Math.sin(t * 2 + a) * 0.1, Math.sin(a) * b.userData.r);
        b.rotation.y = -a + (b.userData.sp > 0 ? 0 : Math.PI);
      });
      if (this.wheelSpin) {
        this.wheelSpin.rotation.z += dt * 0.25;
        this.wheelSpin.children.forEach((ch) => {
          if (ch.userData.cab) ch.rotation.z = -this.wheelSpin.rotation.z;
        });
      }

      // pedestrians
      this.walkers.forEach((w) => {
        if (w.pause > 0) {
          w.pause -= dt;
          animateAvatar(w.av, t, false, w.phase);
          return;
        }
        w.s += w.dir * w.speed * dt;
        const p = this._loopPos(w.H, w.s);
        w.av.position.x = p.x;
        w.av.position.z = p.z;
        w.av.rotation.y = Math.atan2(p.vx * w.dir, p.vz * w.dir);
        w.av.position.y = 0.14 + Math.abs(Math.sin(t * 11 + w.phase)) * 0.04;
        animateAvatar(w.av, t, true, w.phase);
        if (Math.random() < dt * 0.02) w.pause = 1 + Math.random() * 2;
      });

      // movers
      this.meMover.update(dt);
      animateAvatar(this.me, t, this.meMover.moving);
      this.remote.forEach((rp, id) => {
        rp.mover.update(dt);
        animateAvatar(rp.av, t, rp.mover.moving, hashStr(id) % 6);
      });

      // here ring / arrow pulse
      this.hereRing.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
      this.hereRing.material.opacity = 0.65 + Math.sin(t * 4) * 0.3;
      this.arrow.position.y += Math.sin(t * 5) * 0.012;
      this.arrow.rotation.y = t * 2;

      // hover
      let hover = -1;
      if (this.mouseClient.inside) hover = this._pick();
      if (hover !== this.hoverIndex) {
        this.hoverIndex = hover;
        this.renderer.domElement.style.cursor = hover >= 0 ? 'pointer' : 'grab';
        if (this.onHover) this.onHover(hover, this.mouseClient);
      } else if (hover >= 0 && this.onHover) this.onHover(hover, this.mouseClient);

      // per-tile animation
      this.tileRoots.forEach((root) => {
        const idx = root.userData.tileIndex;
        const bg = root.userData.bldg;
        const u = bg.userData;
        const hov = idx === this.hoverIndex;
        const targetS = hov ? 1.06 : 1;
        let s = bg.scale.x + (targetS - bg.scale.x) * Math.min(1, dt * 10);
        if (u.popT) {
          u.popT += dt;
          const p = Math.min(1, u.popT / 0.7);
          s = p < 1 ? 0.2 + (1 - Math.pow(1 - p, 3)) * 0.8 + Math.sin(p * Math.PI) * 0.12 : 1;
          if (p >= 1) u.popT = 0;
        }
        bg.scale.setScalar(s);
        const pad = root.userData.pad;
        pad.material.emissive = pad.material.emissive || new T.Color();
        pad.material.emissive.set(hov ? '#555555' : idx === this.playerTile ? '#1a5c3a' : '#000000');
        if (u.spin) {
          if (u.spin.isMesh) u.spin.rotation.y += dt * 1.4;
          else u.spin.rotation.y += dt * 0.4;
        }
        if (u.bob) u.bob.position.y = 2.2 + Math.sin(t * 2) * 0.25;
        if (u.beacon) u.beacon.material.emissiveIntensity = 0.3 + (Math.sin(t * 5) + 1) * 0.5;
        if (u.glow) u.glow.material.opacity = 0.45 + Math.sin(t * 2) * 0.3;
        if (u.flag) u.flag.rotation.y = Math.sin(t * 4) * 0.3;
        if (u.train) u.train.position.x = Math.sin(t * 0.8) * 1.3;
        if (u.jet) u.jet.scale.y = 0.8 + Math.sin(t * 6) * 0.2;
        if (u.screen) u.screen.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 3)) * 0.6;
      });
    }
  }

  window.ExecVoice.IslandCity = IslandCity;
})();
