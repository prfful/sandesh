import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Politician, PoliticianType, Mandal } from "@/api/entities";
import { Save, Plus, Trash2, Search, Download, Upload, AlertTriangle, CheckCircle } from "lucide-react";

const initialForm = {
  Name: "",
  Designation: null,
  Address: "",
  Area: 0, // 0 = urban, 1 = rural per boolean semantics
  Village_City: "",
  Mandal: null,
  Mobile: "",
  DOB: "",
  DOA: "",
  Booth_No: "",
  AutoAllow: 0,
};

const normalizeMobile = (value) => String(value ?? "").trim();

// Utility: Generate Excel sample file
const generateSampleExcel = (designationName) => {
  if (typeof window === 'undefined') return;
  
  // Dynamically import xlsx
  import('xlsx').then(({ utils, writeFile }) => {
    const sampleData = [
      { Name: "राज कुमार", Mobile: "9876543210", Address: "मुख्य बाज़ार", Village_City: "गाँव का नाम", Mandal: "मण्‍डल-1", DOB: "1985-05-15", DOA: "2010-06-20", Booth_No: "001", AutoAllow: "Yes" },
      { Name: "प्रिया शर्मा", Mobile: "9876543211", Address: "सड़क संख्या 5", Village_City: "नगर का नाम", Mandal: "मण्‍डल-2", DOB: "1990-12-10", DOA: "2015-07-10", Booth_No: "002", AutoAllow: "No" },
    ];
    const ws = utils.json_to_sheet(sampleData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "कार्यकर्ता");
    const filename = `politician_sample_${designationName || 'template'}.xlsx`;
    writeFile(wb, filename);
    toast.success("नमूना फ़ाइल डाउनलोड हुई");
  }).catch(() => {
    toast.error("xlsx लाइब्रेरी लोड नहीं हो सकी");
  });
};

// Parse Excel/CSV file
const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const { read, utils } = await import('xlsx');
        const workbook = read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("फ़ाइल पढ़ने में त्रुटि"));
    reader.readAsArrayBuffer(file);
  });
};

// Validate single row
const validateRow = (row, index) => {
  const errors = [];
  
  if (!row.Name || !String(row.Name).trim()) {
    errors.push("नाम आवश्यक है");
  }
  
  const mobile = String(row.Mobile || "").trim();
  if (!mobile) {
    errors.push("मोबाइल आवश्यक है");
  } else if (!/^\d{10}$/.test(mobile)) {
    errors.push("मोबाइल 10 अंकों का होना चाहिए");
  }
  
  if (row.DOB) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(String(row.DOB).trim())) {
      errors.push("DOB format YYYY-MM-DD होनी चाहिए");
    }
  }
  
  if (row.DOA) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(String(row.DOA).trim())) {
      errors.push("DOA format YYYY-MM-DD होनी चाहिए");
    }
  }
  
  return { row: { ...row, Mobile: mobile }, errors };
};

export default function PoliticianEntry() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDesignation, setSelectedDesignation] = useState("");
  const [selectedDesignationFilter, setSelectedDesignationFilter] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  
  // Bulk import state
  const [bulkDesignation, setBulkDesignation] = useState(null);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkParsed, setBulkParsed] = useState(null);
  const [bulkValidated, setBulkValidated] = useState(null);
  const [bulkConflicts, setBulkConflicts] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const { data: types = [] } = useQuery({
    queryKey: ['politician-types'],
    queryFn: () => PoliticianType.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['politicians'],
    queryFn: () => Politician.list(),
  });

  const { data: mandals = [] } = useQuery({
    queryKey: ['mandals'],
    queryFn: () => Mandal.list(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => Politician.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politicians'] });
      toast.success("जोड़ा गया!");
      setFormData(initialForm);
    },
    onError: (error) => toast.error(error.message || "रिकॉर्ड जोड़ने में त्रुटि"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => Politician.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politicians'] });
      toast.success("सेव किया गया!");
      setEditingId(null);
      setFormData(initialForm);
    },
    onError: (error) => toast.error(error.message || "रिकॉर्ड सेव करने में त्रुटि"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Politician.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['politicians'] });
      if (String(editingId) === String(id)) {
        setEditingId(null);
        setFormData(initialForm);
      }
      setDeleteTarget(null);
      toast.success("हटा दिया गया");
    },
    onError: (error) => toast.error(`रिकॉर्ड हटाने में त्रुटि: ${error.message}`),
  });

  const bulkDesignationMutation = useMutation({
    mutationFn: async ({ ids, designation }) => {
      const results = await Promise.allSettled(
        ids.map((id) => Politician.update(id, { Designation: designation }))
      );
      return {
        succeededIds: ids.filter((_, index) => results[index].status === "fulfilled"),
        failedIds: ids.filter((_, index) => results[index].status === "rejected"),
      };
    },
    onSuccess: ({ succeededIds, failedIds }) => {
      queryClient.invalidateQueries({ queryKey: ['politicians'] });
      setSelectedIds(failedIds);
      if (failedIds.length > 0) {
        toast.error(`पद बदले गए: ${succeededIds.length}, त्रुटि: ${failedIds.length}`);
      } else {
        toast.success(`${succeededIds.length} रिकॉर्ड का पद बदल दिया गया`);
      }
    },
    onError: (error) => {
      toast.error(`पद बदलने में त्रुटि: ${error.message}`);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => Politician.delete(id)));
      return {
        succeededIds: ids.filter((_, index) => results[index].status === "fulfilled"),
        failedIds: ids.filter((_, index) => results[index].status === "rejected"),
      };
    },
    onSuccess: ({ succeededIds, failedIds }) => {
      queryClient.invalidateQueries({ queryKey: ['politicians'] });
      setSelectedIds(failedIds);
      if (failedIds.length > 0) {
        toast.error(`हटाए गए: ${succeededIds.length}, त्रुटि: ${failedIds.length}`);
      } else {
        toast.success(`${succeededIds.length} रिकॉर्ड हटा दिए गए`);
      }
    },
    onError: (error) => {
      toast.error(`रिकॉर्ड हटाने में त्रुटि: ${error.message}`);
    },
  });

  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return people;
    return people.filter(p => {
      return (
        String(p.Name || "").toLowerCase().includes(t) ||
        String(p.Mobile || "").toLowerCase().includes(t) ||
        String(p.Village_City || "").toLowerCase().includes(t)
      );
    });
  }, [people, searchTerm]);

  const designationCounts = useMemo(
    () => types.map((type) => ({
      ...type,
      count: filtered.filter((person) => String(person.Designation) === String(type.id)).length,
    })),
    [filtered, types]
  );

  const listedPeople = selectedDesignationFilter === "all"
    ? filtered
    : filtered.filter((person) => String(person.Designation) === selectedDesignationFilter);
  const selectedDesignationName = selectedDesignationFilter === "all"
    ? "सभी पदाधिकारी"
    : types.find((type) => String(type.id) === selectedDesignationFilter)?.Designation;

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!formData.Name?.trim()) { toast.error("नाम आवश्यक है"); return false; }
    if (!formData.Designation) { toast.error("पद चुनें"); return false; }
    const mobile = normalizeMobile(formData.Mobile);
    if (mobile && !/^\d{10}$/.test(mobile)) { toast.error("मोबाइल 10 अंकों का होना चाहिए"); return false; }
    if (mobile && people.some((person) =>
      normalizeMobile(person.Mobile) === mobile && String(person.id) !== String(editingId)
    )) {
      toast.error("यह मोबाइल नंबर पहले से दर्ज है");
      return false;
    }
    return true;
  };

  const onSave = () => {
    if (!validate()) return;
    const payload = { ...formData };
    payload.Area = formData.Area ? 1 : 0;
    payload.Mobile = normalizeMobile(formData.Mobile);
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const onEdit = (row) => {
    setEditingId(row.id);
    setFormData({
      Name: row.Name || "",
      Designation: row.Designation || null,
      Address: row.Address || "",
      Area: !!row.Area,
      Village_City: row.Village_City || "",
      Mandal: row.Mandal || null,
      Mobile: row.Mobile || "",
      DOB: row.DOB || "",
      DOA: row.DOA || "",
      Booth_No: row.Booth_No || "",
      AutoAllow: !!row.AutoAllow,
    });
  };

  // Bulk import handlers
  const handleBulkFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!bulkDesignation) {
      toast.error("पहले पद चुनें");
      return;
    }
    
    try {
      setBulkProcessing(true);
      const parsed = await parseExcelFile(file);
      setBulkFile(file);
      setBulkParsed(parsed);
      
      // Validate all rows
      const validated = parsed.map((row, idx) => {
        const { row: cleanRow, errors } = validateRow(row, idx);
        return { ...cleanRow, _errors: errors, _status: errors.length > 0 ? 'error' : 'pending' };
      });
      
      setBulkValidated(validated);
      
      // Check for duplicates
      const seenMobiles = new Set(people.map((person) => normalizeMobile(person.Mobile)));
      const duplicates = validated.filter((row) => {
        const mobile = normalizeMobile(row.Mobile);
        if (!mobile) return false;
        if (seenMobiles.has(mobile)) return true;
        seenMobiles.add(mobile);
        return false;
      });
      setBulkConflicts(duplicates);
      
      toast.success(`${parsed.length} रिकॉर्ड लोड किए गए - ${duplicates.length} डुप्लिकेट मिले`);
    } catch (err) {
      toast.error(`फ़ाइल पढ़ने में विफल: ${err.message}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const confirmBulkImport = async (skipDuplicates = true) => {
    if (!bulkValidated) return;
    
    setBulkProcessing(true);
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const importedMobiles = new Set(people.map((person) => normalizeMobile(person.Mobile)));
    
    for (const row of bulkValidated) {
      // Skip error rows
      if (row._errors.length > 0) {
        errorCount++;
        continue;
      }
      
      // Skip if duplicate and skipDuplicates is true
      const mobile = normalizeMobile(row.Mobile);
      if (skipDuplicates && importedMobiles.has(mobile)) {
        skipCount++;
        continue;
      }
      
      try {
        const payload = {
          Name: row.Name || "",
          Designation: bulkDesignation,
          Address: row.Address || "",
          Area: row.Area ? 1 : 0,
          Village_City: row.Village_City || "",
          Mandal: row.Mandal || null,
          Mobile: row.Mobile || "",
          DOB: row.DOB || "",
          DOA: row.DOA || "",
          Booth_No: row.Booth_No || "",
          AutoAllow: (String(row.AutoAllow || "").toLowerCase() === 'yes' || row.AutoAllow === 1) ? 1 : 0,
        };
        
        await Politician.create(payload);
        importedMobiles.add(mobile);
        successCount++;
      } catch (err) {
        console.error("Insert error:", err);
        errorCount++;
      }
    }
    
    setBulkProcessing(false);
    
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['politicians'] });
    
    // Reset bulk state
    setBulkFile(null);
    setBulkParsed(null);
    setBulkValidated(null);
    setBulkConflicts(null);
    setBulkDesignation(null);
    
    toast.success(`जोड़े गए: ${successCount}, छोड़े गए: ${skipCount}, त्रुटि: ${errorCount}`);
  };

  const onDelete = (row) => setDeleteTarget(row);

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">पार्टी के कार्यकर्ता / पदाधिकारी इंद्राज</h1>
          <p className="text-gray-600 mt-1">खोजें, जोड़ें, संपादित करें</p>
        </div>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">🎯 बल्क डेटा आयात (Excel)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>पद चुनें (आयात के लिए)</Label>
                <Select value={bulkDesignation ? String(bulkDesignation) : ""} onValueChange={(v) => setBulkDesignation(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder={types.length === 0 ? "पद लोड हो रहे हैं..." : "पद चुनें"} />
                  </SelectTrigger>
                  <SelectContent>
                    {types.length > 0 && types.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.Designation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button 
                  variant="outline" 
                  className="gap-2 w-full" 
                  onClick={() => generateSampleExcel(types.find(t => t.id === bulkDesignation)?.Designation || "template")} 
                  disabled={!bulkDesignation || types.length === 0}
                >
                  <Download className="w-4 h-4" /> नमूना डाउनलोड करें
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <Input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleBulkFileUpload} 
                  disabled={!bulkDesignation || bulkProcessing || types.length === 0} 
                />
              </div>
            </div>

            {bulkValidated && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">सारांश:</h3>
                  <div className="text-sm text-gray-600 space-x-4">
                    <span className="text-green-600">✅ मान्य: {bulkValidated.filter(r => r._errors.length === 0).length}</span>
                    <span className="text-red-600">❌ त्रुटि: {bulkValidated.filter(r => r._errors.length > 0).length}</span>
                    {bulkConflicts && <span className="text-orange-600">⚠️ डुप्लिकेट: {bulkConflicts.length}</span>}
                  </div>
                </div>

                {bulkConflicts && bulkConflicts.length > 0 && (
                  <div className="bg-orange-50 border border-orange-300 rounded p-4">
                    <div className="flex items-center gap-2 text-orange-700 font-semibold mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      डुप्लिकेट मोबाइल नंबर मिले:
                    </div>
                    <div className="text-sm text-orange-600 space-y-1">
                      {bulkConflicts.map((dup, idx) => (
                        <div key={idx}>{dup.Mobile} - {dup.Name}</div>
                      ))}
                    </div>
                    <p className="text-xs text-orange-600 mt-3">एक ही मोबाइल नंबर वाली रिकॉर्ड आयात नहीं होगी।</p>
                  </div>
                )}

                <div className="overflow-auto max-h-96 border rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="py-1 px-2 text-left">स्थिति</th>
                        <th className="py-1 px-2 text-left">नाम</th>
                        <th className="py-1 px-2 text-left">मोबाइल</th>
                        <th className="py-1 px-2 text-left">गाँव/नगर</th>
                        <th className="py-1 px-2 text-left">संदेश</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkValidated.map((row, idx) => {
                          const hasDuplicate = bulkConflicts?.some(d => normalizeMobile(d.Mobile) === normalizeMobile(row.Mobile));
                        const hasError = row._errors.length > 0;
                        const isOk = !hasError && !hasDuplicate;
                        
                        return (
                          <tr key={idx} className={`border-b ${hasError ? 'bg-red-50' : hasDuplicate ? 'bg-orange-50' : 'bg-green-50'}`}>
                            <td className="py-1 px-2 text-center">
                              {isOk ? <CheckCircle className="w-4 h-4 text-green-600" /> : hasError ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <AlertTriangle className="w-4 h-4 text-orange-600" />}
                            </td>
                            <td className="py-1 px-2">{row.Name}</td>
                            <td className="py-1 px-2">{row.Mobile}</td>
                            <td className="py-1 px-2">{row.Village_City}</td>
                            <td className="py-1 px-2 text-red-600">{row._errors.length > 0 ? row._errors.join(", ") : hasDuplicate ? "डुप्लिकेट (छोड़ा जाएगा)" : "OK"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 pt-3">
                  <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => confirmBulkImport(true)} disabled={bulkProcessing || bulkValidated.filter(r => r._errors.length === 0).length === 0}>
                    <Upload className="w-4 h-4" /> आयात करें (डुप्लिकेट छोड़ें)
                  </Button>
                  <Button variant="outline" onClick={() => { setBulkValidated(null); setBulkConflicts(null); setBulkFile(null); }}>रद्द करें</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">खोज</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex gap-3 items-center">
            <Input placeholder="नाम / मोबाइल / गाँव" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Button variant="outline" className="gap-2"><Search className="w-4 h-4" /> खोजें</Button>
            <Button className="gap-2 bg-gradient-to-r from-orange-500 to-red-500" onClick={() => { setEditingId(null); setFormData(initialForm); }}><Plus className="w-4 h-4" /> नया जोड़ें</Button>
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">विवरण</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>पदाधिकारी / कार्यकर्ता का नाम</Label>
                <Input value={formData.Name} onChange={(e) => handleChange('Name', e.target.value)} />
              </div>
              <div>
                <Label>पद तथा दायित्व</Label>
                <Select value={formData.Designation?.toString() || ''} onValueChange={(v) => handleChange('Designation', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="पद चुनें" /></SelectTrigger>
                  <SelectContent>
                    {types.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.Designation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>पता</Label>
                <Input value={formData.Address} onChange={(e) => handleChange('Address', e.target.value)} />
              </div>
              <div>
                <Label>क्षेत्र</Label>
                <div className="flex items-center gap-3">
                  <Checkbox id="area" checked={!!formData.Area} onCheckedChange={(v) => handleChange('Area', !!v)} />
                  <Label htmlFor="area">ग्रामीण</Label>
                </div>
              </div>
              <div>
                <Label>{formData.Area ? 'गाँव का नाम' : 'नगर का नाम'}</Label>
                <Input value={formData.Village_City} onChange={(e) => handleChange('Village_City', e.target.value)} />
              </div>
              <div>
                <Label>मण्‍डल</Label>
                <Select value={formData.Mandal?.toString() || ''} onValueChange={(v) => handleChange('Mandal', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="मण्‍डल चुनें" /></SelectTrigger>
                  <SelectContent>
                    {mandals.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>मोबाइल (10 अंक)</Label>
                <Input value={formData.Mobile} onChange={(e) => handleChange('Mobile', e.target.value)} />
              </div>
              <div>
                <Label>जन्म तारीख</Label>
                <Input type="date" value={formData.DOB} onChange={(e) => handleChange('DOB', e.target.value)} />
              </div>
              <div>
                <Label>विवाह वर्षगांठ</Label>
                <Input type="date" value={formData.DOA} onChange={(e) => handleChange('DOA', e.target.value)} />
              </div>
              <div>
                <Label>मतदान केंद्र क्रमांक</Label>
                <Input type="number" value={formData.Booth_No} onChange={(e) => handleChange('Booth_No', e.target.value)} />
              </div>
              <div>
                <Label>स्वचालित संदेश अनुमति</Label>
                <div className="flex items-center gap-3">
                  <Checkbox id="auto" checked={!!formData.AutoAllow} onCheckedChange={(v) => handleChange('AutoAllow', !!v)} />
                  <Label htmlFor="auto">हाँ</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                className="gap-2" 
                onClick={onSave}
                disabled={!formData.Name?.trim() || !formData.Designation || createMutation.isPending || updateMutation.isPending}
              >
                <Save className="w-4 h-4" /> सेव
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  className="gap-2 text-red-600 hover:text-red-700"
                  onClick={() => setDeleteTarget(people.find((person) => String(person.id) === String(editingId)) || { id: editingId, Name: formData.Name })}
                >
                  <Trash2 className="w-4 h-4" /> हटाएं
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">पद तथा दायित्व</CardTitle>
          </CardHeader>
          <CardContent className="p-6 overflow-auto">
            {selectedIds.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="font-medium text-gray-800 md:mr-auto">
                  {selectedIds.length} रिकॉर्ड चुने गए
                </p>
                <div className="w-full md:w-64">
                  <Label htmlFor="bulk-designation">चयनित रिकॉर्ड का पद बदलें</Label>
                  <Select value={selectedDesignation} onValueChange={setSelectedDesignation}>
                    <SelectTrigger id="bulk-designation">
                      <SelectValue placeholder="नया पद चुनें" />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.id} value={String(type.id)}>{type.Designation}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => bulkDesignationMutation.mutate({
                    ids: selectedIds,
                    designation: Number(selectedDesignation),
                  })}
                  disabled={!selectedDesignation || bulkDesignationMutation.isPending || bulkDeleteMutation.isPending}
                >
                  <Save className="w-4 h-4" /> पद सेव करें
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-red-600 hover:text-red-700"
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={bulkDesignationMutation.isPending || bulkDeleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" /> चयनित हटाएं
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                  disabled={bulkDesignationMutation.isPending || bulkDeleteMutation.isPending}
                >
                  चयन हटाएं
                </Button>
              </div>
            )}
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">लोड हो रहा है...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">कोई रिकॉर्ड नहीं</p>
            ) : selectedDesignationFilter === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {designationCounts.map((type) => (
                  <Button
                    key={type.id}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-16 justify-between whitespace-normal p-4 text-left"
                    onClick={() => setSelectedDesignationFilter(String(type.id))}
                    disabled={type.count === 0}
                  >
                    <span className="font-semibold text-gray-800">{type.Designation}</span>
                    <span className="ml-3 rounded-full bg-orange-100 px-3 py-1 text-base font-bold text-orange-700">{type.count}</span>
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-16 justify-between whitespace-normal border-orange-300 bg-orange-50 p-4 text-left"
                  onClick={() => setSelectedDesignationFilter("all")}
                >
                  <span className="font-semibold text-gray-900">सभी पदाधिकारी</span>
                  <span className="ml-3 rounded-full bg-orange-200 px-3 py-1 text-base font-bold text-orange-800">{filtered.length}</span>
                </Button>
              </div>
            ) : (
              <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setSelectedDesignationFilter(null)}>
                  ← पद सूची पर वापस जाएं
                </Button>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedDesignationName} ({listedPeople.length})
                </h3>
              </div>
              {listedPeople.length === 0 ? (
                <p className="text-center text-gray-500 py-8">कोई रिकॉर्ड नहीं</p>
              ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 px-2">
                      <Checkbox
                        aria-label="दिखाए गए सभी रिकॉर्ड चुनें"
                        checked={listedPeople.length > 0 && listedPeople.every((row) => selectedIds.includes(row.id))}
                        onCheckedChange={(checked) => {
                          const visibleIds = listedPeople.map((row) => row.id);
                          setSelectedIds((current) => checked
                            ? [...new Set([...current, ...visibleIds])]
                            : current.filter((id) => !visibleIds.includes(id)));
                        }}
                      />
                    </th>
                    <th className="py-2 px-2">ID</th>
                    <th className="py-2 px-2">नाम</th>
                    <th className="py-2 px-2">मोबाइल</th>
                    <th className="py-2 px-2">पद</th>
                    <th className="py-2 px-2">क्षेत्र</th>
                    <th className="py-2 px-2">गाँव/नगर</th>
                    <th className="py-2 px-2">क्रिया</th>
                  </tr>
                </thead>
                <tbody>
                  {listedPeople.map(row => (
                    <tr key={row.id} className="border-b hover:bg-orange-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          aria-label={`${row.Name || "रिकॉर्ड"} चुनें`}
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(checked) => setSelectedIds((current) => checked
                            ? [...new Set([...current, row.id])]
                            : current.filter((id) => id !== row.id))}
                        />
                      </td>
                      <td className="py-2 px-2">{row.id}</td>
                      <td className="py-2 px-2">{row.Name}</td>
                      <td className="py-2 px-2">{row.Mobile}</td>
                      <td className="py-2 px-2">{(types.find(t => t.id === row.Designation)?.Designation) || row.Designation}</td>
                      <td className="py-2 px-2">{row.Area ? 'ग्रामीण' : 'नगरीय'}</td>
                      <td className="py-2 px-2">{row.Village_City}</td>
                      <td className="py-2 px-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => onEdit(row)}>संपादित</Button>
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`${row.Name || "रिकॉर्ड"} हटाएं`}
                            className="text-red-600 hover:text-red-700"
                            onClick={() => onDelete(row)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>चयनित रिकॉर्ड हटाएं?</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedIds.length} चयनित रिकॉर्ड स्थायी रूप से हट जाएंगे। इस कार्रवाई को वापस नहीं किया जा सकता।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>रद्द करें</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              >
                हटाएं
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>रिकॉर्ड हटाएं?</AlertDialogTitle>
              <AlertDialogDescription>
                क्या आप &quot;{deleteTarget?.Name}&quot; का रिकॉर्ड हटाना चाहते हैं? यह कार्रवाई पूर्ववत नहीं की जा सकती।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>रद्द करें</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                हटाएं
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
