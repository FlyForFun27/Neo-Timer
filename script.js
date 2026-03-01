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
    if (timerToggle) { timerToggle.addEventListener('change', updateTimers); }

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
}

function buildDashboard(data) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    // --- 1. Find Today and Yesterday ---
    const todayObj = new Date();
    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);

    const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
    const todayName = formatter.format(todayObj);
    const yesterdayName = formatter.format(yesterdayObj);

    // --- 2. Filter Data ---
    let todaysData = data.filter(row => row.Weekday === todayName);

    // Grab yesterday's Monarch data
    const yesterdayMonarch = data.filter(row => row.Weekday === yesterdayName && row.Region.toLowerCase() === 'monarch');
    const channels = [...new Set(yesterdayMonarch.map(row => row.BossName))];
    
    // Find the LATEST kill from yesterday for each channel
    channels.forEach(channel => {
        const channelSpawns = yesterdayMonarch.filter(row => row.BossName === channel);
        // Sort descending (latest time first)
        channelSpawns.sort((a, b) => b.TargetTime.localeCompare(a.TargetTime));
        
        // Add only the latest spawn to today's data, flagged as 'isYesterday'
        todaysData.push({
            ...channelSpawns,
            isYesterday: true
        });
    });

    const activeRegions = [...new Set(todaysData.map(row => row.Region))];

    // --- 3. Build the UI ---
    activeRegions.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.innerHTML = `<h3>${region.toUpperCase()}</h3><div class="card-container"></div>`;
        
        const container = col.querySelector('.card-container');
        const regionBosses = todaysData.filter(row => row.Region === region);
        
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            card.dataset.target = boss.TargetTime; 
            card.dataset.yesterday = boss.isYesterday ? "true" : "false"; // Store yesterday flag

            // Optional: Add a subtle "(Yesterday)" label so you know where the data came from
            const timeLabel = boss.isYesterday ? `${boss.TargetTime} (Yesterday)` : boss.TargetTime;

            if (region.toLowerCase() === 'monarch') {
                card.classList.add('monarch-card');
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="time-since-kill">Kill logged: <span style="color:var(--text-muted); font-size:11px;">${timeLabel}</span><br>Time since kill: <span class="kill-timer" data-time="${boss.TargetTime}">--</span></p>
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
        const isYesterday = card.dataset.yesterday === "true"; // Check if it's yesterday's card
        
        const timeParts = targetTimeStr.split(':');
        const targetDate = new Date();
        targetDate.setHours(parseInt(timeParts), parseInt(timeParts), 0, 0);

        // --- THE MAGIC: Push the clock back 24 hours if it's from yesterday ---
        if (isYesterday) {
            targetDate.setDate(targetDate.getDate() - 1);
        }

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
                card.dataset.priority = "1"; 
            } else if (diffMs <= 0 && diffMs > -300000) { 
                countdownEl.innerText = `Spawning in: ${formatDuration(300000 + diffMs)}`;
                countdownEl.classList.add('spawning');
                card.dataset.priority = "0"; 
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
