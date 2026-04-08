const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

// Connected Web App URL
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzxRardOzzkFklkLqieEumNdWwJxlenqslfkap3BPp9d9_tWrQlHje053-EHa4B1GbiYw/exec"; 

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

const alertAudio = new Audio('SoundAlert.mp3');

document.addEventListener("DOMContentLoaded", () => {
    const savedColor = localStorage.getItem('neoTimerThemeColor');
    if (savedColor) document.documentElement.style.setProperty('--accent-color', savedColor);

    const savedVolume = localStorage.getItem('neoTimerVolume');
    if (savedVolume !== null) {
        alertAudio.volume = parseFloat(savedVolume);
    } else {
        alertAudio.volume = 0.2;
    }

    const timerToggle = document.getElementById('timer-toggle');
    const savedToggle = localStorage.getItem('neoTimerToggleState');
    if (timerToggle) {
        if (savedToggle !== null) timerToggle.checked = savedToggle === 'true';
        timerToggle.addEventListener('change', (e) => {
            localStorage.setItem('neoTimerToggleState', e.target.checked);
            if (window.globalCsvData) tick(); 
        });
    }

    const soundToggle = document.getElementById('sound-toggle');
    const savedSound = localStorage.getItem('neoTimerSoundState');
    if (soundToggle) {
        if (savedSound !== null) soundToggle.checked = savedSound === 'true';
        soundToggle.addEventListener('change', (e) => localStorage.setItem('neoTimerSoundState', e.target.checked));
    }

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

    // NEW: Load Local Time Toggle
    const localTimeToggle = document.getElementById('local-time-toggle');
    const savedLocalTime = localStorage.getItem('neoTimerLocalTime');
    if (localTimeToggle) {
        if (savedLocalTime !== null) localTimeToggle.checked = savedLocalTime === 'true';
        localTimeToggle.addEventListener('change', (e) => {
            localStorage.setItem('neoTimerLocalTime', e.target.checked);
            if (window.globalCsvData) {
                window.currentDayOffset = null; // Force UI rebuild to update strings
                tick(); 
            }
        });
    }

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
            localStorage.setItem('neoTimerThemeColor', selectedColor);
        });
    });

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

function submitMonarchTime(region, boss, timeStr, isSpawn) {
    if (WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") return;
    
    fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ region: region, boss: boss, time: timeStr, isSpawn: isSpawn })
    }).catch(err => console.error("Error submitting time:", err));
}

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

function getServerOffsetHours(region) {
    if (region === 'NA') return -6; 
    if (region === 'TW') return 8; 
    return 1; // EU
}

// HELPER: Converts server seconds to a displayable string, accounting for Local Time toggle
function formatDisplayTime(targetSec, offsetHours, isLocalTime, is12Hour) {
    if (isNaN(targetSec)) return "--:--";
    let finalSec = targetSec;
    
    if (isLocalTime) {
        let utcSec = targetSec - (offsetHours * 3600);
        let localOffsetSec = -new Date().getTimezoneOffset() * 60; 
        finalSec = utcSec + localOffsetSec;
    }
    
    while (finalSec < 0) finalSec += 86400;
    finalSec = finalSec % 86400;
    
    const h = Math.floor(finalSec / 3600);
    const m = Math.floor((finalSec % 3600) / 60);
    if (is12Hour) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    } else {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
}

function tick() {
    if (!window.globalCsvData) return;
    
    const savedRegion = localStorage.getItem('neoTimerRegion') || 'EU';
    let offsetHours = getServerOffsetHours(savedRegion);

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

function updateTopClock(now, nowSec, region) {
    const is12Hour = localStorage.getItem('neoTimer12Hour') === 'true';
    const isLocalTime = localStorage.getItem('neoTimerLocalTime') === 'true';
    
    // The top clock displays the region timezone by default, unless Local Time is checked
    let displayDate = isLocalTime ? new Date() : now; 
    let labelPrefix = isLocalTime ? "Local" : region;
    
    const timeStr = displayDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: is12Hour });
    document.getElementById('top-clock').innerText = `${labelPrefix} | ${timeStr}`;
    
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

function buildDashboard(data, offset, now, currentRegion) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + offset);
    const displayDayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);
    
    const is12Hour = localStorage.getItem('neoTimer12Hour') === 'true';
    const isLocalTime = localStorage.getItem('neoTimerLocalTime') === 'true';
    const offsetHours = getServerOffsetHours(currentRegion);

    const displayStandardBosses = data.filter(row => row.Weekday === displayDayStr && row.Region && row.Region.toLowerCase() !== 'monarch');
    const activeRegions = [...new Set(displayStandardBosses.map(row => row.Region))];

    activeRegions.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.dataset.regionColumn = region;
        
        col.innerHTML = `<h3>${region.toUpperCase()}</h3><div class="card-container"></div>`;
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
            let displayTime = formatDisplayTime(tSec, offsetHours, isLocalTime, is12Hour);
            card.dataset.displayTime = displayTime;

            card.innerHTML = `
                <p class="boss-name">${boss.BossName}</p>
                <p class="boss-time">Time: ${displayTime}</p>
                <div class="countdown-wrapper"><div class="countdown">--</div></div>`;
            container.appendChild(card);
        });

        grid.appendChild(col);
    });

    buildMonarchColumn(grid);
    applyVisibility(); 
}

function buildMonarchColumn(grid) {
    const col = document.createElement('div');
    col.className = 'region-column';
    col.dataset.regionColumn = "Monarch";
    col.innerHTML = `<h3>MONARCH</h3><div class="card-container monarch-container"></div>`;
    const container = col.querySelector('.card-container');

    MONARCH_BOSSES.forEach(bossName => {
        const card = document.createElement('div');
        card.className = 'boss-card monarch-card';
        card.dataset.bossName = bossName;
        card.dataset.region = "Monarch"; 

        card.innerHTML = `
            <p class="boss-name">${bossName}</p>
            <div class="monarch-controls" style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0;">
                <span class="monarch-label" style="color: var(--accent-color);">SUBMIT TIME:</span>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: var(--text-light);">Announcement Time</span>
                    <label class="switch" style="transform: scale(0.7); margin: 0;">
                        <input type="checkbox" class="spawn-toggle" data-boss="${bossName}">
                        <span class="slider round"></span>
                    </label>
                    <span style="font-size: 11px; color: var(--text-light);">Spawn Time</span>
                    
                    <div class="time-input-group" style="margin-left: 5px; min-height: unset;">
                        <input type="text" class="monarch-time-input" data-boss="${bossName}" placeholder="HH:MM" maxlength="5">
                        <span class="submit-msg" style="display:none;">Submitted</span>
                    </div>
                </div>
            </div>
            <p class="time-since-kill">Last Announced: <span class="avg-time">--:--</span></p>
            <p class="time-since-kill">Time since: <span class="kill-timer">--</span></p>
            <div class="countdown-wrapper" style="margin-top: 15px;">
                <div class="estimated-label">ESTIMATED SPAWN IN</div>
                <div class="countdown">--</div>
            </div>`;
        container.appendChild(card);
    });

    grid.appendChild(col);

    document.querySelectorAll('.monarch-time-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const bName = e.target.dataset.boss;
            let bTime = e.target.value.trim();
            const reg = localStorage.getItem('neoTimerRegion') || 'EU';
            
            if (bTime === "") return;

            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(bTime)) {
                alert("Please enter a valid 24h time (e.g., 08:30 or 14:45)");
                e.target.value = "";
                return;
            }

            // TRANSLATION ENGINE: Convert Local Time submission back to Server Time before sending
            const isLocalTime = localStorage.getItem('neoTimerLocalTime') === 'true';
            if (isLocalTime) {
                const parts = bTime.split(':');
                let submitSec = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60);
                let localOffsetSec = -new Date().getTimezoneOffset() * 60;
                let offsetHours = getServerOffsetHours(reg);
                
                let utcSec = submitSec - localOffsetSec;
                submitSec = utcSec + (offsetHours * 3600);
                
                while (submitSec < 0) submitSec += 86400;
                submitSec = submitSec % 86400;
                
                let h = Math.floor(submitSec / 3600);
                let m = Math.floor((submitSec % 3600) / 60);
                bTime = (h.toString().padStart(2, '0')) + ":" + (m.toString().padStart(2, '0'));
            }
            
            const toggle = document.querySelector(`.spawn-toggle[data-boss="${bName}"]`);
            const isSpawn = toggle ? toggle.checked : false;

            submitMonarchTime(reg, bName, bTime, isSpawn);
            
            const group = e.target.closest('.time-input-group');
            const msg = group.querySelector('.submit-msg');
            e.target.style.display = 'none';
            msg.style.display = 'inline-block';
            msg.style.width = '45px'; 
            msg.style.textAlign = 'center';

            setTimeout(() => {
                e.target.value = '';
                e.target.style.display = 'inline-block';
                msg.style.display = 'none';
                if (toggle) toggle.checked = false; 
            }, 5000);
            
            fetchCommunityMonarchs(); 
        });
    });
}

function updateTimers(nowSec, activeOffset, currentRegion) {
    const timerToggle = document.getElementById('timer-toggle');
    const isTimerOn = timerToggle ? timerToggle.checked : true;
    
    const soundToggle = document.getElementById('sound-toggle');
    const isGlobalSoundOn = soundToggle ? soundToggle.checked : false;
    const mutedRegions = JSON.parse(localStorage.getItem('neoTimerMutedRegions')) || [];

    const is12Hour = localStorage.getItem('neoTimer12Hour') === 'true';
    const isLocalTime = localStorage.getItem('neoTimerLocalTime') === 'true';
    const offsetHours = getServerOffsetHours(currentRegion);

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
        const avgTimeEl = card.querySelector('.avg-time');
        const labelEl = card.querySelector('.estimated-label');
        const bName = card.dataset.bossName;
        
        let rawServerTime = "";
        if (window.communityMonarchKills[currentRegion] && window.communityMonarchKills[currentRegion][bName]) {
            rawServerTime = window.communityMonarchKills[currentRegion][bName];
        }
        
        let displayStr = "--:--";
        if (rawServerTime !== "") {
            const [kh, km] = rawServerTime.split(':').map(Number);
            const targetSec = (kh * 3600) + (km * 60);
            displayStr = formatDisplayTime(targetSec, offsetHours, isLocalTime, is12Hour);
        }
        
        avgTimeEl.innerText = displayStr;
        
        const spawnId = `Monarch_${bName}`;
        
        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        if (!rawServerTime) {
            killTimerEl.innerText = "--";
            labelEl.innerText = "ESTIMATED SPAWN IN";
            countdownEl.innerText = "Awaiting Time";
            card.dataset.priority = "3";
            return;
        }

        const [sh, sm] = rawServerTime.split(':').map(Number);
        const killSec = (sh * 3600) + (sm * 60);

        let timeSinceKill = nowSec - killSec;
        if (timeSinceKill < 0) timeSinceKill += 86400; 

        killTimerEl.innerText = formatDuration(timeSinceKill * 1000);
        
        let timeRemaining = 7200 - timeSinceKill;

        if (timeSinceKill < 7200) {
            labelEl.innerText = "NEXT SPAWN WINDOW IN";
            countdownEl.innerText = formatDuration((7200 - timeSinceKill) * 1000);
            card.dataset.priority = "1";
        } 
        else if (timeSinceKill < 18000) { 
            labelEl.innerText = "IN WINDOW FOR";
            countdownEl.innerText = formatDuration((timeSinceKill - 7200) * 1000);
            countdownEl.classList.add('spawning'); 
            card.dataset.priority = "0"; 
        } 
        else { 
            labelEl.innerText = "STATUS";
            countdownEl.innerText = `Spawn missed`;
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
