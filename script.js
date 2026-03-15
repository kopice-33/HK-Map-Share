// ==================== CONFIGURATION ====================
const MODES = {
    DRAW_LINE: 'line',
    FOLLOW_ROAD: 'road'
};

// ==================== INITIALIZATION ====================
const map = L.map('map', {
    dragging: true
}).setView([22.415, 114.215], 13);

// OpenTopoMap layer
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors',
    maxZoom: 17
}).addTo(map);

// ==================== STATE MANAGEMENT ====================
let currentMode = MODES.DRAW_LINE;
let routePoints = [];

// Free drawing state
let isFreeDrawing = false;
let freeDrawPoints = [];
let freeDrawLine = null;

// Road following state
let isRouting = false;

// Undo/Redo stacks
let undoStack = [];
let redoStack = [];

// Feature groups
const routeLayer = L.featureGroup().addTo(map);
const markersLayer = L.featureGroup().addTo(map);

// ==================== UI UPDATES ====================
function updateModeDisplay() {
    const modeDisplay = document.getElementById('modeDisplay');
    const modeText = document.getElementById('modeText');
    if (modeDisplay && modeText) {
        const text = currentMode === MODES.DRAW_LINE ? 'Line Mode' : 'Road Mode';
        modeDisplay.textContent = text;
        modeText.textContent = text;
    }
}

// ==================== DISTANCE CALCULATION ====================
function calculateDistance(points) {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += points[i].distanceTo(points[i + 1]);
    }
    return total / 1000; // Convert to kilometers
}

function updateDistanceDisplay() {
    const distance = calculateDistance(routePoints);
    const distanceDisplay = document.getElementById('distanceDisplay');
    if (distanceDisplay) {
        if (distance > 0) {
            distanceDisplay.textContent = `${distance.toFixed(2)} km`;
        } else {
            distanceDisplay.textContent = '0 km';
        }
    }
}

// ==================== ROUTE RENDERING ====================
function renderRoute() {
    routeLayer.clearLayers();
    markersLayer.clearLayers();
    
    if (routePoints.length === 0) {
        updateDistanceDisplay();
        return;
    }

    // Draw the main polyline
    if (routePoints.length > 1) {
        L.polyline(routePoints, {
            color: '#1E3A8A',
            weight: 5,
            opacity: 0.9
        }).addTo(routeLayer);
    }

    // Only show START and LAST points (no middle points to prevent lag)
    if (routePoints.length > 0) {
        // Start point - flag icon
        let startIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #22C55E; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">🏁</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        let startMarker = L.marker(routePoints[0], { icon: startIcon });
        startMarker.bindPopup(`Start Point<br>${routePoints[0].lat.toFixed(5)}, ${routePoints[0].lng.toFixed(5)}`);
        markersLayer.addLayer(startMarker);
        
        // Last point - flag icon (only if different from start)
        if (routePoints.length > 1) {
            let lastIcon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: #EF4444; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">⛳</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            let lastMarker = L.marker(routePoints[routePoints.length - 1], { icon: lastIcon });
            lastMarker.bindPopup(`Last Point<br>${routePoints[routePoints.length - 1].lat.toFixed(5)}, ${routePoints[routePoints.length - 1].lng.toFixed(5)}`);
            markersLayer.addLayer(lastMarker);
        }
    }
    
    // Update distance display
    updateDistanceDisplay();
}

// ==================== FREE DRAWING ====================
function startFreeDraw(startPoint) {
    if (!startPoint) return;
    
    // Clean up previous free draw line
    if (freeDrawLine) {
        routeLayer.removeLayer(freeDrawLine);
        freeDrawLine = null;
    }
    
    isFreeDrawing = true;
    freeDrawPoints = [startPoint];
    
    // Create new free draw line
    freeDrawLine = L.polyline([], {
        color: '#F97316',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8'
    }).addTo(routeLayer);
}

function continueFreeDraw(point) {
    if (!isFreeDrawing || !freeDrawLine) return;
    
    freeDrawPoints.push(point);
    freeDrawLine.setLatLngs(freeDrawPoints);
}

function endFreeDraw() {
    if (isFreeDrawing) {
        if (freeDrawPoints.length > 1) {
            // Add free draw points to main route
            saveStateToUndo();
            const newPoints = freeDrawPoints.slice(1); // Skip first to avoid duplicate
            if (newPoints.length > 0) {
                routePoints = [...routePoints, ...newPoints];
            }
        }
        
        // Clean up free draw
        isFreeDrawing = false;
        if (freeDrawLine) {
            routeLayer.removeLayer(freeDrawLine);
            freeDrawLine = null;
        }
        
        freeDrawPoints = [];
        
        // Re-render the main route
        renderRoute();
    }
}

// ==================== HONG KONG TRAIL ROUTING ====================
async function followRoadToPoint(fromPoint, toPoint) {
    if (!fromPoint || !toPoint || isRouting) return;
    
    isRouting = true;
    map.getContainer().style.cursor = 'wait';
    
    // Show searching indicator
    const loadingPopup = L.popup({ className: 'routing-loading' })
        .setLatLng(toPoint)
        .setContent('🥾 Searching Hong Kong trails...')
        .openOn(map);
    
    try {
        let routeLatLngs = null;
        
        // For Hong Kong, we can use a combination of:
        // 1. Check if points are in country parks (likely trails)
        // 2. Use pre-computed trail network (simplified)
        
        // SIMULATED HONG KONG TRAILS
        // In a real app, you'd have a database of HK trail coordinates
        // Here we'll create realistic-looking trails for common HK areas
        
        const hkTrails = {
            // MacLehose Trail sections (simplified)
            macLehose: [
                [22.383, 114.190], [22.385, 114.195], [22.388, 114.200],
                [22.392, 114.205], [22.397, 114.210], [22.403, 114.215],
                [22.410, 114.220], [22.418, 114.225], [22.427, 114.230]
            ],
            // Lantau Trail sections
            lantau: [
                [22.267, 113.917], [22.270, 113.922], [22.275, 113.928],
                [22.282, 113.935], [22.290, 113.942], [22.299, 113.950]
            ],
            // Dragon's Back
            dragonsBack: [
                [22.233, 114.227], [22.236, 114.233], [22.240, 114.238],
                [22.245, 114.242], [22.251, 114.245]
            ]
        };
        
        // Find nearest trail segment
        const allTrailPoints = [...hkTrails.macLehose, ...hkTrails.lantau, ...hkTrails.dragonsBack];
        
        // Find closest point to fromPoint
        let minDistFrom = Infinity;
        let startIdx = 0;
        
        allTrailPoints.forEach((pt, idx) => {
            const dist = L.latLng(pt[0], pt[1]).distanceTo(fromPoint);
            if (dist < minDistFrom) {
                minDistFrom = dist;
                startIdx = idx;
            }
        });
        
        // Find closest point to toPoint
        let minDistTo = Infinity;
        let endIdx = 0;
        
        allTrailPoints.forEach((pt, idx) => {
            const dist = L.latLng(pt[0], pt[1]).distanceTo(toPoint);
            if (dist < minDistTo) {
                minDistTo = dist;
                endIdx = idx;
            }
        });
        
        // If points are near known trails (within 200m)
        if (minDistFrom < 200 && minDistTo < 200) {
            // Generate path along trail points
            routeLatLngs = [];
            const step = endIdx > startIdx ? 1 : -1;
            
            for (let i = startIdx; i !== endIdx + step; i += step) {
                if (i >= 0 && i < allTrailPoints.length) {
                    routeLatLngs.push(L.latLng(allTrailPoints[i][0], allTrailPoints[i][1]));
                }
            }
            
            console.log('Using Hong Kong trail network');
            map.closePopup(loadingPopup);
        }
        
        // If we have a route, add it
        if (routeLatLngs && routeLatLngs.length > 1) {
            saveStateToUndo();
            const newPoints = routeLatLngs.slice(1);
            routePoints = [...routePoints, ...newPoints];
            renderRoute();
        } else {
            // Fallback to wiggly line
            map.closePopup(loadingPopup);
            
            // Create wiggly path
            const numPoints = 15;
            routeLatLngs = [];
            
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const lat = fromPoint.lat + (toPoint.lat - fromPoint.lat) * t;
                const lng = fromPoint.lng + (toPoint.lng - fromPoint.lng) * t;
                
                if (i > 0 && i < numPoints) {
                    // Add Perlin-like noise for natural looking trail
                    const noise1 = Math.sin(i * 1.5) * 0.002;
                    const noise2 = Math.cos(i * 1.8) * 0.002;
                    routeLatLngs.push(L.latLng(lat + noise1, lng + noise2));
                } else {
                    routeLatLngs.push(L.latLng(lat, lng));
                }
            }
            
            saveStateToUndo();
            const newPoints = routeLatLngs.slice(1);
            routePoints = [...routePoints, ...newPoints];
            renderRoute();
            
            // Show notification
            const warningPopup = L.popup({ className: 'routing-warning' })
                .setLatLng(toPoint)
                .setContent('⛰️ Using estimated trail path')
                .openOn(map);
            setTimeout(() => map.closePopup(warningPopup), 3000);
        }
        
    } catch (error) {
        console.error('Routing error:', error);
        // Fallback to straight line with wiggle
        const numPoints = 10;
        const routeLatLngs = [];
        
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const lat = fromPoint.lat + (toPoint.lat - fromPoint.lat) * t;
            const lng = fromPoint.lng + (toPoint.lng - fromPoint.lng) * t;
            
            if (i > 0 && i < numPoints) {
                routeLatLngs.push(L.latLng(lat + (Math.random() * 0.002 - 0.001), 
                                          lng + (Math.random() * 0.002 - 0.001)));
            } else {
                routeLatLngs.push(L.latLng(lat, lng));
            }
        }
        
        saveStateToUndo();
        const newPoints = routeLatLngs.slice(1);
        routePoints = [...routePoints, ...newPoints];
        renderRoute();
    } finally {
        map.closePopup(loadingPopup);
        map.getContainer().style.cursor = '';
        isRouting = false;
    }
}

// ==================== UNDO/REDO ====================
function saveStateToUndo() {
    if (routePoints.length > 0) {
        undoStack.push({
            points: routePoints.map(p => ({ lat: p.lat, lng: p.lng }))
        });
        redoStack = [];
    }
}

function undo() {
    if (undoStack.length === 0) return;
    
    if (routePoints.length > 0) {
        redoStack.push({
            points: routePoints.map(p => ({ lat: p.lat, lng: p.lng }))
        });
    }
    
    const prevState = undoStack.pop();
    routePoints = prevState.points.map(p => L.latLng(p.lat, p.lng));
    renderRoute();
}

function redo() {
    if (redoStack.length === 0) return;
    
    if (routePoints.length > 0) {
        undoStack.push({
            points: routePoints.map(p => ({ lat: p.lat, lng: p.lng }))
        });
    }
    
    const nextState = redoStack.pop();
    routePoints = nextState.points.map(p => L.latLng(p.lat, p.lng));
    renderRoute();
}

function clearRoute() {
    routeLayer.clearLayers();
    markersLayer.clearLayers();
    routePoints = [];
    undoStack = [];
    redoStack = [];
    endFreeDraw();
    updateDistanceDisplay();
}

// ==================== MOUSE CONTROLS ====================
// RIGHT CLICK: First right click sets start point, subsequent right clicks start free draw
let isRightDown = false;

map.on('contextmenu', (e) => {
    e.originalEvent.preventDefault();
    
    if (routePoints.length === 0) {
        // First right click: set start point
        saveStateToUndo();
        routePoints.push(e.latlng);
        renderRoute();
    } else {
        // Subsequent right clicks: start free draw from last point
        isRightDown = true;
        const startPoint = routePoints[routePoints.length - 1];
        startFreeDraw(startPoint);
    }
});

map.on('mousemove', (e) => {
    if (isRightDown && isFreeDrawing) {
        continueFreeDraw(e.latlng);
    }
});

map.on('mouseup', (e) => {
    if (e.originalEvent.button === 2) { // Right button
        if (isFreeDrawing) {
            endFreeDraw();
        }
        isRightDown = false;
    }
});

// LEFT CLICK: Add point based on mode
map.on('click', (e) => {
    if (routePoints.length === 0) {
        // Left click can also set start point
        saveStateToUndo();
        routePoints.push(e.latlng);
        renderRoute();
    } else if (!isFreeDrawing) {
        const lastPt = routePoints[routePoints.length - 1];
        
        if (currentMode === MODES.DRAW_LINE) {
            // Straight line
            saveStateToUndo();
            routePoints.push(e.latlng);
            renderRoute();
        } else {
            // Road following
            followRoadToPoint(lastPt, e.latlng);
        }
    }
});

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
    }
    
    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        endFreeDraw();
        currentMode = currentMode === MODES.DRAW_LINE ? MODES.FOLLOW_ROAD : MODES.DRAW_LINE;
        updateModeDisplay();
        console.log('Mode switched to:', currentMode);
    }
    
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    
    if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        endFreeDraw();
    }
});

// ==================== EXPORT/IMPORT ====================
function exportGPX() {
    if (routePoints.length < 2) {
        alert('Draw a route first!');
        return;
    }
    
    let gpxStr = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpxStr += '<gpx version="1.1" creator="HK Hike Recorder" xmlns="http://www.topografix.com/GPX/1/1">\n';
    gpxStr += '  <metadata>\n';
    gpxStr += '    <time>' + new Date().toISOString() + '</time>\n';
    gpxStr += '    <name>Hong Kong Hiking Route</name>\n';
    gpxStr += '  </metadata>\n';
    gpxStr += '  <trk>\n';
    gpxStr += '    <name>My Hike</name>\n';
    gpxStr += '    <trkseg>\n';
    
    routePoints.forEach(point => {
        gpxStr += `      <trkpt lat="${point.lat}" lon="${point.lng}"></trkpt>\n`;
    });
    
    gpxStr += '    </trkseg>\n';
    gpxStr += '  </trk>\n';
    gpxStr += '</gpx>';
    
    try {
        const blob = new Blob([gpxStr], { type: 'application/gpx+xml;charset=utf-8' });
        saveAs(blob, 'my_hike.gpx');
    } catch (e) {
        alert('Export failed: ' + e.message);
    }
}

function importGPX(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const gpx = parser.parseFromString(e.target.result, 'text/xml');
        
        const trkpts = gpx.querySelectorAll('trkpt');
        if (trkpts.length === 0) {
            alert('No track points found');
            return;
        }
        
        const points = [];
        trkpts.forEach(pt => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lon = parseFloat(pt.getAttribute('lon'));
            if (!isNaN(lat) && !isNaN(lon)) {
                points.push(L.latLng(lat, lon));
            }
        });
        
        if (points.length > 0) {
            clearRoute();
            routePoints = points;
            renderRoute();
        }
    };
    reader.readAsText(file);
}

// ==================== BUTTON HANDLERS ====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('undoBtn')?.addEventListener('click', undo);
    document.getElementById('redoBtn')?.addEventListener('click', redo);
    document.getElementById('clearBtn')?.addEventListener('click', clearRoute);
    document.getElementById('exportBtn')?.addEventListener('click', exportGPX);
    document.getElementById('importBtn')?.addEventListener('click', () => {
        document.getElementById('gpxImport').click();
    });
    document.getElementById('gpxImport')?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importGPX(e.target.files[0]);
        }
        e.target.value = '';
    });
    
    updateModeDisplay();
});

// ==================== INITIAL SETUP ====================
L.control.scale({ imperial: false, metric: true }).addTo(map);

// Add CSS for markers
const style = document.createElement('style');
style.textContent = `
    .custom-marker {
        background: transparent;
        border: none;
    }
    .leaflet-marker-icon {
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .routing-loading .leaflet-popup-content-wrapper {
        background-color: #1E3A8A;
        color: white;
        border-radius: 8px;
    }
    .routing-warning .leaflet-popup-content-wrapper {
        background-color: #FEF3C7;
        color: #92400E;
        border-left: 4px solid #F59E0B;
    }
    .routing-fallback .leaflet-popup-content-wrapper {
        background-color: #FEE2E2;
        color: #991B1B;
        border-left: 4px solid #EF4444;
    }
    .leaflet-routing-container {
        display: none !important;
    }
`;
document.head.appendChild(style);

console.log('Ready - Right click to start!');