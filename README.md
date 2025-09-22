# HK Map Share

A collaborative Hong Kong map application where users can add points of interest with comments and share them with others.

## Features

- 🗺️ Interactive Hong Kong map using Leaflet
- 📍 Click to add points with categories (Restaurant, Attraction, Shopping, Transport, Other)
- 💬 Add comments and set your username
- 🏷️ Filter points by category
- 📤 Export/Import points as JSON files
- 🗑️ Delete points you've added
- 🔄 Real-time sharing (when server mode is enabled)

## Quick Start (Local Mode)

1. Open `index.html` in your web browser
2. Click anywhere on the map to add a point
3. Fill in the details and submit
4. Use the sidebar to filter, export, or import points

## Server Mode Setup (For Real-time Sharing)

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Update `script.js` to use the enhanced version:
   - Replace the script tag in `index.html` to use `script-enhanced.js`
   - Set `USE_SERVER = true` in the script

4. Open `http://localhost:3000` in multiple browsers to test sharing

## Usage

- **Add Point**: Click anywhere on the map, fill the form, and submit
- **View Point**: Click on markers or sidebar items to view details
- **Filter**: Use the category dropdown to filter points
- **Export**: Download all points as a JSON file
- **Import**: Upload a JSON file to merge points
- **Delete**: Use the delete button on points you want to remove

## File Structure

- `index.html` - Main application page
- `script.js` - Client-side JavaScript (local mode)
- `script-enhanced.js` - Enhanced version with server support
- `style.css` - Application styles
- `server.js` - Node.js server for real-time sharing
- `package.json` - Node.js dependencies

## Technologies Used

- Leaflet.js for interactive maps
- OpenStreetMap for map tiles
- Node.js + Express for server (optional)
- Local Storage for offline functionality