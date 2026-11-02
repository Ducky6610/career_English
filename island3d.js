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

  function cyl(parent, rt, rb, h, color, x, y, z, seg, extra) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 16), mat(color, extra));
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }

  function sphere(parent, r, color, x, y, z, extra) {
    const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), mat(color, extra));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  const texCache = new Map();
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
    const sw = moving ? Math.sin(time * 11 + (phase || 0)) * 0.7 : 0;
    u.legL.rotation.x = sw;
    u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.8;
    u.armR.rotation.x = sw * 0.8;
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

  /* -------------------------------------------------------- building models */
  const CRATE = '#c08a4a';

  function buildConstruction(g, accent) {
    box(g, 5.2, 0.2, 4.6, '#78716c', 0, 0, 0);
    [[-2.4, -2.1], [2.4, -2.1], [-2.4, 2.1], [2.4, 2.1]].forEach(([x, z]) =>
      box(g, 0.18, 1.3, 0.18, '#facc15', x, 0.2, z)
    );
    box(g, 4.8, 0.14, 0.1, '#f97316', 0, 0.9, 2.1);
    box(g, 4.8, 0.14, 0.1, '#f97316', 0, 0.5, 2.1);
    box(g, 4.8, 0.14, 0.1, '#f97316', 0, 0.9, -2.1);
    box(g, 0.1, 0.14, 4.2, '#f97316', 2.4, 0.9, 0);
    box(g, 0.1, 0.14, 4.2, '#f97316', -2.4, 0.9, 0);
    box(g, 1.1, 0.6, 1.1, CRATE, -1.3, 0.2, 0.8);
    box(g, 0.9, 0.5, 0.9, CRATE, -0.5, 0.2, 1.3);
    box(g, 1.0, 0.5, 1.0, '#a16207', -1.2, 0.8, 0.9);
    cyl(g, 0, 0.28, 0.6, '#f97316', 1.2, 0.2, 1.2, 10);
    cyl(g, 0, 0.28, 0.6, '#f97316', 1.7, 0.2, 0.5, 10);
    // crane
    box(g, 0.3, 4.6, 0.3, '#eab308', 1.5, 0.2, -1.2);
    const jib = new T.Group();
    jib.position.set(1.5, 4.9, -1.2);
    box(jib, 4.4, 0.22, 0.22, '#eab308', -1.0, 0, 0);
    box(jib, 0.9, 0.5, 0.5, '#57534e', 1.5, -0.1, 0);
    box(jib, 0.04, 1.4, 0.04, '#1f2937', -2.4, -1.4, 0);
    box(jib, 0.4, 0.3, 0.4, '#ef4444', -2.4, -1.7, 0);
    g.add(jib);
    g.userData.spin = jib;
    box(g, 0.5, 0.35, 0.5, accent, -1.9, 0.2, -1.5);
  }

  function buildShop(g, c) {
    tower(g, 4.2, 2.6, 3.6, c.wall, c.roof, 0, 0, -0.3, {});
    for (let i = 0; i < 6; i++) {
      box(g, 0.72, 0.12, 1.1, i % 2 ? '#ffffff' : c.roof, -1.8 + i * 0.72 + 0.36, 1.85, 2.0);
    }
    box(g, 0.85, 1.5, 0.08, '#5b3a1e', 0, 0, 1.52);
    box(g, 2.6, 0.75, 0.22, c.roof, 0, 2.6, 0.2);
    sphere(g, 0.32, '#22c55e', -1.9, 0.5, 2.1);
    sphere(g, 0.32, '#22c55e', 1.9, 0.5, 2.1);
    cyl(g, 0.22, 0.18, 0.3, '#b45309', -1.9, 0, 2.1, 10);
    cyl(g, 0.22, 0.18, 0.3, '#b45309', 1.9, 0, 2.1, 10);
  }

  function buildMidrise(g, c) {
    tower(g, 5.0, 1.8, 4.6, c.wall, c.roof, 0, 0, 0, {});
    tower(g, 3.6, 5.2, 3.4, '#2f6f9f', c.roof, 0, 1.8, 0, { glass: true });
    box(g, 2.4, 0.16, 1.4, '#ffffff', 0, 1.5, 2.9);
    box(g, 0.14, 1.5, 0.14, '#cbd5e1', -1.1, 0, 3.4);
    box(g, 0.14, 1.5, 0.14, '#cbd5e1', 1.1, 0, 3.4);
    box(g, 1.2, 0.55, 1.2, '#94a3b8', 0.7, 7.0, 0.2);
    box(g, 0.8, 0.35, 0.8, '#64748b', -0.8, 7.0, -0.6);
    cyl(g, 0.9, 0.9, 0.08, '#475569', -0.5, 7.0, 0.7, 20);
    sphere(g, 0.35, '#22c55e', -2.3, 0.4, 2.6);
    sphere(g, 0.35, '#22c55e', 2.3, 0.4, 2.6);
  }

  function buildSkyscraper(g, c) {
    const gold = '#d9a21b';
    tower(g, 5.4, 1.8, 5.0, c.wall, c.roof, 0, 0, 0, {});
    tower(g, 4.0, 5.5, 3.8, gold, '#fde047', 0, 1.8, 0, { floorH: 1.3 });
    tower(g, 2.8, 2.4, 2.7, gold, '#fde047', 0, 7.3, 0, { floorH: 1.2 });
    const crown = new T.Mesh(new T.ConeGeometry(1.7, 1.6, 4), mat('#fde047', { emissive: '#a16207', emissiveIntensity: 0.5 }));
    crown.rotation.y = Math.PI / 4;
    crown.position.y = 10.5;
    g.add(crown);
    cyl(g, 0.05, 0.07, 2.4, '#e5e7eb', 0, 11.2, 0, 6);
    const beacon = sphere(g, 0.2, '#ef4444', 0, 13.6, 0, { emissive: '#ef4444', emissiveIntensity: 1 });
    g.userData.beacon = beacon;
    const ring = new T.Mesh(new T.TorusGeometry(3.5, 0.08, 8, 40), new T.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    g.userData.glow = ring;
    box(g, 0.3, 4.0, 0.3, '#fbbf24', 2.9, 0, 2.7);
    box(g, 0.3, 4.0, 0.3, '#fbbf24', -2.9, 0, 2.7);
  }

  function buildTree(parent, x, z, s) {
    const g = new T.Group();
    cyl(g, 0.14 * s, 0.2 * s, 0.9 * s, '#7c4a1e', 0, 0, 0, 6);
    const crown = new T.Mesh(new T.ConeGeometry(0.85 * s, 1.5 * s, 7), mat('#2f9e44'));
    crown.position.y = 1.5 * s;
    g.add(crown);
    const crown2 = new T.Mesh(new T.ConeGeometry(0.65 * s, 1.2 * s, 7), mat('#37b24d'));
    crown2.position.y = 2.2 * s;
    g.add(crown2);
    g.position.set(x, 0, z);
    g.traverse((o) => (o.castShadow = true));
    parent.add(g);
    return g;
  }

  function questionTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 128);
    gr.addColorStop(0, '#fde047');
    gr.addColorStop(1, '#f59e0b');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#fff';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#7c2d12';
    g.font = 'bold 96px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 64, 70);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function buildSpecial(g, tile) {
    const accent = tile.zoneColor || '#64748b';
    switch (tile.type) {
      case 'corner-start': {
        box(g, 4.8, 0.3, 3.8, '#e7e0cc', 0, 0, 0);
        tower(g, 4.4, 2.2, 3.4, '#f5efe0', '#d9cfae', 0, 0.3, 0, { floorH: 2 });
        for (let i = 0; i < 4; i++) cyl(g, 0.17, 0.17, 2.2, '#fffaf0', -1.5 + i, 0.3, 1.85, 10);
        const ped = new T.Mesh(new T.ConeGeometry(2.6, 0.9, 3), mat('#d9cfae'));
        ped.rotation.set(Math.PI / 2, 0, Math.PI);
        ped.rotation.order = 'YXZ';
        ped.position.set(0, 2.9, 1.7);
        ped.scale.set(1, 0.3, 1);
        ped.rotation.set(0, 0, 0);
        g.add(ped);
        const dome = new T.Mesh(new T.SphereGeometry(1.15, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#14b8a6'));
        dome.position.set(0, 2.5, -0.2);
        g.add(dome);
        cyl(g, 0.05, 0.05, 1.6, '#e5e7eb', 0, 3.6, -0.2, 6);
        const flag = box(g, 0.9, 0.5, 0.05, '#ef4444', 0.45, 4.7, -0.2);
        g.userData.flag = flag;
        break;
      }
      case 'chance': {
        if (tile.icon === '📺') {
          box(g, 4.2, 0.4, 3.4, '#475569', 0, 0, 0);
          box(g, 0.4, 5.0, 0.4, '#94a3b8', -1.3, 0.4, -0.5);
          const screen = box(g, 3.0, 1.9, 0.3, '#0f172a', 0, 2.6, 0.4);
          const sc = box(g, 2.7, 1.6, 0.06, '#ec4899', 0, 2.75, 0.58, { emissive: '#ec4899', emissiveIntensity: 0.9 });
          g.userData.screen = sc;
          box(g, 0.3, 2.2, 0.3, '#64748b', 0, 0.4, 0.3);
          const dish = new T.Mesh(new T.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e5e7eb'));
          dish.rotation.x = Math.PI / 3;
          dish.position.set(-1.3, 5.6, -0.2);
          g.add(dish);
        } else {
          cyl(g, 1.9, 2.1, 0.4, accent, 0, 0, 0, 24);
          cyl(g, 1.3, 1.5, 0.5, '#fff7ed', 0, 0.4, 0, 24);
          const q = new T.Mesh(new T.BoxGeometry(1.7, 1.7, 1.7), new T.MeshLambertMaterial({ map: questionTexture(), emissive: '#f59e0b', emissiveIntensity: 0.35 }));
          q.position.y = 2.2;
          q.castShadow = true;
          g.add(q);
          g.userData.spin = q;
          g.userData.bob = q;
        }
        break;
      }
      case 'corner-transit': {
        box(g, 5.2, 0.3, 4.0, '#64748b', 0, 0, 0);
        tower(g, 4.6, 1.8, 2.2, '#c7d2e0', '#e2e8f0', 0, 0.3, -1.0, { floorH: 1.8 });
        box(g, 5.0, 0.18, 2.0, accent, 0, 2.3, 0.1);
        [-2.2, 2.2].forEach((x) => box(g, 0.16, 2.0, 0.16, '#94a3b8', x, 0.3, 1.0));
        box(g, 5.0, 0.08, 0.14, '#1f2937', 0, 0.3, 1.5);
        box(g, 5.0, 0.08, 0.14, '#1f2937', 0, 0.3, 1.9);
        const train = new T.Group();
        for (let i = 0; i < 3; i++) {
          box(train, 1.3, 0.9, 0.85, i === 0 ? accent : '#e2e8f0', i * 1.4 - 1.4, 0.35, 0);
          box(train, 1.0, 0.3, 0.05, '#7dd3fc', i * 1.4 - 1.4, 0.7, 0.44);
        }
        train.position.set(0, 0.1, 1.7);
        g.add(train);
        g.userData.train = train;
        break;
      }
      case 'corner-park': {
        cyl(g, 2.0, 2.2, 0.35, '#cbd5e1', 0, 0, 0.2, 28);
        cyl(g, 1.75, 1.75, 0.3, '#38bdf8', 0, 0.2, 0.2, 28, { transparent: true, opacity: 0.85 });
        cyl(g, 0.35, 0.5, 0.9, '#e2e8f0', 0, 0.2, 0.2, 14);
        const jet = cyl(g, 0.09, 0.09, 1.6, '#bae6fd', 0, 1.1, 0.2, 8, { transparent: true, opacity: 0.8 });
        g.userData.jet = jet;
        buildTree(g, -2.2, -1.8, 1.0);
        buildTree(g, 2.2, -1.9, 0.9);
        buildTree(g, -2.3, 2.0, 0.8);
        box(g, 1.1, 0.12, 0.35, '#8b5a2b', 2.2, 0.3, 2.0);
        box(g, 1.1, 0.4, 0.08, '#8b5a2b', 2.2, 0.45, 1.85);
        break;
      }
      case 'corner-builder': {
        tower(g, 4.4, 2.6, 3.6, '#7c5cc4', '#c4b5fd', 0, 0, -0.4, { floorH: 2.4 });
        box(g, 4.8, 0.3, 4.0, '#e9d5ff', 0, 0, -0.4);
        cyl(g, 0.9, 0.5, 0.9, '#facc15', 0, 3.2, 1.2, 20, { emissive: '#a16207', emissiveIntensity: 0.5 });
        cyl(g, 0.12, 0.12, 0.5, '#facc15', 0, 2.8, 1.2, 8);
        cyl(g, 0.6, 0.6, 0.3, '#a16207', 0, 2.5, 1.2, 16);
        const h1 = new T.Mesh(new T.TorusGeometry(0.4, 0.08, 6, 14), mat('#facc15'));
        h1.position.set(-0.95, 3.7, 1.2);
        g.add(h1);
        const h2 = h1.clone();
        h2.position.x = 0.95;
        g.add(h2);
        g.userData.spin = null;
        g.userData.bob = null;
        break;
      }
      case 'academy': {
        tower(g, 4.6, 2.4, 3.4, '#b5651d', '#7c2d12', 0, 0, 0, { floorH: 2.2 });
        tower(g, 1.2, 4.2, 1.2, '#c97b2e', '#7c2d12', -1.5, 0, 1.3, { floorH: 2 });
        const roofC = new T.Mesh(new T.ConeGeometry(0.95, 1.1, 4), mat('#7c2d12'));
        roofC.rotation.y = Math.PI / 4;
        roofC.position.set(-1.5, 4.75, 1.3);
        g.add(roofC);
        cyl(g, 0.4, 0.4, 0.06, '#ffffff', -1.5, 3.2, 1.93, 20).rotation.x = Math.PI / 2;
        box(g, 2.0, 0.2, 2.0, '#111827', 1.1, 2.4, 0);
        box(g, 0.9, 0.35, 0.9, '#111827', 1.1, 2.1, 0);
        box(g, 0.06, 0.6, 0.06, '#facc15', 2.0, 1.9, 0);
        box(g, 1.2, 0.8, 0.06, '#5b3a1e', 0.8, 0, 1.72);
        break;
      }
      default:
        box(g, 4, 0.4, 4, accent, 0, 0, 0);
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
      this.scene.add(new T.HemisphereLight(0xcfeaff, 0x7a9a60, 0.95));
      const sun = new T.DirectionalLight(0xfff3d6, 1.25);
      sun.position.set(-26, 42, 22);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera;
      sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 120;
      sun.shadow.bias = -0.0006;
      this.scene.add(sun);
    }

    _buildIsland() {
      this.island = new T.Group();
      this.scene.add(this.island);
      const rock = new T.Mesh(
        new T.CylinderGeometry(29.5, 25, 12, 16, 1),
        new T.MeshLambertMaterial({ color: '#9a8571', flatShading: true })
      );
      rock.position.y = -6.3;
      rock.receiveShadow = true;
      this.island.add(rock);
      const under = new T.Mesh(
        new T.ConeGeometry(25, 14, 10),
        new T.MeshLambertMaterial({ color: '#7d6b59', flatShading: true })
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
        new T.CylinderGeometry(9.4, 9.4, 0.04, 40),
        new T.MeshLambertMaterial({ color: '#9ae06b' })
      );
      inner.position.y = 0.02;
      inner.receiveShadow = true;
      this.island.add(inner);
      // pond
      const pond = new T.Mesh(
        new T.CylinderGeometry(2.6, 2.6, 0.06, 28),
        new T.MeshLambertMaterial({ color: '#4cc3f0', transparent: true, opacity: 0.9 })
      );
      pond.position.set(-5, 0.07, -4.5);
      this.island.add(pond);
      // rocks at cliffs
      const r = rng(7);
      for (let i = 0; i < 14; i++) {
        const a = r() * Math.PI * 2;
        const rr = 26 + r() * 3;
        const m = new T.Mesh(
          new T.DodecahedronGeometry(0.8 + r() * 1.0, 0),
          new T.MeshLambertMaterial({ color: '#8b7d6b', flatShading: true })
        );
        m.position.set(Math.cos(a) * rr, -0.4 + r() * 0.3, Math.sin(a) * rr);
        m.castShadow = true;
        this.island.add(m);
      }
    }

    _ring(outer, inner, depth, color, y) {
      const s = new T.Shape();
      s.moveTo(-outer, -outer);
      s.lineTo(outer, -outer);
      s.lineTo(outer, outer);
      s.lineTo(-outer, outer);
      s.closePath();
      const h = new T.Path();
      h.moveTo(-inner, -inner);
      h.lineTo(-inner, inner);
      h.lineTo(inner, inner);
      h.lineTo(inner, -inner);
      h.closePath();
      s.holes.push(h);
      const m = new T.Mesh(
        new T.ExtrudeGeometry(s, { depth, bevelEnabled: false }),
        new T.MeshLambertMaterial({ color })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.receiveShadow = true;
      this.island.add(m);
      return m;
    }

    _buildRoads() {
      this._ring(18.4, 9.6, 0.1, '#566070', 0);
      this._ring(18.4, 17.6, 0.15, '#d8dee6', 0);
      this._ring(10.4, 9.6, 0.15, '#d8dee6', 0);
      // lane dashes on the road edge
      const dash = new T.MeshBasicMaterial({ color: '#f5f5f5' });
      for (let i = -17; i <= 17; i += 2.4) {
        [[i, -14], [i, 14], [-14, i], [14, i]].forEach(([x, z]) => {
          const d = new T.Mesh(new T.PlaneGeometry(1, 0.12), dash);
          d.rotation.x = -Math.PI / 2;
          if (Math.abs(z) === 14) d.position.set(x, 0.115, z + (z > 0 ? -3.3 : 3.3));
          else {
            d.rotation.z = Math.PI / 2;
            d.position.set(x + (x > 0 ? -3.3 : 3.3), 0.115, z);
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
        const edge = box(root, PAD + 0.3, 0.14, PAD + 0.3, '#ffffff', 0, 0, 0);
        edge.receiveShadow = true;
        const pad = box(root, PAD, 0.3, PAD, tile.zoneColor || '#64748b', 0, 0, 0);
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
        new T.ConeGeometry(0.55, 1.1, 4),
        new T.MeshLambertMaterial({ color: '#facc15', emissive: '#ca8a04', emissiveIntensity: 0.6 })
      );
      this.arrow.rotation.x = Math.PI;
      this.island.add(this.arrow);
    }

    _rebuildBuilding(index, info) {
      const tile = this.tiles[index];
      const root = this.tileRoots[index];
      const bldg = root.userData.bldg;
      while (bldg.children.length) {
        const c = bldg.children.pop();
        bldg.remove(c);
        disposeTree(c);
      }
      bldg.userData = {};
      const colors = info.colors || {};
      const c = {
        wall: colors.wall || '#3b82f6',
        roof: colors.roof || '#2563eb'
      };
      const isBld = tile.type === 'scenario' || (tile.type === 'ai-lot' && info.isBuilding);
      if (isBld) {
        const lv = info.level || 0;
        if (lv <= 0) buildConstruction(bldg, c.roof);
        else if (lv === 1) buildShop(bldg, c);
        else if (lv === 2) buildMidrise(bldg, c);
        else buildSkyscraper(bldg, c);
      } else if (tile.type === 'ai-lot') {
        buildConstruction(bldg, tile.zoneColor || '#8b5cf6');
      } else {
        buildSpecial(bldg, tile);
      }
      bldg.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      const bb = new T.Box3().setFromObject(bldg);
      const top = Math.max(2.5, bb.max.y - root.position.y);
      root.userData.top = top;
      root.userData.label.position.set(0, top + 1.2, 0);
      root.userData.level = info.level || 0;
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
      const offs = [[0, 2.45], [-2.3, 1.2], [2.3, 1.2], [-2.3, -0.6], [2.3, -0.6], [0, -2.4]];
      const o = offs[slot % offs.length];
      return { x: p.x + o[0], z: p.z + o[1] };
    }

    setTileInfos(infos) {
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
          ? [info.name, '★'.repeat(info.level) + '☆'.repeat(3 - info.level) + '  Lv.' + info.level]
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
      this.playerTile = index;
      const s = this._slot(index, 0);
      if (!this.meMover) return;
      if (animate) this.meMover.push(s.x, s.z, 0.28, 0.9);
      else this.meMover.snap(s.x, s.z);
      this._updateHere();
    }

    _updateHere() {
      if (!this.hereRing) return;
      const p = this.tilePos(this.playerTile);
      const root = this.tileRoots[this.playerTile];
      this.hereRing.position.set(p.x, 0.62, p.z);
      this.arrow.position.set(p.x, (root ? root.userData.top : 3) + 3.2, p.z);
      const tile = this.tiles[this.playerTile];
      const isBld = tile.type === 'scenario' || (tile.type === 'ai-lot' && root && root.userData.key && root.userData.key.split('|')[1] === '1');
      this.arrow.visible = !!isBld;
    }

    setRemotePlayers(list) {
      const seen = new Set();
      list.forEach((u) => {
        seen.add(u.id);
        let rp = this.remote.get(u.id);
        const slot = 1 + (hashStr(u.id) % 5);
        if (!rp) {
          const av = makeAvatar(u.color || '#6366f1', hashStr(u.id), 1.0);
          const label = makeLabel([u.name || '同學'], { bg: 'rgba(30,41,59,0.9)', border: u.color || '#a5b4fc', width: 3.2 });
          label.position.y = 2.7;
          av.add(label);
          this.island.add(av);
          const s = this._slot(u.tile, slot);
          rp = { av, label, mover: new Mover(av, PAD_H + 0.1), tile: u.tile, name: u.name, slot };
          rp.mover.snap(s.x, s.z);
          this.remote.set(u.id, rp);
        }
        if (rp.name !== u.name) {
          rp.name = u.name;
          setLabel(rp.label, [u.name || '同學'], { bg: 'rgba(30,41,59,0.9)', border: u.color || '#a5b4fc', width: 3.2 });
        }
        if (rp.tile !== u.tile) {
          const n = this.tiles.length;
          let steps = (u.tile - rp.tile + n) % n;
          if (steps > 8) {
            const s = this._slot(u.tile, slot);
            rp.mover.snap(s.x, s.z);
          } else {
            let t = rp.tile;
            for (let i = 0; i < steps; i++) {
              t = (t + 1) % n;
              const s = this._slot(t, slot);
              rp.mover.push(s.x, s.z, 0.42, 0.25);
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

    focusPlayer() {
      const p = this.tilePos(this.playerTile);
      this.cam.tTarget.set(p.x, 1.5, p.z);
      this.cam.tDist = 34;
    }

    resetView() {
      const isNarrow = (this.container.clientWidth / Math.max(1, this.container.clientHeight)) < 0.85;
      this.cam.tTarget.set(0, 1, 2);
      this.cam.tDist = isNarrow ? 76 : 62;
      this.cam.tAz = 0.75;
      this.cam.tEl = 0.72;
    }

    setPaused(p) {
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
