import React, { useState, useMemo, useEffect } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, CheckCircle, Download, Send, Copy, ExternalLink } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { toast } from "sonner";
import { useProgramTypesMap } from "../components/ProgramDisplay";
import { useIsMobile } from "@/hooks/use-mobile";

export default function LetterGenerator() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSentOnly, setShowSentOnly] = useState(false);
  const [debugDialog, setDebugDialog] = useState(null);
  const itemsPerPage = 20;
  const programTypesMap = useProgramTypesMap();
  const isMobile = useIsMobile();

  const { data: allPrograms = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => restClient.listEntities('Pragram'),
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000, // 30 seconds
  });

  // Extract unique years from data
  const availableYears = useMemo(() => {
    const years = new Set();
    allPrograms.forEach(p => {
      if (p.Date) {
        try {
          const year = new Date(p.Date).getFullYear();
          if (!isNaN(year)) years.add(year);
        } catch {}
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allPrograms]);

  // Filter programs by selected year
  const programs = useMemo(() => {
    if (selectedYear === 'all') return allPrograms;
    return allPrograms.filter(p => {
      try {
        return new Date(p.Date).getFullYear() === parseInt(selectedYear);
      } catch {
        return false;
      }
    });
  }, [allPrograms, selectedYear]);

  const { data: settings } = useQuery({
    queryKey: ['letter-settings'],
    queryFn: async () => {
      try {
        const res = await restClient.listEntities('LetterSettings');
        const rows = Array.isArray(res) ? res : [];
        
        if (!rows.length) {
          console.log('LetterGenerator - No letter settings found, using defaults');
          return null;
        }

        const score = (row) => {
          let value = 0;
          if (row?.letterhead_url) value += 4;
          if (row?.signature_url) value += 4;
          if (row?.design_template) value += 2;
          if (row?.page_size || row?.margin_top || row?.margin_left || row?.margin_right) value += 1;
          return value;
        };

        const record = [...rows].sort((a, b) => {
          const scoreDiff = score(b) - score(a);
          if (scoreDiff !== 0) return scoreDiff;

          const bTs = Date.parse(b?.updated_date || b?.created_date || '') || 0;
          const aTs = Date.parse(a?.updated_date || a?.created_date || '') || 0;
          if (bTs !== aTs) return bTs - aTs;

          const bId = Number(b?.id) || 0;
          const aId = Number(a?.id) || 0;
          return bId - aId;
        })[0] || null;

        console.log('LetterGenerator - Settings loaded:', record);
        return record;
      } catch (error) {
        console.error('Error loading letter settings:', error);
        return null; // Graceful fallback
      }
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['letter-templates'],
    queryFn: () => restClient.listEntities('LetterTemplate'),
    initialData: [],
    retry: 3,
    retryDelay: 1000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const res = await restClient.listEntities('AppSettings');
      return res && res.length ? res[0] : undefined;
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 60000,
  });

  const updateSendedMutation = useMutation({
    mutationFn: async ({ id, Sn }) => {
      const identifier = id && id !== 'null' && id !== 'undefined' ? id : Sn;
      if (identifier === undefined || identifier === null || identifier === '') {
        throw new Error('कार्यक्रम की पहचान उपलब्ध नहीं है');
      }
      return restClient.updateEntity('Pragram', identifier, { sended: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (error) => {
      toast.error(`पत्र को "पत्र लिखे जा चुके" में स्थानांतरित नहीं किया जा सका: ${error.message || 'अज्ञात त्रुटि'}`);
    },
  });

  const eligiblePrograms = useMemo(() => {
    return programs.filter(program => {
      if (!program.Date || program.Date === '' || program.Attended) return false;
      try {
        const programDate = parseISO(program.Date);
        if (isNaN(programDate.getTime())) return false;
        return isPast(programDate);
      } catch (error) {
        return false;
      }
    });
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    const filtered = eligiblePrograms.filter(program => (showSentOnly ? !!program.sended : !program.sended));
    
    // Sort by date in descending order (latest first) when showing sent letters
    if (showSentOnly) {
      return filtered.sort((a, b) => {
        try {
          const dateA = new Date(a.Date);
          const dateB = new Date(b.Date);
          return dateB - dateA; // Descending order
        } catch {
          return 0;
        }
      });
    }
    
    return filtered;
  }, [eligiblePrograms, showSentOnly]);

  useEffect(() => {
    setSelectedPrograms([]);
    setCurrentPage(1);
  }, [showSentOnly, selectedYear]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
    queryClient.invalidateQueries({ queryKey: ['letter-settings'] });

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);

  const toggleSelection = (programId) => {
    setSelectedPrograms(prev => 
      prev.includes(programId) 
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPrograms.length === filteredPrograms.length) {
      setSelectedPrograms([]);
    } else {
      setSelectedPrograms(filteredPrograms.map(p => p.id));
    }
  };

  // Format letter body with paragraph indentation
  // Each paragraph wrapped in <p> tag with CSS text-indent for first line only
  const formatLetterBodyWithParagraphs = (body) => {
    if (!body) {
      console.warn('formatLetterBodyWithParagraphs: Empty body received');
      return '';
    }

    console.log('=== Paragraph Formatting Debug ===');
    console.log('Input body length:', body.length);
    console.log('Input body (first 100 chars):', body.substring(0, 100));

    let paragraphs = [];

    // Step 1: Try splitting on blank lines first (primary method)
    paragraphs = body
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    console.log('After blank line split:', paragraphs.length, 'paragraphs');

    // Step 2: If only one paragraph and it's very long, split by sentences
    if (paragraphs.length === 1 && paragraphs[0].length > 200) {
      console.log('Single long paragraph detected, splitting by sentences...');
      const text = paragraphs[0];
      const sentences = [];
      let current = '';
      
      for (let i = 0; i < text.length; i++) {
        current += text[i];
        // Split on devanagari punctuation marks or English punctuation
        if (/(।।|।|\?|!)/.test(text.substring(Math.max(0, i - 2), i + 1))) {
          sentences.push(current.trim());
          current = '';
        }
      }
      if (current.trim()) sentences.push(current.trim());
      
      console.log('Found', sentences.length, 'sentences');
      
      // Group sentences into paragraphs (2-3 sentences per paragraph)
      paragraphs = [];
      for (let i = 0; i < sentences.length; i += 2) {
        const para = sentences.slice(i, i + 2).join(' ');
        if (para.trim()) paragraphs.push(para.trim());
      }
    }

    // Step 3: Fallback - if still no paragraphs, wrap the entire body as one
    if (paragraphs.length === 0) {
      console.log('No paragraphs detected, using full body as single paragraph');
      paragraphs = [body.trim()];
    }

    console.log('Final paragraph count:', paragraphs.length);

    // Wrap each paragraph in <p> tag - NO HTML escaping (breaks content)
    const result = paragraphs
      .map(p => `<p class="hindi-para">${p}</p>`)
      .join('');
    
    console.log('Formatted HTML length:', result.length);
    console.log('Formatted HTML (first 200 chars):', result.substring(0, 200));
    
    return result;
  };

  const generatePDFHtml = (letterData) => {
    const pageSize = settings?.page_size || "A4";
    const width = settings?.page_width || 210;
    const height = settings?.page_height || 297;
    const unit = settings?.margin_unit || "mm";
    const marginTop = settings?.margin_top ?? 5;
    const marginBottom = settings?.margin_bottom || 20;
    const marginLeft = settings?.margin_left || 20;
    const marginRight = settings?.margin_right || 20;

    const convertToMm = (value, fromUnit) => {
      return fromUnit === "inch" ? value * 25.4 : value;
    };

    const topMm = convertToMm(marginTop, unit);
    const bottomMm = convertToMm(marginBottom, unit);
    const leftMm = convertToMm(marginLeft, unit);
    const rightMm = convertToMm(marginRight, unit);

    // Image positioning settings
    const letterheadTopMargin = settings?.letterhead_top_margin || 0;
    const letterheadHeight = settings?.letterhead_height || 80;
    const letterheadWidth = settings?.letterhead_width || 100;
    const configuredContentStartMargin = Number(settings?.content_start_margin || 90);
    const signatureRightMargin = settings?.signature_right_margin || 20;
    const signatureBottomMargin = settings?.signature_bottom_margin || 80;
    const signatureHeight = settings?.signature_height || 60;

    const template = letterData.template;
    const hasTemplateImages = template && (template.letterhead_url || template.signature_url || template.signature2_url);

    if (!template || (!template.letterhead_url && !template.signature_url && !template.signature2_url)) {
      console.warn('Template images missing or template not loaded properly', { template });
    }

    // Convert relative URLs to absolute URLs for PDF generation
    const toAbsoluteUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/')) {
        // Use current window location origin for both localhost and production
        const baseUrl = window.location.origin;
        return `${baseUrl}${url}`;
      }
      return url;
    };

    // Resolve image URLs for PDF / preview rendering.
    // base64 data-URLs are stored directly in the DB and returned as-is.
    // Legacy /uploads/ path references are converted to absolute URLs.
    const toDirectUploadUrl = (url) => {
      if (!url) return '';
      // base64 data-URL stored in DB — use directly, no transformation needed.
      if (url.startsWith('data:')) return url;
      if (url.includes('/uploads/')) {
        return toAbsoluteUrl(url.substring(url.indexOf('/uploads/')));
      }
      return toAbsoluteUrl(url);
    };

    // Determine effective image URLs from TEMPLATE only
    // Letter Template Editor is the single source of truth for image assets
    let effectiveLetterheadUrl = '';
    let effectiveSignatureUrl = '';
    let effectiveSignature2Url = '';
    
    if (template?.letterhead_url && template.letterhead_url !== 'null' && template.letterhead_url.trim().length > 0) {
      effectiveLetterheadUrl = toDirectUploadUrl(template.letterhead_url);
    }
    
    if (template?.signature_url && template.signature_url !== 'null' && template.signature_url.trim().length > 0) {
      effectiveSignatureUrl = toDirectUploadUrl(template.signature_url);
    }
    
    if (template?.signature2_url && template.signature2_url !== 'null' && template.signature2_url.trim().length > 0) {
      effectiveSignature2Url = toDirectUploadUrl(template.signature2_url);
    }

    // Debug logging
    console.log('=== PDF Image Debug ===');
    console.log('Template letterhead:', template?.letterhead_url);
    console.log('Template signature:', template?.signature_url);
    console.log('Template signature2:', template?.signature2_url);
    console.log('Will render letterhead:', effectiveLetterheadUrl);
    console.log('Will render signature:', effectiveSignatureUrl);
    console.log('Will render signature2:', effectiveSignature2Url);
    
    // For html2pdf/canvas rendering, only render if we have valid URLs
    const renderLetterheadImage = effectiveLetterheadUrl.length > 0;
    const renderSignatureImage = effectiveSignatureUrl.length > 0;
    const renderSignature2Image = effectiveSignature2Url.length > 0;

    const templateBodyTopOffset = Number(template?.body_content_top_offset_mm);
    const bodyContentTopOffsetMm = templateBodyTopOffset > 0
      ? templateBodyTopOffset
      : configuredContentStartMargin;

    const templateSignatureOffset = Number(template?.signature_bottom_offset_mm);
    const signatureSectionOffsetMm = templateSignatureOffset > 0
      ? templateSignatureOffset
      : signatureBottomMargin;

    // If no letterhead image, do not keep large top gap reserved for it
    const contentStartMargin = renderLetterheadImage
      ? bodyContentTopOffsetMm
      : Math.max(10, topMm + 4);

    // Convert mm to pixels (96 DPI: 1mm = 3.779528px)
    const mmToPx = (mm) => Math.round(mm * 3.779528);
    
    // Use template drag positions (percent) for letterhead/signature when available
    const letterheadX = Number(template?.letterhead_x ?? 0);
    const letterheadY = Number(template?.letterhead_y ?? 0);
    const letterheadWidthPct = Number(template?.letterhead_width ?? 100);
    const letterheadHeightPct = template?.letterhead_height != null ? Number(template.letterhead_height) : null;

    const signatureX = Number(template?.signature_x ?? 70);
    const signatureY = Number(template?.signature_y ?? 75);
    const signatureWidthPct = Number(template?.signature_width ?? 25);
    const signatureHeightPct = template?.signature_height != null ? Number(template.signature_height) : null;

    const hasSignaturePosition = !Number.isNaN(signatureX) && !Number.isNaN(signatureY);
    const hasLetterheadPosition = !Number.isNaN(letterheadX) && !Number.isNaN(letterheadY);

    // Convert percentage-based dimensions to absolute mm for backend compatibility
    const percentToMm = (percent, dimension) => {
      return (percent / 100) * dimension;
    };

    const textLeftPadMm = Number(template?.paragraph_left_mm) || 5;
    const textRightPadMm = Number(template?.paragraph_right_mm) || signatureRightMargin;
    const firstLineIndentMm = Number(template?.first_line_indent_mm) || 15;
    const fontFamily = (template?.font_family && template.font_family.trim()) || 'Noto Sans Devanagari, Arial, sans-serif';
    const fontSizePx = Number(template?.font_size) || 16;
    const lineHeightValue = Number(template?.line_height);
    const lineHeight = lineHeightValue > 0 ? lineHeightValue : 1.5;

    // Calculate recipient info position (below signature when using template positioning)
    const recipientTopPct = hasTemplateImages && hasSignaturePosition ? signatureY + (signatureHeightPct || 15) + 2 : null;
    // Align recipient to left margin (convert mm to percentage of page width)
    const recipientLeftPct = (textLeftPadMm / width) * 100;

    console.log('Layout params:', {
      textLeftPadMm,
      textRightPadMm,
      firstLineIndentMm,
      fontSizePx,
      lineHeight,
      marginLeft: leftMm,
      marginRight: rightMm,
      bodyContentTopOffsetMm,
      signatureSectionOffsetMm
    });
    
    // Convert all mm values to pixels for html2pdf
    const pagePaddingTopPx = mmToPx(topMm);
    const pagePaddingRightPx = mmToPx(rightMm);
    const pagePaddingBottomPx = mmToPx(bottomMm);
    const pagePaddingLeftPx = mmToPx(leftMm);
    const textLeftPadPx = mmToPx(textLeftPadMm);
    const textRightPadPx = mmToPx(textRightPadMm);
    const firstLineIndentPx = mmToPx(firstLineIndentMm);
    const letterheadHeightPx = mmToPx(letterheadHeight);
    const signatureHeightPx = mmToPx(signatureHeight);
    const signatureRightMarginPx = mmToPx(signatureRightMargin);

    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title></title>
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ${JSON.stringify(fontFamily)};
      margin: 0;
      padding: 0;
      background: white;
      line-height: ${lineHeight};
    }

    /* A4 Page Setup for image rendering - simple block layout */
    .page {
      width: 794px;
      min-height: 1123px;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      background: white;
      color: #000;
      font-size: ${fontSizePx}px;
      line-height: ${lineHeight};
      position: relative;
    }

    .page-content {
      /* Apply margins/padding in pixels */
      margin: 0;
      padding: ${pagePaddingTopPx}px ${pagePaddingRightPx}px ${pagePaddingBottomPx}px ${pagePaddingLeftPx}px;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      min-height: 1000px;
    }

    .letterhead {
      position: relative;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      margin: 0 0 ${mmToPx(contentStartMargin)}px 0;
      padding: 0;
      text-align: left;
      z-index: 1;
    }

    .letterhead img {
      max-height: ${letterheadHeightPx}px;
      width: ${letterheadWidth}%;
      max-width: 100%;
      object-fit: contain;
      display: block;
      margin: 0;
    }

    .letter-number-date {
      display: flex;
      justify-content: space-between;
      margin: 8px 0 12px 0;
      padding: 0 ${textRightPadPx}px 0 ${textLeftPadPx}px;
      font-size: 14px;
      font-weight: 600;
      clear: both;
    }

    .main-content {
      margin-top: ${hasTemplateImages && hasLetterheadPosition ? mmToPx(bodyContentTopOffsetMm) : 0}px;
    }

    .letter-body {
      text-align: justify;
      margin: 12px 0 16px 0;
      padding: 0 ${textRightPadPx}px 0 ${textLeftPadPx}px;
      font-size: ${fontSizePx}px;
      line-height: ${lineHeight};
      word-break: break-word;
      word-wrap: break-word;
      overflow-wrap: break-word;
      min-height: auto;
      max-width: 100%;
      clear: both;
    }
    
    .hindi-para {
      text-align: justify;
      text-indent: ${firstLineIndentPx}px;
      margin: 0 0 ${mmToPx(12)}px 0;
      word-break: break-word;
      line-height: ${lineHeight};
      padding: 0;
      page-break-inside: avoid;
      orphans: 3;
      widows: 3;
    }

    .closing {
      margin: 16px 0 12px 0;
      padding: 0 ${textRightPadPx}px 0 ${textLeftPadPx}px;
      font-size: 15px;
    }

    .signature-section {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0;
      margin-top: ${mmToPx(signatureSectionOffsetMm)}px;
      margin-right: ${textRightPadPx}px;
      padding: 0 ${textRightPadPx}px 0 ${textLeftPadPx}px;
    }

    .signature-section img {
      height: ${signatureHeightPx}px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
      display: block;
      margin-bottom: 4px;
    }

    .signature-name {
      font-weight: 700;
      font-size: 16px;
      margin-top: 5px;
      white-space: nowrap;
      text-align: center;
      width: 100%;
    }

    /* Absolute placement when template defines positions */
    .letterhead-abs {
      position: absolute;
      object-fit: contain;
      pointer-events: none;
      z-index: 1;
    }
    .signature-abs {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: 0;
      pointer-events: none;
      align-items: flex-start;
      z-index: 2;
    }
    .recipient-info-abs {
      position: absolute;
      z-index: 3;
      font-size: ${fontSizePx}px;
      line-height: ${lineHeight};
      padding: 0 ${textRightPadPx}px 0 ${textLeftPadPx}px;
    }

    .recipient-info {
      margin-top: 16px;
      padding: 0 ${textRightPadPx}px 0 ${textLeftPadPx}px;
      font-size: ${fontSizePx}px;
      line-height: ${lineHeight};
    }

    .recipient-label {
      font-weight: 700;
      margin: 0 0 4px 0;
      padding: 0;
      text-indent: 0;
    }

    .recipient-name {
      white-space: nowrap;
      margin: 0;
      padding: 0;
      padding-left: ${firstLineIndentPx + mmToPx(4)}px;
    }

    .recipient-info > div {
      margin: 0;
      padding: 0;
    }

    .recipient-info > div:not(.recipient-label) {
      padding-left: ${firstLineIndentPx + mmToPx(4)}px;
    }

    .recipient-info-abs > div {
      margin: 0;
      padding: 0;
    }

    .recipient-info-abs > div:not(.recipient-label) {
      padding-left: ${firstLineIndentPx + mmToPx(4)}px;
    }

    /* No media print needed - html2pdf handles this */
  </style>
  </head>
  <body>
  <div class="page">
    <div class="page-content">
    ${renderLetterheadImage ? (
      hasTemplateImages && hasLetterheadPosition ? `
        <img class="letterhead-abs" src="${effectiveLetterheadUrl}" alt="Letterhead" crossorigin="anonymous"
          style="top:${letterheadY}%; left:${letterheadX}%; width:${letterheadWidthPct}%; ${letterheadHeightPct !== null ? `height:${letterheadHeightPct}%;` : 'height:auto;'}" />
      ` : `
        <div class="letterhead">
          <img src="${effectiveLetterheadUrl}" alt="Letterhead" crossorigin="anonymous" />
        </div>
      `
    ) : `<div style="text-align:center; color:#999; margin:20px 0; font-size:12px;">[Letterhead image not configured - go to Letter Settings to upload]</div>`}

    <div class="main-content">
      <div class="letter-number-date">
        <div>क्रमांक: ${letterData.invitationNumber}</div>
        <div>दिनांक: ${letterData.date}</div>
      </div>

      <div class="letter-body">${formatLetterBodyWithParagraphs(letterData.body)}</div>

      ${letterData.closing ? `<div class="closing">${letterData.closing}</div>` : ''}
    </div>

    ${renderSignatureImage || renderSignature2Image ? (
      hasTemplateImages && hasSignaturePosition ? `
        <div class="signature-abs" style="top:${signatureY}%; left:${signatureX}%; width:${signatureWidthPct}%; ${signatureHeightPct !== null ? `height:${signatureHeightPct}%;` : ''}">
          ${renderSignature2Image ? `
            <div style="display: flex; justify-content: space-around; align-items: flex-end; width: 100%; gap: ${mmToPx(20)}px;">
              <div style="flex: 1; text-align: center;">
                <img src="${effectiveSignatureUrl}" alt="Signature 1" crossorigin="anonymous" style="width:100%; height:auto; object-fit:contain;" />
                ${template?.signature_label ? `<div class="signature-name">${template.signature_label}</div>` : (letterData.senderName ? `<div class="signature-name">(${letterData.senderName})</div>` : '')}
              </div>
              <div style="flex: 1; text-align: center;">
                <img src="${effectiveSignature2Url}" alt="Signature 2" crossorigin="anonymous" style="width:100%; height:auto; object-fit:contain;" />
                ${template?.signature2_label ? `<div class="signature-name">${template.signature2_label}</div>` : '<div class="signature-name">(सह हस्ताक्षरकर्ता)</div>'}
              </div>
            </div>
          ` : `
            <img src="${effectiveSignatureUrl}" alt="Signature" crossorigin="anonymous" style="width:100%; ${signatureHeightPct !== null ? `height:100%;` : 'height:auto;'} object-fit:contain;" />
            ${template?.signature_label ? `<div class="signature-name">${template.signature_label}</div>` : (letterData.senderName ? `<div class="signature-name">(${letterData.senderName})</div>` : '')}
          `}
        </div>
        <div class="recipient-info-abs" style="top:${recipientTopPct}%; left:${recipientLeftPct}%;">
          <div class="recipient-label">प्रति,</div>
          <div class="recipient-name">${letterData.recipientName},</div>
          <div>${letterData.street ? letterData.street + ', ' : ''}${letterData.village}</div>
          <div>जिला-${letterData.district}</div>
        </div>
      ` : `
        <div class="signature-section">
          ${renderSignature2Image ? `
            <div style="display: flex; justify-content: space-around; align-items: flex-end; gap: ${mmToPx(20)}px; margin: 0 auto; max-width: 600px;">
              <div style="flex: 1; text-align: center;">
                <img src="${effectiveSignatureUrl}" alt="Signature 1" crossorigin="anonymous" style="width:100%; height:auto; object-fit:contain;" />
                ${template?.signature_label ? `<div class="signature-name">${template.signature_label}</div>` : (letterData.senderName ? `<div class="signature-name">(${letterData.senderName})</div>` : '')}
              </div>
              <div style="flex: 1; text-align: center;">
                <img src="${effectiveSignature2Url}" alt="Signature 2" crossorigin="anonymous" style="width:100%; height:auto; object-fit:contain;" />
                ${template?.signature2_label ? `<div class="signature-name">${template.signature2_label}</div>` : '<div class="signature-name">(सह हस्ताक्षरकर्ता)</div>'}
              </div>
            </div>
          ` : `
            <img src="${effectiveSignatureUrl}" alt="Signature" crossorigin="anonymous" />
            ${template?.signature_label ? `<div class="signature-name">${template.signature_label}</div>` : (letterData.senderName ? `<div class="signature-name">(${letterData.senderName})</div>` : '')}
          `}
        </div>
        <div class="recipient-info">
          <div class="recipient-label">प्रति,</div>
          <div class="recipient-name">${letterData.recipientName},</div>
          <div>${letterData.street ? letterData.street + ', ' : ''}${letterData.village}</div>
          <div>जिला-${letterData.district}</div>
        </div>
      `
    ) : `
      <div class="signature-section">
        <div style="text-align:center; color:#999; margin:20px 0; font-size:12px;">[Signature image not configured - go to Letter Settings to upload]</div>
      </div>
      <div class="recipient-info">
        <div class="recipient-label">प्रति,</div>
        <div class="recipient-name">${letterData.recipientName},</div>
        <div>${letterData.street ? letterData.street + ', ' : ''}${letterData.village}</div>
        <div>जिला-${letterData.district}</div>
      </div>
    `}
    </div>
  </div>
  </body>
  </html>
      `;
  };

  const downloadImageFromHtml = async (html, filename) => {
    let container = null;
    try {
      console.log('=== Generating JPEG Image ===');

      if (!window.html2canvas) {
        throw new Error('html2canvas library not loaded. Please refresh the page.');
      }

      // Create hidden container (positioned off-screen, not invisible)
      const doc = new DOMParser().parseFromString(html, 'text/html');
      container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';  // Off-screen, but still renderable
      container.style.top = '0';
      container.style.width = '794px';
      container.style.margin = '0';
      container.style.padding = '0';
      container.style.background = 'white';
      container.style.zIndex = '-1';

      // Copy styles
      const baseStyle = document.createElement('style');
      baseStyle.textContent = `
        html, body { margin: 0; padding: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `;
      container.appendChild(baseStyle);

      if (doc?.head) {
        doc.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
          container.appendChild(node.cloneNode(true));
        });
      }

      if (doc?.body?.innerHTML) {
        container.insertAdjacentHTML('beforeend', doc.body.innerHTML);
      }

      document.body.appendChild(container);

      // Wait for fonts
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Log rendered dimensions
      const pageElementDim = container.querySelector('.page');
      if (pageElementDim) {
        console.log('Page element dimensions:', {
          width: pageElementDim.offsetWidth || pageElementDim.scrollWidth,
          height: pageElementDim.offsetHeight || pageElementDim.scrollHeight
        });
      }

      // Wait for images with detailed logging
      const images = container.querySelectorAll('img');
      console.log('Found', images.length, 'images in DOM');
      
      // Log each image
      images.forEach((img, idx) => {
        console.log(`Image ${idx}:`, {
          src: img.src?.substring(0, 50),
          complete: img.complete,
          width: img.naturalWidth,
          height: img.naturalHeight,
          display: window.getComputedStyle(img).display,
          classList: img.className
        });
      });

      // Wait for images to load
      await Promise.all(Array.from(images).map((img, idx) => new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          console.log(`Image ${idx} already loaded`);
          resolve();
          return;
        }
        
        const timeout = setTimeout(() => {
          console.warn(`Image ${idx} timeout after 3s`);
          resolve(); // Continue anyway
        }, 3000);
        
        img.onload = () => {
          clearTimeout(timeout);
          console.log(`Image ${idx} loaded: ${img.naturalWidth}x${img.naturalHeight}`);
          resolve();
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          console.warn(`Image ${idx} failed to load:`, img.src);
          resolve(); // Continue anyway
        };
      })));
      
      console.log('All images processed');

      // Log the actual page content
      const pageElem = container.querySelector('.page');
      if (pageElem) {
        const htmlPreview = pageElem.innerHTML;
        console.log('=== HTML CONTENT ANALYSIS ===');
        console.log('Page HTML length:', htmlPreview.length);
        console.log('Has <img> tags:', htmlPreview.includes('<img'));
        console.log('Has letterhead:', htmlPreview.includes('letterhead'));
        console.log('Has signature:', htmlPreview.includes('signature'));
        
        // Extract and log all image sources
        const imgMatches = htmlPreview.match(/src="([^"]*)"/g) || [];
        console.log('Image src values found:', imgMatches.length);
        imgMatches.forEach((match, idx) => {
          console.log(`  Image ${idx}: ${match}`);
        });
        
        console.log('Page element HTML preview:', htmlPreview.substring(0, 500));
        console.log('Page computed style - color:', window.getComputedStyle(pageElem).color);
        console.log('Page computed style - background:', window.getComputedStyle(pageElem).backgroundColor);
        console.log('Page element visible:', pageElem.offsetParent !== null);
      }

      // Log the actual page content
      const pageContent = container.querySelector('.page-content');
      if (pageContent) {
        console.log('Page-content children count:', pageContent.children.length);
        console.log('Page-content innerHTML length:', pageContent.innerHTML.length);
      }

      // Wait longer for full rendering
      await new Promise(r => setTimeout(r, 1000));

      const renderElement = pageElem || container;

      // Render to canvas then JPEG - force A4 portrait aspect ratio
      console.log('Starting canvas rendering with scale 2...');
      const canvas = await window.html2canvas(renderElement, {
        scale: 2,                    // 2x for high quality (794x1123 → 1588x2246)
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        imageTimeout: 5000,
        windowWidth: 794,            // Force A4 width
        windowHeight: 1123           // Force A4 height (portrait)
      });

      console.log('Canvas created:', canvas.width, 'x', canvas.height, '(aspect ratio:', (canvas.width/canvas.height).toFixed(2), ')');

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('छवि फ़ाइल तैयार नहीं हो सकी'));
          }
        }, 'image/jpeg', 0.95);
      });
      console.log('Blob created:', (blob.size / 1024).toFixed(2), 'KB');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.replace('.pdf', '.jpg');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (err) {
      console.error('Image generation error:', err);
      toast.error(`Error: ${err.message}`);
      throw err;
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  // Wrapper function to maintain API compatibility
  const downloadImageHybrid = async (html, filename) => {
    console.log('=== Image Generation (JPEG Format) ===');
    await downloadImageFromHtml(html, filename);
  };

  const getTemplateForProgram = (programTypeId) => {
    if (!programTypeId) return templates.find(t => t.is_default || t.program_type === null || t.program_type === "default") || null;
    
    const programTypeName = programTypesMap[programTypeId];
    if (!programTypeName) {
      console.warn(`Program type name not found for UUID: ${programTypeId}. Available UUIDs:`, Object.keys(programTypesMap));
      return templates.find(t => t.is_default || t.program_type === null || t.program_type === "default") || null;
    }
    
    const normalizedProgramType = String(programTypeName).trim().normalize('NFC');
    
    let template = templates.find(t => {
      if (!t.program_type || t.program_type === "default") return false;
      return String(t.program_type).trim().normalize('NFC') === normalizedProgramType;
    });
    
    if (!template) {
      template = templates.find(t => t.is_default || t.program_type === null || t.program_type === "default");
    }

    const defaultTemplate = {
      body: '',
      closing: '',
      sender_name: '',
      sender_title: '',
      sender_subtitle: '',
      sender_location: '',
      sender_address1: '',
      sender_address2: '',
      letterhead_url: '',
      signature_url: '',
      signature2_url: '',
      program_type: 'default',
    };
    
    return template || defaultTemplate;
  };

  const replacePlaceholders = (text, program) => {
    if (!text) return text;
    const programTypeName = programTypesMap[program.programtyp] || program.programtyp || '';
    return text
      .replace(/\{SenderName\}/g, program.SenderName || '')
      .replace(/\{Street\}/g, program.Street || '')
      .replace(/\{Village\}/g, program.Village || '')
      .replace(/\{District\}/g, program.District || '')
      .replace(/\{Mob\}/g, program.Mob || '')
      .replace(/\{Date\}/g, format(parseISO(program.Date), 'dd MMMM yyyy'))
      .replace(/\{ProgramType\}/g, programTypeName)
      .replace(/\{programtyp\}/g, programTypeName)
      .replace(/\{place_time\}/g, program.place_time || '')
      .replace(/\{LocalProgram\}/g, program.LocalProgram || '')
      .replace(/\{ProgramFor\}/g, program.ProgramFor || '')
      .replace(/\{Relation_to_sender\}/g, program.Relation_to_sender || '')
      .replace(/\{Relation\}/g, program.Relation_to_sender || '')
      .replace(/\{detail\}/g, program.detail || '')
      .replace(/\{Sn\}/g, program.Sn || '');
  };

  // Function to get color classes for different program types
  const getProgramTypeColor = (programTypeName) => {
    const type = String(programTypeName || '').toLowerCase().trim();

    // Define color mappings for different program types
    const colorMap = {
      'विवाह': 'bg-blue-100 text-blue-700',
      'विवाह ': 'bg-blue-100 text-blue-700', // with space
      'पगडी': 'bg-green-100 text-green-700',
      'पगड़ी': 'bg-green-100 text-green-700', // alternative spelling
      'सामुहिक': 'bg-purple-100 text-purple-700',
      'गृहप्रवेश': 'bg-yellow-100 text-yellow-700',
      'ग्रहप्रवेश': 'bg-yellow-100 text-yellow-700', // alternative spelling
      'जन्मदिन': 'bg-pink-100 text-pink-700',
      'जन्मदिवस': 'bg-pink-100 text-pink-700',
      'वर्षगांठ': 'bg-indigo-100 text-indigo-700',
      'वर्षगाँठ': 'bg-indigo-100 text-indigo-700', // with matra
      'पूजा': 'bg-red-100 text-red-700',
      'यज्ञ': 'bg-orange-100 text-orange-700',
      'उत्सव': 'bg-teal-100 text-teal-700',
      'समारोह': 'bg-cyan-100 text-cyan-700',
      'अनुष्ठान': 'bg-lime-100 text-lime-700',
      'धार्मिक': 'bg-emerald-100 text-emerald-700',
    };

    // Return the color class or default to orange if not found
    return colorMap[type] || 'bg-orange-100 text-orange-700';
  };

  const handleGenerateSingle = async (program, action) => {
    console.log('=== handleGenerateSingle called ===');
    console.log('Action:', action);
    console.log('Program Sn:', program.Sn);
    console.log('Program Name:', program.SenderName);
    console.log('Program ID:', program.id);

    if (action === 'pdf' && isMobile) {
      toast.error('मोबाइल पर छवि जनरेशन अस्थायी रूप से बंद है। कृपया डेस्कटॉप/लैपटॉप से करें।');
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['letter-templates'] });
    const template = getTemplateForProgram(program.programtyp);
    const programTypeName = programTypesMap[program.programtyp] || program.programtyp;
    
    // Use default template values if no template found
    const defaultTemplate = {
      body: `आपके द्वारा भेजे गए ${programTypeName} के निमंत्रण पत्र के लिए हार्दिक धन्यवाद। आपके परिवार में आयोजित इस शुभ अवसर पर मेरी ओर से हार्दिक शुभकामनाएं।`,
      closing: "शुभकामनाओं सहित।",
      sender_name: "",
      sender_title: "",
      sender_subtitle: "",
      sender_location: "",
      sender_address1: "",
      sender_address2: ""
    };
    
    const activeTemplate = template || defaultTemplate;
    
    console.log('=== TEMPLATE DEBUG ===');
    console.log('Template found:', !!template);
    console.log('Template body:', activeTemplate.body);
    console.log('Template body length:', activeTemplate.body?.length);

    const resolvedBodyTemplate = (activeTemplate.body || '').trim();
    const resolvedClosingTemplate = (activeTemplate.closing || '').trim();

    const letterData = {
      template: activeTemplate,
      senderName: (activeTemplate.sender_name || "").trim(),
      senderTitle: (activeTemplate.sender_title || "").trim(),
      senderSubtitle: (activeTemplate.sender_subtitle || "").trim(),
      senderLocation: (activeTemplate.sender_location || "").trim(),
      senderAddress1: (activeTemplate.sender_address1 || "").trim(),
      senderAddress2: (activeTemplate.sender_address2 || "").trim(),
      body: replacePlaceholders(resolvedBodyTemplate || "प्रिय मित्र,\n\nआपको सूचित करते हुए हर्ष है।\n\nधन्यवाद।", program),
      closing: replacePlaceholders(resolvedClosingTemplate || "शुभकामनाओं सहित।", program),
      recipientName: program.SenderName,
      street: program.Street || '',
      village: program.Village,
      district: program.District,
      date: format(new Date(), 'dd-MM-yyyy'),
      invitationNumber: program.Sn
    };
    
    console.log('Active Template:', activeTemplate);
    console.log('Letter body after replacement:', letterData.body);
    console.log('Letter body length:', letterData.body?.length);

    if (action === 'pdf') {
      const toastId = toast.loading("छवि तैयार हो रहा है...");

      try {
        const htmlContent = generatePDFHtml(letterData);
        console.log('Generated HTML (first 1000 chars):', htmlContent.substring(0, 1000));
        console.log('Generated HTML includes letter body:', htmlContent.includes(letterData.body?.substring(0, 50)));
        await downloadImageHybrid(htmlContent, `letter-${program.Sn || 'single'}.jpg`);
      } catch (error) {
        console.error('Single image generation error:', error);
        toast.error(`छवि बनाने में त्रुटि: ${error.message || 'Unknown error'}`, { id: toastId });
        return;
      }

      try {
        await updateSendedMutation.mutateAsync({ id: program.id, Sn: program.Sn });
        toast.success('छवि डाउनलोड हुई और पत्र "पत्र लिखे जा चुके" में जोड़ दिया गया।', { id: toastId });
      } catch (error) {
        console.error('Failed to update sent status after image download:', error);
      }
    } else if (action === 'whatsapp') {
        const toastId = toast.loading("छवि बना रहे हैं...");
        console.log('WhatsApp action started for program:', program.Sn, program.SenderName);

        try {
          // Generate PDF in browser using print CSS
          const htmlContent = generatePDFHtml(letterData);
          console.log('HTML content generated');

          // Create temporary iframe with exact A4 dimensions
          const iframe = document.createElement('iframe');
          iframe.style.position = 'absolute';
          iframe.style.width = '210mm';
          iframe.style.height = '297mm';
          iframe.style.left = '-9999px';
          iframe.style.top = '0';
          document.body.appendChild(iframe);

          const iframeDoc = iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(htmlContent);
          iframeDoc.close();

          // Wait for all images and fonts to load
          await new Promise((resolve) => {
            iframe.contentWindow.addEventListener('load', () => {
              setTimeout(resolve, 2000);
            });
          });

          toast.loading("PDF अपलोड हो रहा है...", { id: toastId });
          console.log('Loading jsPDF and html2canvas libraries...');

          // Import libraries
          const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
          const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm')).default;
          console.log('Libraries loaded successfully');

          // Get the page element
          const pageElement = iframeDoc.querySelector('.page');

          // Capture with fixed dimensions matching A4 ratio
          const canvas = await html2canvas(pageElement, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 0,
            removeContainer: true
          });

          // Create PDF with exact A4 dimensions
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
          });

          // Calculate dimensions to fit A4 without stretching
          const imgWidth = 210; // A4 width in mm
          const imgHeight = 297; // A4 height in mm

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');

          // Clean up
          document.body.removeChild(iframe);

          // Convert to blob and upload
          const pdfBlob = doc.output('blob');
          const pdfFile = new File([pdfBlob], `Letter${program.Sn}.pdf`, { type: 'application/pdf' });

          console.log('Uploading PDF file...');
          const formData = new FormData();
          formData.append('file', pdfFile);
          const uploadResp = await restClient.uploadFile(formData);
          const file_url = uploadResp?.file_url || uploadResp?.url || uploadResp?.data?.file_url || uploadResp?.data?.url;
          
          // Convert relative URL to absolute URL for WhatsApp API
          const absolutePdfUrl = file_url?.startsWith('http') ? file_url : `${window.location.origin}${file_url}`;
          console.log('PDF uploaded successfully:', file_url);
          console.log('Absolute PDF URL for WhatsApp:', absolutePdfUrl);

          const defaultMessage = appSettings?.whatsapp_direct_message || 'नमस्कार,\nकृपया संलग्न पत्र देखें:';
          const whatsappMode = appSettings?.whatsapp_mode || 'direct';
          console.log('WhatsApp mode:', whatsappMode, 'PDF API enabled:', appSettings?.whatsapp_pdf_api_enabled);

          if (whatsappMode === 'api' && appSettings?.whatsapp_pdf_api_enabled) {
            toast.loading("WhatsApp भेज रहे हैं...", { id: toastId });
            
            // Clean phone number - remove any non-digit characters
            let cleanPhone = program.Mob?.replace(/\D/g, '') || '';
            // If phone starts with 91 and is 12 digits, remove 91
            if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
              cleanPhone = cleanPhone.substring(2);
            }
            
            try {
              console.log('Calling sendWhatsAppPDF with:', { pdfUrl: absolutePdfUrl, phone: cleanPhone, recipientName: program.SenderName });
              
              // Don't pass message parameter - BHASHSMS template name (text=dharfc_one) should be used from the stored URL
              const whatsappResponse = await restClient.invokeFunction('sendWhatsAppPDF', {
                pdfUrl: absolutePdfUrl,
                phone: cleanPhone,
                recipientName: program.SenderName
              });

              console.log('WhatsApp API Response received:', whatsappResponse);

              // Check if debug mode is enabled
              if (whatsappResponse?.debugMode) {
                // Show debug popup with URL
                toast.dismiss(toastId);
                setDebugDialog({
                  programSn: program.Sn,
                  senderName: program.SenderName,
                  phone: cleanPhone,
                  debugUrl: whatsappResponse?.debugUrl,
                  message: whatsappResponse?.statusMessage || 'डिबग मोड सक्षम है'
                });
                toast.success('डिबग पॉपअप खुला गया - URL को कॉपी करें या ब्राउज़र में खोलें', { duration: 5000, id: toastId });
                // Continue to normal flow - don't return early
              }

              // Check if response indicates success (check both possible response formats)
              // In debug mode, treat as success since the API call succeeded
              const isSuccess = whatsappResponse?.success || whatsappResponse?.debugMode;
              
              if (isSuccess) {
                const messageId = whatsappResponse?.data?.message_id;
                const statusMsg = whatsappResponse?.statusMessage || 'WhatsApp पर भेज दिया!';
                
                toast.success(statusMsg + (messageId ? ` (ID: ${messageId})` : ''), { 
                  id: toastId,
                  duration: 5000 
                });
                
                // Only update status if program has a valid ID
                if (program.id) {
                  updateSendedMutation.mutate({ id: program.id, Sn: program.Sn });
                } else {
                  console.warn('Program ID is null, trying update by Sn');
                  updateSendedMutation.mutate({ id: null, Sn: program.Sn });
                }
              } else {
                // Extract detailed error message from response
                const statusCode = whatsappResponse?.statusCode;
                const statusMessage = whatsappResponse?.statusMessage;
                const errorMsg = whatsappResponse?.error;
                
                let detailedError = statusMessage || errorMsg || "WhatsApp भेजने में त्रुटि";
                
                // Add status code for debugging
                if (statusCode && statusCode !== 'NOT_CONFIGURED') {
                  detailedError += ` (कोड: ${statusCode})`;
                }
                
                console.error('WhatsApp Send Failed:', {
                  statusCode,
                  statusMessage,
                  error: errorMsg,
                  fullResponse: whatsappResponse
                });
                
                toast.error(detailedError, { id: toastId, duration: 6000 });
              }
            } catch (apiError) {
              console.error('WhatsApp API Error:', apiError);
              
              let errorMessage = apiError.message || "WhatsApp API त्रुटि";
              
              // Make error messages more user-friendly
              if (errorMessage.includes('401')) {
                errorMessage = '❌ API कुंजी अमान्य - व्यवस्थापक से संपर्क करें';
              } else if (errorMessage.includes('403')) {
                errorMessage = '❌ फोन नंबर WhatsApp API के लिए अनुमोदित नहीं';
              } else if (errorMessage.includes('422')) {
                errorMessage = '❌ अनुरोध प्रारूप अमान्य';
              } else if (errorMessage.includes('NETWORK_ERROR')) {
                errorMessage = '❌ नेटवर्क त्रुटि - इंटरनेट जांचें';
              }
              
              toast.error(errorMessage, { id: toastId, duration: 6000 });
            }
          } else {
            // Direct WhatsApp mode - generate wa.me link via backend
            toast.loading("WhatsApp लिंक तैयार कर रहे हैं...", { id: toastId });
            
            try {
              const whatsappDirect = await restClient.invokeFunction('sendWhatsAppDirect', {
                phone: program.Mob,
                recipientName: program.SenderName,
                message: defaultMessage,
                pdfUrl: file_url
              });

              console.log('WhatsApp Direct Response:', whatsappDirect);

              if (whatsappDirect?.success && whatsappDirect?.waLink) {
                window.open(whatsappDirect.waLink, '_blank');
                toast.success("WhatsApp खुल गया। संदेश भेजने के बाद पुष्टि करें।", {
                  id: toastId,
                  duration: 60000,
                  action: {
                    label: "भेज दिया",
                    onClick: () => updateSendedMutation.mutate({ id: program.id, Sn: program.Sn }),
                  },
                });
              } else {
                toast.error("WhatsApp लिंक बनाने में विफल", { id: toastId });
              }
            } catch (directError) {
              console.error('WhatsApp Direct error:', directError);
              // Fallback to client-side link generation
              const messageWithLink = `${defaultMessage}\n\n${file_url}`;
              const whatsappUrl = `https://wa.me/${program.Mob}?text=${encodeURIComponent(messageWithLink)}`;
              window.open(whatsappUrl, '_blank');
              toast.success("WhatsApp खुल गया। संदेश भेजने के बाद पुष्टि करें।", {
                id: toastId,
                duration: 60000,
                action: {
                  label: "भेज दिया",
                  onClick: () => updateSendedMutation.mutate({ id: program.id, Sn: program.Sn }),
                },
              });
            }
          }
        } catch (error) {
          console.error('WhatsApp error:', error);
          console.error('Error stack:', error.stack);
          toast.error("त्रुटि: " + (error.message || 'Unknown error occurred'), { id: toastId, duration: 6000 });
        }
      }
  };

  const handleBulkGenerate = async (action) => {
    if (selectedPrograms.length === 0) {
      toast.error("कृपया कम से कम एक पत्र चुनें");
      return;
    }

    if (action === 'pdf' && isMobile) {
      toast.error('मोबाइल पर छवि जनरेशन अस्थायी रूप से बंद है। कृपया डेस्कटॉप/लैपटॉप से करें।');
      return;
    }

    // Add safety limit
    const MAX_BULK_PDF = 100;
    if (action === 'pdf' && selectedPrograms.length > MAX_BULK_PDF) {
      toast.error(`एक बार में अधिकतम ${MAX_BULK_PDF} पत्र जनरेट किए जा सकते हैं। कृपया कम चुनें।`);
      return;
    }

    const selectedProgramData = programs.filter(p => selectedPrograms.includes(p.id));
    
    if (action === 'pdf') {
      toast.success(`${selectedPrograms.length} पत्र की एक PDF बना रहे हैं...`);
      
      // Combine all letters into one HTML document
      let combinedHtml = '';
      
      for (let i = 0; i < selectedProgramData.length; i++) {
        const program = selectedProgramData[i];
        const template = getTemplateForProgram(program.programtyp);
        const programTypeName = programTypesMap[program.programtyp] || program.programtyp;
        
        const defaultTemplate = {
          body: `आपके द्वारा भेजे गए ${programTypeName} के निमंत्रण पत्र के लिए हार्दिक धन्यवाद। आपके परिवार में आयोजित इस शुभ अवसर पर मेरी ओर से हार्दिक शुभकामनाएं।`,
          closing: "शुभकामनाओं सहित।",
          sender_name: "श्रीमती नीना विक्रम वर्मा",
          sender_title: "विधायक",
          sender_subtitle: "मध्यप्रदेश विधानसभा",
          sender_location: "धार",
          sender_address1: "F-2, ऑफिसर्स कॉलोनी, धार",
          sender_address2: "B-18, (74 बंगला), भोपाल"
        };
        
        const activeTemplate = template || defaultTemplate;

        const resolvedBodyTemplate = (activeTemplate.body || '').trim();
        const resolvedClosingTemplate = (activeTemplate.closing || '').trim();

        const letterData = {
          template: activeTemplate,
          senderName: activeTemplate.sender_name || "श्रीमती नीना विक्रम वर्मा",
          senderTitle: activeTemplate.sender_title || "विधायक",
          senderSubtitle: activeTemplate.sender_subtitle || "मध्यप्रदेश विधानसभा",
          senderLocation: activeTemplate.sender_location || "धार",
          senderAddress1: activeTemplate.sender_address1 || "F-2, ऑफिसर्स कॉलोनी, धार",
          senderAddress2: activeTemplate.sender_address2 || "B-18, (74 बंगला), भोपाल",
          body: replacePlaceholders(resolvedBodyTemplate || "प्रिय मित्र,\n\nआपको सूचित करते हुए हर्ष है।\n\nधन्यवाद।", program),
          closing: replacePlaceholders(resolvedClosingTemplate || "शुभकामनाओं सहित।", program),
          recipientName: program.SenderName,
          street: program.Street || '',
          village: program.Village,
          district: program.District,
          date: format(new Date(), 'dd-MM-yyyy'),
          invitationNumber: program.Sn
        };

        const htmlContent = generatePDFHtml(letterData);
        
        // Extract just the page content (body) from the HTML
        const bodyMatch = htmlContent.match(/<body>([\s\S]*)<\/body>/);
        if (bodyMatch) {
          combinedHtml += bodyMatch[1];
          // Add page break after each letter except the last one
          if (i < selectedProgramData.length - 1) {
            combinedHtml += '<div style="page-break-after: always;"></div>';
          }
        }
        
      }
      
      // Build one HTML document with the combined letters
      const firstTemplate = generatePDFHtml(selectedProgramData[0] ? {
        template: getTemplateForProgram(selectedProgramData[0].programtyp) || {},
        senderName: "",
        recipientName: "",
        street: "",
        village: "",
        district: "",
        date: "",
        invitationNumber: "",
        body: "",
        closing: ""
      } : {});

      const headMatch = firstTemplate.match(/<head>([\s\S]*)<\/head>/);
      const head = headMatch ? headMatch[1] : '';
      const combinedDocument = `
        <!DOCTYPE html>
        <html>
        <head>${head}</head>
        <body>${combinedHtml}</body>
        </html>
      `;

      try {
        await downloadImageHybrid(combinedDocument, `letters-${selectedPrograms.length}.jpg`);
      } catch (error) {
        console.error('Bulk image generation error:', error);
        toast.error(`छवि बनाने में त्रुटि: ${error.message || 'Unknown error'}`);
        return;
      }

      try {
        await Promise.all(selectedProgramData.map(program =>
          updateSendedMutation.mutateAsync({ id: program.id, Sn: program.Sn })
        ));
        toast.success(`${selectedPrograms.length} छवियाँ डाउनलोड हुईं और पत्र "पत्र लिखे जा चुके" में जोड़ दिए गए।`);
      } catch (error) {
        console.error('Failed to update sent status after bulk image download:', error);
      }
    } else if (action === 'whatsapp') {
      toast.loading(`${selectedPrograms.length} पत्र WhatsApp पर भेजे जा रहे हैं...`);

      let successCount = 0;
      for (const program of selectedProgramData) {
        try {
          await handleGenerateSingle(program, 'whatsapp');
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`Error sending to ${program.SenderName}:`, error);
        }
      }

      toast.success(`${successCount} पत्र भेज दिए गए`);
    }
    
    setSelectedPrograms([]);
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              पत्र जनरेटर
            </h1>
            <p className="text-gray-600 mt-1">
              अनुपस्थित कार्यक्रमों के लिए धन्यवाद पत्र बनाएं
            </p>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="वर्ष चुनें" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">सभी वर्ष</SelectItem>
              {availableYears.map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hint removed per request to focus on template-based designer */}



        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-orange-100 shadow-lg bg-gradient-to-r from-orange-50 to-amber-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कुल पत्र तैयार</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">
                    {filteredPrograms.length}
                  </p>
                </div>
                <FileText className="w-16 h-16 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">चयनित पत्र</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">
                    {selectedPrograms.length}
                  </p>
                </div>
                <CheckCircle className="w-16 h-16 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {isMobile && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <p className="text-sm text-yellow-900 font-medium">
                ⚠️ मोबाइल मोड: "छवि" जनरेशन बटन बंद है। WhatsApp भेजना चालू है।
              </p>
            </CardContent>
          </Card>
        )}

        {selectedPrograms.length > 0 && (
          <Card className="border-green-100 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <p className="font-semibold text-gray-900">
                  {selectedPrograms.length} पत्र चयनित
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleBulkGenerate('pdf')}
                    variant="outline"
                    className="gap-2"
                    disabled={isMobile}
                    title={isMobile ? 'मोबाइल पर छवि जनरेशन बंद है' : undefined}
                  >
                    <Download className="w-4 h-4" />
                    चयनित के लिए छवि
                  </Button>
                  <Button
                    onClick={() => handleBulkGenerate('whatsapp')}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <Send className="w-4 h-4" />
                    चयनित के लिए WhatsApp
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={toggleSelectAll}
            className="gap-2"
          >
            <Checkbox checked={selectedPrograms.length === filteredPrograms.length && filteredPrograms.length > 0} />
            {selectedPrograms.length === filteredPrograms.length ? "सभी अचयनित करें" : "सभी चुनें"}
          </Button>
          <div className="flex items-center gap-3 bg-white border border-orange-100 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-gray-700">पत्र लिखे जा चुके</span>
            <Switch
              checked={showSentOnly}
              onCheckedChange={(checked) => setShowSentOnly(checked)}
            />
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
                <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
                <p className="text-xl font-semibold text-gray-900 mb-2">
                  {showSentOnly ? "कोई भेजा गया पत्र नहीं मिला" : "सभी पत्र भेज दिए गए हैं!"}
                </p>
                <p className="text-gray-500">
                  {showSentOnly ? "भेजे गए पत्र देखने के लिए कोई डेटा नहीं है" : "कोई नया पत्र भेजने के लिए तैयार नहीं है"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((program) => (
              <Card key={program.id} className="border-orange-100 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-4 items-start">
                    <Checkbox
                      checked={selectedPrograms.includes(program.id)}
                      onCheckedChange={() => toggleSelection(program.id)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-sm font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                          #{program.Sn}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{program.SenderName}</h3>
                        <Badge className={getProgramTypeColor(programTypesMap[program.programtyp] || program.programtyp)}>
                          {programTypesMap[program.programtyp] || program.programtyp}
                        </Badge>
                        {program.sended && (
                          <Badge className="bg-green-100 text-green-700">
                            भेजा गया
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-gray-600">
                        <p>तारीख: {(() => {
                          try {
                            const d = parseISO(program.Date);
                            return !isNaN(d.getTime()) ? format(d, 'dd MMMM yyyy') : '-';
                          } catch { return '-'; }
                        })()}</p>
                        <p>स्थान: {program.Village}, {program.District}</p>
                        {program.ProgramFor && (
                          <p>कार्यक्रम: {program.ProgramFor} ({program.Relation_to_sender})</p>
                        )}
                        <p>मोबाइल: {program.Mob}</p>
                      </div>
                      {program.invitation_card_url && (
                        <div className="mt-3">
                          {/\.jpe?g(?:[?#].*)?$/i.test(program.invitation_card_url) ? (
                            <a
                              href={program.invitation_card_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-2 hover:bg-orange-100"
                            >
                              <img
                                src={program.invitation_card_url}
                                alt={`निमंत्रण कार्ड #${program.Sn}`}
                                className="h-16 w-16 rounded object-cover"
                              />
                              <span className="text-sm font-medium text-orange-800">निमंत्रण कार्ड देखें</span>
                            </a>
                          ) : (
                            <a
                              href={program.invitation_card_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100"
                            >
                              <FileText className="h-4 w-4" />
                              निमंत्रण PDF देखें
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleGenerateSingle(program, 'pdf');
                        }}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={isMobile}
                        title={isMobile ? 'मोबाइल पर छवि जनरेशन बंद है' : undefined}
                      >
                        <Download className="w-4 h-4" />
                        छवि
                      </Button>
                      <Button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleGenerateSingle(program, 'whatsapp');
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <Send className="w-4 h-4" />
                        WhatsApp
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredPrograms.length > itemsPerPage && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  पिछला
                </Button>
                <span className="px-4 py-2">
                  पेज {currentPage} / {Math.ceil(filteredPrograms.length / itemsPerPage)}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPrograms.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredPrograms.length / itemsPerPage)}
                >
                  अगला
                </Button>
              </div>
            )}
            </>
            )}
            </div>
            </div>

      {/* Debug Dialog */}
      <Dialog open={!!debugDialog} onOpenChange={() => setDebugDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🔍 WhatsApp API डिबग मोड
            </DialogTitle>
            <DialogDescription>
              निमंत्रण: {debugDialog?.programSn} | {debugDialog?.senderName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-semibold mb-2">📌 मोबाइल नंबर:</p>
              <p className="text-sm text-blue-800 font-mono">{debugDialog?.phone}</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900 font-semibold mb-2">⚠️ {debugDialog?.message}</p>
              <p className="text-xs text-yellow-800">नीचे दिया गया URL अपने ब्राउज़र में खोलें या BHASHSMS API को टेस्ट करने के लिए कॉपी करें।</p>
            </div>

            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
              <p className="text-xs text-gray-600 font-semibold mb-2">API URL (डिबग):</p>
              <div className="bg-white rounded p-3 overflow-x-auto">
                <code className="text-xs text-gray-800 break-all">
                  {debugDialog?.debugUrl}
                </code>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-800">
                ✅ <strong>टेस्ट करने के लिए:</strong><br/>
                1. नीचे "कॉपी करें" बटन से URL कॉपी करें<br/>
                2. अपने ब्राउज़र के Address Bar में पेस्ट करें<br/>
                3. Enter दबाएं और BHASHSMS API का जवाब देखें
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDebugDialog(null)}
            >
              बंद करें
            </Button>
            <Button
              onClick={() => {
                if (debugDialog?.debugUrl) {
                  navigator.clipboard.writeText(debugDialog.debugUrl).then(() => {
                    toast.success("URL क्लिपबोर्ड में कॉपी हुआ!");
                  }).catch(() => {
                    toast.error("कॉपी करने में विफल");
                  });
                }
              }}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              कॉपी करें
            </Button>
            <Button
              onClick={() => {
                if (debugDialog?.debugUrl) {
                  window.open(debugDialog.debugUrl, '_blank');
                }
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              ब्राउज़र में खोलें
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    );
  }