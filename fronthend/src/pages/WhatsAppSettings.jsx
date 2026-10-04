import React, { useState } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Send, Save, AlertCircle, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useProgramTypesMap } from "@/components/ProgramDisplay";

const PLACEHOLDERS = [
  { key: "{{Mob}}", desc: "मोबाइल नंबर" },
  { key: "{{Message}}", desc: "पत्र का संदेश" },
  { key: "{{SenderName}}", desc: "प्रेषक का नाम" },
  { key: "{{ProgramType}}", desc: "कार्यक्रम प्रकार" },
  { key: "{{ProgramDate}}", desc: "कार्यक्रम तारीख" },
  { key: "{{Village}}", desc: "गाँव" },
  { key: "{{District}}", desc: "जिला" },
  { key: "{{Sn}}", desc: "निमंत्रण संख्या" },
];

export default function WhatsAppSettings() {
  const queryClient = useQueryClient();
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("यह एक टेस्ट संदेश है");
  const programTypesMap = useProgramTypesMap();

  const { data: settings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const res = await restClient.listEntities('AppSettings');
      return res && res.length ? res[0] : undefined;
    },
  });

  const [formData, setFormData] = useState({
    // PDF API (UTILITY Template) - for Letter Generator
    whatsapp_pdf_api_url: '',
    whatsapp_pdf_api_enabled: false,
    whatsapp_debug_prompt: false,
    
    // TEXT API (TEXT Template) - for Birthday/Anniversary bulk messages
    whatsapp_text_api_url: '',
    whatsapp_text_template_name: '',
    whatsapp_text_api_enabled: false,
    whatsapp_text_debug_prompt: false,
    
    // Common settings
    whatsapp_mode: 'direct',
    whatsapp_direct_message: 'नमस्कार,\nकृपया संलग्न पत्र देखें:',
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        // PDF API - try new column names first, fallback to old names for backward compatibility
        whatsapp_pdf_api_url: settings.whatsapp_pdf_api_url || settings.whatsapp_api_url || '',
        whatsapp_pdf_api_enabled: settings.whatsapp_pdf_api_enabled ?? settings.whatsapp_api_enabled ?? false,
        whatsapp_debug_prompt: settings.whatsapp_debug_prompt || false,
        
        // TEXT API - new columns
        whatsapp_text_api_url: settings.whatsapp_text_api_url || '',
        whatsapp_text_template_name: settings.whatsapp_text_template_name || '',
        whatsapp_text_api_enabled: settings.whatsapp_text_api_enabled || false,
        whatsapp_text_debug_prompt: settings.whatsapp_text_debug_prompt || false,
        
        // Common
        whatsapp_mode: settings.whatsapp_mode || 'direct',
        whatsapp_direct_message: settings.whatsapp_direct_message || 'नमस्कार,\nकृपया संलग्न पत्र देखें:',
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings?.id) {
        return await restClient.updateEntity('AppSettings', settings.id, data);
      } else {
        return await restClient.createEntity('AppSettings', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success("सेटिंग्स सहेजी गईं");
    },
  });

  const handleSave = () => {
    // Validate PDF API if enabled
    if (formData.whatsapp_mode === 'api' && formData.whatsapp_pdf_api_enabled && !formData.whatsapp_pdf_api_url) {
      toast.error("कृपया PDF API URL दर्ज करें");
      return;
    }
    
    // Validate TEXT API if enabled
    if (formData.whatsapp_text_api_enabled && !formData.whatsapp_text_api_url) {
      toast.error("कृपया TEXT API URL दर्ज करें");
      return;
    }
    
    updateSettingsMutation.mutate(formData);
  };

  const handleTestPDF = () => {
    if (!testPhone || testPhone.length !== 10) {
      toast.error("कृपया 10 अंकों का मोबाइल नंबर दर्ज करें");
      return;
    }

    if (!formData.whatsapp_pdf_api_url) {
      toast.error("कृपया पहले PDF API URL सेटअप करें");
      return;
    }

    // Get the first available program type name from the map, or use a default
    const programTypeName = Object.values(programTypesMap)[0] || "विवाह";

    let url = formData.whatsapp_pdf_api_url;
    
    // Replace placeholders
    url = url.replace(/\{\{Mob\}\}/g, testPhone);
    url = url.replace(/\{\{Message\}\}/g, encodeURIComponent(testMessage));
    url = url.replace(/\{\{SenderName\}\}/g, encodeURIComponent("टेस्ट प्रेषक"));
    url = url.replace(/\{\{ProgramType\}\}/g, encodeURIComponent(programTypeName));
    url = url.replace(/\{\{ProgramDate\}\}/g, "01-01-2025");
    url = url.replace(/\{\{Village\}\}/g, encodeURIComponent("टेस्ट गाँव"));
    url = url.replace(/\{\{District\}\}/g, encodeURIComponent("धार"));
    url = url.replace(/\{\{Sn\}\}/g, "6001");
    url = url.replace(/\{\{PdfUrl\}\}/g, encodeURIComponent("https://example.com/test.pdf"));

    // If URL has phone= parameter, replace it
    if (!url.includes('{{Mob}}') && /phone=\d{10,}/i.test(url)) {
      url = url.replace(/phone=\d{10,}/gi, `phone=${testPhone}`);
    }

    window.open(url, '_blank');
    toast.success("टेस्ट PDF API URL खुल गया - ब्राउज़र टैब चेक करें");
  };
  
  const handleTestText = () => {
    if (!testPhone || testPhone.length !== 10) {
      toast.error("कृपया 10 अंकों का मोबाइल नंबर दर्ज करें");
      return;
    }

    if (!formData.whatsapp_text_api_url) {
      toast.error("कृपया पहले TEXT API URL सेटअप करें");
      return;
    }

    let url = formData.whatsapp_text_api_url;
    const testMsg = "यह एक टेस्ट बल्क मैसेज है। जन्मदिन/वर्षगांठ बधाई के लिए।";
    
    // Replace placeholders
    url = url.replace(/\{\{Mob\}\}/g, testPhone);
    url = url.replace(/\{\{Message\}\}/g, encodeURIComponent(testMsg));
    url = url.replace(/\{\{SenderName\}\}/g, encodeURIComponent("टेस्ट नाम"));
    url = url.replace(/\{\{Name\}\}/g, encodeURIComponent("टेस्ट नाम"));
    url = url.replace(/\{\{Village\}\}/g, encodeURIComponent("टेस्ट गाँव"));

    // If URL has phone= parameter, replace it
    if (!url.includes('{{Mob}}') && /phone=\d{10,}/i.test(url)) {
      url = url.replace(/phone=\d{10,}/gi, `phone=${testPhone}`);
    }

    window.open(url, '_blank');
    toast.success("टेस्ट TEXT API URL खुल गया - ब्राउज़र टैब चेक करें");
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            WhatsApp सेटिंग्स
          </h1>
          <p className="text-gray-600 mt-1">WhatsApp भेजने का तरीका चुनें और कॉन्फ़िगर करें</p>
        </div>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              WhatsApp मोड सेटिंग्स
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">WhatsApp भेजने का तरीका चुनें</Label>
              <div className="flex flex-col gap-4">
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
                     onClick={() => setFormData({ ...formData, whatsapp_mode: 'direct' })}>
                  <input
                    type="radio"
                    name="whatsapp_mode"
                    value="direct"
                    checked={formData.whatsapp_mode === 'direct'}
                    onChange={(e) => setFormData({ ...formData, whatsapp_mode: e.target.value })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label className="font-semibold text-gray-900 cursor-pointer">
                      डायरेक्ट WhatsApp (ब्राउज़र लिंक)
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      लेटर की इमेज लिंक के साथ WhatsApp खोलें। API की आवश्यकता नहीं।
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
                     onClick={() => setFormData({ ...formData, whatsapp_mode: 'api' })}>
                  <input
                    type="radio"
                    name="whatsapp_mode"
                    value="api"
                    checked={formData.whatsapp_mode === 'api'}
                    onChange={(e) => setFormData({ ...formData, whatsapp_mode: e.target.value })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label className="font-semibold text-gray-900 cursor-pointer">
                      बल्क WhatsApp API (BHASHSMS)
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      PDF निमंत्रण और TEXT बल्क मैसेज BHASHSMS API के माध्यम से भेजें।
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {formData.whatsapp_mode === 'direct' && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="whatsapp_direct_message" className="text-sm font-semibold">
                  डायरेक्ट WhatsApp के लिए मैसेज टेक्स्ट
                </Label>
                <Textarea
                  id="whatsapp_direct_message"
                  value={formData.whatsapp_direct_message}
                  onChange={(e) => setFormData({ ...formData, whatsapp_direct_message: e.target.value })}
                  placeholder="WhatsApp मैसेज में भेजा जाने वाला टेक्स्ट"
                  rows={4}
                  className="font-hindi"
                />
                <p className="text-xs text-gray-500">
                  यह मैसेज लेटर की इमेज लिंक के साथ भेजा जाएगा
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
              >
                <Save className="w-4 h-4" />
                {updateSettingsMutation.isPending ? "सहेज रहे हैं..." : "सहेजें"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {formData.whatsapp_mode === 'api' && (
          <>
            {/* PDF API Configuration Card (UTILITY Template) */}
            <Card className="border-blue-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <CardTitle className="text-xl font-bold text-gray-900">
                  📄 PDF API कॉन्फ़िगरेशन (UTILITY Template)
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">निमंत्रण पत्र PDF भेजने के लिए</p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pdf-api-enabled"
                    checked={formData.whatsapp_pdf_api_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, whatsapp_pdf_api_enabled: checked})}
                  />
                  <Label htmlFor="pdf-api-enabled" className="cursor-pointer font-semibold">
                    PDF WhatsApp API सक्षम करें
                  </Label>
                </div>

                {formData.whatsapp_pdf_api_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>PDF API URL टेम्पलेट (UTILITY)</Label>
                      <Textarea
                        value={formData.whatsapp_pdf_api_url}
                        onChange={(e) => setFormData({...formData, whatsapp_pdf_api_url: e.target.value})}
                        placeholder="https://bhashsms.com/api/sendmsgutil.php?user=XXX&pass=XXX&sender=XXX&phone={{Mob}}&text={{Message}}&htype=document&url={{PdfUrl}}"
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                        <p className="text-sm font-semibold text-blue-800 mb-1">📌 PDF API नोट:</p>
                        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                          <li>यह API UTILITY template के साथ PDF document भेजता है</li>
                          <li><code className="bg-blue-100 px-1">htype=document</code> parameter जरूरी है</li>
                          <li><code className="bg-blue-100 px-1">{"{{PdfUrl}}"}</code> में invitation PDF का लिंक आएगा</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="wa-debug-pdf"
                        checked={formData.whatsapp_debug_prompt}
                        onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_debug_prompt: checked })}
                      />
                      <Label htmlFor="wa-debug-pdf" className="cursor-pointer text-sm">
                        PDF API डिबग मोड (पत्र भेजते समय URL दिखाएगा)
                      </Label>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-900 mb-1">नमूना UTILITY API:</p>
                      <code className="text-xs text-amber-800 block break-all">
                        https://bhashsms.com/api/sendmsgutil.php?user=dharfc_bwa&pass=XXX&sender=BUZWAP&phone={"{{Mob}}"}&text={"{{Message}}"}&htype=document&fname=Invitation.pdf&url={"{{PdfUrl}}"}
                      </code>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* PDF API Test Card */}
            {formData.whatsapp_pdf_api_enabled && formData.whatsapp_pdf_api_url && (
              <Card className="border-blue-100 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                  <CardTitle className="text-xl font-bold text-gray-900">
                    🧪 PDF API टेस्ट करें
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>टेस्ट मोबाइल नंबर</Label>
                      <Input
                        type="text"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        maxLength={10}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>टेस्ट संदेश</Label>
                      <Input
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="टेस्ट पत्र संदेश"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleTestPDF}
                    variant="outline"
                    className="gap-2 w-full border-blue-300 hover:bg-blue-50"
                  >
                    <Send className="w-4 h-4" />
                    टेस्ट PDF API URL खोलें
                  </Button>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                      ✓ यह UTILITY template टेस्ट करेगा (PDF document के साथ)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* TEXT API Configuration Card (TEXT Template) */}
            <Card className="border-green-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                <CardTitle className="text-xl font-bold text-gray-900">
                  💬 TEXT API कॉन्फ़िगरेशन (TEXT Template)
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">बल्क टेक्स्ट मैसेज भेजने के लिए (जन्मदिन/वर्षगांठ बधाई)</p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="text-api-enabled"
                    checked={formData.whatsapp_text_api_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, whatsapp_text_api_enabled: checked})}
                  />
                  <Label htmlFor="text-api-enabled" className="cursor-pointer font-semibold">
                    TEXT WhatsApp API सक्षम करें
                  </Label>
                </div>

                {formData.whatsapp_text_api_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Template Name</Label>
                      <Input
                        value={formData.whatsapp_text_template_name}
                        onChange={(e) => setFormData({...formData, whatsapp_text_template_name: e.target.value})}
                        placeholder="team_neenavverma_01"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500">
                        BHASHSMS में बनाया गया TEXT template name
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>TEXT API URL टेम्पलेट</Label>
                      <Textarea
                        value={formData.whatsapp_text_api_url}
                        onChange={(e) => setFormData({...formData, whatsapp_text_api_url: e.target.value})}
                        placeholder="https://bhashsms.com/api/sendmsg.php?user=XXX&pass=XXX&sender=XXX&phone={{Mob}}&text={{Message}}&template_id=XXX"
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                        <p className="text-sm font-semibold text-green-800 mb-1">📌 TEXT API नोट:</p>
                        <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                          <li>यह API TEXT template (बिना PDF) के साथ message भेजता है</li>
                          <li>PDF parameters (<code className="bg-green-100 px-1">htype, url, fname</code>) की जरूरत नहीं</li>
                          <li>Birthday/Anniversary wishes के लिए उपयोग होगा</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="wa-debug-text"
                        checked={formData.whatsapp_text_debug_prompt}
                        onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_text_debug_prompt: checked })}
                      />
                      <Label htmlFor="wa-debug-text" className="cursor-pointer text-sm">
                        TEXT API डिबग मोड (बल्क मैसेज भेजते समय URL दिखाएगा)
                      </Label>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2 text-sm">उपलब्ध प्लेसहोल्डर्स:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs">{"{{Mob}}"}</Badge>
                          <span className="text-xs text-gray-600">मोबाइल</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs">{"{{Message}}"}</Badge>
                          <span className="text-xs text-gray-600">संदेश</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs">{"{{Name}}"}</Badge>
                          <span className="text-xs text-gray-600">नाम</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs">{"{{Village}}"}</Badge>
                          <span className="text-xs text-gray-600">गाँव</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-900 mb-1">नमूना TEXT API:</p>
                      <code className="text-xs text-amber-800 block break-all">
                        https://bhashsms.com/api/sendmsg.php?user=dharfc_bwa&pass=XXX&sender=BUZWAP&phone={"{{Mob}}"}&text={"{{Message}}"}&template_id=team_neenavverma_01
                      </code>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* TEXT API Test Card */}
            {formData.whatsapp_text_api_enabled && formData.whatsapp_text_api_url && (
              <Card className="border-green-100 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-gray-900">
                    🧪 TEXT API टेस्ट करें
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>टेस्ट मोबाइल नंबर</Label>
                    <Input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                    />
                  </div>

                  <Button
                    onClick={handleTestText}
                    variant="outline"
                    className="gap-2 w-full border-green-300 hover:bg-green-50"
                  >
                    <Send className="w-4 h-4" />
                    टेस्ट TEXT API URL खोलें
                  </Button>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-800">
                      ✓ यह TEXT template टेस्ट करेगा (बिना PDF के, सिर्फ message)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}