import React, { useMemo, useState } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Shield, User, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    permissions: [],
  });
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  const parsePermissions = (value) => {
    const empty = new Set();
    if (!value) return empty;
    if (Array.isArray(value)) return new Set(value);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return new Set(parsed);
        if (parsed && typeof parsed === 'object') {
          return new Set(Object.keys(parsed).filter((k) => parsed[k]));
        }
      } catch (_err) {
        return empty;
      }
      return empty;
    }
    if (typeof value === 'object') {
      return new Set(Object.keys(value).filter((k) => value[k]));
    }
    return empty;
  };

  const normalizeUser = (user) => {
    if (!user) return null;
    const permSet = parsePermissions(user.permissions);
    return { ...user, permissions: Array.from(permSet) };
  };

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => restClient.authMe(),
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => restClient.listEntities('Operator'),
    initialData: [],
  });

  const createUserMutation = useMutation({
    mutationFn: (data) => restClient.createEntity('Operator', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('यूजर बना दिया गया');
      setCreateForm({ name: '', email: '', password: '', role: 'user', permissions: [] });
      setShowCreateDialog(false);
    },
    onError: (error) => {
      toast.error('त्रुटि: ' + (error?.message || 'यूजर नहीं बना'));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => restClient.updateEntity('Operator', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("यूजर अपडेट हो गया");
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error("त्रुटि: " + error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => restClient.deleteEntity('Operator', userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("यूजर डिलीट हो गया");
      setDeleteUserId(null);
      if (selectedUser?.id === deleteUserId) {
        setSelectedUser(null);
      }
    },
    onError: (error) => {
      toast.error("त्रुटि: " + error.message);
    },
  });



  const handlePermissionToggle = (permission) => {
    if (!selectedUser) return;

    const updated = new Set(selectedPermissions);
    if (updated.has(permission)) {
      updated.delete(permission);
    } else {
      updated.add(permission);
    }

    updateUserMutation.mutate({
      id: selectedUser.id,
      data: { permissions: JSON.stringify(Array.from(updated)) }
    });

    setSelectedUser((prev) => prev ? { ...prev, permissions: Array.from(updated) } : prev);
  };

  const handleRoleChange = (userId, newRole) => {
    updateUserMutation.mutate({
      id: userId,
      data: { role: newRole }
    });
  };

  const permissions = [
    { key: 'can_add_program', label: 'नया निमंत्रण जोड़ सकता है' },
    { key: 'can_edit_program', label: 'निमंत्रण संपादित कर सकता है' },
    { key: 'can_delete_program', label: 'निमंत्रण हटा सकता है' },
    { key: 'can_view_reminder', label: 'रिमाइंडर देख सकता है' },
    { key: 'can_mark_attended', label: 'अटेंडेंस मार्क कर सकता है' },
    { key: 'can_generate_letter', label: 'पत्र जनरेट कर सकता है' },
    { key: 'can_resend_letter', label: 'पत्र दोबारा भेज सकता है' },
    { key: 'can_import_data', label: 'डेटा इम्पोर्ट कर सकता है' },
  ];

  const availablePages = [
    { key: 'Dashboard', label: 'डैशबोर्ड' },
    { key: 'DataEntry', label: 'नया / संपादित निमंत्रण' },
    { key: 'ReminderList', label: 'रिमाइंडर सूची' },
    { key: 'BulkOperations', label: 'बल्क ऑपरेशन्स' },
    { key: 'LetterGenerator', label: 'पत्र जनरेटर' },
    { key: 'LetterTemplates', label: 'पत्र टेम्पलेट्स' },
    { key: 'BirthdayAnniversaryTemplates', label: 'जन्मदिन/वर्षगांठ टेम्पलेट्स' },
    { key: 'LetterSettings', label: 'पत्र सेटिंग्स' },
    { key: 'ProgramTypeMaster', label: 'कार्यक्रम प्रकार मास्टर' },
    { key: 'PoliticianTypeMaster', label: 'पदाधिकारी पद मास्टर' },
    { key: 'MandalMaster', label: 'मण्‍डल मास्टर' },
    { key: 'WhatsAppSettings', label: 'WhatsApp सेटिंग्स' },
    { key: 'DatabaseViewer', label: 'Database Viewer' },
    { key: 'UserManagement', label: 'यूजर मैनेजमेंट' },
    { key: 'OperatorManagement', label: 'ऑपरेटर प्रबंधन' },
    { key: 'PoliticianEntry', label: 'कार्यकर्ता / पदाधिकारी इंद्राज' },
    { key: 'WhatsAppBulk', label: 'WhatsApp बल्क संदेश' },
    { key: 'BirthdayAnniversaryWishes', label: 'जन्मदिन / वर्षगांठ बधाई' },
  ];

  const selectedPermissions = useMemo(() => parsePermissions(selectedUser?.permissions), [selectedUser]);
  const selectedPages = useMemo(() => parsePermissions(selectedUser?.page_permissions), [selectedUser]);

  const toggleCreatePermission = (perm) => {
    setCreateForm((prev) => {
      const exists = prev.permissions.includes(perm);
      const next = exists ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm];
      return { ...prev, permissions: next };
    });
  };

  const handlePageToggle = (pageName) => {
    if (!selectedUser) return;

    const updated = new Set(selectedPages);
    if (updated.has(pageName)) {
      updated.delete(pageName);
    } else {
      updated.add(pageName);
    }

    updateUserMutation.mutate({
      id: selectedUser.id,
      data: { page_permissions: JSON.stringify(Array.from(updated)) }
    });

    setSelectedUser((prev) => prev ? { ...prev, page_permissions: Array.from(updated) } : prev);
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">एक्सेस अस्वीकृत</h2>
        <p className="text-gray-600">केवल Admin इस पेज को देख सकता है</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">यूजर मैनेजमेंट</h1>
            <p className="text-gray-600 mt-1">यूजर्स की भूमिका और अनुमतियाँ प्रबंधित करें</p>
            <p className="text-sm text-gray-500 mt-2">
              नए यूजर जोड़ने के लिए FC-Dhar डैशबोर्ड → User Management से Invite करें
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
          >
            नया यूजर
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-orange-100 shadow-lg bg-gradient-to-r from-orange-50 to-amber-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कुल यूजर्स</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">{users.length}</p>
                </div>
                <Users className="w-16 h-16 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">एडमिन</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">
                    {users.filter(u => u.role === 'admin').length}
                  </p>
                </div>
                <Shield className="w-16 h-16 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ऑपरेटर</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">
                    {users.filter(u => u.role === 'user').length}
                  </p>
                </div>
                <User className="w-16 h-16 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                सभी यूजर्स
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-center text-gray-500 py-8">लोड हो रहा है...</p>
              ) : users.length === 0 ? (
                <p className="text-center text-gray-500 py-8">कोई यूजर नहीं मिला</p>
              ) : (
                users.map((user) => (
                  <Card
                    key={user.id}
                    className={`cursor-pointer transition-all ${
                      selectedUser?.id === user.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'hover:border-orange-200'
                    }`}
                    onClick={() => setSelectedUser(normalizeUser(user))}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">
                              {user.name || user.email || 'नाम नहीं'}
                            </h3>
                            <Badge
                              className={
                                user.role === 'admin'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }
                            >
                              {user.role === 'admin' ? 'Admin' : 'Operator'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Mail className="w-4 h-4" />
                            {user.email}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(user);
                              setShowEditNameDialog(true);
                              setEditNameValue(user.name || '');
                            }}
                          >
                            नाम संपादित
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(user);
                              setPasswordForm({ newPassword: '', confirmPassword: '' });
                              setShowPasswordDialog(true);
                            }}
                          >
                            पासवर्ड बदलें
                          </Button>
                          {user.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRoleChange(user.id, 'admin');
                              }}
                            >
                              Admin बनाएं
                            </Button>
                          )}
                          {user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteUserId(user.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                अनुमतियाँ सेट करें
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <div className="text-center py-12">
                  <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    अनुमतियाँ सेट करने के लिए एक यूजर चुनें
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {selectedUser.name || selectedUser.email || 'नाम नहीं'}
                    </h3>
                    <p className="text-sm text-gray-600">{selectedUser.email}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">फीचर अनुमतियाँ</h4>
                    {permissions.map((permission) => (
                      <div
                        key={permission.key}
                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-200 transition-colors"
                      >
                        <Checkbox
                          checked={selectedPermissions.has(permission.key)}
                          onCheckedChange={() => handlePermissionToggle(permission.key)}
                          disabled={selectedUser.role === 'admin'}
                        />
                        <label className="flex-1 text-sm text-gray-700 cursor-pointer">
                          {permission.label}
                        </label>
                      </div>
                    ))}
                  </div>

                  {selectedUser.role !== 'admin' && (
                    <div className="space-y-3 mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900">पेज एक्सेस अनुमतियाँ</h4>
                      <p className="text-sm text-gray-600">यूजर को कौन से पेज दिखाई देंगे</p>
                      <div className="grid grid-cols-2 gap-2">
                        {availablePages.map((page) => (
                          <div
                            key={page.key}
                            className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-orange-200 transition-colors"
                          >
                            <Checkbox
                              checked={selectedPages.has(page.key)}
                              onCheckedChange={() => handlePageToggle(page.key)}
                            />
                            <label className="flex-1 text-xs text-gray-700 cursor-pointer">
                              {page.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedUser.role === 'admin' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-700">
                        <strong>नोट:</strong> Admin को सभी अनुमतियाँ स्वचालित रूप से मिलती हैं
                      </p>
                    </div>
                  )}

                  {selectedUser.role !== 'admin' && (
                    <Button
                      onClick={() => handleRoleChange(selectedUser.id, 'user')}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      Operator रोल पर सेट करें
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>क्या आप सुनिश्चित हैं?</AlertDialogTitle>
              <AlertDialogDescription>
                यह यूजर डिलीट हो जाएगा। यह कार्रवाई वापस नहीं की जा सकती।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>रद्द करें</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteUserMutation.mutate(deleteUserId)}
                className="bg-red-600 hover:bg-red-700"
              >
                हाँ, डिलीट करें
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>यूजर नाम संपादित करें</DialogTitle>
              <DialogDescription>खाली नाम को ठीक करें या नया नाम सेट करें।</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>नाम</Label>
              <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} placeholder="यूजर का नाम" />
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowEditNameDialog(false)}>रद्द करें</Button>
              <Button
                onClick={() => {
                  const clean = editNameValue.trim();
                  if (!selectedUser?.id) return;
                  updateUserMutation.mutate({ id: selectedUser.id, data: { name: clean || null } });
                  setShowEditNameDialog(false);
                }}
              >
                सेव
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>पासवर्ड बदलें</DialogTitle>
              <DialogDescription>
                {selectedUser?.name || selectedUser?.email || 'यूजर'} का पासवर्ड बदलें (रीसेट करें)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>नया पासवर्ड *</Label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="कम से कम 6 अक्षर"
                />
              </div>
              <div>
                <Label>पासवर्ड पुष्टि करें *</Label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="पासवर्ड फिर से दर्ज करें"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>रद्द करें</Button>
              <Button
                onClick={async () => {
                  if (!passwordForm.newPassword?.trim()) {
                    toast.error('नया पासवर्ड आवश्यक है');
                    return;
                  }
                  if (passwordForm.newPassword.trim().length < 6) {
                    toast.error('पासवर्ड कम से कम 6 अक्षर का होना चाहिए');
                    return;
                  }
                  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                    toast.error('पासवर्ड मेल नहीं खाते');
                    return;
                  }
                  if (!selectedUser?.id) return;
                  try {
                    const encoder = new TextEncoder();
                    const data = encoder.encode(passwordForm.newPassword);
                    const digest = await crypto.subtle.digest('SHA-256', data);
                    const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
                    await updateUserMutation.mutateAsync({ id: selectedUser.id, data: { password_hash: hex } });
                    toast.success('पासवर्ड बदल दिया गया');
                    setShowPasswordDialog(false);
                    setPasswordForm({ newPassword: '', confirmPassword: '' });
                  } catch (err) {
                    toast.error('त्रुटि: ' + (err?.message || 'पासवर्ड अपडेट विफल'));
                  }
                }}
              >
                पासवर्ड अपडेट करें
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>नया यूजर जोड़ें</DialogTitle>
              <DialogDescription>
                नाम, ईमेल, पासवर्ड, रोल चुनें और अनुमतियाँ सेट करें।
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>नाम</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="यूजर का नाम"
                />
              </div>
              <div>
                <Label>ईमेल *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>पासवर्ड *</Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="कम से कम 6 अक्षर"
                />
              </div>
              <div>
                <Label>रोल</Label>
                <div className="flex gap-2">
                  {['admin', 'user'].map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant={createForm.role === role ? 'default' : 'outline'}
                      onClick={() => setCreateForm((prev) => ({ ...prev, role }))}
                    >
                      {role === 'admin' ? 'Admin' : 'Operator'}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>अनुमतियाँ</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-44 overflow-y-auto">
                  {permissions.map((perm) => (
                    <div key={perm.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`perm-${perm.key}`}
                        checked={createForm.permissions.includes(perm.key)}
                        onCheckedChange={() => toggleCreatePermission(perm.key)}
                      />
                      <label htmlFor={`perm-${perm.key}`} className="text-sm text-gray-700">
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>रद्द करें</Button>
              <Button
                onClick={() => {
                  if (!createForm.email?.trim() || !createForm.password?.trim()) {
                    toast.error('ईमेल और पासवर्ड आवश्यक हैं');
                    return;
                  }
                  if (createForm.password.trim().length < 6) {
                    toast.error('पासवर्ड कम से कम 6 अक्षर का होना चाहिए');
                    return;
                  }
                  (async () => {
                    try {
                      const encoder = new TextEncoder();
                      const data = encoder.encode(createForm.password);
                      const digest = await crypto.subtle.digest('SHA-256', data);
                      const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
                      const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
                      createUserMutation.mutate({
                        id,
                        name: createForm.name?.trim() || createForm.email?.trim(),
                        email: createForm.email?.trim(),
                        password_hash: hex,
                        role: createForm.role,
                        permissions: JSON.stringify(createForm.permissions || []),
                        is_active: 1,
                      });
                    } catch (err) {
                      toast.error('पासवर्ड हैशिंग असफल');
                    }
                  })();
                }}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? 'बना रहा है...' : 'यूजर बनाएं'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}