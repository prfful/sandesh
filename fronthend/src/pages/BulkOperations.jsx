import React, { useState, useMemo } from "react";
import restClient from "@/api/restClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Send, Search, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useProgramTypesMap } from "../components/ProgramDisplay";

export default function BulkOperations() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [processing, setProcessing] = useState(false);
  const programTypesMap = useProgramTypesMap();

  const { data: allPrograms = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => restClient.listEntities('Pragram'),
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
      if (!p.Date) return false;
      try {
        return new Date(p.Date).getFullYear() === parseInt(selectedYear);
      } catch {
        return false;
      }
    });
  }, [allPrograms, selectedYear]);

  const updateMutation = useMutation({
    mutationFn: async ({ ids, data }) => {
      const results = { success: 0, failed: 0 };
      for (const id of ids) {
        try {
          await restClient.updateEntity('Pragram', id, data);
          results.success++;
        } catch (error) {
          results.failed++;
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success(`${results.success} रिकॉर्ड अपडेट हुए`);
      if (results.failed > 0) {
        toast.error(`${results.failed} रिकॉर्ड विफल`);
      }
      setSelectedPrograms([]);
      setProcessing(false);
    },
  });

  const filteredPrograms = programs.filter(program => {
    if (searchQuery === "") return true;
    const programTypeName = programTypesMap[program.programtyp] || "";
    return (
      program.SenderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.Village?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      programTypeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.Mob?.includes(searchQuery) ||
      String(program.Sn).includes(searchQuery)
    );
  });

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

  const handleMarkAttended = async () => {
    if (selectedPrograms.length === 0) {
      toast.error("कृपया कम से कम एक प्रोग्राम चुनें");
      return;
    }
    setProcessing(true);
    updateMutation.mutate({
      ids: selectedPrograms,
      data: { Attended: true }
    });
  };

  const handleMarkSended = async () => {
    if (selectedPrograms.length === 0) {
      toast.error("कृपया कम से कम एक प्रोग्राम चुनें");
      return;
    }
    setProcessing(true);
    updateMutation.mutate({
      ids: selectedPrograms,
      data: { sended: true }
    });
  };

  const attendedCount = programs.filter(p => p.Attended).length;
  const sendedCount = programs.filter(p => p.sended).length;
  const pendingLetters = programs.filter(p => !p.sended && !p.Attended).length;

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              बल्क ऑपरेशन्स
            </h1>
            <p className="text-gray-600 mt-1">एक साथ कई प्रोग्राम अपडेट करें</p>
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

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-orange-100 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">कुल प्रोग्राम</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">{programs.length}</p>
                </div>
                <Users className="w-16 h-16 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">उपस्थित</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">{attendedCount}</p>
                </div>
                <CheckCircle className="w-16 h-16 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">पत्र भेजना बाकी</p>
                  <p className="text-4xl font-bold text-gray-900 mt-1">{pendingLetters}</p>
                </div>
                <Send className="w-16 h-16 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedPrograms.length > 0 && (
          <Card className="border-blue-100 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <p className="font-semibold text-gray-900">
                  {selectedPrograms.length} प्रोग्राम चयनित
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleMarkAttended}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    उपस्थित मार्क करें
                  </Button>
                  <Button
                    onClick={handleMarkSended}
                    disabled={processing}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    <Send className="w-4 h-4" />
                    पत्र भेजा मार्क करें
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-orange-100 shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <CardTitle>सभी प्रोग्राम</CardTitle>
              <div className="flex gap-3 items-center w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="नाम, गाँव, मोबाइल से खोजें..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={toggleSelectAll}>
                  <Checkbox checked={selectedPrograms.length === filteredPrograms.length && filteredPrograms.length > 0} />
                  <span className="ml-2">सभी</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">लोड हो रहा है...</p>
            ) : filteredPrograms.length === 0 ? (
              <p className="text-center text-gray-500 py-8">कोई प्रोग्राम नहीं मिला</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredPrograms.map((program) => (
                  <div
                    key={program.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedPrograms.includes(program.id)
                        ? 'border-orange-500 bg-orange-100 shadow-md'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                    onClick={() => toggleSelection(program.id)}
                  >
                    <Checkbox
                      checked={selectedPrograms.includes(program.id)}
                      onCheckedChange={() => toggleSelection(program.id)}
                      className={`w-5 h-5 cursor-pointer transition-all ${
                        selectedPrograms.includes(program.id)
                          ? 'border-orange-600 bg-orange-600'
                          : 'border-gray-300'
                      }`}
                    />
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                      <div>
                        <div className="text-sm font-bold text-orange-600">#{program.Sn}</div>
                        <div className="font-semibold text-gray-900">{program.SenderName}</div>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <div>{program.Village}</div>
                        <div>{program.District}</div>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {program.Mob}
                      </div>
                      
                      <div>
                        <Badge className="bg-orange-100 text-orange-700">
                          {programTypesMap[program.programtyp] || program.programtyp}
                        </Badge>
                        {program.Date && (
                          <div className="text-xs text-gray-500 mt-1">
                            {format(parseISO(program.Date), 'dd/MM/yyyy')}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {program.Attended && (
                          <Badge className="bg-green-100 text-green-700">
                            उपस्थित
                          </Badge>
                        )}
                        {program.sended && (
                          <Badge className="bg-blue-100 text-blue-700">
                            पत्र भेजा
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}