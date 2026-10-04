import React, { useState, useMemo } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import TemplateEditor from "../components/letter/TemplateEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BirthdayAnniversaryTemplates() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: templatesData = [], isLoading } = useQuery({
    queryKey: ['birthday-anniversary-templates'],
    queryFn: async () => {
      const allTemplates = await restClient.listEntities('LetterTemplate');
      if (!Array.isArray(allTemplates)) return [];
      // Some Hostinger schemas may not have template_type populated, so fallback to program_type values too.
      return allTemplates.filter((template) => {
        const type = String(template.template_type || template.templateType || '').toLowerCase();
        if (type === 'text') return true;
        const programType = String(template.program_type || template.programType || '').toLowerCase();
        return ['birthday', 'anniversary', 'simple_text', 'जन्मदिन', 'वर्षगांठ'].includes(programType);
      });
    },
    staleTime: 2 * 60 * 1000,
  });

  const templates = Array.isArray(templatesData) ? templatesData : [];

  const normalizedTemplates = useMemo(() => {
    return templates.map((template) => ({
      ...template,
      id: template.id ?? template.ID ?? template.Id ?? template._id ?? template.template_id ?? template.templateId ?? template.program_type,
      template_type: template.template_type || template.templateType || '',
      program_type: template.program_type || template.programType || '',
    }));
  }, [templates]);

  const textProgramTypes = ['जन्मदिन', 'वर्षगांठ', 'simple_text', 'birthday', 'anniversary'];

  const birthdayCount = normalizedTemplates.filter((t) => String(t.program_type || '').toLowerCase() === 'जन्मदिन' || String(t.program_type || '').toLowerCase() === 'birthday').length;
  const anniversaryCount = normalizedTemplates.filter((t) => String(t.program_type || '').toLowerCase() === 'वर्षगांठ' || String(t.program_type || '').toLowerCase() === 'anniversary').length;
  const simpleTextCount = normalizedTemplates.filter((t) => String(t.program_type || '').toLowerCase() === 'simple_text').length;

  const createTemplateMutation = useMutation({
    mutationFn: (data) => {
      console.log('[createTemplateMutation] Starting mutation with data:', data);
      return restClient.createEntity('LetterTemplate', data);
    },
    onSuccess: (response) => {
      console.log('[createTemplateMutation] Success! Response:', response);
      queryClient.invalidateQueries({ queryKey: ['birthday-anniversary-templates'] });
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success('टेम्पलेट सफलतापूर्वक सहेजा गया!');
      setShowEditor(false);
      setEditingTemplate(null);
    },
    onError: (error) => {
      console.error('[createTemplateMutation] Error:', error);
      console.error('[createTemplateMutation] Error response:', error?.response?.data);
      const errorMsg = error?.response?.data?.message || error?.message || 'डेटाबेस त्रुटि';
      toast.error(`टेम्पलेट सहेजने में विफल: ${errorMsg}`);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => restClient.updateEntity('LetterTemplate', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthday-anniversary-templates'] });
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success('टेम्पलेट सफलतापूर्वक अपडेट किया गया!');
      setShowEditor(false);
      setEditingTemplate(null);
    },
    onError: (error) => {
      const errorMsg = error?.response?.data?.message || error?.message || 'डेटाबेस त्रुटि';
      toast.error(`टेम्पलेट अपडेट विफल: ${errorMsg}`);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => restClient.deleteEntity('LetterTemplate', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthday-anniversary-templates'] });
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success('टेम्पलेट हटाया गया!');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('टेम्पलेट हटाने में त्रुटि');
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: (template) => {
      const { id, created_date, updated_date, created_by, ...data } = template;
      return restClient.createEntity('LetterTemplate', {
        ...data,
        name: `${data.name} (कॉपी)`,
        is_default: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthday-anniversary-templates'] });
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success('टेम्पलेट डुप्लिकेट किया गया!');
    },
  });

  const handleSave = (data) => {
    console.log('[BirthdayAnniversaryTemplates] handleSave called with data:', data);
    console.log('[BirthdayAnniversaryTemplates] editingTemplate.id:', editingTemplate?.id);

    const saveId = data.id ?? editingTemplate?.id ?? data.program_type;
    const shouldUpdate = Boolean(saveId && normalizedTemplates.some((template) => String(template.id) === String(saveId)));

    if (shouldUpdate) {
      console.log('[BirthdayAnniversaryTemplates] Existing template found, updating id:', saveId);
      updateTemplateMutation.mutate({ id: saveId, data });
    } else {
      console.log('[BirthdayAnniversaryTemplates] No existing template found, creating new with id:', saveId);
      createTemplateMutation.mutate(data);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleNewTemplate = (type) => {
    // Check if a template with this program_type already exists
    const existingTemplate = templates.find(t => {
      const tType = String(t.program_type || '').toLowerCase();
      const typeCheck = String(type || '').toLowerCase();
      return tType === typeCheck;
    });

    if (existingTemplate) {
      // Template exists - load it for editing/updating
      const normalizedExisting = {
        ...existingTemplate,
        id: existingTemplate.id ?? existingTemplate.ID ?? existingTemplate.Id ?? existingTemplate._id,
      };
      console.log('[BirthdayAnniversaryTemplates] Found existing template for', type, ':', normalizedExisting);
      setEditingTemplate(normalizedExisting);
    } else {
      // Template doesn't exist - create new one
      console.log('[BirthdayAnniversaryTemplates] No existing template for', type, '- creating new');
      setEditingTemplate({ 
        program_type: type, 
        template_type: 'text', 
        is_default: false,
        // Don't set id here - let TemplateEditor set it based on program_type
      });
    }
    setShowEditor(true);
  };

  const handleDelete = (template) => {
    setDeleteConfirm(template);
  };

  const handleDuplicate = (template) => {
    duplicateTemplateMutation.mutate(template);
  };

  if (showEditor) {
    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <TemplateEditor
            template={editingTemplate}
            onSave={handleSave}
            onCancel={() => {
              setShowEditor(false);
              setEditingTemplate(null);
            }}
            isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            programTypeMode="wishes-only"
            templateTypeMode="text-only"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">जन्मदिन / वर्षगांठ टेम्पलेट्स</h1>
            <p className="text-gray-600 mt-1">Birthday, Anniversary और Simple Text संदेश टेम्पलेट बनाएं और प्रबंधित करें</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleNewTemplate('जन्मदिन')}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
            >
              <Plus className="w-5 h-5" /> जन्मदिन टेम्पलेट
            </Button>
            <Button
              onClick={() => handleNewTemplate('वर्षगांठ')}
              className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 gap-2"
            >
              <Plus className="w-5 h-5" /> वर्षगांठ टेम्पलेट
            </Button>
            <Button
              onClick={() => handleNewTemplate('simple_text')}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 gap-2"
            >
              <Plus className="w-5 h-5" /> Simple Text टेम्पलेट
            </Button>
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-blue-900">
              नोट: यहाँ केवल <strong>template_type = text</strong> वाले टेम्पलेट दिखाई देंगे।
              यदि कोई टेम्पलेट सूची में नहीं दिख रहा है, तो Edit में जाकर उसका <strong>टेम्पलेट प्रकार</strong> text चुनें।
            </p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-orange-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कुल टेम्पलेट्स</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{templates.length}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Copy className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">जन्मदिन टेम्पलेट्स</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{birthdayCount}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Badge className="text-lg">🎂</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-pink-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">वर्षगांठ टेम्पलेट्स</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{anniversaryCount}</p>
                </div>
                <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                  <Badge className="text-lg">💍</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Simple Text टेम्पलेट्स</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{simpleTextCount}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Badge className="text-lg">📝</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <Card className="border-orange-100">
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">लोड हो रहा है...</p>
              </CardContent>
            </Card>
          ) : templates.length === 0 ? (
            <Card className="border-orange-100">
              <CardContent className="p-12 text-center">
                <Copy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl font-semibold text-gray-900 mb-2">कोई टेम्पलेट नहीं</p>
                <p className="text-gray-500 mb-4">पहला जन्मदिन, वर्षगांठ या Simple Text टेम्पलेट बनाएं</p>
                <Button
                  onClick={() => handleNewTemplate('जन्मदिन')}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Plus className="w-4 h-4 mr-2" /> जन्मदिन टेम्पलेट बनाएं
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className="border-orange-100 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <CardTitle className="text-xl font-bold text-gray-900">{template.name}</CardTitle>
                        <Badge className="bg-violet-100 text-violet-800 border-violet-200">
                          {String(template.template_type || 'utility').toLowerCase()}
                        </Badge>
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                          {['birthday', 'जन्मदिन'].includes(String(template.program_type || '').toLowerCase())
                            ? 'जन्मदिन'
                            : ['anniversary', 'वर्षगांठ'].includes(String(template.program_type || '').toLowerCase())
                              ? 'वर्षगांठ'
                              : String(template.program_type || '').toLowerCase() === 'simple_text'
                                ? 'Simple Text'
                                : template.program_type}
                        </Badge>
                        {template.is_default && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">डिफ़ॉल्ट</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleDuplicate(template)} className="hover:bg-blue-50" title="डुप्लिकेट करें">
                        <Copy className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(template)} className="hover:bg-orange-50" title="संपादित करें">
                        <Edit className="w-4 h-4 text-orange-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(template)} className="hover:bg-red-50" title="हटाएं">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {template.greeting && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">अभिवादन:</p>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{template.greeting}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">सामग्री:</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded line-clamp-3 whitespace-pre-wrap">{template.body}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                      <span>प्रेषक: {template.sender_name || '—'}</span>
                      <span>•</span>
                      <span>बनाया: {template.created_date ? new Date(template.created_date).toLocaleDateString('hi-IN') : '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>टेम्पलेट हटाएं?</AlertDialogTitle>
            <AlertDialogDescription>
              क्या आप वाकई "{deleteConfirm?.name}" टेम्पलेट हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              हटाएं
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
