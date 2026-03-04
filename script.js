const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

// Global Variables
window.globalCsvData = null;
window.currentDayOffset = null;
window.notifiedBosses = new Set(); 

// The Ping Sound 
const alertAudio = new Audio('SoundAlert.mp3');

document.addEventListener("DOMContentLoaded", () => {
    // 1. Load Theme
    const savedColor = localStorage.getItem('neoTimerThemeColor');
    if (savedColor) document.documentElement.style.setProperty('--accent-color', savedColor);

    // 2. Load Volume
    const savedVolume = localStorage.getItem('neoTimerVolume');
    if (savedVolume !== null) alertAudio.volume = parseFloat(savedVolume);

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

    // 5. Color Picker
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
            localStorage.setItem('neoTimerThemeColor', selectedColor);
        });
    });

    // 6. Setup Settings Modal & Volume Slider
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
            alertAudio.currentTime = 0; // Reset to start if already playing
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

    // Fetch Data
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
});

// --- SETTINGS POPULATOR (REGIONS) ---
function populateSettings() {
    const list = document.getElementById('region-alert-list');
    if (!window.globalCsvData) return;
    
    const regionNames = [...new Set(window.globalCsvData.map(b => b.Region))].filter(Boolean).sort();
    let mutedRegions = JSON.parse(localStorage.getItem('neoTimerMutedRegions')) || [];

    list.innerHTML = regionNames.map(name => `
        <div class="boss-alert-item">
            <span class="boss-alert-name">${name}</span>
            <label class="switch">
                <input type="checkbox" data-region="${name}" ${mutedRegions.includes(name) ? '' : 'checked'} class="region-mute-toggle">
                <span class="slider round"></span>
            </label>
        </div>
    `).join('');

    document.querySelectorAll('.region-mute-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const rName = e.target.dataset.region;
            let currentMuted = JSON.parse(localStorage.getItem('neoTimerMutedRegions')) || [];
            
            if (e.target.checked) {
                currentMuted = currentMuted.filter(n => n !== rName);
            } else {
                if (!currentMuted.includes(rName)) currentMuted.push(rName);
            }
            localStorage.setItem('neoTimerMutedRegions', JSON.stringify(currentMuted));
        });
    });
}

// --- THE MASTER ENGINE ---
function tick() {
    if (!window.globalCsvData) return;
    const now = new Date();
    const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

    const activeOffset = getActiveDayOffset(window.globalCsvData, nowSec);

    if (window.currentDayOffset !== activeOffset) {
        window.currentDayOffset = activeOffset;
        buildDashboard(window.globalCsvData, activeOffset);
    }

    updateTopClock(now, nowSec);
    updateTimers(nowSec, activeOffset);
}

function getActiveDayOffset(data, nowSec) {
    const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const todaysStandardBosses = data.filter(row => row.Weekday === todayStr && row.Region && row.Region.toLowerCase() !== 'monarch');
    const hasActiveBosses = todaysStandardBosses.some(boss => (boss.TargetSec + 300) > nowSec);
    return hasActiveBosses ? 0 : 1; 
}

// --- CLOCKS & RESETS ---
function updateTopClock(now, nowSec) {
    document.getElementById('top-clock').innerText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
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
function buildDashboard(data, offset) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offset);
    const displayDayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);
    const isTomorrow = offset > 0;
    const trueTodayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

    const displayStandardBosses = data.filter(row => row.Weekday === displayDayStr && row.Region && row.Region.toLowerCase() !== 'monarch');
    const trueTodayMonarchs = data.filter(row => row.Weekday === trueTodayStr && row.Region && row.Region.toLowerCase() === 'monarch');
    
    const combinedData = [...displayStandardBosses, ...trueTodayMonarchs];
    const activeRegions = [...new Set(combinedData.map(row => row.Region))];

    activeRegions.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        
        const titleExtra = (isTomorrow && region.toLowerCase() !== 'monarch') 
            ? ` <span style="font-size:10px; color:var(--accent-color);">(Tomorrow)</span>` 
            : ``;

        col.innerHTML = `<h3>${region.toUpperCase()}${titleExtra}</h3><div class="card-container"></div>`;
        const container = col.querySelector('.card-container');
        
        const regionBosses = combinedData.filter(row => row.Region === region);
        
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            
            card.dataset.targetSec = boss.TargetSec; 
            card.dataset.targetTime = boss.TargetTime;
            card.dataset.bossName = boss.BossName; 
            card.dataset.region = boss.Region; 

            if (region.toLowerCase() === 'monarch') {
                card.classList.add('monarch-card');
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="time-since-kill">Time since kill: <span class="kill-timer">--</span></p>
                    <div class="countdown-wrapper">
                        <div class="estimated-label">ESTIMATED SPAWN IN</div>
                        <div class="countdown">--</div>
                    </div>`;
            } else {
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="boss-time">Time: ${boss.TargetTime}</p>
                    <div class="countdown-wrapper"><div class="countdown">--</div></div>`;
            }
            container.appendChild(card);
        });

        if (region.toLowerCase() === 'monarch') {
            const dropdown = document.createElement('details');
            dropdown.className = 'monarch-dropdown';
            const allMonarchs = data.filter(row => row.Region && row.Region.toLowerCase() === 'monarch');
            const dayOrder = { "Monday":1, "Tuesday":2, "Wednesday":3, "Thursday":4, "Friday":5, "Saturday":6, "Sunday":7 };
            
            allMonarchs.sort((a, b) => {
                if (dayOrder[a.Weekday] !== dayOrder[b.Weekday]) return dayOrder[a.Weekday] - dayOrder[b.Weekday];
                return a.TargetSec - b.TargetSec;
            });

            let listHTML = '';
            allMonarchs.forEach(row => {
                listHTML += `<div class="schedule-row"><span>${row.Weekday}, ${row.BossName}</span> <span>${row.TargetTime}</span></div>`;
            });

            dropdown.innerHTML = `<summary>View All Logged Times</summary><div class="schedule-list">${listHTML}</div>`;
            col.appendChild(dropdown);
        }

        grid.appendChild(col);
    });
}

// --- TIMER MATH & ALERTS ---
function updateTimers(nowSec, activeOffset) {
    const timerToggle = document.getElementById('timer-toggle');
    const isTimerOn = timerToggle ? timerToggle.checked : true;
    
    const soundToggle = document.getElementById('sound-toggle');
    const isGlobalSoundOn = soundToggle ? soundToggle.checked : false;
    const mutedRegions = JSON.parse(localStorage.getItem('neoTimerMutedRegions')) || [];

    document.querySelectorAll('.boss-card').forEach(card => {
        const isMonarch = card.classList.contains('monarch-card');
        const countdownEl = card.querySelector('.countdown');
        const targetSec = parseInt(card.dataset.targetSec, 10);
        const bName = card.dataset.bossName;
        const regionName = card.dataset.region; 
        
        const spawnId = `${bName}_${targetSec}_${activeOffset}`;
        let timeRemaining; // Added to track when to play the sound

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        if (isMonarch) {
            const killTimerEl = card.querySelector('.kill-timer');
            let timeSinceKill = nowSec - targetSec;
            if (timeSinceKill < 0) timeSinceKill += 86400; 
            
            if (killTimerEl) killTimerEl.innerText = formatDuration(timeSinceKill * 1000);
            
            const spawnIn = 9000 - timeSinceKill; 
            timeRemaining = spawnIn; // Store for audio check
            
            if (spawnIn > 0) {
                countdownEl.innerText = formatDuration(spawnIn * 1000);
                card.dataset.priority = "1";
            } else {
                countdownEl.innerText = `In Window`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0";
            }
        } else {
            const diffSec = (targetSec + (86400 * activeOffset)) - nowSec;
            timeRemaining = diffSec; // Store for audio check

            if (diffSec > 0) {
                countdownEl.innerText = isTimerOn ? formatDuration(diffSec * 1000) : `Announcement at: ${card.dataset.targetTime}`;
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
        }

        // --- NEW: INDEPENDENT AUDIO TRIGGER ---
        // Play sound if 5 minutes (300s) or less remain
        if (timeRemaining <= 300 && timeRemaining > -300) {
            if (isGlobalSoundOn && !mutedRegions.includes(regionName) && !window.notifiedBosses.has(spawnId)) {
                alertAudio.play().catch(e => console.log("Audio play blocked by browser."));
                window.notifiedBosses.add(spawnId); // Mark as notified
            }
        } else if (timeRemaining > 300) {
            // Reset the notification tracker ONLY if the timer is safely above 5 minutes
            window.notifiedBosses.delete(spawnId);
        }
    });

    document.querySelectorAll('.card-container').forEach(container => {
        const cards = Array.from(container.children);
        cards.sort((a, b) => {
            if (a.dataset.priority !== b.dataset.priority) return a.dataset.priority - b.dataset.priority;
            return parseInt(a.dataset.targetSec) - parseInt(b.dataset.targetSec);
        });
        cards.forEach(card => container.appendChild(card));
    });
}

function formatDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const pad = (n) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}
