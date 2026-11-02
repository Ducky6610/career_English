# 🎙️ 高中生職場英語教練｜AI 真人即時語音對練與口語評鑑系統

專為**高中生（CEFR A2 ~ B1 程度）**量身打造的職場英語口語練習與即時評鑑工具，涵蓋「門市與餐飲打工」、「暑期實習面試」、「辦公室行政與電話接待」、「校園國際活動志工」等實用情境。

## ✨ 核心功能

1. **情境大廳與設計器（Scenario Hub & AI Builder）**
   - **內建 6 大高中生職場情境庫**（[`scenarios.js`](file:///Users/chris/Documents/AI職場英語/scenarios.js)）：外國客人咖啡點餐、向店長禮貌請求換班、高中生暑期實習英文面試、幫主管接聽電話並留口訊、校園國際展覽外賓接待、實習生週會海報進度回報。
   - **AI 一鍵生成情境**：輸入一句中文描述即可自動產生適合高中生程度的職場情境、開場白與 3 個過關任務。
   - **手動自訂情境**：老師或學生可自由設計專屬對練情境。

2. **真人即時語音對練室（Live Voice Roleplay Studio）**
   - **免金鑰真人生動語音模式**（[`audio-engine.js`](file:///Users/chris/Documents/AI職場英語/audio-engine.js)）：無須設定 API Key 即可使用雲端自然神經語音與智慧語音辨識對練。
   - **Gemini 3.8 Live 原生雙向語音模式**（[`gemini-service.js`](file:///Users/chris/Documents/AI職場英語/gemini-service.js)）：支援輸入 Gemini API Key 啟用 `gemini-3.8-live` 超低延遲雙向語音互動。
   - **高精準度語音辨識**（[`app.js`](file:///Users/chris/Documents/AI職場英語/app.js)）：具備喇叭回音隔離、1.85 秒自然思考停頓緩衝、情境詞彙 N-Best 候選重排序與台灣學生常見同音字校正，並支援對話泡泡一鍵修正文字。

3. **毫秒級即時五維度口語評估報告（Instant Speaking Evaluation）**
   - **0 秒瞬時產出真實評鑑**：根據受測者實際說出的每一句英文，即時分析流暢度、文法精準度、職場禮貌度、表達完整度與任務關鍵字達成度。
   - **逐句診斷與雙版本升級建議**：針對原句提供繁體中文說明、「✅ 自然正確修正（Correct & Natural）」與「🌟 禮貌加分說法（Polite Workplace English）」，並支援點擊 🔊 聆聽真人發音與匯出 `.md` 報告。

---

## 🌐 如何發佈到外部平台（免費且支援 HTTPS 麥克風權限）

本專案採用**純前端無伺服器架構（Pure Static Web App）**，只需要將資料夾內的 6 個核心檔案上傳至任何靜態網站託管平台，即可獲得支援麥克風權限的 `https://` 公開網址：

- `index.html`
- `styles.css`
- `scenarios.js`
- `audio-engine.js`
- `gemini-service.js`
- `app.js`

### 方法一：Netlify Drop（最快速，免寫指令、拖曳資料夾 10 秒上線）
1. 前往 [app.netlify.com/drop](https://app.netlify.com/drop)（免費註冊/登入）。
2. 直接將電腦上的 `/Users/chris/Documents/AI職場英語` 整個資料夾拖曳到網頁虛線框中。
3. 等待約 5～10 秒，Netlify 就會自動產出一個 `https://xxxx.netlify.app` 的專屬安全網址，直接分享給學生即可在電腦、平板或手機打開練習。

### 方法二：GitHub Pages（適合學校課程長期維護）
1. 在 GitHub 建立一個新的公開儲存庫（Repository），將本資料夾所有檔案上傳。
2. 進入該儲存庫的 **Settings** ➔ **Pages**。
3. 在 **Build and deployment** 選擇 `Deploy from a branch`，分支選擇 `main`（`/root`）並按下 **Save**。
4. 約 1 分鐘後即可透過 `https://<你的帳號>.github.io/<專案名稱>/` 存取。

### 方法三：Vercel / Firebase Hosting
- **Vercel**：前往 [vercel.com](https://vercel.com) 匯入 GitHub 儲存庫，Framework Preset 選擇 `Other`，點擊 **Deploy** 即可。
- **Firebase Hosting**：若使用 Firebase，可直接透過 Firebase CLI 部署為靜態網站。

---

## 💻 本機快速啟動方式

```bash
python3 server.py
```

接著在瀏覽器開啟 `http://localhost:8000` 即可開始使用。
