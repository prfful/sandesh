import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Politician, PoliticianType, Mandal } from "@/api/entities";
import { sendWhatsAppMessage, logWhatsAppSend } from "@/api/functions";
import { toast } from "sonner";
import { AlertTriangle, Copy, Info, X } from "lucide-react";
import restClient from "@/api/restClient";

const isUtilityApi = (apiUrl) => {
  try {
    const url = new URL(apiUrl, 'http://localhost');
    return url.pathname.toLowerCase().includes("sendmsgutil") || url.searchParams.has("htype");
  } catch {
    return /sendmsgutil|[?&]htype=/i.test(apiUrl);
  }
};

const replaceVars = (text, person, designationText, mandalName) => {
  let msg = text || "";
  const pairs = {
    Name: person.Name,
    Designation: designationText,
    Village: person.Village_City,
    Village_City: person.Village_City,
    Mandal: mandalName,
  };
  Object.entries(pairs).forEach(([k, v]) => {
    msg = msg.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
  });
  return msg.trim();
};

export default function WhatsAppBulk() {
  const { data: types = [] } = useQuery({ queryKey: ['politician-types'], queryFn: () => PoliticianType.list(), staleTime: 5 * 60 * 1000 });
  const { data: mandals = [] } = useQuery({ queryKey: ['mandals'], queryFn: () => Mandal.list(), staleTime: 5 * 60 * 1000 });
  const { data: people = [] } = useQuery({ queryKey: ['politicians'], queryFn: () => Politician.list() });

  // ✅ NEW: Load app settings for API URL and template_id
  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      try {
        const res = await restClient.listEntities('AppSettings');
        return res && res.length ? res[0] : null;
      } catch (err) {
        console.warn('AppSettings query error:', err);
        return null;
      }
    },
  });

  const [selectedMandals, setSelectedMandals] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [previewUrls, setPreviewUrls] = useState(null); // ✅ NEW: Preview popup state
  const [imageUrl, setImageUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const apiTemplate = appSettings?.whatsapp_text_api_url || "";
  const utilityApi = isUtilityApi(apiTemplate);

  const filtered = useMemo(() => {
    const hasSelection = selectedMandals.length > 0 || selectedTypes.length > 0;
    if (!hasSelection) return [];

    const filterByMandals = selectedMandals.length > 0 && selectedMandals.length < mandals.length;
    const filterByTypes = selectedTypes.length > 0 && selectedTypes.length < types.length;
    let list = people;
    if (filterByMandals) {
      const mids = new Set(selectedMandals.map(Number));
      list = list.filter(p => mids.has(Number(p.Mandal)));
    }
    if (filterByTypes) {
      const tids = new Set(selectedTypes.map(Number));
      list = list.filter(p => tids.has(Number(p.Designation)));
    }
    return list;
  }, [people, selectedMandals, selectedTypes, mandals.length, types.length]);

  const toggleType = (id, checked) => {
    setSelectedTypes(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };
  const toggleMandal = (id, checked) => {
    setSelectedMandals(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
      toast.error("कृपया इमेज फ़ाइल चुनें");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("इमेज का आकार 10 MB से कम होना चाहिए");
      return;
    }

    const uploadData = new FormData();
    uploadData.append("file", file);
    setUploadingImage(true);
    try {
      const response = await restClient.uploadFile(uploadData);
      const uploadedPath = response?.file_url || response?.url || response?.data?.file_url || response?.data?.url;
      if (!uploadedPath) throw new Error("अपलोड की गई इमेज का लिंक नहीं मिला");
      setImageUrl(new URL(uploadedPath, window.location.origin).toString());
      setImageName(file.name);
      toast.success("इमेज अपलोड हुई");
    } catch (error) {
      toast.error(`इमेज अपलोड नहीं हुई: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const onSend = async () => {
    if (!filtered.length) { toast.error("कृपया मण्‍डल/पद चुनें"); return; }
    if (!message.trim()) { toast.error("कृपया संदेश लिखें"); return; }
    if (!apiTemplate) {
      toast.error("कृपया WhatsApp सेटिंग्स में Bulk API URL कॉन्फ़िगर करें");
      return;
    }
    if (utilityApi && !imageUrl) {
      toast.error("UTILITY API के लिए पहले इमेज चुनें");
      return;
    }
    
    // ✅ NEW: Build URLs and show preview popup first
    const urls = [];
    
    for (const person of filtered) {
      const desigText = types.find(t => t.id === person.Designation)?.Designation || '';
      const mandalName = mandals.find(m => m.id === person.Mandal)?.name || '';
      const finalMsg = replaceVars(message, person, desigText, mandalName);
      let apiUrl = apiTemplate;
      
      // ✅ CRITICAL FIX: Set correct parameters FIRST, then replace placeholders
      try {
        const urlObj = new URL(apiUrl);
        urlObj.searchParams.set('phone', person.Mobile || '');
        urlObj.searchParams.set('text', 'team_neena_verma9'); // Template name - FORCE this!
        
        // Remove any existing params to avoid duplicates
        urlObj.searchParams.delete('params');
        if (utilityApi) {
          urlObj.searchParams.set('htype', 'image');
          urlObj.searchParams.set('fname', imageName || 'WhatsApp-Image');
          urlObj.searchParams.set('url', imageUrl);
        } else {
          urlObj.searchParams.delete('htype');
          urlObj.searchParams.delete('fname');
          urlObj.searchParams.delete('url');
        }

        // Manually build params to avoid + symbols for spaces
        // Replace spaces with %20 and keep Hindi text as-is
        const paramsNameEncoded = (person.Name || '').replace(/ /g, '%20');
        const paramsMessageEncoded = finalMsg.replace(/ /g, '%20');
        const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
        
        const urlString = urlObj.toString();
        const finalUrl = urlString.includes('?') 
          ? `${urlString}&params=${paramsValue}`
          : `${urlString}?params=${paramsValue}`;
        
        apiUrl = finalUrl;
      } catch {
        // Fallback: manual parameter addition
        apiUrl += (apiUrl.includes('?') ? '&' : '?') + `phone=${person.Mobile || ''}`;
        apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'text=team_neena_verma9';
        if (utilityApi) {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'htype=image';
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `fname=${encodeURIComponent(imageName || 'WhatsApp-Image')}`;
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `url=${encodeURIComponent(imageUrl)}`;
        }
        
        // Use %20 for spaces instead of + symbol
        const paramsNameEncoded = (person.Name || '').replace(/ /g, '%20');
        const paramsMessageEncoded = finalMsg.replace(/ /g, '%20');
        const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
        
        apiUrl += (apiUrl.includes('?') ? '&' : '?') + `params=${paramsValue}`;
      }
      
      // Replace placeholders AFTER setting correct parameters (for legacy placeholder support)
      apiUrl = apiUrl.replace(/\{\{Mob\}\}/g, person.Mobile || '');
      // Don't encode Message and SenderName - let them stay as plain text with %20 spaces
      apiUrl = apiUrl.replace(/\{\{Message\}\}/g, finalMsg.replace(/ /g, '%20'));
      apiUrl = apiUrl.replace(/\{\{SenderName\}\}/g, (person.Name || '').replace(/ /g, '%20'));
      apiUrl = apiUrl.replace(/\{\{ImageUrl\}\}/g, encodeURIComponent(imageUrl));
      
      urls.push({
        person: person,
        name: person.Name,
        mobile: person.Mobile,
        url: apiUrl,
        finalMsg: finalMsg,
        imageUrl: utilityApi ? imageUrl : "",
        utilityApi,
        desigText: desigText,
        mandalName: mandalName
      });
    }
    
    // ✅ Show preview popup with URLs - User can review before sending
    setPreviewUrls(urls);
  };

  const confirmSendBatch = async () => {
    if (!previewUrls) return;
    
    setSending(true);
    let successCount = 0;
    
    for (const item of previewUrls) {
      const person = item.person;
      const finalMsg = item.finalMsg;
      try {
        // Send the exact same URL that user reviewed in preview to avoid mismatch.
        const resp = await sendWhatsAppMessage({
          phone: person.Mobile,
          recipientName: person.Name,
          message: finalMsg,
          apiUrl: item.url,
        });
        const status = resp?.success ? 'success' : 'failed';
        await logWhatsAppSend({ person_id: person.id, type: 'bulk', message: finalMsg, status, response: JSON.stringify(resp || {}) });
        if (resp?.success) successCount++;
      } catch (e) {
        await logWhatsAppSend({ person_id: person.id, type: 'bulk', message: finalMsg, status: 'failed', response: e.message });
      }
    }
    
    setSending(false);
    setPreviewUrls(null);
    toast.success(`भेजा गया: ${successCount}/${previewUrls.length}`);
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">व्हाट्सएप संदेश भेजें</h1>
          <p className="text-gray-600 mt-1">डिज़िग्नेशन चुनें, संदेश लिखें और भेजें</p>
        </div>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">मण्‍डल और पद चुनें</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">मण्‍डल</span>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedMandals.length === mandals.length && mandals.length > 0} onCheckedChange={(v) => setSelectedMandals(v ? mandals.map(m => m.id) : [])} />
                  <span>Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {mandals.map(m => (
                  <label key={m.id} className="flex items-center gap-2 p-2 bg-white border rounded">
                    <Checkbox checked={selectedMandals.includes(m.id)} onCheckedChange={(v) => toggleMandal(m.id, !!v)} />
                    <span>{m.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">पद</span>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedTypes.length === types.length && types.length > 0} onCheckedChange={(v) => setSelectedTypes(v ? types.map(t => t.id) : [])} />
                  <span>Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {types.map(t => (
                  <label key={t.id} className="flex items-center gap-2 p-2 bg-white border rounded">
                    <Checkbox checked={selectedTypes.includes(t.id)} onCheckedChange={(v) => toggleType(t.id, !!v)} />
                    <span>{t.Designation}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">संदेश</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <Input placeholder="संदेश लिखें (उदाहरण: {{Name}} जी, {{Designation}} - {{Mandal}})" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="space-y-2 rounded-lg border border-orange-100 bg-white p-4">
              <label htmlFor="whatsapp-bulk-image" className="block font-medium text-gray-800">
                संदेश के साथ इमेज
              </label>
              <Input
                id="whatsapp-bulk-image"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleImageSelect}
                disabled={uploadingImage || sending}
              />
              {uploadingImage && <p className="text-sm text-gray-500">इमेज अपलोड हो रही है...</p>}
              {imageUrl && (
                <div className="flex items-center gap-3">
                  <img src={imageUrl} alt="संदेश के साथ भेजी जाने वाली इमेज" className="h-16 w-16 rounded border object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{imageName}</span>
                  <Button type="button" variant="outline" size="icon" aria-label="इमेज हटाएं" onClick={() => { setImageUrl(""); setImageName(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-gray-600">
                {utilityApi
                  ? "चुनी गई इमेज UTILITY API के साथ संदेश में भेजी जाएगी।"
                  : "MARKETING API केवल टेक्स्ट भेजेगी; इमेज संलग्न नहीं होगी।"}
                {" "}अधिकतम आकार 10 MB।
              </p>
            </div>
            <div className="flex gap-3">
              <Button className="gap-2" disabled={sending || uploadingImage} onClick={onSend}>📤 Send Message</Button>
              <Button variant="outline" onClick={() => { setSelectedTypes([]); setMessage(""); }}>🔄 Refresh</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">रिकॉर्ड ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6 overflow-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                पद या मण्‍डल चुनें। सभी कार्यकर्ता देखने के लिए “Select All” चुनें।
              </p>
            ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-2">Id</th>
                  <th className="py-2 px-2">Name</th>
                  <th className="py-2 px-2">Mobile</th>
                  <th className="py-2 px-2">Designation</th>
                  <th className="py-2 px-2">Area</th>
                  <th className="py-2 px-2">Village/City</th>
                  <th className="py-2 px-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 px-2">{p.id}</td>
                    <td className="py-2 px-2">{p.Name}</td>
                    <td className="py-2 px-2">{p.Mobile}</td>
                    <td className="py-2 px-2">{types.find(t => t.id === p.Designation)?.Designation || p.Designation}</td>
                    <td className="py-2 px-2">{p.Area ? 'ग्रामीण' : 'नगरीय'}</td>
                    <td className="py-2 px-2">{p.Village_City}</td>
                    <td className="py-2 px-2">{p.Address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ✅ NEW: Preview URLs popup - ALWAYS SHOWS before sending */}
      <AlertDialog open={!!previewUrls} onOpenChange={(open) => { if (!open) setPreviewUrls(null); }}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>📤 संदेश भेजने से पहले प्रिव्यू - BHASHSMS URLs</AlertDialogTitle>
            <AlertDialogDescription>
              निम्नलिखित URLs का उपयोग करके संदेश भेजे जाएंगे। अगर कोई समस्या दिखे तो रद्द करें और सेटिंग्स जांचें।
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Warning if template_id is PRESENT (it should NOT be!) */}
          {previewUrls && previewUrls.length > 0 && previewUrls[0].url.includes('template_id=') && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-bold text-red-900">🚨 BUG: template_id parameter मौजूद है!</p>
                  <p className="text-red-700 mt-2">
                    URLs में <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">template_id</code> parameter है जो <strong>API को तोड़ देता है!</strong>
                  </p>
                  <p className="text-red-700 mt-1">
                    <strong>नतीजा:</strong> संदेश queue होंगे लेकिन <strong>कभी deliver नहीं होंगे!</strong>
                  </p>
                  <p className="text-red-800 mt-2 font-semibold">
                    ✋ यह bug है! Developer को सूचित करें।
                  </p>
                  <p className="text-red-700 mt-1 text-xs">
                    BHASHSMS TEXT API के लिए template_id parameter नहीं चाहिए। Template name सिर्फ 'text' parameter में होना चाहिए।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning if text is not the template name */}
          {previewUrls && previewUrls.length > 0 && !previewUrls[0].url.includes('text=team_neena_verma9') && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 mb-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-bold text-orange-900">⚠️ चेतावनी: text parameter गलत है!</p>
                  <p className="text-orange-700 mt-2">
                    URLs में <code className="bg-orange-100 px-1.5 py-0.5 rounded font-mono">text</code> parameter 'team_neena_verma9' नहीं है।
                  </p>
                  <p className="text-orange-700 mt-1">
                    यह template name होना चाहिए, पूरा संदेश नहीं।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info box with summary */}
          {previewUrls && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-sm font-semibold text-blue-900">ℹ️ संदेश भेजने की जानकारी:</p>
              <p className="text-sm text-blue-700 mt-1">
                कुल संदेश: <strong>{previewUrls.length}</strong> | 
                प्रकार: <strong>📱 WhatsApp Bulk</strong>
              </p>
            </div>
          )}

          <div className="space-y-3 text-sm max-h-96 overflow-y-auto">
            {previewUrls && previewUrls.map((item, idx) => (
              <div key={idx} className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-grow">
                    <p className="font-semibold text-gray-900">{idx + 1}. {item.name}</p>
                    <p className="text-xs text-gray-600">📱 {item.mobile}</p>
                    <p className="text-xs text-gray-500">{item.desigText} - {item.mandalName}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 flex-shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      toast.success("URL कॉपी किया गया!");
                    }}
                  >
                    <Copy className="w-3 h-3" /> कॉपी URL
                  </Button>
                </div>
                
                {/* Message preview */}
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-gray-600 mb-1 font-semibold">📝 संदेश:</p>
                  <p className="text-xs text-gray-800 whitespace-pre-wrap break-words">{item.finalMsg}</p>
                </div>
                {item.utilityApi && item.imageUrl && (
                  <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-2">
                    <img src={item.imageUrl} alt="संदेश इमेज" className="h-12 w-12 rounded border object-cover" />
                    <span className="truncate text-xs text-blue-800">{imageName} — UTILITY इमेज</span>
                  </div>
                )}
                
                {/* Full URL */}
                <div className="bg-gray-900 border border-gray-700 rounded p-2 overflow-x-auto">
                  <p className="text-xs text-gray-300 mb-1 font-semibold">🔗 API URL:</p>
                  <code className="text-xs text-green-400 break-all font-mono">{item.url}</code>
                </div>

                {/* URL analysis */}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs space-y-1">
                  <p className="font-semibold text-yellow-900">✓ Parameters जांच:</p>
                  <ul className="list-disc ml-4 text-yellow-800 space-y-0.5">
                    <li>
                      {item.url.includes('phone=') ? '✅' : '❌'} 
                      <code className="bg-yellow-100 px-1">phone</code> parameter
                    </li>
                    <li>
                      {item.url.includes('text=team_neena_verma9') ? '✅' : '❌'} 
                      <code className="bg-yellow-100 px-1">text</code> is template name
                    </li>
                    <li>
                      {item.url.includes('params=') ? '✅' : '❌'} 
                      <code className="bg-yellow-100 px-1">params</code> parameter with dynamic values
                    </li>
                    <li>
                      {item.url.includes('template_id=') ? '❌ BREAKS API!' : '✅ Correct'} 
                      <code className="bg-yellow-100 px-1">template_id</code> NOT present (good!)
                    </li>
                    <li>
                      {item.url.includes('sender=') ? '✅' : '❌'} 
                      <code className="bg-yellow-100 px-1">sender</code> parameter
                    </li>
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>❌ रद्द करें</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmSendBatch} 
              disabled={sending} 
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              {sending ? "भेज रहे हैं..." : "✅ हाँ, भेजो"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
