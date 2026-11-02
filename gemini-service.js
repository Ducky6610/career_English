(function () {
  window.ExecVoice = window.ExecVoice || {};

  function buildRoleplaySystemInstruction(scenario) {
    return `You are roleplaying a friendly, realistic workplace / part-time job / internship conversation in English with a HIGH SCHOOL STUDENT (CEFR A2 to B1 level).

CHARACTER PROFILE:
- Your Name: ${scenario.aiName}
- Your Role: ${scenario.aiRole}
- Your Personality: ${scenario.aiPersonality}
- Student's Role: ${scenario.userRole}

SCENARIO BACKGROUND:
${scenario.background}

STUDENT'S 3 MISSION OBJECTIVES:
${scenario.objectives.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n')}

OPENING LINE TO START WITH:
"${scenario.openingLine}"

HIGH-SCHOOL ROLEPLAY RULES:
1. Stay in character as ${scenario.aiName} (${scenario.aiRole}). Use clear, natural, everyday workplace English suitable for a high school student (CEFR A2-B1). Avoid overly complex corporate jargon.
2. Keep each spoken response short and clear (1 to 2 sentences max, around 15-25 words) so the high school student can easily understand and reply.
3. Listen carefully to what the student actually says! If they haven't completed one of their 3 mission objectives yet, naturally ask a follow-up question that guides them toward the next objective.
4. Be encouraging and realistic. Start immediately by speaking your opening line.`;
  }

  /**
   * Native WebSocket client for Gemini 3.8 Live API (`gemini-3.8-live` / `gemini-3.8-live-extended-thinking`)
   */
  class GeminiLiveSessionManager {
    constructor({
      apiKey,
      model = 'gemini-3.8-live',
      scenario,
      onAudioChunk,
      onUserTranscript,
      onAiTranscript,
      onTurnComplete,
      onInterrupted,
      onStatusChange,
      onError
    }) {
      this.apiKey = apiKey;
      this.model = model;
      this.scenario = scenario;
      this.onAudioChunk = onAudioChunk;
      this.onUserTranscript = onUserTranscript;
      this.onAiTranscript = onAiTranscript;
      this.onTurnComplete = onTurnComplete;
      this.onInterrupted = onInterrupted;
      this.onStatusChange = onStatusChange;
      this.onError = onError;

      this.ws = null;
      this.isConnected = false;
      this.setupComplete = false;
    }

    async connect() {
      this.onStatusChange?.('connecting');

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
        this.apiKey
      )}`;

      return new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket(wsUrl);
        } catch (err) {
          this.onError?.(err.message || 'WebSocket 建立失敗');
          reject(err);
          return;
        }

        this.ws.onopen = () => {
          this.isConnected = true;

          const setupPayload = {
            setup: {
              model: `models/${this.model}`,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: this.scenario.aiVoice || 'Aoede'
                    }
                  }
                }
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: {
                parts: [{ text: buildRoleplaySystemInstruction(this.scenario) }]
              }
            }
          };

          if (this.model === 'gemini-3.8-live-extended-thinking') {
            setupPayload.setup.generationConfig.thinkingConfig = {
              thinkingLevel: 'low'
            };
          }

          this.ws.send(JSON.stringify(setupPayload));
          this.onStatusChange?.('connected');
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            let rawText = event.data;
            if (rawText instanceof Blob) {
              rawText = await rawText.text();
            }
            const response = JSON.parse(rawText);
            this.handleServerMessage(response);
          } catch (parseErr) {
            console.warn('Failed to parse Live API message:', parseErr);
          }
        };

        this.ws.onerror = (err) => {
          console.error('Gemini Live WebSocket Error:', err);
          this.onError?.('Gemini Live API 連線異常，已切換為智慧語音對練');
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.setupComplete = false;
          this.onStatusChange?.('disconnected', event?.reason);
        };
      });
    }

    handleServerMessage(response) {
      if (response.setupComplete !== undefined && !this.setupComplete) {
        this.setupComplete = true;
        this.sendTextMessage(
          `Please start the roleplay now by speaking your opening line as ${this.scenario.aiName}.`
        );
        return;
      }

      const content = response.serverContent;
      if (content) {
        if (content.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data) {
              this.onAudioChunk?.(part.inlineData.data);
            }
          }
        }

        if (content.inputTranscription?.text) {
          this.onUserTranscript?.(content.inputTranscription.text, true);
        }
        if (content.interimInputTranscription?.text) {
          this.onUserTranscript?.(content.interimInputTranscription.text, false);
        }
        if (content.outputTranscription?.text) {
          this.onAiTranscript?.(content.outputTranscription.text);
        }

        if (content.interrupted === true) {
          this.onInterrupted?.();
        }

        if (content.turnComplete === true) {
          this.onTurnComplete?.();
        }
      }

      if (response.interactionStatus === 'IDLE') {
        this.onTurnComplete?.();
      }
    }

    sendAudioChunk(base64Pcm) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64Pcm,
              mimeType: 'audio/pcm;rate=16000'
            }
          }
        })
      );
    }

    sendAudioStreamEnd() {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audioStreamEnd: true
          }
        })
      );
    }

    sendTextMessage(text) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            text
          }
        })
      );
    }

    close() {
      if (this.ws) {
        try {
          this.ws.close();
        } catch (_) {}
        this.ws = null;
      }
      this.isConnected = false;
      this.setupComplete = false;
    }
  }

  /**
   * Fast single-request Gemini API helper with strict AbortController timeout (default 3.5s)
   * Uses `gemini-3.5-flash-lite` for ultra-low latency so the user never waits!
   */
  async function callGeminiFastJSON({
    apiKey,
    systemInstruction,
    inputPrompt,
    schema,
    timeoutMs = 3500
  }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
        apiKey
      )}`;
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Api-Revision': '2026-05-20'
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash-lite',
          system_instruction: systemInstruction,
          input: inputPrompt,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.output_text) {
          return JSON.parse(data.output_text);
        }
        const steps = data.steps || [];
        for (let i = steps.length - 1; i >= 0; i--) {
          if (steps[i].type === 'model_output' && steps[i].content) {
            for (const c of steps[i].content) {
              if (c.text) return JSON.parse(c.text);
            }
          }
        }
      }
      throw new Error(`HTTP ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Instant High-School Scenario Generator (< 50ms local smart template + optional fast AI)
   */
  async function generateScenarioWithAI(apiKey, promptText) {
    if (!apiKey) {
      return buildHighSchoolCustomScenario(promptText);
    }

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        difficulty: { type: 'string' },
        aiName: { type: 'string' },
        aiRole: { type: 'string' },
        aiVoice: { type: 'string', enum: ['Fenrir', 'Aoede', 'Puck', 'Kore', 'Charon'] },
        aiPersonality: { type: 'string' },
        userRole: { type: 'string' },
        background: { type: 'string' },
        objectives: { type: 'array', items: { type: 'string' } },
        objectiveKeywords: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } }
        },
        openingLine: { type: 'string' },
        openingLineZh: { type: 'string' },
        suggestedPhrases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              en: { type: 'string' },
              zh: { type: 'string' }
            },
            required: ['en', 'zh']
          }
        }
      },
      required: [
        'title', 'category', 'difficulty', 'aiName', 'aiRole', 'aiVoice',
        'aiPersonality', 'userRole', 'background', 'objectives',
        'openingLine', 'openingLineZh', 'suggestedPhrases'
      ]
    };

    try {
      return await callGeminiFastJSON({
        apiKey,
        timeoutMs: 3800,
        systemInstruction:
          '你是一位專門指導台灣高中生（CEFR A2~B1 程度）的英文口說老師。請根據使用者的描述，設計一個適合高中生練習的打工、實習、校園志工或基礎職場英語對話情境。英文句子請保持簡單、自然、實用（每句約 10~18 字）。',
        inputPrompt: `請為高中生設計一個職場／打工／實習英語對練情境：\n「${promptText}」`,
        schema
      });
    } catch (_) {
      return buildHighSchoolCustomScenario(promptText);
    }
  }

  /**
   * Instant Rescue Hint Generator (< 20ms)
   */
  async function generateRealtimeHint(apiKey, scenario, transcriptTurns) {
    // Always return instant contextual hints immediately so the student never waits during a live call!
    return buildContextualHintLocally(scenario, transcriptTurns);
  }

  /**
   * INSTANT (< 10ms) Speaking Evaluation Engine!
   * Directly analyzes every word and sentence the student actually spoke with zero waiting time.
   */
  function evaluateSpeakingSessionInstant(scenario, transcriptTurns, speechMetrics) {
    const userTurns = transcriptTurns.filter((t) => t.role === 'user' && t.text.trim().length > 0);

    if (userTurns.length === 0) {
      return {
        isEmptySession: true,
        overallScore: 0,
        cefrLevel: '尚未作答',
        executiveSummaryZh:
          '系統這次還沒有錄到你的英文發言喔！請回到「2. 真人即時語音對練室」，對著麥克風開口說英文（或使用下方文字框輸入你的英文回答），完成對話後再點擊評估，系統就會立即針對你真正說出的每一句話進行分析！',
        dimensions: {
          fluency: { score: 0, commentZh: '尚未偵測到英文語音或文字輸入。' },
          grammarVocab: { score: 0, commentZh: '尚未偵測到英文句子。' },
          professionalTone: { score: 0, commentZh: '尚未偵測到對話內容。' },
          persuasiveness: { score: 0, commentZh: '尚未偵測到對話內容。' },
          missionCompletion: { score: 0, commentZh: '尚未開始執行情境任務。' }
        },
        objectiveResults: scenario.objectives.map((obj) => ({
          objective: obj,
          status: '未達成',
          feedbackZh: '尚未在對話中回答此項目。'
        })),
        sentenceUpgrades: [],
        recommendedVocab: (scenario.suggestedPhrases || []).map((p, idx) => ({
          term: `本情境核心句型 ${idx + 1}`,
          meaningZh: p.zh,
          exampleEn: p.en
        }))
      };
    }

    return analyzeTranscriptLocally(scenario, transcriptTurns, speechMetrics);
  }

  /**
   * Keeps backward compatibility as an async wrapper that resolves in < 10ms
   */
  async function evaluateSpeakingSession(apiKey, scenario, transcriptTurns, speechMetrics) {
    return evaluateSpeakingSessionInstant(scenario, transcriptTurns, speechMetrics);
  }

  /**
   * Real Rule-Based Linguistic & Rubric Analyzer (`analyzeTranscriptLocally`)
   * Runs in < 5ms and inspects the exact words, grammar, politeness, length, and mission keywords spoken by the student.
   */
  function analyzeTranscriptLocally(scenario, transcriptTurns, speechMetrics) {
    const userTurns = transcriptTurns.filter((t) => t.role === 'user' && t.text.trim().length > 0);
    const allUserText = userTurns.map((t) => t.text.trim()).join(' ');
    const allUserLower = allUserText.toLowerCase();
    const words = allUserLower
      .replace(/[^a-z0-9'\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const totalWords = words.length;
    const uniqueWords = new Set(words).size;
    const avgWordsPerTurn = totalWords / Math.max(userTurns.length, 1);

    // 1. Evaluate each of the 3 Mission Objectives against the student's actual words
    const objectiveResults = scenario.objectives.map((objText, idx) => {
      const targetKeywords =
        (scenario.objectiveKeywords && scenario.objectiveKeywords[idx]) ||
        extractFallbackKeywords(objText, scenario.suggestedPhrases?.[idx]?.en || '');

      const matched = targetKeywords.filter((kw) => {
        const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
        return regex.test(allUserLower) || allUserLower.includes(kw.toLowerCase());
      });

      const samplePhrase = scenario.suggestedPhrases?.[idx]?.en || '';

      if (matched.length >= 2 || (matched.length === 1 && targetKeywords.length <= 2)) {
        return {
          objective: objText,
          status: '達成',
          feedbackZh: `做得很好！你在對話中清楚說出了關鍵字「${matched
            .slice(0, 4)
            .join(', ')}」，成功完成這項溝通目標。`
        };
      } else if (matched.length === 1) {
        return {
          objective: objText,
          status: '部分達成',
          feedbackZh: `你有提到「${matched[0]}」，但資訊還可以更完整喔！建議可以這樣補充：「${samplePhrase}」`
        };
      } else {
        return {
          objective: objText,
          status: '未達成',
          feedbackZh: `在你剛才的回答中還沒有提到這個部分喔！下次對練時可以試著說：「${samplePhrase}」`
        };
      }
    });

    const passCount = objectiveResults.filter((r) => r.status === '達成').length;
    const partialCount = objectiveResults.filter((r) => r.status === '部分達成').length;

    // 2. Calculate Mission Completion Score (0 - 100) honestly
    let missionScore = Math.round(passCount * 32 + partialCount * 18);
    if (totalWords >= 5 && missionScore === 0) missionScore = 20;
    missionScore = Math.min(98, Math.max(10, missionScore));

    // 3. Analyze Politeness & Workplace Tone markers
    const politeMarkers = [
      'please', 'thank', 'thanks', 'welcome', 'sorry', 'excuse', 'could',
      'would', 'may', 'sure', 'certainly', 'course', 'happy', 'glad', 'help', 'hi', 'hello'
    ];
    const matchedPolite = politeMarkers.filter((m) =>
      new RegExp(`\\b${m}\\b`, 'i').test(allUserLower)
    );

    let toneScore = 45 + matchedPolite.length * 11;
    if (totalWords < 5) toneScore = Math.min(toneScore, 45);
    else if (avgWordsPerTurn >= 7) toneScore += 8;
    toneScore = Math.min(96, Math.max(25, Math.round(toneScore)));

    // 4. Analyze Grammar & Vocabulary on each student turn
    let grammarPenalty = 0;
    const sentenceUpgrades = userTurns.slice(0, 5).map((turn, idx) => {
      const diag = diagnoseSingleStudentSentence(turn.text, scenario, idx);
      if (diag.hasError) grammarPenalty += 8;
      return diag;
    });

    const vocabRichnessBonus = Math.min(
      25,
      Math.round((uniqueWords / Math.max(totalWords, 1)) * 28)
    );
    const lengthScoreBase =
      totalWords < 4 ? 30 : totalWords < 10 ? 52 : totalWords < 20 ? 70 : 78;
    const grammarVocabScore = Math.min(
      95,
      Math.max(25, lengthScoreBase + vocabRichnessBonus - grammarPenalty)
    );

    // 5. Analyze Fluency & Pacing
    const wpm = speechMetrics.wpm || 100;
    const fillerRatio = (speechMetrics.totalFillers || 0) / Math.max(totalWords, 1);
    let fluencyScore = 75;
    if (totalWords < 4) {
      fluencyScore = 35;
    } else if (totalWords < 10) {
      fluencyScore = 58;
    } else {
      if (wpm >= 95 && wpm <= 155) fluencyScore = 86;
      else if (wpm >= 75 && wpm < 95) fluencyScore = 76;
      else fluencyScore = 72;
      fluencyScore -= Math.round(fillerRatio * 60);
      if (avgWordsPerTurn >= 9) fluencyScore += 6;
    }
    fluencyScore = Math.min(96, Math.max(25, fluencyScore));

    // 6. Analyze Completeness & Logic (Persuasiveness)
    const connectors = [
      'because', 'so', 'and', 'but', 'if', 'when', 'already', 'also', 'then', 'after', 'first'
    ];
    const matchedConnectors = connectors.filter((c) =>
      new RegExp(`\\b${c}\\b`, 'i').test(allUserLower)
    );
    let logicScore =
      (totalWords < 5 ? 32 : totalWords < 12 ? 55 : 70) +
      matchedConnectors.length * 7 +
      (userTurns.length >= 2 ? 8 : 0);
    logicScore = Math.min(95, Math.max(25, Math.round(logicScore)));

    // Overall Score weighted average
    const overallScore = Math.round(
      missionScore * 0.3 +
        fluencyScore * 0.2 +
        grammarVocabScore * 0.2 +
        toneScore * 0.15 +
        logicScore * 0.15
    );

    let cefrLevel = 'A1+ (初學起步)';
    if (overallScore >= 85) cefrLevel = 'B1+ (高中進階實戰級)';
    else if (overallScore >= 72) cefrLevel = 'B1 (高中良好溝通級)';
    else if (overallScore >= 58) cefrLevel = 'A2+ (高中基礎應用級)';
    else if (overallScore >= 42) cefrLevel = 'A2 (基礎日常會話級)';

    let summaryZh = `在這次「${scenario.title}」練習中，你總共發言了 ${userTurns.length} 輪（共 ${totalWords} 個英文單字，使用了 ${uniqueWords} 個不重複詞彙）。`;
    if (totalWords < 6) {
      summaryZh += `你這次說的字數比較少（"${allUserText}"），在職場或打工情境中，建議盡量用「完整句子（主詞＋動詞）」來回答對方喔！`;
    } else if (passCount === scenario.objectives.length) {
      summaryZh += `太棒了！你成功達成了全部 ${scenario.objectives.length} 項情境任務目標，且使用了 ${
        matchedPolite.length > 0
          ? `"${matchedPolite.slice(0, 3).join(', ')}" 等禮貌用語`
          : '清楚的英文表達'
      }。可參考下方的「禮貌加分職場說法」讓語氣更道地！`;
    } else {
      summaryZh += `你已經完成了 ${passCount} 項完整目標與 ${partialCount} 項部分目標。${
        matchedPolite.length > 0
          ? `很棒的是你有使用 "${matchedPolite.slice(0, 3).join(', ')}" 展現禮貌態度！`
          : '建議在對話開頭或請求時多加上 "Sure", "Please", "Could I..." 會聽起來更有禮貌喔！'
      } 下方已針對你剛才說的每一句話完成專屬批改。`;
    }

    return {
      overallScore,
      cefrLevel,
      executiveSummaryZh: summaryZh,
      dimensions: {
        fluency: {
          score: fluencyScore,
          commentZh:
            totalWords < 6
              ? `本次僅說了 ${totalWords} 個單字，字數偏少；建議每次回答至少說 1~2 個完整句子（約 8~15 個字）。`
              : `平均每輪發言約 ${Math.round(avgWordsPerTurn)} 個字，語速約 ${wpm} WPM，贅字 ${
                  speechMetrics.totalFillers || 0
                } 次，節奏${wpm >= 90 && wpm <= 160 ? '自然穩定' : '可再稍微調整'}。`
        },
        grammarVocab: {
          score: grammarVocabScore,
          commentZh:
            grammarPenalty > 0
              ? `共使用了 ${uniqueWords} 個不同單字，系統在你的句子中發現了幾個小文法或單複數細節可以微調（請見下方逐句診斷）。`
              : `共使用了 ${uniqueWords} 個不同單字，基本句型結構清楚易懂！`
        },
        professionalTone: {
          score: toneScore,
          commentZh:
            matchedPolite.length > 0
              ? `很棒！你在對話中自然使用了 "${matchedPolite.join(', ')}" 等禮貌字眼，給人親切友善的印象。`
              : `語氣較為簡短直接，建議在職場與打工情境多加上 "Sure!", "Please", "Could you..." 或 "Thank you!"。`
        },
        persuasiveness: {
          score: logicScore,
          commentZh:
            matchedConnectors.length > 0
              ? `有善用 "${matchedConnectors.join(', ')}" 等連接詞來串聯句子，讓對方很容易聽懂你的原因與想法！`
              : `建議可以使用 "because", "so", "and", "also" 等連接詞，把原因跟解決方法連成完整的句子。`
        },
        missionCompletion: {
          score: missionScore,
          commentZh: `在 3 個情境過關任務中，你達成了 ${passCount} 個、部分達成 ${partialCount} 個（詳見下方任務檢核表）。`
        }
      },
      objectiveResults,
      sentenceUpgrades,
      recommendedVocab: (scenario.suggestedPhrases || []).map((p, i) => ({
        term: `實用句型 ${i + 1}`,
        meaningZh: p.zh,
        exampleEn: p.en
      }))
    };
  }

  function diagnoseSingleStudentSentence(rawText, scenario, turnIdx) {
    const text = rawText.trim();
    const lower = text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    const issues = [];
    let corrected = text;
    let hasError = false;

    // Check 1: Number + singular countable noun (e.g., "3 minute", "10 minute", "2 day", "5 dollar")
    const singularAfterNum =
      /\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(minute|hour|day|week|dollar|year|person|cup|question)\b/i;
    const matchNum = text.match(singularAfterNum);
    if (matchNum && matchNum[1] !== '1') {
      hasError = true;
      const noun = matchNum[2].toLowerCase();
      const plural = noun === 'person' ? 'people' : `${noun}s`;
      issues.push(
        `數量詞 "${matchNum[1]}" 後面的可數名詞 "${matchNum[2]}" 記得要加複數變成 "${plural}" 喔！`
      );
      corrected = corrected.replace(singularAfterNum, `${matchNum[1]} ${plural}`);
    }

    // Check 2: Common high-school grammar patterns
    if (/\bi is\b/i.test(lower)) {
      hasError = true;
      issues.push('主詞 "I" 後面的 be 動詞要用 "am" 而不是 "is"。');
      corrected = corrected.replace(/\bi is\b/gi, 'I am');
    }
    if (/\b(he|she|it) have\b/i.test(lower)) {
      hasError = true;
      issues.push('第三人稱單數（he / she / it）後面的動詞要用 "has"。');
      corrected = corrected.replace(/\b(he|she|it) have\b/gi, '$1 has');
    }
    if (/\bcan to\b/i.test(lower)) {
      hasError = true;
      issues.push('助動詞 "can" 後面直接加原形動詞即可，不需要加 "to"。');
      corrected = corrected.replace(/\bcan to\b/gi, 'can');
    }
    if (/\bvery like\b/i.test(lower)) {
      hasError = true;
      issues.push('英文不能直接說 "very like"，要說 "really like" 或 "like ... very much"！');
      corrected = corrected.replace(/\bvery like\b/gi, 'really like');
    }
    if (/\bno have\b/i.test(lower)) {
      hasError = true;
      issues.push('表達「沒有」時，要用助動詞 "don\'t have"，不能直接說 "no have"。');
      corrected = corrected.replace(/\bno have\b/gi, "don't have");
    }
    if (/\bmore better\b/i.test(lower)) {
      hasError = true;
      issues.push('"better" 本身已經是比較級了，前面不需要再加 "more" 喔！');
      corrected = corrected.replace(/\bmore better\b/gi, 'much better');
    }

    // Check 3: Very short fragment (< 5 words)
    if (words.length < 5) {
      hasError = true;
      issues.push(
        `這句話只有 ${words.length} 個單字，比較像單字片語；在職場對話中，試著加上主詞與禮貌詞組成完整句子！`
      );
    }

    // Check 4: Politeness / capitalization polish
    if (!/\b(please|thank|thanks|sure|welcome|sorry|could|would|may|happy)\b/i.test(lower)) {
      issues.push('可以在句首或句尾加上 "Sure!", "Please" 或 "Could I..."，聽起來會更親切有禮貌。');
    }

    const matchedSuggestion = findBestMatchingSuggestion(lower, scenario, turnIdx);

    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    if (!/[.?!]$/.test(corrected)) corrected += '.';

    const naturalVersion =
      words.length < 5 ? matchedSuggestion.en : corrected !== text ? corrected : matchedSuggestion.en;

    return {
      hasError,
      originalEn: text,
      issueZh:
        issues.length > 0
          ? issues.join(' 另外，')
          : '你的句子結構很清楚！如果想讓語氣聽起來更自然、更有禮貌，可以參考右邊的加分說法：',
      naturalBusinessEn: naturalVersion,
      executiveHighEqEn: matchedSuggestion.en,
      keyTakeawayZh: `💡 實用句型解析：${matchedSuggestion.zh}`
    };
  }

  function findBestMatchingSuggestion(userLower, scenario, turnIdx) {
    const phrases = scenario.suggestedPhrases || [];
    if (phrases.length === 0) {
      return {
        en: 'Sure, I would be happy to help you with that right away!',
        zh: '沒問題，我很樂意馬上幫您處理！'
      };
    }

    if (scenario.objectiveKeywords) {
      for (let i = 0; i < scenario.objectiveKeywords.length; i++) {
        const kws = scenario.objectiveKeywords[i] || [];
        if (kws.some((k) => userLower.includes(k.toLowerCase())) && phrases[i]) {
          return phrases[i];
        }
      }
    }

    return phrases[turnIdx % phrases.length];
  }

  function extractFallbackKeywords(objText, sampleEn) {
    const stopWords = new Set([
      'the', 'and', 'for', 'you', 'your', 'with', 'that', 'this', 'are', 'can',
      'will', 'have', 'from', 'to', 'in', 'on', 'at', 'of', 'is', 'am', 'be'
    ]);
    return String(sampleEn || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));
  }

  /**
   * Smart High-School Custom Scenario Builder that tailors scenarios to common student prompts
   */
  function buildHighSchoolCustomScenario(promptText) {
    const p = String(promptText || '');

    if (p.includes('手搖') || p.includes('珍奶') || p.includes('珍珠奶茶') || p.includes('甜度') || p.includes('飲料')) {
      return {
        id: 'custom-' + Date.now(),
        title: '手搖飲店打工：幫外國觀光客推薦珍珠奶茶與確認甜度冰塊',
        category: '餐飲打工',
        difficulty: '基礎 (CEFR A2)',
        aiName: 'Lucas Brown',
        aiRole: '第一次來台灣的外國觀光客 (Tourist)',
        aiVoice: 'Puck',
        aiPersonality: '熱情好奇，想喝喝看台灣最有名的珍珠奶茶（Bubble milk tea），但不確定甜度跟冰塊怎麼選。',
        userRole: '手搖飲店工讀生 (Drink Shop Staff)',
        background:
          '你在熱門商圈的手搖飲料店打工。一位外國觀光客 Lucas 想點招牌珍珠奶茶，請熱情招呼他，並向他詢問想要什麼甜度（Sugar level，例如半糖 Half sugar）與冰塊量（Ice level，例如少冰 Less ice）。',
        objectives: [
          '熱情歡迎客人，並推薦招牌珍珠奶茶（Bubble milk tea）',
          '詢問客人想要的甜度與冰塊（例如 Half sugar, less ice）',
          '告知總金額並提醒拿好號碼牌（Receipt / Number）'
        ],
        objectiveKeywords: [
          ['welcome', 'bubble', 'boba', 'milk', 'tea', 'popular', 'recommend', 'sure'],
          ['sugar', 'sweet', 'sweetness', 'ice', 'half', 'less', 'normal', 'level'],
          ['dollar', 'dollars', 'total', 'receipt', 'number', 'ready', 'thank']
        ],
        openingLine:
          'Hi! This is my first time trying Taiwanese bubble tea! Could you recommend your most popular drink?',
        openingLineZh:
          '嗨！這是我第一次嘗試台灣手搖飲！請問你可以推薦你們最受歡迎的飲料嗎？',
        suggestedPhrases: [
          {
            en: 'Welcome! Our most popular drink is the classic brown sugar bubble milk tea.',
            zh: '歡迎光臨！我們最受歡迎的飲料是經典黑糖珍珠奶茶。'
          },
          {
            en: 'How would you like your sugar and ice level? Half sugar and less ice is very popular!',
            zh: '請問您的甜度和冰塊想要怎麼調整？半糖少冰非常受歡迎喔！'
          },
          {
            en: 'That will be sixty dollars in total. Here is your receipt and number!',
            zh: '這樣總共是 60 元。這是您的收據與取餐號碼！'
          }
        ]
      };
    }

    if (p.includes('書店') || p.includes('書局') || p.includes('小說') || p.includes('找書')) {
      return {
        id: 'custom-' + Date.now(),
        title: '書店打工：幫外國客人查詢英文小說位置與庫存',
        category: '餐飲打工',
        difficulty: '初階 (CEFR A2+)',
        aiName: 'Olivia Green',
        aiRole: '想買書的外國顧客 (Bookstore Customer)',
        aiVoice: 'Aoede',
        aiPersonality: '溫和有禮貌，想找哈利波特英文版小說（Harry Potter in English），找不到放在哪一區。',
        userRole: '書店兼職店員 (Bookstore Staff)',
        background:
          '你在大型書店打工。外國客人 Olivia 走過來詢問哪裡可以找到英文版的《哈利波特》小說。你需要幫她指引外文書區（Foreign language section）在二樓，並告訴她如果有需要可以幫她查電腦庫存。',
        objectives: [
          '禮貌回應客人，說明英文小說在二樓的外文書區',
          '主動詢問是否需要幫她用電腦查詢庫存（Check our stock）',
          '指引樓梯或電梯方向，祝她逛得愉快'
        ],
        objectiveKeywords: [
          ['english', 'section', 'floor', 'second', '2nd', 'novel', 'book', 'books'],
          ['check', 'stock', 'computer', 'system', 'find', 'look', 'help'],
          ['stairs', 'elevator', 'over there', 'right', 'left', 'thank', 'enjoy']
        ],
        openingLine:
          'Excuse me! Hi, I am looking for the Harry Potter novels in English. Could you tell me which section they are in?',
        openingLineZh:
          '不好意思！嗨，我在找英文版的《哈利波特》小說。請問你能告訴我它們在哪一區嗎？',
        suggestedPhrases: [
          {
            en: 'Sure! Our English novels are in the foreign language section on the second floor.',
            zh: '沒問題！我們的英文小說在二樓的外文書區。'
          },
          {
            en: 'Let me check our computer system for you—yes, we still have three copies in stock!',
            zh: '我幫您查一下電腦系統——有的，我們目前還有三本庫存！'
          },
          {
            en: 'You can take the escalator right over there. Please let me know if you need more help!',
            zh: '您可以搭那邊的手扶梯上樓。如果還需要幫忙請隨時告訴我！'
          }
        ]
      };
    }

    if (p.includes('請假') || p.includes('病假') || p.includes('看醫生') || p.includes('牙醫') || p.includes('不舒服')) {
      return {
        id: 'custom-' + Date.now(),
        title: '實習請假溝通：身體不舒服向實習主管禮貌請病假',
        category: '打工溝通',
        difficulty: '初階 (CEFR A2+)',
        aiName: 'Mr. Carter',
        aiRole: '部門實習主管 (Internship Supervisor)',
        aiVoice: 'Fenrir',
        aiPersonality: '關心部屬健康，只要你有提前告知並說明手邊工作交接狀況，就會爽快准假。',
        userRole: '高中暑期實習生 (Summer Intern)',
        background:
          '今天早上你發燒感冒（have a fever / bad cold），需要去看醫生（see a doctor），無法去公司實習。你打電話給主管 Mr. Carter 請一天病假（take a sick day），並向他說明你昨天已經把整理好的資料傳到雲端硬碟了。',
        objectives: [
          '禮貌向主管說明自己今天感冒發燒，需要去看醫生並請一天病假',
          '主動回報手邊的工作進度（例如檔案已經上傳到雲端資料夾）',
          '感謝主管的體諒，並承諾看完醫生後會再傳訊息回報狀況'
        ],
        objectiveKeywords: [
          ['sick', 'cold', 'fever', 'doctor', 'well', 'today', 'leave', 'off', 'sorry'],
          ['file', 'files', 'work', 'finished', 'uploaded', 'folder', 'drive', 'done'],
          ['thank', 'thanks', 'message', 'update', 'tomorrow', 'better']
        ],
        openingLine:
          'Hello? Hi there! Calling so early—is everything okay this morning?',
        openingLineZh:
          '喂？嗨！這麼早打電話來——今天早上一切都還好嗎？',
        suggestedPhrases: [
          {
            en: 'Good morning Mr. Carter. I am sorry, I have a bad cold today and need to see a doctor. Could I take a sick day?',
            zh: '卡特先生早安。很抱歉，我今天重感冒需要去看醫生，請問我可以請一天病假嗎？'
          },
          {
            en: 'I already uploaded my finished files to the shared folder last night.',
            zh: '我昨晚已經把整理完成的檔案上傳到共用資料夾了。'
          },
          {
            en: 'Thank you so much for understanding! I will text you after I see the doctor.',
            zh: '非常謝謝您的體諒！我看完醫生後會再傳訊息跟您回報。'
          }
        ]
      };
    }

    return {
      id: 'custom-' + Date.now(),
      title: promptText.slice(0, 28) || '高中生職場英語自訂練習',
      category: 'AI 生成情境',
      difficulty: '初階～中級 (CEFR A2-B1)',
      aiName: 'Alex Taylor',
      aiRole: '友善的外籍店長 / 指導員 (Supervisor)',
      aiVoice: 'Aoede',
      aiPersonality: '親切、有耐心，會用簡單清楚的英文跟你對話，並引導你把想法說完整。',
      userRole: '高中生實習生 / 工讀生 (High School Student)',
      background: `這是根據你的需求「${promptText}」設計的高中生職場英語練習情境。請用簡單、清楚、有禮貌的英文句子與對方溝通。`,
      objectives: [
        '用有禮貌的招呼語開場，並清楚說明你目前遇到的狀況或需求',
        '回答對方的問題，並提供一個具體的細節（例如時間、原因或做法）',
        '向對方表達感謝，並確認下一步該怎麼做'
      ],
      objectiveKeywords: [
        ['hi', 'hello', 'excuse', 'sorry', 'want', 'need', 'help', 'would', 'could'],
        ['because', 'time', 'day', 'minute', 'today', 'tomorrow', 'can', 'will'],
        ['thank', 'thanks', 'okay', 'sure', 'great', 'see you']
      ],
      openingLine:
        'Hi there! Thanks for coming to talk with me today. How can I help you, or what would you like to discuss?',
      openingLineZh: '嗨！謝謝你今天來找我聊聊。請問有什麼我可以幫你的，或是你想討論什麼事情呢？',
      suggestedPhrases: [
        {
          en: 'Hi Alex! Excuse me, do you have a minute? I would like to talk with you about something.',
          zh: '嗨 Alex！不好意思，請問你有空嗎？我想跟你討論一件事情。'
        },
        {
          en: 'Because of my school schedule, could we adjust the plan a little bit?',
          zh: '因為我學校課表的關係，請問我們可以稍微調整一下計畫嗎？'
        },
        {
          en: 'Thank you so much for understanding! I really appreciate your help.',
          zh: '非常謝謝你的體諒！真的很感謝你的幫忙。'
        }
      ]
    };
  }

  function buildContextualHintLocally(scenario, transcriptTurns) {
    const userTurns = transcriptTurns.filter((t) => t.role === 'user');
    const allUserLower = userTurns.map((t) => t.text.toLowerCase()).join(' ');

    let nextObjIdx = 0;
    if (scenario.objectiveKeywords) {
      for (let i = 0; i < scenario.objectiveKeywords.length; i++) {
        const kws = scenario.objectiveKeywords[i] || [];
        const hit = kws.some((k) => allUserLower.includes(k.toLowerCase()));
        if (!hit) {
          nextObjIdx = i;
          break;
        }
      }
    }

    const nextObjText = scenario.objectives[nextObjIdx] || scenario.objectives[0];

    return {
      strategyTipZh: `💡 接下來建議你試著完成這個目標：「${nextObjText}」。可以直接點擊下方句子的「🔊 聽發音」跟著唸，或點「📤 直接採用」！`,
      options: (scenario.suggestedPhrases || []).map((item, idx) => ({
        style: idx === nextObjIdx ? '⭐ 本輪最推薦回答' : `任務 ${idx + 1} 實用句`,
        en: item.en,
        zh: item.zh
      }))
    };
  }

  window.ExecVoice.GeminiLiveSessionManager = GeminiLiveSessionManager;
  window.ExecVoice.generateScenarioWithAI = generateScenarioWithAI;
  window.ExecVoice.generateRealtimeHint = generateRealtimeHint;
  window.ExecVoice.evaluateSpeakingSession = evaluateSpeakingSession;
  window.ExecVoice.evaluateSpeakingSessionInstant = evaluateSpeakingSessionInstant;
})();
