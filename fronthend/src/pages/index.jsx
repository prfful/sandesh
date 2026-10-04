import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import DataEntry from "./DataEntry";

import ReminderList from "./ReminderList";

import LetterGenerator from "./LetterGenerator";

import LetterTemplates from "./LetterTemplates";

import LetterSettings from "./LetterSettings";

import WhatsAppSettings from "./WhatsAppSettings";

import ProgramTypeMaster from "./ProgramTypeMaster";

import UserManagement from "./UserManagement";

import BulkOperations from "./BulkOperations";

import DebugProgramTypes from "./DebugProgramTypes";

import DatabaseViewer from "./DatabaseViewer";

import OperatorLogin from "./OperatorLogin";

import OperatorManagement from "./OperatorManagement";

import PoliticianTypeMaster from "./PoliticianTypeMaster";

import PoliticianEntry from "./PoliticianEntry";

import WhatsAppBulk from "./WhatsAppBulk";

import BirthdayAnniversaryWishes from "./BirthdayAnniversaryWishes";
import BirthdayAnniversaryTemplates from "./BirthdayAnniversaryTemplates";

import MandalMaster from "./MandalMaster";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    DataEntry: DataEntry,
    
    ReminderList: ReminderList,
    
    LetterGenerator: LetterGenerator,
    
    LetterTemplates: LetterTemplates,
    
    LetterSettings: LetterSettings,
    
    WhatsAppSettings: WhatsAppSettings,
    
    ProgramTypeMaster: ProgramTypeMaster,
    
    UserManagement: UserManagement,
    
    BulkOperations: BulkOperations,
    
    DebugProgramTypes: DebugProgramTypes,
    
    DatabaseViewer: DatabaseViewer,
    
    OperatorLogin: OperatorLogin,
    
    OperatorManagement: OperatorManagement,
    
    PoliticianTypeMaster: PoliticianTypeMaster,
    
    PoliticianEntry: PoliticianEntry,
    
    WhatsAppBulk: WhatsAppBulk,
    BirthdayAnniversaryWishes: BirthdayAnniversaryWishes,
    BirthdayAnniversaryTemplates: BirthdayAnniversaryTemplates,
    MandalMaster: MandalMaster,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    // Check if current route is login page
    const isLoginPage = location.pathname.toLowerCase().includes('operatorlogin');
    
    // If it's login page, render without Layout wrapper
    if (isLoginPage) {
        return (
            <Routes>
                <Route path="/OperatorLogin" element={<OperatorLogin />} />
            </Routes>
        );
    }
    
    // For all other routes, wrap with Layout (which checks authentication)
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/DataEntry" element={<DataEntry />} />
                
                <Route path="/ReminderList" element={<ReminderList />} />
                
                <Route path="/LetterGenerator" element={<LetterGenerator />} />
                
                <Route path="/LetterTemplates" element={<LetterTemplates />} />
                
                <Route path="/LetterSettings" element={<LetterSettings />} />
                
                <Route path="/WhatsAppSettings" element={<WhatsAppSettings />} />
                
                <Route path="/ProgramTypeMaster" element={<ProgramTypeMaster />} />
                
                <Route path="/UserManagement" element={<UserManagement />} />
                
                <Route path="/BulkOperations" element={<BulkOperations />} />
                
                <Route path="/DebugProgramTypes" element={<DebugProgramTypes />} />
                
                <Route path="/DatabaseViewer" element={<DatabaseViewer />} />
                
                <Route path="/OperatorManagement" element={<OperatorManagement />} />
                
                <Route path="/PoliticianTypeMaster" element={<PoliticianTypeMaster />} />
                
                <Route path="/PoliticianEntry" element={<PoliticianEntry />} />
                
                <Route path="/WhatsAppBulk" element={<WhatsAppBulk />} />

                <Route path="/BirthdayAnniversaryWishes" element={<BirthdayAnniversaryWishes />} />
                <Route path="/BirthdayAnniversaryTemplates" element={<BirthdayAnniversaryTemplates />} />
                <Route path="/MandalMaster" element={<MandalMaster />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}