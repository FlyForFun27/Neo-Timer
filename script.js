const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
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

    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            buildDashboard(results.data);
            setInterval(updateTimers, 1000);
            updateTimers(); 
        },
        error: function(err) {
            console.error("Error loading CSV:", err);
        }
    });

    setInterval(updateTopClock, 1000);
    updateTopClock();
});

function updateTopClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    document.getElementById('top-clock').innerText = timeString;
}

function buildDashboard(data) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const todaysData = data.filter(row => row.Weekday === today);
    const activeRegionsForToday = [...new Set(todaysData.map(row => row.Region))];

    activeRegionsForToday.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.innerHTML = `<h3>${region.toUpperCase()}</h3>`;

        const regionBosses = todaysData.filter(row => row.Region === region);
        regionBosses.sort((a, b) => a.TargetTime.localeCompare(b.TargetTime));
        
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            
            if (region.toLowerCase() === 'monarch') {
                card.classList.add('monarch-card');
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="time-since-kill">Time since kill: <span class="kill-timer" data-time="${boss.TargetTime}">--h --m --s</span></p>
                    <div class="countdown-wrapper">
                        <div class="estimated-label">ESTIMATED SPAWN IN</div>
                        <div class="countdown" data-time="${boss.TargetTime}">Calculating...</div>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <p class="boss-name">${boss.BossName}</p>
                    <p class="boss-time">Time: ${boss.TargetTime}</p>
                    <div class="countdown-wrapper">
                        <div class="countdown" data-time="${boss.TargetTime}">Calculating...</div>
                    </div>
                `;
            }
            col.appendChild(card);
        });

        grid.appendChild(col);
    });
}

function updateTimers() {
    const now = new Date(); 
    const isTimerOn = document.getElementById('timer-toggle').checked;
    const cards = document.querySelectorAll('.boss-card');

    cards.forEach(card => {
        const isMonarch = card.classList.contains('monarch-card');
        const countdownEl = card.querySelector('.countdown');
        const targetTimeStr = countdownEl.getAttribute('data-time');
        
        if (!targetTimeStr) return;
        
        const timeParts = targetTimeStr.split(':');
        const targetHours = parseInt(timeParts, 10);
        const targetMinutes = parseInt(timeParts, 10);
        
        const targetDate = new Date();
        targetDate.setHours(targetHours, targetMinutes, 0, 0);

        card.classList.remove('dimmed');
        countdownEl.classList.remove('spawning');
        countdownEl.style.color = "";

        if (isMonarch) {
            const killTimerEl = card.querySelector('.kill-timer');
            let diffKill = now - targetDate;
            if (diffKill < 0) diffKill = 0; 
            
            const killH = Math.floor(diffKill / (1000 * 60 * 60));
            const killM = Math.floor((diffKill % (1000 * 60 * 60)) / (1000 * 60));
            const killS = Math.floor((diffKill % (1000 * 60)) / 1000);
            
            killTimerEl.innerText = `${killH}h ${killM}m ${killS}s`;

            // 2.5 hour window calculation
            const spawnDate = new Date(targetDate.getTime() + (2.5 * 60 * 60 * 1000));
            const diffSpawn = spawnDate - now;

            if (diffSpawn > 0) {
                const spawnH = Math.floor(diffSpawn / (1000 * 60 * 60));
                const spawnM = Math.floor((diffSpawn % (1000 * 60 * 60)) / (1000 * 60));
                const spawnS = Math.floor((diffSpawn % (1000 * 60)) / 1000);

                const formattedM = spawnM.toString().padStart(2, '0');
                const formattedS = spawnS.toString().padStart(2, '0');

                countdownEl.innerText = spawnH > 0 
                    ? `${spawnH}h ${formattedM}m ${formattedS}s` 
                    : `${formattedM}m ${formattedS}s`;
            } else {
                // Changed "Spawning / Active" to "In Window"
                countdownEl.innerText = `In Window`;
                countdownEl.classList.add('spawning');
            }

        } else {
            const diffMs = targetDate - now;

            if (diffMs > 0) {
                if (isTimerOn) {
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                    
                    const formattedM = minutes.toString().padStart(2, '0');
                    const formattedS = seconds.toString().padStart(2, '0');
                    
                    countdownEl.innerText = hours > 0 
                        ? `${hours}h ${formattedM}m ${formattedS}s` 
                        : `${formattedM}m ${formattedS}s`;
                } else {
                    countdownEl.innerText = `Announcement at: ${targetTimeStr}`;
                }
            } else if (diffMs <= 0 && diffMs > -300000) { 
                const spawnRemainingMs = 300000 + diffMs; 
                const minutes = Math.floor((spawnRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((spawnRemainingMs % (1000 * 60)) / 1000);
                
                countdownEl.innerText = `Spawning in: ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
                countdownEl.classList.add('spawning');
            } else {
                countdownEl.innerText = `Spawned`;
                card.classList.add('dimmed'); 
            }
        }
    });
}
