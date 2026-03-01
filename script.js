const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

// --- PURE MATH TIME PARSER ---
function timeStrToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const h = parseInt(parts || 0, 10);
    const m = parseInt(parts || 0, 10);
    const s = parseInt(parts || 0, 10);
    return (h * 3600) + (m * 60) + s;
}

function formatDurationSeconds(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
    return `${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
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
    const currentSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    const resetSeconds = 6 * 3600; 

    let diffDaily = resetSeconds - currentSeconds;
    if (diffDaily < 0) diffDaily += 86400; 
    
    const dH = Math.floor(diffDaily / 3600);
    const dM = Math.floor((diffDaily % 3600) / 60);
    const dS = diffDaily % 60;
    document.getElementById('daily-reset').innerText = `${dH}h ${dM.toString().padStart(2, '0')}m ${dS.toString().padStart(2, '0')}s`;

    let weeklyTargetDate = new Date();
    weeklyTargetDate.setHours(6, 0, 0, 0);
    let currentDay = now.getDay();
    
    if (currentDay === 3 && now.getHours() >= 6) {
        weeklyTargetDate.setDate(weeklyTargetDate.getDate() + 7);
    } else {
        weeklyTargetDate.setDate(weeklyTargetDate.getDate() + ((3 - currentDay + 7) % 7));
    }
    
    let wDiffSec = Math.floor((weeklyTargetDate.getTime() - now.getTime()) / 1000);
    const wD = Math.floor(wDiffSec / 86400);
    const wH = Math.floor((wDiffSec % 86400) / 3600);
    const wM = Math.floor((wDiffSec % 3600) / 60);
    const wS = wDiffSec % 60;
    
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
                        <div class="math-debug" style="font-size:10px; color:var(--text-muted); margin-top:4px;"></div>
                    </div>`;
            } else {
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="boss-time">Time: ${displayTime}</p>
                    <div class="countdown-wrapper">
                        <div class="countdown" data-time="${fullTime}">--</div>
                        <div class="math-debug" style="font-size:10px; color:var(--text-muted); margin-top:4px;"></div>
                    </div>`;
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
    // Format device time exactly as it is checking it
    const deviceH = now.getHours().toString().padStart(2, '0');
    const deviceM = now.getMinutes().toString().padStart(2, '0');
    const currentSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

    const timerToggleEl = document.getElementById('timer-toggle');
    const isTimerOn = timerToggleEl ? timerToggleEl.checked : true;

    document.querySelectorAll('.boss-card').forEach(card => {
        const isMonarch = card.classList.contains('monarch-card');
        const countdownEl = card.querySelector('.countdown');
        const debugEl = card.querySelector('.math-debug');
        const targetTimeStr = card.dataset.target;
        
        const targetSeconds = timeStrToSeconds(targetTimeStr);
        const parsedH = Math.floor(targetSeconds / 3600).toString().padStart(2, '0');
        const parsedM = Math.floor((targetSeconds % 3600) / 60).toString().padStart(2, '0');

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        // DIAGNOSTIC PRINTOUT - This will tell us exactly where the math is failing
        if (debugEl) {
            debugEl.innerText = `Device: ${deviceH}:${deviceM} | Parsed: ${parsedH}:${parsedM}`;
        }

        if (isMonarch) {
            const killTimerEl = card.querySelector('.kill-timer');
            let diffKill = currentSeconds - targetSeconds;
            if (diffKill < 0) diffKill += 86400; 
            
            killTimerEl.innerText = formatDurationSeconds(diffKill);
            let remainingUntilSpawn = 9000 - diffKill;

            if (remainingUntilSpawn > 0) {
                countdownEl.innerText = formatDurationSeconds(remainingUntilSpawn);
                card.dataset.priority = "1"; 
            } else {
                countdownEl.innerText = `In Window`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0"; 
            }
        } else {
            let diff = targetSeconds - currentSeconds;
            if (diff < -43200) diff += 86400; 

            const displayTimeStr = targetTimeStr.length >= 5 ? targetTimeStr.substring(0, 5) : targetTimeStr;

            if (diff > 0) {
                countdownEl.innerText = isTimerOn ? formatDurationSeconds(diff) : `Announcement at: ${displayTimeStr}`;
                card.dataset.priority = "1"; 
            } else if (diff <= 0 && diff > -300) { 
                countdownEl.innerText = `Spawning in: ${formatDurationSeconds(300 + diff)}`;
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
