# Setup Instructions for Visual Report Designer

## What Was Created

### 1. **New Component**
- `fronthend/src/components/letter/VisualReportDesigner.jsx`
  - Drag-and-drop canvas for positioning images
  - Properties panel for fine-tuning elements
  - Page settings controls
  - Export to PDF functionality

### 2. **Updated Files**
- `fronthend/src/pages/LetterSettings.jsx`
  - Added tabs for "Basic Settings" and "Visual Designer"
  - Integrated the VisualReportDesigner component
  
- `server.js`
  - Added `/upload` endpoint for image uploads
  - Added `/generate-pdf` endpoint for PDF generation using Puppeteer

- `package.json`
  - Added `puppeteer` dependency

### 3. **Database Changes**
- Added `design_template` column to `lettersettings` table
- Stores JSON design configuration

### 4. **New Files**
- `update-lettersettings-design.js` - Schema update script
- `VISUAL_DESIGNER_README.md` - Complete documentation

## Installation Steps (Already Completed)

✅ 1. Installed puppeteer package
✅ 2. Updated database schema with design_template column

## How to Use

### Start the Application

1. **Start the API server:**
```bash
npm run api
```

2. **Start the frontend (in a new terminal):**
```bash
cd fronthend
npm run dev
```

### Access the Visual Designer

1. Navigate to **Letter Settings** page in the application
2. You'll see two tabs at the top:
   - **Basic Settings** - Original settings interface
   - **Visual Designer** - New drag-and-drop designer
3. Click on **Visual Designer** tab

### Using the Designer

#### Main Canvas (Left Side)
- Shows the page with your letterhead and signature images
- Blue dashed border shows the content margin area
- Drag images by clicking and moving them
- Click an image to select it (blue border appears)
- Zoom slider at the top to adjust view (50% - 200%)

#### Properties Panel (Right Side)

**Page Settings Card:**
- Font Family dropdown (Noto Sans Devanagari, Arial, etc.)
- Font Size slider (10px - 24px)
- Page Width and Height in millimeters

**Element Properties Card (appears when element is selected):**
- Upload/replace image
- X and Y position sliders
- Width and Height sliders
- Z-Index for layering (which element appears on top)

#### Bottom Buttons
- **Reset**: Return all elements to default positions
- **Save Design**: Save the design configuration to database
- **Export PDF**: Generate and download a PDF file

## Features

### ✨ Drag & Drop
- Click on letterhead or signature image and drag to any position
- Real-time positioning
- Constrains within page boundaries

### 📏 Precise Control
- Use X/Y sliders for exact positioning (1mm precision)
- Width/Height controls for resizing
- Visual feedback with selection borders

### 🎨 Customization
- Change font family for text content
- Adjust font size
- Configure page dimensions
- Set content margins

### 📤 Export
- Generate PDF with exact positioning
- Maintains image quality
- Respects all design settings

## API Endpoints

### POST /upload
Upload an image file for use in the designer.

**Request:**
- Content-Type: multipart/form-data
- Body: file (image file)

**Response:**
```json
{
  "success": true,
  "url": "/uploads/filename.png"
}
```

### POST /generate-pdf
Generate a PDF from HTML design.

**Request:**
- Content-Type: application/json
- Body: 
```json
{
  "html": "<!DOCTYPE html>..."
}
```

**Response:**
- Content-Type: application/pdf
- Binary PDF data (auto-downloads)

## Technical Architecture

### Frontend Stack
- **React** for UI components
- **Shadcn/ui** for styled components
- **TanStack Query** for data fetching
- **Mouse events** for drag-and-drop

### Backend Stack
- **Express.js** for API server
- **Multer** for file uploads
- **Puppeteer** for PDF generation
- **MySQL** for data storage

### Data Flow
1. User drags images on canvas
2. Position updates in component state
3. Click "Save Design" → stores JSON in database
4. Click "Export PDF" → sends HTML to backend
5. Backend uses Puppeteer to generate PDF
6. PDF downloads automatically

## Design Data Structure

The design is saved as JSON in the `design_template` column:

```json
{
  "elements": [
    {
      "id": "letterhead",
      "type": "image",
      "src": "/uploads/letterhead.png",
      "x": 0,
      "y": 10,
      "width": 210,
      "height": 80,
      "zIndex": 1,
      "draggable": true
    },
    {
      "id": "signature",
      "type": "image", 
      "src": "/uploads/signature.png",
      "x": 140,
      "y": 220,
      "width": 50,
      "height": 40,
      "zIndex": 2,
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
  }
}
```

## Key Differences from Basic Settings

| Feature | Basic Settings | Visual Designer |
|---------|---------------|-----------------|
| Image Positioning | Fixed by margins | Free drag-and-drop |
| Layout Preview | Static mockup | Interactive canvas |
| Precision | Input fields only | Drag + sliders + inputs |
| Export | Uses template system | Direct PDF from design |
| Text Content | Managed elsewhere | Stays within margins |
| Font Control | Template-based | Direct font selection |

## Troubleshooting

### Issue: Tabs not showing
**Solution:** Make sure both API server and frontend are running

### Issue: Images not uploading
**Solution:** 
- Check uploads directory exists
- Verify API server is running on port 3000
- Check file is under 10MB and is JPG/PNG/GIF

### Issue: PDF not generating
**Solution:**
- Check Puppeteer is installed correctly
- Look at server console for errors
- Ensure images are accessible via absolute URLs

### Issue: Can't drag images
**Solution:**
- Click on image first to select it
- Make sure you're not clicking on the margin area
- Refresh the page if needed

## Next Steps

### Immediate
1. ✅ Install dependencies
2. ✅ Update database schema  
3. ✅ Test the designer interface
4. ✅ Upload letterhead and signature images
5. ✅ Export a test PDF

### Future Enhancements
- Add text elements with drag-and-drop
- Template library for common layouts
- Undo/Redo functionality
- Alignment guides and snap-to-grid
- Multi-page support
- Rotation and transform tools

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs for backend errors
3. Verify all dependencies are installed
4. Ensure database connection is working

Refer to `VISUAL_DESIGNER_README.md` for complete documentation.
