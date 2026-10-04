import React, { useState, useMemo } from "react";
import restClient from "@/api/restClient";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Bell, Calendar, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format, isFuture, isPast, startOfDay, endOfDay } from "date-fns";
import { useProgramTypesMap } from "../components/ProgramDisplay";

export default function Dashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // Helper to normalize responses from the SDK into an array. SDKs can return
  // different shapes: Array, { data: [...] }, { results: [...] }, keyed object,
  // or an error object. Coerce to an array to avoid runtime TypeErrors.
  const normalizeList = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v.data && Array.isArray(v.data)) return v.data;
    if (v.results && Array.isArray(v.results)) return v.results;
    if (v.items && Array.isArray(v.items)) return v.items;
    if (v.rows && Array.isArray(v.rows)) return v.rows;
    if (typeof v === 'object') return Object.values(v);
    return [];
  };

  const { data: allPrograms = [], isLoading, error } = useQuery({
    queryKey: ['programs-all'],
    queryFn: async () => {
      console.log('Fetching programs...');
      const data = await restClient.listEntities('Pragram');
      console.log('Programs fetched:', data);
      const normalized = normalizeList(data);
      console.log('Normalized programs count:', normalized?.length || 0);
      return normalized;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'stale',
  });

  console.log('Dashboard - isLoading:', isLoading, 'error:', error, 'programs count:', allPrograms?.length || 0);

  const programTypesMap = useProgramTypesMap();

  // Extract unique years from data with counts
  const yearlyStats = useMemo(() => {
    const yearMap = new Map();
    allPrograms.forEach(p => {
      if (p.Date) {
        try {
          const year = new Date(p.Date).getFullYear();
          if (!isNaN(year)) {
            yearMap.set(year, (yearMap.get(year) || 0) + 1);
          }
        } catch {}
      }
    });
    return Array.from(yearMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);
  }, [allPrograms]);

  // Extract unique years from data
  const availableYears = useMemo(() => {
    return yearlyStats.map(stat => stat.year);
  }, [yearlyStats]);

  // Filter programs by selected year
  const filteredPrograms = useMemo(() => {
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

  const stats = useMemo(() => ({
    total: filteredPrograms.length,
    upcoming: filteredPrograms.filter(p => {
      if (!p.Date || p.Date === '') return false;
      try {
        const date = new Date(p.Date);
        if (isNaN(date.getTime())) return false;
        return isFuture(date);
      } catch {
        return false;
      }
    }).length,
    attended: filteredPrograms.filter(p => p.Attended).length,
    needsFollowup: filteredPrograms.filter(p => {
      if (!p.Date || p.Date === '' || p.Attended || p.sended) return false;
      try {
        const date = new Date(p.Date);
        if (isNaN(date.getTime())) return false;
        return isPast(date);
      } catch {
        return false;
      }
    }).length,
  }), [filteredPrograms]);

  const upcomingPrograms = useMemo(() => 
    filteredPrograms
      .filter(p => {
        if (!p.Date || p.Date === '') return false;
        try {
          const date = new Date(p.Date);
          if (isNaN(date.getTime())) return false;
          return isFuture(date);
        } catch {
          return false;
        }
      })
      .slice(0, 5),
    [filteredPrograms]
  );

  const recentPrograms = useMemo(() => {
    const todayEnd = endOfDay(new Date());

    return filteredPrograms
      .filter(p => {
        if (!p.Date || p.Date === '') return false;
        try {
          const date = new Date(p.Date);
          if (isNaN(date.getTime())) return false;
          return !isFuture(date) && date <= todayEnd;
        } catch {
          return false;
        }
      })
      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
      .slice(0, 8);
  }, [filteredPrograms]);

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              स्वागत है
            </h1>
            <p className="text-sm text-gray-600">निमंत्रण प्रबंधन डैशबोर्ड</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="वर्ष चुनें" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सभी वर्ष</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to={createPageUrl("DataEntry")}>
              <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg gap-2 h-9">
                <Plus className="w-4 h-4" />
                नया निमंत्रण जोड़ें
              </Button>
            </Link>
          </div>
        </div>

        {/* Yearly Statistics Table */}
        {yearlyStats.length > 0 && (
          <Card className="border-orange-200 shadow-lg max-w-2xl mx-auto">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 py-3">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                वार्षिक निमंत्रण सांख्यिकी
              </CardTitle>
              <p className="text-xs text-gray-600 mt-1 text-center">
                डेटा देखने के लिए संख्या पर क्लिक करें
              </p>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div className="overflow-x-auto flex justify-center">
                <table className="table-auto">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-2 text-center text-sm font-bold text-gray-700 whitespace-nowrap">
                        वर्ष (Year)
                      </th>
                      <th className="px-6 py-2 text-center text-sm font-bold text-gray-700 whitespace-nowrap">
                        निमंत्रण की संख्या
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(isTableExpanded ? yearlyStats : yearlyStats.slice(0, 3)).map(({ year, count }) => (
                      <tr 
                        key={year}
                        className={`hover:bg-orange-50 transition-colors ${
                          selectedYear === String(year) ? 'bg-orange-100' : ''
                        }`}
                      >
                        <td className="px-6 py-2 text-center text-sm font-medium text-gray-900">
                          {year}
                        </td>
                        <td 
                          className="px-6 py-2 text-center text-sm text-blue-600 font-semibold cursor-pointer hover:text-blue-800 hover:underline"
                          onClick={() => setSelectedYear(String(year))}
                          title={`${year} के ${count} निमंत्रण देखने के लिए क्लिक करें`}
                        >
                          {count.toLocaleString('hi-IN')}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold hover:bg-orange-50 transition-colors border-t-2 border-orange-200">
                      <td className="px-6 py-2 text-center text-sm text-gray-900">
                        कुल (Total)
                      </td>
                      <td 
                        className="px-6 py-2 text-center text-sm text-orange-600 font-bold cursor-pointer hover:text-orange-800 hover:underline"
                        onClick={() => setSelectedYear('all')}
                        title="सभी वर्षों के निमंत्रण देखने के लिए क्लिक करें"
                      >
                        {allPrograms.length.toLocaleString('hi-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {yearlyStats.length > 3 && (
                <div className="flex justify-center py-2 border-t border-gray-200 bg-gray-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTableExpanded(!isTableExpanded)}
                    className="text-xs text-gray-600 hover:text-orange-600 gap-1 h-7"
                  >
                    {isTableExpanded ? (
                      <>
                        कम दिखाएं <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        सभी वर्ष दिखाएं ({yearlyStats.length}) <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-orange-100 shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer hover:border-orange-300" onClick={() => setSelectedYear(selectedYear)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                कुल निमंत्रण
              </CardTitle>
              <FileText className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline" onClick={() => navigate(createPageUrl("DatabaseViewer"))} title="सभी निमंत्रण देखें">
                {stats.total}
              </div>
              <p className="text-xs text-gray-500 mt-1">सभी रिकॉर्ड</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100 shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer hover:border-blue-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                आगामी कार्यक्रम
              </CardTitle>
              <Calendar className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline" onClick={() => navigate(createPageUrl("ReminderList") + "?filter=week")} title="आगामी कार्यक्रम देखें">
                {stats.upcoming}
              </div>
              <p className="text-xs text-gray-500 mt-1">आने वाले कार्यक्रम</p>
            </CardContent>
          </Card>

          <Card className="border-green-100 shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer hover:border-green-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                उपस्थित हुए
              </CardTitle>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline" onClick={() => setSelectedYear(selectedYear) } title="उपस्थित रिकॉर्ड फ़िल्टर करने के लिए DataEntry में जाएं">
                {stats.attended}
              </div>
              <p className="text-xs text-gray-500 mt-1">उपस्थिति दर्ज</p>
            </CardContent>
          </Card>

          <Card className="border-red-100 shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer hover:border-red-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                फॉलोअप आवश्यक
              </CardTitle>
              <Bell className="w-5 h-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline" onClick={() => navigate(createPageUrl("ReminderList") + "?filter=upcoming")} title="फॉलोअप आवश्यक रिकॉर्ड देखें">
                {stats.needsFollowup}
              </div>
              <p className="text-xs text-gray-500 mt-1">पत्र भेजना बाकी</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent & Upcoming Programs */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Programs */}
          <Card className="border-orange-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-bold text-gray-900">
                  आगामी कार्यक्रम
                </CardTitle>
                <Link to={createPageUrl("ReminderList") + "?filter=month"}>
                  <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
                    सभी देखें →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {upcomingPrograms.length === 0 ? (
                <p className="text-gray-500 text-center py-8">कोई आगामी कार्यक्रम नहीं</p>
              ) : (
                <div className="space-y-4">
                  {upcomingPrograms.map((program) => (
                    <div
                      key={program.id}
                      onClick={() => navigate(createPageUrl("DataEntry") + `?edit=${program.id}`)}
                      className="flex items-start gap-4 p-4 rounded-lg border border-orange-100 hover:bg-orange-50 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-orange-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-orange-600">
                          {(() => {
                            try {
                              const date = new Date(program.Date);
                              return !isNaN(date.getTime()) ? format(date, 'd') : '-';
                            } catch { return '-'; }
                          })()}
                        </span>
                        <span className="text-xs text-orange-500">
                          {(() => {
                            try {
                              const date = new Date(program.Date);
                              return !isNaN(date.getTime()) ? format(date, 'MMM') : '';
                            } catch { return ''; }
                          })()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-orange-600">#{program.Sn}</span>
                          <h4 className="font-semibold text-gray-900">{program.SenderName}</h4>
                        </div>
                        <p className="text-sm text-gray-600">
                          {programTypesMap[program.programtyp] || program.programtyp || "-"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{program.Village}, {program.District}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Past Programs */}
          <Card className="border-orange-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-bold text-gray-900">
                  हाल के कार्यक्रम
                </CardTitle>
                <Link to={createPageUrl("LetterGenerator")}>
                  <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
                    पत्र जनरेट करें →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {recentPrograms.length === 0 ? (
                <p className="text-gray-500 text-center py-8">कोई पिछला कार्यक्रम नहीं</p>
              ) : (
                <div className="space-y-4">
                  {recentPrograms.map((program) => (
                    <div
                      key={program.id}
                      onClick={() => navigate(createPageUrl("DataEntry") + `?edit=${program.id}`)}
                      className="flex items-start gap-4 p-4 rounded-lg border border-orange-100 hover:bg-orange-50 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-gray-600">
                          {(() => {
                            try {
                              const date = new Date(program.Date);
                              return !isNaN(date.getTime()) ? format(date, 'd') : '-';
                            } catch { return '-'; }
                          })()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(() => {
                            try {
                              const date = new Date(program.Date);
                              return !isNaN(date.getTime()) ? format(date, 'MMM') : '';
                            } catch { return ''; }
                          })()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-orange-600">#{program.Sn}</span>
                              <h4 className="font-semibold text-gray-900">{program.SenderName}</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                              {programTypesMap[program.programtyp] || program.programtyp || "-"}
                            </p>
                          </div>
                          {program.Attended ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              उपस्थित
                            </span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                              अनुपस्थित
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{program.Village}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}