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

const setQueryParameter = (searchParams, name, value) => {
  const matchingKeys = [...searchParams.keys()].filter((key) => key.toLowerCase() === name.toLowerCase());
  const key = matchingKeys[0] || name;
  matchingKeys.forEach((matchingKey) => searchParams.delete(matchingKey));
  searchParams.set(key, value);
};

const deleteQueryParameter = (searchParams, name) => {
  [...searchParams.keys()]
    .filter((key) => key.toLowerCase() === name.toLowerCase())
    .forEach((key) => searchParams.delete(key));
};

const setCanonicalQueryParameter = (searchParams, name, value) => {
  deleteQueryParameter(searchParams, name);
  searchParams.set(name, value);
};

const getConfiguredTemplateName = (apiUrl, templateName) => {
  try {
    const urlTemplateName = new URL(apiUrl).searchParams.get("text")?.trim();
    if (urlTemplateName && !urlTemplateName.includes("{{")) return urlTemplateName;
  } catch {
    return templateName.trim();
  }

  return templateName.trim();
};

const normalizeImageFilename = (filename, mimeType) => {
  const extensionByMimeType = {
    "image/jpeg": ".jpeg",
    "image/png": ".png",
    "image/gif": ".gif",
  };
  const expectedExtension = extensionByMimeType[mimeType];
  const safeBaseName = (filename || "WhatsApp-Image")
    .replace(/\.[^.]*$/, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim() || "WhatsApp-Image";
  const supportedExtension = /\.(jpe?g|png|gif)$/i.test(filename || "");
  return supportedExtension ? filename.replace(/[\\/:*?"<>|]/g, "-") : `${safeBaseName}${expectedExtension}`;
};

const isPlaceholderImageUrl = (imageUrl) => {
  try {
    const hostname = new URL(imageUrl).hostname.toLowerCase();
    return hostname === "your-site"
      || hostname === "localhost"
      || hostname === "127.0.0.1"
      || /^example\.(com|net|org)$/.test(hostname);
  } catch {
    return true;
  }
};

const buildBulkApiUrl = ({ template, person, message, templateName, mode, imageUrl, imageName }) => {
  const url = new URL(template);
  if (url.hostname.toLowerCase() === "bhashsms.com" && url.protocol === "http:") {
    url.protocol = "https:";
  }
  if (/\/sendmsg(?:util)?\.php$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/sendmsg(?:util)?\.php$/i, mode === "utility" ? "sendmsgutil.php" : "sendmsg.php");
  }

  const selectedTemplate = getConfiguredTemplateName(template, templateName);
  if (!selectedTemplate) {
    throw new Error("WhatsApp Settings में TEXT API URL का text template name दर्ज करें।");
  }
  setQueryParameter(url.searchParams, "phone", person.Mobile || "");
  setQueryParameter(url.searchParams, "text", selectedTemplate);
  setCanonicalQueryParameter(url.searchParams, "Params", `${person.Name || ""},${message}`);
  deleteQueryParameter(url.searchParams, "template_id");

  if (mode === "utility") {
    setQueryParameter(url.searchParams, "htype", "image");
    setQueryParameter(url.searchParams, "fname", imageName || "WhatsApp-Image");
    setQueryParameter(url.searchParams, "url", imageUrl);
  } else {
    ["htype", "fname", "url"].forEach((name) => {
      deleteQueryParameter(url.searchParams, name);
    });
  }

  return { url: url.toString(), templateName: selectedTemplate };
};

const inspectBulkRequest = (item) => {
  const requestUrl = new URL(item.url);
  const paramKeys = [...requestUrl.searchParams.keys()].filter((key) => key.toLowerCase() === "params");
  const imageUrl = requestUrl.searchParams.get("url") || "";
  const extension = requestUrl.searchParams.get("fname")?.split(".").pop()?.toLowerCase() || "";
  const validImageExtensions = ["jpg", "jpeg", "png", "gif"];
  const diagnostics = {
    recipient: item.mobile ? `***${String(item.mobile).slice(-4)}` : "missing",
    mode: item.utilityApi,
    endpoint: requestUrl.pathname,
    textTemplate: requestUrl.searchParams.get("text") || "missing",
    utilityEndpoint: requestUrl.pathname.toLowerCase().includes("sendmsgutil.php"),
    paramsCount: paramKeys.length,
    paramsKey: paramKeys[0] || "missing",
    imageType: requestUrl.searchParams.get("htype") || "missing",
    filename: requestUrl.searchParams.get("fname") || "missing",
    supportedImageExtension: validImageExtensions.includes(extension),
    imageUrlHost: imageUrl ? new URL(imageUrl).host : "missing",
    httpsImageUrl: imageUrl.startsWith("https://"),
    placeholderImageUrl: isPlaceholderImageUrl(imageUrl),
  };

  const safeUrl = new URL(item.url);
  ["user", "pass", "password", "phone", "params"].forEach((key) => deleteQueryParameter(safeUrl.searchParams, key));
  diagnostics.requestUrlWithoutCredentialsOrPersonalValues = safeUrl.toString();
  diagnostics.valid = item.utilityApi === "utility"
    ? diagnostics.utilityEndpoint
      && diagnostics.paramsCount === 1
      && diagnostics.imageType === "image"
      && diagnostics.supportedImageExtension
      && diagnostics.httpsImageUrl
      && !diagnostics.placeholderImageUrl
    : diagnostics.paramsCount === 1;

  return diagnostics;
};

const getGatewayResponseSnippet = (response) => {
  const responseText = typeof response === "string" ? response : JSON.stringify(response ?? "");
  return responseText
    .replace(/([?&](?:user|pass|password|phone)=)[^&\s]*/gi, "$1[redacted]")
    .slice(0, 500);
};

const checkImageLoadsInBrowser = (imageUrl) => new Promise((resolve) => {
  const image = new Image();
  const timeout = window.setTimeout(() => {
    image.src = "";
    resolve({ loaded: false, reason: "timeout" });
  }, 10000);

  image.onload = () => {
    window.clearTimeout(timeout);
    resolve({ loaded: true, width: image.naturalWidth, height: image.naturalHeight });
  };
  image.onerror = () => {
    window.clearTimeout(timeout);
    resolve({ loaded: false, reason: "browser could not load the URL as an image" });
  };
  image.src = imageUrl;
});

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
  const [apiModeOverride, setApiModeOverride] = useState(null);
  const apiTemplate = appSettings?.whatsapp_text_api_url || "";
  const utilityApi = apiModeOverride || (isUtilityApi(apiTemplate) ? "utility" : "marketing");

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
      setImageName(normalizeImageFilename(file.name, file.type));
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
    if (utilityApi === "utility" && !imageUrl) {
      toast.error("UTILITY API के लिए पहले इमेज चुनें");
      return;
    }
    if (utilityApi === "utility" && isPlaceholderImageUrl(imageUrl)) {
      toast.error("इमेज लिंक में असली वेबसाइट का पता नहीं है। अपलोड की गई इमेज का वास्तविक सार्वजनिक URL इस्तेमाल करें।");
      return;
    }
    if (utilityApi === "marketing" && imageUrl) {
      toast.error("MARKETING API केवल टेक्स्ट भेजती है। इमेज भेजने के लिए Utility चुनें, या अपलोड की गई इमेज हटाएं।");
      return;
    }
    
    // ✅ NEW: Build URLs and show preview popup first
    const urls = [];
    
    for (const person of filtered) {
      const desigText = types.find(t => t.id === person.Designation)?.Designation || '';
      const mandalName = mandals.find(m => m.id === person.Mandal)?.name || '';
      const finalMsg = replaceVars(message, person, desigText, mandalName);
      let apiUrl;
      let selectedTemplate;
      try {
        ({ url: apiUrl, templateName: selectedTemplate } = buildBulkApiUrl({
          template: apiTemplate,
          person,
          message: finalMsg,
          templateName: appSettings?.whatsapp_text_template_name || "",
          mode: utilityApi,
          imageUrl,
          imageName,
        }));
      } catch (error) {
        toast.error(`Bulk API URL सही नहीं है: ${error.message}`);
        return;
      }
      
      urls.push({
        person: person,
        name: person.Name,
        mobile: person.Mobile,
        url: apiUrl,
        finalMsg: finalMsg,
        imageUrl: utilityApi === "utility" ? imageUrl : "",
        utilityApi,
        templateName: selectedTemplate,
        desigText: desigText,
        mandalName: mandalName
      });
    }
    
    const diagnostics = urls.map(inspectBulkRequest);
    console.groupCollapsed("[WhatsApp Bulk] Request checks");
    console.table(diagnostics);
    diagnostics.filter((item) => !item.valid).forEach((item) => console.warn("[WhatsApp Bulk] Request check failed:", item));
    console.info("Credentials, full phone numbers, and Params values are omitted from these logs.");
    console.groupEnd();

    if (utilityApi === "utility") {
      const imageCheck = await checkImageLoadsInBrowser(imageUrl);
      if (imageCheck.loaded) {
        console.info("[WhatsApp Bulk] Image URL loads in this browser:", imageCheck);
      } else {
        console.warn("[WhatsApp Bulk] Image URL did not load in this browser:", imageCheck);
        toast.warning("ब्राउज़र इमेज URL नहीं खोल पाया। प्रिव्यू में इमेज लिंक खोलकर जाँचें।");
      }
      console.info("Browser image-load check does not guarantee that BhashSMS can access the URL.");
    }

    // ✅ Show preview popup with URLs - User can review before sending
    setPreviewUrls(urls);
  };

  const confirmSendBatch = async () => {
    if (!previewUrls) return;
    
    setSending(true);
    let successCount = 0;
    const failures = [];
    
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
        console.groupCollapsed(`[WhatsApp Bulk] Gateway response for ***${String(item.mobile || "").slice(-4)}`);
        console.info({
          success: resp?.success,
          queued: resp?.queued,
          statusCode: resp?.statusCode,
          statusMessage: resp?.statusMessage,
          templateNameUsed: resp?.templateNameUsed,
          gatewayResponse: getGatewayResponseSnippet(resp?.bhashResponse || resp?.data?.rawResponse || resp?.data),
          request: inspectBulkRequest(item),
        });
        console.groupEnd();
        const status = resp?.success ? 'success' : 'failed';
        await logWhatsAppSend({ person_id: person.id, type: 'bulk', message: finalMsg, status, response: JSON.stringify(resp || {}) });
        if (resp?.success) successCount++;
        else failures.push({
          name: person.Name,
          message: resp?.statusMessage || resp?.error || resp?.bhashResponse || `HTTP ${resp?.statusCode || "unknown"}`,
        });
      } catch (e) {
        console.error("[WhatsApp Bulk] Send request failed:", {
          recipient: `***${String(item.mobile || "").slice(-4)}`,
          error: e.message,
          request: inspectBulkRequest(item),
        });
        await logWhatsAppSend({ person_id: person.id, type: 'bulk', message: finalMsg, status: 'failed', response: e.message });
        failures.push({ name: person.Name, message: e.message });
      }
    }
    
    setSending(false);
    setPreviewUrls(null);
    if (failures.length) {
      const firstFailure = failures[0];
      toast.error(
        `भेजा गया: ${successCount}/${previewUrls.length}। विफल: ${firstFailure.name} — ${firstFailure.message}`,
        { duration: 10000 }
      );
    } else {
      toast.success(`गेटवे द्वारा स्वीकार किया गया: ${successCount}/${previewUrls.length}`);
    }
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
              <fieldset className="space-y-2">
                <legend className="font-medium text-gray-800">Bulk संदेश प्रकार</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-api-mode"
                      value="marketing"
                      checked={utilityApi === "marketing"}
                      onChange={() => setApiModeOverride("marketing")}
                    />
                    Marketing (केवल टेक्स्ट)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-api-mode"
                      value="utility"
                      checked={utilityApi === "utility"}
                      onChange={() => setApiModeOverride("utility")}
                    />
                    Utility (टेक्स्ट + इमेज)
                  </label>
                </div>
              </fieldset>
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
                {utilityApi === "utility"
                  ? "चुनी गई इमेज UTILITY API के साथ संदेश में भेजी जाएगी।"
                  : "MARKETING API केवल टेक्स्ट भेजेगी; इमेज संलग्न नहीं होगी।"}
                {utilityApi === "utility" && /\/sendmsg\.php$/i.test(apiTemplate) && " API URL को इमेज-सक्षम Utility endpoint पर बदला जाएगा।"}
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

          {/* Show the exact template name that will be sent. */}
          {previewUrls && previewUrls.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-orange-900">
                Template: <strong className="font-mono">{new URL(previewUrls[0].url).searchParams.get("text") || "नहीं मिला"}</strong>
              </p>
              {previewUrls.some((item) => new URL(item.url).searchParams.get("text") !== new URL(previewUrls[0].url).searchParams.get("text")) && (
                <p className="mt-1 text-xs text-red-700">चुने गए प्राप्तकर्ताओं के URL में अलग-अलग template हैं। भेजने से पहले जाँचें।</p>
              )}
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
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs text-blue-800 underline"
                    >
                      {imageName} — इमेज URL खोलकर जाँचें
                    </a>
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
                      {item.url.includes(`text=${encodeURIComponent(item.templateName)}`) ? '✅' : '❌'}
                      <code className="bg-yellow-100 px-1">text</code> is template name
                    </li>
                    <li>
                      {/([?&])params=/i.test(item.url) ? '✅' : '❌'}
                      <code className="bg-yellow-100 px-1">Params</code> parameter with dynamic values
                    </li>
                    <li>
                      {item.url.includes('template_id=') ? '❌ BREAKS API!' : '✅ Correct'} 
                      <code className="bg-yellow-100 px-1">template_id</code> NOT present (good!)
                    </li>
                    <li>
                      {item.url.includes('sender=') ? '✅' : '❌'} 
                      <code className="bg-yellow-100 px-1">sender</code> parameter
                    </li>
                    {item.utilityApi && (
                      <li>{item.url.includes('htype=image') && item.url.includes('url=') ? '✅ Utility image URL included' : '❌ Utility image parameters missing'}</li>
                    )}
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
