
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import restClient from "@/api/restClient";
import { useQuery } from "@tanstack/react-query";
import { Home, Plus, Bell, FileText, Menu, BookTemplate, Settings, MessageCircle, Upload, Users, Database, LogOut, UserCog, UserPlus, Gift, MapPin } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "डैशबोर्ड",
    url: createPageUrl("Dashboard"),
    icon: Home,
  },
  {
    title: "नया / संपादित निमंत्रण",
    url: createPageUrl("DataEntry"),
    icon: Plus,
  },
  {
    title: "रिमाइंडर सूची",
    url: createPageUrl("ReminderList"),
    icon: Bell,
  },
  {
    title: "बल्क ऑपरेशन्स",
    url: createPageUrl("BulkOperations"),
    icon: Users,
  },
  {
    title: "पत्र जनरेटर",
    url: createPageUrl("LetterGenerator"),
    icon: FileText,
  },
  {
    title: "पत्र टेम्पलेट्स",
    url: createPageUrl("LetterTemplates"),
    icon: BookTemplate,
  },
  {
    title: "पत्र सेटिंग्स",
    url: createPageUrl("LetterSettings"),
    icon: Settings,
  },
];

const settingsItems = [
  {
    title: "कार्यक्रम प्रकार मास्टर",
    url: createPageUrl("ProgramTypeMaster"),
    icon: Settings,
  },
  {
    title: "पदाधिकारी पद मास्टर",
    url: createPageUrl("PoliticianTypeMaster"),
    icon: Settings,
  },
  {
    title: "मण्‍डल मास्टर",
    url: createPageUrl("MandalMaster"),
    icon: MapPin,
  },
  {
    title: "WhatsApp सेटिंग्स",
    url: createPageUrl("WhatsAppSettings"),
    icon: MessageCircle,
  },
  {
    title: "Database Viewer",
    url: createPageUrl("DatabaseViewer"),
    icon: Database,
  },
  {
    title: "यूजर मैनेजमेंट",
    url: createPageUrl("UserManagement"),
    icon: Settings,
  },
  {
    title: "ऑपरेटर प्रबंधन",
    url: createPageUrl("OperatorManagement"),
    icon: UserCog,
  },
];

const politicianItems = [
  {
    title: "कार्यकर्ता / पदाधिकारी इंद्राज",
    url: createPageUrl("PoliticianEntry"),
    icon: UserPlus,
  },
  {
    title: "WhatsApp बल्क संदेश",
    url: createPageUrl("WhatsAppBulk"),
    icon: MessageCircle,
  },
  {
    title: "जन्मदिन / वर्षगांठ बधाई",
    url: createPageUrl("BirthdayAnniversaryWishes"),
    icon: Gift,
  },
  {
    title: "जन्मदिन/वर्षगांठ टेम्पलेट्स",
    url: createPageUrl("BirthdayAnniversaryTemplates"),
    icon: BookTemplate,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  
  const [isAuthenticated, setIsAuthenticated] = React.useState(null);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [redirecting, setRedirecting] = React.useState(false);

  // Check authentication on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await restClient.authMe();
        if (!user) {
          if (!redirecting) {
            setRedirecting(true);
            window.location.href = createPageUrl('OperatorLogin');
          }
          return;
        }
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth error:', error);
        if (!redirecting) {
          setRedirecting(true);
          window.location.href = createPageUrl('OperatorLogin');
        }
      }
    };
    checkAuth();
  }, [redirecting]);

  const userLoading = isAuthenticated === null;

  const isAdmin = currentUser?.role === 'admin';
  const permissions = currentUser?.permissions || {};
  
  // Parse page permissions - if empty array or null, admin sees all, operators see none unless specified
  const allowedPages = React.useMemo(() => {
    if (isAdmin) return null; // null means all pages for admin
    
    try {
      let pagePerms = currentUser?.page_permissions;
      console.log('[Layout] Raw page_permissions:', pagePerms, 'Type:', typeof pagePerms);
      
      if (!pagePerms) {
        console.log('[Layout] No page_permissions, returning empty array');
        return [];
      }
      
      if (Array.isArray(pagePerms)) {
        console.log('[Layout] page_permissions is array:', pagePerms);
        return pagePerms;
      }
      
      if (typeof pagePerms === 'string') {
        const parsed = JSON.parse(pagePerms);
        console.log('[Layout] Parsed page_permissions from string:', parsed);
        return Array.isArray(parsed) ? parsed : [];
      }
      
      console.log('[Layout] page_permissions type unknown, returning empty array');
      return [];
    } catch (e) {
      console.error('[Layout] Error parsing page_permissions:', e);
      return [];
    }
  }, [isAdmin, currentUser?.page_permissions]);

  // Helper to check if user can access a page
  const canAccessPage = React.useCallback((pageName) => {
    if (isAdmin) return true; // Admin sees everything
    if (!allowedPages) return false;
    // Case-insensitive comparison since URLs are lowercase but permissions might be mixed case
    const pageNameLower = pageName.toLowerCase();
    const allowed = allowedPages.some(p => p.toLowerCase() === pageNameLower);
    console.log('[Layout] canAccessPage check - Page:', pageName, 'Allowed:', allowed, 'AllowedPages:', allowedPages);
    return allowed;
  }, [isAdmin, allowedPages]);

  // Filter navigation items based on page permissions
  const filteredNavItems = React.useMemo(() => {
    const filtered = navigationItems.filter(item => {
      // Extract page name from URL
      const pageName = item.url.split('/').pop();
      const canAccess = canAccessPage(pageName);
      console.log('[Layout] FilterNav - URL:', item.url, 'PageName:', pageName, 'CanAccess:', canAccess);
      return canAccess;
    });
    console.log('[Layout] FilteredNavItems:', filtered.length, 'Total:', navigationItems.length);
    return filtered;
  }, [canAccessPage]);

  // Filter settings items - admin only for most
  const filteredSettingsItems = React.useMemo(() => {
    if (isAdmin) return settingsItems;
    
    return settingsItems.filter(item => {
      const pageName = item.url.split('/').pop();
      return canAccessPage(pageName);
    });
  }, [isAdmin, canAccessPage]);

  // Show loading while checking authentication
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  // If no user, don't render anything (will redirect)
  if (!currentUser) {
    return null;
  }

  return (
    <SidebarProvider>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
        
        :root {
          --primary: #FF6B35;
          --primary-dark: #E85A2A;
          --secondary: #FFA07A;
          --accent: #FFE5B4;
          --neutral: #F5F5F5;
          --text-dark: #2C2C2C;
        }
        
        body, .font-hindi {
          font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
        }

        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <Sidebar className="border-r border-orange-100">
          <SidebarHeader className="border-b border-orange-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-gray-900">संदेश</h2>
                <p className="text-xs text-gray-500">Invitation Manager</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                मेन्यू
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-orange-100 text-orange-700 shadow-sm' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {filteredSettingsItems.length > 0 && (
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                उपयोगिताएँ
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredSettingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-orange-100 text-orange-700 shadow-sm' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}

            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs font-semibold text-purple-600 uppercase tracking-wider px-3 py-2">
                पार्टी कार्यकर्ता प्रबंधन
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {politicianItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-purple-100 text-purple-700 shadow-sm' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-orange-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {currentUser?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {currentUser?.name || currentUser?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentUser?.role === 'admin' ? 'एडमिन' : 'ऑपरेटर'}
                </p>
              </div>
              <button 
                onClick={() => {
                  sessionStorage.removeItem('operator_token');
                  sessionStorage.removeItem('operator_data');
                  localStorage.removeItem('operator_token');
                  localStorage.removeItem('operator_data');
                  window.location.href = createPageUrl('OperatorLogin');
                }}
                className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                title="लॉगआउट"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100 px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-orange-50 p-2 rounded-lg transition-colors duration-200 md:hidden">
                  <Menu className="w-5 h-5" />
                </SidebarTrigger>
                <h1 className="text-xl font-bold text-gray-900 md:hidden">संदेश</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">
                      {(currentUser?.name || currentUser?.email || 'U').charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="font-semibold text-gray-900 text-sm">
                      {currentUser?.name || currentUser?.email || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentUser?.role === 'admin' ? 'एडमिन' : 'ऑपरेटर'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    sessionStorage.removeItem('operator_token');
                    sessionStorage.removeItem('operator_data');
                    localStorage.removeItem('operator_token');
                    localStorage.removeItem('operator_data');
                    window.location.href = createPageUrl('OperatorLogin');
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 hover:text-red-700 transition-colors text-sm font-medium"
                  title="लॉगआउट"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">लॉगआउट</span>
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
