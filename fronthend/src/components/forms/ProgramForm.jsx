import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ProgramTypeDisplay, { useProgramTypesMap } from "../ProgramDisplay";

export default function ProgramForm({ initialData, onSubmit, onCancel, onDelete, isLoading, nextSn }) {
  const fetchProgramTypes = async () => {
    const tryUrls = ['/api/entities/ProgramType', '/api/programtypes', '/api/entities/ProgramType/list'];
    for (const url of tryUrls) {
      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (!json) continue;
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.data)) return json.data;
        if (Array.isArray(json.results)) return json.results;
        if (typeof json === 'object') return Object.values(json);
      } catch (e) {
        // try next
      }
    }
    return [];
  };

  const { data: programTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['program-types'],
    queryFn: fetchProgramTypes,
    initialData: [],
  });

  // Normalize programTypes into an array. SDK may return different envelopes
  // (array, {data: []}, {results: []}, keyed object, etc). Coerce to array to
  // avoid runtime errors like "map is not a function".
  const normalizeList = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;

    if (v.data) {
      if (Array.isArray(v.data)) return v.data;
      if (v.data && typeof v.data === 'object' && (v.data.Programtyp || v.data.id || v.data._id)) return [v.data];
      if (v.data.results && Array.isArray(v.data.results)) return v.data.results;
      if (v.data.items && Array.isArray(v.data.items)) return v.data.items;
    }
    if (v.results && Array.isArray(v.results)) return v.results;
    if (v.items && Array.isArray(v.items)) return v.items;
    if (v.rows && Array.isArray(v.rows)) return v.rows;

    if (typeof v === 'object') {
      const entries = Object.entries(v);
      const vals = entries.map(([, val]) => val);
      const allPrimitives = vals.every(x => x === null || (typeof x !== 'object'));
      if (allPrimitives) {
        return entries.map(([k, val]) => ({ id: k, Programtyp: typeof val === 'string' ? val : String(k) }));
      }

      const out = [];
      for (const [k, val] of entries) {
        if (val == null) continue;
        if (typeof val !== 'object') {
          out.push({ id: k, Programtyp: String(val) });
          continue;
        }

        if (val.success && val.data) {
          const d = val.data;
          if (Array.isArray(d)) {
            out.push(...d);
            continue;
          }
          if (d && typeof d === 'object') {
            out.push({ id: d.id ?? d._id ?? k, Programtyp: d.Programtyp ?? String(k), ...d });
            continue;
          }
        }

        if (val.data && typeof val.data === 'object' && (val.data.Programtyp || val.data.id)) {
          const d = val.data;
          out.push({ id: d.id ?? d._id ?? k, Programtyp: d.Programtyp ?? String(k), ...d });
          continue;
        }

        if (val.Programtyp || val.id || val._id) {
          out.push({ id: val.id ?? val._id ?? k, Programtyp: val.Programtyp ?? String(k), ...val });
          continue;
        }

        out.push({ id: k, Programtyp: String(k) });
      }
      return out;
    }
    return [];
  };

  const pts = normalizeList(programTypes);
  const programTypesMap = useProgramTypesMap();

  // DEV-only debug logging to inspect the raw SDK response and normalized list
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ProgramForm] raw programTypes:', programTypes);
    // eslint-disable-next-line no-console
    console.debug('[ProgramForm] normalized pts:', pts.slice ? pts.slice(0, 20) : pts);
  }

  const [formData, setFormData] = useState(() => {
    const data = initialData || {
      Sn: nextSn || "",
      Date: "",
      SenderName: "",
      Street: "",
      Village: "",
      District: "",
      Mob: "",
      programtyp: "",
      place_time: "",
      event_time: "",
      LocalProgram: "",
      Joint: false,
      bulk: false,
      ProgramFor: "",
      Relation_to_sender: "",
      detail: "",
      Attended: false,
      sended: false,
      prafull: false
    };
    
    // programtyp is now stored as UUID string, no conversion needed
    
    return data;
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
      }));
      return;
    }
    if (nextSn) {
      setFormData(prev => ({ ...prev, Sn: nextSn }));
    }
  }, [nextSn, initialData]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.Sn) {
      newErrors.Sn = "निमंत्रण संख्या आवश्यक है";
    }

    if (!formData.Date) {
      newErrors.Date = "तारीख आवश्यक है";
    }

    if (!formData.SenderName || formData.SenderName.trim() === "") {
      newErrors.SenderName = "प्रेषक का नाम आवश्यक है";
    }

    if (!formData.Mob || formData.Mob.trim() === "") {
      newErrors.Mob = "मोबाइल नंबर आवश्यक है";
    } else if (!/^\d{10}$/.test(formData.Mob)) {
      newErrors.Mob = "मोबाइल नंबर 10 अंकों का होना चाहिए";
    }

    if (!formData.programtyp) {
      newErrors.programtyp = "कार्यक्रम प्रकार आवश्यक है";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // programtyp is already a UUID string, no conversion needed
      onSubmit(formData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-orange-100 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
          <CardTitle className="text-xl font-bold text-gray-900">
            {initialData ? `निमंत्रण संपादित करें #${formData.Sn}` : "नया निमंत्रण जोड़ें"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Row 1: Invitation Number, Date, Program Type */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="Sn" className="text-sm font-semibold text-gray-700">
                निमंत्रण संख्या <span className="text-red-500">*</span>
              </Label>
              <Input
                id="Sn"
                type="number"
                value={formData.Sn}
                readOnly
                placeholder="जैसे: 6162"
                className="font-bold text-lg bg-gray-50 cursor-not-allowed"
              />
              {errors.Sn && <p className="text-xs text-red-500">{errors.Sn}</p>}
              <p className="text-xs text-gray-500">कार्ड पर लिखें</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="Date" className="text-sm font-semibold text-gray-700">
                तारीख <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.Date && "text-muted-foreground",
                      errors.Date && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.Date ? format(new Date(formData.Date), 'dd/MM/yyyy') : "तारीख चुनें"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.Date ? new Date(formData.Date) : undefined}
                    onSelect={(date) => handleChange('Date', date ? format(date, 'yyyy-MM-dd') : '')}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.Date && <p className="text-xs text-red-500">{errors.Date}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="programtyp" className="text-sm font-semibold text-gray-700">
                कार्यक्रम प्रकार <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={formData.programtyp || ""} 
                onValueChange={(value) => handleChange('programtyp', value)}
              >
                <SelectTrigger id="programtyp" className={cn(errors.programtyp && "border-red-500")}>
                  <SelectValue placeholder="कार्यक्रम प्रकार चुनें" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {Object.keys(programTypesMap || {}).length > 0 ? (
                    // Prefer rendering options directly from the programTypesMap
                    // (id -> label). This guarantees friendly labels from the
                    // seeded mock regardless of malformed SDK responses.
                    Object.entries(programTypesMap).map(([id, name]) => (
                      <SelectItem key={String(id)} value={String(id)}>{name}</SelectItem>
                    ))
                  ) : pts.length === 0 ? (
                    // Use a non-empty disabled value — Radix Select disallows empty
                    // string values on items. This shows a single disabled placeholder
                    // while program types are loading or missing.
                    <SelectItem value="__none" disabled>लोड़ हो रहा है / कोई विकल्प नहीं</SelectItem>
                  ) : (
                    pts.map((type, idx) => {
                      // Determine the best id/value and label for the option. SDK/DB
                      // shapes vary: id, _id, data.id, or sometimes the record is
                      // just a string/name. Fall back to the display name as value
                      // so the select still works.
                      const rawId = type?.id ?? type?._id ?? type?.data?.id ?? type?.value;
                      const value = rawId != null ? String(rawId) : (type?.programtyp || type?.Programtyp ? String(type.programtyp || type.Programtyp) : String(idx));
                      // If the label is a generic meta-string like 'success' or 'true'
                      // that comes from an envelope, prefer the id/key as the label.
                      let label = type?.data?.programtyp || type?.data?.Programtyp || type?.programtyp || type?.Programtyp || type?.name;
                      if (!label) {
                        if (typeof type === 'string') label = type;
                        else label = String(type);
                      }
                      if (/^(success|ok|true|false|error)$/i.test(String(label).trim())) {
                        label = value; // prefer the id/key
                      }
                      return (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              {errors.programtyp && <p className="text-xs text-red-500">{errors.programtyp}</p>}
            </div>
          </div>

          {/* Row 2: Sender Name, Mobile */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="SenderName" className="text-sm font-semibold text-gray-700">
                प्रेषक का नाम <span className="text-red-500">*</span>
              </Label>
              <Input
                id="SenderName"
                value={formData.SenderName}
                onChange={(e) => handleChange('SenderName', e.target.value)}
                placeholder="प्रेषक का नाम दर्ज करें"
                className={cn(errors.SenderName && "border-red-500")}
              />
              {errors.SenderName && <p className="text-xs text-red-500">{errors.SenderName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="Mob" className="text-sm font-semibold text-gray-700">
                मोबाइल नंबर <span className="text-red-500">*</span>
              </Label>
              <Input
                id="Mob"
                value={formData.Mob}
                onChange={(e) => handleChange('Mob', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 अंकों का मोबाइल नंबर"
                maxLength={10}
                className={cn(errors.Mob && "border-red-500")}
              />
              {errors.Mob && <p className="text-xs text-red-500">{errors.Mob}</p>}
            </div>
          </div>

          {/* Row 3: Street, Village, District */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="Street" className="text-sm font-semibold text-gray-700">
                मोहल्ला/गली
              </Label>
              <Input
                id="Street"
                value={formData.Street}
                onChange={(e) => handleChange('Street', e.target.value)}
                placeholder="मोहल्ला/गली"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="Village" className="text-sm font-semibold text-gray-700">
                गाँव/शहर
              </Label>
              <Input
                id="Village"
                value={formData.Village}
                onChange={(e) => handleChange('Village', e.target.value)}
                placeholder="गाँव/शहर"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="District" className="text-sm font-semibold text-gray-700">
                जिला
              </Label>
              <Input
                id="District"
                value={formData.District}
                onChange={(e) => handleChange('District', e.target.value)}
                placeholder="जिला"
              />
            </div>
          </div>

          {/* Row 4: Program For, Relation */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ProgramFor" className="text-sm font-semibold text-gray-700">
                कार्यक्रम किसके लिए
              </Label>
              <Input
                id="ProgramFor"
                value={formData.ProgramFor}
                onChange={(e) => handleChange('ProgramFor', e.target.value)}
                placeholder="व्यक्ति का नाम"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="Relation_to_sender" className="text-sm font-semibold text-gray-700">
                प्रेषक से संबंध
              </Label>
              <Input
                id="Relation_to_sender"
                value={formData.Relation_to_sender}
                onChange={(e) => handleChange('Relation_to_sender', e.target.value)}
                placeholder="संबंध (जैसे: पुत्र, पुत्री)"
              />
            </div>
          </div>

          {/* Row 5: Place/Time, Event Time, Local Program */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="place_time" className="text-sm font-semibold text-gray-700">
                स्थान और समय
              </Label>
              <Input
                id="place_time"
                value={formData.place_time}
                onChange={(e) => handleChange('place_time', e.target.value)}
                placeholder="स्थान और समय"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_time" className="text-sm font-semibold text-gray-700">
                कार्यक्रम का समय
              </Label>
              <Input
                id="event_time"
                type="time"
                value={formData.event_time}
                onChange={(e) => handleChange('event_time', e.target.value)}
                placeholder="समय चुनें"
                className="w-32"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="LocalProgram" className="text-sm font-semibold text-gray-700">
                स्थानीय कार्यक्रम
              </Label>
              <Input
                id="LocalProgram"
                value={formData.LocalProgram}
                onChange={(e) => handleChange('LocalProgram', e.target.value)}
                placeholder="स्थानीय कार्यक्रम विवरण"
              />
            </div>
          </div>

          {/* Row 6: Detail */}
          <div className="space-y-2">
            <Label htmlFor="detail" className="text-sm font-semibold text-gray-700">
              अतिरिक्त विवरण
            </Label>
            <Textarea
              id="detail"
              value={formData.detail}
              onChange={(e) => handleChange('detail', e.target.value)}
              placeholder="कोई अतिरिक्त जानकारी"
              rows={3}
            />
          </div>

          {/* Row 7: Checkboxes */}
          <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-orange-100">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="Joint"
                checked={formData.Joint}
                onCheckedChange={(checked) => handleChange('Joint', checked)}
              />
              <Label htmlFor="Joint" className="text-sm font-medium cursor-pointer">
                संयुक्त निमंत्रण
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="bulk"
                checked={formData.bulk}
                onCheckedChange={(checked) => handleChange('bulk', checked)}
              />
              <Label htmlFor="bulk" className="text-sm font-medium cursor-pointer">
                थोक निमंत्रण
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="prafull"
                checked={formData.prafull}
                onCheckedChange={(checked) => handleChange('prafull', checked)}
              />
              <Label htmlFor="prafull" className="text-sm font-medium cursor-pointer">
                प्रफुल्ल
              </Label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="Attended"
                checked={formData.Attended}
                onCheckedChange={(checked) => handleChange('Attended', checked)}
              />
              <Label htmlFor="Attended" className="text-sm font-medium cursor-pointer">
                उपस्थित हुए
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sended"
                checked={formData.sended}
                onCheckedChange={(checked) => handleChange('sended', checked)}
              />
              <Label htmlFor="sended" className="text-sm font-medium cursor-pointer">
                पत्र भेजा गया
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t border-orange-100">
            {initialData?.id && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isLoading}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                डिलीट करें
              </Button>
            ) : <div></div>}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                रद्द करें
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"
              >
                <Save className="w-4 h-4" />
                {isLoading ? "सहेजा जा रहा है..." : "सहेजें"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}