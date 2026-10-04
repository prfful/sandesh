import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Mandal } from "@/api/entities";
import { toast } from "sonner";
import { Plus, Save, Trash2, Edit } from "lucide-react";

export default function MandalMaster() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: mandals = [] } = useQuery({
    queryKey: ['mandals'],
    queryFn: () => Mandal.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => Mandal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandals'] });
      toast.success("मण्‍डल जोड़ा गया!");
      setName("");
    },
    onError: (error) => {
      const msg = error?.message || 'सेव विफल';
      toast.error(`मण्‍डल जोड़ने में त्रुटि: ${msg}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => Mandal.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandals'] });
      toast.success("मण्‍डल अपडेट हुआ!");
      setEditing(null);
      setName("");
    },
    onError: (error) => {
      const msg = error?.message || 'अपडेट विफल';
      toast.error(`मण्‍डल अपडेट करने में त्रुटि: ${msg}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Mandal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandals'] });
      toast.success("मण्‍डल हटाया गया!");
      setConfirmDelete(null);
    },
    onError: (error) => {
      const msg = error?.message || 'डिलीट विफल';
      toast.error(`मण्‍डल हटाने में त्रुटि: ${msg}`);
    }
  });

  const onSave = () => {
    const value = name.trim();
    if (!value) { toast.error("नाम आवश्यक है"); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { name: value } });
    } else {
      createMutation.mutate({ name: value });
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">मण्‍डल मास्टर</h1>
          <p className="text-gray-600 mt-1">नए मण्‍डल जोड़ें, संपादित करें या हटाएं</p>
        </div>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">
              {editing ? "मण्‍डल संपादित करें" : "नया मण्‍डल जोड़ें"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div className="flex gap-3">
              <Input 
                placeholder="मण्‍डल का नाम" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') onSave(); }}
                className="flex-1"
              />
              <Button 
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6" 
                onClick={onSave}
              >
                {editing ? <><Save className="w-4 h-4" /> अपडेट करें</> : <><Plus className="w-4 h-4" /> नया जोड़ें</>}
              </Button>
              {editing && (
                <Button 
                  variant="outline" 
                  className="gap-2" 
                  onClick={() => { setName(""); setEditing(null); }}
                >
                  रद्द करें
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle className="text-xl font-bold text-gray-900">सूची ({mandals.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-2">नाम</th>
                  <th className="py-2 px-2">क्रिया</th>
                </tr>
              </thead>
              <tbody>
                {mandals.map(m => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 px-2">{m.id}</td>
                    <td className="py-2 px-2">{m.name}</td>
                    <td className="py-2 px-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(m); setName(m.name); }}><Edit className="w-4 h-4" /> संपादित</Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(m)}><Trash2 className="w-4 h-4" /> हटाएं</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>मण्‍डल हटाएं?</AlertDialogTitle>
            <AlertDialogDescription>
              क्या आप सच में "{confirmDelete?.name}" मण्‍डल हटाना चाहते हैं?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(confirmDelete.id)}>हटाएं</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
