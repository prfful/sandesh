import React from "react";
import restClient from "@/api/restClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugProgramTypes() {
  const { data: programTypes, isLoading } = useQuery({
    queryKey: ['program-types'],
  queryFn: () => restClient.listEntities('ProgramType'),
    initialData: [],
  });

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
  queryFn: () => restClient.listEntities('Pragram'),
    initialData: [],
  });

  return (
    <div className="p-8 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Debug: Program Types</h1>
          <p className="text-gray-600 mt-1">यहाँ actual data structure देखें</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Program Types Raw Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(programTypes, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program Types - Individual Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {programTypes.map((pt, index) => (
                <div key={index} className="border p-4 rounded">
                  <h3 className="font-bold mb-2">Record {index + 1}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>pt.id:</strong> {pt.id || 'undefined'}</div>
                    <div><strong>pt.Programtyp:</strong> {pt.Programtyp || 'undefined'}</div>
                    <div><strong>pt.data:</strong> {pt.data ? JSON.stringify(pt.data) : 'undefined'}</div>
                    <div><strong>pt.properties:</strong> {pt.properties ? JSON.stringify(pt.properties) : 'undefined'}</div>
                  </div>
                  <div className="mt-2">
                    <strong>All Keys:</strong> {Object.keys(pt).join(', ')}
                  </div>
                  <div className="mt-2">
                    <strong>Full Object:</strong>
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(pt, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sample Programs with programtyp Field</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {programs.slice(0, 5).map((program, index) => (
                <div key={index} className="border p-4 rounded">
                  <h3 className="font-bold mb-2">Program #{program.Sn}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>SenderName:</strong> {program.SenderName}</div>
                    <div><strong>programtyp value:</strong> {program.programtyp || 'undefined'}</div>
                    <div><strong>programtyp type:</strong> {typeof program.programtyp}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}