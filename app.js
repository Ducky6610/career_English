(function () {
  const {
    BUILTIN_SCENARIOS,
    BOARD_TILES,
    CHANCE_CARDS,
    FILLER_WORDS,
    AudioEngine,
    speakWithBrowserTTS,
    GeminiLiveSessionManager,
    generateScenarioWithAI,
    generateRealtimeHint
  } = window.ExecVoice;

  const DEFAULT_API_KEY =
    window.ExecVoice?.DEFAULT_API_KEY ||
    (function () {
      try {
        return atob('QVEuQWI4Uk42STJCZUQxcjM5YkotMFN5WTdEYjg2Y1M3R0lra1gtVDIwOGp0Vm9ZYkJjdVE=');
      } catch (_) {
        return '';
      }
    })();

  const STORAGE_KEYS = {
    API_KEY: 'workplace_english_gemini_api_key',
    LIVE_MODEL: 'workplace_english_live_model',
    CUSTOM_SCENARIOS: 'workplace_english_custom_scenarios_hs_v2',
    TYCOON_STATE: 'simcareer_richman_tycoon_state_v1'
  };

  /**
   * Lightweight Web Audio retro SimCity / Richman game sound effects
   */
  function playGameSfx(type) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;

      const makeTone = (freq, start, dur, wave = 'sine', gainVal = 0.08) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(gainVal, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur);
      };

      if (type === 'dice') {
        makeTone(380, 0, 0.06, 'triangle', 0.07);
        makeTone(520, 0.06, 0.06, 'triangle', 0.07);
      } else if (type === 'step') {
        makeTone(440, 0, 0.07, 'sine', 0.06);
      } else if (type === 'payday' || type === 'upgrade') {
        makeTone(523.25, 0, 0.1, 'triangle', 0.09);
        makeTone(659.25, 0.09, 0.1, 'triangle', 0.09);
        makeTone(783.99, 0.18, 0.14, 'triangle', 0.1);
        makeTone(1046.5, 0.3, 0.25, 'triangle', 0.11);
      } else if (type === 'event') {
        makeTone(587.33, 0, 0.1, 'sine', 0.08);
        makeTone(880, 0.1, 0.18, 'sine', 0.09);
      }
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 800);
    } catch (_) {}
  }

  /**
   * Context-aware phonetic & homophone repair for Taiwanese high-school English speech recognition
   */
  function applyScenarioPhoneticFixes(rawText, scenario) {
    if (!rawText) return '';
    let t = String(rawText).trim();

    // General high-school workplace English homophone repairs
    t = t
      .replace(/\b(free|tree)\s+(minute|minutes)\b/gi, 'three minutes')
      .replace(/\b(one|won)\s+(dull|dollar|dollars)\s+(extra|actor)\b/gi, 'one dollar extra')
      .replace(/\b(apple\s+pain|apple\s+page|apple\s+paid)\b/gi, 'Apple Pay')
      .replace(/\b(credit\s+car)\b/gi, 'credit card');

    const id = scenario?.id || '';
    const title = scenario?.title || '';

    // 1. Cafe Barista scenario fixes
    if (id === 'cafe-barista-order' || title.includes('咖啡') || title.includes('點餐')) {
      t = t
        .replace(/\b(old|out|all|oh|oak|boat|goat|hold|cold)\s+milk\b/gi, 'oat milk')
        .replace(/\b(oat\s+meal)\b/gi, 'oat milk')
        .replace(/\b(ice|eyes|i's|is|nice)\s+(lot|late|latte|lady|light|art|lat)\b/gi, 'iced latte')
        .replace(/\b(large|lunch|march)\s+(ice|iced)\b/gi, 'large iced')
        .replace(/\b(catch\s+your\s+boss|catch\s+the\s+boss)\b/gi, 'catch your bus');
    }

    // 2. Shift Swap scenario fixes
    if (id === 'shift-swap-request' || title.includes('排班') || title.includes('換班')) {
      t = t
        .replace(/\b(stop|swamp|shop|smart|start)\s+(my\s+)?(shift|ship|chef|shirt|sheep)\b/gi, 'swap my shift')
        .replace(/\b(cough|coffee|carver|over)\s+(my\s+)?(shift|ship|chef|shirt)\b/gi, 'cover my shift')
        .replace(/\b(my|the)\s+(ship|chef|shirt|sheep)\b/gi, '$1 shift')
        .replace(/\b(meat\s+turn|mid\s+turn|me\s+turn|meet\s+term)\b/gi, 'midterm');
    }

    // 3. Summer Internship Interview fixes
    if (id === 'summer-internship-interview' || title.includes('面試') || title.includes('實習')) {
      t = t
        .replace(/\b(in\s+turn\s+ship|internal\s+ship|inter\s+ship|intern\s+ship)\b/gi, 'internship')
        .replace(/\b(high\s+score\s+student)\b/gi, 'high school student');
    }

    // 4. Phone Message scenario fixes
    if (id === 'phone-message-taking' || title.includes('電話') || title.includes('口訊')) {
      t = t
        .replace(/\b(take|leave)\s+a\s+(massage|mass)\b/gi, '$1 a message')
        .replace(/\b(in\s+a\s+meat|in\s+eating|in\s+the\s+meat)\b/gi, 'in a meeting')
        .replace(/\b(call\s+you\s+bag|call\s+you\s+pack)\b/gi, 'call you back');
    }

    // 5. Campus Event Guide fixes
    if (id === 'campus-event-guide' || title.includes('志工') || title.includes('指引')) {
      t = t
        .replace(/\b(name|main)\s+(page|batch|bag|patch|back)\b/gi, 'name badge')
        .replace(/\b(walk|work)\s+(street|strait)\b/gi, 'walk straight')
        .replace(/\b(turn\s+laugh|turn\s+life|turn\s+let)\b/gi, 'turn left')
        .replace(/\b(second\s+four|second\s+for)\b/gi, 'second floor');
    }

    // 6. Intern Mentor Poster Update fixes
    if (id === 'intern-mentor-update' || title.includes('海報') || title.includes('週會')) {
      t = t
        .replace(/\b(first\s+drive|first\s+drop|first\s+drug)\b/gi, 'first draft')
        .replace(/\b(phone|found|front)\s+size\b/gi, 'font size')
        .replace(/\b(company\s+local|company\s+low\s+go)\b/gi, 'company logo')
        .replace(/\b(feed\s+bag|feet\s+back)\b/gi, 'feedback');
    }

    // 7. Bubble Tea Flagship fixes
    if (id === 'bubble-tea-order' || title.includes('手搖') || title.includes('珍奶') || title.includes('奶茶')) {
      t = t
        .replace(/\b(have\s+sugar|has\s+sugar)\b/gi, 'half sugar')
        .replace(/\b(let's\s+ice|last\s+ice|list\s+ice)\b/gi, 'less ice')
        .replace(/\b(round\s+sugar)\b/gi, 'brown sugar');
    }

    // 8. Global Bookstore fixes
    if (id === 'bookstore-part-time' || title.includes('書店') || title.includes('書城')) {
      t = t
        .replace(/\b(in\s+stop|in\s+stuck|in\s+start)\b/gi, 'in stock')
        .replace(/\b(three\s+coffee|free\s+copies)\b/gi, 'three copies')
        .replace(/\b(give\s+wrapping|gift\s+rapping)\b/gi, 'gift wrapping');
    }

    return t;
  }

  /**
   * Scores up to 5 SpeechRecognitionAlternative candidates against the active scenario's vocabulary
   * and returns the most accurate transcript.
   */
  function pickBestAlternativeForScenario(resultItem, scenario) {
    if (!resultItem || resultItem.length === 0) return '';

    const scenarioVocab = new Set();
    if (scenario) {
      (scenario.objectiveKeywords || []).forEach((arr) => {
        (arr || []).forEach((w) => scenarioVocab.add(w.toLowerCase()));
      });
      (scenario.suggestedPhrases || []).forEach((p) => {
        String(p.en || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .forEach((w) => scenarioVocab.add(w));
      });
    }

    let bestText = '';
    let bestScore = -999;

    for (let i = 0; i < resultItem.length; i++) {
      const alt = resultItem[i];
      if (!alt || !alt.transcript) continue;

      const fixedText = applyScenarioPhoneticFixes(alt.transcript, scenario);
      const words = fixedText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

      let vocabHits = 0;
      for (const w of words) {
        if (scenarioVocab.has(w)) vocabHits++;
      }

      // Base score from recognizer confidence + rank + scenario keyword match bonus
      const confidence = typeof alt.confidence === 'number' && alt.confidence > 0 ? alt.confidence : 0.8 - i * 0.05;
      const score = confidence * 10 + vocabHits * 3.5 - i * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestText = fixedText;
      }
    }

    return bestText || applyScenarioPhoneticFixes(resultItem[0].transcript, scenario);
  }

  class WorkplaceEnglishApp {
    constructor() {
      const storedKey = this.safeGetStorage(STORAGE_KEYS.API_KEY);
      if (storedKey === 'OFF' || storedKey === 'none') {
        this.apiKey = '';
      } else if (storedKey && storedKey.trim()) {
        this.apiKey = storedKey.trim();
      } else {
        this.apiKey = DEFAULT_API_KEY;
        this.safeSetStorage(STORAGE_KEYS.API_KEY, DEFAULT_API_KEY);
      }
      this.liveModel = this.safeGetStorage(STORAGE_KEYS.LIVE_MODEL) || 'gemini-3.8-live';
      this.customScenarios = this.loadCustomScenarios();
      this.allScenarios = [...this.customScenarios, ...BUILTIN_SCENARIOS];
      this.activeCategory = '全部';
      this.selectedScenario = this.allScenarios[0];

      // SimCity + Richman Tycoon Game State
      this.tycoon = this.loadTycoonState();
      this.isRollingDice = false;
      this.lastDiceValue = 6;
      this.lastEvalRewardInfo = null;

      // Live session state
      this.isCallActive = false;
      this.isMuted = false;
      this.isDemoAiSpeaking = false;
      this.callMode = 'gemini-live';
      this.audioEngine = null;
      this.liveManager = null;
      this.speechRecognition = null;

      // Utterance accumulation & pause debounce (prevents premature mid-sentence cutoff!)
      this.pendingUserSegments = [];
      this.currentInterimUserText = '';
      this.utteranceSilenceTimer = null;

      // Conversation & Metrics state
      this.transcriptTurns = [];
      this.currentAiTurnBuffer = '';
      this.callStartTime = null;
      this.callTimerInterval = null;
      this.userSpeakingStartMs = null;
      this.totalUserSpeakingMs = 0;
      this.totalUserWords = 0;
      this.fillerCounts = {};
      this.totalFillers = 0;
      this.lastEvaluation = null;

      this.playerId = this.safeGetStorage('workplace_english_player_id') || ('u-' + Math.random().toString(36).slice(2, 8));
      this.safeSetStorage('workplace_english_player_id', this.playerId);
      this.sessionId = 'sess-' + Math.random().toString(36).slice(2, 9);
      this.playerName = this.safeGetStorage('workplace_english_player_name') || '高中實習生';

      this.initDOM();
      this.initIsland3D();
      this.initPresence();
      this.updateTycoonHudUI();
      this.renderSimCityBoard();
      this.renderScenarioList();
      this.renderSelectedScenarioPreview();
      this.populateStudioHeader();
      this.updateApiKeyStatusUI();
    }

    loadTycoonState() {
      const defaults = {
        money: 3000,
        reputation: 100,
        day: 1,
        playerTileIndex: 0,
        buildingLevels: {},
        buildingBestScores: {}
      };
      try {
        const raw = this.safeGetStorage(STORAGE_KEYS.TYCOON_STATE);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return {
          ...defaults,
          ...parsed,
          buildingLevels: parsed.buildingLevels || {},
          buildingBestScores: parsed.buildingBestScores || {}
        };
      } catch (_) {
        return defaults;
      }
    }

    saveTycoonState() {
      this.safeSetStorage(STORAGE_KEYS.TYCOON_STATE, JSON.stringify(this.tycoon));
      this.updateTycoonHudUI();
    }

    getReputationTitle(rep) {
      if (rep >= 320) return '模擬城市榮譽市長';
      if (rep >= 240) return '跨國企業青年總監';
      if (rep >= 170) return '金牌實習特派員';
      if (rep >= 125) return '熱門門市王牌店員';
      return '實習新星';
    }

    updateTycoonHudUI() {
      const moneyEl = document.getElementById('tycoon-money');
      const repEl = document.getElementById('tycoon-rep');
      const bldEl = document.getElementById('tycoon-buildings');
      const dayEl = document.getElementById('tycoon-day');

      if (moneyEl) {
        moneyEl.textContent = `$${Number(this.tycoon.money || 0).toLocaleString()}`;
      }
      if (repEl) {
        const rep = Number(this.tycoon.reputation || 100);
        repEl.textContent = `${rep} pt · ${this.getReputationTitle(rep)}`;
      }
      const builtCount = Object.values(this.tycoon.buildingLevels || {}).filter((lv) => lv >= 1).length;
      if (bldEl) {
        bldEl.textContent = `${builtCount} / 8 棟`;
      }
      if (dayEl) {
        dayEl.textContent = `Day ${this.tycoon.day || 1}`;
      }

      // Update SimCity RCI demand bars dynamically
      const cBar = document.getElementById('rci-bar-c');
      const iBar = document.getElementById('rci-bar-i');
      const gBar = document.getElementById('rci-bar-g');
      if (cBar) cBar.style.height = `${Math.min(100, 55 + builtCount * 6)}%`;
      if (iBar) iBar.style.height = `${Math.min(100, 48 + builtCount * 7)}%`;
      if (gBar) gBar.style.height = `${Math.min(100, 65 + builtCount * 5)}%`;
    }

    setSimCityNewsTicker(text) {
      const ticker = document.getElementById('simcity-news-ticker');
      if (ticker && text) {
        ticker.textContent = text;
      }
    }

    safeGetStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return '';
      }
    }

    safeSetStorage(key, val) {
      try {
        localStorage.setItem(key, val);
      } catch (_) {}
    }

    loadCustomScenarios() {
      try {
        const raw = this.safeGetStorage(STORAGE_KEYS.CUSTOM_SCENARIOS);
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return [];
      }
    }

    saveCustomScenarios() {
      this.safeSetStorage(STORAGE_KEYS.CUSTOM_SCENARIOS, JSON.stringify(this.customScenarios));
      this.allScenarios = [...this.customScenarios, ...BUILTIN_SCENARIOS];
    }

    initDOM() {
      document.querySelectorAll('.nav-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          this.switchView(view);
        });
      });

      // Camera Controls
      document.getElementById('focus-player-btn')?.addEventListener('click', () => {
        this.islandCity?.focusPlayer();
      });
      document.getElementById('reset-view-btn')?.addEventListener('click', () => {
        this.islandCity?.resetView();
      });
      document.getElementById('toggle-3d-camera-btn')?.addEventListener('click', () => {
        this.islandCity?.resetView();
      });

      // 3D FX & Performance Toggles (Bloom, Tilt-Shift, Instanced City)
      const bloomBtn = document.getElementById('toggle-bloom-btn');
      bloomBtn?.addEventListener('click', () => {
        const on = this.islandCity?.toggleBloom();
        bloomBtn.classList.toggle('active-fx', !!on);
        bloomBtn.textContent = `✨ 輝光: ${on ? '開' : '關'}`;
        this.showToast(on ? '✨ 已開啟 Bloom 輝光後處理通道' : '✨ 已關閉 Bloom 輝光通道');
      });

      const tiltBtn = document.getElementById('toggle-tiltshift-btn');
      tiltBtn?.addEventListener('click', () => {
        const on = this.islandCity?.toggleTiltShift();
        tiltBtn.classList.toggle('active-fx', !!on);
        tiltBtn.textContent = `📷 移軸景深: ${on ? '開' : '關'}`;
        this.showToast(on ? '📷 已啟用移軸鏡頭景深 (微縮模型感)' : '📷 已關閉移軸鏡頭景深');
      });

      const instancedBtn = document.getElementById('toggle-instanced-btn');
      instancedBtn?.addEventListener('click', () => {
        const on = this.islandCity?.toggleInstancedCity();
        instancedBtn.classList.toggle('active-fx', !!on);
        instancedBtn.textContent = `🏙️ 萬棟城: ${on ? '1.8k' : '關閉'}`;
        this.showToast(on ? '🏙️ 已載入 1,800+ 棟 InstancedMesh 大都會群 (單次 Draw Call 60FPS)' : '🏙️ 已隱藏背景建築群');
      });

      // Building task modal handlers
      const taskModal = document.getElementById('building-task-modal');
      document.getElementById('close-task-modal-btn')?.addEventListener('click', () => {
        taskModal?.classList.add('hidden');
      });
      taskModal?.addEventListener('click', (e) => {
        if (e.target === taskModal) taskModal.classList.add('hidden');
      });

      // Mobile Presence Sheet handlers
      const feedEl = document.getElementById('live-feed');
      document.getElementById('toggle-feed-mobile-btn')?.addEventListener('click', () => {
        feedEl?.classList.toggle('open-sheet');
      });
      document.getElementById('hud-users-pill')?.addEventListener('click', () => {
        feedEl?.classList.toggle('open-sheet');
      });
      document.getElementById('close-feed-sheet-btn')?.addEventListener('click', () => {
        feedEl?.classList.remove('open-sheet');
      });

      // Bottom dock handlers
      document.getElementById('roll-dice-btn')?.addEventListener('click', () => {
        this.rollRichmanDice();
      });
      document.getElementById('dice-3d-trigger')?.addEventListener('click', () => {
        this.rollRichmanDice();
      });
      document.getElementById('plaza-enter-studio-btn')?.addEventListener('click', () => {
        const curTile = BOARD_TILES[this.tycoon.playerTileIndex];
        if (curTile?.type !== 'scenario' && curTile?.type !== 'ai-lot') {
          this.showToast('🎲 請先擲 3D 骰子走到職場建築格！');
          return;
        }
        let scenarioObj = null;
        if (curTile.type === 'scenario') {
          scenarioObj = this.allScenarios.find((s) => s.id === curTile.scenarioId);
        } else if (curTile.type === 'ai-lot' && this.customScenarios.length > 0) {
          scenarioObj = this.customScenarios[0];
        }
        if (scenarioObj) {
          this.selectedScenario = scenarioObj;
          this.renderSelectedScenarioPreview();
          document.getElementById('building-task-modal')?.classList.remove('hidden');
        }
      });

      document.getElementById('back-to-map-btn')?.addEventListener('click', () => {
        this.switchView('hub');
      });

      document.getElementById('eval-back-to-board-btn')?.addEventListener('click', () => {
        this.switchView('hub');
      });

      const eventModal = document.getElementById('board-event-modal');
      document.getElementById('close-event-modal-btn')?.addEventListener('click', () => {
        eventModal?.classList.add('hidden');
      });
      document.getElementById('confirm-event-modal-btn')?.addEventListener('click', () => {
        eventModal?.classList.add('hidden');
      });

      document.querySelectorAll('.category-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeCategory = pill.dataset.category;
          this.renderScenarioList();
        });
      });

      const apiKeyBtn = document.getElementById('open-api-modal-btn');
      const apiModal = document.getElementById('api-key-modal');
      const closeApiModalBtn = document.getElementById('close-api-modal-btn');
      const saveApiKeyBtn = document.getElementById('save-api-key-btn');
      const apiKeyInput = document.getElementById('gemini-api-key-input');
      const liveModelSelect = document.getElementById('live-model-select');

      apiKeyBtn?.addEventListener('click', () => {
        apiKeyInput.value = this.apiKey;
        liveModelSelect.value = this.liveModel;
        apiModal.classList.remove('hidden');
      });

      closeApiModalBtn?.addEventListener('click', () => {
        apiModal.classList.add('hidden');
      });

      saveApiKeyBtn?.addEventListener('click', () => {
        const inputVal = apiKeyInput.value.trim();
        if (!inputVal) {
          this.apiKey = '';
          this.safeSetStorage(STORAGE_KEYS.API_KEY, 'OFF');
          this.showToast('已切換為免金鑰模式（使用本地智慧語意引擎）');
        } else {
          this.apiKey = inputVal;
          this.safeSetStorage(STORAGE_KEYS.API_KEY, this.apiKey);
          this.showToast('✅ 已儲存 Gemini API Key 與模型設定！');
        }
        this.liveModel = liveModelSelect.value;
        this.safeSetStorage(STORAGE_KEYS.LIVE_MODEL, this.liveModel);
        this.updateApiKeyStatusUI();
        apiModal.classList.add('hidden');
      });

      document.getElementById('reset-api-key-btn')?.addEventListener('click', () => {
        this.apiKey = DEFAULT_API_KEY;
        apiKeyInput.value = DEFAULT_API_KEY;
        this.safeSetStorage(STORAGE_KEYS.API_KEY, DEFAULT_API_KEY);
        this.updateApiKeyStatusUI();
        this.showToast('🔄 已恢復為系統預設綁定的 Gemini API Key！');
      });

      const aiGenBtn = document.getElementById('ai-generate-scenario-btn');
      const aiPromptInput = document.getElementById('ai-scenario-prompt-input');
      aiGenBtn?.addEventListener('click', () => this.handleAIGenerateScenario());
      aiPromptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAIGenerateScenario();
        }
      });

      document.querySelectorAll('.quick-prompt-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          aiPromptInput.value = chip.dataset.prompt;
          this.handleAIGenerateScenario();
        });
      });

      const openCustomBtn = document.getElementById('open-custom-scenario-btn');
      const customModal = document.getElementById('custom-scenario-modal');
      const closeCustomBtn = document.getElementById('close-custom-modal-btn');
      const customForm = document.getElementById('custom-scenario-form');

      openCustomBtn?.addEventListener('click', () => {
        customModal.classList.remove('hidden');
      });
      closeCustomBtn?.addEventListener('click', () => {
        customModal.classList.add('hidden');
      });
      customForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveCustomScenario();
      });

      // Enter building button: only permitted when player is currently at that building!
      document.getElementById('start-roleplay-from-hub-btn')?.addEventListener('click', () => {
        const curTile = BOARD_TILES[this.tycoon.playerTileIndex];
        const isAtBuilding =
          (curTile?.scenarioId === this.selectedScenario?.id) ||
          (curTile?.type === 'ai-lot' && this.selectedScenario?.id?.startsWith('ai-'));

        if (!isAtBuilding) {
          this.showToast(`🎲 請先擲 3D 骰子走到此建築才能開始任務！（你目前在 #${this.tycoon.playerTileIndex + 1} 格）`);
          return;
        }

        document.getElementById('building-task-modal')?.classList.add('hidden');
        this.switchView('studio');
        this.startVoiceCall();
      });

      document.getElementById('toggle-call-btn')?.addEventListener('click', () => {
        if (this.isCallActive) {
          this.stopVoiceCallAndEvaluate();
        } else {
          this.startVoiceCall();
        }
      });

      document.getElementById('toggle-mute-btn')?.addEventListener('click', () => {
        this.toggleMute();
      });

      document.getElementById('get-rescue-hint-btn')?.addEventListener('click', () => {
        this.handleRequestRescueHint();
      });

      document.getElementById('end-and-evaluate-btn')?.addEventListener('click', () => {
        this.stopVoiceCallAndEvaluate();
      });

      document.getElementById('commit-speech-btn')?.addEventListener('click', () => {
        this.commitPendingUserUtterance();
      });

      const studioTextForm = document.getElementById('studio-text-form');
      studioTextForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('studio-text-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        this.handleUserManualTextInput(text);
      });

      document.getElementById('run-sample-eval-btn')?.addEventListener('click', () => {
        this.runSampleEvaluationDemo();
      });
    }

    updateApiKeyStatusUI() {
      const badge = document.getElementById('open-api-modal-btn');
      const modeLabel = document.getElementById('studio-engine-badge');
      if (this.apiKey) {
        const isDefault = this.apiKey === DEFAULT_API_KEY;
        if (badge) {
          badge.textContent = `⚡ Gemini Live 已啟用 (${this.liveModel})`;
          badge.className = 'status-pill status-connected';
        }
        if (modeLabel) {
          modeLabel.textContent = `語音引擎：${this.liveModel} (24kHz 真人雙向語音${
            isDefault ? '・系統預設綁定' : ''
          }) ｜ 程度：高中生 A2~B1`;
        }
      } else {
        if (badge) {
          badge.textContent = '🔑 設定 API Key (目前為免金鑰智慧語意模式)';
          badge.className = 'status-pill status-demo';
        }
        if (modeLabel) {
          modeLabel.textContent =
            '語音引擎：本地擬真語音 ＋ 動態語意引導狀態機 ｜ 程度：高中生 A2~B1';
        }
      }
    }

    switchView(viewName) {
      document.querySelectorAll('.nav-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.view === viewName);
      });
      document.querySelectorAll('.view-section').forEach((sec) => {
        sec.classList.toggle('active', sec.id === `view-${viewName}`);
      });

      if (viewName === 'studio') {
        this.islandCity?.setPaused(true);
        this.populateStudioHeader();
      } else if (viewName === 'hub') {
        this.islandCity?.setPaused(false);
        this.renderSimCityBoard();
      } else {
        this.islandCity?.setPaused(true);
      }
    }

    /**
     * Renders the 5x5 SimCity 3D Richman Board + 3D Extruded Buildings + 3D Rolling Dice Cube
     */
    initIsland3D() {
      const container = document.getElementById('island-canvas-wrap');
      if (!container || !window.ExecVoice.IslandCity) return;

      this.islandCity = new window.ExecVoice.IslandCity(container, {
        tiles: BOARD_TILES,
        onTileClick: (idx) => this.handle3DTileClick(idx)
      });

      const tooltip = document.getElementById('island-tooltip');
      if (tooltip && this.islandCity) {
        this.islandCity.onHover = (idx, pos) => {
          if (idx < 0) {
            tooltip.classList.add('hidden');
            return;
          }
          const t = BOARD_TILES[idx];
          if (!t) return;
          let scenarioObj = null;
          if (t.type === 'scenario') {
            scenarioObj = this.allScenarios.find((s) => s.id === t.scenarioId);
          } else if (t.type === 'ai-lot' && this.customScenarios.length > 0) {
            scenarioObj = this.customScenarios[0];
          }
          const lv = scenarioObj ? (this.tycoon.buildingLevels[scenarioObj.id] || 0) : 0;
          const label = scenarioObj
            ? `${t.icon || '🏢'} ${scenarioObj.buildingName || t.name} (Lv.${lv}) · 點擊查看任務`
            : `${t.icon || '📍'} ${t.name} · ${t.rewardText}`;
          tooltip.textContent = label;
          tooltip.style.left = `${pos.x}px`;
          tooltip.style.top = `${pos.y}px`;
          tooltip.classList.remove('hidden');
        };
      }
    }

    handle3DTileClick(idx) {
      if (this.isRollingDice) return;
      const clickedTile = BOARD_TILES[idx];
      if (!clickedTile) return;

      let scenarioObj = null;
      if (clickedTile.type === 'scenario') {
        scenarioObj = this.allScenarios.find((s) => s.id === clickedTile.scenarioId);
      } else if (clickedTile.type === 'ai-lot') {
        scenarioObj = this.customScenarios.length > 0 ? this.customScenarios[0] : null;
      }

      if (scenarioObj) {
        this.selectedScenario = scenarioObj;
        this.renderSelectedScenarioPreview();
        this.updateDockUI();
        // Trigger mission briefing dialog!
        const modal = document.getElementById('building-task-modal');
        modal?.classList.remove('hidden');
      } else {
        this.showToast(`📌 [#${idx + 1} ${clickedTile.name}]：${clickedTile.description || clickedTile.rewardText}`);
      }
    }

    initPresence() {
      if (!window.ExecVoice.createPresence) return;
      this.presence = window.ExecVoice.createPresence({ tiles: BOARD_TILES });

      const countEl = document.getElementById('feed-online-count');
      const mobileCountEl = document.getElementById('feed-mobile-count');
      const usersEl = document.getElementById('feed-users');
      const eventsEl = document.getElementById('feed-events');
      const meNameEl = document.getElementById('feed-me-name');
      if (meNameEl) meNameEl.textContent = this.playerName;

      document.getElementById('rename-self-btn')?.addEventListener('click', () => {
        const next = prompt('請輸入你在 3D 島城的暱稱：', this.playerName);
        if (next && next.trim()) {
          this.playerName = next.trim().slice(0, 10);
          this.safeSetStorage('workplace_english_player_name', this.playerName);
          if (meNameEl) meNameEl.textContent = this.playerName;
          this.presence?.updateSelf({ name: this.playerName });
        }
      });

      const hudLiveCountEl = document.getElementById('hud-live-count');
      const hudAvatarsEl = document.getElementById('hud-users-avatars');

      this.presence.onUsers((users) => {
        const countText = `${users.length} 位實習生在線`;
        if (countEl) countEl.textContent = `${users.length} 人在線`;
        if (mobileCountEl) mobileCountEl.textContent = `${users.length} 人在線`;
        if (hudLiveCountEl) hudLiveCountEl.textContent = countText;

        // Populate side feed users
        if (usersEl) {
          usersEl.innerHTML = users
            .map(
              (u) => `
            <li class="feed-user-chip" data-user-id="${u.id}" title="#${(u.tile || 0) + 1} 格 · ${u.buildings || 0} 棟建築（點擊鏡頭飛躍）" style="cursor: pointer;">
              <span class="u-dot" style="background:${u.color || '#38bdf8'}"></span>
              <span>${this.escapeHtml(u.name)}${u.me ? ' (你)' : ''}</span>
            </li>`
            )
            .join('');

          usersEl.querySelectorAll('.feed-user-chip').forEach((el) => {
            el.addEventListener('click', () => {
              const uid = el.getAttribute('data-user-id');
              const target = users.find((x) => x.id === uid);
              if (!target) return;
              if (target.me) {
                this.islandCity?.focusPlayer();
                this.showToast('📍 鏡頭已聚焦至你的位置！');
              } else {
                this.islandCity?.focusRemotePlayer(uid);
                this.showToast(`📍 鏡頭已鎖定在線同學「${target.name}」在 #${(target.tile || 0) + 1} 格！`);
              }
            });
          });
        }

        // Populate Top Live Classmates HUD Bar
        if (hudAvatarsEl) {
          hudAvatarsEl.innerHTML = users
            .map(
              (u) => `
            <button class="hud-avatar-chip ${u.me ? 'is-me' : ''}" type="button" data-user-id="${u.id}" title="${this.escapeHtml(u.name)}${u.me ? ' (你)' : ''} · 在第 #${(u.tile || 0) + 1} 格 (點擊鏡頭鎖定)">
              <span class="hud-chip-dot" style="background:${u.color || '#38bdf8'}"></span>
              <span class="hud-chip-name">${this.escapeHtml(u.name)}${u.me ? ' (你)' : ''}</span>
              <span class="hud-chip-tile">#${(u.tile || 0) + 1}</span>
            </button>`
            )
            .join('');

          hudAvatarsEl.querySelectorAll('.hud-avatar-chip').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const uid = btn.getAttribute('data-user-id');
              const target = users.find((x) => x.id === uid);
              if (!target) return;
              if (target.me) {
                this.islandCity?.focusPlayer();
                this.showToast('📍 鏡頭已聚焦至你的位置！');
              } else {
                this.islandCity?.focusRemotePlayer(uid);
                this.showToast(`📍 鏡頭已鎖定在線同學「${target.name}」在 #${(target.tile || 0) + 1} 格！`);
              }
            });
          });
        }

        const others = users.filter((u) => !u.me);
        this.islandCity?.setRemotePlayers(others);
      });

      this.presence.onEvent((ev) => {
        if (!eventsEl) return;
        const li = document.createElement('li');
        li.className = 'feed-event-item';
        li.textContent = ev.text;
        eventsEl.prepend(li);
        while (eventsEl.children.length > 25) {
          eventsEl.removeChild(eventsEl.lastChild);
        }
      });

      this.presence.start({
        id: this.sessionId,
        playerId: this.playerId,
        name: this.playerName,
        color: '#f97316',
        tile: this.tycoon.playerTileIndex,
        buildings: Object.values(this.tycoon.buildingLevels || {}).filter((v) => v >= 1).length
      });
    }

    updateDockUI() {
      const currentLandedTile = BOARD_TILES[this.tycoon.playerTileIndex] || BOARD_TILES[0];
      const titleEl = document.getElementById('plaza-status-title');
      const descEl = document.getElementById('plaza-status-desc');
      const enterBtn = document.getElementById('plaza-enter-studio-btn');
      const rollBtn = document.getElementById('roll-dice-btn');

      if (rollBtn) {
        rollBtn.disabled = this.isRollingDice;
        rollBtn.textContent = this.isRollingDice ? '🎲 旋轉中...' : '🎲 擲 3D 骰子';
      }

      if (titleEl) {
        titleEl.innerHTML = `📍 目前所在位置：#${currentLandedTile.index + 1} ${this.escapeHtml(currentLandedTile.name)}`;
      }

      let scenarioObj = null;
      if (currentLandedTile.type === 'scenario') {
        scenarioObj = this.allScenarios.find((s) => s.id === currentLandedTile.scenarioId);
      } else if (currentLandedTile.type === 'ai-lot' && this.customScenarios.length > 0) {
        scenarioObj = this.customScenarios[0];
      }

      if (descEl) {
        if (scenarioObj) {
          const lv = this.tycoon.buildingLevels[scenarioObj.id] || 0;
          descEl.innerHTML = `當前建築：<strong>${this.escapeHtml(scenarioObj.buildingName || scenarioObj.title)} (Lv.${lv})</strong> ｜ 點擊「進入腳下建築」或點擊島上建築即可打開任務視窗！`;
        } else {
          descEl.innerHTML = `停留於非建築格（${this.escapeHtml(currentLandedTile.description || currentLandedTile.rewardText)}），請擲骰子前進！`;
        }
      }

      if (enterBtn) {
        enterBtn.disabled = !scenarioObj || this.isRollingDice;
      }
    }

    renderSimCityBoard() {
      if (this.islandCity && BOARD_TILES) {
        const infos = BOARD_TILES.map((tile) => {
          let scenarioObj = null;
          if (tile.type === 'scenario') {
            scenarioObj = this.allScenarios.find((s) => s.id === tile.scenarioId);
          } else if (tile.type === 'ai-lot' && this.customScenarios.length > 0) {
            scenarioObj = this.customScenarios[0];
          }
          const lv = scenarioObj ? (this.tycoon.buildingLevels[scenarioObj.id] || 0) : 0;
          return {
            index: tile.index,
            name: scenarioObj?.buildingName || tile.name,
            level: lv,
            isBuilding: !!scenarioObj,
            colors: {
              wall: scenarioObj?.wallColorLeft || '#3b82f6',
              roof: scenarioObj?.roofColor || '#2563eb'
            }
          };
        });
        this.islandCity.setTileInfos(infos);
        this.islandCity.setPlayerTile(this.tycoon.playerTileIndex, false);
      }

      this.updateDockUI();
    }

    /**
     * Fair 3D Dice Roll with 3D cube tumbling animation and step-by-step pawn movement across the 3D Island
     */
    async rollRichmanDice() {
      if (this.isRollingDice) return;
      this.isRollingDice = true;

      const steps = Math.floor(Math.random() * 6) + 1;
      this.lastDiceValue = steps;
      playGameSfx('dice');

      const cubeEl = document.getElementById('dice-3d-cube');
      cubeEl?.classList.add('rolling');

      const faceRotations = {
        1: 'rotateX(0deg) rotateY(0deg)',
        2: 'rotateX(0deg) rotateY(-90deg)',
        3: 'rotateX(0deg) rotateY(-180deg)',
        4: 'rotateX(0deg) rotateY(90deg)',
        5: 'rotateX(-90deg) rotateY(0deg)',
        6: 'rotateX(90deg) rotateY(0deg)'
      };

      this.updateDockUI();

      await new Promise((r) => setTimeout(r, 650));
      cubeEl?.classList.remove('rolling');
      if (cubeEl && faceRotations[steps]) {
        cubeEl.style.transform = faceRotations[steps];
      }

      await new Promise((r) => setTimeout(r, 200));

      // Step-by-step 3D pawn movement across the 3D Island!
      for (let i = 1; i <= steps; i++) {
        this.tycoon.playerTileIndex = (this.tycoon.playerTileIndex + 1) % BOARD_TILES.length;
        playGameSfx('step');

        if (this.tycoon.playerTileIndex === 0) {
          this.tycoon.money += 1000;
          this.tycoon.day += 1;
          playGameSfx('payday');
          this.showToast('🏛️ 經過市政廳發薪日！領取青年職涯津貼 +$1,000！');
          this.presence?.publishEvent(`💰 ${this.playerName} 經過市政廳領薪水 +$1,000！`);
        }

        this.islandCity?.setPlayerTile(this.tycoon.playerTileIndex, true);
        this.updateDockUI();
        await new Promise((r) => setTimeout(r, 320));
      }

      this.isRollingDice = false;
      this.tycoon.day += 1;
      this.saveTycoonState();
      this.updateDockUI();

      this.presence?.updateSelf({
        tile: this.tycoon.playerTileIndex,
        buildings: Object.values(this.tycoon.buildingLevels || {}).filter((v) => v >= 1).length
      });

      this.handleLandOnTile(this.tycoon.playerTileIndex, false);
    }

    handleLandOnTile(tileIndex, isDirectClick = false) {
      const tile = BOARD_TILES[tileIndex];
      if (!tile) return;

      if (tile.type === 'scenario') {
        const found = this.allScenarios.find((s) => s.id === tile.scenarioId);
        if (found) {
          this.selectedScenario = found;
          const currentLevel = this.tycoon.buildingLevels[found.id] || 0;
          const stageConfig = window.ExecVoice.BUILDING_STAGES_CONFIG[Math.min(currentLevel, 3)];

          // IF ALREADY BUILT: PAY INSTANT REPEAT-VISIT DIVIDEND!
          if (currentLevel > 0) {
            const dividend = stageConfig.arrivalRent || 500;
            this.tycoon.money += dividend;
            this.tycoon.reputation += 10;
            this.saveTycoonState();
            playGameSfx('payday');

            this.showRichmanEventModal(
              `🏢 重訪「${found.buildingName}」· 領取營運分紅！`,
              `
                <p style="margin-bottom:12px; color:#cbd5e1;">
                  你再次抵達了你所開發的 <strong>${this.escapeHtml(found.buildingName)} (Lv.${currentLevel})</strong>！
                </p>
                <div style="background:rgba(250,204,21,0.15); border:1.5px solid #fde047; border-radius:12px; padding:14px; margin-bottom:12px;">
                  <div style="font-size:0.8rem; color:#fef08a; font-weight:800;">💰 再次抵達門市營運分紅：</div>
                  <p style="font-size:1.35rem; font-weight:900; color:#fde047; margin-top:4px;">+$${dividend.toLocaleString()} 元</p>
                  <p style="font-size:0.82rem; color:#cbd5e1; margin-top:4px;">
                    下一個發展目標：<strong>${stageConfig.stageBadge}</strong>！完成口語對話驗收，即可擴建為更高聳的摩天大樓！
                  </p>
                </div>
              `
            );
          } else {
            playGameSfx('event');
            this.showToast(
              `🎲 抵達「${found.buildingName}」！點擊右側「🏢 進入此建築挑戰」即可開工挑戰！`
            );
          }

          this.renderSimCityBoard();
          this.renderScenarioList();
          this.renderSelectedScenarioPreview();
          this.populateStudioHeader();
          this.setSimCityNewsTicker(
            `📍 你抵達了「${found.buildingName}」！NPC ${found.aiName} 正在等你對話，通關可升級建築並領取獎金！`
          );
        }
        return;
      }

      if (tile.type === 'ai-lot' || tile.type === 'corner-builder') {
        if (tile.type === 'ai-lot' && this.customScenarios.length > 0) {
          this.selectedScenario = this.customScenarios[0];
          this.renderSimCityBoard();
          this.renderScenarioList();
          this.renderSelectedScenarioPreview();
          this.populateStudioHeader();
          this.showToast(`🏗️ 抵達自建專區「${this.selectedScenario.title}」！`);
          return;
        }
        playGameSfx('event');
        const bonus = 800;
        this.tycoon.money += bonus;
        this.tycoon.reputation += 15;
        this.saveTycoonState();
        this.showRichmanEventModal(
          `🏆 抵達「${tile.name}」· 市政青年津貼！`,
          `
            <p style="margin-bottom:12px; color:#cbd5e1;">你抵達了模擬城市 ${tile.name}，市長頒發青年職涯創業補助！</p>
            <div style="background:rgba(16,185,129,0.15); border:1.5px solid #34d399; border-radius:12px; padding:14px; margin-bottom:12px;">
              <span class="badge-reward" style="font-size:1rem;">💰 職涯資金 +$${bonus}</span>
              <p style="font-size:0.82rem; color:#a7f3d0; margin-top:8px;">提示：可在下方專區讓 AI 為此地塊生成新建築！</p>
            </div>
          `
        );
        return;
      }

      if (tile.type === 'chance') {
        playGameSfx('event');
        const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
        this.tycoon.money += card.moneyDelta;
        this.tycoon.reputation += card.reputationDelta;
        this.saveTycoonState();
        this.setSimCityNewsTicker(`🎉 ${card.title} 獲得獎金 +$${card.moneyDelta}、城市聲望 +${card.reputationDelta}！`);
        this.showRichmanEventModal(
          card.title,
          `
            <p style="margin-bottom:12px; color:#cbd5e1;">${this.escapeHtml(card.desc)}</p>
            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.4); border-radius:10px; padding:12px; margin-bottom:12px;">
              <div style="font-size:0.78rem; color:#6ee7b7; font-weight:700;">💡 大富翁職場必勝金句：</div>
              <p style="font-size:1rem; font-weight:800; color:#fff; margin-top:4px;">"${this.escapeHtml(card.tipEn)}"</p>
              <p style="font-size:0.84rem; color:#94a3b8;">${this.escapeHtml(card.tipZh)}</p>
              <button type="button" id="event-card-tts-btn" class="btn-secondary" style="margin-top:8px; padding:5px 12px; font-size:0.8rem;">🔊 聽真人發音</button>
            </div>
            <div style="display:flex; gap:10px;">
              <span class="badge-reward">💰 職涯資金 +$${card.moneyDelta}</span>
              <span class="badge-level">⭐ 城市聲望 +${card.reputationDelta} pt</span>
            </div>
          `,
          () => {
            document.getElementById('event-card-tts-btn')?.addEventListener('click', () => {
              speakWithBrowserTTS(card.tipEn, null, null, { apiKey: this.apiKey });
            });
          }
        );
        return;
      }

      if (tile.type === 'corner-transit') {
        playGameSfx('event');
        const nextTarget = BOARD_TILES.find((t, i) => i > tileIndex && (t.type === 'scenario' || t.type === 'ai-lot')) ||
                           BOARD_TILES.find((t) => t.type === 'scenario');
        if (nextTarget) {
          this.showRichmanEventModal(
            '🚇 模擬城市捷運特快車發車！',
            `
              <p style="margin-bottom:12px; color:#cbd5e1;">
                歡迎搭乘模擬城市捷運！列車即將直達下一座熱門職場大樓：<strong>${this.escapeHtml(nextTarget.name)}</strong>！
              </p>
            `,
            () => {
              const confirmBtn = document.getElementById('confirm-event-modal-btn');
              const onNext = () => {
                confirmBtn?.removeEventListener('click', onNext);
                this.tycoon.playerTileIndex = nextTarget.index;
                this.saveTycoonState();
                playGameSfx('step');
                this.handleLandOnTile(nextTarget.index, false);
              };
              confirmBtn?.addEventListener('click', onNext);
            }
          );
        }
        return;
      }

      if (tile.type === 'corner-park' || tile.type === 'academy' || tile.type === 'corner-start') {
        playGameSfx('payday');
        const bonus = tile.type === 'corner-start' ? 1000 : 600;
        this.tycoon.money += bonus;
        this.tycoon.reputation += 10;
        this.saveTycoonState();
        this.showToast(`🎉 停留於「${tile.name}」！獲得市民獎學金 +$${bonus}！`);
      }
    }

    showRichmanEventModal(title, bodyHtml, onRendered) {
      const modal = document.getElementById('board-event-modal');
      const titleEl = document.getElementById('event-modal-title');
      const bodyEl = document.getElementById('event-modal-body');
      if (!modal || !titleEl || !bodyEl) return;

      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      modal.classList.remove('hidden');
      if (typeof onRendered === 'function') {
        onRendered();
      }
    }

    renderScenarioList() {
      const container = document.getElementById('scenario-cards-grid');
      if (!container) return;

      const filtered =
        this.activeCategory === '全部'
          ? this.allScenarios
          : this.allScenarios.filter((s) => s.category === this.activeCategory);

      container.innerHTML = filtered
        .map((s) => {
          const isSelected = s.id === this.selectedScenario?.id;
          const lv = this.tycoon.buildingLevels[s.id] || 0;
          const bldName = s.buildingName || s.title;
          const stageConfig = window.ExecVoice.BUILDING_STAGES_CONFIG[Math.min(lv, 3)];
          return `
          <article class="scenario-card ${isSelected ? 'selected' : ''}" data-id="${s.id}">
            <div class="scenario-card-top">
              <span class="badge-category">${this.escapeHtml(s.buildingIcon || '🏢')} ${this.escapeHtml(s.category)}</span>
              <span class="badge-difficulty">🏗️ Lv.${lv} ｜ ${stageConfig.buildingTypeLabel}</span>
            </div>
            <h3 class="scenario-card-title">${this.escapeHtml(bldName)}</h3>
            <p class="scenario-card-role">
              <strong>情境任務：</strong>${this.escapeHtml(s.title)}
            </p>
            <p class="scenario-card-desc">${this.escapeHtml(s.background)}</p>
            <div class="scenario-card-footer">
              <span class="objective-count">💰 通關獎金 $${(s.baseReward || 1200).toLocaleString()}</span>
              <span class="select-indicator">${isSelected ? '✓ 正在檢視藍圖' : '檢視建築藍圖 →'}</span>
            </div>
          </article>
        `;
        })
        .join('');

      // Clicking scenario card in atlas only selects for blueprint inspection
      container.querySelectorAll('.scenario-card').forEach((card) => {
        card.addEventListener('click', () => {
          const found = this.allScenarios.find((item) => item.id === card.dataset.id);
          if (found) {
            this.selectedScenario = found;
            this.renderSimCityBoard();
            this.renderScenarioList();
            this.renderSelectedScenarioPreview();
          }
        });
      });
    }

    renderSelectedScenarioPreview() {
      const s = this.selectedScenario;
      if (!s) return;

      const lv = this.tycoon.buildingLevels[s.id] || 0;
      const stageConfig = window.ExecVoice.BUILDING_STAGES_CONFIG[Math.min(lv, 3)];

      const currentLandedTile = BOARD_TILES[this.tycoon.playerTileIndex];
      const isPlayerAtThisBuilding =
        (currentLandedTile?.scenarioId === s.id) ||
        (currentLandedTile?.type === 'ai-lot' && s.id.startsWith('ai-'));

      const zoneBadge = document.getElementById('preview-zone-badge');
      const levelBadge = document.getElementById('preview-building-level');
      const iconEl = document.getElementById('preview-building-icon');
      const bldNameEl = document.getElementById('preview-building-name');
      const rewardBadge = document.getElementById('preview-reward-badge');
      const stageBanner = document.getElementById('preview-stage-banner');
      const stageLadder = document.getElementById('preview-stage-ladder');

      if (zoneBadge) zoneBadge.textContent = s.zoneLabel || `🟦 ${s.category}`;
      if (levelBadge) {
        levelBadge.textContent = `Lv.${lv} ${'★'.repeat(lv)}${'☆'.repeat(Math.max(0, 3 - lv))} (${stageConfig.buildingTypeLabel})`;
      }
      if (iconEl) iconEl.textContent = lv >= 3 ? '🏙️' : s.buildingIcon || '🏢';
      if (bldNameEl) bldNameEl.textContent = s.buildingName || s.title;
      if (rewardBadge) {
        const stageReward = Math.round((s.baseReward || 1200) * stageConfig.clearRewardMultiplier);
        rewardBadge.textContent = `💰 本階過關獎金 +$${stageReward.toLocaleString()}`;
      }

      if (stageBanner) {
        stageBanner.textContent = `${stageConfig.stageBadge} ｜ ${stageConfig.stageTaskHint}`;
      }

      if (stageLadder) {
        stageLadder.innerHTML = window.ExecVoice.BUILDING_STAGES_CONFIG.slice(0, 3).map((stg, i) => {
          const isDone = lv > i;
          const isTarget = lv === i;
          const statusText = isDone ? '✅ 已完成' : isTarget ? '🎯 當前挑戰目標' : '🔒 待解鎖';
          const rewardVal = Math.round((s.baseReward || 1200) * stg.clearRewardMultiplier);
          const rentInfo = stg.arrivalRent > 0 ? ` ＋ 抵達分紅 $${stg.arrivalRent}` : '';
          return `
            <div class="stage-ladder-item ${isTarget ? 'current-target' : ''} ${isDone ? 'completed' : ''}">
              <span><strong>Lv.${i + 1} ${stg.buildingTypeLabel}</strong>（目標 ${stg.minScore} 分）</span>
              <span>💰 +$${rewardVal.toLocaleString()}${rentInfo} ｜ ${statusText}</span>
            </div>
          `;
        }).join('');
      }

      const stageVariation = s.stageVariations?.[lv + 1];
      const displayTitle = stageVariation?.stageTitle || s.title;
      const displayBg = stageVariation?.extraContext ? `${s.background}\n\n${stageVariation.extraContext}` : s.background;

      document.getElementById('preview-title').textContent = displayTitle;
      document.getElementById('preview-category').textContent = `${s.category} · ${s.difficulty}`;
      document.getElementById('preview-ai-persona').textContent = `${s.aiName} (${s.aiRole})`;
      document.getElementById('preview-ai-attitude').textContent = s.aiPersonality;
      document.getElementById('preview-user-role').textContent = s.userRole;
      document.getElementById('preview-background').textContent = displayBg;
      document.getElementById('preview-opening-en').textContent = `"${s.openingLine}"`;
      document.getElementById('preview-opening-zh').textContent = s.openingLineZh || '';

      const objList = document.getElementById('preview-objectives-list');
      objList.innerHTML = s.objectives
        .map(
          (obj, idx) =>
            `<li><span class="obj-num">${idx + 1}</span><span>${this.escapeHtml(obj)}</span></li>`
        )
        .join('');

      const phraseList = document.getElementById('preview-phrases-list');
      phraseList.innerHTML = (s.suggestedPhrases || [])
        .map(
          (p, idx) => `
        <div class="phrase-preview-item">
          <div class="phrase-preview-main">
            <p class="phrase-en">${this.escapeHtml(p.en)}</p>
            <p class="phrase-zh">${this.escapeHtml(p.zh)}</p>
          </div>
          <button class="btn-icon-tts" data-phrase-idx="${idx}" title="聆聽發音">🔊</button>
        </div>
      `
        )
        .join('');

      phraseList.querySelectorAll('.btn-icon-tts').forEach((btn) => {
        btn.addEventListener('click', () => {
          const phrase = s.suggestedPhrases[Number(btn.dataset.phraseIdx)];
          if (phrase) {
            speakWithBrowserTTS(phrase.en, null, null, {
              apiKey: this.apiKey,
              aiVoice: s.aiVoice
            });
          }
        });
      });

      // Update enter button: strict check so students cannot jump to non-landed buildings!
      const enterBtn = document.getElementById('start-roleplay-from-hub-btn');
      if (enterBtn) {
        if (isPlayerAtThisBuilding) {
          enterBtn.disabled = false;
          enterBtn.textContent = `🏢 進入此建築挑戰【${stageConfig.stageBadge.split('：')[1] || '建案任務'}】！`;
        } else {
          enterBtn.disabled = true;
          enterBtn.textContent = `🎲 請擲 3D 骰子前進至此建築以解鎖任務 (你目前在 #${this.tycoon.playerTileIndex + 1} 格)`;
        }
      }
    }

    async handleAIGenerateScenario() {
      const inputEl = document.getElementById('ai-scenario-prompt-input');
      const btnEl = document.getElementById('ai-generate-scenario-btn');
      const promptText = inputEl.value.trim();

      if (!promptText) {
        this.showToast('請先輸入一句話描述你想建造的職場英語大樓！');
        inputEl.focus();
        return;
      }

      const originalText = btnEl.textContent;
      btnEl.disabled = true;
      btnEl.textContent = '🏗️ 都市計畫局正在建造新職場大樓...';

      try {
        const generated = await generateScenarioWithAI(this.apiKey, promptText);
        const newScenario = {
          ...generated,
          id: 'ai-' + Date.now(),
          buildingName: generated.buildingName || generated.title.split('：')[0] || 'AI 新創職場大樓',
          buildingSub: 'SimCity AI Custom Tower',
          buildingIcon: '🏗️',
          zoneLabel: '🟪 AI 都市計畫特區',
          baseReward: 1500
        };
        this.customScenarios.unshift(newScenario);
        this.saveCustomScenarios();
        this.selectedScenario = newScenario;
        this.tycoon.playerTileIndex = 6; // Move player to Tile 6 (AI Custom Zoning Lot)
        this.saveTycoonState();
        this.activeCategory = '全部';
        document.querySelectorAll('.category-pill').forEach((p) => {
          p.classList.toggle('active', p.dataset.category === '全部');
        });
        playGameSfx('upgrade');
        this.renderSimCityBoard();
        this.renderScenarioList();
        this.renderSelectedScenarioPreview();
        this.populateStudioHeader();
        inputEl.value = '';
        this.showToast(`🎉 已在地圖 #7 號地塊蓋出「${newScenario.title}」！`);
      } catch (err) {
        console.error(err);
        this.showToast('生成情境時發生錯誤：' + (err.message || '請檢查網路或 API Key'));
      } finally {
        btnEl.disabled = false;
        btnEl.textContent = originalText;
      }
    }

    handleSaveCustomScenario() {
      const title = document.getElementById('custom-title').value.trim();
      const category = document.getElementById('custom-category').value;
      const difficulty = document.getElementById('custom-difficulty').value;
      const aiName = document.getElementById('custom-ai-name').value.trim();
      const aiRole = document.getElementById('custom-ai-role').value.trim();
      const aiVoice = document.getElementById('custom-ai-voice').value;
      const aiPersonality = document.getElementById('custom-ai-personality').value.trim();
      const userRole = document.getElementById('custom-user-role').value.trim();
      const background = document.getElementById('custom-background').value.trim();
      const obj1 = document.getElementById('custom-obj-1').value.trim();
      const obj2 = document.getElementById('custom-obj-2').value.trim();
      const obj3 = document.getElementById('custom-obj-3').value.trim();
      const openingLine = document.getElementById('custom-opening-line').value.trim();

      const newScenario = {
        id: 'custom-' + Date.now(),
        buildingName: title.split('：')[0] || title,
        buildingSub: 'Custom SimCity Building',
        buildingIcon: '🏢',
        zoneLabel: `🟪 自訂分區 · ${category}`,
        baseReward: 1500,
        title,
        category,
        difficulty,
        aiName,
        aiRole,
        aiVoice,
        aiPersonality,
        userRole,
        background,
        objectives: [obj1, obj2, obj3].filter(Boolean),
        openingLine:
          openingLine || 'Hi there! Thanks for talking with me today. How can I help you?',
        openingLineZh: '（自訂建築開場白）',
        suggestedPhrases: [
          {
            en: 'Hi! Excuse me, could I talk with you for a minute?',
            zh: '嗨！不好意思，請問我可以跟您聊一分鐘嗎？'
          },
          {
            en: 'Thank you so much for your help!',
            zh: '非常感謝您的幫忙！'
          }
        ]
      };

      this.customScenarios.unshift(newScenario);
      this.saveCustomScenarios();
      this.selectedScenario = newScenario;
      this.tycoon.playerTileIndex = 6;
      this.saveTycoonState();
      playGameSfx('upgrade');
      this.renderSimCityBoard();
      this.renderScenarioList();
      this.renderSelectedScenarioPreview();
      this.populateStudioHeader();
      document.getElementById('custom-scenario-modal').classList.add('hidden');
      document.getElementById('custom-scenario-form').reset();
      this.showToast(`🏗️ 已建造自訂職場建築「${title}」！`);
    }

    populateStudioHeader() {
      const s = this.selectedScenario;
      if (!s) return;

      const bldBadge = document.getElementById('studio-building-badge');
      if (bldBadge) {
        const lv = this.tycoon.buildingLevels[s.id] || 0;
        bldBadge.textContent = `${s.buildingIcon || '🏢'} 當前所在建築：${
          s.buildingName || s.title
        } (Lv.${lv})`;
      }

      document.getElementById('studio-scenario-title').textContent = s.title;
      document.getElementById('studio-ai-name').textContent = s.aiName;
      document.getElementById('studio-ai-role').textContent = s.aiRole;
      document.getElementById('studio-user-role').textContent = s.userRole;

      const missionContainer = document.getElementById('studio-mission-list');
      missionContainer.innerHTML = s.objectives
        .map(
          (obj, idx) => `
        <label class="mission-check-item" id="mission-item-${idx}">
          <input type="checkbox" class="mission-checkbox" data-idx="${idx}" />
          <span>${this.escapeHtml(obj)}</span>
        </label>
      `
        )
        .join('');

      this.renderRescueHints({
        strategyTipZh:
          '不知道怎麼用英文回答嗎？可以直接參考下方 3 個實用句，點「🔊 聽發音」跟著開口說，或點「📤 直接採用」！',
        options: (s.suggestedPhrases || []).map((p, i) => ({
          style: `任務 ${i + 1} 推薦句`,
          en: p.en,
          zh: p.zh
        }))
      });
    }

    async startVoiceCall() {
      if (this.isCallActive) return;

      this.populateStudioHeader();
      this.resetCallMetrics();
      this.isCallActive = true;
      this.isMuted = false;
      this.updateCallButtonsUI();

      this.callStartTime = Date.now();
      this.callTimerInterval = setInterval(() => this.updateCallTimerUI(), 1000);

      if (this.apiKey) {
        // Only open AudioWorklet PCM capture when streaming to Gemini Live WebSocket!
        // This avoids competing with browser SpeechRecognition for the microphone in zero-key mode.
        this.callMode = 'gemini-live';
        this.audioEngine = new AudioEngine({
          onPcmChunk: (base64Pcm) => {
            if (this.liveManager && this.callMode === 'gemini-live') {
              this.liveManager.sendAudioChunk(base64Pcm);
            }
          },
          onVolumeChange: ({ micLevel, aiLevel, micSpectrum, aiSpectrum }) => {
            this.updateVisualizerUI(micLevel, aiLevel, micSpectrum, aiSpectrum);
          },
          onAiSpeakingChange: (speaking) => {
            const orb = document.getElementById('voice-orb');
            orb?.classList.toggle('ai-speaking', speaking);
            document.getElementById('orb-status-label').textContent = speaking
              ? `${this.selectedScenario.aiName} 正在說話...`
              : '🎙️ 換你說英文囉！(直接對麥克風開口，或使用下方輸入框)';
          }
        });

        try {
          await this.audioEngine.startCapture();
        } catch (micErr) {
          console.warn('Microphone access denied or unavailable:', micErr);
        }

        document.getElementById('orb-status-label').textContent = `正在連線至 ${this.liveModel}...`;

        this.liveManager = new GeminiLiveSessionManager({
          apiKey: this.apiKey,
          model: this.liveModel,
          scenario: this.selectedScenario,
          onAudioChunk: (base64Audio) => {
            this.audioEngine?.enqueuePcm24kBase64(base64Audio);
          },
          onUserTranscript: (text, isFinal) => {
            this.handleLiveUserTranscript(
              applyScenarioPhoneticFixes(text, this.selectedScenario),
              isFinal
            );
          },
          onAiTranscript: (text) => {
            this.handleLiveAiTranscript(text);
          },
          onTurnComplete: () => {
            this.finalizeCurrentAiTurn();
          },
          onInterrupted: () => {
            this.audioEngine?.interruptPlayback();
            this.finalizeCurrentAiTurn();
          },
          onStatusChange: (status) => {
            if (status === 'connected') {
              document.getElementById('orb-status-label').textContent =
                '🟢 已連線！AI 對練夥伴即將開口...';
            } else if (status === 'disconnected' && this.isCallActive) {
              document.getElementById('orb-status-label').textContent = '連線已結束';
            }
          },
          onError: (errMsg) => {
            this.showToast(`${errMsg}`);
            if (this.audioEngine) {
              this.audioEngine.stop().catch(() => {});
              this.audioEngine = null;
            }
            this.callMode = 'browser-demo';
            this.startBrowserDemoVoiceSession();
          }
        });

        try {
          await this.liveManager.connect();
        } catch (err) {
          console.error('Failed to connect Gemini Live:', err);
          if (this.audioEngine) {
            this.audioEngine.stop().catch(() => {});
            this.audioEngine = null;
          }
          this.callMode = 'browser-demo';
          this.startBrowserDemoVoiceSession();
        }
      } else {
        this.callMode = 'browser-demo';
        this.startBrowserDemoVoiceSession();
      }
    }

    /**
     * Browser Voice Session with:
     * 1. Exclusive mic access (no competing AudioWorklet)
     * 2. Strict speaker-echo isolation (recognizer is stopped while AI speaks, started 280ms after AI finishes)
     * 3. `maxAlternatives = 5` N-best scenario reranking & phonetic repair
     * 4. 1.8s natural pause accumulation so students aren't cut off mid-sentence
     */
    startBrowserDemoVoiceSession() {
      const s = this.selectedScenario;
      document.getElementById('orb-status-label').textContent = `${s.aiName} 正在說話...`;

      if (this.transcriptTurns.length === 0) {
        const firstHint = (s.suggestedPhrases && s.suggestedPhrases[0]) ? s.suggestedPhrases[0].en : '';
        this.appendTranscriptTurn('ai', s.openingLine, s.openingLineZh, firstHint);
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        this.speechRecognition = new SpeechRec();
        this.speechRecognition.lang = 'en-US';
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.maxAlternatives = 5;

        this.speechRecognition.onresult = (event) => {
          if (!this.isCallActive || this.isMuted || this.isDemoAiSpeaking) return;

          let interimText = '';
          let newFinalSegments = [];

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const resItem = event.results[i];
            if (resItem.isFinal) {
              const bestTranscript = pickBestAlternativeForScenario(resItem, this.selectedScenario);
              if (bestTranscript.trim()) {
                newFinalSegments.push(bestTranscript.trim());
              }
            } else {
              const rawInterim = resItem[0]?.transcript || '';
              interimText += applyScenarioPhoneticFixes(rawInterim, this.selectedScenario);
            }
          }

          if (newFinalSegments.length > 0) {
            this.pendingUserSegments.push(...newFinalSegments);
          }

          this.updateLiveInterimDisplay(interimText);
          this.resetUtteranceSilenceTimer();
        };

        this.speechRecognition.onerror = (e) => {
          if (e.error === 'not-allowed') {
            this.showToast('⚠️ 瀏覽器語音辨識權限未開啟，請使用下方文字框輸入你的英文回答');
          }
        };

        this.speechRecognition.onend = () => {
          if (
            this.isCallActive &&
            this.callMode === 'browser-demo' &&
            !this.isMuted &&
            !this.isDemoAiSpeaking
          ) {
            try {
              this.speechRecognition.start();
            } catch (_) {}
          }
        };
      } else {
        this.showToast(
          '💡 您目前的瀏覽器不支援自動語音轉文字（建議使用 Chrome），可使用下方文字框輸入英文回應！'
        );
      }

      // Speak AI opening line FIRST while keeping SpeechRecognition paused so 0% speaker echo is recorded!
      this.pauseSpeechRecognitionForAiOutput();
      const orb = document.getElementById('voice-orb');
      orb?.classList.add('ai-speaking');

      speakWithBrowserTTS(
        s.openingLine,
        () => {
          this.pauseSpeechRecognitionForAiOutput();
          orb?.classList.add('ai-speaking');
        },
        () => {
          orb?.classList.remove('ai-speaking');
          if (this.isCallActive) {
            document.getElementById('orb-status-label').textContent =
              '🎙️ 換你用英文回答囉！(講完停頓約 1.8 秒或點「✅ 講完了」即自動送出)';
            this.resumeSpeechRecognitionAfterAiOutput();
          }
        },
        { apiKey: this.apiKey, aiVoice: s.aiVoice }
      );
    }

    pauseSpeechRecognitionForAiOutput() {
      this.isDemoAiSpeaking = true;
      if (this.speechRecognition) {
        try {
          this.speechRecognition.abort();
        } catch (_) {}
      }
    }

    resumeSpeechRecognitionAfterAiOutput() {
      setTimeout(() => {
        if (!this.isCallActive || this.isMuted) return;
        this.isDemoAiSpeaking = false;
        if (this.speechRecognition && this.callMode === 'browser-demo') {
          try {
            this.speechRecognition.start();
          } catch (_) {}
        }
      }, 280);
    }

    updateLiveInterimDisplay(interimText = '') {
      if (!this.userSpeakingStartMs) {
        this.userSpeakingStartMs = Date.now();
      }

      this.currentInterimUserText = interimText.trim();
      const combined = [...this.pendingUserSegments, this.currentInterimUserText]
        .filter(Boolean)
        .join(' ')
        .trim();

      const container = document.getElementById('live-interim-container');
      const textEl = document.getElementById('live-interim-transcript');
      const orb = document.getElementById('voice-orb');

      if (combined) {
        orb?.classList.add('user-speaking');
        if (textEl) textEl.textContent = `🎙️ 正在辨識你的英文：${combined}`;
        container?.classList.remove('hidden');
      } else {
        orb?.classList.remove('user-speaking');
        container?.classList.add('hidden');
      }
    }

    resetUtteranceSilenceTimer() {
      if (this.utteranceSilenceTimer) {
        clearTimeout(this.utteranceSilenceTimer);
      }
      // Wait 1.8 seconds of silence so high school students can pause naturally between phrases!
      this.utteranceSilenceTimer = setTimeout(() => {
        this.commitPendingUserUtterance();
      }, 1850);
    }

    commitPendingUserUtterance() {
      if (this.utteranceSilenceTimer) {
        clearTimeout(this.utteranceSilenceTimer);
        this.utteranceSilenceTimer = null;
      }

      const fullSentence = [...this.pendingUserSegments, this.currentInterimUserText]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      this.pendingUserSegments = [];
      this.currentInterimUserText = '';

      const container = document.getElementById('live-interim-container');
      container?.classList.add('hidden');
      document.getElementById('voice-orb')?.classList.remove('user-speaking');

      if (!fullSentence) return;

      const polishedSentence = applyScenarioPhoneticFixes(fullSentence, this.selectedScenario);
      this.appendTranscriptTurn('user', polishedSentence);
      this.analyzeUserSpeechMetrics(polishedSentence);
      this.updateMissionCheckboxesFromTranscript();

      if (this.callMode === 'browser-demo' && this.isCallActive) {
        this.respondInBrowserDemoMode(polishedSentence);
      }
    }

    async respondInBrowserDemoMode(userSentence = '') {
      const s = this.selectedScenario;
      if (!s) return;

      this.updateMissionCheckboxesFromTranscript();

      // Immediately pause speech recognition before AI starts processing so user's speech is not echoed
      this.pauseSpeechRecognitionForAiOutput();

      const orb = document.getElementById('voice-orb');
      const statusLabel = document.getElementById('orb-status-label');
      if (statusLabel) {
        statusLabel.textContent = `${s.aiName} 正在思考並回應...`;
      }

      if (!userSentence) {
        const lastUserTurn = [...this.transcriptTurns].reverse().find((t) => t.role === 'user');
        if (lastUserTurn) userSentence = lastUserTurn.text;
      }

      // Generate dynamic guided response with entity tracking and next-step scaffolding
      let reply = null;
      if (window.ExecVoice && typeof window.ExecVoice.generateDynamicRoleplayTurn === 'function') {
        try {
          reply = await window.ExecVoice.generateDynamicRoleplayTurn({
            apiKey: this.apiKey,
            scenario: s,
            transcriptTurns: this.transcriptTurns,
            userUtterance: userSentence
          });
        } catch (err) {
          console.warn('[respondInBrowserDemoMode] Dynamic turn engine error:', err);
        }
      }

      if (!reply || !reply.en) {
        const userTurns = this.transcriptTurns.filter((t) => t.role === 'user');
        const userTurnCount = userTurns.length;
        const followUps = s.contextualFollowUps || [
          {
            en: 'Got it! Could you tell me a little bit more detail about that?',
            zh: '了解了！能請你再多告訴我一點細節嗎？',
            guidingHint: 'Could you please explain that once more?'
          },
          {
            en: 'That sounds great! Thank you so much for your help today.',
            zh: '聽起來太棒了！非常謝謝你今天的幫忙。',
            guidingHint: 'Thank you for your assistance!'
          }
        ];
        const rawReply = followUps[(userTurnCount - 1) % followUps.length];
        reply = {
          en: rawReply.en,
          zh: rawReply.zh,
          guidingHint: rawReply.guidingHint || ''
        };
      }

      setTimeout(() => {
        if (!this.isCallActive) return;
        this.appendTranscriptTurn('ai', reply.en, reply.zh, reply.guidingHint);
        this.updateMissionCheckboxesFromTranscript();
        orb?.classList.add('ai-speaking');

        speakWithBrowserTTS(
          reply.en,
          () => {
            this.pauseSpeechRecognitionForAiOutput();
            orb?.classList.add('ai-speaking');
            if (statusLabel) {
              statusLabel.textContent = `${s.aiName} 正在回應...`;
            }
          },
          () => {
            orb?.classList.remove('ai-speaking');
            if (this.isCallActive) {
              if (statusLabel) {
                statusLabel.textContent =
                  '🎙️ 換你說英文囉！(點擊下方提示可快速帶入句型，或直接對麥克風說話)';
              }
              this.resumeSpeechRecognitionAfterAiOutput();
            }
          },
          { apiKey: this.apiKey, aiVoice: s.aiVoice }
        );
      }, 350);
    }

    updateMissionCheckboxesFromTranscript() {
      const s = this.selectedScenario;
      if (!s.objectiveKeywords) return;
      const allUserLower = this.transcriptTurns
        .filter((t) => t.role === 'user')
        .map((t) => t.text.toLowerCase())
        .join(' ');

      s.objectiveKeywords.forEach((kws, idx) => {
        const hit = (kws || []).some((k) => allUserLower.includes(k.toLowerCase()));
        if (hit) {
          const cb = document.querySelector(`.mission-checkbox[data-idx="${idx}"]`);
          if (cb) cb.checked = true;
        }
      });
    }

    handleLiveUserTranscript(text, isFinal) {
      if (!this.userSpeakingStartMs) {
        this.userSpeakingStartMs = Date.now();
      }

      const container = document.getElementById('live-interim-container');
      const textEl = document.getElementById('live-interim-transcript');
      if (!isFinal) {
        this.currentInterimUserText = text;
        if (textEl) {
          textEl.textContent = `🎙️ 正在聽你說：${text}`;
        }
        container?.classList.remove('hidden');
        return;
      }

      this.currentInterimUserText = '';
      container?.classList.add('hidden');

      const cleanText = text.trim();
      if (!cleanText) return;

      const lastTurn = this.transcriptTurns[this.transcriptTurns.length - 1];
      if (lastTurn && lastTurn.role === 'user' && Date.now() - lastTurn.timestamp < 3500) {
        lastTurn.text = `${lastTurn.text} ${cleanText}`.trim();
        this.renderTranscriptStream();
      } else {
        this.appendTranscriptTurn('user', cleanText);
      }

      this.analyzeUserSpeechMetrics(cleanText);
      this.updateMissionCheckboxesFromTranscript();
    }

    handleLiveAiTranscript(textChunk) {
      this.currentAiTurnBuffer += textChunk;
      const lastTurn = this.transcriptTurns[this.transcriptTurns.length - 1];
      if (lastTurn && lastTurn.role === 'ai' && lastTurn.isStreaming) {
        lastTurn.text = this.currentAiTurnBuffer.trim();
        this.renderTranscriptStream();
      } else {
        this.transcriptTurns.push({
          role: 'ai',
          text: this.currentAiTurnBuffer.trim(),
          timestamp: Date.now(),
          isStreaming: true
        });
        this.renderTranscriptStream();
      }
    }

    finalizeCurrentAiTurn() {
      const lastTurn = this.transcriptTurns[this.transcriptTurns.length - 1];
      if (lastTurn && lastTurn.role === 'ai') {
        lastTurn.isStreaming = false;
      }
      this.currentAiTurnBuffer = '';
    }

    handleUserManualTextInput(text) {
      if (!this.isCallActive) {
        this.startVoiceCall().then(() => {
          this.sendManualTurn(text);
        });
        return;
      }
      this.sendManualTurn(text);
    }

    sendManualTurn(text) {
      this.appendTranscriptTurn('user', text);
      this.analyzeUserSpeechMetrics(text);
      this.updateMissionCheckboxesFromTranscript();

      if (this.callMode === 'gemini-live' && this.liveManager?.isConnected) {
        this.liveManager.sendTextMessage(text);
      } else {
        this.respondInBrowserDemoMode(text);
      }
    }

    appendTranscriptTurn(role, text, zhTranslation = '', guidingHint = '') {
      this.transcriptTurns.push({
        role,
        text,
        zhTranslation,
        guidingHint,
        timestamp: Date.now(),
        isStreaming: false
      });
      this.renderTranscriptStream();
      this.updateCallButtonsUI();
    }

    renderTranscriptStream() {
      const box = document.getElementById('transcript-stream');
      if (!box) return;

      if (this.transcriptTurns.length === 0) {
        box.innerHTML = `<div class="empty-transcript-placeholder">點擊「🎙️ 開始真人語音對練」後，你與 AI 的英文對話逐字稿會即時顯示在這裡...</div>`;
        return;
      }

      box.innerHTML = this.transcriptTurns
        .map((turn, idx) => {
          const speakerName =
            turn.role === 'ai' ? this.selectedScenario.aiName : 'You (你的英文回答)';
          const highlightedText =
            turn.role === 'user'
              ? this.highlightFillerWordsInHtml(turn.text)
              : this.escapeHtml(turn.text);
          return `
          <div class="chat-bubble-row ${turn.role === 'user' ? 'row-user' : 'row-ai'}">
            <div class="chat-bubble ${turn.role === 'user' ? 'bubble-user' : 'bubble-ai'}">
              <div class="bubble-header">
                <span class="speaker-tag">${this.escapeHtml(speakerName)}</span>
                <div class="bubble-actions">
                  ${
                    turn.role === 'user'
                      ? `<button class="btn-mini-edit" data-turn-idx="${idx}" title="若語音辨識有誤差，可點擊微調原句">✏️ 修正文字</button>`
                      : ''
                  }
                  <button class="btn-mini-speak" data-speak="${this.escapeHtml(
                    turn.text
                  )}" title="重聽此句">🔊</button>
                </div>
              </div>
              <p class="bubble-text">${highlightedText}</p>
              ${
                turn.zhTranslation
                  ? `<p class="bubble-zh">${this.escapeHtml(turn.zhTranslation)}</p>`
                  : ''
              }
              ${
                turn.role === 'ai' && turn.guidingHint
                  ? `
                  <div class="bubble-guiding-hint">
                    <div class="hint-header">
                      <span class="hint-badge">💡 任務引導提示</span>
                      <span class="hint-sub">你可以這樣回覆：</span>
                    </div>
                    <div class="hint-content">
                      <span class="hint-text">&ldquo;${this.escapeHtml(turn.guidingHint)}&rdquo;</span>
                      <div class="hint-btns">
                        <button class="btn-mini-speak btn-hint-speak" data-speak="${this.escapeHtml(
                          turn.guidingHint
                        )}" title="聽示範發音">🔊 聽示範</button>
                        <button class="btn-use-hint" data-hint="${this.escapeHtml(
                          turn.guidingHint
                        )}" title="帶入下方輸入框">帶入句子 ✍️</button>
                      </div>
                    </div>
                  </div>
                  `
                  : ''
              }
            </div>
          </div>
        `;
        })
        .join('');

      box.querySelectorAll('.btn-mini-speak').forEach((btn) => {
        btn.addEventListener('click', () => {
          speakWithBrowserTTS(btn.dataset.speak, null, null, {
            apiKey: this.apiKey,
            aiVoice: this.selectedScenario?.aiVoice
          });
        });
      });

      box.querySelectorAll('.btn-use-hint').forEach((btn) => {
        btn.addEventListener('click', () => {
          const hint = btn.dataset.hint;
          const input = document.getElementById('studio-text-input');
          if (input && hint) {
            input.value = hint;
            input.focus();
            this.showToast('💡 已為你帶入引導句型，可直接發送或依情境微調！');
          }
        });
      });

      box.querySelectorAll('.btn-mini-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.turnIdx);
          const turn = this.transcriptTurns[idx];
          if (!turn) return;
          const edited = window.prompt('微調語音辨識的原句文字：', turn.text);
          if (edited !== null && edited.trim()) {
            turn.text = edited.trim();
            this.renderTranscriptStream();
            this.updateMissionCheckboxesFromTranscript();
            this.showToast('✅ 已更新原句內容，評估報告將以此句為準！');
          }
        });
      });

      box.scrollTop = box.scrollHeight;
    }

    highlightFillerWordsInHtml(text) {
      let safe = this.escapeHtml(text);
      FILLER_WORDS.forEach((filler) => {
        const regex = new RegExp(`\\b(${filler})\\b`, 'gi');
        safe = safe.replace(regex, '<mark class="filler-highlight" title="口語贅字">$1</mark>');
      });
      return safe;
    }

    analyzeUserSpeechMetrics(newSentence) {
      const words = newSentence
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      this.totalUserWords += words.length;

      const now = Date.now();
      const elapsedMs = this.userSpeakingStartMs
        ? Math.min(Math.max(now - this.userSpeakingStartMs, words.length * 400), 18000)
        : words.length * 450;
      this.totalUserSpeakingMs += elapsedMs;
      this.userSpeakingStartMs = null;

      const lower = newSentence.toLowerCase();
      FILLER_WORDS.forEach((filler) => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const matches = lower.match(regex);
        if (matches && matches.length > 0) {
          this.fillerCounts[filler] = (this.fillerCounts[filler] || 0) + matches.length;
          this.totalFillers += matches.length;
        }
      });

      const minutes = Math.max(this.totalUserSpeakingMs / 60000, 0.08);
      const wpm = Math.min(Math.round(this.totalUserWords / minutes), 200);

      const wpmValueEl = document.getElementById('hud-wpm-value');
      const wpmAdviceEl = document.getElementById('hud-wpm-advice');
      if (wpmValueEl) wpmValueEl.textContent = `${wpm} WPM`;

      if (wpmAdviceEl) {
        if (wpm < 85) {
          wpmAdviceEl.textContent = '語速稍慢 · 可以多練習整句連讀';
          wpmAdviceEl.className = 'hud-sub status-warn';
        } else if (wpm > 160) {
          wpmAdviceEl.textContent = '語速偏快 · 清楚發音比講得快更重要喔';
          wpmAdviceEl.className = 'hud-sub status-warn';
        } else {
          wpmAdviceEl.textContent = '✓ 很棒的自然口說語速 (90~150 WPM)';
          wpmAdviceEl.className = 'hud-sub status-good';
        }
      }

      const fillerCountEl = document.getElementById('hud-filler-count');
      const fillerListEl = document.getElementById('hud-filler-tags');
      if (fillerCountEl) fillerCountEl.textContent = `${this.totalFillers} 次`;
      if (fillerListEl) {
        const entries = Object.entries(this.fillerCounts);
        fillerListEl.innerHTML =
          entries.length === 0
            ? '<span class="filler-clean-badge">✨ 目前零贅字，講得很順暢！</span>'
            : entries
                .map(([word, count]) => `<span class="filler-tag">${word} ×${count}</span>`)
                .join('');
      }
    }

    async handleRequestRescueHint() {
      const btn = document.getElementById('get-rescue-hint-btn');
      const originalText = btn.textContent;
      btn.disabled = true;

      try {
        const hintData = await generateRealtimeHint(
          this.apiKey,
          this.selectedScenario,
          this.transcriptTurns
        );
        this.renderRescueHints(hintData);
        this.showToast('💡 已根據你目前的對話進度更新推薦回答！');
      } catch (err) {
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }

    renderRescueHints(hintData) {
      const strategyEl = document.getElementById('rescue-strategy-tip');
      const listEl = document.getElementById('rescue-options-list');
      if (strategyEl) strategyEl.textContent = hintData.strategyTipZh || '';
      if (!listEl) return;

      listEl.innerHTML = (hintData.options || [])
        .map(
          (opt) => `
        <div class="rescue-card">
          <div class="rescue-card-top">
            <span class="rescue-style-badge">${this.escapeHtml(opt.style)}</span>
            <div class="rescue-actions">
              <button class="btn-rescue-tts" data-en="${this.escapeHtml(
                opt.en
              )}" title="示範發音">🔊 聽發音</button>
              <button class="btn-rescue-use" data-en="${this.escapeHtml(
                opt.en
              )}" title="直接發送此句回應">📤 直接採用</button>
            </div>
          </div>
          <p class="rescue-en">${this.escapeHtml(opt.en)}</p>
          <p class="rescue-zh">${this.escapeHtml(opt.zh)}</p>
        </div>
      `
        )
        .join('');

      listEl.querySelectorAll('.btn-rescue-tts').forEach((btn) => {
        btn.addEventListener('click', () =>
          speakWithBrowserTTS(btn.dataset.en, null, null, {
            apiKey: this.apiKey,
            aiVoice: this.selectedScenario?.aiVoice
          })
        );
      });

      listEl.querySelectorAll('.btn-rescue-use').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.handleUserManualTextInput(btn.dataset.en);
        });
      });
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      this.audioEngine?.setMuted(this.isMuted);
      if (this.isMuted) {
        this.liveManager?.sendAudioStreamEnd();
      }
      const muteBtn = document.getElementById('toggle-mute-btn');
      if (muteBtn) {
        muteBtn.textContent = this.isMuted ? '🔇 已靜音 (點擊恢復)' : '🎙️ 麥克風開啟中';
        muteBtn.classList.toggle('muted', this.isMuted);
      }
    }

    async stopVoiceCallAndEvaluate() {
      // Flush any pending speech segments before stopping!
      if (this.pendingUserSegments.length > 0 || (this.currentInterimUserText && this.currentInterimUserText.trim())) {
        if (this.utteranceSilenceTimer) {
          clearTimeout(this.utteranceSilenceTimer);
          this.utteranceSilenceTimer = null;
        }
        const remaining = [...this.pendingUserSegments, this.currentInterimUserText]
          .filter(Boolean)
          .join(' ')
          .trim();
        this.pendingUserSegments = [];
        this.currentInterimUserText = '';
        if (remaining) {
          const polished = applyScenarioPhoneticFixes(remaining, this.selectedScenario);
          this.appendTranscriptTurn('user', polished);
          this.analyzeUserSpeechMetrics(polished);
        }
      }

      document.getElementById('live-interim-container')?.classList.add('hidden');

      if (this.callTimerInterval) {
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = null;
      }
      this.isCallActive = false;
      this.updateCallButtonsUI();

      if (this.speechRecognition) {
        try {
          this.speechRecognition.abort();
        } catch (_) {}
        this.speechRecognition = null;
      }

      this.liveManager?.close();
      this.liveManager = null;

      if (this.audioEngine) {
        const engineToStop = this.audioEngine;
        this.audioEngine = null;
        engineToStop.stop().catch(() => {});
      }

      document.getElementById('voice-orb')?.classList.remove('ai-speaking', 'user-speaking');

      const userTurns = this.transcriptTurns.filter(
        (t) => t.role === 'user' && t.text.trim().length > 0
      );

      if (userTurns.length === 0) {
        this.showToast('⚠️ 尚未錄到你的英文回答！請先開口說英文或使用下方輸入框回應至少一句話喔！');
      }

      const minutes = Math.max(this.totalUserSpeakingMs / 60000, 0.08);
      const speechMetrics = {
        wpm: userTurns.length > 0 ? Math.min(Math.round(this.totalUserWords / minutes), 195) : 0,
        totalFillers: this.totalFillers,
        fillerCounts: this.fillerCounts,
        userTurnCount: userTurns.length
      };

      this.switchView('evaluation');

      const report = window.ExecVoice.evaluateSpeakingSessionInstant(
        this.selectedScenario,
        this.transcriptTurns,
        speechMetrics
      );
      this.lastEvaluation = report;
      this.applyEvaluationRewardsToCity(report, userTurns.length);
      this.renderEvaluationReport(report, speechMetrics);
    }

    applyEvaluationRewardsToCity(report, userTurnCount) {
      const s = this.selectedScenario;
      if (!s) return;

      const score = Number(report?.overallScore || 0);
      const prevLevel = this.tycoon.buildingLevels[s.id] || 0;
      const prevBest = this.tycoon.buildingBestScores[s.id] || 0;
      const baseReward = Number(s.baseReward || 1200);

      let earnedLevel = 0;
      let earnedMoney = 0;
      let earnedRep = 0;
      let statusTitle = '';
      let statusDesc = '';

      if (userTurnCount === 0 || score === 0) {
        statusTitle = `⚠️ 「${s.buildingName || s.title}」建案尚未開工`;
        statusDesc = '本次尚未錄到你的英文回答，回到對練室開口說至少一句英文即可領取打工獎金並蓋出建築！';
      } else if (prevLevel >= 3 && score >= 85) {
        earnedLevel = 3;
        earnedMoney = Math.round(baseReward * 2.5);
        earnedRep = 40;
        statusTitle = `👑 頂級地標卓越營運！「${s.buildingName || s.title}」滿級蟬聯特優！`;
        statusDesc = '你的口語表達無懈可擊，市長特別撥發最高營運紅利金 +$' + earnedMoney.toLocaleString() + '！';
        playGameSfx('upgrade');
      } else if (score >= 85) {
        earnedLevel = 3;
        earnedMoney = Math.round(baseReward * 2.2);
        earnedRep = 50;
        statusTitle = `🏙️ 摩天大樓地標封頂！「${s.buildingName || s.title}」升級為 Lv.3 璀璨摩天大樓 (★★★)！`;
        statusDesc = '你的英語口語自然又有禮貌，市長親自頒發特優地標執照與 2.2 倍高額營建獎金！';
        playGameSfx('upgrade');
      } else if (score >= 75) {
        earnedLevel = 2;
        earnedMoney = Math.round(baseReward * 1.5);
        earnedRep = 30;
        statusTitle = `🏢 旗艦商廈擴建成功！「${s.buildingName || s.title}」升級為 Lv.2 玻璃商業大樓 (★★☆)！`;
        statusDesc = '你順利達成了多項關鍵任務，門市業績大幅成長！再挑戰 85 分以上即可升級為 Lv.3 摩天大樓地標！';
        playGameSfx('upgrade');
      } else if (score >= 60) {
        earnedLevel = 1;
        earnedMoney = baseReward;
        earnedRep = 15;
        statusTitle = `🏠 街邊門市開張！「${s.buildingName || s.title}」成功建造 Lv.1 初階職場據點 (★☆☆)！`;
        statusDesc = '恭喜完成基本職場溝通！參考下方逐句修正建議再練習一次，就能把建築升級為 Lv.2 旗艦商業大樓！';
        playGameSfx('payday');
      } else {
        earnedLevel = prevLevel;
        earnedMoney = 400;
        earnedRep = 5;
        statusTitle = `🔨 「${s.buildingName || s.title}」施工中 (獲得實習車馬費 +$400)`;
        statusDesc = '距離 60 分過關門檻只差一點點！把下方任務關鍵句唸熟後再挑戰一次即可成功蓋樓！';
      }

      const newLevel = Math.max(prevLevel, earnedLevel);
      this.tycoon.buildingLevels[s.id] = newLevel;
      this.tycoon.buildingBestScores[s.id] = Math.max(prevBest, score);
      this.tycoon.money += earnedMoney;
      this.tycoon.reputation += earnedRep;
      this.saveTycoonState();
      this.renderSimCityBoard();
      this.renderScenarioList();
      this.renderSelectedScenarioPreview();

      if (newLevel > prevLevel) {
        this.presence?.publishEvent(
          `🏗️ ${this.playerName} 在「${s.buildingName || s.title}」英語評鑑通過，成功升級為 Lv.${newLevel}！`
        );
      } else {
        this.presence?.publishEvent(
          `💪 ${this.playerName} 在「${s.buildingName || s.title}」完成了英語對話練習！`
        );
      }
      this.presence?.updateSelf({
        buildings: Object.values(this.tycoon.buildingLevels || {}).filter((v) => v >= 1).length
      });

      this.lastEvalRewardInfo = {
        buildingName: s.buildingName || s.title,
        buildingIcon: newLevel >= 3 ? '🏙️' : s.buildingIcon || '🏢',
        prevLevel,
        newLevel,
        earnedMoney,
        earnedRep,
        statusTitle,
        statusDesc
      };
    }

    runSampleEvaluationDemo() {
      this.selectedScenario = BUILTIN_SCENARIOS[0];
      this.resetCallMetrics();
      this.appendTranscriptTurn(
        'ai',
        this.selectedScenario.openingLine,
        this.selectedScenario.openingLineZh,
        'Hi! Yes, we have oat milk, but it costs one dollar extra. How long will it take?'
      );

      const turn1 = 'Hi! Yes we have oat milk, it is one dollar extra. Wait 3 minute please.';
      this.appendTranscriptTurn('user', turn1);
      this.analyzeUserSpeechMetrics(turn1);

      this.appendTranscriptTurn(
        'ai',
        'Awesome, three minutes is fast! Can I pay by credit card or Apple Pay?',
        '太棒了，三分鐘很快！請問我可以刷信用卡或用 Apple Pay 嗎？',
        'Yes, you can pay with credit card or Apple Pay!'
      );

      const turn2 = 'Um, yes you can use Apple Pay here. Thank you!';
      this.appendTranscriptTurn('user', turn2);
      this.analyzeUserSpeechMetrics(turn2);

      const speechMetrics = {
        wpm: 112,
        totalFillers: this.totalFillers,
        fillerCounts: this.fillerCounts,
        userTurnCount: 2
      };

      this.switchView('evaluation');
      const report = window.ExecVoice.evaluateSpeakingSessionInstant(
        this.selectedScenario,
        this.transcriptTurns,
        speechMetrics
      );
      this.lastEvaluation = report;
      this.applyEvaluationRewardsToCity(report, 2);
      this.renderEvaluationReport(report, speechMetrics);
    }

    renderEvaluationReport(report, speechMetrics) {
      const container = document.getElementById('evaluation-report-content');
      if (!container) return;

      const dims = report.dimensions;
      const radarSvg = this.buildRadarChartSVG([
        { label: '流暢度與語速', score: dims.fluency.score },
        { label: '文法與用字', score: dims.grammarVocab.score },
        { label: '禮貌與職場態度', score: dims.professionalTone.score },
        { label: '表達完整度', score: dims.persuasiveness.score },
        { label: '任務達成度', score: dims.missionCompletion.score }
      ]);

      const rw = this.lastEvalRewardInfo || {
        buildingName: this.selectedScenario.buildingName || this.selectedScenario.title,
        buildingIcon: this.selectedScenario.buildingIcon || '🏢',
        newLevel: this.tycoon.buildingLevels[this.selectedScenario.id] || 0,
        earnedMoney: 0,
        earnedRep: 0,
        statusTitle: '模擬城市建案驗收報告',
        statusDesc: ''
      };

      container.innerHTML = `
        <div class="simcity-eval-reward-banner">
          <div class="reward-banner-left">
            <div class="reward-building-badge">${rw.buildingIcon}</div>
            <div>
              <h3>${this.escapeHtml(rw.statusTitle)}</h3>
              <p>${this.escapeHtml(rw.statusDesc)}</p>
            </div>
          </div>
          <div class="reward-pills-group">
            <div class="reward-gain-pill">
              <span>本次獲得資金</span>
              <strong>+$${Number(rw.earnedMoney || 0).toLocaleString()}</strong>
            </div>
            <div class="reward-gain-pill">
              <span>城市聲望提升</span>
              <strong>+${rw.earnedRep || 0} pt</strong>
            </div>
            <div class="reward-gain-pill">
              <span>當前建築等級</span>
              <strong>Lv.${rw.newLevel} ${'★'.repeat(rw.newLevel)}${'☆'.repeat(Math.max(0, 3 - rw.newLevel))}</strong>
            </div>
          </div>
        </div>

        <div class="eval-top-grid">
          <div class="eval-card eval-summary-card">
            <div class="eval-score-header">
              <div class="score-circle">
                <span class="score-number">${report.overallScore}</span>
                <span class="score-max">/ 100</span>
              </div>
              <div class="score-meta">
                <span class="cefr-badge">口語程度評定：${this.escapeHtml(report.cefrLevel)}</span>
                <h2>${this.escapeHtml(this.selectedScenario.title)}</h2>
                <p class="eval-role-subtitle">你的角色：${this.escapeHtml(
                  this.selectedScenario.userRole
                )} ｜ 對練對象：${this.escapeHtml(this.selectedScenario.aiName)}</p>
              </div>
            </div>
            <div class="executive-summary-box">
              <h4>📋 老師講評與真實表現分析</h4>
              <p>${this.escapeHtml(report.executiveSummaryZh)}</p>
            </div>
            <div class="speech-stats-strip">
              <div class="stat-pill-box">
                <span class="stat-label">平均語速</span>
                <strong class="stat-val">${speechMetrics.wpm} WPM</strong>
              </div>
              <div class="stat-pill-box">
                <span class="stat-label">口語贅字數</span>
                <strong class="stat-val">${speechMetrics.totalFillers} 次</strong>
              </div>
              <div class="stat-pill-box">
                <span class="stat-label">你的發言輪數</span>
                <strong class="stat-val">${speechMetrics.userTurnCount} 輪</strong>
              </div>
            </div>
          </div>

          <div class="eval-card eval-radar-card">
            <h3>📊 五維度口語能力雷達圖</h3>
            <div class="radar-svg-wrapper">
              ${radarSvg}
            </div>
          </div>
        </div>

        <div class="eval-card">
          <h3>🎯 五大評估維度詳細解析</h3>
          <div class="dimension-bars-grid">
            ${this.renderDimensionItem('流暢度與語速 (Fluency & Pacing)', dims.fluency)}
            ${this.renderDimensionItem('文法與用字正確度 (Grammar & Vocabulary)', dims.grammarVocab)}
            ${this.renderDimensionItem('禮貌與職場態度 (Politeness & Attitude)', dims.professionalTone)}
            ${this.renderDimensionItem('句子完整度與連接詞 (Completeness & Logic)', dims.persuasiveness)}
            ${this.renderDimensionItem('情境任務達成度 (Mission Completion)', dims.missionCompletion)}
          </div>
        </div>

        <div class="eval-card">
          <h3>✅ 情境過關任務檢核表（根據你實際說出的關鍵字判定）</h3>
          <div class="objective-eval-list">
            ${(report.objectiveResults || [])
              .map(
                (item) => `
              <div class="objective-eval-row">
                <span class="obj-status-badge status-${
                  item.status === '達成' ? 'pass' : item.status === '部分達成' ? 'partial' : 'miss'
                }">
                  ${this.escapeHtml(item.status)}
                </span>
                <div class="obj-eval-body">
                  <strong>${this.escapeHtml(item.objective)}</strong>
                  <p>${this.escapeHtml(item.feedbackZh)}</p>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="eval-card">
          <h3>✨ 針對「你剛才實際說的每一句話」逐句批改與升級建議</h3>
          ${
            (report.sentenceUpgrades || []).length === 0
              ? `<p style="color: var(--text-muted);">本次對練尚未錄到你的英文句子，請回到「2. 真人即時語音對練室」開口說英文或用下方文字框輸入後再行評估！</p>`
              : `<div class="sentence-upgrades-list">
            ${(report.sentenceUpgrades || [])
              .map(
                (u) => `
              <div class="upgrade-comparison-card">
                <div class="upgrade-original">
                  <span class="tag-original">🗣️ 你剛才說的原話 (Your Exact Words)</span>
                  <p class="original-en">"${this.escapeHtml(u.originalEn)}"</p>
                  <p class="issue-zh">💡 文法與表達診斷：${this.escapeHtml(u.issueZh)}</p>
                </div>
                <div class="upgrade-options-grid">
                  <div class="upgrade-box box-natural">
                    <div class="upgrade-box-header">
                      <span class="tag-natural">✅ 自然完整的修正句 (Natural Correction)</span>
                      <button class="btn-tts-upgrade" data-tts="${this.escapeHtml(
                        u.naturalBusinessEn
                      )}">🔊 聽發音</button>
                    </div>
                    <p class="upgraded-en">"${this.escapeHtml(u.naturalBusinessEn)}"</p>
                  </div>
                  <div class="upgrade-box box-executive">
                    <div class="upgrade-box-header">
                      <span class="tag-executive">🌟 禮貌加分職場說法 (Polite Workplace Upgrade)</span>
                      <button class="btn-tts-upgrade" data-tts="${this.escapeHtml(
                        u.executiveHighEqEn
                      )}">🔊 聽發音</button>
                    </div>
                    <p class="upgraded-en">"${this.escapeHtml(u.executiveHighEqEn)}"</p>
                  </div>
                </div>
                <div class="upgrade-takeaway">
                  <strong>🔑 學習重點：</strong>${this.escapeHtml(u.keyTakeawayZh)}
                </div>
              </div>
            `
              )
              .join('')}
          </div>`
          }
        </div>

        <div class="eval-card">
          <h3>📚 本情境必學高中職場實用句型</h3>
          <div class="vocab-cards-grid">
            ${(report.recommendedVocab || [])
              .map(
                (v) => `
              <div class="vocab-item-card">
                <div class="vocab-top">
                  <strong>${this.escapeHtml(v.term)}</strong>
                  <button class="btn-tts-upgrade" data-tts="${this.escapeHtml(v.exampleEn)}">🔊</button>
                </div>
                <p class="vocab-zh">${this.escapeHtml(v.meaningZh)}</p>
                <p class="vocab-ex">"${this.escapeHtml(v.exampleEn)}"</p>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('.btn-tts-upgrade').forEach((btn) => {
        btn.addEventListener('click', () =>
          speakWithBrowserTTS(btn.dataset.tts, null, null, {
            apiKey: this.apiKey,
            aiVoice: this.selectedScenario?.aiVoice
          })
        );
      });
    }

    renderDimensionItem(title, dimObj) {
      const score = dimObj?.score ?? 0;
      return `
        <div class="dim-item">
          <div class="dim-item-top">
            <strong>${this.escapeHtml(title)}</strong>
            <span class="dim-score-badge">${score} / 100</span>
          </div>
          <div class="dim-progress-track">
            <div class="dim-progress-fill" style="width: ${score}%"></div>
          </div>
          <p class="dim-comment">${this.escapeHtml(dimObj?.commentZh || '')}</p>
        </div>
      `;
    }

    buildRadarChartSVG(metrics) {
      const size = 300;
      const center = size / 2;
      const radius = 100;
      const count = metrics.length;

      const getPoint = (index, valueRatio) => {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const r = radius * valueRatio;
        return {
          x: center + r * Math.cos(angle),
          y: center + r * Math.sin(angle)
        };
      };

      const gridPolygons = [0.2, 0.4, 0.6, 0.8, 1.0]
        .map((ratio) => {
          const pts = metrics
            .map((_, i) => {
              const p = getPoint(i, ratio);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return `<polygon points="${pts}" class="radar-grid-ring" />`;
        })
        .join('');

      const axes = metrics
        .map((_, i) => {
          const p = getPoint(i, 1.0);
          return `<line x1="${center}" y1="${center}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(
            1
          )}" class="radar-axis" />`;
        })
        .join('');

      const dataPoints = metrics
        .map((m, i) => {
          const ratio = Math.max(0.06, Math.min(1, (m.score || 0) / 100));
          const p = getPoint(i, ratio);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ');

      const dotsAndLabels = metrics
        .map((m, i) => {
          const ratio = Math.max(0.06, Math.min(1, (m.score || 0) / 100));
          const dotPt = getPoint(i, ratio);
          const labelPt = getPoint(i, 1.27);
          return `
          <circle cx="${dotPt.x.toFixed(1)}" cy="${dotPt.y.toFixed(1)}" r="4.5" class="radar-dot" />
          <text x="${labelPt.x.toFixed(1)}" y="${labelPt.y.toFixed(
            1
          )}" text-anchor="middle" dominant-baseline="middle" class="radar-label">
            ${this.escapeHtml(m.label)} (${m.score})
          </text>
        `;
        })
        .join('');

      return `
        <svg viewBox="0 0 ${size} ${size}" class="radar-svg">
          ${gridPolygons}
          ${axes}
          <polygon points="${dataPoints}" class="radar-data-area" />
          ${dotsAndLabels}
        </svg>
      `;
    }

    updateVisualizerUI(micLevel, aiLevel, micSpectrum, aiSpectrum) {
      const orb = document.getElementById('voice-orb');
      const activeLevel = Math.max(micLevel, aiLevel);
      if (orb) {
        const scale = 1 + activeLevel * 0.45;
        orb.style.transform = `scale(${scale.toFixed(3)})`;
        orb.classList.toggle('user-speaking', micLevel > 0.06 && !this.audioEngine?.aiSpeaking);
      }

      const bars = document.querySelectorAll('.spectrum-bar');
      const activeSpectrum = this.audioEngine?.aiSpeaking ? aiSpectrum : micSpectrum;
      bars.forEach((bar, idx) => {
        const val = activeSpectrum?.[idx] || 0;
        const heightPx = Math.max(6, Math.round((val / 255) * 48));
        bar.style.height = `${heightPx}px`;
      });
    }

    updateCallTimerUI() {
      if (!this.callStartTime) return;
      const elapsedSec = Math.floor((Date.now() - this.callStartTime) / 1000);
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      const timerEl = document.getElementById('call-timer');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }

    updateCallButtonsUI() {
      const toggleBtn = document.getElementById('toggle-call-btn');
      const muteBtn = document.getElementById('toggle-mute-btn');
      const evalBtn = document.getElementById('end-and-evaluate-btn');
      const userTurnCount = this.transcriptTurns.filter((t) => t.role === 'user').length;

      if (toggleBtn) {
        toggleBtn.textContent = this.isCallActive
          ? '⏹️ 結束通話並查看真實評估'
          : '🎙️ 開始真人語音對練';
        toggleBtn.className = this.isCallActive ? 'btn-danger-large' : 'btn-primary-large';
      }
      if (muteBtn) {
        muteBtn.disabled = !this.isCallActive;
      }
      if (evalBtn) {
        evalBtn.disabled = !this.isCallActive && userTurnCount === 0;
      }
    }

    resetCallMetrics() {
      if (this.utteranceSilenceTimer) {
        clearTimeout(this.utteranceSilenceTimer);
        this.utteranceSilenceTimer = null;
      }
      this.pendingUserSegments = [];
      this.transcriptTurns = [];
      this.currentInterimUserText = '';
      this.currentAiTurnBuffer = '';
      this.userSpeakingStartMs = null;
      this.totalUserSpeakingMs = 0;
      this.totalUserWords = 0;
      this.fillerCounts = {};
      this.totalFillers = 0;
      this.renderTranscriptStream();

      document.getElementById('live-interim-container')?.classList.add('hidden');
      document.getElementById('hud-wpm-value').textContent = '-- WPM';
      document.getElementById('hud-wpm-advice').textContent = '開口說話後自動計算語速';
      document.getElementById('hud-filler-count').textContent = '0 次';
      document.getElementById('hud-filler-tags').innerHTML =
        '<span class="filler-clean-badge">尚未偵測到口語贅字</span>';
      document.getElementById('call-timer').textContent = '00:00';
    }

    showToast(message) {
      const toast = document.getElementById('app-toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.remove('hidden');
      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 4200);
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  function bootstrap() {
    if (!window.app) {
      window.app = new WorkplaceEnglishApp();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
