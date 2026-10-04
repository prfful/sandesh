import React, { useState } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Search, Download, Phone, MapPin, Edit, MessageCircle, FileText, Loader2, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, isToday, isThisWeek, addDays, isFuture, parseISO, getYear, isSameDay, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProgramTypeDisplay, { useProgramTypesMap } from "../components/ProgramDisplay";

export default function ReminderList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const initialFilter = urlParams.get('filter') || "today";
  const [filter, setFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sendingPdfWhatsApp, setSendingPdfWhatsApp] = useState(false);
  const [whatsAppDialog, setWhatsAppDialog] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [debugUrl, setDebugUrl] = useState("");
  const [debugDialog, setDebugDialog] = useState(false);
  const programTypesMap = useProgramTypesMap();

  // Helper function to format event_time for display
  const formatEventTime = (time24hr) => {
    if (!time24hr) return "";
    try {
      const [hours, minutes] = time24hr.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return "";

      const hour = hours;
      const timeStr = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`;

      if (hour >= 4 && hour < 12) {
        return `सुबह ${timeStr} बजे`;
      } else if (hour >= 12 && hour < 17) {
        return `दोपहर ${timeStr} बजे`;
      } else if (hour >= 17 && hour < 20) {
        return `शाम ${timeStr} बजे`;
      } else {
        return `रात ${timeStr} बजे`;
      }
    } catch (e) {
      return "";
    }
  };

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => restClient.authMe(),
  });

  const { data: programsRaw, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      // Use the REST client which normalizes many response shapes
      return await restClient.listEntities('Pragram');
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'stale',
  });

  // Normalise the SDK response into an array so components can safely call
  // .filter/.map even when the SDK returns an envelope or keyed object.
  const normalizeList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.results && Array.isArray(data.results)) return data.results;
    // If it's an object keyed by id, return its values
    if (typeof data === 'object') return Object.values(data);
    return [];
  };

  const programs = normalizeList(programsRaw);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear selected programs and UI state when filter changes
  React.useEffect(() => {
    setSelectedPrograms([]);
    setSendingPdfWhatsApp(false);
    setWhatsAppDialog(false);
    setWhatsAppPhone("");
    setMarkingAttendance(false);
    // Update URL to reflect current filter
    window.history.replaceState(null, '', `?filter=${filter}`);
  }, [filter]);

  React.useEffect(() => {
    if (filter !== "range") return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (!fromDate) setFromDate(todayStr);
    if (!toDate) setToDate(todayStr);
  }, [filter, fromDate, toDate]);

  const activateRangeFilter = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setFilter('range');
    if (!fromDate) setFromDate(todayStr);
    if (!toDate) setToDate(todayStr);
  };

  const updateAttendanceMutation = useMutation({
    mutationFn: ({ id, attended }) => restClient.updateEntity('Pragram', id, { Attended: attended }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success("उपस्थिति अपडेट की गई");
    },
  });

  const bulkMarkAttendanceMutation = useMutation({
    mutationFn: async (programIds) => {
      setMarkingAttendance(true);
      const results = { success: 0, failed: 0 };
      for (const id of programIds) {
        try {
          await restClient.updateEntity('Pragram', id, { Attended: true });
          results.success++;
        } catch (error) {
          results.failed++;
          console.error(`Failed to mark program ${id} as attended:`, error);
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success(`${results.success} कार्यक्रम में उपस्थिति दर्ज की गई`);
      setSelectedPrograms([]);
      setMarkingAttendance(false);
    },
    onError: (error) => {
      toast.error("उपस्थिति दर्ज करने में त्रुटि: " + error.message);
      setMarkingAttendance(false);
    }
  });

  // Filter out sended programs for non-admin users
  const userVisiblePrograms = currentUser?.role === 'admin' 
    ? programs 
    : programs.filter(p => !p.sended);

  const filteredPrograms = userVisiblePrograms.filter(program => {
    try {
      let dateMatch = true;

      if (filter !== "all") {
        if (!program.Date || program.Date === '') return false;

        const programDate = parseISO(program.Date);

        // Check if date is valid
        if (isNaN(programDate.getTime())) {
          console.error('Invalid date for program:', program.id, program.Date);
          return false;
        }

        if (filter === "today") {
          dateMatch = isToday(programDate);
        } else if (filter === "tomorrow") {
          // Tomorrow filter - next day only
          const tomorrow = addDays(new Date(), 1);
          dateMatch = isSameDay(programDate, tomorrow);
        } else if (filter === "week") {
          // Rolling 7-day window: today through the next 7 calendar days.
          // Example: if today is Thursday, range includes today + next Thursday.
          const todayStart = startOfDay(new Date());
          const weekEnd = endOfDay(addDays(todayStart, 7));
          dateMatch = programDate >= todayStart && programDate <= weekEnd;
        } else if (filter === "prafull") {
          // Prafull filter - next 7-day rolling week records where prafull is true
          if (!program.prafull) return false;
          const todayStart = startOfDay(new Date());
          const weekEnd = endOfDay(addDays(todayStart, 7));
          dateMatch = programDate >= todayStart && programDate <= weekEnd;
        } else if (filter === "range") {
          const start = fromDate ? startOfDay(parseISO(fromDate)) : null;
          const end = toDate ? endOfDay(parseISO(toDate)) : null;

          if (start && !isNaN(start.getTime()) && end && !isNaN(end.getTime())) {
            dateMatch = programDate >= start && programDate <= end;
          } else if (start && !isNaN(start.getTime())) {
            dateMatch = programDate >= start;
          } else if (end && !isNaN(end.getTime())) {
            dateMatch = programDate <= end;
          } else {
            dateMatch = true;
          }
        } else if (filter === "upcoming") {
          dateMatch = isFuture(programDate);
        }
      } else {
        // "all" filter - current year's invitations only
        if (!program.Date || program.Date === '') return false;
        const programDate = parseISO(program.Date);
        if (isNaN(programDate.getTime())) {
          console.error('Invalid date for program:', program.id, program.Date);
          return false;
        }
        const currentYear = getYear(new Date());
        dateMatch = getYear(programDate) === currentYear;
      }

      const programTypeName = programTypesMap[program.programtyp] || "";
      const searchMatch = debouncedSearch === "" || 
        program.SenderName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        program.Village?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        programTypeName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        program.Mob?.includes(debouncedSearch) ||
        String(program.Sn).includes(debouncedSearch);

      return dateMatch && searchMatch;
    } catch (error) {
      console.error('Invalid date for program:', program.id, program.Date, error);
      return false;
    }
  });

  const generatePDF = async () => {
    if (Object.keys(programTypesMap).length === 0) {
      toast.error("कृपया प्रतीक्षा करें, डेटा लोड हो रहा है...");
      return;
    }

    if (filteredPrograms.length === 0) {
      toast.error("कोई कार्यक्रम नहीं मिला डाउनलोड के लिए");
      return;
    }

    // Sort programs by date and time in ascending order
    const sortedPrograms = [...filteredPrograms].sort((a, b) => {
      const dateA = parseISO(a.Date);
      const dateB = parseISO(b.Date);

      // Sort by date first
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }

      // If dates are same, sort by event_time
      if (a.event_time && b.event_time) {
        return a.event_time.localeCompare(b.event_time);
      } else if (a.event_time) {
        return -1;
      } else if (b.event_time) {
        return 1;
      }
      return 0;
    });

    const programsByDate = {};
    sortedPrograms.forEach(program => {
      const dateKey = format(parseISO(program.Date), 'dd-MM-yyyy');
      if (!programsByDate[dateKey]) {
        programsByDate[dateKey] = [];
      }
      programsByDate[dateKey].push(program);
    });

    // Build table body content
    let tableBodyHtml = '';
    Object.entries(programsByDate).forEach(([dateKey, datePrograms]) => {
      const dateObj = parseISO(datePrograms[0].Date);
      const dayName = format(dateObj, 'EEEE');
      const fullDate = format(dateObj, 'dd MMMM yyyy');
      
      tableBodyHtml += '<tr><td colspan="6" class="date-header">' + dateKey + ' ' + dayName + ', ' + fullDate + '</td></tr>';
      
      datePrograms.forEach(p => {
        const programTypeName = programTypesMap[p.programtyp] || p.programtyp || '';
        const address = [p.Street, p.Village].filter(Boolean).join(', ');
        const district = p.District ? 'जिला ' + p.District : '';
        const eventTime = p.event_time ? formatEventTime(p.event_time) : '';
        const placeTimeText = eventTime ? eventTime + (p.place_time ? '<br>' + p.place_time : '') : (p.place_time || '');
        
        tableBodyHtml += '<tr>';
        tableBodyHtml += '<td><div class="program-type">' + programTypeName + '</div><div class="sn-cell">' + (p.Sn || '') + '</div></td>';
        tableBodyHtml += '<td>' + (p.SenderName || '') + '<br>' + address + ', ' + district + '</td>';
        tableBodyHtml += '<td>' + (p.Mob || '') + '</td>';
        tableBodyHtml += '<td>' + placeTimeText + '</td>';
        tableBodyHtml += '<td>' + (p.ProgramFor ? (p.Relation_to_sender || '') + '<br>' + p.ProgramFor : '') + '</td>';
        const detailText1 = (p.detail || '') + '<br><strong>' + programTypeName + '</strong>';
        const prafullIndicator1 = p.prafull ? '<br><span style="font-size: 11px; color: #666;">निज सहायक/प्रफुल्‍ल</span>' : '';
        tableBodyHtml += '<td>' + detailText1 + prafullIndicator1 + '</td>';
        tableBodyHtml += '</tr>';
      });
    });

    const footerDate = format(new Date(), 'EEEE, MMMM dd, yyyy');

    const htmlContent = '<!DOCTYPE html>' +
      '<html>' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>संदेश - रिमाइंडर सूची</title>' +
      '<style>' +
      '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap");' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: "Noto Sans Devanagari", Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #000; background: white; }' +
      '@page { size: A4 landscape; margin: 10mm; }' +
      '.page { width: 100%; background: white; }' +
      '.header { text-align: center; margin-bottom: 10px; padding: 8px; background: #e0e0e0; }' +
      '.header h1 { font-size: 20px; font-weight: 700; margin-bottom: 5px; }' +
      '.header-section { display: flex; justify-content: space-between; margin-bottom: 10px; }' +
      '.main-program { border: 2px solid #333; padding: 8px; min-height: 60px; flex: 1; }' +
      '.main-program-title { font-weight: 700; font-size: 12px; margin-bottom: 5px; }' +
      'table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      'th { background: #fff; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: 700; font-size: 14px; }' +
      'td { border: 1px solid #000; padding: 5px 4px; vertical-align: top; font-size: 14px; font-weight: 700; }' +
      '.date-header { background: #fff; border: 1px solid #000; padding: 6px; font-weight: 700; font-size: 16px; text-align: center; margin-top: 10px; }' +
      '.program-type { font-weight: 700; font-size: 14px; }' +
      '.sn-cell { text-align: center; font-weight: 700; }' +
      '.footer { text-align: center; margin-top: 10px; padding: 8px; border-top: 1px solid #000; font-size: 10px; }' +
      '.page-break { page-break-after: always; }' +
      '@media print { body { margin: 0; } .page { margin: 0; } }' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<div class="page">' +
      '<div class="header"><h1>संदेश</h1></div>' +
      '<div class="header-section"><div class="main-program"><div class="main-program-title">प्रमुख कार्यक्रम ::</div></div></div>' +
      '<table>' +
      '<thead><tr>' +
      '<th style="width: 10%;">कार्यक्रम व आईडी</th>' +
      '<th style="width: 22%;">प्रेषक का नाम व पता</th>' +
      '<th style="width: 8%;">दूरभाष</th>' +
      '<th style="width: 22%;">कार्यक्रम स्थल</th>' +
      '<th style="width: 20%;">आयोजन किस हेतु</th>' +
      '<th style="width: 18%;">अन्य विवरण</th>' +
      '</tr></thead>' +
      '<tbody>' + tableBodyHtml + '</tbody>' +
      '</table>' +
      '<div class="footer">' + footerDate + ' | कृपया पृष्ठ उलटिये | Page 1 of 1</div>' +
      '</div>' +
      '<script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };<\/script>' +
      '</body>' +
      '</html>';

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("पॉपअप ब्लॉक है! कृपया पॉपअप सक्षम करें");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success("PDF विंडो खुल रही है…");
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error("PDF बनाने में त्रुटि: " + error.message);
    }
  };

  const sendToWhatsApp = () => {
    const message = filteredPrograms.map(p => 
      `📋 ${p.Sn}\n📅 ${format(parseISO(p.Date), 'dd/MM/yyyy')}\n👤 ${p.SenderName}\n📍 ${p.Village}, ${p.District}\n🎉 ${programTypesMap[p.programtyp] || p.programtyp}\n📱 ${p.Mob}\n`
    ).join('\n---\n');
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const generatePdfHtmlContent = () => {
    if (Object.keys(programTypesMap).length === 0 || filteredPrograms.length === 0) {
      return null;
    }

    const sortedPrograms = [...filteredPrograms].sort((a, b) => {
      const dateA = parseISO(a.Date);
      const dateB = parseISO(b.Date);

      // Sort by date first
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }

      // If dates are same, sort by event_time
      if (a.event_time && b.event_time) {
        return a.event_time.localeCompare(b.event_time);
      } else if (a.event_time) {
        return -1;
      } else if (b.event_time) {
        return 1;
      }
      return 0;
    });

    const programsByDate = {};
    sortedPrograms.forEach(program => {
      const dateKey = format(parseISO(program.Date), 'dd-MM-yyyy');
      if (!programsByDate[dateKey]) {
        programsByDate[dateKey] = [];
      }
      programsByDate[dateKey].push(program);
    });

    let tableBodyHtml = '';
    Object.entries(programsByDate).forEach(([dateKey, datePrograms]) => {
      const dateObj = parseISO(datePrograms[0].Date);
      const dayName = format(dateObj, 'EEEE');
      const fullDate = format(dateObj, 'dd MMMM yyyy');
      
      tableBodyHtml += '<tr><td colspan="6" class="date-header">' + dateKey + ' ' + dayName + ', ' + fullDate + '</td></tr>';
      
      datePrograms.forEach(p => {
        const programTypeName = programTypesMap[p.programtyp] || p.programtyp || '';
        const address = [p.Street, p.Village].filter(Boolean).join(', ');
        const district = p.District ? 'जिला ' + p.District : '';
        const eventTime = p.event_time ? formatEventTime(p.event_time) : '';
        const placeTimeText = eventTime ? eventTime + (p.place_time ? '<br>' + p.place_time : '') : (p.place_time || '');
        
        tableBodyHtml += '<tr>';
        tableBodyHtml += '<td><div class="program-type">' + programTypeName + '</div><div class="sn-cell">' + (p.Sn || '') + '</div></td>';
       tableBodyHtml += '<td>' + (p.SenderName || '') + '<br>' + address + ', ' + district + '</td>';
        tableBodyHtml += '<td>' + (p.Mob || '') + '</td>';
        tableBodyHtml += '<td>' + placeTimeText + '</td>';
        tableBodyHtml += '<td>' + (p.ProgramFor ? (p.Relation_to_sender || '') + '<br>' + p.ProgramFor : '') + '</td>';
        const detailText2 = (p.detail || '') + '<br><strong>' + programTypeName + '</strong>';
        const prafullIndicator2 = p.prafull ? '<br><span style="font-size: 11px; color: #666;">निज सहायक/प्रफुल्‍ल</span>' : '';
        tableBodyHtml += '<td>' + detailText2 + prafullIndicator2 + '</td>';
        tableBodyHtml += '</tr>';
      });
    });

    const footerDate = format(new Date(), 'EEEE, MMMM dd, yyyy');

    return '<!DOCTYPE html>' +
      '<html>' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>संदेश - रिमाइंडर सूची</title>' +
      '<style>' +
      '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap");' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: "Noto Sans Devanagari", Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #000; background: white; }' +
      '@page { size: A4 landscape; margin: 10mm; }' +
      '.page { width: 100%; background: white; padding: 20px; }' +
      '.header { text-align: center; margin-bottom: 10px; padding: 8px; background: #e0e0e0; }' +
      '.header h1 { font-size: 20px; font-weight: 700; margin-bottom: 5px; }' +
      '.header-section { display: flex; justify-content: space-between; margin-bottom: 10px; }' +
      '.main-program { border: 2px solid #333; padding: 8px; min-height: 60px; flex: 1; }' +
      '.main-program-title { font-weight: 700; font-size: 12px; margin-bottom: 5px; }' +
      'table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      'th { background: #fff; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: 700; font-size: 14px; }' +
      'td { border: 1px solid #000; padding: 5px 4px; vertical-align: top; font-size: 14px; font-weight: 700; }' +
      '.date-header { background: #fff; border: 1px solid #000; padding: 6px; font-weight: 700; font-size: 16px; text-align: center; margin-top: 10px; }' +
      '.program-type { font-weight: 700; font-size: 14px; }' +
      '.sn-cell { text-align: center; font-weight: 700; }' +
      '.footer { text-align: center; margin-top: 10px; padding: 8px; border-top: 1px solid #000; font-size: 10px; }' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<div class="page">' +
      '<div class="header"><h1>संदेश</h1></div>' +
      '<div class="header-section"><div class="main-program"><div class="main-program-title">प्रमुख कार्यक्रम ::</div></div></div>' +
      '<table>' +
      '<thead><tr>' +
      '<th style="width: 10%;">कार्यक्रम व आईडी</th>' +
      '<th style="width: 22%;">प्रेषक का नाम व पता</th>' +
      '<th style="width: 8%;">दूरभाष</th>' +
      '<th style="width: 22%;">कार्यक्रम स्थल</th>' +
      '<th style="width: 20%;">आयोजन किस हेतु</th>' +
      '<th style="width: 18%;">अन्य विवरण</th>' +
      '</tr></thead>' +
      '<tbody>' + tableBodyHtml + '</tbody>' +
      '</table>' +
      '<div class="footer">' + footerDate + ' | कृपया पृष्ठ उलटिये | Page 1 of 1</div>' +
      '</div>' +
      '</body>' +
      '</html>';
  };

  const sendPdfToWhatsApp = async () => {
    if (!whatsAppPhone || whatsAppPhone.length < 10) {
      toast.error("कृपया सही मोबाइल नंबर दर्ज करें");
      return;
    }

    const htmlContent = generatePdfHtmlContent();
    if (!htmlContent) {
      toast.error("कृपया प्रतीक्षा करें, डेटा लोड हो रहा है...");
      return;
    }

    setSendingPdfWhatsApp(true);
    
    try {
      // Create iframe with HTML content
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '297mm';  // A4 landscape
      iframe.style.height = '210mm';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for content to load
      await new Promise((resolve) => {
        iframe.contentWindow.addEventListener('load', () => {
          setTimeout(resolve, 2000);
        });
      });

      // Import libraries
      const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
      const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm')).default;

      // Get the page element
      const pageElement = iframeDoc.querySelector('.page');

      // Capture with fixed dimensions
      const canvas = await html2canvas(pageElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        removeContainer: true
      });

      // Create PDF with A4 landscape dimensions
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgWidth = 297; // A4 landscape width
      const imgHeight = 210; // A4 landscape height

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');

      // Clean up
      document.body.removeChild(iframe);

      // Convert to blob and upload
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `reminder-list-${Date.now()}.pdf`, { type: 'application/pdf' });

      // Upload via REST client (form-data)
      const formData = new FormData();
      formData.append('file', pdfFile);
      const uploadResp = await restClient.uploadFile(formData);
      // uploadResp shape may vary; try common fields
      const file_url = uploadResp?.file_url || uploadResp?.url || uploadResp?.data?.file_url || uploadResp?.data?.url;

      // Convert relative URL to absolute URL for WhatsApp API
      const absolutePdfUrl = file_url?.startsWith('http') ? file_url : `${window.location.origin}${file_url}`;

      // Send via server function
      const whatsAppResponse = await restClient.invokeFunction('sendWhatsAppPDF', {
        pdfUrl: absolutePdfUrl,
        phone: whatsAppPhone,
        message: 'dharfc_one'
      });

      console.log('WhatsApp API Response:', whatsAppResponse);

      // Check if response indicates debug mode
      if (whatsAppResponse?.debugMode) {
        console.log('Debug mode enabled - showing URL prompt');
        setDebugUrl(whatsAppResponse?.debugUrl);
        setDebugDialog(true);
        setWhatsAppDialog(false);
        toast.info("डिबग मोड: URL कॉपी करके ब्राउज़र में खोलें", { duration: 5000 });
        return;
      }

      // Check if response indicates success (check the actual response format)
      const isSuccess = whatsAppResponse?.success;
      
      if (isSuccess) {
        const messageId = whatsAppResponse?.data?.message_id;
        const statusMsg = whatsAppResponse?.statusMessage || 'PDF भेजा गया!';
        
        toast.success(statusMsg + (messageId ? ` (ID: ${messageId})` : ''), {
          duration: 5000,
        });
        setWhatsAppDialog(false);
        setWhatsAppPhone("");
      } else {
        // Extract detailed error message from response
        const statusCode = whatsAppResponse?.statusCode;
        const statusMessage = whatsAppResponse?.statusMessage;
        const errorMsg = whatsAppResponse?.error;
        
        let detailedError = statusMessage || errorMsg || "WhatsApp भेजने में त्रुटि";
        
        // Add status code for debugging
        if (statusCode && statusCode !== 'NOT_CONFIGURED') {
          detailedError += ` (स्टेटस: ${statusCode})`;
        }
        
        console.error('WhatsApp Send Failed:', {
          statusCode,
          statusMessage,
          error: errorMsg,
          fullResponse: whatsAppResponse
        });
        
        throw new Error(detailedError);
      }
    } catch (error) {
      console.error('WhatsApp PDF error:', error);
      
      let errorMessage = error.message || "PDF भेजने में समस्या";
      
      // Make error messages more user-friendly
      if (errorMessage.includes('401')) {
        errorMessage = '❌ API कुंजी अमान्य है - व्यवस्थापक से संपर्क करें';
      } else if (errorMessage.includes('403')) {
        errorMessage = '❌ फोन नंबर WhatsApp API के लिए अनुमोदित नहीं है';
      } else if (errorMessage.includes('422')) {
        errorMessage = '❌ अनुरोध प्रारूप अमान्य है';
      } else if (errorMessage.includes('NETWORK_ERROR')) {
        errorMessage = '❌ नेटवर्क त्रुटि - इंटरनेट कनेक्शन जांचें';
      } else if (errorMessage.includes('NOT_CONFIGURED')) {
        errorMessage = '❌ WhatsApp API कॉन्फ़िगर नहीं है - व्यवस्थापक से संपर्क करें';
      }
      
      toast.error(errorMessage, {
        duration: 6000,
      });
    } finally {
      setSendingPdfWhatsApp(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            रिमाइंडर सूची
          </h1>
          <p className="text-gray-600 mt-1">आगामी कार्यक्रमों की सूची</p>
        </div>

        <Card className="border-orange-100 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <Tabs value={filter} onValueChange={setFilter} className="w-full md:w-auto">
                <TabsList className="grid grid-cols-6 w-full md:w-auto">
                  <TabsTrigger value="all">सभी</TabsTrigger>
                  <TabsTrigger value="today">आज</TabsTrigger>
                  <TabsTrigger value="tomorrow">कल</TabsTrigger>
                  <TabsTrigger value="week">इस सप्ताह</TabsTrigger>
                  <TabsTrigger value="prafull" className="bg-purple-100 hover:bg-purple-200 data-[state=active]:bg-purple-500 data-[state=active]:text-white">निज सहायक</TabsTrigger>
                  <TabsTrigger value="range" onClick={activateRangeFilter}>दिनांक से फिल्‍टर करे</TabsTrigger>
                </TabsList>
              </Tabs>

              {filter === "range" && (
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">दिनांक से</label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full sm:w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">दिनांक तक</label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full sm:w-40"
                    />
                  </div>
                </div>
              )}

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="नाम, संख्या, गाँव या मोबाइल से खोजें..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <p className="text-gray-600">
            <span className="font-semibold text-gray-900">{filteredPrograms.length}</span> कार्यक्रम मिले
          </p>
          <div className="flex gap-2 flex-wrap">
            {selectedPrograms.length > 0 && (
              <Button 
                onClick={() => {
                  bulkMarkAttendanceMutation.mutate(selectedPrograms);
                }}
                disabled={markingAttendance}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                {markingAttendance ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    उपस्थिति दर्ज की जा रही है...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    उपस्थिति मार्क करे ({selectedPrograms.length})
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={sendToWhatsApp}>
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
            <Button 
              variant="outline" 
              className="gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200" 
              onClick={() => setWhatsAppDialog(true)}
            >
              <FileText className="w-4 h-4" />
              WhatsApp PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={generatePDF}>
              <Download className="w-4 h-4" />
              डाउनलोड
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <Card className="border-orange-100">
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">लोड हो रहा है...</p>
              </CardContent>
            </Card>
          ) : filteredPrograms.length === 0 ? (
            <Card className="border-orange-100">
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">कोई कार्यक्रम नहीं मिला</p>
              </CardContent>
            </Card>
          ) : (
            [...filteredPrograms].sort((a, b) => {
              const dateA = parseISO(a.Date);
              const dateB = parseISO(b.Date);

              // Sort by date first
              if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
              }

              // If dates are same, sort by event_time
              if (a.event_time && b.event_time) {
                return a.event_time.localeCompare(b.event_time);
              } else if (a.event_time) {
                return -1;
              } else if (b.event_time) {
                return 1;
              }
              return 0;
            }).map((program) => (
              <Card key={program.id} className="border-orange-100 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex flex-col items-center justify-center text-white shadow-lg flex-shrink-0">
                        <span className="text-2xl font-bold">
                          {(() => {
                            try {
                              const d = parseISO(program.Date);
                              return !isNaN(d.getTime()) ? format(d, 'd') : '-';
                            } catch { return '-'; }
                          })()}
                        </span>
                        <span className="text-sm">
                          {(() => {
                            try {
                              const d = parseISO(program.Date);
                              return !isNaN(d.getTime()) ? format(d, 'MMM') : '';
                            } catch { return ''; }
                          })()}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-sm font-bold text-gray-600">
                          #{program.Sn}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`select-${program.id}`}
                            checked={selectedPrograms.includes(program.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPrograms(prev => [...prev, program.id]);
                              } else {
                                setSelectedPrograms(prev => prev.filter(id => id !== program.id));
                              }
                            }}
                            className="w-5 h-5 border-2 border-orange-400 cursor-pointer"
                          />
                          <label 
                            htmlFor={`select-${program.id}`}
                            className="text-xs cursor-pointer font-semibold text-gray-700 select-none"
                          >
                            चुनें
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{program.SenderName}</h3>
                          <Badge className="mt-2 bg-orange-100 text-orange-700 hover:bg-orange-200">
                            <ProgramTypeDisplay programTypeId={program.programtyp} />
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          {(() => {
                            try {
                              const d = parseISO(program.Date);
                              return !isNaN(d.getTime()) ? format(d, 'EEEE, dd MMMM yyyy') : '-';
                            } catch { return '-'; }
                          })()}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-gray-700">
                              {[program.Street, program.Village, program.District]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <p className="text-gray-700">{program.Mob}</p>
                        </div>
                      </div>

                      {program.ProgramFor && (
                        <div className="text-sm">
                          <span className="text-gray-600">कार्यक्रम किसके लिए: </span>
                          <span className="font-semibold text-gray-900">{program.ProgramFor}</span>
                          {program.Relation_to_sender && (
                            <span className="text-gray-600"> ({program.Relation_to_sender})</span>
                          )}
                        </div>
                      )}

                      {program.event_time && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">समय: </span>
                          {formatEventTime(program.event_time)}
                        </div>
                      )}

                      {program.place_time && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">स्थान और समय: </span>
                          {program.place_time}
                        </div>
                      )}
                    </div>

                    <div className="flex md:flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(createPageUrl("DataEntry") + `?edit=${program.id}`)}
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        संपादित
                      </Button>
                    </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* WhatsApp PDF Dialog */}
      <Dialog open={whatsAppDialog} onOpenChange={setWhatsAppDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp पर PDF भेजें</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">मोबाइल नंबर</label>
              <Input
                type="tel"
                placeholder="10 अंकों का मोबाइल नंबर"
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                रिमाइंडर सूची PDF इस नंबर पर भेजी जाएगी
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsAppDialog(false)}>
              रद्द करें
            </Button>
            <Button 
              onClick={sendPdfToWhatsApp} 
              disabled={sendingPdfWhatsApp || whatsAppPhone.length < 10}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingPdfWhatsApp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  भेज रहे हैं...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  भेजें
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Debug URL Dialog - Clean and Simple */}
      <Dialog open={debugDialog} onOpenChange={setDebugDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>WhatsApp API डिबग पॉपअप</DialogTitle>
          </DialogHeader>
          
          <div className="bg-white border border-gray-300 rounded p-4 mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">API URL (कॉपी करें):</p>
            <div className="bg-gray-100 border border-gray-400 rounded p-3 font-mono text-xs overflow-x-auto overflow-y-auto max-h-32 break-all whitespace-normal">
              {debugUrl}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(debugUrl);
                toast.success("URL कॉपी किया गया!");
              }}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              कॉपी करें
            </Button>
            <Button 
              onClick={() => {
                window.open(debugUrl, '_blank');
                toast.success("URL ब्राउज़र में खोला गया");
              }}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              ब्राउज़र में खोलें
            </Button>
            <Button variant="outline" onClick={() => setDebugDialog(false)}>
              बंद करें
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}