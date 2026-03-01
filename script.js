const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRlBFHRViiLrjzmlEvxgI8-1UNwfrJWJU7fsej4eO6dLOEEzozvd_03KmgWhAIZonrzb2QupMcvVK/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            buildDashboard(results.data);
            
            // Start the timer loop to update every 1000 milliseconds (1 second)
            setInterval(updateTimers, 1000);
            updateTimers(); // Run it once immediately so there's no 1-second delay
        },
        error: function(error) {
            console.error("Error fetching data:", error);
        }
    });
});

function buildDashboard(data) {
    const grid = document.getElementById('timers-grid');
    grid.innerHTML = ''; 
    
    // Get today's weekday name
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

    // Filter data for today only
    const todaysData = data.filter(row => row.Weekday === today);
    const activeRegionsForToday = [...new Set(todaysData.map(row => row.Region))];

    activeRegionsForToday.forEach(region => {
        const col = document.createElement('div');
        col.className = 'region-column';
        col.innerHTML = `<h3>${region.toUpperCase()}</h3>`;

        const regionBosses = todaysData.filter(row => row.Region === region);
        
        regionBosses.forEach(boss => {
            const card = document.createElement('div');
            card.className = 'boss-card';
            
            // Notice we added data-time="${boss.TargetTime}" to the countdown div
            card.innerHTML = `
                <p class="boss-name">${boss.BossName}</p>
                <p class="boss-time">Time: ${boss.TargetTime}</p>
                <div class="countdown" data-time="${boss.TargetTime}">Calculating...</div>
            `;
            col.appendChild(card);
        });

        grid.appendChild(col);
    });
}

// The core math and color-changing logic
function updateTimers() {
    const now = new Date(); // Current browser time
    const countdownElements = document.querySelectorAll('.countdown');

    countdownElements.forEach(el => {
        const targetTimeStr = el.getAttribute('data-time'); // e.g., "14:55"
        
        // Split "14:55" into hours and minutes
        const timeParts = targetTimeStr.split(':');
        const targetHours = parseInt(timeParts, 10);
        const targetMinutes = parseInt(timeParts, 10);
        
        // Create a Date object for TODAY at the target time
        const targetDate = new Date();
        targetDate.setHours(targetHours, targetMinutes, 0, 0);

        // Calculate the difference in milliseconds
        const diffMs = targetDate - now;
        const cardElement = el.closest('.boss-card');

        if (diffMs > 0) {
            // FUTURE SPAWN: Do the math to get hours, minutes, seconds
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            // Format minutes and seconds to always show two digits (e.g., "08s" instead of "8s")
            const formattedM = minutes.toString().padStart(2, '0');
            const formattedS = seconds.toString().padStart(2, '0');
            
            el.innerText = `${hours}h ${formattedM}m ${formattedS}s`;
            cardElement.classList.remove('dimmed'); // Ensure it has the bright neon colors
            
        } else {
            // PAST SPAWN: Time has already passed today
            el.innerText = `Spawned`;
            cardElement.classList.add('dimmed'); // Apply the greyed-out style
        }
    });
}
