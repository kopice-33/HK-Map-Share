// Configuration
const USE_SERVER = false; // Set to true to use server sharing, false for local-only
const SERVER_URL = 'http://localhost:3000/api';

// Initialize map centered on Hong Kong
const map = L.map('map').setView([22.3193, 114.1694], 11);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Store points and markers
let points = [];
let markers = [];
let selectedLocation = null;
let currentFilter = 'all';

// Category icons
const categoryIcons = {
    restaurant: '🍽️',
    attraction: '🏛️',
    shopping: '🛍️',
    transport: '🚇',
    other: '📍'
};

// API functions
async function loadPointsFromServer() {
    try {
        const response = await fetch(`${SERVER_URL}/points`);
        return await response.json();
    } catch (error) {
        console.error('Failed to load from server:', error);
        return JSON.parse(localStorage.getItem('hkMapPoints') || '[]');
    }
}

async function savePointToServer(point) {
    try {
        const response = await fetch(`${SERVER_URL}/points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(point)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to save to server:', error);
        return null;
    }
}

async function deletePointFromServer(pointId) {
    try {
        await fetch(`${SERVER_URL}/points/${pointId}`, { method: 'DELETE' });
        return true;
    } catch (error) {
        console.error('Failed to delete from server:', error);
        return false;
    }
}

// Load points based on configuration
async function loadPoints() {
    if (USE_SERVER) {
        points = await loadPointsFromServer();
    } else {
        points = JSON.parse(localStorage.getItem('hkMapPoints') || '[]');
    }
    
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Add all points to map
    points.forEach(point => addMarkerToMap(point));
    updatePointsList();
}

// Save points based on configuration
function savePoints() {
    if (!USE_SERVER) {
        localStorage.setItem('hkMapPoints', JSON.stringify(points));
    }
}

// Add click handler for map
map.on('click', function(e) {
    selectedLocation = e.latlng;
    document.getElementById('pointForm').style.display = 'block';
});

// Handle form submission
document.getElementById('pointForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!selectedLocation) return;
    
    const username = document.getElementById('usernameInput').value || 'Anonymous';
    const category = document.getElementById('categorySelect').value;
    const tag = document.getElementById('tagInput').value;
    const comment = document.getElementById('commentInput').value;
    
    const pointData = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        category: category,
        tag: tag,
        comment: comment,
        username: username
    };
    
    let point;
    if (USE_SERVER) {
        point = await savePointToServer(pointData);
        if (point) {
            points.push(point);
        }
    } else {
        point = {
            ...pointData,
            id: Date.now(),
            timestamp: new Date().toLocaleString()
        };
        points.push(point);
        savePoints();
    }
    
    if (point) {
        addMarkerToMap(point);
        updatePointsList();
    }
    
    // Reset form
    document.getElementById('tagInput').value = '';
    document.getElementById('commentInput').value = '';
    document.getElementById('pointForm').style.display = 'none';
    selectedLocation = null;
});

// Cancel button
document.getElementById('cancelBtn').addEventListener('click', function() {
    document.getElementById('tagInput').value = '';
    document.getElementById('commentInput').value = '';
    document.getElementById('pointForm').style.display = 'none';
    selectedLocation = null;
});

// Export functionality
document.getElementById('exportBtn').addEventListener('click', function() {
    const dataStr = JSON.stringify(points, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hk-map-points-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
});

// Import functionality
document.getElementById('importBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedPoints = JSON.parse(e.target.result);
            if (Array.isArray(importedPoints)) {
                // Merge with existing points, avoiding duplicates
                const existingIds = new Set(points.map(p => p.id));
                const newPoints = importedPoints.filter(p => !existingIds.has(p.id));
                
                points = [...points, ...newPoints];
                savePoints();
                
                // Clear existing markers and reload all
                markers.forEach(marker => map.removeLayer(marker));
                markers = [];
                points.forEach(point => addMarkerToMap(point));
                updatePointsList();
                
                alert(`Imported ${newPoints.length} new points!`);
            }
        } catch (error) {
            alert('Invalid file format!');
        }
    };
    reader.readAsText(file);
});

// Category filter
document.getElementById('categoryFilter').addEventListener('change', function(e) {
    currentFilter = e.target.value;
    updatePointsList();
    updateMarkersVisibility();
});

// Add marker to map
function addMarkerToMap(point) {
    const icon = categoryIcons[point.category] || '📍';
    const marker = L.marker([point.lat, point.lng]).addTo(map);
    marker.bindPopup(`
        <div class="popup-content">
            <div class="popup-header">
                <span class="popup-icon">${icon}</span>
                <strong>${point.tag}</strong>
            </div>
            <div class="popup-comment">${point.comment}</div>
            <div class="popup-meta">
                <small>By: ${point.username} | ${point.timestamp}</small>
            </div>
            <button onclick="deletePoint(${point.id})" class="delete-btn">🗑️ Delete</button>
        </div>
    `);
    marker.pointData = point;
    markers.push(marker);
}

// Update points list in sidebar
function updatePointsList() {
    const pointsDiv = document.getElementById('points');
    pointsDiv.innerHTML = '';
    
    const filteredPoints = currentFilter === 'all' ? points : points.filter(p => p.category === currentFilter);
    
    if (filteredPoints.length === 0) {
        const instructionDiv = document.createElement('div');
        instructionDiv.className = 'instruction';
        instructionDiv.innerHTML = currentFilter === 'all' 
            ? '📍 Click anywhere on the map to add your first point!'
            : `No ${currentFilter} points found. Try a different category or add new points!`;
        pointsDiv.appendChild(instructionDiv);
        document.getElementById('pointCount').textContent = '0';
        return;
    }
    
    filteredPoints.forEach(point => {
        const icon = categoryIcons[point.category] || '📍';
        const div = document.createElement('div');
        div.className = 'point-item';
        div.innerHTML = `
            <div class="point-header">
                <span class="point-icon">${icon}</span>
                <div class="point-tag">${point.tag}</div>
                <button onclick="deletePoint(${point.id})" class="delete-btn-small">×</button>
            </div>
            <div class="point-comment">${point.comment}</div>
            <div class="point-meta">
                <small>By: ${point.username} | ${point.timestamp}</small>
            </div>
        `;
        div.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn-small')) {
                map.setView([point.lat, point.lng], 15);
            }
        };
        pointsDiv.appendChild(div);
    });
    
    document.getElementById('pointCount').textContent = filteredPoints.length;
}

// Update markers visibility based on filter
function updateMarkersVisibility() {
    markers.forEach(marker => {
        const point = marker.pointData;
        if (currentFilter === 'all' || point.category === currentFilter) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });
}

// Delete point function
async function deletePoint(pointId) {
    if (confirm('Are you sure you want to delete this point?')) {
        if (USE_SERVER) {
            const success = await deletePointFromServer(pointId);
            if (!success) {
                alert('Failed to delete point from server');
                return;
            }
        }
        
        points = points.filter(p => p.id !== pointId);
        savePoints();
        
        // Remove marker from map
        const markerIndex = markers.findIndex(m => m.pointData.id === pointId);
        if (markerIndex !== -1) {
            map.removeLayer(markers[markerIndex]);
            markers.splice(markerIndex, 1);
        }
        
        updatePointsList();
    }
}

// Auto-refresh points when using server (every 30 seconds)
if (USE_SERVER) {
    setInterval(loadPoints, 30000);
}

// Load points on page load
loadPoints();