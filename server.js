const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'shared-points.json');

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Load points from file
async function loadPoints() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Save points to file
async function savePoints(points) {
    await fs.writeFile(DATA_FILE, JSON.stringify(points, null, 2));
}

// Get all points
app.get('/api/points', async (req, res) => {
    try {
        const points = await loadPoints();
        res.json(points);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Add new point
app.post('/api/points', async (req, res) => {
    try {
        const points = await loadPoints();
        const newPoint = {
            ...req.body,
            id: Date.now(),
            timestamp: new Date().toLocaleString()
        };
        points.push(newPoint);
        await savePoints(points);
        res.json(newPoint);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add point' });
    }
});

// Delete point
app.delete('/api/points/:id', async (req, res) => {
    try {
        const points = await loadPoints();
        const filteredPoints = points.filter(p => p.id !== parseInt(req.params.id));
        await savePoints(filteredPoints);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete point' });
    }
});

app.listen(PORT, () => {
    console.log(`HK Map Share server running at http://localhost:${PORT}`);
});