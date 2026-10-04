import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import restClient from "@/api/restClient";
import VisualTemplateDesigner from "./VisualTemplateDesigner";

const PLACEHOLDERS = [
  { key: "{SenderName}", description: "प्रेषक का नाम" },
  { key: "{Street}", description: "मोहल्ला/गली" },
  { key: "{Village}", description: "गाँव/शहर" },
  { key: "{District}", description: "जिला" },
  { key: "{Mob}", description: "मोबाइल नंबर" },
  { key: "{programtyp}", description: "कार्यक्रम प्रकार" },
  { key: "{place_time}", description: "स्थान और समय" },
  { key: "{LocalProgram}", description: "स्थानीय कार्यक्रम" },
  { key: "{ProgramFor}", description: "कार्यक्रम किसके लिए" },
  { key: "{Relation_to_sender}", description: "प्रेषक से संबंध" },
  { key: "{detail}", description: "अतिरिक्त विवरण" },
  { key: "{Date}", description: "कार्यक्रम तारीख" },
  { key: "{Sn}", description: "निमंत्रण संख्या" },
];

export default function TemplateEditor({ template, onSave, onCancel, isLoading, programTypeMode = "all", templateTypeMode = "all" }) {
  const initialState = useMemo(() => ({
    name: "",
    template_type: "utility",
    program_type: "default",
    greeting: "",
    body: "",
    closing: "शुभकामनाओं सहित।",
    sender_name: "",
    sender_title: "",
    sender_subtitle: "",
    sender_location: "",
    sender_address1: "",
    sender_address2: "",
    is_default: false,
    letterhead_x: 0,
    letterhead_y: 0,
    letterhead_width: 100,
    letterhead_height: 15,
    letterhead_lock_aspect: true,
    letterhead_lock_position: false,
    letterhead_expand_width: false,
    signature_x: 70,
    signature_y: 75,
    signature_width: 25,
    signature_height: 10,
    signature_lock_aspect: true,
    signature_lock_position: false,
    signature_label: "",
    signature2_x: 30,
    signature2_y: 75,
    signature2_width: 25,
    signature2_height: 10,
    signature2_lock_aspect: true,
    signature2_lock_position: false,
    signature2_label: "",
    body_content_top_offset_mm: 40,
    signature_bottom_offset_mm: 60,
    font_family: "",
    font_size: 16,
    line_height: 1.9,
    paragraph_left_mm: 5,
    paragraph_right_mm: 5,
    first_line_indent_mm: 15,
  }), []);
  // Fetch program types for dropdown
  const { data: programTypes } = useQuery({
    queryKey: ['program-types'],
    queryFn: () => restClient.listEntities('ProgramType'),
    initialData: [],
  });

  const [formData, setFormData] = useState(template || initialState);
  const [submitError, setSubmitError] = useState(null);

  // For wishes/text templates, define the standard birthday/anniversary/simple_text options
  // These should match the wishesOnlyProgramTypes exactly
  const wishesOnlyProgramTypes = useMemo(
    () => [
      { value: "जन्मदिन", label: "जन्मदिन" },
      { value: "वर्षगांठ", label: "वर्षगांठ" },
      { value: "simple_text", label: "Simple Text" },
    ],
    []
  );

  const programTypeOptions = useMemo(() => {
    if (programTypeMode === "wishes-only") {
      return wishesOnlyProgramTypes;
    }

    const mappedProgramTypes = (programTypes || [])
      .map((type) => type.programtyp || type.Programtyp || type.data?.programtyp || type.data?.Programtyp)
      .filter(Boolean)
      .map((value) => ({ value, label: value }));

    return [
      { value: "default", label: "सभी (डिफ़ॉल्ट)" },
      { value: "birthday", label: "जन्मदिन" },
      { value: "anniversary", label: "वर्षगांठ" },
      ...mappedProgramTypes,
    ];
  }, [programTypeMode, programTypes, wishesOnlyProgramTypes]);

  useEffect(() => {
    if (template) {
      // For text templates, only include essential fields
      const templateType = template.template_type || 'utility';
      if (templateType.toLowerCase() === 'text') {
        // Text templates: only essential fields, exclude utility-specific fields
        setFormData({
          name: template.name || "",
          template_type: 'text',
          program_type: template.program_type || "default",
          greeting: template.greeting || "",
          body: template.body || "",
          closing: template.closing || "शुभकामनाओं सहित।",
          is_default: template.is_default || false,
        });
      } else {
        // Utility templates: include all fields
        setFormData({ ...initialState, ...template });
      }
    } else {
      setFormData({ ...initialState });
    }
  }, [template, initialState]);


  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDesignerUpdate = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const insertPlaceholder = (placeholder, field) => {
    const textarea = document.getElementById(field);
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData[field];
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + placeholder + after;
      handleChange(field, newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    setSubmitError(null);
    console.log('[TemplateEditor] handleSubmit called, formData:', formData);
    
    // Validate required fields
    if (!formData.name || !formData.name.trim()) {
      const msg = "टेम्पलेट का नाम आवश्यक है";
      console.error('[TemplateEditor] Validation failed: name is empty');
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    
    if (!formData.body || !formData.body.trim()) {
      const msg = "पत्र की सामग्री आवश्यक है";
      console.error('[TemplateEditor] Validation failed: body is empty');
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    
    if (!formData.program_type) {
      const msg = "कार्यक्रम प्रकार चुनें";
      console.error('[TemplateEditor] Validation failed: program_type is empty');
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    
    // Clean up data before saving
    const cleanData = {
      name: formData.name.trim(),
      template_type: (formData.template_type || 'utility').trim(),
      program_type: formData.program_type || "default",
      body: formData.body.trim(),
      greeting: formData.greeting?.trim() || "",
      closing: formData.closing?.trim() || "",
      is_default: formData.is_default || false,
    };

    // For utility templates, include image and layout settings
    // For text templates, exclude these utility-specific fields
    const isUtilityTemplate = (formData.template_type || 'utility').toLowerCase() === 'utility';
    console.log('[TemplateEditor] template_type:', formData.template_type, 'isUtilityTemplate:', isUtilityTemplate);
    console.log('[TemplateEditor] cleanData before conditional:', JSON.stringify(cleanData, null, 2));
    
    if (isUtilityTemplate) {
      cleanData.sender_name = formData.sender_name?.trim() || "";
      cleanData.sender_title = formData.sender_title?.trim() || "";
      cleanData.sender_subtitle = formData.sender_subtitle?.trim() || "";
      cleanData.sender_location = formData.sender_location?.trim() || "";
      cleanData.sender_address1 = formData.sender_address1?.trim() || "";
      cleanData.sender_address2 = formData.sender_address2?.trim() || "";
      
      // Preserve image URLs - CRITICAL to prevent corruption
      cleanData.letterhead_url = formData.letterhead_url || null;
      cleanData.signature_url = formData.signature_url || null;
      cleanData.signature_label = formData.signature_label?.trim() || null;
      cleanData.signature2_url = formData.signature2_url || null;
      cleanData.signature2_label = formData.signature2_label?.trim() || null;
      
      cleanData.letterhead_x = formData.letterhead_x;
      cleanData.letterhead_y = formData.letterhead_y;
      cleanData.letterhead_width = formData.letterhead_width;
      cleanData.letterhead_height = formData.letterhead_height;
      cleanData.letterhead_lock_aspect = formData.letterhead_lock_aspect;
      cleanData.letterhead_lock_position = formData.letterhead_lock_position;
      cleanData.letterhead_expand_width = formData.letterhead_expand_width;

      cleanData.signature_x = formData.signature_x;
      cleanData.signature_y = formData.signature_y;
      cleanData.signature_width = formData.signature_width;
      cleanData.signature_height = formData.signature_height;
      cleanData.signature_lock_aspect = formData.signature_lock_aspect;
      cleanData.signature_lock_position = formData.signature_lock_position;

      cleanData.signature2_x = formData.signature2_x;
      cleanData.signature2_y = formData.signature2_y;
      cleanData.signature2_width = formData.signature2_width;
      cleanData.signature2_height = formData.signature2_height;
      cleanData.signature2_lock_aspect = formData.signature2_lock_aspect;
      cleanData.signature2_lock_position = formData.signature2_lock_position;
      
      cleanData.body_content_top_offset_mm = formData.body_content_top_offset_mm || 40;
      cleanData.signature_bottom_offset_mm = formData.signature_bottom_offset_mm || 60;
      cleanData.font_family = formData.font_family?.trim() || "";
      cleanData.font_size = Number(formData.font_size) || 16;
      cleanData.line_height = Number(formData.line_height) || 1.9;
      cleanData.paragraph_left_mm = Number(formData.paragraph_left_mm) || 5;
      cleanData.paragraph_right_mm = Number(formData.paragraph_right_mm) || 5;
      cleanData.first_line_indent_mm = Number(formData.first_line_indent_mm) || 15;
    }
    
    // CRITICAL: Set id field based on template type and program_type
    // Database schema uses program_type value as the id for text templates
    if (!isUtilityTemplate) {
      // Text templates: id = program_type (e.g., "जन्मदिन", "वर्षगांठ")
      cleanData.id = formData.program_type || "default";
      console.log('[TemplateEditor] Text template - setting id to program_type:', cleanData.id);
    } else if (formData.id && formData.id !== '') {
      // Utility templates: preserve existing id if updating (and it's not empty)
      cleanData.id = formData.id;
    } else {
      // New utility template: generate a numeric ID based on timestamp
      // This ensures uniqueness since lettertemplate.id is TEXT but needs to be numeric for utility templates
      cleanData.id = Date.now().toString();
    }
    
    console.log('[TemplateEditor] Final cleanData to be sent:', JSON.stringify(cleanData, null, 2));
    console.log('[TemplateEditor] Keys in cleanData:', Object.keys(cleanData));
    onSave(cleanData);
  };

  // Show image/page settings if template_type is 'utility' OR if page is LetterTemplates (not restricted to text-only)
  const showUtilityDesigner = (formData.template_type === 'utility') || (templateTypeMode !== "text-only");

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-orange-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <CardTitle className="text-xl font-bold text-gray-900">
                {template?.id ? "टेम्पलेट संपादित करें" : "नया टेम्पलेट बनाएं"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Error Alert */}
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <p className="font-semibold">❌ त्रुटि:</p>
                  <p className="text-sm mt-1">{submitError}</p>
                </div>
              )}
              
              {/* Basic Info */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">टेम्पलेट का नाम <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="जैसे: विवाह शुभकामना पत्र"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_type">टेम्पलेट प्रकार</Label>
                  <Select value={formData.template_type || 'utility'} onValueChange={(value) => handleChange('template_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="टेम्पलेट प्रकार चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utility">Utility (पत्र टेम्पलेट)</SelectItem>
                      <SelectItem value="text">Text (संदेश टेम्पलेट)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="program_type">कार्यक्रम प्रकार</Label>
                  <Select value={formData.program_type} onValueChange={(value) => handleChange('program_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="कार्यक्रम प्रकार चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      {programTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => handleChange('is_default', checked)}
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                  इस कार्यक्रम प्रकार के लिए डिफ़ॉल्ट टेम्पलेट बनाएं
                </Label>
              </div>



              {/* Letter Content */}
              <div className="pt-4 border-t border-orange-100 space-y-4">
                <h3 className="font-semibold text-gray-900">पत्र सामग्री</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="greeting">अभिवादन</Label>
                  <Input
                    id="greeting"
                    value={formData.greeting}
                    onChange={(e) => handleChange('greeting', e.target.value)}
                    placeholder="जैसे: प्रति, श्रीमान {SenderName}"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">मुख्य सामग्री <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) => handleChange('body', e.target.value)}
                    placeholder="पत्र की सामग्री लिखें... प्लेसहोल्डर्स का उपयोग करें जैसे {ProgramFor}, {programtyp}"
                    rows={12}
                    className="font-hindi"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closing">समापन</Label>
                  <Input
                    id="closing"
                    value={formData.closing}
                    onChange={(e) => handleChange('closing', e.target.value)}
                    placeholder="जैसे: शुभकामनाओं सहित।"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-orange-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  रद्द करें
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? "सहेजा जा रहा है..." : "सहेजें"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {showUtilityDesigner && (
            <Card className="border-orange-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                <CardTitle className="text-lg font-bold text-gray-900">
                  इमेज और पेज सेटिंग्स
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <VisualTemplateDesigner
                  template={formData}
                  onUpdate={handleDesignerUpdate}
                />

                <div className="pt-4 border-t border-orange-100">
                  <h3 className="font-semibold text-gray-900 mb-4">टेक्स्ट स्टाइल सेटिंग्स</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="font_family">फ़ॉन्ट फैमिली</Label>
                      <Input
                        id="font_family"
                        placeholder="उदा: Noto Sans Devanagari"
                        value={formData.font_family}
                        onChange={(e) => handleChange('font_family', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="font_size">फ़ॉन्ट साइज (px)</Label>
                      <Input
                        id="font_size"
                        type="number"
                        value={formData.font_size}
                        onChange={(e) => handleChange('font_size', parseFloat(e.target.value) || 16)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="line_height">लाइन हाइट</Label>
                      <Input
                        id="line_height"
                        type="number"
                        step="0.1"
                        value={formData.line_height}
                        onChange={(e) => handleChange('line_height', parseFloat(e.target.value) || 1.9)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_line_indent_mm">पहली लाइन इंडेंट (mm)</Label>
                      <Input
                        id="first_line_indent_mm"
                        type="number"
                        value={formData.first_line_indent_mm}
                        onChange={(e) => handleChange('first_line_indent_mm', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paragraph_left_mm">पैराग्राफ लेफ्ट मार्जिन (mm)</Label>
                      <Input
                        id="paragraph_left_mm"
                        type="number"
                        value={formData.paragraph_left_mm}
                        onChange={(e) => handleChange('paragraph_left_mm', parseFloat(e.target.value) || 5)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paragraph_right_mm">पैराग्राफ राइट मार्जिन (mm)</Label>
                      <Input
                        id="paragraph_right_mm"
                        type="number"
                        value={formData.paragraph_right_mm}
                        onChange={(e) => handleChange('paragraph_right_mm', parseFloat(e.target.value) || 5)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-orange-100">
                  <h3 className="font-semibold text-gray-900 mb-4">पेज गैप सेटिंग्स (mm)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="body_offset">बॉडी कंटेंट टॉप ऑफसेट</Label>
                      <Input
                        id="body_offset"
                        type="number"
                        value={formData.body_content_top_offset_mm || 40}
                        onChange={(e) => handleChange('body_content_top_offset_mm', parseFloat(e.target.value) || 40)}
                        placeholder="40"
                      />
                      <p className="text-xs text-gray-500">लेटरहेड के बाद टेक्स्ट जहां से शुरू होगा</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signature_offset">सिग्नेचर सेक्शन ऑफसेट</Label>
                      <Input
                        id="signature_offset"
                        type="number"
                        value={formData.signature_bottom_offset_mm || 60}
                        onChange={(e) => handleChange('signature_bottom_offset_mm', parseFloat(e.target.value) || 60)}
                        placeholder="60"
                      />
                      <p className="text-xs text-gray-500">कंटेंट के बाद सिग्नेचर की दूरी</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Placeholders Sidebar */}
        <div className="space-y-6">
          <Card className="border-orange-100 shadow-lg sticky top-4">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <CardTitle className="text-lg font-bold text-gray-900">
                उपलब्ध प्लेसहोल्डर्स
              </CardTitle>
              <p className="text-xs text-gray-600 mt-1">
                क्लिक करके सामग्री में जोड़ें
              </p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
                {PLACEHOLDERS.map((placeholder) => (
                  <div
                    key={placeholder.key}
                    className="flex items-center justify-between p-3 rounded-lg border border-orange-100 hover:bg-orange-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-orange-600 font-semibold">
                        {placeholder.key}
                      </code>
                      <p className="text-xs text-gray-600 mt-1">
                        {placeholder.description}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => insertPlaceholder(placeholder.key, 'body')}
                        title="सामग्री में जोड़ें"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>नोट:</strong> प्लेसहोल्डर्स को सामग्री में कहीं भी लिखें। 
                  पत्र बनाते समय ये असली जानकारी से बदल जाएंगे।
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}