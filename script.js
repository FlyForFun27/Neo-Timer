const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    // Color Picker Logic
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
        });
    });

    const timerToggle = document.getElementById('timer-toggle');
    if (timerToggle) { 
        timerToggle.addEventListener('change', updateTimers); 
    }

    // Fetch CSV Data
    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            buildDashboard(results.data);
            setInterval(updateTimers, 1000);
            updateTimers(); 
        }
    });

    setInterval(updateTopClock, 1000);
    updateTopClock();
});

function updateTopClock() {
    const now = new Date();
    document.getElementById('top-clock').innerText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    // Also update Resets here
    const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    
    // Daily Reset (6:00 AM = 21600s)
    let dDiff = 21600 - nowSec;
    if (dDiff <= 0) dDiff += 86400;
    const dailyEl = document.getElementById('daily-reset');
    if (dailyEl) dailyEl.innerText = formatDuration(dDiff * 1000);

    // Weekly Reset (Wed 6:00 AM)
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

function buildDashboard(data) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    
    // Use the case-sensitive headers you provided
    const todaysData = data.filter(row => row.Weekday === today);
    const activeRegions = [...new Set(todaysData.map(row => row.Region))];

    activeRegions.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.innerHTML = `<h3>${region.toUpperCase()}</h3><div class="card-container"></div>`;
        
        const container = col.querySelector('.card-container');
        const regionBosses = todaysData.filter(row => row.Region === region);
        
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            
            // MAP RAW SECONDS AND STRINGS TO DATASETS
            card.dataset.targetSec = boss.TargetSec; 
            card.dataset.targetTime = boss.TargetTime;

            if (region.toLowerCase() === 'monarch') {
                
                // 1. Find all occurrences of this boss across the whole week/all channels
                const fullSchedule = data
                    .filter(row => row.BossName === boss.BossName)
                    .map(row => `<div class="schedule-row"><span>${row.Weekday} (${row.Region})</span> <span>${row.TargetTime}</span></div>`)
                    .join('');
                
            card.classList.add('monarch-card');
            card.innerHTML = `
                <p class="boss-name">${boss.BossName}</p>
                <p class="time-since-kill">Time since kill: <span class="kill-timer">--</span></p>
                <div class="countdown-wrapper">
                    <div class="estimated-label">ESTIMATED SPAWN IN</div>
                    <div class="countdown">--</div>
                </div>
                <div class="monarch-details">
                    <button class="schedule-toggle" onclick="toggleSchedule(this)">View Full Schedule ▼</button>
                    <div class="schedule-content">
                        ${fullSchedule}
                    </div>
                </div>`;
            } else {
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="boss-time">Time: ${boss.TargetTime}</p>
                    <div class="countdown-wrapper"><div class="countdown">--</div></div>`;
            }
            container.appendChild(card);
        });
        grid.appendChild(col);
    });
}

function updateTimers() {
    const now = new Date(); 
    // TRICK: Convert current time to raw seconds for pure math subtraction
    const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    
    const timerToggle = document.getElementById('timer-toggle');
    const isTimerOn = timerToggle ? timerToggle.checked : true;

    document.querySelectorAll('.boss-card').forEach(card => {
        const isMonarch = card.classList.contains('monarch-card');
        const countdownEl = card.querySelector('.countdown');
        const targetSec = parseInt(card.dataset.targetSec, 10);
        
        const diffSec = targetSec - nowSec;

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        if (isMonarch) {
            const killTimerEl = card.querySelector('.kill-timer');
            // Monarch logic: 2.5 hours = 9000 seconds
            let timeSinceKill = nowSec - targetSec;
            if (timeSinceKill < 0) timeSinceKill += 86400; // Cross-day fix
            
            if (killTimerEl) killTimerEl.innerText = formatDuration(timeSinceKill * 1000);
            
            const spawnIn = 9000 - timeSinceKill;
            if (spawnIn > 0) {
                countdownEl.innerText = formatDuration(spawnIn * 1000);
                card.dataset.priority = "1";
            } else {
                countdownEl.innerText = `In Window`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0";
            }
        } else {
            // Standard Boss Logic (Subtracting Integers)
            if (diffSec > 0) {
                countdownEl.innerText = isTimerOn ? formatDuration(diffSec * 1000) : `Announcement at: ${card.dataset.targetTime}`;
                card.dataset.priority = "1";
            } else if (diffSec <= 0 && diffSec > -300) { // 300s = 5 min window
                countdownEl.innerText = `Spawning in: ${formatDuration((300 + diffSec) * 1000)}`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0";
            } else {
                countdownEl.innerText = `Spawned`;
                card.classList.add('dimmed');
                card.dataset.priority = "2";
            }
        }
    });

    // --- SORTING LOGIC ---
    document.querySelectorAll('.card-container').forEach(container => {
        const cards = Array.from(container.children);
        cards.sort((a, b) => {
            if (a.dataset.priority !== b.dataset.priority) {
                return a.dataset.priority - b.dataset.priority;
            }
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
    
    if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
    return `${pad(m)}m ${pad(s)}s`;
}
