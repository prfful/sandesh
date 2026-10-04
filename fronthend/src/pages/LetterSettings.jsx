import React, { useState, useEffect } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import PagePreview from "../components/letter/PagePreview";

const PAGE_PRESETS = {
  A4: { width: 210, height: 297, marginMm: 20, marginInch: 0.79 },
  Letter: { width: 215.9, height: 279.4, marginMm: 19.05, marginInch: 0.75 },
  Legal: { width: 215.9, height: 355.6, marginMm: 19.05, marginInch: 0.75 },
};

export default function LetterSettings() {
  const queryClient = useQueryClient();
  const pickBestSettingsRecord = (rows) => {
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) return null;

    const score = (row) => {
      let value = 0;
      if (row.letterhead_url) value += 4;
      if (row.signature_url) value += 4;
      if (row.design_template) value += 2;
      if (row.page_size || row.margin_top || row.margin_left || row.margin_right) value += 1;
      return value;
    };

    const sorted = [...list].sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;

      const bTs = Date.parse(b.updated_date || b.created_date || '') || 0;
      const aTs = Date.parse(a.updated_date || a.created_date || '') || 0;
      if (bTs !== aTs) return bTs - aTs;

      const bId = Number(b.id) || 0;
      const aId = Number(a.id) || 0;
      return bId - aId;
    });

    return sorted[0];
  };

  const [formData, setFormData] = useState({
    page_size: "A4",
    page_width: 210,
    page_height: 297,
    margin_unit: "mm",
    margin_top: 5,
    margin_bottom: 20,
    margin_left: 20,
    margin_right: 5,
    letterhead_top_margin: 0,
    letterhead_height: 80,
    letterhead_width: 100,
    content_start_margin: 90,
    signature_right_margin: 20,
    signature_bottom_margin: 80,
    signature_height: 60,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['letter-settings'],
    queryFn: async () => {
      const res = await restClient.listEntities('LetterSettings');
      const record = pickBestSettingsRecord(res);
      console.log('Letter Settings loaded:', record);
      return record;
    },
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        page_size: settings.page_size || "A4",
        page_width: settings.page_width || 210,
        page_height: settings.page_height || 297,
        margin_unit: settings.margin_unit || "mm",
        margin_top: settings.margin_top ?? (settings.margin_unit === "inch" ? 0.2 : 5),
        margin_bottom: settings.margin_bottom || 20,
        margin_left: settings.margin_left || 20,
        margin_right: settings.margin_right || 5,
        letterhead_top_margin: settings.letterhead_top_margin || 0,
        letterhead_height: settings.letterhead_height || 80,
        letterhead_width: settings.letterhead_width || 100,
        content_start_margin: settings.content_start_margin || 90,
        signature_right_margin: settings.signature_right_margin || 20,
        signature_bottom_margin: settings.signature_bottom_margin || 80,
        signature_height: settings.signature_height || 60,
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Updating settings with:', data);
      console.log('Content Start Margin value being saved:', data.content_start_margin);
      const payload = {
        page_size: data.page_size || 'A4',
        page_width: data.page_width || 210,
        page_height: data.page_height || 297,
        margin_unit: data.margin_unit || 'mm',
        margin_top: data.margin_top ?? (data.margin_unit === "inch" ? 0.2 : 5),
        margin_bottom: data.margin_bottom || 20,
        margin_left: data.margin_left || 20,
        margin_right: data.margin_right || 5,
        letterhead_top_margin: data.letterhead_top_margin || 0,
        letterhead_height: data.letterhead_height || 80,
        letterhead_width: data.letterhead_width || 100,
        content_start_margin: data.content_start_margin !== undefined ? data.content_start_margin : 90,
        signature_right_margin: data.signature_right_margin || 20,
        signature_bottom_margin: data.signature_bottom_margin || 80,
        signature_height: data.signature_height || 60,
        design_template: data.design_template || null,
      };
      
      console.log('Payload being sent:', payload);
      
      if (settings?.id) {
        return await restClient.updateEntity('LetterSettings', settings.id, payload);
      } else {
        // Let database auto-increment ID to avoid mixed/invalid ID types.
        return await restClient.createEntity('LetterSettings', payload);
      }
    },
    onSuccess: (data) => {
      console.log('Settings update success:', data);
      const settingsData = Array.isArray(data) ? data[0] : data;
      queryClient.setQueryData(['letter-settings'], settingsData);
      toast.success("सेटिंग्स सफलतापूर्वक सहेजी गई!");
    },
    onError: (error) => {
      console.error('Settings update error:', error);
      toast.error("सेटिंग्स अपडेट विफल: " + (error.message || 'Unknown error'));
    }
  });

  const handleSave = () => {
    console.log('=== SAVE CLICKED ===');
    console.log('Form Data:', formData);
    console.log('Content Start Margin:', formData.content_start_margin);
    updateSettingsMutation.mutate(formData);
  };



  const handlePageSizeChange = (size) => {
    const preset = PAGE_PRESETS[size];
    if (preset) {
      const unit = formData.margin_unit;
      setFormData(prev => ({
        ...prev,
        page_size: size,
        page_width: preset.width,
        page_height: preset.height,
        margin_top: unit === "mm" ? 5 : 0.2,
        margin_bottom: unit === "mm" ? preset.marginMm : preset.marginInch,
        margin_left: unit === "mm" ? preset.marginMm : preset.marginInch,
        margin_right: unit === "mm" ? preset.marginMm : preset.marginInch,
      }));
    } else {
      setFormData(prev => ({ ...prev, page_size: size }));
    }
  };

  const handleMarginChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleResetToDefault = () => {
    const preset = PAGE_PRESETS.A4;
    setFormData({
      page_size: "A4",
      page_width: preset.width,
      page_height: preset.height,
      margin_unit: "mm",
      margin_top: formData.margin_unit === "mm" ? 5 : 0.2,
      margin_bottom: preset.marginMm,
      margin_left: preset.marginMm,
      margin_right: 5,
      letterhead_top_margin: 0,
      letterhead_height: 80,
      letterhead_width: 100,
      content_start_margin: 90,
      signature_right_margin: 20,
      signature_bottom_margin: 80,
      signature_height: 60,
    });
    toast.success("सभी सेटिंग्स डिफ़ॉल्ट में रीसेट की गईं - सहेजने के लिए 'Save' बटन दबाएं");
  };



  const handleDesignSave = async (designData) => {
    // Save design data to settings
    const updatedSettings = {
      ...formData,
      design_template: JSON.stringify(designData)
    };
    setFormData(updatedSettings);
    
    // Trigger the actual database save
    try {
      await updateSettingsMutation.mutateAsync(updatedSettings);
      toast.success('Design saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save design');
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              पत्र सेटिंग्स
            </h1>
            <p className="text-gray-600 mt-1">लेटरहेड, हस्ताक्षर और पेज लेआउट प्रबंधित करें</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              className="gap-2 text-red-600 hover:text-red-700 border-red-300"
            >
              <RotateCcw className="w-5 h-5" />
              सभी रीसेट करें
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 gap-2"
            >
              <Save className="w-5 h-5" />
              {updateSettingsMutation.isPending ? 'सहेज रहा है...' : 'सेटिंग्स सहेजें'}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Page Settings */}
            <Card className="border-blue-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">
                      लेटर पेज सेटिंग
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      पेज का आकार और मार्जिन सेट करें
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Page Size */}
                <div className="space-y-2">
                  <Label>पेज का आकार</Label>
                  <Select 
                    value={formData.page_size} 
                    onValueChange={handlePageSizeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="पेज साइज़ चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210mm × 297mm)</SelectItem>
                      <SelectItem value="Letter">Letter (8.5" × 11")</SelectItem>
                      <SelectItem value="Legal">Legal (8.5" × 14")</SelectItem>
                      <SelectItem value="Custom">Custom (कस्टम साइज़)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Size */}
                {formData.page_size === "Custom" && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>चौड़ाई (mm)</Label>
                      <Input
                        type="number"
                        value={formData.page_width}
                        onChange={(e) => setFormData(prev => ({ ...prev, page_width: parseFloat(e.target.value) || 210 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ऊंचाई (mm)</Label>
                      <Input
                        type="number"
                        value={formData.page_height}
                        onChange={(e) => setFormData(prev => ({ ...prev, page_height: parseFloat(e.target.value) || 297 }))}
                      />
                    </div>
                  </div>
                )}

                {/* Margin Unit */}
                <div className="space-y-2">
                  <Label>मार्जिन यूनिट</Label>
                  <Select 
                    value={formData.margin_unit} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, margin_unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="यूनिट चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">मिलीमीटर (mm)</SelectItem>
                      <SelectItem value="inch">इंच (inch)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Margins Grid */}
                <div>
                  <Label className="mb-3 block">मार्जिन ({formData.margin_unit})</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">शीर्ष (Top)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.margin_top}
                        onChange={(e) => setFormData(prev => ({ ...prev, margin_top: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">तल (Bottom)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.margin_bottom}
                        onChange={(e) => setFormData(prev => ({ ...prev, margin_bottom: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">बायां (Left)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.margin_left}
                        onChange={(e) => setFormData(prev => ({ ...prev, margin_left: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">दायां (Right)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.margin_right}
                        onChange={(e) => setFormData(prev => ({ ...prev, margin_right: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>नोट:</strong> ये सेटिंग्स सभी जनरेट किए गए पत्रों पर लागू होंगी।
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <PagePreview settings={formData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}