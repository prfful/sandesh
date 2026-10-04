# Visual Report Designer

## Overview
The Visual Report Designer is an interactive drag-and-drop interface for designing letter/report layouts. Users can position letterhead images and signature images anywhere on the page by dragging them with the mouse.

## Features

### 1. **Drag & Drop Interface**
- Click and drag images (letterhead, signature) to any position on the page
- Real-time visual feedback with selection borders
- Snap to page boundaries

### 2. **Image Management**
- Upload letterhead and signature images
- Resize images using sliders or direct input
- Position images precisely using X/Y coordinates
- Control layer ordering with Z-index

### 3. **Page Settings**
- Configure page dimensions (width, height)
- Set content margins (top, bottom, left, right)
- Choose font family from available fonts
- Adjust font size (10px - 24px)
- Zoom in/out for better precision (50% - 200%)

### 4. **Element Properties Panel**
- X/Y position controls
- Width/Height adjustment
- Z-index for layering
- Image upload/replace

### 5. **Export Options**
- **Save Design**: Saves the design configuration to database
- **Export PDF**: Generates a PDF using the current design
- **Reset**: Returns all elements to default positions

## How to Use

### Step 1: Access the Designer
1. Navigate to **Letter Settings** page
2. Click on the **Visual Designer** tab

### Step 2: Design Your Layout
1. **Drag Images**: Click and drag letterhead or signature to desired position
2. **Resize**: Use sliders in the properties panel or drag corner handles
3. **Upload Images**: Select an element and upload a new image
4. **Adjust Settings**: Modify font, margins, and page dimensions

### Step 3: Fine-tune Positioning
1. Select an element by clicking on it
2. Use the properties panel for precise positioning
3. Adjust X, Y coordinates using sliders
4. Change width and height as needed

### Step 4: Export
1. **Save Design**: Click "Save Design" to store configuration
2. **Export PDF**: Click "Export PDF" to generate a PDF file
3. The PDF will be downloaded automatically

## Technical Details

### Frontend Components
- **VisualReportDesigner.jsx**: Main designer component
- Uses React hooks for state management
- Drag-and-drop using mouse events
- Real-time canvas rendering

### Backend API
- **POST /upload**: Upload images for letterhead/signature
- **POST /generate-pdf**: Convert HTML design to PDF using Puppeteer

### Database Schema
```sql
ALTER TABLE lettersettings ADD COLUMN design_template TEXT;
```
Stores the design configuration as JSON.

### Design Data Structure
```json
{
  "elements": [
    {
      "id": "letterhead",
      "type": "image",
      "src": "/uploads/image.png",
      "x": 0,
      "y": 10,
      "width": 210,
      "height": 80,
      "zIndex": 1,
      "draggable": true
    }
  ],
  "pageSettings": {
    "width": 210,
    "height": 297,
    "marginTop": 20,
    "marginBottom": 20,
    "marginLeft": 20,
    "marginRight": 20,
    "fontSize": 16,
    "fontFamily": "Noto Sans Devanagari"
  },
  "htmlTemplate": "<!DOCTYPE html>..."
}
```

## Installation

### 1. Install Dependencies
```bash
npm install puppeteer
```

### 2. Update Database Schema
```bash
node update-lettersettings-design.js
```

### 3. Start the Server
```bash
npm run api
```

### 4. Start Frontend
```bash
npm run frontend:dev
```

## Key Concepts

### Margins vs Image Positioning
- **Margins**: Define the content area where text should stay
- **Images**: Can be placed anywhere on the page, not restricted by margins
- The blue dashed border shows the content margin area
- Images can extend beyond this area

### Coordinate System
- Origin (0,0) is at the top-left corner of the page
- All measurements are in millimeters (mm)
- X increases from left to right
- Y increases from top to bottom

### Element Layering
- Z-index controls which element appears on top
- Higher z-index = appears on top of lower z-index elements
- Useful when images overlap

## Browser Compatibility
- Modern browsers with drag-and-drop support
- Chrome, Firefox, Safari, Edge (latest versions)
- Requires JavaScript enabled

## Troubleshooting

### Images not uploading?
- Check server is running on port 3000
- Verify uploads directory exists
- Check file size (max 10MB)
- Only JPG, PNG, GIF allowed

### PDF not generating?
- Ensure Puppeteer is installed correctly
- Check server logs for errors
- Verify HTML is valid

### Drag & Drop not working?
- Make sure element is selected
- Check browser console for errors
- Try refreshing the page

## Future Enhancements
- Add text elements with drag-and-drop
- Support for multiple pages
- Template library
- Undo/Redo functionality
- Grid and alignment guides
- Copy/paste elements
- Rotation and flip transformations
