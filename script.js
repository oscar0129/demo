/* =========================================================
   考試專用倒數計時器
   計時核心以「結束時間戳」計算，切換分頁或裝置休眠後
   回來仍能顯示正確剩餘時間，不會因計時器漂移而失準。
   ========================================================= */

const STORAGE_KEYS = {
    subject: 'examTimer.subject',
    minutes: 'examTimer.minutes',
    sound: 'examTimer.sound',
};

const DEFAULT_SUBJECT = '第一節：國文科';
const WARNING_SECONDS = 10 * 60; // 剩 10 分鐘轉黃
const DANGER_SECONDS = 3 * 60;   // 剩 3 分鐘轉紅

const timerDisplay = document.getElementById('timerDisplay');
const statusText = document.getElementById('statusText');
const subjectTitle = document.getElementById('subjectTitle');
const minutesInput = document.getElementById('minutesInput');
const endTimeInput = document.getElementById('endTimeInput');
const currentClock = document.getElementById('currentClock');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const soundBtn = document.getElementById('soundBtn');
const togglePanelBtn = document.getElementById('togglePanelBtn');
const fullScreenBtn = document.getElementById('fullScreenBtn');
const controlPanel = document.getElementById('controlPanel');

let totalSeconds = 50 * 60;
let remainingSeconds = totalSeconds;
let endTimestamp = null;
let timerInterval = null;
let isRunning = false;
let soundEnabled = true;
let audioContext = null;

/* ---------------------- 小工具 ---------------------- */

function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* 無痕模式等情況忽略即可 */
    }
}

/* 格式化成 MM:SS，超過 60 分鐘顯示 90:00，符合考場習慣 */
function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setStatus(message, color) {
    statusText.textContent = message;
    statusText.style.color = color || '';
}

/* ---------------------- 音效 ---------------------- */

function ensureAudioContext() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

function beep(frequency = 880, duration = 0.45, delay = 0) {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const startAt = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    // 淡入淡出，避免爆音
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.05);
}

function playAlarm() {
    if (!soundEnabled) return;
    beep(880, 0.5, 0);
    beep(880, 0.5, 0.8);
    beep(880, 0.5, 1.6);
}

/* ---------------------- 顯示更新 ---------------------- */

function updateDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);
    timerDisplay.classList.remove('warning', 'danger', 'times-up');

    if (remainingSeconds <= 0) {
        timerDisplay.classList.add('danger', 'times-up');
    } else if (remainingSeconds <= DANGER_SECONDS) {
        timerDisplay.classList.add('danger');
    } else if (remainingSeconds <= WARNING_SECONDS) {
        timerDisplay.classList.add('warning');
    }
}

function updateCurrentClock() {
    const now = new Date();
    currentClock.textContent = `現在時間：${now.toLocaleTimeString('zh-TW', { hour12: false })}`;
}

/* ---------------------- 計時邏輯 ---------------------- */

function tick() {
    if (!isRunning || endTimestamp === null) return;

    // 用 ceil，最後一秒才會真正歸零
    remainingSeconds = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
    updateDisplay();

    if (remainingSeconds > WARNING_SECONDS) {
        setStatus('⏳ 考試進行中，祝考試順利');
    } else if (remainingSeconds > DANGER_SECONDS) {
        setStatus('🔔 剩餘不到 10 分鐘，請把握時間', '#fbbf24');
    } else if (remainingSeconds > 0) {
        setStatus('⚠️ 剩餘不到 3 分鐘，請檢查答案卡與姓名', '#f87171');
    }

    if (remainingSeconds <= 0) {
        finishTimer();
    }
}

function startTimer() {
    if (isRunning || remainingSeconds <= 0) return;

    ensureAudioContext(); // 在使用者手勢中解鎖音效
    endTimestamp = Date.now() + remainingSeconds * 1000;
    isRunning = true;

    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 200);
    setStatus('⏳ 考試進行中，祝考試順利');
    tick();
}

function pauseTimer() {
    if (!isRunning) return;

    // 先結算目前剩餘秒數，再停止計時
    remainingSeconds = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
    isRunning = false;
    endTimestamp = null;
    clearInterval(timerInterval);
    timerInterval = null;

    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    updateDisplay();
    setStatus(`⏸ 已暫停，剩餘 ${formatTime(remainingSeconds)}`, '#fbbf24');
}

function finishTimer() {
    isRunning = false;
    endTimestamp = null;
    clearInterval(timerInterval);
    timerInterval = null;
    remainingSeconds = 0;

    updateDisplay();
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    setStatus('⏰ 考試時間結束，請停止作答！', '#f87171');
    playAlarm();
}

function resetTimer() {
    isRunning = false;
    endTimestamp = null;
    clearInterval(timerInterval);
    timerInterval = null;

    remainingSeconds = totalSeconds;
    updateDisplay();

    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    setStatus('準備就緒，請設定時間後按開始');
}

/* ---------------------- 設定時間 ---------------------- */

function setByMinutes() {
    const minutes = Number(minutesInput.value);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 300) {
        alert('請輸入 1 到 300 分鐘之間的考試時長。');
        minutesInput.focus();
        return;
    }

    totalSeconds = Math.round(minutes) * 60;
    resetTimer();
    setStatus(`已設定考試時長 ${Math.round(minutes)} 分鐘，按「開始計時」開始`);
    storageSet(STORAGE_KEYS.minutes, String(Math.round(minutes)));
}

function setByEndTime() {
    const value = endTimeInput.value;
    if (!value) {
        alert('請先選擇考試結束時間。');
        endTimeInput.focus();
        return;
    }

    const [hours, minutes] = value.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
        alert('指出的結束時間已經過了，請選擇之後的時間。');
        endTimeInput.focus();
        return;
    }

    const diffSeconds = Math.round(diffMs / 1000);
    totalSeconds = diffSeconds;
    remainingSeconds = diffSeconds;
    isRunning = false;
    endTimestamp = null;
    clearInterval(timerInterval);
    timerInterval = null;

    updateDisplay();
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    const endLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setStatus(`已設定於 ${endLabel} 結束（共 ${formatTime(diffSeconds)}），按「開始計時」開始`);

    // 同步回「考試時長」欄位，方便微調（超過 5 小時則不覆寫）
    const diffMinutes = Math.ceil(diffSeconds / 60);
    if (diffMinutes >= 1 && diffMinutes <= 300) {
        minutesInput.value = String(diffMinutes);
        storageSet(STORAGE_KEYS.minutes, minutesInput.value);
    }
}

/* ---------------------- 介面控制 ---------------------- */

function toggleSound() {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔔 結束提示音：開' : '🔕 結束提示音：關';
    storageSet(STORAGE_KEYS.sound, soundEnabled ? '1' : '0');
    if (soundEnabled) {
        ensureAudioContext();
        beep(1046, 0.18, 0); // 開啟時播放短音確認
    }
}

function togglePanel() {
    const hidden = controlPanel.classList.toggle('hidden');
    togglePanelBtn.textContent = hidden ? '🙈 顯示設定列' : '👁️ 隱藏設定列';
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.().catch(() => {});
    }
}

function syncFullScreenButton() {
    fullScreenBtn.textContent = document.fullscreenElement ? '⛶ 離開全螢幕' : '⛶ 全螢幕';
}

/* ---------------------- 科目名稱 ---------------------- */

function loadSubject() {
    const saved = storageGet(STORAGE_KEYS.subject);
    subjectTitle.textContent = saved && saved.trim() ? saved : DEFAULT_SUBJECT;
}

function saveSubject() {
    const text = subjectTitle.textContent.trim();
    if (!text) {
        subjectTitle.textContent = DEFAULT_SUBJECT;
    }
    storageSet(STORAGE_KEYS.subject, subjectTitle.textContent.trim());
    document.title = `${subjectTitle.textContent.trim()}｜考試倒數計時器`;
}

/* ---------------------- 事件綁定 ---------------------- */

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);
document.getElementById('applyMinutesBtn').addEventListener('click', setByMinutes);
document.getElementById('applyEndTimeBtn').addEventListener('click', setByEndTime);
soundBtn.addEventListener('click', toggleSound);
togglePanelBtn.addEventListener('click', togglePanel);
fullScreenBtn.addEventListener('click', toggleFullScreen);
document.addEventListener('fullscreenchange', syncFullScreenButton);

minutesInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') setByMinutes();
});

endTimeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') setByEndTime();
});

// 科目名稱：Enter 直接結束編輯，失焦時儲存
subjectTitle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        subjectTitle.blur();
    }
});
subjectTitle.addEventListener('input', saveSubject);
subjectTitle.addEventListener('blur', saveSubject);

// 快捷鍵：空白鍵開始/暫停、R 重設（輸入框或編輯科目時不觸發）
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    if (event.code === 'Space') {
        event.preventDefault();
        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    } else if (event.key.toLowerCase() === 'r') {
        resetTimer();
    } else if (event.key.toLowerCase() === 'f') {
        toggleFullScreen();
    }
});

/* ---------------------- 初始化 ---------------------- */

function init() {
    loadSubject();
    saveSubject();

    const savedMinutes = Number(storageGet(STORAGE_KEYS.minutes));
    if (Number.isFinite(savedMinutes) && savedMinutes >= 1 && savedMinutes <= 300) {
        totalSeconds = Math.round(savedMinutes) * 60;
        minutesInput.value = String(Math.round(savedMinutes));
    }

    const savedSound = storageGet(STORAGE_KEYS.sound);
    if (savedSound !== null) {
        soundEnabled = savedSound === '1';
        soundBtn.textContent = soundEnabled ? '🔔 結束提示音：開' : '🔕 結束提示音：關';
    }

    remainingSeconds = totalSeconds;
    updateDisplay();
    updateCurrentClock();
    setInterval(updateCurrentClock, 1000);
}

init();
