/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { getComponentTheme } from "../utils/theme";
import { UserProfile } from "../types";
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { TrendingUp, Activity, BarChart2, PieChart as PieChartIcon, Heart, ShieldAlert, Sparkles, Loader2, MapPin, Users } from "lucide-react";

interface AnalyticsChartsProps {
  user: UserProfile;
}

export default function AnalyticsCharts({ user }: AnalyticsChartsProps) {
  const ct = getComponentTheme(user.role);
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sortByVolume, setSortByVolume] = useState<boolean>(true);
  const [showOnlyActive, setShowOnlyActive] = useState<boolean>(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [month]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/mpr/aggregate?month=${month}&userEmail=${encodeURIComponent(user.email)}`);
      const d = await res.json();
      if (d.success) {
        setData(d);
      }
    } catch (err) {
      console.error("Failed to load aggregate report for charts", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-500 font-medium">Aggregating historical charts data...</p>
      </div>
    );
  }

  if (!data || !data.hospitals || data.hospitals.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-slate-500 font-semibold">No data available for compiling visual dashboards in {month}.</p>
      </div>
    );
  }

  // 1. Chart: OPD load by hospital
  const opdChartData = data.hospitals.map((h: any) => ({
    name: h.hospitalName.replace("Ayush", "").trim(),
    OPD: h.opd_total,
    IPD: h.ipd_admissions * 10, // scaled for visualization
    "Raw IPD": h.ipd_admissions,
    Panchkarma: h.panchkarma_total
  }));

  // 2. Chart: Lab Tests breakdown
  const labTestsData = [
    { name: "Hemoglobin", value: data.districtTotal.hemoglobin },
    { name: "Blood Sugar", value: data.districtTotal.blood_sugar },
    { name: "Malaria", value: data.districtTotal.malaria },
    { name: "Dengue", value: data.districtTotal.dengue },
    { name: "Typhoid", value: data.districtTotal.typhoid },
    { name: "Urine Tests", value: data.districtTotal.urine_sugar + data.districtTotal.urine_albumin },
    { name: "Pregnancy", value: data.districtTotal.pregnancy_tests }
  ].filter(t => t.value > 0);

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

  // 3. Chart: Demographics breakdown
  const dt = data.districtTotal;
  const demographicsData = [
    { name: "Male", value: dt.opd_male_new + dt.opd_male_old },
    { name: "Female", value: dt.opd_female_new + dt.opd_female_old },
    { name: "Children", value: dt.opd_child_new + dt.opd_child_old },
    { name: "Elderly", value: dt.opd_elderly_new + dt.opd_elderly_old }
  ];

  const rawDiseaseTotals = data?.districtTotal?.diseaseTotals || [];
  
  // Format disease data for charts
  let diseaseChartData = rawDiseaseTotals.map((d: any) => {
    const nameEng = d.nameEnglish.split("/")[0].trim();
    const nameHindi = d.nameHindi;
    const newCount = (d.opd_male_new || 0) + (d.opd_female_new || 0) + (d.opd_child_new || 0);
    const oldCount = (d.opd_male_old || 0) + (d.opd_female_old || 0) + (d.opd_child_old || 0);
    const totalCount = d.opd_total || (newCount + oldCount);
    return {
      sNo: d.sNo,
      name: nameEng,
      hindiName: nameHindi,
      "New Patients": newCount,
      "Old Patients": oldCount,
      Total: totalCount
    };
  });

  // Filter if showOnlyActive is true
  if (showOnlyActive) {
    const activeData = diseaseChartData.filter((d: any) => d.Total > 0);
    // If we have some active disease logs, use them; otherwise show all
    if (activeData.length > 0) {
      diseaseChartData = activeData;
    }
  }

  // Sort based on sortByVolume
  if (sortByVolume) {
    diseaseChartData.sort((a: any, b: any) => b.Total - a.Total);
  } else {
    diseaseChartData.sort((a: any, b: any) => a.sNo - b.sNo);
  }

  const displayChartData = diseaseChartData;

  return (
    <div className="space-y-6" id="analytics-charts-root">
      
      {/* Month Selector header */}
      <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-5 shadow-sm flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <TrendingUp className={`w-6 h-6 ${ct.accentText}`} />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Visual Analytics Dashboard</h3>
            <p className="text-xs text-slate-500">Real-time epidemiological curves and caseload insights</p>
          </div>
        </div>
        <div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-current/15"
          />
        </div>
      </div>

      {/* Primary KPI highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-5 shadow-sm space-y-2`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">District Patient Footfall</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{dt.opd_total}</span>
            <span className={`text-xs ${ct.accentText} font-bold ${ct.badgeBg} px-1.5 py-0.5 rounded`}>OPD</span>
          </div>
          <p className="text-[10px] text-slate-400">Summed card registrations this month</p>
        </div>

        <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-5 shadow-sm space-y-2`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">IPD Admissions</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{dt.ipd_admissions}</span>
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">{dt.avg_bed_occupancy}% Bed Occupancy</span>
          </div>
          <p className="text-[10px] text-slate-400">Total inpatient admissions</p>
        </div>

        <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-5 shadow-sm space-y-2`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Specialist Procedures</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{dt.panchkarma_total}</span>
            <span className="text-xs text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">Panchkarma</span>
          </div>
          <p className="text-[10px] text-slate-400">Detoxification/rejuvenation procedures</p>
        </div>

        <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-5 shadow-sm space-y-2`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outreach Coverage</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{dt.camp_beneficiaries_total}</span>
            <span className="text-xs text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">{dt.camp_count} Camps</span>
          </div>
          <p className="text-[10px] text-slate-400">Meds & Screenings dispensed at camps</p>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Case Load by Hospital (Bar/Line combination) */}
        <div className={`lg:col-span-8 bg-white border ${ct.cardBorder} rounded-3xl p-5 shadow-sm space-y-4`}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BarChart2 className={`w-5 h-5 ${ct.accentText}`} />
            <h4 className="font-bold text-slate-800 text-sm">Facility Case-Load Distribution</h4>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opdChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }}
                  itemStyle={{ fontSize: "11px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="OPD" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="Panchkarma" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demographics Pie Chart */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <PieChartIcon className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-sm">Patient Demographics</h4>
          </div>
          <div className="h-60 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={demographicsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {demographicsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center absolute label */}
            <div className="absolute text-center space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total OPD</span>
              <span className="text-xl font-black text-slate-800">{dt.opd_total}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium">
            {demographicsData.map((d, index) => (
              <div key={d.name} className="flex items-center gap-1.5 justify-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span>{d.name}: <strong>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Outreach Camps & Mobile Screening Analytics */}
        <div className={`lg:col-span-12 bg-white border ${ct.cardBorder} rounded-3xl p-6 shadow-sm space-y-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-2xl">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base">Outreach Health Camps & Mobile Screenings</h4>
                <p className="text-xs text-slate-500">Consolidated village performance, beneficiary coverage, and diagnostic metrics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-100">
                {dt.camp_count || 0} Camps Active
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                {dt.camp_beneficiaries_total || 0} Total Beneficiaries
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Village Impact Chart */}
            <div className="xl:col-span-8 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Village Outreach Impact (Top Camps)</span>
              
              {(!data?.districtTotal?.camps || data.districtTotal.camps.length === 0) ? (
                <div className="h-80 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                  <MapPin className="w-8 h-8 text-slate-300 animate-pulse mb-2" />
                  <p className="text-xs font-bold text-slate-600">No active outreach health camps organized this month.</p>
                  <p className="text-[10px] text-slate-400">Use the calendar entry forms to log village camps and statistics.</p>
                </div>
              ) : (
                <div className="h-[380px] border border-slate-100 rounded-2xl p-3 bg-slate-50/30">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.districtTotal.camps.map((c: any, i: number) => ({
                        name: c.loc || `Camp ${i + 1}`,
                        "Beneficiaries": Number(c.total || 0),
                        "Medicines Distributed": Number(c.meds || 0),
                        "NCD Screenings": Number(c.screenings || 0)
                      })).slice(0, 10)}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="campBenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#fda4af" stopOpacity={0.3} />
                        </linearGradient>
                        <linearGradient id="campMedsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#a7f3d0" stopOpacity={0.3} />
                        </linearGradient>
                        <linearGradient id="campScreenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#bfdbfe" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b", fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "16px",
                          border: "none",
                          color: "#fff",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                        }}
                        itemStyle={{ fontSize: "11px" }}
                        labelStyle={{ fontSize: "11px", fontWeight: "bold" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                      <Bar dataKey="Beneficiaries" fill="url(#campBenGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="Medicines Distributed" fill="url(#campMedsGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="NCD Screenings" fill="url(#campScreenGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Camp Demographics */}
            <div className="xl:col-span-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Camp Beneficiary Split</span>
                
                <div className="h-56 relative flex items-center justify-center border border-slate-100 rounded-2xl p-4 bg-slate-50/20">
                  {(!data?.districtTotal?.camps || data.districtTotal.camps.length === 0) ? (
                    <div className="text-center text-slate-400 text-xs font-medium">No camp demographic data</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Male", value: data.districtTotal.camps.reduce((acc: number, curr: any) => acc + Number(curr.male || 0), 0) },
                              { name: "Female", value: data.districtTotal.camps.reduce((acc: number, curr: any) => acc + Number(curr.female || 0), 0) },
                              { name: "Children", value: data.districtTotal.camps.reduce((acc: number, curr: any) => acc + Number(curr.child || 0), 0) }
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {[
                              <Cell key="cell-0" fill="#f43f5e" />,
                              <Cell key="cell-1" fill="#10b981" />,
                              <Cell key="cell-2" fill="#3b82f6" />
                            ]}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "11px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center space-y-0.5">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Served</span>
                        <span className="text-lg font-black text-slate-800">{dt.camp_beneficiaries_total || 0}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Legend list */}
                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 font-medium">
                  <div className="flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-rose-500 mb-1"></span>
                    <span className="font-bold text-slate-700">Male</span>
                    <span className="font-extrabold text-slate-800">
                      {data?.districtTotal?.camps?.reduce((acc: number, curr: any) => acc + Number(curr.male || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mb-1"></span>
                    <span className="font-bold text-slate-700">Female</span>
                    <span className="font-extrabold text-slate-800">
                      {data?.districtTotal?.camps?.reduce((acc: number, curr: any) => acc + Number(curr.female || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mb-1"></span>
                    <span className="font-bold text-slate-700">Children</span>
                    <span className="font-extrabold text-slate-800">
                      {data?.districtTotal?.camps?.reduce((acc: number, curr: any) => acc + Number(curr.child || 0), 0) || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Outreach quick summary text */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    <strong className="text-slate-700">Outreach Intelligence:</strong> Health camps play a critical role in early non-communicable disease (NCD) screenings. On average, {dt.camp_count > 0 ? Math.round((dt.camp_ncd_screenings || 0) / dt.camp_count) : 0} patients are screened per camp.
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Table of all Camp Logs organized in the month */}
          {data?.districtTotal?.camps && data.districtTotal.camps.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Camp Field Logs Registry ({data.districtTotal.camps.length} Camps)</span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">S.No</th>
                      <th className="p-3">Location / Village</th>
                      <th className="p-3 text-center">Beneficiaries (M / F / C)</th>
                      <th className="p-3 text-center">Total Beneficiaries</th>
                      <th className="p-3 text-center">Medicines Distributed</th>
                      <th className="p-3 text-center">NCD Screenings</th>
                      <th className="p-3 text-center">Ayurvidya Awareness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {data.districtTotal.camps.map((camp: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            {camp.loc}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-rose-600">M: {camp.male || 0}</span>
                          <span className="text-slate-300 mx-1.5">|</span>
                          <span className="text-emerald-600">F: {camp.female || 0}</span>
                          <span className="text-slate-300 mx-1.5">|</span>
                          <span className="text-blue-600">C: {camp.child || 0}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 bg-slate-50/30">{camp.total || 0}</td>
                        <td className="p-3 text-center font-mono text-emerald-600">{camp.meds || 0}</td>
                        <td className="p-3 text-center font-mono text-indigo-600">{camp.screenings || 0}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                            {camp.ayurvidya_sessions || 0} sessions
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
