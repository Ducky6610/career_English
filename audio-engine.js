(function () {
  window.ExecVoice = window.ExecVoice || {};

  const WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.targetChunkSize = 2048;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer.push(channelData[i]);
    }
    while (this.buffer.length >= this.targetChunkSize) {
      const chunk = this.buffer.splice(0, this.targetChunkSize);
      this.port.postMessage(new Float32Array(chunk));
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

  // Novelty / robotic / non-natural voices on macOS that must NEVER be selected
  const BANNED_VOICE_NAMES = [
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
    'deranged', 'fred', 'good news', 'hysterical', 'jester', 'junior',
    'kathy', 'organ', 'pipe organ', 'princess', 'ralph', 'superstar',
    'trinoids', 'vicki', 'whisper', 'wobble', 'zarvox', 'eddy', 'flo',
    'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'meijia',
    'tingting', 'sinji'
  ];

  let cachedVoices = [];
  let activeCloudAudios = [];
  let cloudSpeechAbortId = 0;
  let simulatedVisualizerTimer = null;

  function loadVoicesAsync() {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve([]);
        return;
      }
      const existing = window.speechSynthesis.getVoices();
      if (existing && existing.length > 0) {
        cachedVoices = existing;
        resolve(existing);
        return;
      }
      let resolved = false;
      const onVoicesChanged = () => {
        if (resolved) return;
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          resolved = true;
          cachedVoices = v;
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          resolve(v);
        }
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          cachedVoices = window.speechSynthesis.getVoices() || [];
          resolve(cachedVoices);
        }
      }, 600);
    });
  }

  if ('speechSynthesis' in window) {
    loadVoicesAsync();
  }

  function isBannedVoice(voice) {
    const nameLower = (voice.name || '').toLowerCase();
    return BANNED_VOICE_NAMES.some((bad) => nameLower.includes(bad));
  }

  function getNaturalEnglishVoices(allVoices) {
    const list = allVoices && allVoices.length ? allVoices : cachedVoices;
    return list.filter((v) => {
      const lang = (v.lang || '').toLowerCase();
      if (!lang.startsWith('en')) return false;
      if (isBannedVoice(v)) return false;
      return true;
    });
  }

  function scoreVoiceQuality(voice, preferMale = false) {
    const name = (voice.name || '').toLowerCase();
    const lang = (voice.lang || '').toLowerCase();
    let score = 0;

    if (lang === 'en-us' || lang === 'en_us') score += 30;
    else if (lang === 'en-gb' || lang === 'en_gb') score += 25;
    else if (lang.startsWith('en-')) score += 15;

    // Tier 1: Cloud Neural / Google / Microsoft Online Natural voices
    if (name.includes('natural') || name.includes('online')) score += 150;
    if (name.includes('google us english')) score += 140;
    if (name.includes('google uk english')) score += 135;
    if (name.includes('ava') && (name.includes('premium') || name.includes('enhanced'))) score += 125;
    if (name.includes('samantha') && (name.includes('premium') || name.includes('enhanced'))) score += 120;
    if (name.includes('enhanced') || name.includes('premium')) score += 100;

    // Tier 2: Standard macOS human voices
    if (name.includes('samantha')) score += 75;
    if (name.includes('ava')) score += 74;
    if (name.includes('allison')) score += 72;
    if (name.includes('alex')) score += 72;
    if (name.includes('daniel')) score += 70;
    if (name.includes('karen')) score += 68;
    if (name.includes('moira')) score += 66;

    const isMaleVoice =
      name.includes('male') ||
      name.includes('guy') ||
      name.includes('ryan') ||
      name.includes('christopher') ||
      name.includes('alex') ||
      name.includes('daniel') ||
      name.includes('aaron') ||
      name.includes('rishi') ||
      name.includes('oliver') ||
      name.includes('arthur');

    const isFemaleVoice =
      name.includes('female') ||
      name.includes('google us english') ||
      name.includes('aria') ||
      name.includes('jenny') ||
      name.includes('samantha') ||
      name.includes('ava') ||
      name.includes('allison') ||
      name.includes('karen') ||
      name.includes('moira');

    if (preferMale && isMaleVoice) score += 20;
    if (!preferMale && isFemaleVoice) score += 20;

    return score;
  }

  function selectBestHumanEnglishVoice(allVoices, aiVoicePersona = 'Fenrir') {
    const englishVoices = getNaturalEnglishVoices(allVoices);
    if (englishVoices.length === 0) return null;
    const preferMale = ['Fenrir', 'Puck', 'Charon'].includes(aiVoicePersona);
    const sorted = [...englishVoices].sort(
      (a, b) => scoreVoiceQuality(b, preferMale) - scoreVoiceQuality(a, preferMale)
    );
    return sorted[0] || englishVoices[0];
  }

  /**
   * Splits a paragraph into natural sentence chunks (<= 150 chars each)
   * so cloud neural TTS streams play smoothly with natural prosody and zero cutoff.
   */
  function splitIntoSpeechChunks(text) {
    const cleaned = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];

    // Split on sentence-ending punctuation or em-dash while keeping punctuation attached
    const rawSentences = cleaned
      .replace(/([.?!])(\s+)/g, '$1|')
      .replace(/—/g, '—|')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks = [];
    for (const sentence of rawSentences) {
      if (sentence.length <= 155) {
        chunks.push(sentence);
      } else {
        // Split long sentence by comma or conjunction
        const subParts = sentence.split(/,(?=\s)/);
        let current = '';
        for (const part of subParts) {
          const candidate = current ? `${current},${part}` : part;
          if (candidate.length <= 155) {
            current = candidate;
          } else {
            if (current) chunks.push(current.trim());
            current = part.trim();
          }
        }
        if (current) chunks.push(current.trim());
      }
    }
    return chunks.length ? chunks : [cleaned];
  }

  function stopAllActiveSpeech() {
    cloudSpeechAbortId++;
    if (simulatedVisualizerTimer) {
      clearInterval(simulatedVisualizerTimer);
      simulatedVisualizerTimer = null;
    }
    for (const audioEl of activeCloudAudios) {
      try {
        audioEl.pause();
        audioEl.src = '';
      } catch (_) {}
    }
    activeCloudAudios = [];
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Animates the studio Voice Orb and Spectrum Bars while Cloud Neural TTS `<audio>` is speaking
   */
  function startSimulatedSpeechVisuals() {
    if (simulatedVisualizerTimer) clearInterval(simulatedVisualizerTimer);
    const orb = document.getElementById('voice-orb');
    orb?.classList.add('ai-speaking');

    simulatedVisualizerTimer = setInterval(() => {
      const bars = document.querySelectorAll('.spectrum-bar');
      const t = Date.now() / 110;
      let total = 0;
      bars.forEach((bar, idx) => {
        const wave =
          Math.sin(t + idx * 0.45) * 0.4 +
          Math.cos(t * 1.7 - idx * 0.3) * 0.35 +
          Math.random() * 0.25;
        const normalized = Math.max(0.12, Math.min(1, (wave + 0.8) / 1.6));
        total += normalized;
        bar.style.height = `${Math.round(6 + normalized * 40)}px`;
      });
      if (orb) {
        const avg = total / Math.max(bars.length, 1);
        orb.style.transform = `scale(${(1 + avg * 0.28).toFixed(3)})`;
      }
    }, 65);
  }

  function stopSimulatedSpeechVisuals() {
    if (simulatedVisualizerTimer) {
      clearInterval(simulatedVisualizerTimer);
      simulatedVisualizerTimer = null;
    }
    const orb = document.getElementById('voice-orb');
    if (orb) {
      orb.classList.remove('ai-speaking');
      orb.style.transform = 'scale(1)';
    }
    document.querySelectorAll('.spectrum-bar').forEach((bar) => {
      bar.style.height = '8px';
    });
  }

  /**
   * Plays natural Cloud Neural TTS using pre-buffered HTML5 Audio elements.
   * Tries primary neural voice stream, then secondary neural stream, so it always sounds like a real human!
   */
  async function speakWithCloudNeuralAudio(text, aiVoice = 'Fenrir', myAbortId) {
    const chunks = splitIntoSpeechChunks(text);
    if (chunks.length === 0) return false;

    // Select accent/timbre based on character voice persona
    const isBritishPersona = ['Charon', 'Puck'].includes(aiVoice);
    const youdaoType = isBritishPersona ? 1 : 2; // 2 = US Neural, 1 = UK Neural
    const googleTl = isBritishPersona ? 'en-GB' : 'en-US';

    // Pre-create and pre-buffer all sentence Audio elements in parallel for gapless playback
    const audioQueue = chunks.map((chunk) => {
      const primaryUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
        chunk
      )}&le=en&type=${youdaoType}`;
      const backupUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${googleTl}&q=${encodeURIComponent(
        chunk
      )}`;

      const audio = new Audio();
      audio.preload = 'auto';
      audio.referrerPolicy = 'no-referrer';
      audio.src = primaryUrl;
      audio.dataset.backupUrl = backupUrl;
      audio.load();
      return audio;
    });

    activeCloudAudios = audioQueue;
    startSimulatedSpeechVisuals();

    try {
      for (let i = 0; i < audioQueue.length; i++) {
        if (myAbortId !== cloudSpeechAbortId) return true;
        const audio = audioQueue[i];

        const playedOk = await playSingleAudioElementWithFallback(audio, myAbortId);
        if (!playedOk) {
          stopSimulatedSpeechVisuals();
          return false;
        }

        // Brief natural breath between sentences
        if (i < audioQueue.length - 1 && myAbortId === cloudSpeechAbortId) {
          await new Promise((r) => setTimeout(r, 95));
        }
      }
      stopSimulatedSpeechVisuals();
      return true;
    } catch (_) {
      stopSimulatedSpeechVisuals();
      return false;
    }
  }

  function playSingleAudioElementWithFallback(audio, myAbortId) {
    return new Promise((resolve) => {
      if (myAbortId !== cloudSpeechAbortId) {
        resolve(true);
        return;
      }

      let triedBackup = false;
      audio.playbackRate = 1.02;

      const handleSuccessEnd = () => {
        cleanup();
        resolve(true);
      };

      const handleError = () => {
        if (myAbortId !== cloudSpeechAbortId) {
          cleanup();
          resolve(true);
          return;
        }
        if (!triedBackup && audio.dataset.backupUrl) {
          triedBackup = true;
          audio.src = audio.dataset.backupUrl;
          audio.play().catch(() => {
            cleanup();
            resolve(false);
          });
        } else {
          cleanup();
          resolve(false);
        }
      };

      const cleanup = () => {
        audio.removeEventListener('ended', handleSuccessEnd);
        audio.removeEventListener('error', handleError);
      };

      audio.addEventListener('ended', handleSuccessEnd);
      audio.addEventListener('error', handleError);

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          handleError();
        });
      }
    });
  }

  /**
   * Speaks with Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) via standard CORS-enabled generateContent
   */
  async function speakWithGeminiTTS(apiKey, text, voiceName = 'Kore', myAbortId) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text }]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || 'Kore'
              }
            }
          }
        }
      })
    });

    if (!res.ok) {
      throw new Error(`TTS status ${res.status}`);
    }

    const data = await res.json();
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('No audio data returned');
    if (myAbortId !== cloudSpeechAbortId) return;

    // Convert base64 WAV to Blob URL for instant cross-browser playback
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'audio/wav' });
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);

    activeCloudAudios.push(audio);
    startSimulatedSpeechVisuals();

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(blobUrl);
        stopSimulatedSpeechVisuals();
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(blobUrl);
        stopSimulatedSpeechVisuals();
        reject(e);
      };
      audio.play().catch((err) => {
        URL.revokeObjectURL(blobUrl);
        stopSimulatedSpeechVisuals();
        reject(err);
      });
    });
  }

  /**
   * Main TTS entry point used across the entire app:
   * Priority 1: Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) if API Key is set
   * Priority 2: Curated Browser Neural Voice (instant, chunked by sentence, zero network delay)
   * Priority 3: Cloud Neural Human Audio Stream (fallback)
   */
  async function speakWithBrowserTTS(text, onStart, onEnd, options = {}) {
    stopAllActiveSpeech();
    const myAbortId = cloudSpeechAbortId;

    let apiKey = options.apiKey || '';
    if (!apiKey) {
      try {
        const stored = localStorage.getItem('workplace_english_gemini_api_key');
        if (stored && stored !== 'OFF' && stored !== 'none') {
          apiKey = stored;
        }
      } catch (_) {}
    }
    if (!apiKey && window.ExecVoice?.DEFAULT_API_KEY) {
      apiKey = window.ExecVoice.DEFAULT_API_KEY;
    }
    const aiVoice =
      options.aiVoice ||
      (window.app && window.app.selectedScenario && window.app.selectedScenario.aiVoice) ||
      'Fenrir';

    if (onStart) onStart();

    // 1. Try Gemini 3.8 Flash TTS if API key is configured
    if (apiKey) {
      try {
        await speakWithGeminiTTS(apiKey, text, aiVoice, myAbortId);
        if (myAbortId === cloudSpeechAbortId && onEnd) onEnd();
        return;
      } catch (err) {
        console.warn('Gemini 3.8 TTS fallback to Browser Speech:', err);
      }
    }

    // 2. Fast Browser SpeechSynthesis fallback
    if ('speechSynthesis' in window) {
      try {
        const voices = await loadVoicesAsync();
        const bestVoice = selectBestHumanEnglishVoice(voices, aiVoice);
        const chunks = splitIntoSpeechChunks(text);

        startSimulatedSpeechVisuals();
        for (const chunk of chunks) {
          if (myAbortId !== cloudSpeechAbortId) break;
          await new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            if (bestVoice) {
              utterance.voice = bestVoice;
              utterance.lang = bestVoice.lang || 'en-US';
            } else {
              utterance.lang = 'en-US';
            }
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          });
        }
        stopSimulatedSpeechVisuals();
        if (myAbortId === cloudSpeechAbortId && onEnd) onEnd();
        return;
      } catch (speechErr) {
        console.warn('SpeechSynthesis error:', speechErr);
      }
    }

    // 3. Fallback to Cloud Neural Audio Stream if SpeechSynthesis not available
    try {
      const cloudPlayed = await speakWithCloudNeuralAudio(text, aiVoice, myAbortId);
      if (cloudPlayed) {
        if (myAbortId === cloudSpeechAbortId && onEnd) onEnd();
        return;
      }
    } catch (_) {}

    stopSimulatedSpeechVisuals();
    if (onEnd) onEnd();
  }

  class AudioEngine {
    constructor({ onPcmChunk, onVolumeChange, onAiSpeakingChange }) {
      this.onPcmChunk = onPcmChunk;
      this.onVolumeChange = onVolumeChange;
      this.onAiSpeakingChange = onAiSpeakingChange;

      this.captureContext = null;
      this.playbackContext = null;
      this.mediaStream = null;
      this.workletNode = null;
      this.scriptProcessor = null;
      this.micAnalyser = null;
      this.aiAnalyser = null;
      this.aiGainNode = null;

      this.scheduledSources = new Set();
      this.nextPlayTime = 0;
      this.isMuted = false;
      this.isCapturing = false;
      this.aiSpeaking = false;
      this.rafId = null;
    }

    async startCapture() {
      if (this.isCapturing) return;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.captureContext = new (window.AudioContext || window.webkitAudioContext)();

      if (this.captureContext.state === 'suspended') {
        await this.captureContext.resume();
      }

      const source = this.captureContext.createMediaStreamSource(this.mediaStream);
      this.micAnalyser = this.captureContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      source.connect(this.micAnalyser);

      try {
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await this.captureContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        this.workletNode = new AudioWorkletNode(this.captureContext, 'pcm-capture-processor');
        this.workletNode.port.onmessage = (event) => {
          if (this.isMuted || !this.isCapturing) return;
          const float32Samples = event.data;
          const resampled = this.resampleTo16kHz(float32Samples, this.captureContext.sampleRate);
          const base64Pcm = this.float32ToBase64Pcm16(resampled);
          if (this.onPcmChunk) {
            this.onPcmChunk(base64Pcm);
          }
        };
        source.connect(this.workletNode);
      } catch (_) {
        this.scriptProcessor = this.captureContext.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.onaudioprocess = (audioEvent) => {
          if (this.isMuted || !this.isCapturing) return;
          const inputData = audioEvent.inputBuffer.getChannelData(0);
          const resampled = this.resampleTo16kHz(inputData, this.captureContext.sampleRate);
          const base64Pcm = this.float32ToBase64Pcm16(resampled);
          if (this.onPcmChunk) {
            this.onPcmChunk(base64Pcm);
          }
        };
        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.captureContext.destination);
      }

      this.isCapturing = true;
      await this.ensurePlaybackContext();
      this.startLevelLoop();
    }

    async ensurePlaybackContext() {
      if (!this.playbackContext) {
        this.playbackContext = new (window.AudioContext || window.webkitAudioContext)();
        this.aiAnalyser = this.playbackContext.createAnalyser();
        this.aiAnalyser.fftSize = 256;
        this.aiGainNode = this.playbackContext.createGain();
        this.aiGainNode.connect(this.aiAnalyser);
        this.aiAnalyser.connect(this.playbackContext.destination);
      }
      if (this.playbackContext.state === 'suspended') {
        await this.playbackContext.resume();
      }
    }

    resampleTo16kHz(float32Array, inputSampleRate) {
      if (inputSampleRate === 16000) return float32Array;
      const ratio = inputSampleRate / 16000;
      const newLength = Math.round(float32Array.length / ratio);
      const result = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const idx = i * ratio;
        const low = Math.floor(idx);
        const high = Math.min(Math.ceil(idx), float32Array.length - 1);
        const weight = idx - low;
        result[i] = float32Array[low] * (1 - weight) + float32Array[high] * weight;
      }
      return result;
    }

    float32ToBase64Pcm16(float32Array) {
      const buffer = new ArrayBuffer(float32Array.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    }

    async enqueuePcm24kBase64(base64Data) {
      await this.ensurePlaybackContext();

      const binaryString = atob(base64Data);
      const byteLength = binaryString.length;
      const bytes = new Uint8Array(byteLength);
      for (let i = 0; i < byteLength; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (
        byteLength > 44 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46
      ) {
        try {
          const decodedBuffer = await this.playbackContext.decodeAudioData(bytes.buffer.slice(0));
          this.scheduleAudioBuffer(decodedBuffer);
          return;
        } catch (_) {}
      }

      const sampleCount = Math.floor(byteLength / 2);
      if (sampleCount === 0) return;

      const view = new DataView(bytes.buffer);
      const float32Samples = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const int16 = view.getInt16(i * 2, true);
        float32Samples[i] = int16 / 32768.0;
      }

      const audioBuffer = this.playbackContext.createBuffer(1, sampleCount, 24000);
      audioBuffer.getChannelData(0).set(float32Samples);
      this.scheduleAudioBuffer(audioBuffer);
    }

    scheduleAudioBuffer(audioBuffer) {
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.aiGainNode);

      const now = this.playbackContext.currentTime;
      if (this.nextPlayTime < now) {
        this.nextPlayTime = now + 0.03;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;

      this.scheduledSources.add(source);
      this.updateAiSpeakingState(true);

      source.onended = () => {
        this.scheduledSources.delete(source);
        if (this.scheduledSources.size === 0) {
          this.updateAiSpeakingState(false);
        }
      };
    }

    interruptPlayback() {
      for (const source of this.scheduledSources) {
        try {
          source.stop();
          source.disconnect();
        } catch (_) {}
      }
      this.scheduledSources.clear();
      if (this.playbackContext) {
        this.nextPlayTime = this.playbackContext.currentTime;
      }
      stopAllActiveSpeech();
      this.updateAiSpeakingState(false);
    }

    updateAiSpeakingState(speaking) {
      if (this.aiSpeaking !== speaking) {
        this.aiSpeaking = speaking;
        if (this.onAiSpeakingChange) {
          this.onAiSpeakingChange(speaking);
        }
      }
    }

    setMuted(muted) {
      this.isMuted = muted;
    }

    startLevelLoop() {
      const micData = new Uint8Array(64);
      const aiData = new Uint8Array(64);

      const tick = () => {
        if (!this.isCapturing) return;

        let micLevel = 0;
        if (this.micAnalyser && !this.isMuted) {
          this.micAnalyser.getByteFrequencyData(micData);
          let sum = 0;
          for (let i = 0; i < micData.length; i++) sum += micData[i];
          micLevel = sum / (micData.length * 255);
        }

        let aiLevel = 0;
        if (this.aiAnalyser && this.aiSpeaking) {
          this.aiAnalyser.getByteFrequencyData(aiData);
          let sum = 0;
          for (let i = 0; i < aiData.length; i++) sum += aiData[i];
          aiLevel = sum / (aiData.length * 255);
        }

        // Only update from mic/aiAnalyser when not in simulated cloud audio animation
        if (this.onVolumeChange && !simulatedVisualizerTimer) {
          this.onVolumeChange({
            micLevel,
            aiLevel,
            micSpectrum: Array.from(micData.slice(0, 24)),
            aiSpectrum: Array.from(aiData.slice(0, 24))
          });
        }

        this.rafId = requestAnimationFrame(tick);
      };

      this.rafId = requestAnimationFrame(tick);
    }

    async stop() {
      this.isCapturing = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.interruptPlayback();

      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
        this.mediaStream = null;
      }
      if (this.captureContext) {
        await this.captureContext.close().catch(() => {});
        this.captureContext = null;
      }
    }
  }

  window.ExecVoice.AudioEngine = AudioEngine;
  window.ExecVoice.speakWithBrowserTTS = speakWithBrowserTTS;
  window.ExecVoice.stopAllActiveSpeech = stopAllActiveSpeech;
})();
