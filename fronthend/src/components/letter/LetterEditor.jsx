import React, { useState, useEffect } from "react";
import restClient from "@/api/restClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Send, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function LetterEditor({ program, onGenerate, onCancel }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  const { data: templates } = useQuery({
    queryKey: ['letter-templates'],
  queryFn: () => restClient.listEntities('LetterTemplate'),
    initialData: [],
  });

  const matchingTemplates = templates.filter(t => 
    t.program_type === program.programtyp || t.program_type === "default"
  );

  const defaultTemplate = matchingTemplates.find(t => t.is_default) || matchingTemplates[0];

  const [letterData, setLetterData] = useState({
    greeting: "",
    body: "",
    senderName: "",
    senderTitle: "",
    senderSubtitle: "",
    senderLocation: "",
    senderAddress1: "",
    senderAddress2: "",
    recipientName: program.SenderName,
    recipientAddress: [program.Street, program.Village, program.District].filter(Boolean).join(', '),
    date: format(new Date(), 'dd-MM-yyyy'),
    invitationNumber: program.Sn,
    template: null
  });

  const replacePlaceholders = (text) => {
    if (!text) return "";
    return text
      .replace(/{SenderName}/g, program.SenderName || '')
      .replace(/{Street}/g, program.Street || '')
      .replace(/{Village}/g, program.Village || '')
      .replace(/{District}/g, program.District || '')
      .replace(/{Mob}/g, program.Mob || '')
      .replace(/{programtyp}/g, program.programtyp || '')
      .replace(/{place_time}/g, program.place_time || '')
      .replace(/{LocalProgram}/g, program.LocalProgram || '')
      .replace(/{ProgramFor}/g, program.ProgramFor || '')
      .replace(/{Relation_to_sender}/g, program.Relation_to_sender || '')
      .replace(/{detail}/g, program.detail || '')
      .replace(/{Date}/g, program.Date ? format(new Date(program.Date), 'dd-MM-yyyy') : '')
      .replace(/{Sn}/g, program.Sn || '');
  };

  const loadTemplate = (template) => {
    if (!template) return;

    setSelectedTemplate(template);
    setLetterData({
      greeting: replacePlaceholders(template.greeting),
      body: replacePlaceholders(template.body),
      senderName: template.sender_name || "",
      senderTitle: template.sender_title || "",
      senderSubtitle: template.sender_subtitle || "",
      senderLocation: template.sender_location || "",
      senderAddress1: template.sender_address1 || "",
      senderAddress2: template.sender_address2 || "",
      recipientName: program.SenderName,
      recipientAddress: [program.Street, program.Village, program.District].filter(Boolean).join(', '),
      date: format(new Date(), 'dd-MM-yyyy'),
      invitationNumber: program.Sn,
      template: template
    });
  };

  useEffect(() => {
    if (defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
      loadTemplate(defaultTemplate);
    }
  }, [defaultTemplate, program]);

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      loadTemplate(template);
    }
  };

  const handleReload = () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      loadTemplate(template);
    }
  };

  const handleGenerate = (action) => {
    onGenerate(letterData, action);
  };

  return (
    <Card className="border-orange-100 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">
            पत्र संपादित करें - #{program.Sn}
          </CardTitle>
          {matchingTemplates.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">टेम्पलेट:</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="टेम्पलेट चुनें" />
                </SelectTrigger>
                <SelectContent>
                  {matchingTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.is_default && "⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="outline"
                onClick={handleReload}
                title="टेम्पलेट फिर से लोड करें"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>प्रेषक का नाम</Label>
            <Input
              value={letterData.senderName}
              onChange={(e) => setLetterData({...letterData, senderName: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <Label>पदनाम</Label>
            <Input
              value={letterData.senderTitle}
              onChange={(e) => setLetterData({...letterData, senderTitle: e.target.value})}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>उप-शीर्षक</Label>
            <Input
              value={letterData.senderSubtitle}
              onChange={(e) => setLetterData({...letterData, senderSubtitle: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>स्थान</Label>
            <Input
              value={letterData.senderLocation}
              onChange={(e) => setLetterData({...letterData, senderLocation: e.target.value})}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>पता 1</Label>
            <Input
              value={letterData.senderAddress1}
              onChange={(e) => setLetterData({...letterData, senderAddress1: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>पता 2</Label>
            <Input
              value={letterData.senderAddress2}
              onChange={(e) => setLetterData({...letterData, senderAddress2: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>अभिवादन</Label>
          <Input
            value={letterData.greeting}
            onChange={(e) => setLetterData({...letterData, greeting: e.target.value})}
            placeholder="प्रति, श्रीमान..."
          />
        </div>

        <div className="space-y-2">
          <Label>पत्र सामग्री</Label>
          <Textarea
            value={letterData.body}
            onChange={(e) => setLetterData({...letterData, body: e.target.value})}
            rows={12}
            className="font-hindi"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>प्राप्तकर्ता</Label>
            <Input
              value={letterData.recipientName}
              onChange={(e) => setLetterData({...letterData, recipientName: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>पता</Label>
            <Input
              value={letterData.recipientAddress}
              onChange={(e) => setLetterData({...letterData, recipientAddress: e.target.value})}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <X className="w-4 h-4" />
            रद्द करें
          </Button>
          <Button 
            variant="outline"
            onClick={() => handleGenerate('download')}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            PDF डाउनलोड
          </Button>
          <Button 
            onClick={() => handleGenerate('whatsapp')}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
          >
            <Send className="w-4 h-4" />
            WhatsApp भेजें
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}