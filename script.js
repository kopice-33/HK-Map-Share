// Initialize map centered on Hong Kong
const map = L.map('map').setView([22.3193, 114.1694], 11);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Store points and markers
let points = JSON.parse(localStorage.getItem('hkMapPoints') || '[]');
let markers = [];
let selectedLocation = null;
let currentFilter = 'all';
let tempMarker = null;
let editingPointId = null;

// Category icons
const categoryIcons = {
    restaurant: '🍽️',
    attraction: '🏛️',
    shopping: '🛍️',
    transport: '🚇',
    other: '📍'
};

// Add click handler for map
map.on('click', function(e) {
    selectedLocation = e.latlng;
    
    // Remove previous temp marker
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    // Add temporary marker to show where point will be added
    tempMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
    tempMarker.bindPopup('Click "Add Point" to save this location').openPopup();
    
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
    const pictureFiles = document.getElementById('pictureInput').files;
    
    // Convert pictures to base64
    const pictures = [];
    for (let i = 0; i < pictureFiles.length; i++) {
        const file = pictureFiles[i];
        const reader = new FileReader();
        await new Promise((resolve) => {
            reader.onload = function(e) {
                pictures.push({
                    name: file.name,
                    data: e.target.result
                });
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }
    
    const point = {
        id: Date.now(),
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        category: category,
        tag: tag,
        comment: comment,
        username: username,
        timestamp: new Date().toLocaleString(),
        pictures: pictures
    };
    
    points.push(point);
    localStorage.setItem('hkMapPoints', JSON.stringify(points));
    
    addMarkerToMap(point);
    updatePointsList();
    
    // Remove temp marker and reset form
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    document.getElementById('tagInput').value = '';
    document.getElementById('commentInput').value = '';
    document.getElementById('pictureInput').value = '';
    document.getElementById('pointForm').style.display = 'none';
    selectedLocation = null;
});

// Cancel button
document.getElementById('cancelBtn').addEventListener('click', function() {
    // Remove temp marker
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    document.getElementById('tagInput').value = '';
    document.getElementById('commentInput').value = '';
    document.getElementById('pictureInput').value = '';
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
                localStorage.setItem('hkMapPoints', JSON.stringify(points));
                
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

// Edit form submission
document.getElementById('editForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!editingPointId) return;
    
    const category = document.getElementById('editCategorySelect').value;
    const tag = document.getElementById('editTagInput').value;
    const comment = document.getElementById('editCommentInput').value;
    const pictureFiles = document.getElementById('editPictureInput').files;
    
    // Find the point to edit
    const pointIndex = points.findIndex(p => p.id === editingPointId);
    if (pointIndex === -1) return;
    
    // Convert new pictures to base64
    const newPictures = [];
    for (let i = 0; i < pictureFiles.length; i++) {
        const file = pictureFiles[i];
        const reader = new FileReader();
        await new Promise((resolve) => {
            reader.onload = function(e) {
                newPictures.push({
                    name: file.name,
                    data: e.target.result
                });
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Update point data
    points[pointIndex].category = category;
    points[pointIndex].tag = tag;
    points[pointIndex].comment = comment;
    if (newPictures.length > 0) {
        points[pointIndex].pictures = [...(points[pointIndex].pictures || []), ...newPictures];
    }
    
    localStorage.setItem('hkMapPoints', JSON.stringify(points));
    
    // Update marker
    const markerIndex = markers.findIndex(m => m.pointData.id === editingPointId);
    if (markerIndex !== -1) {
        map.removeLayer(markers[markerIndex]);
        markers.splice(markerIndex, 1);
        addMarkerToMap(points[pointIndex]);
    }
    
    updatePointsList();
    
    // Reset form
    document.getElementById('editTagInput').value = '';
    document.getElementById('editCommentInput').value = '';
    document.getElementById('editPictureInput').value = '';
    document.getElementById('editForm').style.display = 'none';
    editingPointId = null;
});

// Edit cancel button
document.getElementById('editCancelBtn').addEventListener('click', function() {
    document.getElementById('editTagInput').value = '';
    document.getElementById('editCommentInput').value = '';
    document.getElementById('editPictureInput').value = '';
    document.getElementById('editForm').style.display = 'none';
    editingPointId = null;
});

// Add marker to map
function addMarkerToMap(point) {
    const icon = categoryIcons[point.category] || '📍';
    const marker = L.marker([point.lat, point.lng]).addTo(map);
    
    let picturesHtml = '';
    if (point.pictures && point.pictures.length > 0) {
        picturesHtml = '<div class="popup-pictures">';
        point.pictures.forEach(pic => {
            picturesHtml += `<img src="${pic.data}" alt="${pic.name}" class="popup-image"/>`;
        });
        picturesHtml += '</div>';
    }
    
    marker.bindPopup(`
        <div class="popup-content">
            <div class="popup-header">
                <span class="popup-icon">${icon}</span>
                <strong>${point.tag}</strong>
            </div>
            <div class="popup-comment">${point.comment}</div>
            ${picturesHtml}
            <div class="popup-meta">
                <small>By: ${point.username} | ${point.timestamp}</small>
            </div>
            <button onclick="editPoint(${point.id})" class="edit-btn">✏️ Edit</button>
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
    
    filteredPoints.forEach(point => {
        const icon = categoryIcons[point.category] || '📍';
        const div = document.createElement('div');
        div.className = 'point-item';
        
        let picturesHtml = '';
        if (point.pictures && point.pictures.length > 0) {
            picturesHtml = `<div class="point-pictures">${point.pictures.length} 📷</div>`;
        }
        
        div.innerHTML = `
            <div class="point-header">
                <span class="point-icon">${icon}</span>
                <div class="point-tag">${point.tag}</div>
                <div>
                    <button onclick="editPoint(${point.id})" class="edit-btn-small">✏️</button>
                    <button onclick="deletePoint(${point.id})" class="delete-btn-small">×</button>
                </div>
            </div>
            <div class="point-comment">${point.comment}</div>
            ${picturesHtml}
            <div class="point-meta">
                <small>By: ${point.username} | ${point.timestamp}</small>
            </div>
        `;
        div.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn-small') && !e.target.classList.contains('edit-btn-small')) {
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

// Edit point function
function editPoint(pointId) {
    const point = points.find(p => p.id === pointId);
    if (!point) return;
    
    editingPointId = pointId;
    document.getElementById('editCategorySelect').value = point.category;
    document.getElementById('editTagInput').value = point.tag;
    document.getElementById('editCommentInput').value = point.comment || '';
    document.getElementById('editForm').style.display = 'block';
    document.getElementById('pointForm').style.display = 'none';
}

// Delete point function
function deletePoint(pointId) {
    if (confirm('Are you sure you want to delete this point?')) {
        points = points.filter(p => p.id !== pointId);
        localStorage.setItem('hkMapPoints', JSON.stringify(points));
        
        // Remove marker from map
        const markerIndex = markers.findIndex(m => m.pointData.id === pointId);
        if (markerIndex !== -1) {
            map.removeLayer(markers[markerIndex]);
            markers.splice(markerIndex, 1);
        }
        
        updatePointsList();
    }
}

// Sidebar click handler to cancel point selection
document.getElementById('sidebar').addEventListener('click', function() {
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    document.getElementById('pointForm').style.display = 'none';
    document.getElementById('editForm').style.display = 'none';
    selectedLocation = null;
    editingPointId = null;
});

// Load existing points on page load
points.forEach(point => addMarkerToMap(point));
updatePointsList();

// Add instruction text when no points exist
if (points.length === 0) {
    const instructionDiv = document.createElement('div');
    instructionDiv.className = 'instruction';
    instructionDiv.innerHTML = '📍 Click anywhere on the map to add your first point!';
    document.getElementById('points').appendChild(instructionDiv);
}