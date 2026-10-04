import React, { useState, useEffect } from "react";
import restClient from "@/api/restClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Users, Plus, Edit, Trash2, Key, UserCheck, UserX, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const AVAILABLE_PERMISSIONS = [
  { id: "view_dashboard", label: "डैशबोर्ड देखें" },
  { id: "add_invitation", label: "निमंत्रण जोड़ें" },
  { id: "edit_invitation", label: "निमंत्रण संपादित करें" },
  { id: "delete_invitation", label: "निमंत्रण हटाएं" },
  { id: "view_reminders", label: "रिमाइंडर देखें" },
  { id: "generate_letters", label: "पत्र जनरेट करें" },
  { id: "send_whatsapp", label: "WhatsApp भेजें" },
  { id: "manage_templates", label: "टेम्पलेट प्रबंधित करें" },
  { id: "bulk_operations", label: "बल्क ऑपरेशन्स" },
  { id: "database_access", label: "डेटाबेस एक्सेस" },
  { id: "manage_operators", label: "ऑपरेटर प्रबंधित करें" },
];

export default function OperatorManagement() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [currentOperator, setCurrentOperator] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "operator",
    permissions: []
  });
  const [newPassword, setNewPassword] = useState("");

  const parsePermissions = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return Object.keys(parsed).filter((k) => parsed[k]);
      } catch (_err) {
        return [];
      }
      return [];
    }
    if (typeof value === 'object') return Object.keys(value).filter((k) => value[k]);
    return [];
  };

  useEffect(() => {
    loadOperators();
    // Get current logged in operator
    const operatorData = sessionStorage.getItem('operator_data');
    if (operatorData) {
      setCurrentOperator(JSON.parse(operatorData));
    }
  }, []);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'list'
      });
      
      const operatorsList = response?.data?.operators || response?.operators || response?.data || response?.operators || [];
      const normalized = (operatorsList || []).map((op) => ({
        ...op,
        permissions: parsePermissions(op?.permissions),
      }));
      if (normalized && normalized.length) {
        setOperators(normalized);
      } else {
        toast.error("ऑपरेटर लोड करने में त्रुटि");
      }
    } catch (error) {
      toast.error("त्रुटि: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperator = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("कृपया सभी आवश्यक फ़ील्ड भरें");
      return;
    }

    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'create',
        ...formData
      });
      if (response?.data?.success || response?.success) {
        toast.success("ऑपरेटर सफलतापूर्वक बनाया गया");
        setShowCreateDialog(false);
        setFormData({ name: "", email: "", password: "", role: "operator", permissions: [] });
        loadOperators();
      } else {
        toast.error(response?.data?.error || response?.error || "ऑपरेटर बनाने में त्रुटि");
      }
    } catch (error) {
      toast.error("त्रुटि: " + error.message);
    }
  };

  const handleUpdateOperator = async () => {
    if (!selectedOperator) return;

    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'update',
        operatorId: selectedOperator.id,
        name: formData.name,
        role: formData.role,
        permissions: formData.permissions
      });
      if (response?.data?.success || response?.success) {
        toast.success("ऑपरेटर अपडेट किया गया");
        setShowEditDialog(false);
        loadOperators();
      } else {
        toast.error(response?.data?.error || response?.error || "अपडेट में त्रुटि");
      }
    } catch (error) {
      toast.error("त्रुटि: " + error.message);
    }
  };

  const handleToggleActive = async (operator) => {
    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'update',
        operatorId: operator.id,
        is_active: !operator.is_active
      });
      if (response?.data?.success || response?.success) {
        toast.success(operator.is_active ? "ऑपरेटर निष्क्रिय किया गया" : "ऑपरेटर सक्रिय किया गया");
        loadOperators();
      }
    } catch (error) {
      toast.error("त्रुटि: " + error.message);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedOperator || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error("पासवर्ड कम से कम 6 अक्षर का होना चाहिए");
      return;
    }

    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'update',
        operatorId: selectedOperator.id,
        newPassword
      });
      if (response?.data?.success || response?.success) {
        toast.success("पासवर्ड बदल दिया गया");
        setShowPasswordDialog(false);
        setNewPassword("");
      } else {
        toast.error(response?.data?.error || response?.error || "पासवर्ड बदलने में त्रुटि");
      }
    } catch (error) {
      toast.error("त्रुटि: " + error.message);
    }
  };

  const handleDeleteOperator = async () => {
    if (!selectedOperator) return;

    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'delete',
        operatorId: selectedOperator.id
      });
      if (response?.data?.success || response?.success) {
        toast.success("ऑपरेटर हटा दिया गया");
        setShowDeleteDialog(false);
        loadOperators();
      } else {
        toast.error(response?.data?.error || response?.error || "हटाने में त्रुटि");
      }
    } catch (error) {
      toast.error("त्रुटि: " + error.message);
    }
  };

  const openEditDialog = (operator) => {
    setSelectedOperator(operator);
    setFormData({
      name: operator.name,
      email: operator.email,
      password: "",
      role: operator.role,
      permissions: parsePermissions(operator.permissions)
    });
    setShowEditDialog(true);
  };

  const togglePermission = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: "bg-red-100 text-red-700",
      operator: "bg-blue-100 text-blue-700",
      viewer: "bg-gray-100 text-gray-700"
    };
    const labels = {
      admin: "एडमिन",
      operator: "ऑपरेटर",
      viewer: "व्यूअर"
    };
    return <Badge className={colors[role]}>{labels[role]}</Badge>;
  };

  // Allow access always - FC-Dhar authenticated users can manage operators
  // This is the local operator management system

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8" />
              ऑपरेटर प्रबंधन
            </h1>
            <p className="text-gray-600 mt-1">Local operators for FC-Dhar</p>
          </div>
          <Button 
            onClick={() => {
              setFormData({ name: "", email: "", password: "", role: "operator", permissions: [] });
              setShowCreateDialog(true);
            }}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
          >
            <Plus className="w-5 h-5" />
            नया ऑपरेटर
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">सक्रिय ऑपरेटर</p>
                  <p className="text-3xl font-bold text-gray-900">{operators.filter(o => o.is_active).length}</p>
                </div>
                <UserCheck className="w-12 h-12 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-gradient-to-r from-red-50 to-pink-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">निष्क्रिय ऑपरेटर</p>
                  <p className="text-3xl font-bold text-gray-900">{operators.filter(o => !o.is_active).length}</p>
                </div>
                <UserX className="w-12 h-12 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कुल ऑपरेटर</p>
                  <p className="text-3xl font-bold text-gray-900">{operators.length}</p>
                </div>
                <Users className="w-12 h-12 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operators List */}
        <Card className="border-orange-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <CardTitle>ऑपरेटर सूची</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">लोड हो रहा है...</p>
              </div>
            ) : operators.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">कोई ऑपरेटर नहीं मिला</p>
                <Button 
                  onClick={() => setShowCreateDialog(true)} 
                  className="mt-4"
                >
                  पहला ऑपरेटर बनाएं
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {operators.map((operator) => (
                  <div key={operator.id} className="p-4 hover:bg-orange-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${operator.is_active ? 'bg-gradient-to-br from-orange-400 to-red-400' : 'bg-gray-400'}`}>
                          {operator.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{operator.name}</h3>
                            {getRoleBadge(operator.role)}
                            {!operator.is_active && (
                              <Badge className="bg-gray-100 text-gray-600">निष्क्रिय</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{operator.email}</p>
                          {operator.last_login && (
                            <p className="text-xs text-gray-400 mt-1">
                              अंतिम लॉगिन: {format(new Date(operator.last_login), 'dd/MM/yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={operator.is_active}
                          onCheckedChange={() => handleToggleActive(operator)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(operator)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOperator(operator);
                            setShowPasswordDialog(true);
                          }}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedOperator(operator);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {operator.permissions && operator.permissions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {operator.permissions.map(perm => {
                          const permLabel = AVAILABLE_PERMISSIONS.find(p => p.id === perm)?.label || perm;
                          return (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {permLabel}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>नया ऑपरेटर बनाएं</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>नाम *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ऑपरेटर का नाम"
                />
              </div>
              <div>
                <Label>ईमेल *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>पासवर्ड *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="कम से कम 6 अक्षर"
                />
              </div>
              <div>
                <Label>रोल</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">एडमिन</SelectItem>
                    <SelectItem value="operator">ऑपरेटर</SelectItem>
                    <SelectItem value="viewer">व्यूअर</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>अनुमतियाँ</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-${perm.id}`}
                        checked={formData.permissions.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      <label htmlFor={`create-${perm.id}`} className="text-sm">{perm.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>रद्द करें</Button>
              <Button onClick={handleCreateOperator}>बनाएं</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ऑपरेटर संपादित करें</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>नाम</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>ईमेल (बदला नहीं जा सकता)</Label>
                <Input value={formData.email} disabled className="bg-gray-100" />
              </div>
              <div>
                <Label>रोल</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">एडमिन</SelectItem>
                    <SelectItem value="operator">ऑपरेटर</SelectItem>
                    <SelectItem value="viewer">व्यूअर</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>अनुमतियाँ</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-${perm.id}`}
                        checked={formData.permissions.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                      />
                      <label htmlFor={`edit-${perm.id}`} className="text-sm">{perm.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>रद्द करें</Button>
              <Button onClick={handleUpdateOperator}>अपडेट करें</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>पासवर्ड बदलें</DialogTitle>
              <DialogDescription>
                {selectedOperator?.name} का पासवर्ड बदलें
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label>नया पासवर्ड</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="कम से कम 6 अक्षर"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>रद्द करें</Button>
              <Button onClick={handleChangePassword}>पासवर्ड बदलें</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ऑपरेटर हटाएं?</DialogTitle>
              <DialogDescription>
                क्या आप वाकई "{selectedOperator?.name}" को हटाना चाहते हैं? यह क्रिया वापस नहीं की जा सकती।
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>रद्द करें</Button>
              <Button variant="destructive" onClick={handleDeleteOperator}>हटाएं</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}