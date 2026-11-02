/**
 * presence.js — Live "other players" feed for the island city.
 *
 * Providers (same interface):
 *   - SimulatedPresence : virtual classmates + real cross-tab sync (BroadcastChannel).
 *   - FirebasePresence  : real multi-user sync via Firestore (enabled when
 *                         window.FIREBASE_CONFIG is defined; see README).
 *
 * Interface:
 *   const p = ExecVoice.createPresence();
 *   p.onUsers(list => ...)   // [{id,name,color,tile,level,money,isBot}]
 *   p.onEvent(ev => ...)     // {id,text,ts}
 *   p.start({id,name,color,tile,buildings})
 *   p.updateSelf({tile,buildings,name})
 *   p.publishEvent(text)
 *   p.stop()
 */
(function () {
  window.ExecVoice = window.ExecVoice || {};

  const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#22c55e', '#0ea5e9', '#ef4444'];
  const BOT_NAMES = ['小明', 'Amy', 'Kevin', '怡君', 'Jason', '雅婷', 'Peter', '子翔'];

  class Emitter {
    constructor() {
      this.h = { users: [], event: [] };
    }
    onUsers(cb) { this.h.users.push(cb); }
    onEvent(cb) { this.h.event.push(cb); }
    _users(list) { this.h.users.forEach((cb) => cb(list)); }
    _event(ev) { this.h.event.forEach((cb) => cb(ev)); }
  }

  /* ---------------------------------------------------------- simulated + multi-device hybrid */
  class SimulatedPresence extends Emitter {
    constructor(opts) {
      super();
      this.tiles = (opts && opts.tiles) || [];
      this.scenarioTiles = this.tiles.filter((t) => t.type === 'scenario');
      this.bots = [];
      this.remote = new Map();
      this.self = null;
      this.timer = null;
      this.bc = null;
      this.mqttClient = null;
      this.mqttTopic = 'simcareer/island/presence/v1';
      this.mqttConnected = false;
    }

    start(self) {
      this.self = Object.assign({ buildings: 0 }, self);
      const n = this.tiles.length || 16;
      this.bots = BOT_NAMES.slice(0, 6).map((name, i) => ({
        id: 'bot-' + i,
        name,
        color: COLORS[i % COLORS.length],
        tile: Math.floor(Math.random() * n),
        levels: {},
        steps: 0,
        wait: 2 + Math.random() * 6,
        isBot: true
      }));

      // 1. Cross-tab sync via BroadcastChannel
      try {
        this.bc = new BroadcastChannel('simcareer-island-presence');
        this.bc.onmessage = (e) => {
          const m = e.data;
          if (!m || m.id === this.self.id) return;
          if (m.kind === 'state') {
            this.remote.set(m.id, Object.assign({}, m.user, { seen: Date.now() }));
          } else if (m.kind === 'event') {
            this._event({ id: 'e' + Date.now() + Math.random(), text: m.text, ts: m.ts });
          } else if (m.kind === 'bye') {
            this.remote.delete(m.id);
          }
          this._emitUsers();
        };
      } catch (_) {
        this.bc = null;
      }

      // 2. Real cross-device internet sync via public MQTT broker
      this._initMqtt();

      this.timer = setInterval(() => this._tick(), 1000);
      this._broadcastSelf();
      this._emitUsers();
      this._event({ id: 'welcome', text: '🌴 歡迎來到 SimCareer 島城！同學們正在城市裡打工升級。', ts: Date.now() });
    }

    _initMqtt() {
      if (!window.Paho || !window.Paho.MQTT) return;
      try {
        const cid = 'sc_' + (this.self.id || Math.random().toString(36).slice(2, 9));
        const client = new window.Paho.MQTT.Client('broker.hivemq.com', 8884, '/mqtt', cid);
        this.mqttClient = client;

        client.onConnectionLost = () => {
          this.mqttConnected = false;
          setTimeout(() => {
            if (this.self) this._initMqtt();
          }, 6000);
        };

        client.onMessageArrived = (msg) => {
          try {
            const data = JSON.parse(msg.payloadString);
            if (!data || data.id === this.self.id) return;
            if (data.kind === 'state') {
              this.remote.set(data.id, Object.assign({}, data.user, { seen: Date.now(), isRealUser: true }));
              this._emitUsers();
            } else if (data.kind === 'event') {
              this._event({ id: 'e' + Date.now() + Math.random(), text: data.text, ts: data.ts });
            } else if (data.kind === 'bye') {
              this.remote.delete(data.id);
              this._emitUsers();
            }
          } catch (_) {}
        };

        client.connect({
          useSSL: true,
          timeout: 6,
          keepAliveInterval: 30,
          cleanSession: true,
          onSuccess: () => {
            this.mqttConnected = true;
            client.subscribe(this.mqttTopic);
            this._broadcastMqtt('state', { user: this.self });
          },
          onFailure: () => {
            this.mqttConnected = false;
          }
        });
      } catch (_) {}
    }

    _broadcastMqtt(kind, extra = {}) {
      if (!this.mqttClient || !this.mqttConnected) return;
      try {
        const payload = JSON.stringify(Object.assign({ kind, id: this.self.id, ts: Date.now() }, extra));
        const message = new window.Paho.MQTT.Message(payload);
        message.destinationName = this.mqttTopic;
        message.qos = 0;
        this.mqttClient.send(message);
      } catch (_) {}
    }

    _tick() {
      const n = this.tiles.length || 16;
      this.bots.forEach((b) => {
        if (b.steps > 0) {
          b.tile = (b.tile + 1) % n;
          b.steps -= 1;
          if (b.steps === 0) this._botLanded(b);
          return;
        }
        b.wait -= 1;
        if (b.wait <= 0) {
          b.steps = 1 + Math.floor(Math.random() * 6);
          b.wait = 5 + Math.random() * 9;
        }
      });
      const now = Date.now();
      this.remote.forEach((u, id) => {
        if (now - u.seen > 12000) this.remote.delete(id);
      });
      this._broadcastSelf();
      this._emitUsers();
    }

    _botLanded(b) {
      const tile = this.tiles[b.tile];
      if (!tile) return;
      if (tile.type === 'scenario') {
        const lv = b.levels[tile.scenarioId] || 0;
        if (Math.random() < 0.7 && lv < 3) {
          const score = 55 + Math.floor(Math.random() * 40);
          const need = [60, 75, 85][lv];
          if (score >= need) {
            b.levels[tile.scenarioId] = lv + 1;
            this._event({
              id: 'e' + Date.now() + b.id,
              text: `🏗️ ${b.name} 在「${tile.name}」口說 ${score} 分，升級為 Lv.${lv + 1}！`,
              ts: Date.now()
            });
          } else {
            this._event({
              id: 'e' + Date.now() + b.id,
              text: `💪 ${b.name} 在「${tile.name}」拿到 ${score} 分，再接再厲！`,
              ts: Date.now()
            });
          }
        } else {
          this._event({ id: 'e' + Date.now() + b.id, text: `📍 ${b.name} 抵達「${tile.name}」`, ts: Date.now() });
        }
      } else if (tile.type === 'chance') {
        this._event({ id: 'e' + Date.now() + b.id, text: `🎁 ${b.name} 抽到了${tile.name}好運卡！`, ts: Date.now() });
      } else if (tile.type === 'corner-start') {
        this._event({ id: 'e' + Date.now() + b.id, text: `💰 ${b.name} 經過市政廳領薪水！`, ts: Date.now() });
      }
    }

    _emitUsers() {
      const list = [];
      if (this.self) list.push(Object.assign({ me: true }, this.self));
      this.remote.forEach((u) => list.push(Object.assign({ live: true }, u)));
      this.bots.forEach((b) =>
        list.push({
          id: b.id, name: b.name, color: b.color, tile: b.tile,
          buildings: Object.keys(b.levels).length, isBot: true
        })
      );
      this._users(list);
    }

    _broadcastSelf() {
      if (this.bc && this.self) {
        this.bc.postMessage({ kind: 'state', id: this.self.id, user: this.self });
      }
      if (this.mqttConnected && this.self) {
        this._broadcastMqtt('state', { user: this.self });
      }
    }

    updateSelf(patch) {
      Object.assign(this.self, patch);
      this._broadcastSelf();
      this._emitUsers();
    }

    publishEvent(text) {
      const ev = { id: 'e' + Date.now(), text, ts: Date.now() };
      this._event(ev);
      if (this.bc) this.bc.postMessage({ kind: 'event', id: this.self.id, text, ts: ev.ts });
      if (this.mqttConnected) this._broadcastMqtt('event', { text, ts: ev.ts });
    }

    stop() {
      clearInterval(this.timer);
      if (this.bc) {
        this.bc.postMessage({ kind: 'bye', id: this.self.id });
        this.bc.close();
      }
      if (this.mqttConnected) {
        this._broadcastMqtt('bye', {});
        try { this.mqttClient.disconnect(); } catch (_) {}
      }
    }
  }

  /* ----------------------------------------------------------- firebase */
  class FirebasePresence extends Emitter {
    constructor(opts) {
      super();
      this.tiles = (opts && opts.tiles) || [];
      this.self = null;
      this.db = null;
      this.unsubs = [];
      this.hb = null;
    }

    _load(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    async start(self) {
      this.self = Object.assign({ buildings: 0 }, self);
      const v = '10.12.2';
      if (!window.firebase) {
        await this._load(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
        await this._load(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`);
      }
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
      this.db = window.firebase.firestore();

      this.unsubs.push(
        this.db.collection('presence').onSnapshot((snap) => {
          const now = Date.now();
          const list = [];
          snap.forEach((d) => {
            const u = d.data();
            if (!u || now - (u.ts || 0) > 30000) return;
            list.push(Object.assign({ id: d.id }, u, { me: d.id === this.self.id }));
          });
          this._users(list);
        })
      );
      let first = true;
      this.unsubs.push(
        this.db.collection('activity').orderBy('ts', 'desc').limit(15).onSnapshot((snap) => {
          if (first) {
            first = false;
            [...snap.docs].reverse().forEach((d) => this._event({ id: d.id, text: d.data().text, ts: d.data().ts }));
            return;
          }
          snap.docChanges().forEach((c) => {
            if (c.type === 'added') this._event({ id: c.doc.id, text: c.doc.data().text, ts: c.doc.data().ts });
          });
        })
      );
      this._push();
      this.hb = setInterval(() => this._push(), 10000);
    }

    _push() {
      if (!this.db) return;
      const { id, ...rest } = this.self;
      this.db.collection('presence').doc(id).set(Object.assign({}, rest, { ts: Date.now() }));
    }

    updateSelf(patch) {
      Object.assign(this.self, patch);
      this._push();
    }

    publishEvent(text) {
      if (this.db) this.db.collection('activity').add({ text, ts: Date.now() });
    }

    stop() {
      this.unsubs.forEach((u) => u());
      clearInterval(this.hb);
      if (this.db && this.self) this.db.collection('presence').doc(this.self.id).delete();
    }
  }

  window.ExecVoice.createPresence = function (opts) {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) return new FirebasePresence(opts);
    return new SimulatedPresence(opts);
  };
})();
