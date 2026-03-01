const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

// SET TO 'true' IF YOUR SHEET TIMES ARE SERVER TIME (UTC)
// SET TO 'false' IF YOUR SHEET TIMES ARE YOUR LOCAL TIME
const USE_UTC_TIME = false; 

// --- ORIGINAL PARSING HELPER ---
function parseTimeStr(timeStr) {
    if (!timeStr) return { h: 0, m: 0, s: 0 };
    const parts = timeStr.split(':');
    return {
        h: parseInt(parts, 10) || 0,
        m: parseInt(parts, 10) || 0,
        s: parts ? parseInt(parts, 10) : 0
    };
}

// --- ORIGINAL FORMATTER ---
function formatDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 
        ? `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s` 
        : `${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

document.addEventListener("DOMContentLoaded", () => {
    const savedColor = localStorage.getItem('neoTimerThemeColor');
    if (savedColor) document.documentElement.style.setProperty('--accent-color', savedColor);

    const timerToggle = document.getElementById('timer-toggle');
    const savedToggle = localStorage.getItem('neoTimerToggleState');
    if (timerToggle) {
        if (savedToggle !== null) timerToggle.checked = savedToggle === 'true';
        timerToggle.addEventListener('change', (e) => {
            localStorage.setItem('neoTimerToggleState', e.target.checked);
            updateTimers();
        });
    }

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
            localStorage.setItem('neoTimerThemeColor', selectedColor);
        });
    });

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
    setInterval(updateResetTimers, 1000);
    updateTopClock();
    updateResetTimers();
});

function updateTopClock() {
    const now = new Date();
    document.getElementById('top-clock').innerText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function updateResetTimers() {
    const now = new Date();
    const dailyReset = new Date();
    const weeklyReset = new Date();

    if (USE_UTC_TIME) {
        dailyReset.setUTCHours(6, 0, 0, 0);
        weeklyReset.setUTCHours(6, 0, 0, 0);
    } else {
        dailyReset.setHours(6, 0, 0, 0);
        weeklyReset.setHours(6, 0, 0, 0);
    }
    
    // Daily Math
    if (now >= dailyReset) {
        dailyReset.setDate(dailyReset.getDate() + 1);
    }
    const dDiff = dailyReset - now;
    const dH = Math.floor(dDiff / 3600000);
    const dM = Math.floor((dDiff % 3600000) / 60000);
    const dS = Math.floor((dDiff % 60000) / 1000);
    document.getElementById('daily-reset').innerText = `${dH}h ${dM.toString().padStart(2, '0')}m ${dS.toString().padStart(2, '0')}s`;

    // Weekly Math (Wednesday)
    let daysUntilWed = (3 - weeklyReset.getDay() + 7) % 7;
    if (daysUntilWed === 0 && now >= weeklyReset) {
        daysUntilWed = 7;
    }
    weeklyReset.setDate(weeklyReset.getDate() + daysUntilWed);
    
    const wDiff = weeklyReset - now;
    const wD = Math.floor(wDiff / 86400000);
    const wH = Math.floor((wDiff % 86400000) / 3600000);
    const wM = Math.floor((wDiff % 3600000) / 60000);
    const wS = Math.floor((wDiff % 60000) / 1000);
    const daysStr = wD > 0 ? `${wD}d ` : '';
    document.getElementById('weekly-reset').innerText = `${daysStr}${wH}h ${wM.toString().padStart(2, '0')}m ${wS.toString().padStart(2, '0')}s`;
}

function buildDashboard(data) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const todaysData = data.filter(row => row.Weekday === today);
    const activeRegions = [...new Set(todaysData.map(row => row.Region))];

    activeRegions.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.innerHTML = `<h3>${region.toUpperCase()}</h3><div class="card-container"></div>`;
        const container = col.querySelector('.card-container');
        
        todaysData.filter(row => row.Region === region).forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            const fullTime = boss.TargetTime; 
            card.dataset.target = fullTime; 
            const displayTime = fullTime.length >= 5 ? fullTime.substring(0, 5) : fullTime;

            if (region.toLowerCase() === 'monarch') {
                card.classList.add('monarch-card');
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="time-since-kill">Time since kill: <span class="kill-timer" data-time="${fullTime}">--</span></p>
                    <div class="countdown-wrapper">
                        <div class="estimated-label">ESTIMATED SPAWN IN</div>
                        <div class="countdown" data-time="${fullTime}">--</div>
                    </div>`;
            } else {
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="boss-time">Time: ${displayTime}</p>
                    <div class="countdown-wrapper"><div class="countdown" data-time="${fullTime}">--</div></div>`;
            }
            container.appendChild(card);
        });

        if (region.toLowerCase() === 'monarch') {
            const details = document.createElement('details');
            details.className = 'monarch-dropdown';
            let listHTML = '';
            const allMonarchBosses = data.filter(row => row.Region && row.Region.toLowerCase() === 'monarch');
            const daysOfWeek = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
            
            allMonarchBosses.sort((a, b) => {
                if (daysOfWeek[a.Weekday] !== daysOfWeek[b.Weekday]) return daysOfWeek[a.Weekday] - daysOfWeek[b.Weekday];
                return a.TargetTime.localeCompare(b.TargetTime);
            });
            
            allMonarchBosses.forEach(b => {
                const dropDisplayTime = b.TargetTime.length >= 5 ? b.TargetTime.substring(0, 5) : b.TargetTime;
                listHTML += `<li><strong>${b.Weekday}, ${b.BossName}</strong> <span>${dropDisplayTime}</span></li>`;
            });

            details.innerHTML = `<summary>View All Logged Times</summary><ul>${listHTML}</ul>`;
            col.appendChild(details); 
        }
        grid.appendChild(col);
    });
}

function updateTimers() {
    const now = new Date(); 
    const timerToggleEl = document.getElementById('timer-toggle');
    const isTimerOn = timerToggleEl ? timerToggleEl.checked : true;

    document.querySelectorAll('.boss-card').forEach(card => {
        const isMonarch = card.classList.contains('monarch-card');
        const countdownEl = card.querySelector('.countdown');
        const targetTimeStr = card.dataset.target;
        
        const t = parseTimeStr(targetTimeStr);
        const targetDate = new Date();
        
        if (USE_UTC_TIME) {
            targetDate.setUTCHours(t.h, t.m, t.s, 0);
        } else {
            targetDate.setHours(t.h, t.m, t.s, 0);
        }

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        if (isMonarch) {
            const killTimerEl = card.querySelector('.kill-timer');
            let diffKill = now - targetDate;
            
            // If the kill target was earlier today (or yesterday), prevent negative numbers
            if (diffKill < 0) {
                diffKill = 0;
            }
            
            killTimerEl.innerText = formatDuration(diffKill);

            const spawnDate = new Date(targetDate.getTime() + (2.5 * 3600000));
            const diffSpawn = spawnDate - now;

            if (diffSpawn > 0) {
                countdownEl.innerText = formatDuration(diffSpawn);
                card.dataset.priority = "1"; 
            } else {
                countdownEl.innerText = `In Window`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0"; 
            }
        } else {
            const diffMs = targetDate - now;
            const displayTimeStr = targetTimeStr.length >= 5 ? targetTimeStr.substring(0, 5) : targetTimeStr;

            if (diffMs > 0) {
                countdownEl.innerText = isTimerOn ? formatDuration(diffMs) : `Announcement at: ${displayTimeStr}`;
                card.dataset.priority = "1"; 
            } else if (diffMs <= 0 && diffMs > -300000) { 
                countdownEl.innerText = `Spawning in: ${formatDuration(300000 + diffMs)}`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0"; 
            } else {
                countdownEl.innerText = `Spawned`;
                card.classList.add('dimmed');
                card.dataset.priority = "2"; 
            }
        }
    });

    document.querySelectorAll('.card-container').forEach(container => {
        const cards = Array.from(container.children);
        cards.sort((a, b) => {
            if (a.dataset.priority !== b.dataset.priority) {
                return a.dataset.priority - b.dataset.priority;
            }
            return a.dataset.target.localeCompare(b.dataset.target);
        });
        cards.forEach(card => container.appendChild(card));
    });
}
