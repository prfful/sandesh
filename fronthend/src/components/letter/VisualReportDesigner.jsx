import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, Save, Eye, RotateCcw, Move, Type, Image as ImageIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function VisualReportDesigner({ settings, onSave }) {
  const canvasRef = useRef(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nextId, setNextId] = useState(3);
  
  const [elements, setElements] = useState([
    {
      id: 'letterhead',
      type: 'image',
      src: settings?.letterhead_url || '',
      x: 0,
      y: 10,
      width: 210,
      height: 80,
      zIndex: 1,
      draggable: true
    },
    {
      id: 'signature',
      type: 'image',
      src: settings?.signature_url || '',
      x: 140,
      y: 220,
      width: 50,
      height: 40,
      zIndex: 2,
      draggable: true
    }
  ]);

  const [pageSettings, setPageSettings] = useState({
    width: settings?.page_width || 210,
    height: settings?.page_height || 297,
    fontSize: 16,
    fontFamily: 'Noto Sans Devanagari'
  });

  const [scale, setScale] = useState(1.5);

  // Available fonts
  const fonts = [
    'Noto Sans Devanagari',
    'Arial',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Tahoma'
  ];

  // Handle mouse down on element for dragging
  const handleMouseDown = (e, element) => {
    if (!element.draggable) return;
    
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const elementX = element.x * scale;
    const elementY = element.y * scale;
    
    setSelectedElement(element);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left - elementX,
      y: e.clientY - rect.top - elementY
    });
  };

  // Handle mouse down on resize handle
  const handleResizeMouseDown = (e, element, handle) => {
    e.stopPropagation();
    setSelectedElement(element);
    setIsResizing(true);
    setResizeHandle(handle);
    
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      startWidth: element.width,
      startHeight: element.height,
      startX: element.x,
      startY: element.y
    });
  };

  // Handle mouse move for dragging and resizing
  const handleMouseMove = (e) => {
    if (isDragging && selectedElement) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - rect.left - dragOffset.x) / scale;
      const newY = (e.clientY - rect.top - dragOffset.y) / scale;

      // Constrain to page boundaries
      const constrainedX = Math.max(0, Math.min(newX, pageSettings.width - selectedElement.width));
      const constrainedY = Math.max(0, Math.min(newY, pageSettings.height - selectedElement.height));

      setElements(elements.map(el => 
        el.id === selectedElement.id 
          ? { ...el, x: constrainedX, y: constrainedY }
          : el
      ));
    } else if (isResizing && selectedElement) {
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left) / scale;
      const currentY = (e.clientY - rect.top) / scale;
      const deltaX = currentX - dragOffset.x / scale;
      const deltaY = currentY - dragOffset.y / scale;

      let newWidth = dragOffset.startWidth;
      let newHeight = dragOffset.startHeight;
      let newX = dragOffset.startX;
      let newY = dragOffset.startY;

      switch (resizeHandle) {
        case 'se': // bottom-right
          newWidth = Math.max(10, dragOffset.startWidth + deltaX);
          newHeight = Math.max(10, dragOffset.startHeight + deltaY);
          break;
        case 'sw': // bottom-left
          newWidth = Math.max(10, dragOffset.startWidth - deltaX);
          newHeight = Math.max(10, dragOffset.startHeight + deltaY);
          newX = dragOffset.startX + deltaX;
          break;
        case 'ne': // top-right
          newWidth = Math.max(10, dragOffset.startWidth + deltaX);
          newHeight = Math.max(10, dragOffset.startHeight - deltaY);
          newY = dragOffset.startY + deltaY;
          break;
        case 'nw': // top-left
          newWidth = Math.max(10, dragOffset.startWidth - deltaX);
          newHeight = Math.max(10, dragOffset.startHeight - deltaY);
          newX = dragOffset.startX + deltaX;
          newY = dragOffset.startY + deltaY;
          break;
        case 'e': // right
          newWidth = Math.max(10, dragOffset.startWidth + deltaX);
          break;
        case 'w': // left
          newWidth = Math.max(10, dragOffset.startWidth - deltaX);
          newX = dragOffset.startX + deltaX;
          break;
        case 'n': // top
          newHeight = Math.max(10, dragOffset.startHeight - deltaY);
          newY = dragOffset.startY + deltaY;
          break;
        case 's': // bottom
          newHeight = Math.max(10, dragOffset.startHeight + deltaY);
          break;
      }

      // Constrain to page boundaries
      if (newX < 0) {
        newWidth += newX;
        newX = 0;
      }
      if (newY < 0) {
        newHeight += newY;
        newY = 0;
      }
      if (newX + newWidth > pageSettings.width) {
        newWidth = pageSettings.width - newX;
      }
      if (newY + newHeight > pageSettings.height) {
        newHeight = pageSettings.height - newY;
      }

      setElements(elements.map(el => 
        el.id === selectedElement.id 
          ? { ...el, x: newX, y: newY, width: newWidth, height: newHeight }
          : el
      ));
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  // Add event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, selectedElement, dragOffset, resizeHandle]);

  // Update element property
  const updateElement = (id, property, value) => {
    setElements(elements.map(el => 
      el.id === id ? { ...el, [property]: value } : el
    ));
  };

  // Add new text element
  const addTextElement = () => {
    const newElement = {
      id: `text-${nextId}`,
      type: 'text',
      content: 'Sample Text',
      x: 40,
      y: 100,
      width: 50,
      height: 8,
      fontSize: pageSettings.fontSize,
      fontFamily: pageSettings.fontFamily,
      zIndex: nextId,
      draggable: true,
      isPlaceholder: false,
      placeholder: ''
    };
    setElements([...elements, newElement]);
    setNextId(nextId + 1);
    setSelectedElement(newElement);
    toast.success('Text element added');
  };

  // Add new placeholder element
  const addPlaceholderElement = (placeholderName) => {
    // Determine size based on field type
    let width = 40, height = 7;
    if (['detail', 'place_time', 'LocalProgram'].includes(placeholderName)) {
      width = 150; // Wider for longer text
      height = 20; // Taller for multi-line
    } else if (['SenderName', 'Village', 'District'].includes(placeholderName)) {
      width = 60;
      height = 7;
    } else {
      width = 40;
      height = 7;
    }
    
    const newElement = {
      id: `placeholder-${nextId}`,
      type: 'text',
      content: `{${placeholderName}}`,
      x: 40,
      y: 100 + ((nextId - 3) * 10),
      width: width,
      height: height,
      fontSize: pageSettings.fontSize,
      fontFamily: pageSettings.fontFamily,
      zIndex: nextId,
      draggable: true,
      isPlaceholder: true,
      placeholder: placeholderName
    };
    setElements([...elements, newElement]);
    setNextId(nextId + 1);
    setSelectedElement(newElement);
    toast.success(`Placeholder {${placeholderName}} added`);
  };

  // Delete element
  const deleteElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElement?.id === id) {
      setSelectedElement(null);
    }
    toast.success('Element deleted');
  };

  // Handle image upload — convert to base64 so images are stored in DB and survive deploys.
  const handleImageUpload = (e, elementId) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a JPG or PNG image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB');
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const base64Url = canvas.toDataURL('image/jpeg', 0.82);
      updateElement(elementId, 'src', base64Url);
      toast.success('Image loaded successfully');
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); toast.error('Failed to load image'); };
    img.src = objectUrl;
  };

  // Reset to default positions
  const handleReset = () => {
    setElements([
      {
        id: 'letterhead',
        type: 'image',
        src: settings?.letterhead_url || '',
        x: 0,
        y: 10,
        width: 210,
        height: 80,
        zIndex: 1,
        draggable: true
      },
      {
        id: 'signature',
        type: 'image',
        src: settings?.signature_url || '',
        x: 140,
        y: 220,
        width: 50,
        height: 40,
        zIndex: 2,
        draggable: true
      }
    ]);
    toast.success('Reset to default positions');
  };

  // Generate HTML for PDF
  const generateHTML = () => {
    // Convert relative URLs to absolute for PDF generation
    const toAbsoluteUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/')) return `${window.location.origin}${url}`;
      return url;
    };

    // Resolve image URLs for PDF rendering.
    // base64 data-URLs are stored directly in the DB; pass them through unchanged.
    const toDirectUploadUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('data:')) return url;
      if (url.includes('/uploads/')) {
        return toAbsoluteUrl(url.substring(url.indexOf('/uploads/')));
      }
      return toAbsoluteUrl(url);
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: ${pageSettings.width}mm ${pageSettings.height}mm;
      margin: 0;
    }
    
    body {
      font-family: '${pageSettings.fontFamily}', Arial, sans-serif;
      font-size: ${pageSettings.fontSize}px;
      width: ${pageSettings.width}mm;
      height: ${pageSettings.height}mm;
      position: relative;
    }
    
    .page-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    ${elements.map(el => `
    .element-${el.id} {
      position: absolute;
      left: ${el.x}mm;
      top: ${el.y}mm;
      width: ${el.width}mm;
      ${el.type === 'text' ? `height: auto; min-height: ${el.height}mm;` : `height: ${el.height}mm;`}
      z-index: ${el.zIndex};
      ${el.type === 'text' ? `
        font-family: '${el.fontFamily}', Arial, sans-serif;
        font-size: ${el.fontSize}px;
        white-space: pre-wrap;
        word-wrap: break-word;
      ` : ''}
    }
    `).join('\n')}
  </style>
</head>
<body>
  <div class="page-container">
    ${elements.map(el => `
    <div class="element-${el.id}">
      ${el.type === 'image' && el.src ? `<img src="${toDirectUploadUrl(el.src)}" style="width: 100%; height: 100%; object-fit: contain;" />` : ''}
      ${el.type === 'text' ? el.content : ''}
    </div>
    `).join('\n')}
  </div>
</body>
</html>
    `.trim();
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const html = generateHTML();
    
    try {
      if (!window.html2pdf || typeof window.html2pdf !== 'function') {
        throw new Error('html2pdf library not loaded. Please refresh the page.');
      }

      const options = {
        margin: 0,
        filename: 'report-design.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        }
      };

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (doc?.head) {
        doc.head.querySelectorAll('style').forEach(s => container.appendChild(s.cloneNode(true)));
      }
      if (doc?.body?.innerHTML) {
        container.insertAdjacentHTML('beforeend', doc.body.innerHTML);
      }

      document.body.appendChild(container);

      const images = container.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => new Promise(resolve => {
        if (img.complete) resolve();
        img.onload = resolve;
        img.onerror = resolve;
      })));

      await window.html2pdf().set(options).from(container).save();
      
      if (container.parentNode) container.parentNode.removeChild(container);
      toast.success('PDF generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Save design
  const handleSave = () => {
    const designData = {
      elements,
      pageSettings,
      htmlTemplate: generateHTML()
    };
    
    onSave(designData);
    toast.success('Design saved successfully');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Canvas Area */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Design Canvas
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Zoom:</Label>
                <Slider
                  value={[scale]}
                  onValueChange={([v]) => setScale(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-32"
                />
                <span className="text-sm font-medium w-12">{Math.round(scale * 100)}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-4 bg-gray-100 rounded-lg overflow-auto">
              <div
                ref={canvasRef}
                className="relative bg-white shadow-2xl border border-gray-300"
                style={{
                  width: `${pageSettings.width * scale}px`,
                  height: `${pageSettings.height * scale}px`,
                  cursor: isDragging ? 'grabbing' : 'default'
                }}
                onClick={() => setSelectedElement(null)}
              >
                {/* Render elements */}
                {elements.map((element) => (
                  <div
                    key={element.id}
                    className={`absolute ${
                      selectedElement?.id === element.id
                        ? 'border-2 border-blue-500 shadow-lg'
                        : 'border-2 border-transparent hover:border-gray-400'
                    } ${element.draggable ? 'cursor-move' : ''}`}
                    style={{
                      left: `${element.x * scale}px`,
                      top: `${element.y * scale}px`,
                      width: `${element.width * scale}px`,
                      height: element.type === 'text' ? 'auto' : `${element.height * scale}px`,
                      minHeight: element.type === 'text' ? `${element.height * scale}px` : undefined,
                      zIndex: element.zIndex,
                      fontFamily: element.type === 'text' ? element.fontFamily : undefined,
                      fontSize: element.type === 'text' ? `${element.fontSize * scale}px` : undefined,
                      whiteSpace: element.type === 'text' ? 'pre-wrap' : undefined,
                      wordWrap: element.type === 'text' ? 'break-word' : undefined,
                      overflow: 'hidden'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, element)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElement(element);
                    }}
                  >
                    {element.type === 'image' && element.src && (
                      <img
                        src={element.src}
                        alt={element.id}
                        className="w-full h-full object-contain pointer-events-none"
                        draggable={false}
                      />
                    )}
                    {element.type === 'image' && !element.src && (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    {element.type === 'text' && (
                      <div className="p-1 pointer-events-none">
                        {element.content}
                      </div>
                    )}
                    {selectedElement?.id === element.id && (
                      <>
                        <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded z-50">
                          {element.id}
                        </div>
                        {/* Resize handles */}
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-nw-resize -top-1 -left-1"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'nw')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-n-resize -top-1 left-1/2 -translate-x-1/2"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'n')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-ne-resize -top-1 -right-1"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'ne')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-e-resize top-1/2 -translate-y-1/2 -right-1"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'e')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-se-resize -bottom-1 -right-1"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'se')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-s-resize -bottom-1 left-1/2 -translate-x-1/2"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 's')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-sw-resize -bottom-1 -left-1"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'sw')}
                        />
                        <div 
                          className="absolute w-2 h-2 bg-blue-500 rounded-full cursor-w-resize top-1/2 -translate-y-1/2 -left-1"
                          onMouseDown={(e) => handleResizeMouseDown(e, element, 'w')}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <div className="flex justify-center gap-2">
                <Button onClick={addTextElement} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Text
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={handleSave} variant="default" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save Design
                </Button>
                <Button onClick={handleExportPDF} variant="default" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
              <div className="border-t pt-2">
                <Label className="text-xs font-semibold mb-2 block">Add Template Data Fields:</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Button onClick={() => addPlaceholderElement('SenderName')} variant="outline" size="sm" className="text-xs h-7">+Sender</Button>
                  <Button onClick={() => addPlaceholderElement('Village')} variant="outline" size="sm" className="text-xs h-7">+Village</Button>
                  <Button onClick={() => addPlaceholderElement('District')} variant="outline" size="sm" className="text-xs h-7">+District</Button>
                  <Button onClick={() => addPlaceholderElement('Mob')} variant="outline" size="sm" className="text-xs h-7">+Mobile</Button>
                  <Button onClick={() => addPlaceholderElement('Date')} variant="outline" size="sm" className="text-xs h-7">+Date</Button>
                  <Button onClick={() => addPlaceholderElement('programtyp')} variant="outline" size="sm" className="text-xs h-7">+Type</Button>
                  <Button onClick={() => addPlaceholderElement('ProgramFor')} variant="outline" size="sm" className="text-xs h-7">+For</Button>
                  <Button onClick={() => addPlaceholderElement('place_time')} variant="outline" size="sm" className="text-xs h-7">+Time</Button>
                  <Button onClick={() => addPlaceholderElement('detail')} variant="outline" size="sm" className="text-xs h-7">+Detail</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Properties Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Page Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={pageSettings.fontFamily}
                onValueChange={(value) => setPageSettings({ ...pageSettings, fontFamily: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fonts.map(font => (
                    <SelectItem key={font} value={font}>{font}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Font Size: {pageSettings.fontSize}px</Label>
              <Slider
                value={[pageSettings.fontSize]}
                onValueChange={([value]) => setPageSettings({ ...pageSettings, fontSize: value })}
                min={10}
                max={24}
                step={1}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Input
                  type="number"
                  value={pageSettings.width}
                  onChange={(e) => setPageSettings({ ...pageSettings, width: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Height (mm)</Label>
                <Input
                  type="number"
                  value={pageSettings.height}
                  onChange={(e) => setPageSettings({ ...pageSettings, height: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedElement && (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">Element Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{selectedElement.id}</Label>
                {!['letterhead', 'signature'].includes(selectedElement.id) && (
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteElement(selectedElement.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>

              {selectedElement.type === 'image' && (
                <div className="space-y-2">
                  <Label>Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, selectedElement.id)}
                  />
                  {selectedElement.src && (
                    <img src={selectedElement.src} alt="preview" className="w-full h-20 object-contain border rounded" />
                  )}
                </div>
              )}

              {selectedElement.type === 'text' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="isPlaceholder"
                        checked={selectedElement.isPlaceholder || false}
                        onChange={(e) => updateElement(selectedElement.id, 'isPlaceholder', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="isPlaceholder" className="cursor-pointer">Use as Template Placeholder</Label>
                    </div>
                    <Label>{selectedElement.isPlaceholder ? 'Placeholder Field' : 'Text Content'}</Label>
                    {selectedElement.isPlaceholder ? (
                      <>
                        <Select
                          value={selectedElement.placeholder || ''}
                          onValueChange={(value) => {
                            updateElement(selectedElement.id, 'placeholder', value);
                            updateElement(selectedElement.id, 'content', `{${value}}`);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SenderName">Sender Name</SelectItem>
                            <SelectItem value="Village">Village</SelectItem>
                            <SelectItem value="District">District</SelectItem>
                            <SelectItem value="Street">Street</SelectItem>
                            <SelectItem value="Mob">Mobile</SelectItem>
                            <SelectItem value="Date">Date</SelectItem>
                            <SelectItem value="programtyp">Program Type</SelectItem>
                            <SelectItem value="ProgramFor">Program For</SelectItem>
                            <SelectItem value="Relation_to_sender">Relation</SelectItem>
                            <SelectItem value="place_time">Place & Time</SelectItem>
                            <SelectItem value="LocalProgram">Local Program</SelectItem>
                            <SelectItem value="detail">Detail</SelectItem>
                            <SelectItem value="Sn">Serial Number</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="space-y-2 mt-2">
                          <Label className="text-xs">Edit Combined Text:</Label>
                          <Textarea
                            value={selectedElement.content}
                            onChange={(e) => updateElement(selectedElement.id, 'content', e.target.value)}
                            rows={3}
                            placeholder="e.g., {programtyp} for {ProgramFor} - {detail}"
                            className="text-sm font-mono"
                          />
                          <p className="text-xs text-gray-600">Combine fields: <code className="bg-gray-100 px-1 rounded">{"{field1} text {field2}"}</code></p>
                        </div>
                      </>
                    ) : (
                      <Textarea
                        value={selectedElement.content}
                        onChange={(e) => updateElement(selectedElement.id, 'content', e.target.value)}
                        rows={4}
                        placeholder="Enter text content or use {FieldName} for placeholders..."
                      />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select
                      value={selectedElement.fontFamily}
                      onValueChange={(value) => updateElement(selectedElement.id, 'fontFamily', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fonts.map(font => (
                          <SelectItem key={font} value={font}>{font}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Font Size: {selectedElement.fontSize}px</Label>
                    <Slider
                      value={[selectedElement.fontSize]}
                      onValueChange={([value]) => updateElement(selectedElement.id, 'fontSize', value)}
                      min={8}
                      max={48}
                      step={1}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>X: {Math.round(selectedElement.x)}mm</Label>
                  <Slider
                    value={[selectedElement.x]}
                    onValueChange={([value]) => updateElement(selectedElement.id, 'x', value)}
                    min={0}
                    max={pageSettings.width - selectedElement.width}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Y: {Math.round(selectedElement.y)}mm</Label>
                  <Slider
                    value={[selectedElement.y]}
                    onValueChange={([value]) => updateElement(selectedElement.id, 'y', value)}
                    min={0}
                    max={pageSettings.height - selectedElement.height}
                    step={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Width: {Math.round(selectedElement.width)}mm</Label>
                  <Slider
                    value={[selectedElement.width]}
                    onValueChange={([value]) => updateElement(selectedElement.id, 'width', value)}
                    min={10}
                    max={pageSettings.width}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height: {Math.round(selectedElement.height)}mm</Label>
                  <Slider
                    value={[selectedElement.height]}
                    onValueChange={([value]) => updateElement(selectedElement.id, 'height', value)}
                    min={10}
                    max={pageSettings.height}
                    step={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Z-Index: {selectedElement.zIndex}</Label>
                <Slider
                  value={[selectedElement.zIndex]}
                  onValueChange={([value]) => updateElement(selectedElement.id, 'zIndex', value)}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
