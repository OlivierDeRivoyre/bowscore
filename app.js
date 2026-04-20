// app.js

// Register service worker (only works over HTTPS or localhost, not file://)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('Service Worker registration failed:', err);
        });
    });
}

// Utility functions
function getSessions() {
    return JSON.parse(localStorage.getItem('sessions') || '[]');
}

function saveSessions(sessions) {
    localStorage.setItem('sessions', JSON.stringify(sessions));
}

// Navigation functions
function showPage(pageId) {
    const pages = ['main-page', 'setup-page', 'score-page', 'history-page'];
    pages.forEach(id => {
        document.getElementById(id).style.display = id === pageId ? 'block' : 'none';
    });
    const headerButtons = document.getElementById('header-buttons');
    if (pageId === 'main-page') {
        headerButtons.style.display = 'none';
    } else {
        headerButtons.style.display = 'block';
    }
    // Refresh history when navigating to history page
    if (pageId === 'history-page' && typeof displayHistory === 'function') {
        displayHistory();
    }
}

function calculateCurrentScore() {
    let total = 0;
    for (let i = 1; i <= 6; i++) {
        const value = document.getElementById(`series${i}`)?.value;
        const score = value === '' ? 0 : parseInt(value, 10);
        if (!Number.isNaN(score)) {
            total += score;
        }
    }
    return total;
}

function updateCurrentScoreDisplay() {
    const display = document.getElementById('current-score');
    if (display) {
        display.textContent = `Current score: ${calculateCurrentScore()}`;
    }
}

function initScorePage() {
    const session = JSON.parse(localStorage.getItem('currentSession') || '{}');
    const editIndex = localStorage.getItem('editIndex');
    const isEditing = editIndex !== null;
    document.getElementById('session-info').innerHTML = `<p>Distance: ${session.distance || ''}m, Target: ${session.targetSize || ''}cm</p>`;
    const seriesInputs = document.getElementById('series-inputs');
    seriesInputs.innerHTML = ''; // Clear previous inputs
    const scoreNoteInput = document.getElementById('score-note');
    if (scoreNoteInput) {
        scoreNoteInput.value = session.note || '';
    }

    for (let i = 1; i <= 6; i++) {
        const div = document.createElement('div');
        div.className = 'series';
        div.innerHTML = `
            <label for="series${i}">Series ${i} (0-60):</label>
            <input type="number" id="series${i}" min="0" max="60" maxlength="2" value="${session.scores ? (session.scores[i-1] || '') : ''}">
        `;
        const input = div.querySelector('input');
        if (input) {
            input.addEventListener('input', (e) => {
                if (e.target.value.length > 2) {
                    e.target.value = e.target.value.slice(0, 2);
                }
                updateCurrentScoreDisplay();
            });
        }
        seriesInputs.appendChild(div);
    }
    updateCurrentScoreDisplay();
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.textContent = isEditing ? 'Update Session' : 'Save Session';
}

function navigateTo(pageId) {
    showPage(pageId);
    if (pageId === 'score-page') {
        initScorePage();
    }
}

// Global button listeners
document.getElementById('back-btn').addEventListener('click', () => {
    if (document.getElementById('setup-page').style.display === 'block') {
        navigateTo('main-page');
    } else if (document.getElementById('score-page').style.display === 'block') {
        navigateTo('history-page');
    } else if (document.getElementById('history-page').style.display === 'block') {
        navigateTo('main-page');
    }
});

document.getElementById('create-session-btn').addEventListener('click', () => navigateTo('setup-page'));

// Main page
if (document.getElementById('main-page')) {
    document.getElementById('create-session-btn-main').addEventListener('click', () => navigateTo('setup-page'));
    document.getElementById('view-history-btn').addEventListener('click', () => navigateTo('history-page'));
}

// Setup page
if (document.getElementById('setup-form')) {
    document.getElementById('setup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const distance = document.getElementById('distance').value;
        const targetSize = document.getElementById('target-size').value;
        const note = document.getElementById('session-note').value.trim();
        const session = { distance, targetSize, note, scores: [], date: new Date().toISOString() };
        localStorage.setItem('currentSession', JSON.stringify(session));
        navigateTo('score-page');
    });
}

// Score page
if (document.getElementById('score-form')) {
    initScorePage();
    document.getElementById('score-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const scores = [];
        for (let i = 1; i <= 6; i++) {
            const value = document.getElementById(`series${i}`).value;
            const score = value === '' ? 0 : parseInt(value, 10);
            scores.push(Number.isNaN(score) ? 0 : score);
        }
        const session = JSON.parse(localStorage.getItem('currentSession') || '{}');
        const note = document.getElementById('score-note').value.trim();
        session.scores = scores;
        session.note = note;
        session.total = scores.reduce((a, b) => a + b, 0);
        const sessions = getSessions();
        const editIndex = localStorage.getItem('editIndex');
        if (editIndex !== null) {
            sessions[parseInt(editIndex)] = session;
        } else {
            sessions.push(session);
        }
        saveSessions(sessions);
        localStorage.removeItem('currentSession');
        localStorage.removeItem('editIndex');

        const filterDistanceEl = document.getElementById('filter-distance');
        const filterTargetEl = document.getElementById('filter-target');
        if (filterDistanceEl && filterTargetEl) {
            filterDistanceEl.value = session.distance;
            filterTargetEl.value = session.targetSize;
        }

        navigateTo('history-page');
    });
}

// History page
if (document.getElementById('history-list')) {
    function displayHistory() {
        const filterDistance = document.getElementById('filter-distance').value;
        const filterTarget = document.getElementById('filter-target').value;
        const allSessions = getSessions();
        const sessions = allSessions.filter(s => 
            (!filterDistance || s.distance == filterDistance) &&
            (!filterTarget || s.targetSize == filterTarget)
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Get top 3 scores for each distance/target combination
        const topScores = {};
        allSessions.forEach(s => {
            const key = `${s.distance}-${s.targetSize}`;
            if (!topScores[key]) {
                topScores[key] = [];
            }
            topScores[key].push(s.total);
        });
        Object.keys(topScores).forEach(key => {
            topScores[key] = topScores[key].sort((a, b) => b - a).slice(0, 3);
        });
        
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        sessions.forEach((s, index) => {
            const allIndex = allSessions.findIndex(session => 
                session.date === s.date && 
                session.distance === s.distance && 
                session.targetSize === s.targetSize &&
                JSON.stringify(session.scores) === JSON.stringify(s.scores)
            );
            const li = document.createElement('li');
            const dateObj = new Date(s.date);
            const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dateObj.getDay()];
            const dateStr = s.date.split('T')[0];
            const timeStr = s.date.split('T')[1].substring(0, 5);
            
            // Calculate relative date description
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const sessionDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            const diffTime = today - sessionDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            let relativeDate = '';
            if (diffDays === 0) {
                relativeDate = 'Today';
            } else if (diffDays === 1) {
                relativeDate = 'Yesterday';
            } else if (diffDays === 2) {
                relativeDate = '2 days ago';
            } else if (diffDays >= 3 && diffDays <= 6) {
                const sessionDayOfWeek = dateObj.getDay();
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                relativeDate = `Last ${dayNames[sessionDayOfWeek]}`;
            } else if (diffDays < 30) {
                relativeDate = `${diffDays} days ago`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                relativeDate = months === 1 ? '1 month ago' : `${months} months ago`;
            } else {
                const years = Math.floor(diffDays / 365);
                relativeDate = years === 1 ? '1 year ago' : `${years} years ago`;
            }
            
            // Check if this score is in top 3 for its category
            const key = `${s.distance}-${s.targetSize}`;
            const topScoresForCategory = topScores[key] || [];
            let medal = '';
            if (topScoresForCategory[0] === s.total) {
                medal = '🥇';
            } else if (topScoresForCategory[1] === s.total) {
                medal = '🥈';
            } else if (topScoresForCategory[2] === s.total) {
                medal = '🥉';
            }
            
            // Compute score color based on difference from best
            let scoreColor = 'black';
            const bestScore = topScoresForCategory[0];
            if (bestScore !== undefined) {
                const diff = bestScore - s.total;
                if (diff === 0) {
                    scoreColor = 'green';
                } else if (diff <= 10) {
                    scoreColor = 'darkgreen';
                } else if (diff <= 25) {
                    scoreColor = 'goldenrod';
                } else if (diff <= 50) {
                    scoreColor = 'darkorange';
                } else {
                    scoreColor = 'darkred';
                }
            }
            
            const noteHtml = s.note ? `<div style="color: #666; margin-top: 0.25rem;">Note: ${s.note}</div>` : '';
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${relativeDate}</strong> <span style="color: #666; font-size: 0.9em;">${dayName} ${dateStr} ${timeStr}</span> - ${s.distance}m, ${s.targetSize}cm<br>
                        <span style="color: #666;">Scores: ${s.scores.join(', ')}</span><br>
                        Total: <strong style="color: ${scoreColor};">${s.total}</strong> / 360 ${medal}
                        ${noteHtml}
                    </div>
                    <div>
                        <button class="edit-btn" data-index="${allIndex}" style="background-color: #2196F3; padding: 0.5rem; margin-right: 0.5rem;">Edit</button>
                        <button class="delete-btn" data-index="${allIndex}" style="background-color: #f44336; padding: 0.5rem;">Delete</button>
                    </div>
                </div>
            `;
            list.appendChild(li);
            li.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.preventDefault();
                const sessions = getSessions();
                localStorage.setItem('currentSession', JSON.stringify(sessions[allIndex]));
                localStorage.setItem('editIndex', allIndex.toString());
                navigateTo('score-page');
            });
            li.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Delete this session?')) {
                    const sessions = getSessions();
                    sessions.splice(allIndex, 1);
                    saveSessions(sessions);
                    displayHistory();
                }
            });
        });
    }
    document.getElementById('filter-distance').addEventListener('change', displayHistory);
    document.getElementById('filter-target').addEventListener('change', displayHistory);
    displayHistory();

    // Export data button
    document.getElementById('export-data-btn').addEventListener('click', () => {
        const sessions = getSessions();
        const dataToExport = {
            sessions: sessions,
            exportDate: new Date().toISOString()
        };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bow-score-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // Load data button
    document.getElementById('load-data-btn').addEventListener('click', () => {
        document.getElementById('load-data-input').click();
    });

    document.getElementById('load-data-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!importedData.sessions || !Array.isArray(importedData.sessions)) {
                    alert('Invalid file format. Please select a valid export file.');
                    return;
                }

                const existingSessions = getSessions();
                const mergedSessions = [...existingSessions, ...importedData.sessions];
                saveSessions(mergedSessions);
                displayHistory();
                alert(`Successfully imported ${importedData.sessions.length} session(s).`);
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsText(file);
        // Reset the input so the same file can be loaded again
        e.target.value = '';
    });
}