const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Color Picker
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.target.getAttribute('data-color');
            // This changes the CSS variable, instantly updating the whole UI
            document.documentElement.style.setProperty('--accent-color', selectedColor);
        });
    });

    // 2. Fetch CSV Data
    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            buildDashboard(results.data);
            
            // Start the timer loop
            setInterval(updateTimers, 1000);
            updateTimers(); 
        }
    });

    // 3. Start Top Right Clock
    setInterval(updateTopClock, 1000);
    updateTopClock();
});

function updateTopClock() {
    const now = new Date();
    // Formats time as "2:00 AM"
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
        col.innerHTML = `<h3>${region}</h3>`;

        const regionBosses = todaysData.filter(row => row.Region === region);
        
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

function updateTimers() {
    const now = new Date(); 
    const countdownElements = document.querySelectorAll('.countdown');

    countdownElements.forEach(el => {
        const targetTimeStr = el.getAttribute('data-time');
        if (!targetTimeStr) return;
        
        const timeParts = targetTimeStr.split(':');
        const targetHours = parseInt(timeParts, 10);
        const targetMinutes = parseInt(timeParts, 10);
        
        const targetDate = new Date();
        targetDate.setHours(targetHours, targetMinutes, 0, 0);

        const diffMs = targetDate - now;
        const cardElement = el.closest('.boss-card');

        if (diffMs > 0) {
            // Future Boss
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            const formattedM = minutes.toString().padStart(2, '0');
            const formattedS = seconds.toString().padStart(2, '0');
            
            // Format to match screenshot: "3h 37m 08s"
            el.innerText = `${hours}h ${formattedM}m ${formattedS}s`;
            cardElement.classList.remove('dimmed'); 
            
        } else {
            // Past Boss
            el.innerText = `Spawned`;
            cardElement.classList.add('dimmed'); 
        }
    });
}
