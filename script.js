const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

// Paste your Google Apps Script Web App URL here
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzxRardOzzkFklkLqieEumNdWwJxlenqslfkap3BPp9d9_tWrQlHje053-EHa4B1GbiYw/exec"; 

// --- DECOUPLED MONARCH SETTINGS ---
const MONARCH_BOSSES = [
    "Monarch CH 1",
    "Monarch CH 2",
    "Monarch CH 3",
];

// Global Variables
window.globalCsvData = null;
window.currentDayOffset = null;
window.notifiedBosses = new Set(); 
window.communityMonarchKills = {}; 

// The Ping Sound 
const alertAudio = new Audio('SoundAlert.mp3');

document.addEventListener("DOMContentLoaded", () => {
    // 1. Load Theme
    const savedColor = localStorage.getItem('neoTimerThemeColor');
    if (savedColor) document.documentElement.style.setProperty('--accent-color', savedColor);

    // 2. Load Volume
    const savedVolume = localStorage.getItem('neoTimerVolume');
    if (savedVolume !== null) {
        alertAudio.volume = parseFloat(savedVolume);
    } else {
        alertAudio.volume = 0.2;
    }

    // 3. Load Timer Toggle
    const timerToggle = document.getElementById('timer-toggle');
    const savedToggle = localStorage.getItem('neoTimerToggleState');
    if (timerToggle) {
        if (savedToggle !== null) timerToggle.checked = savedToggle === 'true';
        timerToggle.addEventListener('change', (e) => {
            localStorage.setItem('neoTimerToggleState', e.target.checked);
            if (window.globalCsvData) tick(); 
        });
    }

    // 4. Load Sound Toggle
    const soundToggle = document.getElementById('sound-toggle');
    const savedSound = localStorage.getItem('neoTimerSoundState');
    if (soundToggle) {
        if (savedSound !== null) soundToggle.checked = savedSound === 'true';
        soundToggle.addEventListener('change', (e) => localStorage.setItem('neoTimerSoundState', e.target.checked));
    }

    // 5. Load Server Region
    const savedRegion = localStorage.getItem('neoTimerRegion') || 'EU';
    document.querySelectorAll('.region-btn').forEach(btn => {
        if (btn.dataset.region === savedRegion) btn.classList.add('active');
        
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            localStorage.setItem('neoTimerRegion', e.target.dataset.region);
            if (window.globalCsvData) {
                window.currentDayOffset = null; 
                tick(); 
            }
        });
    });

    // 6. Load 12-Hour Format Toggle
    const timeFormatToggle = document.getElementById('time-format-toggle');
    const savedTimeFormat = localStorage.getItem('neoTimer12Hour');
    if (timeFormatToggle) {
        if (savedTimeFormat !== null) timeFormatToggle.checked = savedTimeFormat === 'true';
        timeFormatToggle.addEventListener('change', (e) => {
            localStorage.setItem('neoTimer12Hour', e.target.checked);
            if (window.globalCsvData) {
                window.currentDayOffset = null; 
                tick(); 
            }
        });
    }

    // 7. Color Picker
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
            localStorage.setItem('neoTimerThemeColor', selectedColor);
        });
    });

    // 8. Setup Settings Modal & Volume Slider
    const modal = document.getElementById('settings-modal');
    const cog = document.getElementById('settings-btn');
    const closeBtn = document.querySelector('.close-modal');
    
    const volSlider = document.getElementById('volume-slider');
    const volDisplay = document.getElementById('volume-display');
    const testBtn = document.getElementById('test-sound-btn');

    if (volSlider) {
        volSlider.value = alertAudio.volume;
        volDisplay.innerText = Math.round(alertAudio.volume * 100) + '%';
        
        volSlider.addEventListener('input', (e) => {
            const newVol = parseFloat(e.target.value);
            alertAudio.volume = newVol;
            volDisplay.innerText = Math.round(newVol * 100) + '%';
            localStorage.setItem('neoTimerVolume', newVol);
        });
    }

    if (testBtn) {
        testBtn.addEventListener('click', () => {
            alertAudio.currentTime = 0; 
            alertAudio.play().catch(e => console.log("Audio play blocked", e));
        });
    }

    cog.addEventListener('click', () => {
        populateSettings();
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Fetch Main Data
    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, 
        complete: function(results) {
            window.globalCsvData = results.data;
            setInterval(tick, 1000);
            tick(); 
        }
    });

    // Fetch Community Monarch Times
    if (WEB_APP_URL !== "YOUR_WEB_APP_URL_HERE") {
        fetchCommunityMonarchs();
        setInterval(fetchCommunityMonarchs, 60000); 
    }
});

function fetchCommunityMonarchs() {
    fetch(WEB_APP_URL)
        .then(response => response.json())
        .then(data => {
            window.communityMonarchKills = data;
            if (window.globalCsvData) tick(); 
        })
        .catch(err => console.error("Error fetching community times:", err));
}

function submitMonarchTime(region, boss, timeStr) {
    if (WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") return;
    
    fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ region: region, boss: boss, time: timeStr })
    }).catch(err => console.error("Error submitting time:", err));
}

// --- SETTINGS POPULATOR (REGIONS) ---
function populateSettings() {
    const list = document.getElementById('region-alert-list');
    if (!window.globalCsvData) return;
    
    const regionNames = [...new Set(window.globalCsvData.map(b => b.Region))]
        .filter(Boolean)
        .filter(r => r.toLowerCase() !== 'monarch')
        .sort();
        
    regionNames.push("Monarch");

    let mutedRegions = JSON.parse(localStorage.getItem('neoTimerMutedRegions')) || [];
    let hiddenRegions = JSON.parse(localStorage.getItem('neoTimerHiddenRegions')) || [];

    list.innerHTML = regionNames.map(name => `
        <div class="boss-alert-item">
            <span class="boss-alert-name">${name}</span>
            <div style="display: flex; gap: 20px; padding-right: 5px;">
                <label class="switch" title="Toggle Visibility">
                    <input type="checkbox" data-region="${name}" data-type="visible" ${hiddenRegions.includes(name) ? '' : 'checked'} class="region-setting-toggle">
                    <span class="slider round"></span>
                </label>
                <label class="switch" title="Toggle Sound">
                    <input type="checkbox" data-region="${name}" data-type="sound" ${mutedRegions.includes(name) ? '' : 'checked'} class="region-setting-toggle">
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.region-setting-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const rName = e.target.dataset.region;
            const type = e.target.dataset.type;
            const storageKey = type === 'sound' ? 'neoTimerMutedRegions' : 'neoTimerHiddenRegions';
            
            let currentList = JSON.parse(localStorage.getItem(storageKey)) || [];
            
            if (e.target.checked) {
                currentList = currentList.filter(n => n !== rName);
            } else {
                if (!currentList.includes(rName)) currentList.push(rName);
            }
            localStorage.setItem(storageKey, JSON.stringify(currentList));
            
            if (type === 'visible') applyVisibility();
        });
    });
}

function applyVisibility() {
    const hiddenRegions = JSON.parse(localStorage.getItem('neoTimerHiddenRegions')) || [];
    document.querySelectorAll('.region-column').forEach(col => {
        if (hiddenRegions.includes(col.dataset.regionColumn)) {
            col.style.display = 'none';
        } else {
            col.style.display = 'block';
        }
    });
}

// --- THE MASTER ENGINE ---
function tick() {
    if (!window.globalCsvData) return;
    
    const savedRegion = localStorage.getItem('neoTimerRegion') || 'EU';
    let offsetHours = 1; 
    if (savedRegion === 'NA') offsetHours = -6; 
    else if (savedRegion === 'TW') offsetHours = 8; 

    const localNow = new Date();
    const utcMs = localNow.getTime() + (localNow.getTimezoneOffset() * 60000);
    const now = new Date(utcMs + (offsetHours * 3600000));

    const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

    const activeOffset = getActiveDayOffset(window.globalCsvData, nowSec, now);

    if (window.currentDayOffset !== activeOffset) {
        window.currentDayOffset = activeOffset;
        buildDashboard(window.globalCsvData, activeOffset, now, savedRegion);
    }

    updateTopClock(now, nowSec, savedRegion);
    updateTimers(nowSec, activeOffset, savedRegion);
}

function getActiveDayOffset(data, nowSec, now) {
    const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
    const todaysStandardBosses = data.filter(row => row.Weekday === todayStr && row.Region && row.Region.toLowerCase() !== 'monarch');
    const hasActiveBosses = todaysStandardBosses.some(boss => (boss.TargetSec + 300) > nowSec);
    return hasActiveBosses ? 0 : 1; 
}

// --- CLOCKS & RESETS ---
function updateTopClock(now, nowSec, region) {
    const is12Hour = localStorage.getItem('neoTimer12Hour') === 'true';
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: is12Hour });
    document.getElementById('top-clock').innerText = `${region} | ${timeStr}`;
    
    let dDiff = 21600 - nowSec; 
    if (dDiff <= 0) dDiff += 86400;
    const dailyEl = document.getElementById('daily-reset');
    if (dailyEl) dailyEl.innerText = formatDuration(dDiff * 1000);

    const day = now.getDay();
    let daysUntilWed = (3 - day + 7) % 7;
    if (daysUntilWed === 0 && nowSec >= 21600) daysUntilWed = 7;
    const weeklySec = (daysUntilWed * 86400) + (21600 - nowSec);
    const weeklyEl = document.getElementById('weekly-reset');
    if (weeklyEl) {
        const d = Math.floor(weeklySec / 86400);
        weeklyEl.innerText = `${d > 0 ? d + 'd ' : ''}${formatDuration((weeklySec % 86400) * 1000)}`;
    }
}

// --- UI BUILDER ---
function buildDashboard(data, offset, now, currentRegion) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + offset);
    const displayDayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);
    const isTomorrow = offset > 0;
    const is12Hour = localStorage.getItem('neoTimer12Hour') === 'true';

    const displayStandardBosses = data.filter(row => row.Weekday === displayDayStr && row.Region && row.Region.toLowerCase() !== 'monarch');
    const activeRegions = [...new Set(displayStandardBosses.map(row => row.Region))];

    activeRegions.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.dataset.regionColumn = region;
        
        const titleExtra = isTomorrow ? ` <span style="font-size:10px; color:var(--accent-color);">(Tomorrow)</span>` : ``;
        col.innerHTML = `<h3>${region.toUpperCase()}${titleExtra}</h3><div class="card-container"></div>`;
        const container = col.querySelector('.card-container');
        
        const regionBosses = displayStandardBosses.filter(row => row.Region === region);
        
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card standard-card';
            card.dataset.targetSec = boss.TargetSec; 
            card.dataset.targetTime = boss.TargetTime;
            card.dataset.bossName = boss.BossName; 
            card.dataset.region = boss.Region; 

            const tSec = parseInt(boss.TargetSec, 10);
            let displayTime = boss.TargetTime;
            if (!isNaN(tSec)) {
                const h = Math.floor(tSec / 3600);
                const m = Math.floor((tSec % 3600) / 60);
                if (is12Hour) {
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    displayTime = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                } else {
                    displayTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                }
            }
            card.dataset.displayTime = displayTime;

            card.innerHTML = `
                <p class="boss-name">${boss.BossName}</p>
                <p class="boss-time">Time: ${displayTime}</p>
                <div class="countdown-wrapper"><div class="countdown">--</div></div>`;
            container.appendChild(card);
        });

        grid.appendChild(col);
    });

    buildMonarchColumn(grid, currentRegion);
    applyVisibility(); 
}

function buildMonarchColumn(grid, currentRegion) {
    const col = document.createElement('div');
    col.className = 'region-column';
    col.dataset.regionColumn = "Monarch";
    col.innerHTML = `<h3>MONARCHS <span style="font-size:10px; color:var(--accent-color);">(Server-Time)</span></h3><div class="card-container monarch-container"></div>`;
    const container = col.querySelector('.card-container');

    MONARCH_BOSSES.forEach(bossName => {
        const card = document.createElement('div');
        card.className = 'boss-card monarch-card';
        card.dataset.bossName = bossName;
        card.dataset.region = "Monarch"; 

        let displayTime = "";
        if (window.communityMonarchKills[currentRegion] && window.communityMonarchKills[currentRegion][bossName]) {
            displayTime = window.communityMonarchKills[currentRegion][bossName];
        } else {
            const localKills = JSON.parse(localStorage.getItem('neoMonarchKills_' + currentRegion)) || {};
            displayTime = localKills[bossName] || "";
        }

        const isLocked = displayTime !== "";
        const lockedClass = isLocked ? "locked" : "";
        const readonlyAttr = isLocked ? "readonly" : "";

        card.innerHTML = `
            <p class="boss-name">${bossName}</p>
            <div class="monarch-controls">
                <span class="monarch-label">Last Announcement Time:</span>
                <div class="time-input-group">
                    <input type="text" class="monarch-time-input ${lockedClass}" data-boss="${bossName}" value="${displayTime}" placeholder="HH:MM" maxlength="5" ${readonlyAttr}>
                    <button class="edit-time-btn" data-boss="${bossName}" title="Edit Time">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <p class="time-since-kill">Time since last Announcement: <span class="kill-timer">--</span></p>
            <div class="countdown-wrapper">
                <div class="estimated-label">ESTIMATED SPAWN IN</div>
                <div class="countdown">--</div>
            </div>`;
        container.appendChild(card);
    });

    grid.appendChild(col);

    // Event Listeners for the Edit Button
    document.querySelectorAll('.edit-time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bName = e.currentTarget.dataset.boss;
            const input = document.querySelector(`.monarch-time-input[data-boss="${bName}"]`);
            if (input) {
                input.classList.remove('locked');
                input.removeAttribute('readonly');
                input.focus();
            }
        });
    });

    // Event Listeners for the Input
    document.querySelectorAll('.monarch-time-input').forEach(input => {
        // Blur event to re-lock if user clicks away without changing anything
        input.addEventListener('blur', (e) => {
            if (e.target.value.trim() !== "") {
                e.target.classList.add('locked');
                e.target.setAttribute('readonly', 'true');
            }
        });

        // Change event to handle saving the time
        input.addEventListener('change', (e) => {
            const bName = e.target.dataset.boss;
            const bTime = e.target.value.trim();
            const reg = localStorage.getItem('neoTimerRegion') || 'EU';
            
            if (bTime === "") {
                let currentKills = JSON.parse(localStorage.getItem('neoMonarchKills_' + reg)) || {};
                currentKills[bName] = "";
                localStorage.setItem('neoMonarchKills_' + reg, JSON.stringify(currentKills));
                e.target.classList.remove('locked');
                e.target.removeAttribute('readonly');
                tick(); 
                return;
            }

            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(bTime)) {
                alert("Please enter a valid 24h time (e.g., 08:30 or 14:45)");
                const currentKills = JSON.parse(localStorage.getItem('neoMonarchKills_' + reg)) || {};
                e.target.value = currentKills[bName] || "";
                return;
            }
            
            // Re-lock the field upon valid entry
            e.target.classList.add('locked');
            e.target.setAttribute('readonly', 'true');

            let currentKills = JSON.parse(localStorage.getItem('neoMonarchKills_' + reg)) || {};
            currentKills[bName] = bTime;
            localStorage.setItem('neoMonarchKills_' + reg, JSON.stringify(currentKills));
            
            submitMonarchTime(reg, bName, bTime);
            
            tick(); 
        });
    });
}

// --- TIMER MATH & ALERTS ---
function updateTimers(nowSec, activeOffset, currentRegion) {
    const timerToggle = document.getElementById('timer-toggle');
    const isTimerOn = timerToggle ? timerToggle.checked : true;
    
    const soundToggle = document.getElementById('sound-toggle');
    const isGlobalSoundOn = soundToggle ? soundToggle.checked : false;
    const mutedRegions = JSON.parse(localStorage.getItem('neoTimerMutedRegions')) || [];

    document.querySelectorAll('.standard-card').forEach(card => {
        const countdownEl = card.querySelector('.countdown');
        const targetSec = parseInt(card.dataset.targetSec, 10);
        const bName = card.dataset.bossName;
        const regionName = card.dataset.region; 
        
        const spawnId = `${bName}_${targetSec}_${activeOffset}`;
        let timeRemaining; 

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        const diffSec = (targetSec + (86400 * activeOffset)) - nowSec;
        timeRemaining = diffSec; 

        if (diffSec > 0) {
            countdownEl.innerText = isTimerOn ? formatDuration(diffSec * 1000) : `Announcement at: ${card.dataset.displayTime}`;
            card.dataset.priority = "1";
        } else if (diffSec <= 0 && diffSec > -300) { 
            countdownEl.innerText = `Spawning in: ${formatDuration((300 + diffSec) * 1000)}`;
            countdownEl.classList.add('spawning');
            card.dataset.priority = "0";
        } else {
            countdownEl.innerText = `Spawned`;
            card.classList.add('dimmed');
            card.dataset.priority = "2";
        }

        handleAudio(timeRemaining, isGlobalSoundOn, mutedRegions, regionName, spawnId);
    });

    document.querySelectorAll('.monarch-card').forEach(card => {
        const countdownEl = card.querySelector('.countdown');
        const killTimerEl = card.querySelector('.kill-timer');
        const inputEl = card.querySelector('.monarch-time-input');
        const bName = card.dataset.bossName;
        
        if (window.communityMonarchKills[currentRegion] && window.communityMonarchKills[currentRegion][bName]) {
            if (document.activeElement !== inputEl) { 
                inputEl.value = window.communityMonarchKills[currentRegion][bName];
                inputEl.classList.add('locked');
                inputEl.setAttribute('readonly', 'true');
            }
        }
        
        const killTimeStr = inputEl.value;
        const spawnId = `Monarch_${bName}`;
        
        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        if (!killTimeStr) {
            killTimerEl.innerText = "--";
            countdownEl.innerText = "Awaiting Time";
            card.dataset.priority = "3";
            return;
        }

        const [kh, km] = killTimeStr.split(':').map(Number);
        const killSec = (kh * 3600) + (km * 60);

        let timeSinceKill = nowSec - killSec;
        if (timeSinceKill < 0) timeSinceKill += 86400; 

        killTimerEl.innerText = formatDuration(timeSinceKill * 1000);
        
        const spawnIn = 7200 - timeSinceKill; 
        let timeRemaining = spawnIn;

        if (spawnIn > 0) {
            countdownEl.innerText = formatDuration(spawnIn * 1000);
            card.dataset.priority = "1";
        } else if (timeSinceKill <= 18000) { 
            countdownEl.innerText = `In Window`;
            countdownEl.classList.add('spawning'); 
            card.dataset.priority = "0"; 
        } else { 
            countdownEl.innerText = `Missed Window`;
            card.dataset.priority = "2"; 
            timeRemaining = 999999; 
        }

        handleAudio(timeRemaining, isGlobalSoundOn, mutedRegions, "Monarch", spawnId);
    });

    document.querySelectorAll('.card-container').forEach(container => {
        const cards = Array.from(container.children);
        const originalOrder = [...cards];

        cards.sort((a, b) => {
            const priorityA = parseInt(a.dataset.priority || "9");
            const priorityB = parseInt(b.dataset.priority || "9");
            
            if (priorityA !== priorityB) return priorityA - priorityB;
            
            const tA = parseInt(a.dataset.targetSec || "0");
            const tB = parseInt(b.dataset.targetSec || "0");
            return tA - tB;
        });

        let orderChanged = false;
        for (let i = 0; i < cards.length; i++) {
            if (cards[i] !== originalOrder[i]) {
                orderChanged = true;
                break;
            }
        }

        if (orderChanged) {
            cards.forEach(card => container.appendChild(card));
        }
    });
}

function handleAudio(timeRemaining, isGlobalSoundOn, mutedRegions, regionName, spawnId) {
    if (timeRemaining <= 300 && timeRemaining > -300) {
        if (isGlobalSoundOn && !mutedRegions.includes(regionName) && !window.notifiedBosses.has(spawnId)) {
            alertAudio.play().catch(e => console.log("Audio play blocked by browser."));
            window.notifiedBosses.add(spawnId); 
        }
    } else if (timeRemaining > 300) {
        window.notifiedBosses.delete(spawnId);
    }
}

function formatDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const pad = (n) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}
