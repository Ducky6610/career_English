(function () {
  window.ExecVoice = window.ExecVoice || {};

  /**
   * Every workplace building has 3 Progressive Development Stages (三階段都市建設與職涯升遷):
   * - Stage 0 -> Lv.1 (初階店面開張：目標 60 分，達成至少 1 個任務)
   * - Stage 1 -> Lv.2 (二階旗艦擴建：再次走到時先領取營運分紅，挑戰進階顧客/主管要求，目標 75 分，達成至少 2 個任務)
   * - Stage 2 -> Lv.3 (三階摩天大樓地標封頂：再次走到時領取高額分紅，挑戰滿分禮貌表達，目標 85 分，達成全部 3 個任務)
   */
  window.ExecVoice.BUILDING_STAGES_CONFIG = [
    {
      targetLevel: 1,
      stageBadge: '🔨 第一階段：初階店面開張 (Lv.0 ➔ Lv.1)',
      buildingTypeLabel: '一層街邊門市',
      minScore: 60,
      minObjectives: 1,
      arrivalRent: 0,
      clearRewardMultiplier: 1.0,
      repReward: 15,
      stageTaskHint: '開口完成基本接待與回應（總分達 60 分）即可蓋出 Lv.1 初階店面！'
    },
    {
      targetLevel: 2,
      stageBadge: '🏢 第二階段：旗艦商廈擴建 (Lv.1 ➔ Lv.2)',
      buildingTypeLabel: '中層玻璃商業大樓',
      minScore: 75,
      minObjectives: 2,
      arrivalRent: 500,
      clearRewardMultiplier: 1.5,
      repReward: 30,
      stageTaskHint: '你已擁有 Lv.1 店面！本次達成 2 項以上任務且總分達 75 分，即可擴建為 Lv.2 旗艦商業大樓！'
    },
    {
      targetLevel: 3,
      stageBadge: '🏙️ 第三階段：摩天大樓地標封頂 (Lv.2 ➔ Lv.3)',
      buildingTypeLabel: '超高層摩天輪地標塔',
      minScore: 85,
      minObjectives: 3,
      arrivalRent: 1000,
      clearRewardMultiplier: 2.2,
      repReward: 50,
      stageTaskHint: '挑戰最高等級！完整達成 3 項任務並展現禮貌職場句型（總分達 85 分），即可升級為 Lv.3 發光摩天大樓地標！'
    },
    {
      targetLevel: 3,
      stageBadge: '👑 頂級地標營運中 (Lv.3 摩天大樓滿級)',
      buildingTypeLabel: '黃金摩天大樓總部',
      minScore: 85,
      minObjectives: 3,
      arrivalRent: 1600,
      clearRewardMultiplier: 2.5,
      repReward: 40,
      stageTaskHint: '此地標已達最高等級 Lv.3！每次走到可直接領取高額地標營收分紅，再次完成對話可再領績效獎金！'
    }
  ];

  window.ExecVoice.BUILTIN_SCENARIOS = [
    {
      id: 'cafe-barista-order',
      buildingName: '星巴風陽光咖啡館',
      buildingSub: 'Starlight Roastery Cafe',
      buildingIcon: '☕',
      zoneType: 'commercial',
      zoneLabel: '🟦 商業區 · 餐飲門市',
      roofColor: '#2563eb',
      wallColorLeft: '#1d4ed8',
      wallColorRight: '#1e40af',
      baseReward: 1200,
      title: '咖啡廳打工：幫外國客人點餐與處理客製需求',
      category: '餐飲打工',
      difficulty: '基礎 (CEFR A2)',
      aiName: 'Emma Watson',
      aiRole: '趕時間的外國顧客 (Customer)',
      aiVoice: 'Aoede',
      aiPersonality: '友善但有點趕時間，想點一杯冰拿鐵並換成燕麥奶（Oat milk），想知道大概要等多久。',
      userRole: '咖啡廳工讀生 (Cafe Part-time Staff)',
      background:
        '週末下午你在模擬城市商業區的咖啡廳打工。一位外國客人走進來想點一杯大杯冰拿鐵（Large Iced Latte），但她想把牛奶換成燕麥奶，而且她 10 分鐘後要搭公車，想確認飲料能不能很快做好。',
      stageVariations: {
        2: {
          stageTitle: '【二階旗艦店擴建挑戰】尖峰時段外國熟客點餐與推薦點心',
          extraContext: '🌟 咖啡館已升上 Lv.1，客人變多了！Emma 今天再度光臨，除了點大杯燕麥奶冰拿鐵，還想確認可不可以刷 Apple Pay 快速結帳。'
        },
        3: {
          stageTitle: '【三階摩天咖啡總部封頂挑戰】VIP 外賓精緻點餐與完美禮貌服務',
          extraContext: '👑 挑戰升級為 Lv.3 摩天咖啡總部！請用最自然、有禮貌的完整句子完成點餐、換燕麥奶報價與製作時間確認。'
        }
      },
      objectives: [
        '熱情招呼客人，並重複確認她的點餐內容（大杯冰拿鐵）',
        '清楚回答可以換燕麥奶（Oat milk），並告知價格或加價資訊',
        '告訴她大約幾分鐘內可以做好（例如 3 分鐘），請她稍候'
      ],
      objectiveKeywords: [
        ['welcome', 'hi', 'hello', 'help', 'order', 'iced', 'latte', 'large', 'coffee', 'sure'],
        ['oat', 'milk', 'change', 'switch', 'extra', 'dollar', 'dollars', 'price', 'total', 'yes', 'can'],
        ['minute', 'minutes', 'wait', 'ready', 'soon', 'fast', 'quick', 'three', 'five', '3', '5', 'thank']
      ],
      openingLine:
        'Hi there! Can I get a large iced latte, please? Oh, and do you have oat milk? I have a bus to catch in ten minutes.',
      openingLineZh:
        '嗨！請給我一杯大杯冰拿鐵好嗎？喔對了，請問你們有燕麥奶嗎？我十分鐘後要趕公車。',
      suggestedPhrases: [
        {
          en: 'Welcome! Sure, one large iced latte for you.',
          zh: '歡迎光臨！沒問題，幫您準備一杯大杯冰拿鐵。'
        },
        {
          en: 'Yes, we have oat milk! It is just one dollar extra.',
          zh: '有的，我們有燕麥奶！只需要加價一塊錢。'
        },
        {
          en: 'It will be ready in about three minutes, so you will definitely catch your bus!',
          zh: '大約三分鐘就會做好了，您一定趕得上公車！'
        }
      ],
      contextualFollowUps: [
        {
          en: 'That sounds great! One dollar extra is totally fine. How long do you think it will take to make?',
          zh: '太好了！加一塊錢完全沒問題。請問你覺得大概需要做多久呢？'
        },
        {
          en: 'Awesome, three minutes is fast! Can I pay by credit card or Apple Pay?',
          zh: '太棒了，三分鐘很快！請問我可以刷信用卡或用 Apple Pay 嗎？'
        },
        {
          en: 'Thank you so much for your help! Have a great day!',
          zh: '非常謝謝你的幫忙！祝你有個美好的一天！'
        }
      ]
    },
    {
      id: 'shift-swap-request',
      buildingName: '24H 城市便利超商',
      buildingSub: 'SimMetro Mart 24H',
      buildingIcon: '🏪',
      zoneType: 'commercial',
      zoneLabel: '🟦 商業區 · 連鎖零售',
      roofColor: '#0284c7',
      wallColorLeft: '#0369a1',
      wallColorRight: '#075985',
      baseReward: 1400,
      title: '打工排班溝通：因準備學校段考向店長協調換班',
      category: '打工溝通',
      difficulty: '初階 (CEFR A2+)',
      aiName: 'Kevin Miller',
      aiRole: '外籍門市店長 (Store Manager)',
      aiVoice: 'Puck',
      aiPersonality: '親切、體諒學生課業，但需要確認那天的班有人幫忙代班（Cover the shift）才不會讓店裡人手不足。',
      userRole: '高中生兼職店員 (Part-time Student Staff)',
      background:
        '下週四（Next Thursday）你有重要的學校英文與數學段考（Midterm exams），但班表上你原本排了週三晚上的班。你想向店長 Kevin 禮貌詢問能不能把週三的班換到週六，或是請同事幫忙代班。',
      stageVariations: {
        2: {
          stageTitle: '【二階旗艦超商擴建挑戰】段考週排班協調與主動安排代班人選',
          extraContext: '🌟 超商升上 Lv.1 後生意興隆！請更完整地向店長說明段考時間，並主動告知已協調同事 Amy 代班。'
        },
        3: {
          stageTitle: '【三階超商總部封頂挑戰】高情商排班溝通與周末支援承諾',
          extraContext: '👑 挑戰升級為 Lv.3 連鎖超商總部地標！請用禮貌且完整的職場句型一次達成所有換班溝通條件。'
        }
      },
      objectives: [
        '禮貌向店長說明下週有學校段考（Midterm exam），需要調整排班',
        '明確提出想調整哪一天的班（例如把週三換到週末）',
        '主動提出解決方案（例如已經問好同事願意幫忙代班 Cover my shift）'
      ],
      objectiveKeywords: [
        ['exam', 'exams', 'test', 'school', 'study', 'midterm', 'busy', 'next week'],
        ['shift', 'schedule', 'wednesday', 'thursday', 'saturday', 'sunday', 'weekend', 'change', 'swap', 'move'],
        ['cover', 'coworker', 'colleague', 'friend', 'ask', 'asked', 'help', 'take my shift', 'already']
      ],
      openingLine:
        "Hey! I just posted next week's work schedule on the board. Does everything look okay for your shifts next week?",
      openingLineZh:
        '嘿！我剛把下週的排班表貼在佈告欄上了。你下週的班時間都還 OK 嗎？',
      suggestedPhrases: [
        {
          en: 'Hi Kevin, I actually have an important school exam next Thursday.',
          zh: '嗨 Kevin，我下週四剛好有一場很重要的學校段考。'
        },
        {
          en: 'Could I swap my Wednesday evening shift to Saturday afternoon?',
          zh: '請問我可以把週三晚上的班換到週六下午嗎？'
        },
        {
          en: 'I already asked Amy, and she said she can cover my shift on Wednesday.',
          zh: '我已經問過同事 Amy 了，她說她週三可以幫我代班。'
        }
      ],
      contextualFollowUps: [
        {
          en: 'Oh, school exams are definitely important! Which day do you need to change, and have you found anyone to cover for you?',
          zh: '喔，學校考試當然很重要！你需要改哪一天的班？有找到同事幫你代班嗎？'
        },
        {
          en: "That's super helpful that you already arranged a cover! Let me update the schedule right now. Good luck with your exam!",
          zh: '你已經先找好代班人選真的幫了大忙！我現在就更新班表。祝你考試順利！'
        }
      ]
    },
    {
      id: 'campus-event-guide',
      buildingName: '國際世貿展覽館',
      buildingSub: 'SimCity World Expo Hall',
      buildingIcon: '🏛️',
      zoneType: 'civic',
      zoneLabel: '🟩 公共文教區 · 國際展館',
      roofColor: '#059669',
      wallColorLeft: '#047857',
      wallColorRight: '#065f46',
      baseReward: 1300,
      title: '國際展覽／校園活動志工：為外賓指引方向與介紹流程',
      category: '接待志工',
      difficulty: '基礎 (CEFR A2)',
      aiName: 'Liam O’Connor',
      aiRole: '參加活動的外國訪客 (Foreign Visitor)',
      aiVoice: 'Puck',
      aiPersonality: '好奇、友善，第一次來到你們的會場，找不到報到櫃檯（Registration desk）與演講廳（Main Hall），想請你幫忙指路。',
      userRole: '活動英文接待志工 (Student Volunteer)',
      background:
        '你擔任模擬城市國際交流展的英文接待志工。一位外國訪客 Liam 剛走進大門，他想先去報到櫃檯領取名牌（Name badge），接著去二樓的主演講廳聽開幕演講。',
      stageVariations: {
        2: {
          stageTitle: '【二階國家級展館擴建挑戰】外賓報到動線指引與樓層導覽',
          extraContext: '🌟 世貿展館已升上 Lv.1，更多國際貴賓抵達！請清楚指引報到櫃檯位置與二樓演講廳路線。'
        },
        3: {
          stageTitle: '【三階世界博覽會地標封頂挑戰】首席青年外交志工全套接待',
          extraContext: '👑 挑戰升級為 Lv.3 世界博覽會摩天地標！請一次完成迎賓、報到指引、樓層路線與開幕時間提醒。'
        }
      },
      objectives: [
        '親切歡迎訪客，並指引報到櫃檯的位置（例如直走左轉）',
        '說明主演講廳在幾樓（例如搭電梯或走樓梯上二樓 Second floor）',
        '提醒開幕活動即將開始的時間（例如 10 點開始），祝他今天活動愉快'
      ],
      objectiveKeywords: [
        ['welcome', 'registration', 'desk', 'straight', 'left', 'right', 'over there', 'entrance', 'badge'],
        ['second', '2nd', 'floor', 'upstairs', 'stairs', 'elevator', 'hall', 'room'],
        ['start', 'starts', 'ten', '10', 'soon', 'enjoy', 'welcome', 'happy to help']
      ],
      openingLine:
        'Excuse me! Hi, this is my first time visiting here. Could you tell me where I can get my name badge and how to get to the Main Hall?',
      openingLineZh:
        '不好意思！嗨，這是我第一次來這裡。請問你能告訴我去哪裡領名牌，以及怎麼去主演講廳嗎？',
      suggestedPhrases: [
        {
          en: 'Welcome! You can get your name badge at the registration desk—just walk straight and turn left.',
          zh: '歡迎！您可以在報到櫃檯領取名牌——只要直走然後左轉就到了。'
        },
        {
          en: 'After that, you can take the stairs or elevator to the second floor for the Main Hall.',
          zh: '領完之後，您可以走樓梯或搭電梯到二樓，主演講廳就在那裡。'
        },
        {
          en: 'The opening speech starts at ten o’clock. Enjoy the event today!',
          zh: '開幕演講會在十點整開始。祝您今天活動愉快！'
        }
      ],
      contextualFollowUps: [
        {
          en: 'Walk straight and turn left—got it! And which floor is the Main Hall on?',
          zh: '直走左轉——收到！那請問主演講廳在幾樓呢？'
        },
        {
          en: 'Second floor, perfect! Do you know what time the opening speech starts?',
          zh: '二樓，太好了！請問你知道開幕演講幾點開始嗎？'
        },
        {
          en: 'Thanks a lot! You are a great help!',
          zh: '非常感謝！你真的幫了大忙！'
        }
      ]
    },
    {
      id: 'phone-message-taking',
      buildingName: '旭日跨國貿易大樓',
      buildingSub: 'Sunrise Global Trade Tower',
      buildingIcon: '🏢',
      zoneType: 'industrial',
      zoneLabel: '🟨 商辦園區 · 跨國企業',
      roofColor: '#d97706',
      wallColorLeft: '#b45309',
      wallColorRight: '#92400e',
      baseReward: 1500,
      title: '辦公室實習：幫正在開會的主管接電話並留口訊',
      category: '辦公室實習',
      difficulty: '初階 (CEFR A2+)',
      aiName: 'David Green',
      aiRole: '打電話來的外國客戶 (Client on the Phone)',
      aiVoice: 'Fenrir',
      aiPersonality: '有禮貌，想找你的實習主管 Mr. Lin 討論下週的參訪時間；如果主管不在，願意留下姓名與電話號碼。',
      userRole: '辦公室暑期實習生 (Office Intern)',
      background:
        '你在貿易大樓擔任暑期實習生。你的指導主管 Mr. Lin 目前正在會議室開會（in a meeting），這時桌上的電話響了，外國客戶 David 打電話來想找 Mr. Lin。你需要禮貌說明主管正在開會，並幫客戶記下姓名與聯絡電話。',
      stageVariations: {
        2: {
          stageTitle: '【二階跨國商辦擴建挑戰】獨立接聽外國客戶來電與確認回電資訊',
          extraContext: '🌟 貿易大樓已升上 Lv.1！客戶 David 再次來電確認參訪細節，請展現專業電話禮儀並完整記錄口訊。'
        },
        3: {
          stageTitle: '【三階世貿摩天塔封頂挑戰】金牌行政實習生完美商務電話接待',
          extraContext: '👑 挑戰升級為 Lv.3 跨國貿易摩天總部！請用最得體的電話英語完成說明、留口訊與回電承諾。'
        }
      },
      objectives: [
        '禮貌接聽電話，並說明 Mr. Lin 目前正在開會無法接聽',
        '主動詢問是否可以幫忙留口訊（Take a message）並請教對方姓名',
        '向對方確認聯絡電話號碼，並承諾主管開完會後會請他回電'
      ],
      objectiveKeywords: [
        ['meeting', 'busy', 'not available', 'away', 'right now', 'moment', 'sorry', 'afraid'],
        ['message', 'name', 'who', 'calling', 'spell', 'leave', 'take'],
        ['number', 'phone', 'call', 'back', 'return', 'contact', 'tell', 'let him know']
      ],
      openingLine:
        'Hello! This is David Green calling from Sunrise Trading. May I speak to Mr. Lin, please?',
      openingLineZh:
        '哈囉！我是 Sunrise Trading 的 David Green。請問我可以跟林先生通話嗎？',
      suggestedPhrases: [
        {
          en: 'Hello Mr. Green! I am sorry, Mr. Lin is in a meeting right now.',
          zh: '格林先生您好！很抱歉，林先生現在剛好在開會。'
        },
        {
          en: 'May I take a message for you, and could I have your phone number?',
          zh: '請問我可以幫您留個口訊嗎？也方便請教您的電話號碼嗎？'
        },
        {
          en: 'Got it! I will ask Mr. Lin to call you back as soon as his meeting finishes.',
          zh: '記下來了！林先生會議一結束，我就會請他立刻回電給您。'
        }
      ],
      contextualFollowUps: [
        {
          en: 'Oh, I see. Yes, please tell him David Green called, and my phone number is 555-0192.',
          zh: '喔，了解。好的，請幫我轉告他 David Green 來電，我的電話號碼是 555-0192。'
        },
        {
          en: 'Thank you so much for taking the message! Talk to you later, bye!',
          zh: '非常謝謝你幫忙留訊息！下次聊，拜拜！'
        }
      ]
    },
    {
      id: 'summer-internship-interview',
      buildingName: '矽谷新創孵化園區',
      buildingSub: 'SimValley Innovation Hub',
      buildingIcon: '🚀',
      zoneType: 'industrial',
      zoneLabel: '🟨 高科園區 · 新創總部',
      roofColor: '#ea580c',
      wallColorLeft: '#c2410c',
      wallColorRight: '#9a3412',
      baseReward: 1800,
      title: '暑期實習面試：用英文自我介紹與分享社團經驗',
      category: '實習面試',
      difficulty: '中級 (CEFR B1)',
      aiName: 'Sarah Jenkins',
      aiRole: '實習計畫招募人員 (Internship Coordinator)',
      aiVoice: 'Kore',
      aiPersonality: '溫暖、鼓勵高中生，不要求工作經驗，但想聽聽你的興趣、學校社團經驗，以及為什麼想來參加暑期實習。',
      userRole: '應徵暑期實習的高中生 (High School Applicant)',
      background:
        '你正在應徵模擬城市「矽谷新創孵化園區」的高中生暑期體驗實習（Summer Internship）。面試官 Sarah 很親切，想請你簡單自我介紹、分享一個你在學校社團或活動中學到的經驗，以及你希望在實習中學到什麼。',
      stageVariations: {
        2: {
          stageTitle: '【二階研發大樓擴建挑戰】複試面談：深入分享社團團隊合作經驗',
          extraContext: '🌟 園區已升上 Lv.1！進入第二輪面談，請具體分享你在學校社團如何與隊友合作並表達學習熱忱。'
        },
        3: {
          stageTitle: '【三階矽谷未來塔封頂挑戰】決選面試：高自信完整英語表達',
          extraContext: '👑 挑戰升級為 Lv.3 矽谷科技摩天地標！請自信流暢地完成自我介紹、社團經歷與實習目標。'
        }
      },
      objectives: [
        '簡單介紹自己的名字、年級與喜歡的科目或興趣',
        '分享一個學校社團、班級活動或團隊合作的具體經驗',
        '說明為什麼想申請這個暑期實習，或希望學到什麼新技能'
      ],
      objectiveKeywords: [
        ['name', 'student', 'high school', 'grade', 'year', 'enjoy', 'like', 'interested', 'favorite'],
        ['club', 'team', 'school', 'activity', 'event', 'project', 'member', 'leader', 'helped', 'organized'],
        ['learn', 'internship', 'experience', 'skill', 'skills', 'future', 'hope', 'want', 'grow', 'apply']
      ],
      openingLine:
        "Hi! Welcome to our summer internship interview. Please don't be nervous! First, could you introduce yourself and tell me a little bit about your favorite school club or activity?",
      openingLineZh:
        '嗨！歡迎來到我們的暑期實習面試，請放輕鬆不用緊張！首先，能請你簡單自我介紹，並聊聊你最喜歡的學校社團或活動嗎？',
      suggestedPhrases: [
        {
          en: 'Hi Sarah! I am an eleventh-grade high school student, and I really enjoy English and digital media.',
          zh: '嗨 Sarah！我是一位高二學生，我非常喜歡英文與數位媒體。'
        },
        {
          en: 'In school, I am in the photography club, where I learned how to work with teammates to organize school events.',
          zh: '在學校我參加攝影社，在社團裡我學會如何與隊友合作舉辦校園活動。'
        },
        {
          en: 'I want to join this internship to gain real-world experience and improve my communication skills.',
          zh: '我想參加這次實習，希望能累積真實職場經驗並提升我的溝通能力。'
        }
      ],
      contextualFollowUps: [
        {
          en: 'That sounds like a wonderful club experience! What is the main thing you hope to learn if you join our summer internship?',
          zh: '聽起來是很棒的社團經驗！如果你加入我們的暑期實習，你最希望學到什麼呢？'
        },
        {
          en: 'I love your enthusiasm! Do you have any questions for me about our summer internship program?',
          zh: '我很喜歡你的熱情！關於我們的暑期實習計畫，你有什麼問題想問我嗎？'
        }
      ]
    },
    {
      id: 'bubble-tea-order',
      buildingName: '珍珠奶茶台灣旗艦店',
      buildingSub: 'Formosa Boba Tea House',
      buildingIcon: '🧋',
      zoneType: 'commercial',
      zoneLabel: '🟦 商業區 · 特色茶飲',
      roofColor: '#3b82f6',
      wallColorLeft: '#2563eb',
      wallColorRight: '#1d4ed8',
      baseReward: 1300,
      title: '手搖飲店打工：向外國觀光客介紹珍珠奶茶與甜度冰塊',
      category: '餐飲打工',
      difficulty: '基礎 (CEFR A2)',
      aiName: 'Lucas Meyer',
      aiRole: '外國背包客 (Foreign Tourist)',
      aiVoice: 'Puck',
      aiPersonality: '熱情好奇，第一次喝台灣珍珠奶茶，不知道怎麼調甜度（Sugar level）跟冰塊（Ice level），想請店員推薦。',
      userRole: '手搖飲店工讀生 (Bubble Tea Staff)',
      background:
        '你在模擬城市最熱門的台灣手搖飲店打工。一位外國觀光客 Lucas 想點招牌黑糖珍珠鮮奶茶（Brown Sugar Bubble Milk Tea），但他不知道甜度和冰塊怎麼選最好喝。',
      stageVariations: {
        2: {
          stageTitle: '【二階珍奶概念店擴建挑戰】外國觀光團人氣飲品推薦與客製甜度冰塊',
          extraContext: '🌟 珍奶店已升上 Lv.1！更多外國旅客慕名而來，請流暢推薦黑糖珍珠鮮奶茶並確認半糖少冰與外帶需求。'
        },
        3: {
          stageTitle: '【三階國際茶飲摩天總部封頂挑戰】台灣之光茶飲品牌大使滿分接待',
          extraContext: '👑 挑戰升級為 Lv.3 國際茶飲摩天大樓！請一次達成飲品介紹、甜度冰塊建議與結帳外帶確認。'
        }
      },
      objectives: [
        '熱情推薦招牌珍珠奶茶（Bubble milk tea），並說明裡面的珍珠很有嚼勁',
        '詢問並建議適合的甜度與冰塊（例如半糖少冰 Half sugar, less ice）',
        '告知總金額並親切詢問要內用還是外帶（For here or to go）'
      ],
      objectiveKeywords: [
        ['welcome', 'recommend', 'popular', 'bubble', 'boba', 'milk', 'tea', 'brown sugar', 'chewy', 'sweet'],
        ['sugar', 'ice', 'half', 'less', 'normal', 'level', 'sweetness', 'fifty', 'percent'],
        ['dollar', 'dollars', 'total', 'fifty', 'sixty', 'here', 'go', 'takeout', 'bag', 'thank']
      ],
      openingLine:
        'Hi! This is my first time trying Taiwanese bubble tea! What do you recommend, and how do I choose the sugar and ice levels?',
      openingLineZh:
        '嗨！這是我第一次嘗試台灣珍珠奶茶！請問你推薦什麼？還有甜度跟冰塊該怎麼選呢？',
      suggestedPhrases: [
        {
          en: 'Welcome! Our most popular drink is the Brown Sugar Bubble Milk Tea with chewy tapioca pearls.',
          zh: '歡迎光臨！我們最受歡迎的飲料是黑糖珍珠鮮奶茶，裡面的珍珠非常有嚼勁。'
        },
        {
          en: 'I recommend half sugar and less ice—it tastes just right and not too sweet!',
          zh: '我推薦半糖少冰——喝起來剛剛好，不會太甜！'
        },
        {
          en: 'That will be sixty dollars in total. Would you like it to go?',
          zh: '這樣總共是六十元。請問您要外帶嗎？'
        }
      ],
      contextualFollowUps: [
        {
          en: 'Half sugar and less ice sounds perfect! Let’s do that. How much is it?',
          zh: '半糖少冰聽起來太完美了！就照這樣做吧。請問這樣多少錢？'
        },
        {
          en: 'Here you go! Thank you so much for your recommendation!',
          zh: '錢在這裡！非常謝謝你的推薦！'
        }
      ]
    },
    {
      id: 'intern-mentor-update',
      buildingName: '創意數位媒體大樓',
      buildingSub: 'Apex Creative Media Studio',
      buildingIcon: '🎨',
      zoneType: 'industrial',
      zoneLabel: '🟨 商辦園區 · 設計中心',
      roofColor: '#f59e0b',
      wallColorLeft: '#d97706',
      wallColorRight: '#b45309',
      baseReward: 1700,
      title: '實習生週會：向實習導師回報海報進度與請教問題',
      category: '辦公室實習',
      difficulty: '中級 (CEFR B1)',
      aiName: 'Chloe Davis',
      aiRole: '行銷部實習導師 (Marketing Mentor)',
      aiVoice: 'Aoede',
      aiPersonality: '像大姊姊一樣親切有耐心，希望實習生遇到不會的地方勇敢發問，不要自己悶著頭卡關。',
      userRole: '行銷部高中實習生 (Marketing Intern)',
      background:
        '你在創意媒體大樓的行銷部門實習，導師 Chloe 請你幫忙設計一張社群活動宣傳圖（Social media poster）。你已經完成了圖片排版，但不確定英文標語（Slogan）字體大小跟公司 Logo 要放哪個角落，需要向她回報進度並請她給建議。',
      stageVariations: {
        2: {
          stageTitle: '【二階數位媒體中心擴建挑戰】專案進度發表與跨部門設計請益',
          extraContext: '🌟 媒體大樓已升上 Lv.1！導師 Chloe 期待聽到更完整的初稿進度回報與具體的排版問題。'
        },
        3: {
          stageTitle: '【三階創意摩天塔封頂挑戰】首席青年設計師提案與專業回饋交流',
          extraContext: '👑 挑戰升級為 Lv.3 創意數位媒體摩天總部！請完整回報進度、提出 Logo 與字體疑問並禮貌請求導師 Feedback。'
        }
      },
      objectives: [
        '向導師回報目前已經完成的部分（例如已經完成第一版海報排版）',
        '清楚提出你不確定的地方（例如 Logo 位置或標題字體大小）',
        '詢問導師現在是否有空幫你看一眼並給點修改建議（Feedback）'
      ],
      objectiveKeywords: [
        ['finished', 'done', 'completed', 'poster', 'design', 'draft', 'first', 'working on'],
        ['not sure', 'question', 'logo', 'font', 'size', 'title', 'where', 'put', 'color'],
        ['look', 'check', 'feedback', 'advice', 'help', 'minute', 'time', 'show']
      ],
      openingLine:
        'Hey! How is your first week of internship going? How are you doing with the social media poster design?',
      openingLineZh:
        '嘿！你實習的第一週還適應嗎？社群活動海報的設計進度如何呢？',
      suggestedPhrases: [
        {
          en: 'Hi Chloe! I really like it here, and I just finished the first draft of the poster.',
          zh: '嗨 Chloe！我很喜歡這裡，而且我剛完成了海報的第一版初稿。'
        },
        {
          en: 'However, I am not sure where to put the company logo and if the title font is big enough.',
          zh: '不過，我不太確定公司 Logo 該放在哪個位置，以及標題字體夠不夠大。'
        },
        {
          en: 'Do you have a few minutes to take a look and give me some feedback?',
          zh: '請問妳現在有幾分鐘可以幫我看一下，給我一點修改建議嗎？'
        }
      ],
      contextualFollowUps: [
        {
          en: "Great job finishing the first draft! Are you running into any questions or anything you're unsure about?",
          zh: '完成第一版初稿太棒了！你有遇到什麼問題或是不確定的地方嗎？'
        },
        {
          en: "Of course! Let's look at your screen together—usually we put the logo in the top-right corner.",
          zh: '當然可以！我們一起來看你的螢幕吧——通常我們會把 Logo 放在右上角。'
        }
      ]
    },
    {
      id: 'bookstore-part-time',
      buildingName: '誠品風國際文化書城',
      buildingSub: 'SimCity Global Bookstore',
      buildingIcon: '📚',
      zoneType: 'civic',
      zoneLabel: '🟩 公共文教區 · 複合書城',
      roofColor: '#10b981',
      wallColorLeft: '#059669',
      wallColorRight: '#047857',
      baseReward: 1400,
      title: '書店打工：幫外國讀者查詢英文小說庫存與指引結帳',
      category: '打工溝通',
      difficulty: '初階 (CEFR A2+)',
      aiName: 'Olivia Grant',
      aiRole: '找書的外國顧客 (Bookstore Customer)',
      aiVoice: 'Kore',
      aiPersonality: '斯文有禮貌，想買一本英文旅遊書或小說當朋友的生日禮物，想知道有沒有現貨以及能不能幫忙包裝。',
      userRole: '書店兼職店員 (Bookstore Part-time Staff)',
      background:
        '你在模擬城市文化書城打工。一位外國客人 Olivia 走過來詢問是否有英文版《台灣旅遊指南（Taiwan Travel Guide）》庫存，並想知道在哪裡結帳以及有沒有禮物包裝服務。',
      stageVariations: {
        2: {
          stageTitle: '【二階文化旗艦館擴建挑戰】外文書區導覽與免費禮品包裝服務',
          extraContext: '🌟 文化書城已升上 Lv.1！請清楚幫客人查庫存、帶路到 B 區書架並介紹櫃檯免費禮物包裝。'
        },
        3: {
          stageTitle: '【三階城市文化摩天地標封頂挑戰】星級外文書店顧問完美應對',
          extraContext: '👑 挑戰升級為 Lv.3 國際文化書城摩天地標！請用自然完整的英文句子一次達成所有服務目標。'
        }
      },
      objectives: [
        '親切回應客人，表示電腦顯示目前還有庫存（In stock）',
        '指引她該書放在哪一區（例如在 B 區旅遊書架 Section B, Travel shelf）',
        '告知櫃檯可以免費幫忙禮物包裝（Free gift wrapping）'
      ],
      objectiveKeywords: [
        ['yes', 'have', 'stock', 'available', 'check', 'computer', 'copy', 'copies', 'sure'],
        ['section', 'shelf', 'aisle', 'travel', 'over there', 'right', 'left', 'follow', 'show'],
        ['gift', 'wrap', 'wrapping', 'counter', 'cashier', 'free', 'checkout', 'help']
      ],
      openingLine:
        'Excuse me! I am looking for an English book called "Taiwan Travel Guide" as a gift for my friend. Do you have it in stock?',
      openingLineZh:
        '不好意思！我想找一本叫做《台灣旅遊指南》的英文書送給朋友當禮物。請問你們店裡有現貨嗎？',
      suggestedPhrases: [
        {
          en: 'Let me check the computer for you! Yes, we still have three copies in stock.',
          zh: '我幫您查一下電腦！有的，我們目前還有三本現貨。'
        },
        {
          en: 'It is in Section B on the Travel bookshelf. Follow me, I can show you!',
          zh: '這本書放在 B 區的旅遊書架上。請跟我來，我可以帶您過去！'
        },
        {
          en: 'Also, we offer free gift wrapping at the checkout counter!',
          zh: '另外，我們在結帳櫃檯有提供免費的禮物包裝服務喔！'
        }
      ],
      contextualFollowUps: [
        {
          en: 'Oh wonderful! Which bookshelf is it on? And do you offer gift wrapping?',
          zh: '太好了！請問它在哪一個書架呢？另外你們有提供禮物包裝嗎？'
        },
        {
          en: 'Free gift wrapping is awesome! Thank you so much for showing me the way!',
          zh: '有免費禮物包裝太棒了！非常謝謝你帶路！'
        }
      ]
    }
  ];

  /**
   * 16-Tile Classic Richman / Monopoly Board Layout in SimCity 3D Style
   */
  window.ExecVoice.BOARD_TILES = [
    {
      index: 0,
      gridRow: 1,
      gridCol: 1,
      type: 'corner-start',
      name: '市政起點 · 發薪日',
      subName: 'CITY HALL · PAYDAY',
      icon: '🏛️',
      zoneColor: '#10b981',
      rewardText: '經過領 +$1,000',
      description: '模擬城市市政廳起點！每次擲骰子經過或停留可領取青年職涯津貼 $1,000。'
    },
    {
      index: 1,
      gridRow: 1,
      gridCol: 2,
      type: 'scenario',
      scenarioId: 'cafe-barista-order',
      name: '星巴風陽光咖啡館',
      subName: 'Starlight Cafe',
      icon: '☕',
      zoneType: 'commercial',
      zoneColor: '#3b82f6',
      rewardText: '基礎獎金 $1,200'
    },
    {
      index: 2,
      gridRow: 1,
      gridCol: 3,
      type: 'chance',
      name: '機會命運站',
      subName: 'CHANCE & DESTINY',
      icon: '❓',
      zoneColor: '#f59e0b',
      rewardText: '擲骰走到觸發一次',
      description: '擲骰子走到此格時，自動翻開一張大富翁機會命運卡！（點擊地圖不會重複給錢）'
    },
    {
      index: 3,
      gridRow: 1,
      gridCol: 4,
      type: 'scenario',
      scenarioId: 'shift-swap-request',
      name: '24H 城市便利超商',
      subName: 'SimMetro Mart',
      icon: '🏪',
      zoneType: 'commercial',
      zoneColor: '#3b82f6',
      rewardText: '基礎獎金 $1,400'
    },
    {
      index: 4,
      gridRow: 1,
      gridCol: 5,
      type: 'corner-transit',
      name: '模擬城市捷運總站',
      subName: 'METRO EXPRESS',
      icon: '🚇',
      zoneColor: '#06b6d4',
      rewardText: '自動轉乘至下一建築',
      description: '擲骰子抵達捷運站時，系統將自動為你安排特快列車前往下一座待升遷的職場建築！'
    },
    {
      index: 5,
      gridRow: 2,
      gridCol: 5,
      type: 'scenario',
      scenarioId: 'campus-event-guide',
      name: '國際世貿展覽館',
      subName: 'World Expo Hall',
      icon: '🏛️',
      zoneType: 'civic',
      zoneColor: '#10b981',
      rewardText: '基礎獎金 $1,300'
    },
    {
      index: 6,
      gridRow: 3,
      gridCol: 5,
      type: 'ai-lot',
      name: '新創育成開發特區',
      subName: 'AI CUSTOM TOWER',
      icon: '🏗️',
      zoneType: 'special',
      zoneColor: '#8b5cf6',
      rewardText: 'AI 建造或挑戰新樓',
      description: '擲骰子抵達此開發區時，可挑戰老師／AI 新建的職場大樓！'
    },
    {
      index: 7,
      gridRow: 4,
      gridCol: 5,
      type: 'scenario',
      scenarioId: 'phone-message-taking',
      name: '旭日跨國貿易大樓',
      subName: 'Sunrise Trade Tower',
      icon: '🏢',
      zoneType: 'industrial',
      zoneColor: '#f59e0b',
      rewardText: '基礎獎金 $1,500'
    },
    {
      index: 8,
      gridRow: 5,
      gridCol: 5,
      type: 'corner-park',
      name: '模擬城市中央公園',
      subName: 'CENTRAL PARK PLAZA',
      icon: '🌳',
      zoneColor: '#10b981',
      rewardText: '走到領獎學金 +$600',
      description: '擲骰子走到中央公園時，與外國交換生交流獲得 $600 獎學金。'
    },
    {
      index: 9,
      gridRow: 5,
      gridCol: 4,
      type: 'scenario',
      scenarioId: 'summer-internship-interview',
      name: '矽谷新創孵化園區',
      subName: 'SimValley Tech Park',
      icon: '🚀',
      zoneType: 'industrial',
      zoneColor: '#f59e0b',
      rewardText: '基礎獎金 $1,800'
    },
    {
      index: 10,
      gridRow: 5,
      gridCol: 3,
      type: 'chance',
      name: '模擬城市新聞台',
      subName: 'SIMCITY NEWS EVENT',
      icon: '📺',
      zoneColor: '#ec4899',
      rewardText: '擲骰走到觸發一次',
      description: '擲骰子走到新聞台時，隨機觸發模擬城市英語好運事件！'
    },
    {
      index: 11,
      gridRow: 5,
      gridCol: 2,
      type: 'scenario',
      scenarioId: 'bubble-tea-order',
      name: '珍珠奶茶台灣旗艦店',
      subName: 'Formosa Boba House',
      icon: '🧋',
      zoneType: 'commercial',
      zoneColor: '#3b82f6',
      rewardText: '基礎獎金 $1,300'
    },
    {
      index: 12,
      gridRow: 5,
      gridCol: 1,
      type: 'corner-builder',
      name: '市政職涯獎勵局',
      subName: 'CAREER BONUS HALL',
      icon: '🏆',
      zoneColor: '#8b5cf6',
      rewardText: '按建築數領發展津貼',
      description: '擲骰子走到市政獎勵局時，根據你目前已蓋出的職場大樓數量發放城市建設分紅！'
    },
    {
      index: 13,
      gridRow: 4,
      gridCol: 1,
      type: 'scenario',
      scenarioId: 'intern-mentor-update',
      name: '創意數位媒體大樓',
      subName: 'Creative Media Studio',
      icon: '🎨',
      zoneType: 'industrial',
      zoneColor: '#f59e0b',
      rewardText: '基礎獎金 $1,700'
    },
    {
      index: 14,
      gridRow: 3,
      gridCol: 1,
      type: 'academy',
      name: '市政英語進修學院',
      subName: 'SPEAKING ACADEMY',
      icon: '🎓',
      zoneColor: '#06b6d4',
      rewardText: '走到領助學金 +$500',
      description: '擲骰子走到進修學院時，免費獲得一張萬用禮貌職場英語金句卡與 $500 助學金。'
    },
    {
      index: 15,
      gridRow: 2,
      gridCol: 1,
      type: 'scenario',
      scenarioId: 'bookstore-part-time',
      name: '誠品風國際文化書城',
      subName: 'Global Bookstore',
      icon: '📚',
      zoneType: 'civic',
      zoneColor: '#10b981',
      rewardText: '基礎獎金 $1,400'
    }
  ];

  window.ExecVoice.CHANCE_CARDS = [
    {
      title: '🌟 機會卡：外國客人誇獎你的英文很親切！',
      desc: '你在門市打工時主動用 "Welcome! How can I help you today?" 招呼外國遊客，獲得五星好評與店長獎金！',
      tipEn: 'Welcome! How can I help you today?',
      tipZh: '歡迎光臨！請問今天有什麼我可以幫您的嗎？',
      moneyDelta: 800,
      reputationDelta: 15
    },
    {
      title: '🏆 命運卡：獲選模擬城市「最佳高中實習生」！',
      desc: '你在週會上勇敢用英文向導師請教問題（"Do you have a few minutes to give me some feedback?"），獲得市政青年獎學金！',
      tipEn: 'Do you have a few minutes to give me some feedback?',
      tipZh: '請問您有幾分鐘可以給我一點修改建議嗎？',
      moneyDelta: 1000,
      reputationDelta: 20
    },
    {
      title: '💡 機會卡：學會超實用的電話禮儀金句！',
      desc: '幫主管接電話時，只要說 "May I take a message for you?" 就能展現專業度！獲得企業實習津貼補助。',
      tipEn: 'He is in a meeting right now. May I take a message for you?',
      tipZh: '他現在剛好在開會，請問我可以幫您留個口訊嗎？',
      moneyDelta: 700,
      reputationDelta: 12
    },
    {
      title: '🌈 命運卡：國際展覽志工表現優異！',
      desc: '你清楚指引外賓前往二樓演講廳（"Just walk straight and take the elevator to the second floor"），市長親自頒發感謝狀與車馬費！',
      tipEn: 'Just walk straight and take the elevator to the second floor.',
      tipZh: '只要直走並搭乘電梯到二樓就到了。',
      moneyDelta: 900,
      reputationDelta: 18
    }
  ];

  window.ExecVoice.FILLER_WORDS = [
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'i mean', 'basically', 'actually'
  ];
})();
