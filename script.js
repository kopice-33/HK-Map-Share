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

// ==================== ROUTE RENDERING ====================
function renderRoute() {
    routeLayer.clearLayers();
    markersLayer.clearLayers();
    
    if (routePoints.length === 0) {
        // Add a demo point so you can see something
        addDemoPoint();
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

    // Markers for all points - using DIV icon for better visibility
    routePoints.forEach((point, index) => {
        let icon = L.divIcon({
            className: 'custom-marker',
            html: getMarkerHTML(index, routePoints.length),
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        let marker = L.marker(point, { icon: icon, draggable: true });
        
        marker.on('dragend', function(e) {
            const newPos = e.target.getLatLng();
            routePoints[index] = newPos;
            renderRoute();
        });
        
        marker.bindPopup(`Point ${index + 1}<br>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
        markersLayer.addLayer(marker);
    });
}

function getMarkerHTML(index, total) {
    if (index === 0) {
        // Start point - flag icon
        return '<div style="background-color: #22C55E; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">🏁</div>';
    } else if (index === total - 1) {
        // Last point - finish flag
        return '<div style="background-color: #EF4444; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">⛳</div>';
    } else {
        // Middle points - numbered
        return `<div style="background-color: #F97316; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">${index + 1}</div>`;
    }
}

function addDemoPoint() {
    // Add a demo point so users can see what the markers look like
    const demoPoint = L.latLng(22.415, 114.215);
    let icon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #22C55E; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">🏁</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    let marker = L.marker(demoPoint, { icon: icon });
    marker.bindPopup("Start point example<br>Click to begin drawing");
    markersLayer.addLayer(marker);
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
    
    // Add a small marker at start point
    let startIcon = L.divIcon({
        className: 'free-draw-start',
        html: '<div style="background-color: #F97316; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
    
    let startMarker = L.marker(startPoint, { icon: startIcon });
    startMarker.addTo(markersLayer);
    freeDrawPoints.startMarker = startMarker;
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
        
        // Remove start marker
        if (freeDrawPoints.startMarker) {
            markersLayer.removeLayer(freeDrawPoints.startMarker);
        }
        
        freeDrawPoints = [];
        
        // Re-render the main route
        renderRoute();
    }
}

// ==================== ROAD FOLLOWING ====================
async function followRoadToPoint(fromPoint, toPoint) {
    if (!fromPoint || !toPoint || isRouting) return;
    
    isRouting = true;
    map.getContainer().style.cursor = 'wait';
    
    try {
        const router = L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'foot'
        });
        
        router.route([fromPoint, toPoint], (err, routes) => {
            map.getContainer().style.cursor = '';
            
            if (err || !routes || !routes[0]) {
                console.warn('Routing failed, using straight line');
                saveStateToUndo();
                routePoints.push(toPoint);
                renderRoute();
                isRouting = false;
                return;
            }
            
            const coordinates = routes[0].coordinates;
            saveStateToUndo();
            const newPoints = coordinates.slice(1);
            routePoints = [...routePoints, ...newPoints];
            renderRoute();
            isRouting = false;
        });
    } catch (error) {
        console.error('Routing error:', error);
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
    addDemoPoint(); // Show demo point again
}

// ==================== MOUSE CONTROLS ====================
// LEFT CLICK: Add point based on mode
map.on('click', (e) => {
    // Remove demo point if it exists
    markersLayer.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.getPopup()?.getContent()?.includes('example')) {
            markersLayer.removeLayer(layer);
        }
    });
    
    if (isFreeDrawing) {
        endFreeDraw();
        return;
    }
    
    if (routePoints.length === 0) {
        // First point
        saveStateToUndo();
        routePoints.push(e.latlng);
        renderRoute();
    } else {
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

// RIGHT CLICK: Start free draw
let isRightDown = false;

map.on('contextmenu', (e) => {
    e.originalEvent.preventDefault();
    
    // Remove demo point if it exists
    markersLayer.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.getPopup()?.getContent()?.includes('example')) {
            markersLayer.removeLayer(layer);
        }
    });
    
    isRightDown = true;
    
    // Start free draw from last point or clicked point
    const startPoint = routePoints.length > 0 ? routePoints[routePoints.length - 1] : e.latlng;
    startFreeDraw(startPoint);
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

// Add demo point immediately
addDemoPoint();

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
`;
document.head.appendChild(style);