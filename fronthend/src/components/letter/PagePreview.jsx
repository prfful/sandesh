import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function PagePreview({ settings }) {
  const pageSize = settings?.page_size || "A4";
  const width = settings?.page_width || 210;
  const height = settings?.page_height || 297;
  const unit = settings?.margin_unit || "mm";
  const marginTop = settings?.margin_top || 20;
  const marginBottom = settings?.margin_bottom || 20;
  const marginLeft = settings?.margin_left || 20;
  const marginRight = settings?.margin_right || 20;

  // Scale factor for display (mm to pixels)
  const scale = 1.5;
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  return (
    <Card className="border-blue-100 shadow-lg">
      <CardContent className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">पूर्वावलोकन</h3>
        <div className="flex justify-center">
          <div 
            className="relative bg-white border-2 border-gray-400 shadow-xl"
            style={{ 
              width: `${displayWidth}px`, 
              height: `${displayHeight}px`,
              maxHeight: '500px'
            }}
          >
            {/* Margins overlay */}
            <div 
              className="absolute border-2 border-dashed border-blue-400 bg-blue-50/20"
              style={{
                top: `${(marginTop / height) * 100}%`,
                bottom: `${(marginBottom / height) * 100}%`,
                left: `${(marginLeft / width) * 100}%`,
                right: `${(marginRight / width) * 100}%`
              }}
            >
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-gray-500 italic">सामग्री क्षेत्र</p>
              </div>
            </div>

            {/* Margin labels */}
            <div 
              className="absolute top-0 left-0 right-0 bg-red-100 text-center text-xs font-semibold text-red-700"
              style={{ height: `${(marginTop / height) * 100}%` }}
            >
              <span className="block mt-1">शीर्ष: {marginTop}{unit}</span>
            </div>
            
            <div 
              className="absolute bottom-0 left-0 right-0 bg-red-100 text-center text-xs font-semibold text-red-700"
              style={{ height: `${(marginBottom / height) * 100}%` }}
            >
              <span className="block mt-1">तल: {marginBottom}{unit}</span>
            </div>
            
            <div 
              className="absolute top-0 bottom-0 left-0 bg-red-100 flex items-center justify-center text-xs font-semibold text-red-700"
              style={{ width: `${(marginLeft / width) * 100}%` }}
            >
              <span className="transform -rotate-90 whitespace-nowrap">बायां: {marginLeft}{unit}</span>
            </div>
            
            <div 
              className="absolute top-0 bottom-0 right-0 bg-red-100 flex items-center justify-center text-xs font-semibold text-red-700"
              style={{ width: `${(marginRight / width) * 100}%` }}
            >
              <span className="transform -rotate-90 whitespace-nowrap">दायां: {marginRight}{unit}</span>
            </div>

            {/* Letterhead indicator */}
            {settings?.letterhead_url && (
              <div 
                className="absolute left-0 right-0 bg-green-100 border border-green-300 flex items-center justify-center text-xs text-green-700"
                style={{
                  top: `${(marginTop / height) * 100}%`,
                  height: '8%'
                }}
              >
                लेटरहेड
              </div>
            )}

            {/* Signature indicator */}
            {settings?.signature_url && (
              <div 
                className="absolute left-0 right-0 bg-purple-100 border border-purple-300 flex items-center justify-center text-xs text-purple-700"
                style={{
                  bottom: `${(marginBottom / height) * 100}%`,
                  height: '6%'
                }}
              >
                हस्ताक्षर
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            पेज: <strong>{pageSize}</strong> ({width}mm × {height}mm)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}