import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, X, Maximize2 } from "lucide-react";
import restClient from "@/api/restClient";
import { toast } from "sonner";

export default function VisualTemplateDesigner({ template, onUpdate }) {
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [uploading, setUploading] = useState({ letterhead: false, signature: false, signature2: false });
  const canvasRef = useRef(null);
  const letterheadInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const signature2InputRef = useRef(null);

  const normalizeUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return url;
  };

  // Safeguard: provide sane defaults if template lacks layout props
  const safe = {
    letterhead: {
      x: template?.letterhead_x ?? 0,
      y: template?.letterhead_y ?? 0,
      width: template?.letterhead_width ?? 100,
      height: template?.letterhead_height ?? 15,
    },
    signature: {
      x: template?.signature_x ?? 70,
      y: template?.signature_y ?? 75,
      width: template?.signature_width ?? 25,
      height: template?.signature_height ?? 10,
    },
    signature2: {
      x: template?.signature2_x ?? 30,
      y: template?.signature2_y ?? 75,
      width: template?.signature2_width ?? 25,
      height: template?.signature2_height ?? 10,
    },
  };

  const handleUpload = async (type, file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error("कृपया JPG या PNG फ़ाइल चुनें");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("छवि का आकार 5MB से कम होना चाहिए");
      return;
    }

    setUploading(prev => ({ ...prev, [type]: true }));

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload file to server
      const uploadResult = await restClient.uploadFile(formData);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('Upload failed');
      }

      const fileUrl = uploadResult.url;
      const updates = { [`${type}_url`]: fileUrl };

      if (type === 'letterhead' && !template.letterhead_url) {
        updates.letterhead_x = safe.letterhead.x;
        updates.letterhead_y = safe.letterhead.y;
        updates.letterhead_width = safe.letterhead.width;
        updates.letterhead_height = safe.letterhead.height;
        updates.letterhead_lock_aspect = true;
        updates.letterhead_lock_position = false;
        updates.letterhead_expand_width = false;
      } else if (type === 'signature' && !template.signature_url) {
        updates.signature_x = safe.signature.x;
        updates.signature_y = safe.signature.y;
        updates.signature_width = safe.signature.width;
        updates.signature_height = safe.signature.height;
        updates.signature_lock_aspect = true;
        updates.signature_lock_position = false;
      } else if (type === 'signature2' && !template.signature2_url) {
        updates.signature2_x = safe.signature2.x;
        updates.signature2_y = safe.signature2.y;
        updates.signature2_width = safe.signature2.width;
        updates.signature2_height = safe.signature2.height;
        updates.signature2_lock_aspect = true;
        updates.signature2_lock_position = false;
      }

      onUpdate(updates);
      const displayName = type === 'letterhead' ? 'लेटरहेड' : (type === 'signature2' ? 'दूसरा हस्ताक्षर' : 'हस्ताक्षर');
      toast.success(`${displayName} अपलोड हुआ - अब 'सहेजें' दबाएं`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("छवि अपलोड में त्रुटि हुई");
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleFileSelect = (type) => (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(type, file);
    }
    e.target.value = '';
  };

  const handleMouseDown = (e, type) => {
    if (template[`${type}_lock_position`]) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    setDragging({
      type,
      startX,
      startY,
      initialX: template[`${type}_x`] ?? safe[type].x,
      initialY: template[`${type}_y`] ?? safe[type].y,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging && !resizing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    if (dragging) {
      const { type, startX, startY, initialX, initialY } = dragging;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      const newX = Math.max(0, Math.min(100 - template[`${type}_width`], initialX + deltaX));
      const newY = Math.max(0, Math.min(100 - template[`${type}_height`], initialY + deltaY));

      onUpdate({
        [`${type}_x`]: newX,
        [`${type}_y`]: newY,
      });
    } else if (resizing) {
      const { type, corner, initialWidth, initialHeight, initialX, initialY, startX, startY } = resizing;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      let newWidth = initialWidth;
      let newHeight = initialHeight;
      let newX = initialX;
      let newY = initialY;

      if (corner.includes('e')) {
        newWidth = Math.max(10, Math.min(100 - initialX, initialWidth + deltaX));
      }
      if (corner.includes('s')) {
        newHeight = Math.max(10, Math.min(100 - initialY, initialHeight + deltaY));
      }
      if (corner.includes('w')) {
        const change = Math.min(deltaX, initialWidth - 10);
        newWidth = initialWidth - change;
        newX = initialX + change;
      }
      if (corner.includes('n')) {
        const change = Math.min(deltaY, initialHeight - 10);
        newHeight = initialHeight - change;
        newY = initialY + change;
      }

      if (template[`${type}_lock_aspect`]) {
        const aspectRatio = initialWidth / initialHeight;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      }

      onUpdate({
        [`${type}_width`]: newWidth,
        [`${type}_height`]: newHeight,
        [`${type}_x`]: newX,
        [`${type}_y`]: newY,
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  const handleResizeStart = (e, type, corner) => {
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    setResizing({
      type,
      corner,
      startX,
      startY,
      initialX: template[`${type}_x`] ?? safe[type].x,
      initialY: template[`${type}_y`] ?? safe[type].y,
      initialWidth: template[`${type}_width`] ?? safe[type].width,
      initialHeight: template[`${type}_height`] ?? safe[type].height,
    });
  };

  const handleExpandWidth = (type) => {
    const isExpanded = template[`${type}_expand_width`];
    onUpdate({
      [`${type}_expand_width`]: !isExpanded,
      [`${type}_x`]: !isExpanded ? 0 : template[`${type}_x`],
      [`${type}_width`]: !isExpanded ? 100 : 80,
    });
  };

  const handleDelete = (type) => {
    const defaults = {
      letterhead: { x: 0, y: 0, width: 100, height: 15 },
      signature: { x: 70, y: 75, width: 25, height: 10 },
      signature2: { x: 30, y: 75, width: 25, height: 10 },
    };
    const def = defaults[type] || defaults.signature;
    
    onUpdate({
      [`${type}_url`]: null,
      [`${type}_x`]: def.x,
      [`${type}_y`]: def.y,
      [`${type}_width`]: def.width,
      [`${type}_height`]: def.height,
    });
    
    const displayName = type === 'letterhead' ? 'लेटरहेड' : (type === 'signature2' ? 'दूसरा हस्ताक्षर' : 'हस्ताक्षर');
    toast.success(`${displayName} हटाया गया`);
  };

  return (
    <Card className="border-blue-100 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <CardTitle className="text-lg font-bold text-gray-900">
          विज़ुअल टेम्पलेट डिज़ाइनर
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          लेटरहेड और हस्ताक्षर खींचें और आकार बदलें
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Upload Controls */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>लेटरहेड छवि</Label>
            {template.letterhead_url ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => letterheadInputRef.current?.click()}
                  disabled={uploading.letterhead}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {uploading.letterhead ? "अपलोड हो रहा है..." : "बदलें"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete('letterhead')}
                  disabled={uploading.letterhead}
                  className="gap-2 text-red-600"
                >
                  <X className="w-4 h-4" />
                  हटाएं
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => letterheadInputRef.current?.click()}
                disabled={uploading.letterhead}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading.letterhead ? "अपलोड हो रहा है..." : "अपलोड करें"}
              </Button>
            )}
            <input
              ref={letterheadInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect('letterhead')}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <Label>हस्ताक्षर छवि</Label>
            {template.signature_url ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={uploading.signature}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {uploading.signature ? "अपलोड हो रहा है..." : "बदलें"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete('signature')}
                  disabled={uploading.signature}
                  className="gap-2 text-red-600"
                >
                  <X className="w-4 h-4" />
                  हटाएं
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => signatureInputRef.current?.click()}
                disabled={uploading.signature}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading.signature ? "अपलोड हो रहा है..." : "अपलोड करें"}
              </Button>
            )}
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect('signature')}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <Label>दूसरा हस्ताक्षर छवि (वैकल्पिक)</Label>
            {template.signature2_url ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => signature2InputRef.current?.click()}
                  disabled={uploading.signature2}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {uploading.signature2 ? "अपलोड हो रहा है..." : "बदलें"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete('signature2')}
                  disabled={uploading.signature2}
                  className="gap-2 text-red-600"
                >
                  <X className="w-4 h-4" />
                  हटाएं
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => signature2InputRef.current?.click()}
                disabled={uploading.signature2}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading.signature2 ? "अपलोड हो रहा है..." : "अपलोड करें"}
              </Button>
            )}
            <input
              ref={signature2InputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect('signature2')}
              className="hidden"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>पहला हस्ताक्षर लेबल</Label>
              <Input
                type="text"
                value={template.signature_label || ''}
                onChange={(e) => onUpdate({ signature_label: e.target.value })}
                placeholder="उदा.: (प्रेषक)"
              />
            </div>
            <div className="space-y-2">
              <Label>दूसरा हस्ताक्षर लेबल</Label>
              <Input
                type="text"
                value={template.signature2_label || ''}
                onChange={(e) => onUpdate({ signature2_label: e.target.value })}
                placeholder="उदा.: (सह हस्ताक्षरकर्ता)"
              />
            </div>
          </div>
        </div>

        {/* Visual Canvas */}
        <div
          ref={canvasRef}
          className="relative w-full bg-white border-2 border-gray-300 rounded-lg shadow-inner overflow-hidden cursor-crosshair"
          style={{ aspectRatio: '210 / 297', minHeight: '500px' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-4 border border-dashed border-gray-300 bg-gray-50/50" style={{ zIndex: 1, pointerEvents: 'none' }} />

          {/* Letterhead */}
          {template.letterhead_url && (
            <div
              className="absolute border-2 border-blue-500 cursor-move hover:border-blue-600 transition-colors group"
              style={{
                left: `${safe.letterhead.x}%`,
                top: `${safe.letterhead.y}%`,
                width: `${safe.letterhead.width}%`,
                height: `${safe.letterhead.height}%`,
                zIndex: 2,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'letterhead')}
            >
              <img
                src={normalizeUrl(template.letterhead_url)}
                alt="Letterhead"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2 py-1">
                लेटरहेड
              </div>
              
              {!template.letterhead_lock_position && (
                <>
                  <div
                    className="absolute top-0 left-0 w-3 h-3 bg-blue-500 cursor-nw-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'letterhead', 'nw')}
                  />
                  <div
                    className="absolute top-0 right-0 w-3 h-3 bg-blue-500 cursor-ne-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'letterhead', 'ne')}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 cursor-sw-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'letterhead', 'sw')}
                  />
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'letterhead', 'se')}
                  />
                </>
              )}
            </div>
          )}

          {/* Signature */}
          {template.signature_url && (
            <div
              className="absolute border-2 border-green-500 cursor-move hover:border-green-600 transition-colors group"
              style={{
                left: `${safe.signature.x}%`,
                top: `${safe.signature.y}%`,
                width: `${safe.signature.width}%`,
                height: `${safe.signature.height}%`,
                zIndex: 2,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'signature')}
            >
              <img
                src={normalizeUrl(template.signature_url)}
                alt="Signature"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-2 py-1">
                हस्ताक्षर
              </div>
              
              {!template.signature_lock_position && (
                <>
                  <div
                    className="absolute top-0 left-0 w-3 h-3 bg-green-500 cursor-nw-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature', 'nw')}
                  />
                  <div
                    className="absolute top-0 right-0 w-3 h-3 bg-green-500 cursor-ne-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature', 'ne')}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-3 h-3 bg-green-500 cursor-sw-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature', 'sw')}
                  />
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 cursor-se-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature', 'se')}
                  />
                </>
              )}
            </div>
          )}

          {/* Signature 2 */}
          {template.signature2_url && template.signature2_url !== 'null' && template.signature2_url.trim().length > 0 && (
            <div
              className="absolute border-2 border-purple-500 cursor-move hover:border-purple-600 transition-colors group"
              style={{
                left: `${safe.signature2.x}%`,
                top: `${safe.signature2.y}%`,
                width: `${safe.signature2.width}%`,
                height: `${safe.signature2.height}%`,
                zIndex: 2,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'signature2')}
            >
              <img
                src={normalizeUrl(template.signature2_url)}
                alt="Signature 2"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              <div className="absolute top-0 left-0 bg-purple-500 text-white text-xs px-2 py-1">
                हस्ताक्षर 2
              </div>
              
              {!template.signature2_lock_position && (
                <>
                  <div
                    className="absolute top-0 left-0 w-3 h-3 bg-purple-500 cursor-nw-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature2', 'nw')}
                  />
                  <div
                    className="absolute top-0 right-0 w-3 h-3 bg-purple-500 cursor-ne-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature2', 'ne')}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-3 h-3 bg-purple-500 cursor-sw-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature2', 'sw')}
                  />
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-purple-500 cursor-se-resize opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleResizeStart(e, 'signature2', 'se')}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid md:grid-cols-2 gap-6">
          {template.letterhead_url && (
            <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50/30">
              <h4 className="font-semibold text-blue-900">लेटरहेड सेटिंग्स</h4>
              <div className="flex items-center gap-3">
                <img src={template.letterhead_url} alt="preview" className="h-10 w-auto object-contain bg-white border rounded" onError={(e)=>{e.currentTarget.alt='broken';}} />
                <code className="text-xs break-all text-blue-800">{template.letterhead_url}</code>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="letterhead-lock-aspect"
                    checked={template.letterhead_lock_aspect}
                    onCheckedChange={(checked) => onUpdate({ letterhead_lock_aspect: checked })}
                  />
                  <Label htmlFor="letterhead-lock-aspect" className="text-sm cursor-pointer">
                    आस्पेक्ट रेशियो लॉक करें
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="letterhead-lock-position"
                    checked={template.letterhead_lock_position}
                    onCheckedChange={(checked) => onUpdate({ letterhead_lock_position: checked })}
                  />
                  <Label htmlFor="letterhead-lock-position" className="text-sm cursor-pointer">
                    स्थिति लॉक करें
                  </Label>
                </div>
                
                {/* Position Controls */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <Label className="text-xs">X (बाएं से %)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.letterhead_x || 0)}
                      onChange={(e) => onUpdate({ letterhead_x: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y (ऊपर से %)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.letterhead_y || 0)}
                      onChange={(e) => onUpdate({ letterhead_y: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">चौड़ाई (%)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.letterhead_width || 0)}
                      onChange={(e) => onUpdate({ letterhead_width: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ऊंचाई (%)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.letterhead_height || 0)}
                      onChange={(e) => onUpdate({ letterhead_height: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
                
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleExpandWidth('letterhead')}
                  className="w-full gap-2"
                >
                  <Maximize2 className="w-4 h-4" />
                  {template.letterhead_expand_width ? 'सामान्य चौड़ाई' : 'पूरी चौड़ाई'}
                </Button>
              </div>
            </div>
          )}

          {template.signature_url && (
            <div className="space-y-3 p-4 border border-green-200 rounded-lg bg-green-50/30">
              <h4 className="font-semibold text-green-900">हस्ताक्षर सेटिंग्स</h4>
              <div className="flex items-center gap-3">
                <img src={template.signature_url} alt="preview" className="h-10 w-auto object-contain bg-white border rounded" onError={(e)=>{e.currentTarget.alt='broken';}} />
                <code className="text-xs break-all text-green-800">{template.signature_url}</code>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="signature-lock-aspect"
                    checked={template.signature_lock_aspect}
                    onCheckedChange={(checked) => onUpdate({ signature_lock_aspect: checked })}
                  />
                  <Label htmlFor="signature-lock-aspect" className="text-sm cursor-pointer">
                    आस्पेक्ट रेशियो लॉक करें
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="signature-lock-position"
                    checked={template.signature_lock_position}
                    onCheckedChange={(checked) => onUpdate({ signature_lock_position: checked })}
                  />
                  <Label htmlFor="signature-lock-position" className="text-sm cursor-pointer">
                    स्थिति लॉक करें
                  </Label>
                </div>
                
                {/* Position Controls */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <Label className="text-xs">X (बाएं से %)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature_x || 0)}
                      onChange={(e) => onUpdate({ signature_x: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y (ऊपर से %)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature_y || 0)}
                      onChange={(e) => onUpdate({ signature_y: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">चौड़ाई (%)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature_width || 0)}
                      onChange={(e) => onUpdate({ signature_width: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ऊंचाई (%)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature_height || 0)}
                      onChange={(e) => onUpdate({ signature_height: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdate({ signature_x: 70, signature_y: 75 })}
                  >
                    दायां-नीचे
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdate({ signature_x: 37.5, signature_y: 75 })}
                  >
                    बीच-नीचे
                  </Button>
                </div>
              </div>
            </div>
          )}

          {template.signature2_url && (
            <div className="space-y-3 p-4 border border-purple-200 rounded-lg bg-purple-50/30">
              <h4 className="font-semibold text-purple-900">दूसरा हस्ताक्षर सेटिंग्स</h4>
              <div className="flex items-center gap-3">
                <img src={template.signature2_url} alt="preview" className="h-10 w-auto object-contain bg-white border rounded" onError={(e)=>{e.currentTarget.alt='broken';}} />
                <code className="text-xs break-all text-purple-800">{template.signature2_url}</code>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="signature2-lock-aspect"
                    checked={template.signature2_lock_aspect}
                    onCheckedChange={(checked) => onUpdate({ signature2_lock_aspect: checked })}
                  />
                  <Label htmlFor="signature2-lock-aspect" className="text-sm cursor-pointer">
                    आस्पेक्ट रेशियो लॉक करें
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="signature2-lock-position"
                    checked={template.signature2_lock_position}
                    onCheckedChange={(checked) => onUpdate({ signature2_lock_position: checked })}
                  />
                  <Label htmlFor="signature2-lock-position" className="text-sm cursor-pointer">
                    स्थिति लॉक करें
                  </Label>
                </div>
                
                {/* Position Controls */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <Label className="text-xs">X (बाएं से %)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature2_x || 0)}
                      onChange={(e) => onUpdate({ signature2_x: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y (ऊपर से %)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature2_y || 0)}
                      onChange={(e) => onUpdate({ signature2_y: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">चौड़ाई (%)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature2_width || 0)}
                      onChange={(e) => onUpdate({ signature2_width: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ऊंचाई (%)</Label>
                    <Input
                      type="number"
                      value={Math.round(template.signature2_height || 0)}
                      onChange={(e) => onUpdate({ signature2_height: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdate({ signature2_x: 30, signature2_y: 75 })}
                  >
                    बायां-नीचे
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdate({ signature2_x: 37.5, signature2_y: 75 })}
                  >
                    बीच-नीचे
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <strong>नोट:</strong> छवियों को अपलोड करने के बाद, "सहेजें" बटन दबाना न भूलें।
        </div>
      </CardContent>
    </Card>
  );
}