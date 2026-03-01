// The link to your published Google Sheet CSV
const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Color Picker (Changes the CSS variable)
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--accent-color', selectedColor);
        });
    });

    // 2. Initialize Timer Toggle Listener (Updates immediately when clicked)
    const timerToggle = document.getElementById('timer-toggle');
    if (timerToggle) {
        timerToggle.addEventListener('change', updateTimers);
    }

    // 3. Fetch CSV Data using PapaParse
    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            buildDashboard(results.data);
            
            // Start the main timer loop (updates every 1 second)
            setInterval(updateTimers, 1000);
            updateTimers(); // Run once immediately
        },
        error: function(err) {
            console.error("Error loading CSV:", err);
        }
    });

    // 4. Start Top Right Live Clock
    setInterval(updateTopClock, 1000);
    updateTopClock();
});

// Updates the small clock in the top right corner
function updateTopClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    document.getElementById('top-clock').innerText = timeString;
}

// Builds the UI columns and cards based on today's schedule
function buildDashboard(data) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    // Get today's weekday name (e.g., "Sunday", "Monday")
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

    // Filter for today's data and find active regions
    const todaysData = data.filter(row => row.Weekday === today);
    const activeRegionsForToday = [...new Set(todaysData.map(row => row.Region))];

    activeRegionsForToday.forEach(region => {
        // Create Region Column
        const col = document.createElement('div');
        col.className = 'region-column';
        col.innerHTML = `<h3>${region.toUpperCase()}</h3>`;

        // Get bosses for this region and SORT them by time (earliest first)
        const regionBosses = todaysData.filter(row => row.Region === region);
        regionBosses.sort((a, b) => a.TargetTime.localeCompare(b.TargetTime));
        
        // Build cards
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            
            card.innerHTML = `
                <p class="boss-name">${boss.BossName}</p>
                <p class="boss-time">Time: ${boss.TargetTime}</p>
                <div class="countdown-wrapper">
                    <div class="countdown" data-time="${boss.TargetTime}">Calculating...</div>
                </div>
            `;
            col.appendChild(card);
        });

        grid.appendChild(col);
    });
}

// The core math for all countdowns and states
function updateTimers() {
    const now = new Date(); 
    const isTimerOn = document.getElementById('timer-toggle').checked;
    const countdownElements = document.querySelectorAll('.countdown');

    countdownElements.forEach(el => {
        const targetTimeStr = el.getAttribute('data-time');
        if (!targetTimeStr) return;
        
        // Parse time (e.g., "14:55" -> 14 hours, 55 minutes)
        const timeParts = targetTimeStr.split(':');
        const targetHours = parseInt(timeParts, 10);
        const targetMinutes = parseInt(timeParts, 10);
        
        // Create a date object for the target time TODAY
        const targetDate = new Date();
        targetDate.setHours(targetHours, targetMinutes, 0, 0);

        // Difference in milliseconds
        const diffMs = targetDate - now;
        const cardElement = el.closest('.boss-card');

        // Reset visual states first
        cardElement.classList.remove('dimmed');
        el.classList.remove('spawning');
        el.style.color = ""; // Reset inline color changes

        // --- STATE 1: FUTURE EVENT ---
        if (diffMs > 0) {
            if (isTimerOn) {
                // Timer ON: Show Countdown
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                
                const formattedM = minutes.toString().padStart(2, '0');
                const formattedS = seconds.toString().padStart(2, '0');
                
                el.innerText = hours > 0 
                    ? `${hours}h ${formattedM}m ${formattedS}s` 
                    : `${formattedM}m ${formattedS}s`;
            } else {
                // Timer OFF: Show Announcement Time
                el.innerText = `Announcement in: ${targetTimeStr}`;
            }
            
        // --- STATE 2: SPAWNING (Between 0 and 5 minutes after Target Time) ---
        } else if (diffMs <= 0 && diffMs > -300000) { 
            // -300000ms is exactly -5 minutes. We add it to 5 mins (300000) to get remaining time
            const spawnRemainingMs = 300000 + diffMs; 
            
            const minutes = Math.floor((spawnRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((spawnRemainingMs % (1000 * 60)) / 1000);
            
            const formattedM = minutes.toString().padStart(2, '0');
            const formattedS = seconds.toString().padStart(2, '0');

            el.innerText = `Spawning in: ${formattedM}m ${formattedS}s`;
            el.classList.add('spawning'); // This class triggers the red CSS
            
        // --- STATE 3: PAST EVENT (More than 5 minutes after Target Time) ---
        } else {
            el.innerText = `Spawned`;
            cardElement.classList.add('dimmed'); // Greys out the whole card
        }
    });
}
