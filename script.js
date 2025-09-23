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
let isCreatingRoute = false;
let currentRoute = [];
let routePolyline = null;
let routes = JSON.parse(localStorage.getItem('hkMapRoutes') || '[]');
let routeMarkers = new Map(); // Store route-specific markers
let currentRouteMarkers = []; // Store markers for current route being created

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
    if (isCreatingRoute) {
        handleRouteClick(e, false); // Left click
        return;
    }
    
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

// Add right click handler for map
map.on('contextmenu', function(e) {
    if (isCreatingRoute) {
        handleRouteClick(e, true); // Right click
        e.originalEvent.preventDefault();
    } else if (tempMarker || document.getElementById('pointForm').style.display === 'block') {
        // Right click to cancel add point
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        document.getElementById('pointForm').style.display = 'none';
        selectedLocation = null;
        e.originalEvent.preventDefault();
    }
});

// Add mouse move handler for cursor changes during route creation
map.on('mousemove', function(e) {
    if (!isCreatingRoute) {
        map.getContainer().style.cursor = '';
        return;
    }
    
    let willSelectPoint = false;
    
    // Check if hovering over waypoint
    markers.forEach(marker => {
        const markerPos = marker.getLatLng();
        const distance = map.distance(e.latlng, markerPos);
        if (distance < 20) {
            willSelectPoint = true;
        }
    });
    
    // Check if hovering over route point
    currentRouteMarkers.forEach(marker => {
        const markerPos = marker.getLatLng();
        const distance = map.distance(e.latlng, markerPos);
        if (distance < 20) {
            willSelectPoint = true;
        }
    });
    
    // Change cursor based on what will happen
    map.getContainer().style.cursor = willSelectPoint ? 'pointer' : 'crosshair';
});

function handleRouteClick(e, isRightClick) {
    if (isRightClick) {
        // Right click - remove point from route
        removePointFromRoute(e.latlng);
    } else {
        // Left click - add point to route
        addPointToRoute(e.latlng);
    }
}

function addPointToRoute(latlng) {
    // Check if clicked on existing waypoint
    let clickedPoint = null;
    markers.forEach(marker => {
        const markerPos = marker.getLatLng();
        const distance = map.distance(latlng, markerPos);
        if (distance < 20) {
            clickedPoint = marker.pointData;
        }
    });
    
    // Check if clicked on existing route point
    let clickedRoutePoint = null;
    currentRouteMarkers.forEach(marker => {
        const markerPos = marker.getLatLng();
        const distance = map.distance(latlng, markerPos);
        if (distance < 20) {
            clickedRoutePoint = currentRoute[marker.routePointIndex];
        }
    });
    
    if (clickedPoint) {
        // Add existing waypoint to route
        currentRoute.push({
            lat: clickedPoint.lat,
            lng: clickedPoint.lng,
            pointId: clickedPoint.id,
            name: clickedPoint.tag,
            type: 'waypoint'
        });
    } else if (clickedRoutePoint) {
        // Add existing route point to route
        currentRoute.push({
            lat: clickedRoutePoint.lat,
            lng: clickedRoutePoint.lng,
            name: clickedRoutePoint.name,
            type: 'routepoint'
        });
    } else {
        // Create new route point
        const routePoint = {
            lat: latlng.lat,
            lng: latlng.lng,
            name: `Route Point ${currentRoute.length + 1}`,
            type: 'routepoint'
        };
        currentRoute.push(routePoint);
        
        // Add marker for new route point (no popup during creation)
        const marker = L.marker([latlng.lat, latlng.lng]).addTo(map);
        marker.routePointIndex = currentRoute.length - 1;
        currentRouteMarkers.push(marker);
    }
    
    updateRoutePointCount();
    updateRoutePolyline();
    updateRoutePointsList();
}

function removePointFromRoute(latlng) {
    let removeIndex = -1;
    
    // Find closest point in route (more precise)
    currentRoute.forEach((point, index) => {
        const distance = map.distance(latlng, [point.lat, point.lng]);
        if (distance < 20) { // Reduced from 50m to 20m for precision
            removeIndex = index;
        }
    });
    
    if (removeIndex === -1) return;
    
    const removedPoint = currentRoute[removeIndex];
    
    if (removedPoint.type === 'routepoint') {
        // Remove route point marker
        const markerIndex = currentRouteMarkers.findIndex(m => m.routePointIndex === removeIndex);
        if (markerIndex !== -1) {
            map.removeLayer(currentRouteMarkers[markerIndex]);
            currentRouteMarkers.splice(markerIndex, 1);
        }
        
        // Update remaining marker indices
        currentRouteMarkers.forEach(marker => {
            if (marker.routePointIndex > removeIndex) {
                marker.routePointIndex--;
            }
        });
    }
    
    // Remove from route
    currentRoute.splice(removeIndex, 1);
    
    updateRoutePointCount();
    updateRoutePolyline();
    updateRoutePointsList();
}

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
    
    // Check if editing route point
    if (typeof editingPointId === 'object' && editingPointId.isRoutePoint) {
        const { routeId, pointIndex } = editingPointId;
        const route = routes.find(r => r.id === routeId);
        if (route) {
            route.points[pointIndex].name = tag;
            localStorage.setItem('hkMapRoutes', JSON.stringify(routes));
            updateRoutesList();
        }
    } else {
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
    }
    
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

// Route functionality
document.getElementById('startRouteBtn').addEventListener('click', function() {
    isCreatingRoute = true;
    currentRoute = [];
    document.getElementById('startRouteBtn').style.display = 'none';
    document.getElementById('finishRouteBtn').style.display = 'inline-block';
    document.getElementById('cancelRouteBtn').style.display = 'inline-block';
    document.getElementById('routeInfo').style.display = 'block';
    updateRoutePointCount();
    
    // Highlight existing points and disable popups
    markers.forEach(marker => {
        marker.getElement().style.filter = 'hue-rotate(120deg)';
        marker.getElement().style.cursor = 'pointer';
        marker.closePopup();
        marker.unbindPopup();
    });
});

document.getElementById('finishRouteBtn').addEventListener('click', function() {
    if (currentRoute.length < 2) {
        alert('Route must have at least 2 points!');
        return;
    }
    
    const routeName = document.getElementById('routeNameInput').value || 'Unnamed Route';
    const routeDesc = document.getElementById('routeDescInput').value;
    
    const route = {
        id: Date.now(),
        name: routeName,
        description: routeDesc,
        points: [...currentRoute],
        username: document.getElementById('usernameInput').value || 'Anonymous',
        timestamp: new Date().toLocaleString()
    };
    
    routes.push(route);
    localStorage.setItem('hkMapRoutes', JSON.stringify(routes));
    
    resetRouteCreation();
    updateRoutesList();
    alert('Route saved successfully!');
});

document.getElementById('cancelRouteBtn').addEventListener('click', function() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
    resetRouteCreation();
});

function resetRouteCreation() {
    isCreatingRoute = false;
    currentRoute = [];
    
    // Remove current route markers
    currentRouteMarkers.forEach(marker => map.removeLayer(marker));
    currentRouteMarkers = [];
    
    // Remove route polyline
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
    
    document.getElementById('startRouteBtn').style.display = 'inline-block';
    document.getElementById('finishRouteBtn').style.display = 'none';
    document.getElementById('cancelRouteBtn').style.display = 'none';
    document.getElementById('routeInfo').style.display = 'none';
    document.getElementById('routeNameInput').value = '';
    document.getElementById('routeDescInput').value = '';
    document.getElementById('routePointsList').innerHTML = '';
    
    // Reset marker styles and re-enable popups
    markers.forEach(marker => {
        marker.getElement().style.filter = '';
        marker.getElement().style.cursor = '';
        
        // Re-bind popup
        const point = marker.pointData;
        if (point) {
            let picturesHtml = '';
            if (point.pictures && point.pictures.length > 0) {
                picturesHtml = '<div class="popup-pictures">';
                point.pictures.forEach(pic => {
                    picturesHtml += `<img src="${pic.data}" alt="${pic.name}" class="popup-image"/>`;
                });
                picturesHtml += '</div>';
            }
            
            const icon = categoryIcons[point.category] || '📍';
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
        }
    });
}

function updateRoutePointCount() {
    document.getElementById('routePointCount').textContent = currentRoute.length;
}

function updateRoutePointsList() {
    const listDiv = document.getElementById('routePointsList');
    listDiv.innerHTML = '';
    
    currentRoute.forEach((point, index) => {
        const div = document.createElement('div');
        div.className = 'route-point-item';
        const icon = point.type === 'waypoint' ? '📍' : '🔴';
        div.innerHTML = `${index + 1}. ${icon} ${point.name || 'Unnamed Point'}`;
        listDiv.appendChild(div);
    });
}

function updateRoutePolyline() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
    }
    if (currentRoute.length > 1) {
        const coords = currentRoute.map(point => [point.lat, point.lng]);
        routePolyline = L.polyline(coords, {color: 'red', weight: 3}).addTo(map);
    }
}

// Update routes list
function updateRoutesList() {
    const routesDiv = document.getElementById('routes');
    routesDiv.innerHTML = '';
    
    if (routes.length === 0) {
        const instructionDiv = document.createElement('div');
        instructionDiv.className = 'instruction';
        instructionDiv.innerHTML = '🛣️ No routes created yet. Go to Manage tab to add routes!';
        routesDiv.appendChild(instructionDiv);
        document.getElementById('routeCount').textContent = '0';
        return;
    }
    
    routes.forEach(route => {
        const div = document.createElement('div');
        div.className = 'route-item';
        div.innerHTML = `
            <div class="route-header">
                <span class="route-icon">🛣️</span>
                <div class="route-name">${route.name}</div>
                <div>
                    <button onclick="editRoute(${route.id})" class="edit-btn-small">✏️</button>
                    <button onclick="expandRoute(${route.id})" class="expand-btn">🔽</button>
                    <button onclick="toggleRoute(${route.id})" class="toggle-btn">👁️</button>
                    <button onclick="deleteRoute(${route.id})" class="delete-btn-small">×</button>
                </div>
            </div>
            <div class="route-desc">${route.description || 'No description'}</div>
            <div class="route-meta">
                <small>${route.points.length} points | By: ${route.username} | ${route.timestamp}</small>
            </div>
            <div id="routePoints-${route.id}" class="route-points-list" style="display:none;">
                ${route.points.map((point, index) => {
                    const icon = point.type === 'waypoint' ? '📍' : '🔴';
                    return `<div class="route-point-item" data-route-id="${route.id}" data-point-index="${index}">${index + 1}. ${icon} ${point.name}</div>`;
                }).join('')}
            </div>
        `;
        routesDiv.appendChild(div);
    });
    
    document.getElementById('routeCount').textContent = routes.length;
}

// Toggle route visibility
let visibleRoutes = new Set();
function toggleRoute(routeId) {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;
    
    if (visibleRoutes.has(routeId)) {
        // Hide route
        visibleRoutes.delete(routeId);
        
        // Remove polyline
        map.eachLayer(layer => {
            if (layer.routeId === routeId) {
                map.removeLayer(layer);
            }
        });
        
        // Remove route-specific markers
        if (routeMarkers.has(routeId)) {
            routeMarkers.get(routeId).forEach(marker => map.removeLayer(marker));
            routeMarkers.delete(routeId);
        }
        
        // Update button
        updateRouteToggleButton(routeId, false);
    } else {
        // Show route
        visibleRoutes.add(routeId);
        
        // Add polyline
        const coords = route.points.map(point => [point.lat, point.lng]);
        const polyline = L.polyline(coords, {color: 'blue', weight: 3}).addTo(map);
        polyline.routeId = routeId;
        polyline.bindPopup(`Route: ${route.name}<br>${route.description || ''}`);
        
        // Add markers only for new points (not existing points)
        const newMarkers = [];
        route.points.forEach((point, index) => {
            if (!point.pointId) {
                const marker = L.marker([point.lat, point.lng]).addTo(map);
                marker.bindPopup(`${route.name} - Point ${index + 1}<br>${point.name}`);
                marker.routeId = routeId;
                newMarkers.push(marker);
            }
        });
        routeMarkers.set(routeId, newMarkers);
        
        // Update button
        updateRouteToggleButton(routeId, true);
    }
}

function updateRouteToggleButton(routeId, isVisible) {
    const button = document.querySelector(`button[onclick="toggleRoute(${routeId})"]`);
    if (button) {
        button.innerHTML = isVisible ? '🙈' : '👁️';
        button.style.background = isVisible ? '#dc3545' : '#28a745';
    }
}

// Edit route
function editRoute(routeId) {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;
    
    const newName = prompt('Edit route name:', route.name);
    if (newName !== null && newName.trim() !== '') {
        route.name = newName.trim();
        
        const newDesc = prompt('Edit route description:', route.description || '');
        if (newDesc !== null) {
            route.description = newDesc.trim();
        }
        
        localStorage.setItem('hkMapRoutes', JSON.stringify(routes));
        updateRoutesList();
    }
}

// Delete route
function deleteRoute(routeId) {
    if (confirm('Are you sure you want to delete this route?')) {
        routes = routes.filter(r => r.id !== routeId);
        localStorage.setItem('hkMapRoutes', JSON.stringify(routes));
        
        // Remove from map if visible
        if (visibleRoutes.has(routeId)) {
            visibleRoutes.delete(routeId);
            map.eachLayer(layer => {
                if (layer.routeId === routeId) {
                    map.removeLayer(layer);
                }
            });
        }
        
        updateRoutesList();
    }
}

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
                map.setView([point.lat, point.lng], 19);
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
    
    // Switch to manage tab
    switchTab('manage');
    
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

// Tab switching function
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').style.display = 'block';
}

// Expand/collapse route points list
function expandRoute(routeId) {
    const pointsList = document.getElementById(`routePoints-${routeId}`);
    const expandBtn = document.querySelector(`button[onclick="expandRoute(${routeId})"]`);
    
    if (pointsList.style.display === 'none') {
        pointsList.style.display = 'block';
        expandBtn.innerHTML = '🔼';
    } else {
        pointsList.style.display = 'none';
        expandBtn.innerHTML = '🔽';
    }
}

// Edit route point (both waypoints and route points)
function editRoutePoint(routeId, pointIndex) {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;
    
    const point = route.points[pointIndex];
    
    if (point.pointId) {
        // Edit existing waypoint
        editPoint(point.pointId);
    } else {
        // Edit route point - only name, no comment needed
        const newName = prompt('Edit route point name:', point.name);
        if (newName !== null && newName.trim() !== '') {
            route.points[pointIndex].name = newName.trim();
            localStorage.setItem('hkMapRoutes', JSON.stringify(routes));
            
            // Stay on routes tab and preserve expanded state
            const wasExpanded = document.getElementById(`routePoints-${routeId}`).style.display === 'block';
            updateRoutesList();
            if (wasExpanded) {
                document.getElementById(`routePoints-${routeId}`).style.display = 'block';
                document.querySelector(`button[onclick="expandRoute(${routeId})"]`).innerHTML = '🔼';
            }
        }
        return;
    }
}

// Route point click handler
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('route-point-item')) {
        e.stopPropagation();
        const routeId = parseInt(e.target.dataset.routeId);
        const pointIndex = parseInt(e.target.dataset.pointIndex);
        editRoutePoint(routeId, pointIndex);
    }
});

// Sidebar click handler to cancel point selection
document.getElementById('sidebar').addEventListener('click', function(e) {
    // Don't cancel if clicking on form elements
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
        return;
    }
    
    // Don't cancel if clicking inside forms
    if (e.target.closest('#pointForm') || e.target.closest('#editForm')) {
        return;
    }
    
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
updateRoutesList();

// Add instruction text when no points exist
if (points.length === 0) {
    const instructionDiv = document.createElement('div');
    instructionDiv.className = 'instruction';
    instructionDiv.innerHTML = '📍 Click anywhere on the map to add your first point!';
    document.getElementById('points').appendChild(instructionDiv);
}