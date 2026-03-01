const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    // --- 1. LOAD SAVED COLOR (If it exists) ---
    const savedColor = localStorage.getItem('neoTimerThemeColor');
    if (savedColor) {
        document.documentElement.style.setProperty('--accent-color', savedColor);
    }

    // --- 2. COLOR PICKER LOGIC ---
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
            
            // --- SAVE NEW COLOR TO LOCAL STORAGE ---
            localStorage.setItem('neoTimerThemeColor', selectedColor);
        });
    });

    // --- 3. TIMER TOGGLE ---
    const timerToggle = document.getElementById('timer-toggle');
    if (timerToggle) { timerToggle.addEventListener('change', updateTimers); }

    // --- 4. FETCH DATA ---
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
    
// (Existing code for Top Clock...)
    setInterval(updateTopClock, 1000);
    updateTopClock();

    // --- NEW: Start Reset Timers ---
    setInterval(updateResetTimers, 1000);
    updateResetTimers();
    
});

function updateTopClock() {
    const now = new Date();
    document.getElementById('top-clock').innerText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
        const regionBosses = todaysData.filter(row => row.Region === region);
        
        // Build the active cards for TODAY
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            card.dataset.target = boss.TargetTime; 

            if (region.toLowerCase() === 'monarch') {
                card.classList.add('monarch-card');
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="time-since-kill">Time since kill: <span class="kill-timer" data-time="${boss.TargetTime}">--</span></p>
                    <div class="countdown-wrapper">
                        <div class="estimated-label">ESTIMATED SPAWN IN</div>
                        <div class="countdown" data-time="${boss.TargetTime}">--</div>
                    </div>`;
            } else {
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="boss-time">Time: ${boss.TargetTime}</p>
                    <div class="countdown-wrapper"><div class="countdown" data-time="${boss.TargetTime}">--</div></div>`;
            }
            container.appendChild(card);
        });

        // Inject the Collapsible Dropdown for ALL Monarch Times
        if (region.toLowerCase() === 'monarch') {
            const details = document.createElement('details');
            details.className = 'monarch-dropdown';
            
            let listHTML = '';
            
            const allMonarchBosses = data.filter(row => row.Region && row.Region.toLowerCase() === 'monarch');
            const daysOfWeek = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
            
            allMonarchBosses.sort((a, b) => {
                if (daysOfWeek[a.Weekday] !== daysOfWeek[b.Weekday]) {
                    return daysOfWeek[a.Weekday] - daysOfWeek[b.Weekday];
                }
                return a.TargetTime.localeCompare(b.TargetTime);
            });
            
            allMonarchBosses.forEach(b => {
                listHTML += `<li><strong>${b.Weekday}, ${b.BossName}</strong> <span>${b.TargetTime}</span></li>`;
            });

            details.innerHTML = `
                <summary>View All Logged Times</summary>
                <ul>${listHTML}</ul>
            `;
            col.appendChild(details); 
        }

        grid.appendChild(col);
    });
}

function updateTimers() {
    const now = new Date(); 
    const isTimerOn = document.getElementById('timer-toggle').checked;

    document.querySelectorAll('.boss-card').forEach(card => {
        const isMonarch = card.classList.contains('monarch-card');
        const countdownEl = card.querySelector('.countdown');
        const targetTimeStr = card.dataset.target;
        
        const timeParts = targetTimeStr.split(':');
        const targetDate = new Date();
        targetDate.setHours(parseInt(timeParts), parseInt(timeParts), 0, 0);

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');

        if (isMonarch) {
            const killTimerEl = card.querySelector('.kill-timer');
            let diffKill = now - targetDate;
            killTimerEl.innerText = formatDuration(diffKill >= 0 ? diffKill : 0);

            const spawnDate = new Date(targetDate.getTime() + (2.5 * 60 * 60 * 1000));
            const diffSpawn = spawnDate - now;

            if (diffSpawn > 0) {
                countdownEl.innerText = formatDuration(diffSpawn);
                card.dataset.priority = "1"; // Upcoming
            } else {
                countdownEl.innerText = `In Window`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0"; // Highest priority
            }
        } else {
            const diffMs = targetDate - now;
            if (diffMs > 0) {
                countdownEl.innerText = isTimerOn ? formatDuration(diffMs) : `Announcement at: ${targetTimeStr}`;
                card.dataset.priority = "1"; // Upcoming
            } else if (diffMs <= 0 && diffMs > -300000) { 
                countdownEl.innerText = `Spawning in: ${formatDuration(300000 + diffMs)}`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0"; // Highest Priority
            } else {
                countdownEl.innerText = `Spawned`;
                card.classList.add('dimmed');
                card.dataset.priority = "2"; // Drops to bottom
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
            return a.dataset.target.localeCompare(b.dataset.target);
        });
        cards.forEach(card => container.appendChild(card));
    });
}

function formatDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 
        ? `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s` 
        : `${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

function updateResetTimers() {
    const now = new Date();

    // --- 1. Daily Reset (Every day at 6:00 AM) ---
    const dailyReset = new Date();
    dailyReset.setHours(6, 0, 0, 0);
    
    // If it is currently past 6:00 AM today, the next reset is tomorrow
    if (now >= dailyReset) {
        dailyReset.setDate(dailyReset.getDate() + 1);
    }
    
    const dDiff = dailyReset - now;
    const dH = Math.floor(dDiff / (1000 * 60 * 60));
    const dM = Math.floor((dDiff % (1000 * 60 * 60)) / (1000 * 60));
    const dS = Math.floor((dDiff % (1000 * 60)) / 1000);
    
    document.getElementById('daily-reset').innerText = 
        `${dH}h ${dM.toString().padStart(2, '0')}m ${dS.toString().padStart(2, '0')}s`;

    // --- 2. Weekly Reset (Every Wednesday at 6:00 AM) ---
    const weeklyReset = new Date();
    weeklyReset.setHours(6, 0, 0, 0);
    
    // Date.getDay() returns 0 for Sunday, 1 for Monday, 2 for Tue, 3 for Wed
    let daysUntilWed = (3 - weeklyReset.getDay() + 7) % 7;
    
    // If today is Wednesday (0 days until) BUT it's already past 6:00 AM, push to next week (+7)
    if (daysUntilWed === 0 && now >= weeklyReset) {
        daysUntilWed = 7;
    }
    weeklyReset.setDate(weeklyReset.getDate() + daysUntilWed);
    
    const wDiff = weeklyReset - now;
    const wD = Math.floor(wDiff / (1000 * 60 * 60 * 24));
    const wH = Math.floor((wDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const wM = Math.floor((wDiff % (1000 * 60 * 60)) / (1000 * 60));
    const wS = Math.floor((wDiff % (1000 * 60)) / 1000);

    // Only display days if there is 1 or more days left
    const daysStr = wD > 0 ? `${wD}d ` : '';
    document.getElementById('weekly-reset').innerText = 
        `${daysStr}${wH}h ${wM.toString().padStart(2, '0')}m ${wS.toString().padStart(2, '0')}s`;
}
