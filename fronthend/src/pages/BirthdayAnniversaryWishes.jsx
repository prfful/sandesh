import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Politician, PoliticianType } from "@/api/entities";
import { sendWhatsAppMessage, logWhatsAppSend } from "@/api/functions";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { Gift, Heart, RefreshCw, Send, Sparkles, Info, Copy, AlertTriangle, BookTemplate } from "lucide-react";
import restClient from "@/api/restClient";

const formatKey = (dateStr) => {
  if (!dateStr) return null;
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return null;
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
};

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  const id = String(value).trim();
  return id.length ? id : null;
};

const getTemplateId = (template) => {
  if (!template) return null;
  return normalizeId(
    template.id ??
    template.ID ??
    template.Id ??
    template.template_id ??
    template.TemplateId ??
    template.data?.id ??
    template.data?.ID ??
    template.data?.Id
  );
};

const normalizeType = (value) => String(value || "").trim().toLowerCase();

const getTemplateCategory = (template) => {
  if (!template) return "";
  return normalizeType(
    template.template_type ??
    template.TemplateType ??
    template.data?.template_type ??
    template.data?.TemplateType
  );
};

const getTemplateType = (template) => {
  if (!template) return "";
  return normalizeType(
    template.program_type ??
    template.programType ??
    template.ProgramType ??
    template.Program_Type ??
    template.type ??
    template.data?.program_type ??
    template.data?.programType ??
    template.data?.ProgramType ??
    template.data?.Program_Type ??
    template.data?.type
  );
};

const isBirthdayType = (template) => {
  const type = getTemplateType(template);
  return type === "birthday" || type === "जन्मदिन";
};

const isAnniversaryType = (template) => {
  const type = getTemplateType(template);
  return type === "anniversary" || type === "वर्षगांठ";
};

const isLegacyWishesType = (template) => {
  const type = getTemplateType(template);
  return type === "birthday" || type === "anniversary" || type === "simple_text" || type === "जन्मदिन" || type === "वर्षगांठ";
};

const isAllowedTemplateType = (template) => {
  const category = getTemplateCategory(template);
  if (category === "text") return true;
  return isLegacyWishesType(template);
};

export default function BirthdayAnniversaryWishes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const replaceVars = (text, person, designation) => {
    let msg = text || "";
    const pairs = {
      Name: person.Name,
      Designation: designation,
      Village: person.Village_City,
      Mandal: person.Mandal ? (types.find(t => t.id === person.Mandal)?.Designation || person.Mandal) : '',
      Mobile: person.Mobile,
      DOB: person.DOB,
      DOA: person.DOA,
    };
    Object.entries(pairs).forEach(([k, v]) => {
      msg = msg.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
    });
    return msg.trim();
  };

  const todayKey = useMemo(() => {
    const now = new Date();
    return formatKey(now.toISOString());
  }, []);

  const { data: types = [] } = useQuery({
    queryKey: ["politician-types"],
    queryFn: () => PoliticianType.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: people = [], isFetching } = useQuery({
    queryKey: ["politicians"],
    queryFn: () => Politician.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["letter-templates"],
    queryFn: () => restClient.listEntities("LetterTemplate"),
    staleTime: 2 * 60 * 1000,
  });

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

  const birthdayList = useMemo(() => people.filter((p) => formatKey(p.DOB) === todayKey), [people, todayKey]);
  const anniversaryList = useMemo(() => people.filter((p) => formatKey(p.DOA) === todayKey), [people, todayKey]);

  const [selectedBirthdays, setSelectedBirthdays] = useState([]);
  const [selectedAnniversaries, setSelectedAnniversaries] = useState([]);
  const [birthdayTemplateId, setBirthdayTemplateId] = useState(null);
  const [anniversaryTemplateId, setAnniversaryTemplateId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [sending, setSending] = useState(false);
  const [debugUrls, setDebugUrls] = useState(null);
  const [previewUrls, setPreviewUrls] = useState(null); // ✅ NEW: Always-on preview mode

  useEffect(() => {
    setSelectedBirthdays(birthdayList.map((p) => p.id));
  }, [birthdayList]);

  useEffect(() => {
    setSelectedAnniversaries(anniversaryList.map((p) => p.id));
  }, [anniversaryList]);

  const allTemplatesWithId = useMemo(
    () => (Array.isArray(templates) ? templates : []).filter((t) => getTemplateId(t)),
    [templates]
  );

  const allValidTemplates = useMemo(() => allTemplatesWithId.filter((t) => isAllowedTemplateType(t)), [allTemplatesWithId]);

  const birthdayTemplates = useMemo(
    () => allValidTemplates.filter((t) => isBirthdayType(t) || String(t.program_type || '').toLowerCase() === 'simple_text'),
    [allValidTemplates]
  );

  const anniversaryTemplates = useMemo(
    () => allValidTemplates.filter((t) => isAnniversaryType(t) || String(t.program_type || '').toLowerCase() === 'simple_text'),
    [allValidTemplates]
  );

  useEffect(() => {
    if (!birthdayTemplateId && birthdayTemplates.length) {
      const preferred = birthdayTemplates.find((t) => isBirthdayType(t));
      setBirthdayTemplateId(getTemplateId(preferred || birthdayTemplates[0]));
    }
  }, [birthdayTemplateId, birthdayTemplates]);

  useEffect(() => {
    if (!anniversaryTemplateId && anniversaryTemplates.length) {
      const preferred = anniversaryTemplates.find((t) => isAnniversaryType(t));
      setAnniversaryTemplateId(getTemplateId(preferred || anniversaryTemplates[0]));
    }
  }, [anniversaryTemplateId, anniversaryTemplates]);

  const getTemplateById = (id) => {
    const normalized = normalizeId(id);
    return (Array.isArray(templates) ? templates : []).find((t) => getTemplateId(t) === normalized);
  };

  const buildMessage = (tplId, person) => {
    const tpl = getTemplateById(tplId);
    const body = tpl?.body || "";
    const designation = types.find((t) => t.id === person.Designation)?.Designation || "";
    return replaceVars(body, person, designation);
  };

  const openPreview = (type) => {
    const list = type === "birthday" ? birthdayList.filter((p) => selectedBirthdays.includes(p.id)) : anniversaryList.filter((p) => selectedAnniversaries.includes(p.id));
    const tplId = type === "birthday" ? birthdayTemplateId : anniversaryTemplateId;
    if (!list.length) {
      toast.error("भेजने के लिए रिकॉर्ड चुनें");
      return;
    }
    if (!tplId) {
      toast.error("कृपया टेम्पलेट चुनें");
      return;
    }
    const sample = buildMessage(tplId, list[0]);
    setConfirmState({ type, tplId, list, sample });
  };

  const sendBatch = async () => {
    if (!confirmState) return;

    // ✅ ALWAYS build and show URLs first (preview mode)
    const urls = [];
    const { type, tplId, list } = confirmState;
    
    for (const person of list) {
      const finalMsg = buildMessage(tplId, person);
      let apiUrl = appSettings?.whatsapp_text_api_url || '';
      
      // Replace placeholders first
      apiUrl = apiUrl.replace(/\{\{Mob\}\}/g, person.Mobile || '');
      apiUrl = apiUrl.replace(/\{\{SenderName\}\}/g, encodeURIComponent(person.Name || ''));
      
      const templateName = 'team_neena_verma9';
      const paramsName = person.Name || '';
      const paramsMessage = finalMsg;

      try {
        const urlObj = new URL(apiUrl);
        urlObj.searchParams.set('phone', person.Mobile || '');
        urlObj.searchParams.set('text', templateName);
        urlObj.searchParams.delete('template_id');

        // Remove any existing params to avoid duplicates
        urlObj.searchParams.delete('params');

        // Manually build params to avoid + symbols for spaces
        // Replace spaces with %20 and keep Hindi text as-is
        const paramsNameEncoded = paramsName.replace(/ /g, '%20');
        const paramsMessageEncoded = paramsMessage.replace(/ /g, '%20');
        const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
        
        const urlString = urlObj.toString();
        apiUrl = urlString.includes('?') 
          ? `${urlString}&params=${paramsValue}`
          : `${urlString}?params=${paramsValue}`;
      } catch (e) {
        // Fallback: manual parameter addition
        if (/([?&])phone=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/phone=[^&]*/i, `phone=${person.Mobile || ''}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `phone=${person.Mobile || ''}`;
        }
        if (/([?&])text=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/text=[^&]*/i, `text=${templateName}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `text=${templateName}`;
        }
        
        // Use %20 for spaces instead of + symbol
        const paramsNameEncoded = paramsName.replace(/ /g, '%20');
        const paramsMessageEncoded = paramsMessage.replace(/ /g, '%20');
        const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
        
        if (/([?&])params=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/params=[^&]*/i, `params=${paramsValue}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `params=${paramsValue}`;
        }
        apiUrl = apiUrl.replace(/template_id=[^&]*&?/i, '');
      }
      
      urls.push({
        personId: person.id,
        name: person.Name,
        mobile: person.Mobile,
        url: apiUrl,
        finalMsg: finalMsg
      });
    }
    
    // ✅ Show preview popup with URLs - User can review before sending
    setPreviewUrls({ urls, type, tplId, list });
    setConfirmState(null);
  };

  const confirmSendBatch = async () => {
    if (!previewUrls) return;
    
    setSending(true);
    const { urls, type, tplId, list } = previewUrls;
    let successCount = 0;
    
    for (const item of urls) {
      try {
        const resp = await sendWhatsAppMessage({
          phone: item.mobile,
          recipientName: item.name,
          message: item.finalMsg,
          apiUrl: item.url,
        });
        const status = resp?.success ? "success" : "failed";
        await logWhatsAppSend({ person_id: item.personId, type, message: item.finalMsg, status, response: JSON.stringify(resp || {}) });
        if (resp?.success) successCount += 1;
      } catch (e) {
        await logWhatsAppSend({ person_id: item.personId, type, message: item.finalMsg, status: "failed", response: e.message });
      }
    }
    
    setSending(false);
    setPreviewUrls(null);
    toast.success(`भेजा गया: ${successCount}/${list.length}`);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["politicians"] });
    queryClient.invalidateQueries({ queryKey: ["politician-types"] });
    queryClient.invalidateQueries({ queryKey: ["letter-templates"] });
  };

  const renderTable = (items, selectedIds, setSelected) => {
    if (!items.length) {
      return <p className="text-gray-500 text-sm">आज कोई रिकॉर्ड नहीं</p>;
    }
    return (
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-2">चयन</th>
              <th className="py-2 px-2">नाम</th>
              <th className="py-2 px-2">मोबाइल</th>
              <th className="py-2 px-2">पद</th>
              <th className="py-2 px-2">गाँव/नगर</th>
              <th className="py-2 px-2">AutoAllow</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const checked = selectedIds.includes(p.id);
              const designation = types.find((t) => t.id === p.Designation)?.Designation || "";
              return (
                <tr key={p.id} className="border-b hover:bg-orange-50">
                  <td className="py-2 px-2">
                    <Checkbox checked={checked} onCheckedChange={(v) => {
                      setSelected((prev) => (v ? [...prev, p.id] : prev.filter((id) => id !== p.id)));
                    }} />
                  </td>
                  <td className="py-2 px-2 font-medium text-gray-900 flex items-center gap-2">
                    <span>{p.Name}</span>
                    {p.AutoAllow ? <Badge className="bg-green-100 text-green-700">Auto</Badge> : null}
                  </td>
                  <td className="py-2 px-2">{p.Mobile}</td>
                  <td className="py-2 px-2">{designation}</td>
                  <td className="py-2 px-2">{p.Village_City}</td>
                  <td className="py-2 px-2">{p.AutoAllow ? "Yes" : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">जन्मदिन / विवाह वर्षगांठ बधाई संदेश</h1>
            <p className="text-gray-600 mt-1">AutoAllow = Yes होने पर रोज़ 1:00 PM पर संदेश स्वतः भेजे जाएंगे</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button variant="default" className="gap-2" onClick={() => navigate(createPageUrl("BirthdayAnniversaryTemplates"))}>
              <BookTemplate className="w-4 h-4" /> Manage Templates
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => navigate(createPageUrl("Dashboard"))}>
              Exit
            </Button>
          </div>
        </div>

        <Card className="border-orange-100 shadow-md">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-2 text-orange-700">
              <Info className="w-4 h-4" />
              <span>भेजने से पहले पुष्टि डायलॉग में पूर्वावलोकन दिखेगा।</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            <Card className="border-orange-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-orange-600" /> आज के जन्मदिन ({birthdayList.length})
                  </CardTitle>
                  <p className="text-sm text-gray-600">सभी को चुनकर संदेश भेजें</p>
                </div>
                <Select value={birthdayTemplateId ? String(birthdayTemplateId) : undefined} onValueChange={(v) => setBirthdayTemplateId(v)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Birthday Template चुनें" />
                  </SelectTrigger>
                  <SelectContent>
                    {birthdayTemplates.map((t) => (
                      <SelectItem key={getTemplateId(t)} value={getTemplateId(t)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {renderTable(birthdayList, selectedBirthdays, setSelectedBirthdays)}
                <div className="flex gap-3">
                  <Button className="gap-2" onClick={() => openPreview("birthday")} disabled={sending}>
                    <Send className="w-4 h-4" /> Send Message
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setSelectedBirthdays(birthdayList.map((p) => p.id))}>
                    Select All
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-pink-600" /> आज की वर्षगांठ ({anniversaryList.length})
                  </CardTitle>
                  <p className="text-sm text-gray-600">सभी को चुनकर संदेश भेजें</p>
                </div>
                <Select value={anniversaryTemplateId ? String(anniversaryTemplateId) : undefined} onValueChange={(v) => setAnniversaryTemplateId(v)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Anniversary Template चुनें" />
                  </SelectTrigger>
                  <SelectContent>
                    {anniversaryTemplates.map((t) => (
                      <SelectItem key={getTemplateId(t)} value={getTemplateId(t)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {renderTable(anniversaryList, selectedAnniversaries, setSelectedAnniversaries)}
                <div className="flex gap-3">
                  <Button className="gap-2" onClick={() => openPreview("anniversary")} disabled={sending}>
                    <Send className="w-4 h-4" /> Send Message
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setSelectedAnniversaries(anniversaryList.map((p) => p.id))}>
                    Select All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-orange-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <CardTitle className="text-lg font-bold text-gray-900">पूर्वावलोकन</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm text-gray-700">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">Placeholder:</p>
                <p className="bg-gray-50 border rounded p-3 whitespace-pre-line">{'{{Name}}, {{Designation}}, {{Village}}, {{Block}}, {{Mobile}}'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">नमूना जन्मदिन संदेश:</p>
                <div className="bg-white border rounded p-3 min-h-[80px]">
                  {birthdayList.length && birthdayTemplateId ? (
                    <pre className="whitespace-pre-wrap text-gray-800 text-sm">{buildMessage(birthdayTemplateId, birthdayList[0])}</pre>
                  ) : (
                    <span className="text-gray-400">कोई जन्मदिन रिकॉर्ड नहीं</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">नमूना वर्षगांठ संदेश:</p>
                <div className="bg-white border rounded p-3 min-h-[80px]">
                  {anniversaryList.length && anniversaryTemplateId ? (
                    <pre className="whitespace-pre-wrap text-gray-800 text-sm">{buildMessage(anniversaryTemplateId, anniversaryList[0])}</pre>
                  ) : (
                    <span className="text-gray-400">कोई वर्षगांठ रिकॉर्ड नहीं</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!confirmState} onOpenChange={(open) => { if (!open) setConfirmState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>संदेश भेजें?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState ? (
                <div className="space-y-3 text-gray-700">
                  <p className="font-medium">प्रकार: {confirmState.type === "birthday" ? "जन्मदिन" : "विवाह वर्षगांठ"}</p>
                  <p>कुल प्राप्तकर्ता: {confirmState.list.length}</p>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">पूर्वावलोकन:</p>
                    <div className="bg-gray-50 border rounded p-3 max-h-48 overflow-auto whitespace-pre-wrap">
                      {confirmState.sample || "—"}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">AutoAllow = Yes वाले रिकॉर्ड पर सर्वर स्वतः 1:00 PM को भी भेजेगा।</p>
                </div>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={sendBatch} disabled={sending} className="bg-orange-500 hover:bg-orange-600">
              भेजें
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!debugUrls} onOpenChange={(open) => { if (!open) setDebugUrls(null); }}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>🔍 WhatsApp API डिबग URLs</AlertDialogTitle>
            <AlertDialogDescription>
              निम्नलिखित URLs का उपयोग करके संदेश भेजे जाएंगे।
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* Warning if template_id is missing */}
          {debugUrls && debugUrls.length > 0 && !debugUrls[0].url.includes('template_id=') && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-2">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-800">⚠️ Template ID गायब है!</p>
                  <p className="text-yellow-700 mt-1">
                    URLs में <code className="bg-yellow-100 px-1 rounded">template_id</code> parameter नहीं है। 
                    संदेश queue होंगे लेकिन deliver नहीं होंगे।
                  </p>
                  <p className="text-yellow-700 mt-2 font-medium">
                    Fix: WhatsApp Settings में जाकर "Template Name" भरें और Save करें।
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3 text-sm max-h-96 overflow-y-auto">
            {debugUrls && debugUrls.map((item, idx) => (
              <div key={idx} className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-600">{item.mobile}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      toast.success("URL कॉपी किया गया!");
                    }}
                  >
                    <Copy className="w-3 h-3" /> कॉपी
                  </Button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
                  <code className="text-xs text-gray-700 break-all font-mono">{item.url}</code>
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>बंद करें</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          {previewUrls?.urls && previewUrls.urls.length > 0 && previewUrls.urls[0].url.includes('template_id=') && (
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

          {/* Info box with summary */}
          {previewUrls?.urls && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-sm font-semibold text-blue-900">ℹ️ संदेश भेजने की जानकारी:</p>
              <p className="text-sm text-blue-700 mt-1">
                कुल संदेश: <strong>{previewUrls.urls.length}</strong> | 
                प्रकार: <strong>{previewUrls.type === 'birthday' ? '🎂 Birthday' : '💍 Anniversary'}</strong>
              </p>
            </div>
          )}

          <div className="space-y-3 text-sm max-h-96 overflow-y-auto">
            {previewUrls?.urls && previewUrls.urls.map((item, idx) => (
              <div key={idx} className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-grow">
                    <p className="font-semibold text-gray-900">{idx + 1}. {item.name}</p>
                    <p className="text-xs text-gray-600">📱 {item.mobile}</p>
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
                      {item.url.includes('text=') ? '✅' : '❌'} 
                      <code className="bg-yellow-100 px-1">text</code> parameter
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
