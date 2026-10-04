import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import restClient from "@/api/restClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, LogIn, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function OperatorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    // Clear legacy persistent tokens so restart always forces a fresh login
    localStorage.removeItem('operator_token');
    localStorage.removeItem('operator_data');

    const token = sessionStorage.getItem('operator_token');
    if (token) verifyToken(token);
  }, []);

  const verifyToken = async (token) => {
    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'verify',
        token
      });
      
      if (response?.success) {
        navigate(createPageUrl("Dashboard"));
      }
    } catch {
      sessionStorage.removeItem('operator_token');
      sessionStorage.removeItem('operator_data');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await restClient.invokeFunction('operatorAuth', {
        action: 'login',
        email,
        password
      });

      console.log("Login response:", response);

      if (response?.success) {
        const token = response.token;
        const operator = response.operator;
        if (token) sessionStorage.setItem('operator_token', token);
        if (operator) sessionStorage.setItem('operator_data', JSON.stringify(operator));
        toast.success(`स्वागत है, ${operator?.name || ''}!`);
        navigate(createPageUrl("Dashboard"));
      } else {
        const errorMsg = response?.error || "लॉगिन विफल";
        console.error("Login failed:", errorMsg);
        toast.error(errorMsg);
      }
      } catch (error) {
      console.error("Login error:", error);
      toast.error("लॉगिन में त्रुटि: " + (error.message || "कृपया पुनः प्रयास करें"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-orange-100 shadow-2xl">
        <CardHeader className="text-center bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">संदेश</CardTitle>
          <p className="text-gray-600">Operator Login</p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">ईमेल</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">पासवर्ड</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-lg pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-lg py-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  लॉगिन हो रहा है...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  लॉगिन करें
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}