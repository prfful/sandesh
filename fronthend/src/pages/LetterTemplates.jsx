import React, { useState, useMemo } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Copy, Star } from "lucide-react";
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

export default function LetterTemplates() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['letter-templates'],
    queryFn: async () => {
      console.log('🔄 Fetching utility templates...');
      const result = await restClient.listEntities('LetterTemplate');
      const list = Array.isArray(result) ? result : [];
      // Filter to show only utility templates (template_type = 'utility' or null for backward compatibility)
      const utilityTemplates = list.filter((template) => {
        const type = String(template.template_type || 'utility').toLowerCase();
        return type === 'utility';
      });
      console.log('✅ Utility templates fetched:', utilityTemplates.length);
      return utilityTemplates;
    },
    initialData: [],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });

  const templates = Array.isArray(templatesData) ? templatesData : [];
  console.log('📋 Templates state:', { count: templates.length, data: templates });

  // Normalize template IDs to ensure all templates have an id field for deletion/editing
  const normalizedTemplates = useMemo(() => {
    return templates.map((template) => {
      // DEBUG: Log templates without id field
      if (!template.id) {
        console.warn('[LetterTemplates] Template missing id field:', {
          name: template.name,
          keys: Object.keys(template),
        });
      }
      return {
        ...template,
        id: template.id || template.name || `temp-${Math.random()}`,
      };
    });
  }, [templates]);

  const createTemplateMutation = useMutation({
    mutationFn: (data) => {
      console.log('Creating template with data:', JSON.stringify(data, null, 2));
      return restClient.createEntity('LetterTemplate', data);
    },
    onSuccess: (response) => {
      console.log('Template created successfully:', response);
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success("टेम्पलेट सफलतापूर्वक सहेजा गया!");
      setShowEditor(false);
      setEditingTemplate(null);
    },
    onError: (error) => {
      console.error("Template creation error:", error);
      const errorMsg = error?.response?.data?.message || error?.message || "डेटाबेस त्रुटि";
      toast.error(`टेम्पलेट सहेजने में विफल: ${errorMsg}`);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      console.log(`Updating template ${id} with data:`, JSON.stringify(data, null, 2));
      return restClient.updateEntity('LetterTemplate', id, data);
    },
    onSuccess: (response) => {
      console.log('Template updated successfully:', response);
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success("टेम्पलेट सफलतापूर्वक अपडेट किया गया!");
      setShowEditor(false);
      setEditingTemplate(null);
    },
    onError: (error) => {
      console.error("Template update error:", error);
      const errorMsg = error?.response?.data?.message || error?.message || "डेटाबेस त्रुटि";
      toast.error(`टेम्पलेट अपडेट विफल: ${errorMsg}`);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => {
      console.log('[LetterTemplates] Deleting template with id:', id, 'type:', typeof id);
      return restClient.deleteEntity('LetterTemplate', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success("टेम्पलेट हटाया गया!");
      setDeleteConfirm(null);
    },
    onError: (error) => {
      console.error('[LetterTemplates] Delete error:', error);
      toast.error("टेम्पलेट हटाने में त्रुटि");
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: (template) => {
      const { id, created_date, updated_date, created_by, ...data } = template;
      return restClient.createEntity('LetterTemplate', {
        ...data,
        name: `${data.name} (कॉपी)`,
        is_default: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
      toast.success("टेम्पलेट डुप्लिकेट किया गया!");
    },
  });

  const handleSave = (data) => {
    if (editingTemplate?.id) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditingTemplate({ template_type: 'utility' });
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
            templateTypeMode="all"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              पत्र टेम्पलेट्स
            </h1>
            <p className="text-gray-600 mt-1">कस्टम टेम्पलेट बनाएं और प्रबंधित करें</p>
          </div>
          <Button
            onClick={handleNew}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
          >
            <Plus className="w-5 h-5" />
            नया टेम्पलेट
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-orange-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कुल टेम्पलेट्स</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {normalizedTemplates.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Copy className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">डिफ़ॉल्ट टेम्पलेट्स</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {templates.filter(t => t.is_default).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कार्यक्रम प्रकार</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {new Set(normalizedTemplates.map(t => t.program_type)).size}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Badge className="text-lg">+</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="border-orange-100">
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">लोड हो रहा है...</p>
              </CardContent>
            </Card>
          ) : normalizedTemplates.length === 0 ? (
            <Card className="border-orange-100">
              <CardContent className="p-12 text-center">
                <Copy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl font-semibold text-gray-900 mb-2">
                  कोई टेम्पलेट नहीं
                </p>
                <p className="text-gray-500 mb-4">
                  अपना पहला पत्र टेम्पलेट बनाएं
                </p>
                <Button
                  onClick={handleNew}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  नया टेम्पलेट बनाएं
                </Button>
              </CardContent>
            </Card>
          ) : (
            normalizedTemplates.map((template) => (
              <Card key={template.id} className="border-orange-100 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl font-bold text-gray-900">
                          {template.name}
                        </CardTitle>
                        <Badge className="bg-violet-100 text-violet-800 border-violet-200">
                          {String(template.template_type || 'utility').toLowerCase()}
                        </Badge>
                        {template.is_default && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Star className="w-3 h-3 mr-1" />
                            डिफ़ॉल्ट
                          </Badge>
                        )}
                      </div>
                      <Badge className="bg-orange-100 text-orange-700">
                        {template.program_type === "default" ? "सभी कार्यक्रम" : template.program_type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDuplicate(template)}
                        className="hover:bg-blue-50"
                        title="डुप्लिकेट करें"
                      >
                        <Copy className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(template)}
                        className="hover:bg-orange-50"
                      >
                        <Edit className="w-4 h-4 text-orange-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(template)}
                        className="hover:bg-red-50"
                      >
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
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {template.greeting}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">सामग्री:</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded line-clamp-3 whitespace-pre-wrap">
                        {template.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                      <span>प्रेषक: {template.sender_name || "—"}</span>
                      <span>•</span>
                      <span>बनाया: {new Date(template.created_date).toLocaleDateString('hi-IN')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>टेम्पलेट हटाएं?</AlertDialogTitle>
            <AlertDialogDescription>
              क्या आप वाकई "{deleteConfirm?.name}" टेम्पलेट हटाना चाहते हैं? 
              यह क्रिया पूर्ववत नहीं की जा सकती।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log('[LetterTemplates] Delete confirmed for:', deleteConfirm);
                deleteTemplateMutation.mutate(deleteConfirm.id);
              }}
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