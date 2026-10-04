import React, { useState, useRef } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Upload, Plus, Trash2, Save, X, Edit, Download, FileSpreadsheet, CheckCircle, AlertCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const FIELD_MAPPING = {
  "Sn": "निमंत्रण संख्या",
  "Date": "तारीख",
  "SenderName": "प्रेषक का नाम",
  "Street": "मोहल्ला",
  "Village": "गाँव",
  "District": "जिला",
  "Mob": "मोबाइल",
  "programtyp": "कार्यक्रम प्रकार",
  "place_time": "स्थान और समय",
  "event_time": "कार्यक्रम समय",
  "LocalProgram": "स्थानीय कार्यक्रम",
  "Joint": "संयुक्त",
  "bulk": "बल्क",
  "ProgramFor": "कार्यक्रम किसके लिए",
  "Relation_to_sender": "संबंध",
  "detail": "विवरण",
  "Attended": "उपस्थित",
  "sended": "पत्र भेजा",
  "prafull": "प्रफुल्ल",
};

const IMPORT_SCHEMA = {
  type: "object",
  properties: {
    Sn: { type: "integer" },
    Date: { type: "string" },
    SenderName: { type: "string" },
    Street: { type: "string" },
    Village: { type: "string" },
    District: { type: "string" },
    Mob: { type: "string" },
    programtyp: { type: "string" },
    place_time: { type: "string" },
    event_time: { type: "string" },
    LocalProgram: { type: "string" },
    Joint: { type: "boolean" },
    bulk: { type: "boolean" },
    ProgramFor: { type: "string" },
    Relation_to_sender: { type: "string" },
    detail: { type: "string" },
    Attended: { type: "boolean" },
    sended: { type: "boolean" },
    prafull: { type: "boolean" },
  }
};

export default function DatabaseViewer() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [newRow, setNewRow] = useState(null);
  
  // Import states
  const [step, setStep] = useState(1);
  const [extractedData, setExtractedData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [updateMode, setUpdateMode] = useState("append");
  const [uploading, setUploading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  
  // SQL states
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResults, setSqlResults] = useState(null);
  const [sqlExecuting, setSqlExecuting] = useState(false);
  
  // Show records toggle
  const [showRecords, setShowRecords] = useState(false);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => restClient.listEntities('Pragram'),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => restClient.createEntity('Pragram', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success("Record created");
      setNewRow(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => restClient.updateEntity('Pragram', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success("Record updated");
      setEditingRow(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => restClient.deleteEntity('Pragram', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success("Record deleted");
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExt)) {
      toast.error("केवल CSV या Excel फ़ाइलें समर्थित हैं");
      return;
    }

    setUploading(true);
    toast.info("फ़ाइल पढ़ी जा रही है...");
    
    try {
      let data = [];
      
      if (fileExt === '.csv') {
        // Parse CSV file
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error("फ़ाइल में कम से कम हेडर और एक डेटा रो होनी चाहिए");
          setUploading(false);
          return;
        }
        
        // Remove BOM if present
        lines[0] = lines[0].replace(/^\uFEFF/, '');
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
      } else {
        // For Excel files, import XLSX library dynamically
        toast.info("Excel फ़ाइल पार्स हो रही है...");
        
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(firstSheet);
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        toast.error("फ़ाइल से कोई डेटा नहीं मिला");
        setUploading(false);
        return;
      }
      
      // Convert boolean strings to actual booleans
      data = data.map(row => {
        const newRow = { ...row };
        ['Joint', 'bulk', 'Attended', 'sended', 'prafull'].forEach(field => {
          if (newRow[field]) {
            const val = String(newRow[field]).toUpperCase();
            newRow[field] = val === 'TRUE' || val === '1' || val === 'YES';
          }
        });
        return newRow;
      });
      
      const cleanedData = data.filter(row => row && (row.SenderName || row.Mob));
      
      if (cleanedData.length === 0) {
        toast.error("फ़ाइल में मान्य डेटा नहीं मिला (SenderName या Mob होना चाहिए)");
        setUploading(false);
        return;
      }
      
      setExtractedData(cleanedData);
      setStep(2);
      toast.success(`${cleanedData.length} रिकॉर्ड निकाले गए`);
    } catch (error) {
      toast.error("फ़ाइल प्रोसेस करने में त्रुटि: " + (error?.message || "कृपया फ़ाइल फॉर्मेट चेक करें"));
      console.error("Import error:", error);
    } finally {
      setUploading(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
      const results = { success: 0, failed: 0, skipped: 0, errors: [], successDetails: [] };
      setImportProgress({ current: 0, total: records.length });
      
      const programTypes = await restClient.listEntities('ProgramType');
      const programTypeMap = {};
      programTypes.forEach(pt => {
        const name = pt.data?.Programtyp || pt.Programtyp;
        programTypeMap[name] = pt.id;
      });
      
  const existingPrograms = await restClient.listEntities('Pragram');
      const existingSnSet = new Set(existingPrograms.map(p => p.Sn).filter(Boolean));
      const existingBySnMap = new Map(existingPrograms.map(p => [p.Sn, p]));
      
      const recordsToCreate = [];
      const recordsToUpdate = [];
      
      for (const record of records) {
        try {
          if (record.Joint !== undefined) record.Joint = record.Joint === true || record.Joint === 'TRUE' || record.Joint === '1';
          if (record.bulk !== undefined) record.bulk = record.bulk === true || record.bulk === 'TRUE' || record.bulk === '1';
          if (record.Attended !== undefined) record.Attended = record.Attended === true || record.Attended === 'TRUE' || record.Attended === '1';
          if (record.sended !== undefined) record.sended = record.sended === true || record.sended === 'TRUE' || record.sended === '1';
          if (record.prafull !== undefined) record.prafull = record.prafull === true || record.prafull === 'TRUE' || record.prafull === '1';
          
          if (record.programtyp && typeof record.programtyp === 'string') {
            const foundId = programTypeMap[record.programtyp];
            if (foundId) {
              record.programtyp = foundId;
            } else {
              const newType = await restClient.createEntity('ProgramType', { Programtyp: record.programtyp });
              programTypeMap[record.programtyp] = newType.id || newType?.data?.id;
              record.programtyp = newType.id || newType?.data?.id;
            }
          }
          
          if (record.Sn && existingSnSet.has(record.Sn)) {
            if (updateMode === "update") {
              const existing = existingBySnMap.get(record.Sn);
              if (existing) {
                recordsToUpdate.push({ id: existing.id, data: record, sn: record.Sn, name: record.SenderName });
              }
            } else {
              results.skipped++;
              results.errors.push(`Sn ${record.Sn} (${record.SenderName || 'नाम नहीं'}) - पहले से मौजूद है`);
            }
          } else {
            recordsToCreate.push(record);
            existingSnSet.add(record.Sn);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Sn ${record.Sn || 'N/A'} (${record.SenderName || 'नाम नहीं'}): ${error.message}`);
        }
      }
      
      const BATCH_SIZE = 50;
      for (let i = 0; i < recordsToCreate.length; i += BATCH_SIZE) {
        const batch = recordsToCreate.slice(i, i + BATCH_SIZE);
        try {
          // Try creating records sequentially (bulkCreate may not be supported on REST client)
          for (const record of batch) {
            await restClient.createEntity('Pragram', record);
            results.success++;
            results.successDetails.push(`Sn ${record.Sn} (${record.SenderName || 'नाम नहीं'}) - नया जोड़ा गया`);
          }
          setImportProgress({ current: Math.min(i + BATCH_SIZE, records.length), total: records.length });
        } catch (error) {
          for (const record of batch) {
            try {
              await restClient.createEntity('Pragram', record);
              results.success++;
              results.successDetails.push(`Sn ${record.Sn} (${record.SenderName || 'नाम नहीं'}) - नया जोड़ा गया`);
            } catch (err) {
              results.failed++;
              results.errors.push(`Sn ${record.Sn || 'N/A'} (${record.SenderName || 'नाम नहीं'}): ${err.message}`);
            }
          }
          setImportProgress({ current: Math.min(i + BATCH_SIZE, records.length), total: records.length });
        }
      }
      
      for (let i = 0; i < recordsToUpdate.length; i++) {
        const { id, data, sn, name } = recordsToUpdate[i];
        try {
          await restClient.updateEntity('Pragram', id, data);
          results.success++;
          results.successDetails.push(`Sn ${sn} (${name || 'नाम नहीं'}) - अपडेट किया गया`);
        } catch (error) {
          results.failed++;
          results.errors.push(`Sn ${sn || 'N/A'} (${name || 'नाम नहीं'}): ${error.message}`);
        }
        setImportProgress({ current: recordsToCreate.length + i + 1, total: records.length });
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['program-types'] });
      setImportResults(results);
      setStep(4);
      toast.success(`${results.success} रिकॉर्ड सफलतापूर्वक इम्पोर्ट हुए`);
    },
  });

  const handleImport = () => {
    if (!extractedData || extractedData.length === 0) {
      toast.error("कोई डेटा नहीं मिला");
      return;
    }
    setStep(3);
    importMutation.mutate(extractedData);
  };

  const handleReset = () => {
    setStep(1);
    setExtractedData(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSample = () => {
    const sampleCSV = '\uFEFF' + `Sn,Date,SenderName,Street,Village,District,Mob,programtyp,place_time,event_time,LocalProgram,Joint,bulk,ProgramFor,Relation_to_sender,detail,Attended,sended,prafull
6001,2025-01-15,राम कुमार शर्मा,गांधी नगर,धार,धार,9876543210,विवाह,दोपहर 12 बजे,14:30:00,स्थानीय कार्यक्रम,FALSE,FALSE,पुत्र राहुल,पुत्र,कोई अन्य जानकारी,FALSE,FALSE,FALSE
6002,2025-01-20,सीता देवी,नेहरू कॉलोनी,मानपुर,धार,9876543211,मुंडन,सुबह 10 बजे,10:00:00,,FALSE,FALSE,पुत्र आर्यन,पुत्र,,FALSE,FALSE,FALSE`;
    
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-import.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success("नमूना फ़ाइल डाउनलोड हो गई");
  };

  const handleEdit = (program) => {
    setEditingRow(program.id);
    setEditData(program);
  };

  const handleSave = () => {
    updateMutation.mutate({ id: editingRow, data: editData });
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this record?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setNewRow({
      Sn: programs.length > 0 ? Math.max(...programs.map(p => p.Sn || 0)) + 1 : 1,
      Date: "",
      SenderName: "",
      Village: "",
      District: "",
      Mob: "",
      programtyp: ""
    });
    setShowRecords(true);
  };

  const handleCreateNew = () => {
    createMutation.mutate(newRow);
  };

  const exportToCSV = () => {
    const headers = ["Sn", "Date", "SenderName", "Street", "Village", "District", "Mob", "programtyp", "place_time", "event_time", "ProgramFor", "Relation_to_sender"];
    const csvContent = [
      headers.join(","),
      ...programs.map(p => headers.map(h => `"${p[h] || ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "database_export.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const executeSQL = async () => {
    if (!sqlQuery.trim()) {
      toast.error("Please enter a SQL query");
      return;
    }

    setSqlExecuting(true);
    try {
      const query = sqlQuery.trim().toUpperCase();
      
      // SELECT queries
      if (query.startsWith("SELECT")) {
        const whereMatch = sqlQuery.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
        const limitMatch = sqlQuery.match(/LIMIT\s+(\d+)/i);
        
        let filteredData = [...programs];
        
        if (whereMatch) {
          const condition = whereMatch[1].trim();
          filteredData = programs.filter(p => {
            try {
              const evalCondition = condition
                .replace(/(\w+)\s*=\s*'([^']*)'/g, (_, field, value) => `p.${field} === '${value}'`)
                .replace(/(\w+)\s*=\s*(\d+)/g, (_, field, value) => `p.${field} == ${value}`)
                .replace(/(\w+)\s*>\s*(\d+)/g, (_, field, value) => `p.${field} > ${value}`)
                .replace(/(\w+)\s*<\s*(\d+)/g, (_, field, value) => `p.${field} < ${value}`)
                .replace(/AND/gi, '&&')
                .replace(/OR/gi, '||');
              return eval(evalCondition);
            } catch {
              return true;
            }
          });
        }
        
        if (limitMatch) {
          filteredData = filteredData.slice(0, parseInt(limitMatch[1]));
        }
        
        setSqlResults({ type: 'SELECT', data: filteredData, count: filteredData.length });
        toast.success(`Query executed: ${filteredData.length} rows returned`);
      }
      
      // UPDATE queries
      else if (query.startsWith("UPDATE")) {
        const setMatch = sqlQuery.match(/SET\s+(.+?)(?:WHERE|$)/i);
        const whereMatch = sqlQuery.match(/WHERE\s+(.+?)$/i);
        
        if (!setMatch) {
          toast.error("Invalid UPDATE syntax. Use: UPDATE Pragram SET field='value' WHERE condition");
          setSqlExecuting(false);
          return;
        }
        
        const updates = {};
        const setPairs = setMatch[1].split(',');
        setPairs.forEach(pair => {
          const [field, value] = pair.split('=').map(s => s.trim());
          updates[field] = value.replace(/'/g, '');
        });
        
        let recordsToUpdate = programs;
        if (whereMatch) {
          const condition = whereMatch[1].trim();
          recordsToUpdate = programs.filter(p => {
            try {
              const evalCondition = condition
                .replace(/(\w+)\s*=\s*'([^']*)'/g, (_, field, value) => `p.${field} === '${value}'`)
                .replace(/(\w+)\s*=\s*(\d+)/g, (_, field, value) => `p.${field} == ${value}`);
              return eval(evalCondition);
            } catch {
              return false;
            }
          });
        }
        
        let updateCount = 0;
        for (const record of recordsToUpdate) {
          await restClient.updateEntity('Pragram', record.id, updates);
          updateCount++;
        }
        
        queryClient.invalidateQueries({ queryKey: ['programs'] });
        setSqlResults({ type: 'UPDATE', count: updateCount });
        toast.success(`${updateCount} rows updated`);
      }
      
      // DELETE queries
      else if (query.startsWith("DELETE")) {
        const whereMatch = sqlQuery.match(/WHERE\s+(.+?)$/i);
        
        if (!whereMatch) {
          toast.error("DELETE requires WHERE clause for safety");
          setSqlExecuting(false);
          return;
        }
        
        const condition = whereMatch[1].trim();
        const recordsToDelete = programs.filter(p => {
          try {
            const evalCondition = condition
              .replace(/(\w+)\s*=\s*'([^']*)'/g, (_, field, value) => `p.${field} === '${value}'`)
              .replace(/(\w+)\s*=\s*(\d+)/g, (_, field, value) => `p.${field} == ${value}`);
            return eval(evalCondition);
          } catch {
            return false;
          }
        });
        
        let deleteCount = 0;
        for (const record of recordsToDelete) {
          await restClient.deleteEntity('Pragram', record.id);
          deleteCount++;
        }
        
        queryClient.invalidateQueries({ queryKey: ['programs'] });
        setSqlResults({ type: 'DELETE', count: deleteCount });
        toast.success(`${deleteCount} rows deleted`);
      }
      
      // INSERT queries
      else if (query.startsWith("INSERT")) {
        const valuesMatch = sqlQuery.match(/VALUES\s*\((.+?)\)/i);
        
        if (!valuesMatch) {
          toast.error("Invalid INSERT syntax");
          setSqlExecuting(false);
          return;
        }
        
        const values = valuesMatch[1].split(',').map(v => v.trim().replace(/'/g, ''));
        const fieldsMatch = sqlQuery.match(/\((.+?)\)\s*VALUES/i);
        
        if (!fieldsMatch) {
          toast.error("Please specify column names");
          setSqlExecuting(false);
          return;
        }
        
        const fields = fieldsMatch[1].split(',').map(f => f.trim());
        const newRecord = {};
        fields.forEach((field, i) => {
          newRecord[field] = values[i];
        });
        
  await restClient.createEntity('Pragram', newRecord);
        queryClient.invalidateQueries({ queryKey: ['programs'] });
        setSqlResults({ type: 'INSERT', count: 1 });
        toast.success("1 row inserted");
      }
      
      else {
        toast.error("Unsupported query. Use SELECT, UPDATE, DELETE, or INSERT");
      }
    } catch (error) {
      toast.error("Query error: " + error.message);
      console.error("SQL Error:", error);
    } finally {
      setSqlExecuting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Database className="w-8 h-8" />
              Database Viewer
            </h1>
            <p className="text-gray-600 mt-1">Upload, view, and modify database records</p>
          </div>
          <Button variant="outline" onClick={downloadSample} className="gap-2">
            <Download className="w-4 h-4" />
            नमूना फ़ाइल
          </Button>
        </div>

        {/* Import Section */}
        {step === 1 && (
          <Card className="border-orange-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <CardTitle className="text-xl font-bold text-gray-900">
                Import Data from CSV/Excel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-orange-300 rounded-lg p-12 text-center cursor-pointer hover:bg-orange-50 transition-colors ${uploading ? 'opacity-50' : ''}`}
              >
                <FileSpreadsheet className="w-16 h-16 mx-auto text-orange-400 mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  {uploading ? "अपलोड और प्रोसेस हो रहा है..." : "CSV या Excel फ़ाइल अपलोड करें"}
                </p>
                <p className="text-sm text-gray-500">
                  समर्थित: .csv, .xls, .xlsx
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-blue-900 mb-2">नोट:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>फ़ाइल में पहली रो हेडर होनी चाहिए</li>
                  <li>तारीख: YYYY-MM-DD या DD-MM-YYYY</li>
                  <li>मोबाइल: 10 अंक</li>
                  <li>MS Access: पहले Excel में एक्सपोर्ट करें</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && extractedData && (
          <Card className="border-orange-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <CardTitle className="text-xl font-bold text-gray-900">
                डेटा प्रीव्यू और इम्पोर्ट
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>इम्पोर्ट मोड</Label>
                <Select value={updateMode} onValueChange={setUpdateMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">केवल नए जोड़ें</SelectItem>
                    <SelectItem value="update">मौजूदा अपडेट करें (Sn से)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">प्रीव्यू (पहले 5 रिकॉर्ड)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {Object.keys(FIELD_MAPPING).map(key => (
                          <th key={key} className="p-2 text-left">{FIELD_MAPPING[key]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b">
                          {Object.keys(FIELD_MAPPING).map(key => (
                            <td key={key} className="p-2">{row[key] || "-"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleReset}>
                  रद्द करें
                </Button>
                <Button
                  onClick={handleImport}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
                >
                  <Upload className="w-4 h-4" />
                  इम्पोर्ट शुरू करें ({extractedData.length} रिकॉर्ड)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-orange-100 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-xl font-semibold text-gray-900">इम्पोर्ट हो रहा है...</p>
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div 
                    className="bg-orange-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  {importProgress.current} / {importProgress.total} रिकॉर्ड प्रोसेस हो रहे हैं
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  कृपया प्रतीक्षा करें, यह कुछ मिनट ले सकता है...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && importResults && (
          <Card className="border-green-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <CardTitle className="text-xl font-bold text-gray-900">
                इम्पोर्ट पूर्ण
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-2" />
                    <p className="text-3xl font-bold text-green-900">{importResults.success}</p>
                    <p className="text-sm text-green-700">सफल</p>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-yellow-600 mb-2" />
                    <p className="text-3xl font-bold text-yellow-900">{importResults.skipped || 0}</p>
                    <p className="text-sm text-yellow-700">छोड़े गए (पहले से मौजूद)</p>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-red-600 mb-2" />
                    <p className="text-3xl font-bold text-red-900">{importResults.failed}</p>
                    <p className="text-sm text-red-700">विफल</p>
                  </CardContent>
                </Card>
              </div>

              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-semibold text-red-900 mb-3">त्रुटियाँ और छोड़े गए रिकॉर्ड ({importResults.errors.length}):</h4>
                  <ul className="text-xs text-red-800 space-y-1">
                    {importResults.errors.map((error, i) => (
                      <li key={i} className="border-b border-red-200 pb-1 mb-1">{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importResults.successDetails && importResults.successDetails.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-semibold text-green-900 mb-3">सफल रिकॉर्ड ({importResults.successDetails.length}):</h4>
                  <ul className="text-xs text-green-800 space-y-1">
                    {importResults.successDetails.slice(0, 50).map((detail, i) => (
                      <li key={i} className="border-b border-green-200 pb-1 mb-1">{detail}</li>
                    ))}
                    {importResults.successDetails.length > 50 && (
                      <li className="text-green-600 font-semibold">...और {importResults.successDetails.length - 50} रिकॉर्ड</li>
                    )}
                  </ul>
                </div>
              )}

              <Button onClick={handleReset} className="w-full">
                नया इम्पोर्ट
              </Button>
            </CardContent>
          </Card>
        )}

        {/* SQL Query Section */}
        {step === 1 && (
          <Card className="border-blue-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <CardTitle className="text-xl font-bold text-gray-900">
                SQL Query Console
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>SQL Query</Label>
                <Textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder={`Enter SQL query... 
Examples:
SELECT * FROM Pragram WHERE Village='धार'
SELECT * FROM Pragram WHERE Sn > 5000 LIMIT 10
UPDATE Pragram SET Attended=true WHERE Sn=6001
DELETE FROM Pragram WHERE Sn=6001
INSERT INTO Pragram (Sn, SenderName, Village) VALUES (7000, 'Test', 'Dhar')`}
                  className="font-mono text-sm h-32"
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Supported: SELECT, UPDATE, DELETE, INSERT with WHERE, LIMIT
                </p>
                <Button 
                  onClick={executeSQL} 
                  disabled={sqlExecuting}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="w-4 h-4" />
                  {sqlExecuting ? "Executing..." : "Execute Query"}
                </Button>
              </div>

              {sqlResults && (
                <div className="mt-4">
                  {sqlResults.type === 'SELECT' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Badge className="bg-green-100 text-green-800">
                          {sqlResults.count} rows returned
                        </Badge>
                      </div>
                      <div className="overflow-x-auto max-h-96 border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Sn</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>SenderName</TableHead>
                              <TableHead>Village</TableHead>
                              <TableHead>District</TableHead>
                              <TableHead>Mob</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sqlResults.data.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>{row.Sn}</TableCell>
                                <TableCell>{row.Date}</TableCell>
                                <TableCell>{row.SenderName}</TableCell>
                                <TableCell>{row.Village}</TableCell>
                                <TableCell>{row.District}</TableCell>
                                <TableCell>{row.Mob}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  {(sqlResults.type === 'UPDATE' || sqlResults.type === 'DELETE' || sqlResults.type === 'INSERT') && (
                    <Badge className="bg-blue-100 text-blue-800">
                      {sqlResults.type}: {sqlResults.count} row(s) affected
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Database Table View */}
        {step === 1 && (
          <Card className="border-orange-100">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Database Records ({programs.length})</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowRecords(!showRecords)} 
                    variant={showRecords ? "default" : "outline"} 
                    size="sm" 
                    className="gap-2"
                  >
                    <Database className="w-4 h-4" />
                    {showRecords ? "रिकॉर्ड छुपाएं" : "रिकॉर्ड दिखाएं"}
                  </Button>
                  <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                  <Button onClick={handleAddNew} size="sm" className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                    <Plus className="w-4 h-4" />
                    Add New
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showRecords && (
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sn</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Sender Name</TableHead>
                        <TableHead>Village</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Program Type</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newRow && (
                        <TableRow className="bg-green-50">
                          <TableCell>
                            <Input
                              type="number"
                              value={newRow.Sn}
                              onChange={(e) => setNewRow({ ...newRow, Sn: parseInt(e.target.value) })}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={newRow.Date}
                              onChange={(e) => setNewRow({ ...newRow, Date: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={newRow.SenderName}
                              onChange={(e) => setNewRow({ ...newRow, SenderName: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={newRow.Village}
                              onChange={(e) => setNewRow({ ...newRow, Village: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={newRow.District}
                              onChange={(e) => setNewRow({ ...newRow, District: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={newRow.Mob}
                              onChange={(e) => setNewRow({ ...newRow, Mob: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={newRow.programtyp}
                              onChange={(e) => setNewRow({ ...newRow, programtyp: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" onClick={handleCreateNew} disabled={createMutation.isPending}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setNewRow(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {programs.map((program) => (
                        <TableRow key={program.id}>
                          {editingRow === program.id ? (
                            <>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={editData.Sn}
                                  onChange={(e) => setEditData({ ...editData, Sn: parseInt(e.target.value) })}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={editData.Date}
                                  onChange={(e) => setEditData({ ...editData, Date: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editData.SenderName}
                                  onChange={(e) => setEditData({ ...editData, SenderName: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editData.Village}
                                  onChange={(e) => setEditData({ ...editData, Village: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editData.District}
                                  onChange={(e) => setEditData({ ...editData, District: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editData.Mob}
                                  onChange={(e) => setEditData({ ...editData, Mob: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editData.programtyp}
                                  onChange={(e) => setEditData({ ...editData, programtyp: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                                    <Save className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingRow(null)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{program.Sn}</TableCell>
                              <TableCell>{program.Date}</TableCell>
                              <TableCell>{program.SenderName}</TableCell>
                              <TableCell>{program.Village}</TableCell>
                              <TableCell>{program.District}</TableCell>
                              <TableCell>{program.Mob}</TableCell>
                              <TableCell>{program.programtyp}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => handleEdit(program)}>
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleDelete(program.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}