import React, { useState, useMemo } from "react";
import restClient from "@/api/restClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ProgramForm from "../components/forms/ProgramForm";
import { useProgramTypesMap } from "../components/ProgramDisplay";

export default function DataEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [searchSn, setSearchSn] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedSn, setSavedSn] = useState(null);
  const programTypesMap = useProgramTypesMap();

  // Always load programs list for search functionality
  const { data: existingPrograms = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => restClient.listEntities('Pragram'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    enabled: true, // Always enabled for search functionality
  });

  // Get highest Sn number for auto-increment
  const { data: highestSn } = useQuery({
    queryKey: ['highest-sn'],
    queryFn: async () => {
      const results = await restClient.listEntities('Pragram');
      if (!results || results.length === 0) return 6000;
      // Find the maximum Sn from all records
      const maxSn = Math.max(...results.map(p => p.Sn || 0));
      return maxSn;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always',
  });

  const normalizeRecord = (record) => {
    if (!record) return record;
    // Unwrap nested responses
    if (record.data && record.data.data) return normalizeRecord(record.data.data);
    if (record.data) return normalizeRecord(record.data);
    if (record.result) return normalizeRecord(record.result);

    // Ensure record has required fields
    if (!record.id && !record.Sn) {
      console.warn('Record missing id and Sn:', record);
    }

    return record;
  };

  const { data: editProgramRaw, isLoading: editLoading, error: editError } = useQuery({
    queryKey: ['program', editId],
    queryFn: async () => {
      console.log('Fetching program with ID:', editId);
      const result = await restClient.getEntity('Pragram', editId);
      console.log('Fetched program:', result);
      return result;
    },
    enabled: !!editId && editId !== 'null' && editId !== 'undefined',
    // First try to use pre-cached data from handleSelectProgram, then fall back to list
    initialData: () => {
      if (!editId) return undefined;
      
      // Check if data was pre-cached in handleSelectProgram
      const preCache = queryClient.getQueryData(['program', String(editId)]);
      if (preCache) {
        console.log('Using pre-cached data:', preCache);
        return preCache;
      }
      
      // Fall back to searching in the programs list
      const cached = queryClient.getQueryData(['programs']);
      if (cached && Array.isArray(cached)) {
        const found = cached.find(p => String(p.id) === String(editId) || String(p.Sn) === String(editId));
        if (found) {
          console.log('Using data from programs list:', found);
          return found;
        }
      }
      
      return undefined;
    },
    select: (data) => normalizeRecord(data),
    retry: 2,
    retryDelay: 1000,
  });

  const editProgram = editProgramRaw;
  
  // Show error if edit query failed
  React.useEffect(() => {
    if (editError && editId) {
      console.error('Failed to load program:', editError);
      toast.error("प्रोग्राम लोड करने में विफल: " + editError.message);
    }
  }, [editError, editId]);

  const nextSn = highestSn ? highestSn + 1 : 6001;

  const createProgramMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Creating program with data:', data);
      const result = await restClient.createEntity('Pragram', data);
      console.log('Create result:', result);
      return result;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['highest-sn'] });
      // Get the Sn number from the submitted data
      const snNumber = variables.Sn;
      setSavedSn(snNumber);
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      console.error('Create error:', error);
      toast.error("त्रुटि: निमंत्रण जोड़ने में विफल - " + (error.message || 'अज्ञात त्रुटि'));
    },
  });

  const updateProgramMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('Updating program with ID:', id, 'Data:', data);
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid ID for update');
      }
      const result = await restClient.updateEntity('Pragram', id, data);
      console.log('Update result:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['program', editId] });
      toast.success("निमंत्रण सफलतापूर्वक अपडेट किया गया!");
      // Stay on the same page to continue editing
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error("त्रुटि: निमंत्रण अपडेट करने में विफल - " + (error.message || 'अज्ञात त्रुटि'));
    },
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (id) => {
      console.log('Deleting program with ID:', id, 'Type:', typeof id);
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid ID for deletion');
      }
      return restClient.deleteEntity('Pragram', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['highest-sn'] });
      toast.success("निमंत्रण सफलतापूर्वक डिलीट किया गया!");
      // Force redirect to dashboard by replacing current history entry
      window.location.href = createPageUrl("Dashboard");
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error("त्रुटि: निमंत्रण डिलीट करने में विफल - " + (error.message || 'अज्ञात त्रुटि'));
    },
  });

  const handleSubmit = (formData) => {
    console.log('=== HANDLESUBMIT START ===');
    console.log('editId:', editId, 'typeof:', typeof editId, 'isBoolean?:', editId === true || editId === false);
    console.log('editProgram:', editProgram, 'typeof:', typeof editProgram);
    console.log('editProgram?.id:', editProgram?.id, 'typeof:', typeof editProgram?.id);
    console.log('editProgram?.Sn:', editProgram?.Sn, 'typeof:', typeof editProgram?.Sn);
    console.log('formData?.Sn:', formData?.Sn, 'typeof:', typeof formData?.Sn);
    console.log('formData?.id:', formData?.id, 'typeof:', typeof formData?.id);
    
    // Clean up empty string fields that should be null/empty in DB
    const cleanData = { ...formData };
    
    // Remove 'id' from submission if present (let backend manage IDs)
    delete cleanData.id;
    
    // Ensure booleans are actual booleans
    ['Joint', 'bulk', 'Attended', 'sended', 'prafull'].forEach(field => {
      if (typeof cleanData[field] !== 'boolean') {
        cleanData[field] = cleanData[field] === true || cleanData[field] === 'true' || cleanData[field] === '1';
      }
    });
    
    console.log('Submitting data:', cleanData);
    
    // Determine if we're in edit or create mode
    const isEditMode = editId && editId !== 'null' && editId !== 'undefined' && editId !== false;
    console.log('isEditMode:', isEditMode, 'explicit check:', !!(editId && editId !== 'null' && editId !== 'undefined' && editId !== false));
    
    if (isEditMode) {
      // Use Sn from the form as the ID (since our DB uses Sn as identifier)
      const targetId = formData?.Sn || editProgram?.Sn || editProgram?.id || editId;
      console.log('Update mode: targetId =', targetId, 'from (Sn || editProgram.Sn || editProgram.id || editId)');
      console.log('ID sources: formData.Sn=', formData?.Sn, ' | editProgram.Sn=', editProgram?.Sn, ' | editProgram.id=', editProgram?.id, ' | editId=', editId);
      
      if (!targetId || targetId === 'false' || targetId === false) {
        console.error('CRITICAL: targetId is falsy or "false":', targetId);
        toast.error("त्रुटि: अपडेट के लिए ID नहीं मिल सका");
        return;
      }
      console.log('Calling updateProgramMutation with id:', targetId);
      updateProgramMutation.mutate({ id: targetId, data: cleanData });
    } else {
      console.log('Create mode: editId check failed - editId=', editId, 'creating new program');
      createProgramMutation.mutate(cleanData);
    }
  };

  const handleCancel = () => {
    navigate(createPageUrl("Dashboard"));
  };

  const handleNewEntry = () => {
    setSearchSn("");
    navigate(createPageUrl("DataEntry"), { replace: true });
  };

  const handleDialogOk = () => {
    setShowSuccessDialog(false);
    setSavedSn(null);
    // Navigate to new entry page (without edit parameter) to start fresh
    navigate(createPageUrl("DataEntry"), { replace: true });
  };

  const handleDelete = () => {
    console.log('handleDelete called with editProgram:', editProgram);
    
    if (!editProgram) {
      toast.error("त्रुटि: प्रोग्राम डेटा नहीं मिला");
      return;
    }

    const targetId = editProgram.id || editProgram.Sn;
    if (!targetId) {
      toast.error("त्रुटि: प्रोग्राम ID नहीं मिला");
      return;
    }
    
    if (window.confirm("क्या आप वाकई इस निमंत्रण को डिलीट करना चाहते हैं?")) {
      deleteProgramMutation.mutate(targetId);
    }
  };

  // Search results
  const searchResults = useMemo(() => {
    const searchTerm = searchSn.trim();
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const searchLower = searchTerm.toLowerCase();
    const searchNumber = searchTerm.replace(/\D/g, ''); // Extract only digits
    
    // Detect numeric vs text search and decide target field
    const isNumericSearch = searchNumber === searchTerm;
    const isMobileSearch = isNumericSearch && searchNumber.length >= 9; // 9-10 digit mobile
    const isSnSearch = isNumericSearch && !isMobileSearch; // shorter numeric -> Sn
    
    const results = existingPrograms.filter(p => {
      if (isSnSearch && searchNumber) {
        return String(p.Sn) === searchNumber || String(p.Sn).includes(searchNumber);
      }
      if (isMobileSearch && searchNumber) {
        return p.Mob && String(p.Mob).includes(searchNumber);
      }
      
      // For text or mixed searches, match name or mobile
      if (p.SenderName && p.SenderName.toLowerCase().includes(searchLower)) return true;
      if (p.Mob && String(p.Mob).includes(searchNumber)) return true;
      
      return false;
    });
    
    // Sort: exact Sn matches first when searching by Sn
    return results.sort((a, b) => {
      if (isSnSearch) {
        const aExact = String(a.Sn) === searchNumber ? 1 : 0;
        const bExact = String(b.Sn) === searchNumber ? 1 : 0;
        return bExact - aExact;
      }
      return 0;
    }).slice(0, 10); // Limit to 10 results
  }, [searchSn, existingPrograms]);

  const handleSelectProgram = async (program) => {
    // Require real id from database - never use Sn as fallback
    if (!program.id) {
      console.error('Program has no id (should have been set by normalizePragramId):', program);
      toast.error("रिकॉर्ड का ID नहीं मिला (डेटाबेस समस्या)");
      return;
    }

    const targetId = program.id;

    console.log("Selected program:", program);
    console.log("Target ID:", targetId);
    console.log("Program keys:", Object.keys(program));

    // Pre-cache the program data for instant loading
    const normalizedData = normalizeRecord(program);
    console.log("Normalized data for cache:", normalizedData);
    
    queryClient.setQueryData(['program', String(targetId)], normalizedData);

    // Verify cached data
    const cachedData = queryClient.getQueryData(['program', String(targetId)]);
    console.log("Cached data verification:", cachedData);

    // Clear search and navigate
    setSearchSn("");
    console.log("Navigating to edit with targetId:", targetId);
    navigate(createPageUrl("DataEntry") + `?edit=${targetId}`);
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="hover:bg-orange-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {editId ? "निमंत्रण संपादित करें" : "नया निमंत्रण जोड़ें"}
              </h1>
              <p className="text-gray-600 mt-1">निमंत्रण का पूरा विवरण दर्ज करें</p>
            </div>
          </div>

          <Button
            onClick={handleNewEntry}
            className="bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap"
          >
            Add New
          </Button>
        </div>

        {/* Search by Invitation Number */}
        <Card className="border-orange-100 shadow-md">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="निमंत्रण संख्या, प्रेषक का नाम या मोबाइल नंबर"
                  value={searchSn}
                  onChange={(e) => setSearchSn(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchResults.length > 0 && handleSelectProgram(searchResults[0])}
                  className="text-lg"
                />
              </div>

            </div>
            <p className="text-xs text-gray-500 mt-2">
              निमंत्रण संख्या, प्रेषक का नाम या मोबाइल नंबर से खोजें (कम से कम 2 अक्षर)
            </p>
            
            {/* Search Results Grid */}
            {searchResults.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {searchResults.map((program) => (
                  <div
                    key={program.id}
                    onClick={() => handleSelectProgram(program)}
                    className="p-3 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-400 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-orange-600">#{program.Sn}</span>
                      <Badge className="bg-orange-100 text-orange-700 text-xs">
                        {programTypesMap[program.programtyp] || program.programtyp}
                      </Badge>
                    </div>
                    <div className="font-semibold text-gray-900 mt-1">{program.SenderName}</div>
                    <div className="text-sm text-gray-600">{program.Mob}</div>
                    <div className="text-xs text-gray-500">
                      {program.Village}, {program.District}
                      {program.Date && ` • ${format(parseISO(program.Date), 'dd/MM/yyyy')}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {searchSn.trim().length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-red-500 mt-2">कोई रिकॉर्ड नहीं मिला</p>
            )}
          </CardContent>
        </Card>

        {editLoading ? (
          <Card className="border-orange-100">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">लोड हो रहा है...</p>
            </CardContent>
          </Card>
        ) : (
          <ProgramForm
            initialData={editProgram}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onDelete={editId ? handleDelete : undefined}
            isLoading={createProgramMutation.isPending || updateProgramMutation.isPending}
            nextSn={!editId ? nextSn : undefined}
          />
        )}
      </div>

      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-green-600 text-center">
              ✓ सफलता
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-lg pt-2">
              <div className="space-y-2">
                <p className="text-gray-700">आपकी जानकारी सुरक्षित हुई</p>
                <p className="font-bold text-orange-600 text-xl">
                  आई डी नम्बर: {savedSn}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={handleDialogOk}
              className="bg-orange-500 hover:bg-orange-600 px-8"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}