# HK Map Share

A comprehensive Hong Kong map application for managing points of interest and routes with advanced sharing capabilities.

## Features

### 🗺️ Interactive Map
- Interactive Hong Kong map using Leaflet
- Click to add points anywhere on the map
- 🎯 Add points by entering coordinates
- Right-click to cancel point placement

### 📍 Point Management
- 5 categories: Restaurant 🍽️, Attraction 🏛️, Shopping 🛍️, Transport 🚇, Other 📍
- Add comments and pictures to points
- Edit existing points (category, title, comment, pictures)
- Delete points with confirmation
- Filter points by category
- Click points to zoom to location

### 🛣️ Route Creation
- Create custom routes by connecting points
- Left-click to add waypoints or create new route points
- Right-click to remove points from route
- Edit route names and descriptions
- Edit individual route points
- 8 route colors: blue, red, green, purple, orange, cyan, darkgreen, darkblue
- Click color square to cycle through colors
- Show/hide routes on map
- Expandable route point lists

### 📤 Sharing & Data
- Export all data as JSON files
- Import JSON files to merge data
- Local storage for offline functionality
- All data persists between sessions

## Quick Start

1. **Open `index.html`** in your web browser
2. **Add points**: Click map or use "🎯 Add by Coordinates"
3. **Create routes**: Use "🛣️ Start Route" and click points
4. **Share data**: Use Export/Import buttons

## Usage Guide

### Adding Points
- **Map click**: Click anywhere on map → fill form → submit
- **Coordinates**: Click "🎯 Add by Coordinates" → enter lat,lng → fill form
- **Pictures**: Select multiple images when adding/editing points

### Creating Routes
1. Click "🛣️ Start Route"
2. Left-click existing points or empty areas to add to route
3. Right-click to remove points from route
4. Enter route name and description
5. Click "✅ Finish Route"

### Managing Routes
- **Change color**: Click colored square next to route name
- **Edit route**: Click ✏️ button to edit name/description
- **Edit points**: Click route points in expanded list
- **Show/hide**: Click 👁️ button to toggle route visibility
- **Expand**: Click 🔽 to see all route points

### Sharing Data
- **Export**: Download JSON file with all points and routes
- **Import**: Upload JSON file to merge with existing data
- Share JSON files with others for collaboration

## File Structure

- `index.html` - Main application page
- `script.js` - Complete application logic
- `style.css` - Application styles
- `README.md` - This documentation

## Technologies Used

- **Leaflet.js** - Interactive maps
- **OpenStreetMap** - Map tiles
- **Local Storage** - Data persistence
- **File API** - Picture uploads and JSON import/export
- **Pure JavaScript** - No frameworks required