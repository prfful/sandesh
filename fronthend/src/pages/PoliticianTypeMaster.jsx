import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { PoliticianType } from "@/api/entities";
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

export default function PoliticianTypeMaster() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['politician-types'],
    queryFn: () => PoliticianType.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => PoliticianType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politician-types'] });
      setNewDesignation("");
      toast.success("पद जोड़ा गया");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => PoliticianType.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politician-types'] });
      setEditingId(null);
      setEditingName("");
      toast.success("पद अपडेट किया गया");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => PoliticianType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politician-types'] });
      toast.success("पद हटाया गया");
    },
  });

  const handleAdd = () => {
    if (!newDesignation.trim()) {
      toast.error("कृपया पद का नाम दर्ज करें");
      return;
    }
    createMutation.mutate({ Designation: newDesignation.trim() });
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditingName(row.Designation);
  };

  const handleSaveEdit = () => {
    if (!editingName.trim()) {
      toast.error("कृपया पद का नाम दर्ज करें");
      return;
    }
    updateMutation.mutate({ id: editingId, data: { Designation: editingName.trim() } });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            पार्टी के पदाधिकारियों के पद एवं दायित्व
          </h1>
          <p className="text-gray-600 mt-1">पद/डिज़िग्नेशन सूची प्रबंधित करें</p>
        </div>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">
              नया पद जोड़ें
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="पद तथा दायित्व का नाम"
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
              >
                <Plus className="w-4 h-4" />
                जोड़ें
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">
              सभी पद ({types.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">लोड हो रहा है...</p>
            ) : types.length === 0 ? (
              <p className="text-center text-gray-500 py-8">कोई रिकॉर्ड नहीं मिला</p>
            ) : (
              <div className="space-y-3">
                {types.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 p-4 bg-white border border-orange-100 rounded-lg hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-400 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                      {row.id}
                    </div>

                    {editingId === row.id ? (
                      <div className="flex-1 flex gap-3">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} className="gap-2">
                          <Save className="w-4 h-4" />
                          सेव
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingName(""); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-lg font-semibold text-gray-900">{row.Designation}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(row)} className="gap-2">
                            <Edit2 className="w-4 h-4" />
                            संपादित
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(row)} className="gap-2 text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                            हटाएं
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>क्या आप निश्चित हैं?</AlertDialogTitle>
            <AlertDialogDescription>
              क्या आप "{deleteConfirm?.Designation}" को हटाना चाहते हैं? यह कार्रवाई पूर्ववत नहीं की जा सकती।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
