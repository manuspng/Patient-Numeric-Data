/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { getComponentTheme } from "../utils/theme";
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  TrendingUp,
  FileText,
  BookmarkCheck,
  Award,
  Settings,
  Calendar,
  CalendarRange,
  BarChart2
} from "lucide-react";
import * as XLSX from "xlsx";
import { UserRole, UserProfile, CustomReportTemplate } from "../types";
import PremiumReportModal from "./PremiumReportModal";

const DEFAULT_HOSPITAL_TYPES = [
  "राजकीय आयुर्वेदिक चिकित्सालय",
  "राजकीय यूनानी चिकित्सालय",
  "आयुष विंग( पुरुष ) जिला चिकित्सालय",
  "आयुष विंग( महिला ) जिला चिकित्सालय",
  "आयुष विंग - अति प्राथमिक चिकित्सालय",
  "आयुष्मान आरोग्य मंदिर"
];

interface MPRReportProps {
  user: UserProfile;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  sharedMonth?: string;
  setSharedMonth?: (month: string) => void;
}

export default function MPRReport({ 
  user,
  activeTab,
  setActiveTab,
  sharedMonth,
  setSharedMonth
}: MPRReportProps) {
  const ct = getComponentTheme(user.role);
  const [localMonth, setLocalMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const month = sharedMonth || localMonth;
  const setMonth = setSharedMonth || setLocalMonth;
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<"proforma1" | "proforma2" | "camp" | "testkit" | "disease_graph">("proforma1");

  // Custom templates integration
  const [customTemplates, setCustomTemplates] = useState<CustomReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [targetFacilityCode, setTargetFacilityCode] = useState<string>("DIST-ALL");
  const [isCompilingCustom, setIsCompilingCustom] = useState(false);

  // Filter hospital type
  const [selectedHospitalType, setSelectedHospitalType] = useState<string>("ALL");

  // Custom customized period of time
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [customData, setCustomData] = useState<any | null>(null);
  const [isCustomLoading, setIsCustomLoading] = useState<boolean>(false);
  const [selectedCustomHospitalType, setSelectedCustomHospitalType] = useState<string>("ALL");

  useEffect(() => {
    fetchCustomTemplates();
  }, []);

  const fetchCustomPeriodReport = async () => {
    if (!customStartDate || !customEndDate) {
      alert("Please select both start and end dates.");
      return;
    }
    if (customStartDate > customEndDate) {
      alert("Start Date cannot be later than End Date.");
      return;
    }

    setIsCustomLoading(true);
    try {
      let url = `/api/mpr/aggregate-custom?startDate=${customStartDate}&endDate=${customEndDate}&userEmail=${encodeURIComponent(user.email)}`;
      if (user.role === UserRole.HOSPITAL_USER && user.hospitalId) {
        url += `&hospitalId=${user.hospitalId}`;
      }
      const res = await fetch(url);
      const d = await res.json();
      if (d.success) {
        setCustomData(d);
      } else {
        alert(d.message || "Failed to fetch custom period data.");
      }
    } catch (err) {
      console.error("Failed to load custom aggregate report", err);
      alert("An error occurred while loading custom report.");
    } finally {
      setIsCustomLoading(false);
    }
  };

  const fetchCustomTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const d = await res.json();
      if (d.success && d.templates) {
        setCustomTemplates(d.templates);
        if (d.templates.length > 0) {
          setSelectedTemplateId(d.templates[0].id);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch templates in MPR", e);
    }
  };

  const handleDownloadCustomExcel = async () => {
    const template = customTemplates.find(t => t.id === selectedTemplateId);
    if (!template) {
      alert("Please select a custom template first.");
      return;
    }
    if (!data) {
      alert("No aggregated monthly data found. Please wait until month loads.");
      return;
    }

    setIsCompilingCustom(true);
    try {
      // Find selected facility source record
      let recordSource: any = null;
      if (targetFacilityCode === "DIST-ALL") {
        recordSource = data.districtTotal;
      } else {
        recordSource = (data.hospitals || []).find((h: any) => h.hospitalCode === targetFacilityCode);
      }

      if (!recordSource) {
        alert("Selected facility records could not be found.");
        return;
      }

      // Convert template base64 string to Uint8Array safely
      let binaryString = "";
      try {
        // Strip out base64 header if it mistakenly has one (e.g., data:application/...;base64,)
        const base64Clean = template.fileBase64.includes(",") 
          ? template.fileBase64.split(",")[1] 
          : template.fileBase64;
        binaryString = atob(base64Clean);
      } catch (err: any) {
        console.error("Base64 decode error on template:", err);
        alert(`❌ Failed to decode custom template file: The template data is corrupted or is not a valid Base64 string. Details: ${err.message}`);
        setIsCompilingCustom(false);
        return;
      }
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Read Excel workbook using SheetJS
      const workbook = XLSX.read(bytes.buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        alert("Active worksheet not found in custom Excel template.");
        return;
      }

      // Write mapped data into cells
      template.mappings.forEach((mapping) => {
        const { cellRef, systemField } = mapping;
        
        let valueToWrite: any = "";
        
        // Match standard system properties or custom fields
        if (recordSource[systemField] !== undefined) {
          valueToWrite = recordSource[systemField];
        } else if (recordSource.customFieldsAgg && recordSource.customFieldsAgg[systemField] !== undefined) {
          valueToWrite = recordSource.customFieldsAgg[systemField];
        } else {
          valueToWrite = ""; // empty fallback
        }

        // Format to number if numeric
        const num = Number(valueToWrite);
        const finalVal = isNaN(num) || valueToWrite === "" || valueToWrite === null ? valueToWrite : num;

        // Write to SheetJS cell
        worksheet[cellRef] = { 
          v: finalVal, 
          t: typeof finalVal === "number" ? "n" : "s"
        };
      });

      // Write populated workbook and save file locally in browser
      const outMonth = month.replace("-", "_");
      const outFacility = targetFacilityCode.toLowerCase().replace(/[-_]/g, "_");
      XLSX.writeFile(workbook, `Ayush_Report_${outMonth}_${outFacility}.xlsx`);

    } catch (err) {
      console.error("Custom Excel compilation failed", err);
      alert("An error occurred during Excel generation. Ensure your template is a valid spreadsheet file.");
    } finally {
      setIsCompilingCustom(false);
    }
  };

  const getMonthNameHindi = (monthStr: string) => {
    const parts = monthStr.split("-");
    if (parts.length !== 2) return { monthHindi: "", year: "" };
    const [yearStr, monthNumStr] = parts;
    const monthNamesHindi = [
      "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", 
      "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"
    ];
    const idx = parseInt(monthNumStr, 10) - 1;
    return {
      monthHindi: monthNamesHindi[idx] || "",
      year: yearStr
    };
  };

  useEffect(() => {
    fetchAggregatedReport();
  }, [month, activeTab]);

  const fetchAggregatedReport = async () => {
    setIsLoading(true);
    setAiSummary("");
    try {
      let url = `/api/mpr/aggregate?month=${month}&userEmail=${encodeURIComponent(user.email)}`;
      if (user.role === UserRole.HOSPITAL_USER && user.hospitalId) {
        url += `&hospitalId=${user.hospitalId}`;
      }
      const res = await fetch(url);
      const d = await res.json();
      if (d.success) {
        setData(d);
        if (user.role === UserRole.HOSPITAL_USER && d.hospitals?.[0]) {
          setTargetFacilityCode(d.hospitals[0].hospitalCode);
        }
      }
    } catch (err) {
      console.error("Failed to load aggregate report", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellClick = () => {
    if (user.role === UserRole.HOSPITAL_USER && setActiveTab) {
      setActiveTab("calendar");
    }
  };

  const handleAiSummarize = async () => {
    if (!data) return;
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/mpr/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          districtTotal: data.districtTotal,
          hospitals: data.hospitals
        })
      });
      const resData = await res.json();
      setAiSummary(resData.summary || "Unable to generate summary.");
    } catch (err) {
      console.error("AI summarization failed", err);
      setAiSummary("⚠️ AI summarizes currently offline. Ensure GEMINI_API_KEY is configured.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    
    // Build CSV proforma
    const headers = [
      "Facility Code", "Facility Name", "Facility Type", "Days Submitted",
      "OPD Male New", "OPD Male Old", "OPD Female New", "OPD Female Old", "OPD Child New", "OPD Child Old", "OPD Elderly New", "OPD Elderly Old", "Total OPD",
      "IPD Admissions", "Avg Bed Occupancy %",
      "Panchkarma Male", "Panchkarma Female", "Panchkarma Child", "Panchkarma Elderly", "Total Panchkarma",
      "Govt Levy Collected (INR)", "Aadhaar Seeded", "Mobile Seeded",
      "Hemoglobin Test", "Blood Sugar Test", "Urine Sugar", "Urine Albumin", "Malaria RDT", "Dengue", "Typhoid", "Hep A", "Hep B", "Hep C", "Pregnancy Test", "Total Labs",
      "Outreach Camps Conducted", "Camp Beneficiaries", "Camp Meds Dispensed", "NCD Screenings", "Ayurvidya Sessions"
    ];

    const rows = [];

    // Consolidated District Total Row first (as requested: sticky Consolidated District Total)
    const dt = data.districtTotal;
    rows.push([
      dt.hospitalCode, dt.hospitalName, dt.hospitalType, dt.daysSubmitted,
      dt.opd_male_new, dt.opd_male_old, dt.opd_female_new, dt.opd_female_old, dt.opd_child_new, dt.opd_child_old, dt.opd_elderly_new, dt.opd_elderly_old, dt.opd_total,
      dt.ipd_admissions, dt.avg_bed_occupancy,
      dt.panchkarma_male, dt.panchkarma_female, dt.panchkarma_child, dt.panchkarma_elderly, dt.panchkarma_total,
      dt.levy_charges, dt.aadhaar_seeded, dt.mobile_seeded,
      dt.hemoglobin, dt.blood_sugar, dt.urine_sugar, dt.urine_albumin, dt.malaria, dt.dengue, dt.typhoid, dt.hepatitis_a, dt.hepatitis_b, dt.hepatitis_c, dt.pregnancy_tests, dt.total_tests,
      dt.camp_count, dt.camp_beneficiaries_total, dt.camp_medicines_distributed, dt.camp_ncd_screenings, dt.camp_ayurvidya_sessions
    ]);

    // Individual Hospitals
    (data.hospitals || []).forEach((h: any) => {
      rows.push([
        h.hospitalCode, h.hospitalName, h.hospitalType, h.daysSubmitted,
        h.opd_male_new, h.opd_male_old, h.opd_female_new, h.opd_female_old, h.opd_child_new, h.opd_child_old, h.opd_elderly_new, h.opd_elderly_old, h.opd_total,
        h.ipd_admissions, h.avg_bed_occupancy,
        h.panchkarma_male, h.panchkarma_female, h.panchkarma_child, h.panchkarma_elderly, h.panchkarma_total,
        h.levy_charges, h.aadhaar_seeded, h.mobile_seeded,
        h.hemoglobin, h.blood_sugar, h.urine_sugar, h.urine_albumin, h.malaria, h.dengue, h.typhoid, h.hepatitis_a, h.hepatitis_b, h.hepatitis_c, h.pregnancy_tests, h.total_tests,
        h.camp_count, h.camp_beneficiaries_total, h.camp_medicines_distributed, h.camp_ncd_screenings, h.camp_ayurvidya_sessions
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ayush_District_MPR_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    setSelectedReportType("proforma1");
    setIsReportModalOpen(true);
  };

  return (
    <div className="space-y-6" id="mpr-report-root">
      
      {/* SELECTION AND CONTROLS HEADER */}
      <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-5 shadow-sm flex flex-col gap-4 print:hidden`}>
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className={`p-2 rounded-xl ${ct.accentBg}`}>
            <FileSpreadsheet className={`w-6 h-6 ${ct.accentText}`} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Periodic Progress Report (Printable)</h3>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 w-full">
          <div className="w-full md:w-auto">
            <label className="text-xs text-slate-500 font-medium block mb-1">Select Reporting Month</label>
            <div className="grid grid-cols-2 gap-2 min-w-[220px]">
              <select
                value={month.split("-")[1] || "01"}
                onChange={(e) => {
                  const currentYear = month.split("-")[0] || "2026";
                  const newMonth = e.target.value;
                  setMonth(`${currentYear}-${newMonth}`);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-current/15 focus:border-current transition-all cursor-pointer w-full"
              >
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
              <select
                value={month.split("-")[0] || "2026"}
                onChange={(e) => {
                  const currentMonth = month.split("-")[1] || "01";
                  const newYear = e.target.value;
                  setMonth(`${newYear}-${currentMonth}`);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-current/15 focus:border-current transition-all cursor-pointer w-full"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full md:w-auto sm:flex sm:items-center sm:gap-3">
            <button
              onClick={handleExportCSV}
              disabled={!data}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto h-9"
            >
              <Download className="w-4 h-4" />
              1-Click Excel CSV
            </button>

            <button
              id="print-download-reports-btn"
              onClick={handlePrintPDF}
              disabled={!data}
              className={`${ct.buttonBg} text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto h-9`}
            >
              <Printer className="w-4 h-4" />
              Print/download reports
            </button>
          </div>
        </div>
      </div>

      {/* OFFICIAL EXCEL PROFORMA COMPILER */}
      {data && customTemplates.length > 0 && (
        <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-6 shadow-sm space-y-4 print:hidden`} id="official-excel-compiler">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className={`p-2.5 rounded-2xl border border-current/10 ${ct.accentBg}`}>
              <FileSpreadsheet className={`w-5 h-5 ${ct.accentText}`} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">📋 Populate Official Excel Report</h4>
              <p className="text-[11px] text-slate-500">Furnish reports inside your department's exact spreadsheet proforma templates</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs font-bold text-slate-700">
            <div className="md:col-span-4">
              <label className="block mb-1.5 text-slate-600">Select Custom Format Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:ring-1 focus:ring-current outline-none"
              >
                {customTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.fileName})</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block mb-1.5 text-slate-600">Select Compiled Facility Scope</label>
              {user.role === UserRole.HOSPITAL_USER ? (
                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-bold leading-normal truncate">
                  {data?.hospitals?.[0]?.hospitalName || "Assigned Hospital"}
                </div>
              ) : (
                <select
                  value={targetFacilityCode}
                  onChange={(e) => setTargetFacilityCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:ring-1 focus:ring-current outline-none"
                >
                  <option value="DIST-ALL">Consolidated District Total</option>
                  {data.hospitals?.map((h: any) => (
                    <option key={h.hospitalCode} value={h.hospitalCode}>{h.hospitalName} [{h.hospitalType}]</option>
                  ))}
                </select>
              )}
            </div>

            <div className="md:col-span-4">
              <button
                onClick={handleDownloadCustomExcel}
                disabled={isCompilingCustom}
                className={`w-full ${ct.buttonBg} text-white font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md h-10`}
              >
                {isCompilingCustom ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Writing spreadsheet cells...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-white" />
                    Compile & Download Excel Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* PREMIUM PROFORMA PDF REPORTS DOWNLOAD CENTER */}
      {data && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded-xl">
              <Award className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Recommended Proforma Reports</h4>
              <p className="text-[11px] text-slate-500">Select any proforma below to preview, print, or download reports</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Proforma 1 */}
            <div className="bg-slate-50 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-2xl p-4.5 space-y-3 transition-all flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Proforma 1</span>
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-800 leading-snug">Monthly Patient Report (Disease Wise)</h5>
                <p className="text-[10px] text-slate-500 leading-normal">मासिक रोगी रोगवार विवरण - Consolidated disease-wise monthly patient registry database.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedReportType("proforma1");
                  setIsReportModalOpen(true);
                }}
                className="w-full bg-slate-850 hover:bg-emerald-800 text-white text-[10px] font-bold py-2 rounded-xl transition-all"
              >
                Preview & Print Proforma 1
              </button>
            </div>

            {/* Proforma 2 */}
            <div className="bg-slate-50 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-2xl p-4.5 space-y-3 transition-all flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">Proforma 2</span>
                  <Award className="w-4 h-4 text-slate-400" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-800 leading-snug">Annual Patient Report (Disease Wise)</h5>
                <p className="text-[10px] text-slate-500 leading-normal">वार्षिक रोगी रोगवार विवरण - Consolidated disease-wise annual patient registry database.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedReportType("proforma2");
                  setIsReportModalOpen(true);
                }}
                className="w-full bg-slate-850 hover:bg-emerald-800 text-white text-[10px] font-bold py-2 rounded-xl transition-all"
              >
                Preview & Print Proforma 2
              </button>
            </div>

            {/* Camp Report */}
            <div className="bg-slate-50 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-2xl p-4.5 space-y-3 transition-all flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">Proforma 3</span>
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-800 leading-snug">Camp Outreach Report</h5>
                <p className="text-[10px] text-slate-500 leading-normal">शिविर स्वास्थ्य विवरण - Outreach health camps, beneficiary & screenings tally.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedReportType("camp");
                  setIsReportModalOpen(true);
                }}
                className="w-full bg-slate-850 hover:bg-emerald-800 text-white text-[10px] font-bold py-2 rounded-xl transition-all"
              >
                Preview & Print CHAMP
              </button>
            </div>

            {/* Testkit Report */}
            <div className="bg-slate-50 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-2xl p-4.5 space-y-3 transition-all flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">Proforma 4</span>
                  <CheckCircle2 className="w-4 h-4 text-slate-400" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-800 leading-snug">Diagnostic Testkit Report</h5>
                <p className="text-[10px] text-slate-500 leading-normal">जांच एवं औषधि विवरण - Laboratory diagnostic kit stocks & utilization register.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedReportType("testkit");
                  setIsReportModalOpen(true);
                }}
                className="w-full bg-slate-850 hover:bg-emerald-800 text-white text-[10px] font-bold py-2 rounded-xl transition-all"
              >
                Preview & Print TESTKIT
              </button>
            </div>

            {/* Disease Burden Visual Chart Report */}
            <div className="bg-slate-50 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-2xl p-4.5 space-y-3 transition-all flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">PROFORMA 5</span>
                  <BarChart2 className="w-4 h-4 text-slate-400" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-800 leading-snug">Disease Burden Visual Report</h5>
                <p className="text-[10px] text-slate-500 leading-normal">महामारी विज्ञान चार्ट - Print-ready graphical trend analysis of disease-wise numeric caseloads.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedReportType("disease_graph");
                  setIsReportModalOpen(true);
                }}
                className="w-full bg-slate-850 hover:bg-purple-800 text-white text-[10px] font-bold py-2 rounded-xl transition-all"
              >
                Preview & Print Visual Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STRICT PROFORMA DATAGRID TABLE */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">Aggregating district logs and compiling MPR sheets...</p>
        </div>
      ) : data ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-0 print:shadow-none">
          
          {/* Print Style Injector for Landscape PDF */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: A4 landscape;
                margin: 0.5cm;
              }
              body {
                background: white !important;
                color: black !important;
              }
              /* Hide standard layout wrapper margins and sidebars when printing */
              aside, header, footer, .print\\:hidden {
                display: none !important;
              }
              main {
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: transparent !important;
              }
              #mpr-report-root {
                margin: 0 !important;
                padding: 0 !important;
              }
              table {
                page-break-inside: auto;
                font-size: 8px !important; /* Scale table text for print */
                width: 100% !important;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              th, td {
                padding: 4px 2px !important;
                border: 1px solid #94a3b8 !important; /* Ensure crisp visible borders when printing */
              }
              .sticky {
                position: static !important;
              }
            }
          `}} />

          {/* Print official Letterhead (Landscape optimized) */}
          <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-normal mb-1">मासिक रोगी विवरण</h1>
            <h2 className="text-md font-bold text-slate-700 tracking-wide uppercase">
              {(data.hospitals || []).length === 1 ? (data.hospitals || [])[0].hospitalName : "जनपद - ऊधम सिंह नगर (District Udham Singh Nagar)"}
            </h2>
            <p className="text-sm font-bold text-slate-600 mt-1.5">
              मास: {getMonthNameHindi(month).monthHindi} &nbsp;&nbsp; वर्ष: {getMonthNameHindi(month).year}
            </p>
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2 font-mono">
              <span>Date Compiled: {new Date().toLocaleDateString()}</span>
              <span>Portal Verification ID: SECURE-ONLINE-SYSTEM</span>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 print:hidden">
            {user.role === UserRole.HOSPITAL_USER ? (
              <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>👉 Tip: Click any row or cell in this report to jump directly to the Calendar Entry page to edit daily logs.</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Compounded Grid Sheet</span>
            )}
            
            {user.role !== UserRole.HOSPITAL_USER && (
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hospital Type Filter:</label>
                <select
                  value={selectedHospitalType}
                  onChange={(e) => setSelectedHospitalType(e.target.value)}
                  className="bg-white border border-slate-250 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
                >
                  <option value="ALL">All Hospital Types (समस्त विधा)</option>
                  {Array.from(new Set([
                    ...DEFAULT_HOSPITAL_TYPES,
                    ...(data?.hospitals?.map((h: any) => h.hospitalType) || [])
                  ])).filter(Boolean).map((type: any) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full font-bold">
                  Sticky Consolidated District Totals Active
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                {/* Master Headers group */}
                <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 uppercase tracking-wider font-bold text-[9px] text-center">
                  <th className="py-2.5 px-3 text-left border-r border-slate-200" colSpan={3}>Facility Details</th>
                  <th className="py-2.5 px-3 border-r border-slate-200" colSpan={5}>Outpatient Department (OPD)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200" colSpan={1}>IPD Admissions</th>
                  <th className="py-2.5 px-3 border-r border-slate-200" colSpan={3}>Panchkarma Procedures</th>
                  <th className="py-2.5 px-3 border-r border-slate-200" colSpan={3}>Levy & Seeded IDs</th>
                  <th className="py-2.5 px-3 border-r border-slate-200" colSpan={12}>Investigations & Laboratory Registry</th>
                  <th className="py-2.5 px-3" colSpan={2}>Mobile Outreach Camps</th>
                </tr>
                {/* Specific field headers */}
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold text-[9px] text-center">
                  {/* Facility info */}
                  <th className="py-2 px-2 text-left border-r border-slate-200">Code</th>
                  <th className="py-2 px-2 text-left border-r border-slate-200 w-32">Hospital Name</th>
                  <th className="py-2 px-2 border-r border-slate-200">Days Logged</th>
                  {/* OPD */}
                  <th className="py-2 px-1">M(N)</th><th className="py-2 px-1">M(O)</th>
                  <th className="py-2 px-1">F(N)</th><th className="py-2 px-1">F(O)</th>
                  <th className="py-2 px-1 font-bold bg-slate-100/50 border-r border-slate-200">Total</th>
                  {/* IPD */}
                  <th className="py-2 px-1 border-r border-slate-200">Adm</th>
                  {/* Panchkarma */}
                  <th className="py-2 px-1">M</th><th className="py-2 px-1">F</th>
                  <th className="py-2 px-1 font-bold bg-slate-100/50 border-r border-slate-200">Total</th>
                  {/* Seeded */}
                  <th className="py-2 px-1 font-bold bg-emerald-50/50 text-emerald-800">Levy (₹)</th>
                  <th className="py-2 px-1">Aadhaar</th>
                  <th className="py-2 px-1 border-r border-slate-200">Mobile</th>
                  {/* Labs */}
                  <th className="py-2 px-1">Hb</th><th className="py-2 px-1">Sugar</th>
                  <th className="py-2 px-1">UrS</th><th className="py-2 px-1">UrA</th>
                  <th className="py-2 px-1">Mal</th><th className="py-2 px-1">Den</th>
                  <th className="py-2 px-1">Typ</th><th className="py-2 px-1">HepA</th>
                  <th className="py-2 px-1">HepB</th><th className="py-2 px-1">HepC</th>
                  <th className="py-2 px-1">Preg</th>
                  <th className="py-2 px-1 font-bold bg-slate-100/50 border-r border-slate-200">Total Tests</th>
                  {/* Camps */}
                  <th className="py-2 px-1">Camps</th>
                  <th className="py-2 px-1">Benef</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                
                {/* 1. STICKY CONSOLIDATED DISTRICT TOTAL ROW (AS REQUESTED) */}
                {(() => {
                  const dt = data.districtTotal;
                  return (
                    <tr 
                      onClick={handleCellClick}
                      title={user.role === UserRole.HOSPITAL_USER ? "Click to jump to Calendar Entry to log/edit daily reports" : undefined}
                      className={`bg-emerald-50/75 border-b-2 border-emerald-300 font-bold text-slate-900 hover:bg-emerald-100/90 transition-all text-center ${user.role === UserRole.HOSPITAL_USER ? "cursor-pointer" : ""}`}
                    >
                      <td className="py-3 px-2 text-left border-r border-emerald-200 font-mono text-[10px] text-emerald-950">{dt.hospitalCode}</td>
                      <td className="py-3 px-2 text-left border-r border-emerald-200 text-emerald-950 font-bold">{dt.hospitalName}</td>
                      <td className="py-3 px-2 border-r border-emerald-200 text-emerald-950">{dt.daysSubmitted}</td>
                      {/* OPD */}
                      <td className="py-3 px-1">{dt.opd_male_new}</td><td className="py-3 px-1">{dt.opd_male_old}</td>
                      <td className="py-3 px-1">{dt.opd_female_new}</td><td className="py-3 px-1">{dt.opd_female_old}</td>
                      <td className="py-3 px-1 bg-emerald-100/60 border-r border-emerald-200 font-extrabold">{dt.opd_total}</td>
                      {/* IPD */}
                      <td className="py-3 px-1 border-r border-emerald-200">{dt.ipd_admissions}</td>
                      {/* Panchkarma */}
                      <td className="py-3 px-1">{dt.panchkarma_male}</td><td className="py-3 px-1">{dt.panchkarma_female}</td>
                      <td className="py-3 px-1 bg-emerald-100/60 border-r border-emerald-200 font-extrabold">{dt.panchkarma_total}</td>
                      {/* Seeded */}
                      <td className="py-3 px-1 bg-emerald-100 font-extrabold text-emerald-950">₹{dt.levy_charges}</td>
                      <td className="py-3 px-1">{dt.aadhaar_seeded}</td>
                      <td className="py-3 px-1 border-r border-emerald-200">{dt.mobile_seeded}</td>
                      {/* Labs */}
                      <td className="py-3 px-1">{dt.hemoglobin}</td><td className="py-3 px-1">{dt.blood_sugar}</td>
                      <td className="py-3 px-1">{dt.urine_sugar}</td><td className="py-3 px-1">{dt.urine_albumin}</td>
                      <td className="py-3 px-1">{dt.malaria}</td><td className="py-3 px-1">{dt.dengue}</td>
                      <td className="py-3 px-1">{dt.typhoid}</td><td className="py-3 px-1">{dt.hepatitis_a}</td>
                      <td className="py-3 px-1">{dt.hepatitis_b}</td><td className="py-3 px-1">{dt.hepatitis_c}</td>
                      <td className="py-3 px-1">{dt.pregnancy_tests}</td>
                      <td className="py-3 px-1 bg-emerald-100/60 border-r border-emerald-200 font-extrabold">{dt.total_tests}</td>
                      {/* Camps */}
                      <td className="py-3 px-1">{dt.camp_count}</td>
                      <td className="py-3 px-1">{dt.camp_beneficiaries_total}</td>
                    </tr>
                  );
                })()}

                {/* 2. INDIVIDUAL HOSPITALS SUB-ROWS */}
                 {(data.hospitals || [])
                  .filter((h: any) => selectedHospitalType === "ALL" || h.hospitalType === selectedHospitalType)
                  .map((h: any) => (
                    <tr 
                      key={h.hospitalId}
                      onClick={handleCellClick}
                      title={user.role === UserRole.HOSPITAL_USER ? "Click to jump to Calendar Entry to log/edit daily reports" : undefined}
                      className={`hover:bg-slate-50 transition-colors text-center divide-x divide-slate-100 text-[11px] text-slate-700 ${user.role === UserRole.HOSPITAL_USER ? "cursor-pointer hover:bg-emerald-50/45" : ""}`}
                    >
                      <td className="py-2.5 px-2 text-left font-mono font-medium text-slate-500">{h.hospitalCode}</td>
                      <td className="py-2.5 px-2 text-left font-semibold text-slate-800">{h.hospitalName}</td>
                      <td className="py-2.5 px-2 font-medium">{h.daysSubmitted}</td>
                      {/* OPD */}
                      <td className="py-2 px-1">{h.opd_male_new}</td><td className="py-2 px-1">{h.opd_male_old}</td>
                      <td className="py-2 px-1">{h.opd_female_new}</td><td className="py-2 px-1">{h.opd_female_old}</td>
                      <td className="py-2 px-1 font-bold bg-slate-50 text-slate-900">{h.opd_total}</td>
                      {/* IPD */}
                      <td className="py-2 px-1 font-semibold">{h.ipd_admissions}</td>
                      {/* Panchkarma */}
                      <td className="py-2 px-1">{h.panchkarma_male}</td><td className="py-2 px-1">{h.panchkarma_female}</td>
                      <td className="py-2 px-1 font-bold bg-slate-50 text-slate-900">{h.panchkarma_total}</td>
                      {/* Seeded */}
                      <td className="py-2 px-1 font-bold bg-emerald-50/30 text-emerald-800">₹{h.levy_charges}</td>
                      <td className="py-2 px-1">{h.aadhaar_seeded}</td>
                      <td className="py-2 px-1">{h.mobile_seeded}</td>
                      {/* Labs */}
                      <td className="py-2 px-1">{h.hemoglobin}</td><td className="py-2 px-1">{h.blood_sugar}</td>
                      <td className="py-2 px-1">{h.urine_sugar}</td><td className="py-2 px-1">{h.urine_albumin}</td>
                      <td className="py-2 px-1">{h.malaria}</td><td className="py-2 px-1">{h.dengue}</td>
                      <td className="py-2 px-1">{h.typhoid}</td><td className="py-2 px-1">{h.hepatitis_a}</td>
                      <td className="py-2 px-1">{h.hepatitis_b}</td><td className="py-2 px-1">{h.hepatitis_c}</td>
                      <td className="py-2 px-1">{h.pregnancy_tests}</td>
                      <td className="py-2 px-1 font-bold bg-slate-50 text-slate-900">{h.total_tests}</td>
                      {/* Camps */}
                      <td className="py-2 px-1 font-semibold">{h.camp_count}</td>
                      <td className="py-2 px-1">{h.camp_beneficiaries_total}</td>
                    </tr>
                  ))}

                {/* 3. TYPE SUBTOTAL ROW (IF SPECIFIC TYPE SELECTED) */}
                {selectedHospitalType !== "ALL" && (() => {
                  const filteredHospitals = (data.hospitals || []).filter((h: any) => h.hospitalType === selectedHospitalType);
                  
                  const sub = filteredHospitals.reduce((acc: any, curr: any) => {
                    return {
                      daysSubmitted: acc.daysSubmitted + curr.daysSubmitted,
                      opd_male_new: acc.opd_male_new + curr.opd_male_new,
                      opd_male_old: acc.opd_male_old + curr.opd_male_old,
                      opd_female_new: acc.opd_female_new + curr.opd_female_new,
                      opd_female_old: acc.opd_female_old + curr.opd_female_old,
                      opd_child_new: acc.opd_child_new + curr.opd_child_new,
                      opd_child_old: acc.opd_child_old + curr.opd_child_old,
                      opd_total: acc.opd_total + curr.opd_total,
                      ipd_admissions: acc.ipd_admissions + curr.ipd_admissions,
                      avg_bed_occupancy: acc.avg_bed_occupancy + curr.avg_bed_occupancy,
                      panchkarma_male: acc.panchkarma_male + curr.panchkarma_male,
                      panchkarma_female: acc.panchkarma_female + curr.panchkarma_female,
                      panchkarma_child: acc.panchkarma_child + curr.panchkarma_child,
                      panchkarma_total: acc.panchkarma_total + curr.panchkarma_total,
                      levy_charges: acc.levy_charges + curr.levy_charges,
                      aadhaar_seeded: acc.aadhaar_seeded + curr.aadhaar_seeded,
                      mobile_seeded: acc.mobile_seeded + curr.mobile_seeded,
                      hemoglobin: acc.hemoglobin + curr.hemoglobin,
                      blood_sugar: acc.blood_sugar + curr.blood_sugar,
                      urine_sugar: acc.urine_sugar + curr.urine_sugar,
                      urine_albumin: acc.urine_albumin + curr.urine_albumin,
                      malaria: acc.malaria + curr.malaria,
                      dengue: acc.dengue + curr.dengue,
                      typhoid: acc.typhoid + curr.typhoid,
                      hepatitis_a: acc.hepatitis_a + curr.hepatitis_a,
                      hepatitis_b: acc.hepatitis_b + curr.hepatitis_b,
                      hepatitis_c: acc.hepatitis_c + curr.hepatitis_c,
                      pregnancy_tests: acc.pregnancy_tests + curr.pregnancy_tests,
                      total_tests: acc.total_tests + curr.total_tests,
                      camp_count: acc.camp_count + curr.camp_count,
                      camp_beneficiaries_total: acc.camp_beneficiaries_total + curr.camp_beneficiaries_total,
                      camp_medicines_distributed: acc.camp_medicines_distributed + curr.camp_medicines_distributed,
                      camp_ncd_screenings: acc.camp_ncd_screenings + curr.camp_ncd_screenings,
                      camp_ayurvidya_sessions: acc.camp_ayurvidya_sessions + curr.camp_ayurvidya_sessions,
                    };
                  }, {
                    daysSubmitted: 0, opd_male_new: 0, opd_male_old: 0, opd_female_new: 0, opd_female_old: 0,
                    opd_child_new: 0, opd_child_old: 0, opd_total: 0, ipd_admissions: 0, avg_bed_occupancy: 0,
                    panchkarma_male: 0, panchkarma_female: 0, panchkarma_child: 0, panchkarma_total: 0,
                    levy_charges: 0, aadhaar_seeded: 0, mobile_seeded: 0, hemoglobin: 0, blood_sugar: 0,
                    urine_sugar: 0, urine_albumin: 0, malaria: 0, dengue: 0, typhoid: 0, hepatitis_a: 0,
                    hepatitis_b: 0, hepatitis_c: 0, pregnancy_tests: 0, total_tests: 0, camp_count: 0,
                    camp_beneficiaries_total: 0, camp_medicines_distributed: 0, camp_ncd_screenings: 0, camp_ayurvidya_sessions: 0
                  });
                  
                  const avgOcc = filteredHospitals.length > 0 ? Math.round(sub.avg_bed_occupancy / filteredHospitals.length) : 0;

                  return (
                    <tr className="bg-amber-100 font-bold text-slate-900 hover:bg-amber-150 transition-all text-center">
                      <td className="py-2.5 px-2 text-left border-r border-amber-200 font-mono text-[10px] text-amber-950">SUBTOTAL</td>
                      <td className="py-2.5 px-2 text-left border-r border-amber-200 text-amber-950 font-bold">Type: {selectedHospitalType} Cumulative</td>
                      <td className="py-2.5 px-2 border-r border-amber-200 text-amber-950">{sub.daysSubmitted}</td>
                      {/* OPD */}
                      <td className="py-2 px-1">{sub.opd_male_new}</td><td className="py-2 px-1">{sub.opd_male_old}</td>
                      <td className="py-2 px-1">{sub.opd_female_new}</td><td className="py-2 px-1">{sub.opd_female_old}</td>
                      <td className="py-2 px-1 bg-amber-250 border-r border-amber-200 font-extrabold">{sub.opd_total}</td>
                      {/* IPD */}
                      <td className="py-2 px-1 border-r border-amber-100">{sub.ipd_admissions}</td>
                      {/* Panchkarma */}
                      <td className="py-2 px-1">{sub.panchkarma_male}</td><td className="py-2 px-1">{sub.panchkarma_female}</td>
                      <td className="py-2 px-1 bg-amber-250 border-r border-amber-200 font-extrabold">{sub.panchkarma_total}</td>
                      {/* Seeded */}
                      <td className="py-2 px-1 bg-amber-250 font-extrabold text-amber-950">₹{sub.levy_charges}</td>
                      <td className="py-2 px-1">{sub.aadhaar_seeded}</td>
                      <td className="py-2 px-1 border-r border-amber-200">{sub.mobile_seeded}</td>
                      {/* Labs */}
                      <td className="py-2 px-1">{sub.hemoglobin}</td><td className="py-2 px-1">{sub.blood_sugar}</td>
                      <td className="py-2 px-1">{sub.urine_sugar}</td><td className="py-2 px-1">{sub.urine_albumin}</td>
                      <td className="py-2 px-1">{sub.malaria}</td><td className="py-2 px-1">{sub.dengue}</td>
                      <td className="py-2 px-1">{sub.typhoid}</td><td className="py-2 px-1">{sub.hepatitis_a}</td>
                      <td className="py-2 px-1">{sub.hepatitis_b}</td><td className="py-2 px-1">{sub.hepatitis_c}</td>
                      <td className="py-2 px-1">{sub.pregnancy_tests}</td>
                      <td className="py-2 px-1 bg-amber-250 border-r border-amber-200 font-extrabold">{sub.total_tests}</td>
                      {/* Camps */}
                      <td className="py-2 px-1">{sub.camp_count}</td>
                      <td className="py-2 px-1">{sub.camp_beneficiaries_total}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 p-4 border-t border-slate-150 text-[10px] text-slate-400 font-semibold print:hidden flex flex-wrap gap-x-6 gap-y-2">
            <span>M(N)/M(O): Male New/Old</span>
            <span>F(N)/F(O): Female New/Old</span>
            <span>Hb: Hemoglobin</span>
            <span>UrS/UrA: Urine Sugar/Albumin</span>
            <span>Mal/Den/Typ/Hep/Preg: Malaria/Dengue/Typhoid/Hepatitis/Pregnancy Tests</span>
          </div>
          {/* Printable Official Signatures */}
          <div className="hidden print:grid grid-cols-2 gap-12 mt-16 pt-12 border-t border-dashed border-slate-300">
            <div></div>
            <div className="text-center space-y-12">
              <div className="h-10"></div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 font-sans">हस्ताक्षर चिकित्साधिकारी / प्रभारी चिकित्साधिकारी</p>
                <p className="text-[10px] text-slate-500 font-sans">(Signature of Medical Officer / In-charge)</p>
                <p className="text-[9px] text-slate-400 font-sans">राजकीय आयुर्वेदिक/यूनानी चिकित्सालय</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-500 font-semibold">No reporting logs compiled for the month {month}. Please submit daily logs first.</p>
        </div>
      )}

      {/* CUSTOM PERIOD REPORTING CENTER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 print:hidden">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="bg-indigo-50 text-indigo-800 p-1.5 rounded-xl">
            <CalendarRange className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Customized Reports</h4>
            <p className="text-[11px] text-slate-500">Query and aggregate daily performance metrics for a custom range of dates across all facilities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-slate-50 p-4 rounded-2xl border border-slate-150">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Start Date (प्रारंभ तिथि):</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">End Date (अंतिम तिथि):</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <button
              onClick={fetchCustomPeriodReport}
              disabled={isCustomLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCustomLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Aggregating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Aggregate Range Report
                </>
              )}
            </button>
          </div>
        </div>

        {customData && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h5 className="font-bold text-xs text-slate-850">
                  Custom Consolidated Data: {customStartDate} to {customEndDate}
                </h5>
                <p className="text-[10px] text-slate-500">Aggregated logs over {customData.districtTotal.daysSubmitted} days</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hospital Type Filter:</label>
                <select
                  value={selectedCustomHospitalType}
                  onChange={(e) => setSelectedCustomHospitalType(e.target.value)}
                  className="bg-white border border-slate-250 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                >
                  <option value="ALL">All Hospital Types (समस्त विधा)</option>
                  {Array.from(new Set([
                    ...DEFAULT_HOSPITAL_TYPES,
                    ...(customData?.hospitals?.map((h: any) => h.hospitalType) || [])
                  ])).filter(Boolean).map((type: any) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const headers = [
                      "Hospital Code", "Hospital Name", "Type", "Days Logged",
                      "OPD Male New", "OPD Male Old", "OPD Female New", "OPD Female Old",
                      "OPD Child New", "OPD Child Old", "OPD Total",
                      "IPD Admissions", "Avg Bed Occupancy %",
                      "Panchkarma Male", "Panchkarma Female", "Panchkarma Child", "Panchkarma Total",
                      "Levy Charges (₹)", "Aadhaar Seeded", "Mobile Seeded",
                      "Hb", "Blood Sugar", "Urine Sugar", "Urine Albumin",
                      "Malaria", "Dengue", "Typhoid", "Hep A", "Hep B", "Hep C", "Pregnancy Tests", "Total Tests",
                      "Camps Count", "Camp Beneficiaries", "Camp Medicines", "Camp NCD Screenings", "Camp Ayurvidya Sessions"
                    ];
                    const rows = [
                      [
                        customData.districtTotal.hospitalCode, customData.districtTotal.hospitalName, customData.districtTotal.hospitalType, customData.districtTotal.daysSubmitted,
                        customData.districtTotal.opd_male_new, customData.districtTotal.opd_male_old, customData.districtTotal.opd_female_new, customData.districtTotal.opd_female_old,
                        customData.districtTotal.opd_child_new, customData.districtTotal.opd_child_old, customData.districtTotal.opd_total,
                        customData.districtTotal.ipd_admissions, customData.districtTotal.avg_bed_occupancy,
                        customData.districtTotal.panchkarma_male, customData.districtTotal.panchkarma_female, customData.districtTotal.panchkarma_child, customData.districtTotal.panchkarma_total,
                        customData.districtTotal.levy_charges, customData.districtTotal.aadhaar_seeded, customData.districtTotal.mobile_seeded,
                        customData.districtTotal.hemoglobin, customData.districtTotal.blood_sugar, customData.districtTotal.urine_sugar, customData.districtTotal.urine_albumin,
                        customData.districtTotal.malaria, customData.districtTotal.dengue, customData.districtTotal.typhoid, customData.districtTotal.hepatitis_a, customData.districtTotal.hepatitis_b, customData.districtTotal.hepatitis_c, customData.districtTotal.pregnancy_tests, customData.districtTotal.total_tests,
                        customData.districtTotal.camp_count, customData.districtTotal.camp_beneficiaries_total, customData.districtTotal.camp_medicines_distributed, customData.districtTotal.camp_ncd_screenings, customData.districtTotal.camp_ayurvidya_sessions
                      ],
                      ...(customData.hospitals || []).map((h: any) => [
                        h.hospitalCode, h.hospitalName, h.hospitalType, h.daysSubmitted,
                        h.opd_male_new, h.opd_male_old, h.opd_female_new, h.opd_female_old,
                        h.opd_child_new, h.opd_child_old, h.opd_total,
                        h.ipd_admissions, h.avg_bed_occupancy,
                        h.panchkarma_male, h.panchkarma_female, h.panchkarma_child, h.panchkarma_total,
                        h.levy_charges, h.aadhaar_seeded, h.mobile_seeded,
                        h.hemoglobin, h.blood_sugar, h.urine_sugar, h.urine_albumin,
                        h.malaria, h.dengue, h.typhoid, h.hepatitis_a, h.hepatitis_b, h.hepatitis_c, h.pregnancy_tests, h.total_tests,
                        h.camp_count, h.camp_beneficiaries_total, h.camp_medicines_distributed, h.camp_ncd_screenings, h.camp_ayurvidya_sessions
                      ])
                    ];
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Custom_Period_MPR_Report_${customStartDate}_to_${customEndDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  Export Custom CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 uppercase tracking-wider font-bold text-[9px] text-center">
                    <th className="py-2.5 px-3 text-left border-r border-slate-200" colSpan={4}>Facility Details</th>
                    <th className="py-2.5 px-3 border-r border-slate-200" colSpan={7}>Outpatient Department (OPD)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200" colSpan={1}>IPD Admissions</th>
                    <th className="py-2.5 px-3 border-r border-slate-200" colSpan={4}>Panchkarma Procedures</th>
                    <th className="py-2.5 px-3 border-r border-slate-200" colSpan={3}>Levy & Seeded IDs</th>
                    <th className="py-2.5 px-3 border-r border-slate-200" colSpan={12}>Investigations & Laboratory Registry</th>
                    <th className="py-2.5 px-3" colSpan={5}>Mobile Outreach Camps</th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold text-[9px] text-center">
                    <th className="py-2 px-2 text-left border-r border-slate-200">Code</th>
                    <th className="py-2 px-2 text-left border-r border-slate-200 w-32">Hospital Name</th>
                    <th className="py-2 px-2 border-r border-slate-200">Type</th>
                    <th className="py-2 px-2 border-r border-slate-200">Days Logged</th>
                    <th className="py-2 px-1">M(N)</th><th className="py-2 px-1">M(O)</th>
                    <th className="py-2 px-1">F(N)</th><th className="py-2 px-1">F(O)</th>
                    <th className="py-2 px-1">C(N)</th><th className="py-2 px-1">C(O)</th>
                    <th className="py-2 px-1 font-bold bg-slate-100/50 border-r border-slate-200">Total</th>
                    <th className="py-2 px-1 border-r border-slate-200">Adm</th>
                    <th className="py-2 px-1">M</th><th className="py-2 px-1">F</th>
                    <th className="py-2 px-1">C</th>
                    <th className="py-2 px-1 font-bold bg-slate-100/50 border-r border-slate-200">Total</th>
                    <th className="py-2 px-1 font-bold bg-emerald-50/50 text-emerald-800">Levy (₹)</th>
                    <th className="py-2 px-1">Aadhaar</th>
                    <th className="py-2 px-1 border-r border-slate-200">Mobile</th>
                    <th className="py-2 px-1">Hb</th><th className="py-2 px-1">Sugar</th>
                    <th className="py-2 px-1">UrS</th><th className="py-2 px-1">UrA</th>
                    <th className="py-2 px-1">Mal</th><th className="py-2 px-1">Den</th>
                    <th className="py-2 px-1">Typ</th><th className="py-2 px-1">HepA</th>
                    <th className="py-2 px-1">HepB</th><th className="py-2 px-1">HepC</th>
                    <th className="py-2 px-1">Preg</th>
                    <th className="py-2 px-1 font-bold bg-slate-100/50 border-r border-slate-200">Total Tests</th>
                    <th className="py-2 px-1">Camps</th>
                    <th className="py-2 px-1">Benef</th>
                    <th className="py-2 px-1">Meds</th>
                    <th className="py-2 px-1">NCD</th>
                    <th className="py-2 px-1">AyuVid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-center">
                  {/* Cumulative District Row */}
                  {(() => {
                    const dt = customData.districtTotal;
                    return (
                      <tr className="bg-indigo-50/60 border-b-2 border-indigo-200 font-bold text-slate-900 text-center">
                        <td className="py-3 px-2 text-left border-r border-indigo-100 font-mono text-[10px] text-indigo-950">{dt.hospitalCode}</td>
                        <td className="py-3 px-2 text-left border-r border-indigo-100 text-indigo-950 font-bold">{dt.hospitalName}</td>
                        <td className="py-3 px-2 border-r border-indigo-100"><span className="bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded text-[9px] font-bold">DISTRICT</span></td>
                        <td className="py-3 px-2 border-r border-indigo-100 text-indigo-950">{dt.daysSubmitted}</td>
                        <td className="py-3 px-1">{dt.opd_male_new}</td><td className="py-3 px-1">{dt.opd_male_old}</td>
                        <td className="py-3 px-1">{dt.opd_female_new}</td><td className="py-3 px-1">{dt.opd_female_old}</td>
                        <td className="py-3 px-1">{dt.opd_child_new}</td><td className="py-3 px-1">{dt.opd_child_old}</td>
                        <td className="py-3 px-1 bg-indigo-100/40 border-r border-indigo-150 font-extrabold">{dt.opd_total}</td>
                        <td className="py-3 px-1 border-r border-indigo-100">{dt.ipd_admissions}</td>
                        <td className="py-3 px-1">{dt.panchkarma_male}</td><td className="py-3 px-1">{dt.panchkarma_female}</td>
                        <td className="py-3 px-1">{dt.panchkarma_child}</td>
                        <td className="py-3 px-1 bg-indigo-100/40 border-r border-indigo-150 font-extrabold">{dt.panchkarma_total}</td>
                        <td className="py-3 px-1 bg-indigo-100/50 font-extrabold text-indigo-950">₹{dt.levy_charges}</td>
                        <td className="py-3 px-1">{dt.aadhaar_seeded}</td>
                        <td className="py-3 px-1 border-r border-indigo-100">{dt.mobile_seeded}</td>
                        <td className="py-3 px-1">{dt.hemoglobin}</td><td className="py-3 px-1">{dt.blood_sugar}</td>
                        <td className="py-3 px-1">{dt.urine_sugar}</td><td className="py-3 px-1">{dt.urine_albumin}</td>
                        <td className="py-3 px-1">{dt.malaria}</td><td className="py-3 px-1">{dt.dengue}</td>
                        <td className="py-3 px-1">{dt.typhoid}</td><td className="py-3 px-1">{dt.hepatitis_a}</td>
                        <td className="py-3 px-1">{dt.hepatitis_b}</td><td className="py-3 px-1">{dt.hepatitis_c}</td>
                        <td className="py-3 px-1">{dt.pregnancy_tests}</td>
                        <td className="py-3 px-1 bg-indigo-100/40 border-r border-indigo-150 font-extrabold">{dt.total_tests}</td>
                        <td className="py-3 px-1">{dt.camp_count}</td>
                        <td className="py-3 px-1">{dt.camp_beneficiaries_total}</td>
                        <td className="py-3 px-1">{dt.camp_medicines_distributed}</td>
                        <td className="py-3 px-1">{dt.camp_ncd_screenings}</td>
                        <td className="py-3 px-1">{dt.camp_ayurvidya_sessions}</td>
                      </tr>
                    );
                  })()}

                  {/* Facility Rows */}
                  {(customData.hospitals || [])
                    .filter((h: any) => selectedCustomHospitalType === "ALL" || h.hospitalType === selectedCustomHospitalType)
                    .map((h: any) => (
                      <tr key={h.hospitalId} className="hover:bg-slate-50 transition-colors text-center divide-x divide-slate-100 text-[11px] text-slate-700">
                        <td className="py-2.5 px-2 text-left font-mono font-medium text-slate-500">{h.hospitalCode}</td>
                        <td className="py-2.5 px-2 text-left font-semibold text-slate-800">{h.hospitalName}</td>
                        <td className="py-2.5 px-2"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-medium">{h.hospitalType}</span></td>
                        <td className="py-2.5 px-2 font-medium">{h.daysSubmitted}</td>
                        <td className="py-2 px-1">{h.opd_male_new}</td><td className="py-2 px-1">{h.opd_male_old}</td>
                        <td className="py-2 px-1">{h.opd_female_new}</td><td className="py-2 px-1">{h.opd_female_old}</td>
                        <td className="py-2 px-1">{h.opd_child_new}</td><td className="py-2 px-1">{h.opd_child_old}</td>
                        <td className="py-2 px-1 font-bold bg-slate-50 text-slate-900">{h.opd_total}</td>
                        <td className="py-2 px-1 font-semibold">{h.ipd_admissions}</td>
                        <td className="py-2 px-1">{h.panchkarma_male}</td><td className="py-2 px-1">{h.panchkarma_female}</td>
                        <td className="py-2 px-1">{h.panchkarma_child}</td>
                        <td className="py-2 px-1 font-bold bg-slate-50 text-slate-900">{h.panchkarma_total}</td>
                        <td className="py-2 px-1 font-bold bg-emerald-50/30 text-emerald-800">₹{h.levy_charges}</td>
                        <td className="py-2 px-1">{h.aadhaar_seeded}</td>
                        <td className="py-2 px-1">{h.mobile_seeded}</td>
                        <td className="py-2 px-1">{h.hemoglobin}</td><td className="py-2 px-1">{h.blood_sugar}</td>
                        <td className="py-2 px-1">{h.urine_sugar}</td><td className="py-2 px-1">{h.urine_albumin}</td>
                        <td className="py-2 px-1">{h.malaria}</td><td className="py-2 px-1">{h.dengue}</td>
                        <td className="py-2 px-1">{h.typhoid}</td><td className="py-2 px-1">{h.hepatitis_a}</td>
                        <td className="py-2 px-1">{h.hepatitis_b}</td><td className="py-2 px-1">{h.hepatitis_c}</td>
                        <td className="py-2 px-1">{h.pregnancy_tests}</td>
                        <td className="py-2 px-1 font-bold bg-slate-50 text-slate-900">{h.total_tests}</td>
                        <td className="py-2 px-1 font-semibold">{h.camp_count}</td>
                        <td className="py-2 px-1">{h.camp_beneficiaries_total}</td>
                        <td className="py-2 px-1">{h.camp_medicines_distributed}</td>
                        <td className="py-2 px-1">{h.camp_ncd_screenings}</td>
                        <td className="py-2 px-1">{h.camp_ayurvidya_sessions}</td>
                      </tr>
                    ))}

                  {/* Subtotal row */}
                  {selectedCustomHospitalType !== "ALL" && (() => {
                    const filteredHospitals = (customData.hospitals || []).filter((h: any) => h.hospitalType === selectedCustomHospitalType);
                    const sub = filteredHospitals.reduce((acc: any, curr: any) => {
                      return {
                        daysSubmitted: acc.daysSubmitted + curr.daysSubmitted,
                        opd_male_new: acc.opd_male_new + curr.opd_male_new,
                        opd_male_old: acc.opd_male_old + curr.opd_male_old,
                        opd_female_new: acc.opd_female_new + curr.opd_female_new,
                        opd_female_old: acc.opd_female_old + curr.opd_female_old,
                        opd_child_new: acc.opd_child_new + curr.opd_child_new,
                        opd_child_old: acc.opd_child_old + curr.opd_child_old,
                        opd_total: acc.opd_total + curr.opd_total,
                        ipd_admissions: acc.ipd_admissions + curr.ipd_admissions,
                        avg_bed_occupancy: acc.avg_bed_occupancy + curr.avg_bed_occupancy,
                        panchkarma_male: acc.panchkarma_male + curr.panchkarma_male,
                        panchkarma_female: acc.panchkarma_female + curr.panchkarma_female,
                        panchkarma_child: acc.panchkarma_child + curr.panchkarma_child,
                        panchkarma_total: acc.panchkarma_total + curr.panchkarma_total,
                        levy_charges: acc.levy_charges + curr.levy_charges,
                        aadhaar_seeded: acc.aadhaar_seeded + curr.aadhaar_seeded,
                        mobile_seeded: acc.mobile_seeded + curr.mobile_seeded,
                        hemoglobin: acc.hemoglobin + curr.hemoglobin,
                        blood_sugar: acc.blood_sugar + curr.blood_sugar,
                        urine_sugar: acc.urine_sugar + curr.urine_sugar,
                        urine_albumin: acc.urine_albumin + curr.urine_albumin,
                        malaria: acc.malaria + curr.malaria,
                        dengue: acc.dengue + curr.dengue,
                        typhoid: acc.typhoid + curr.typhoid,
                        hepatitis_a: acc.hepatitis_a + curr.hepatitis_a,
                        hepatitis_b: acc.hepatitis_b + curr.hepatitis_b,
                        hepatitis_c: acc.hepatitis_c + curr.hepatitis_c,
                        pregnancy_tests: acc.pregnancy_tests + curr.pregnancy_tests,
                        total_tests: acc.total_tests + curr.total_tests,
                        camp_count: acc.camp_count + curr.camp_count,
                        camp_beneficiaries_total: acc.camp_beneficiaries_total + curr.camp_beneficiaries_total,
                        camp_medicines_distributed: acc.camp_medicines_distributed + curr.camp_medicines_distributed,
                        camp_ncd_screenings: acc.camp_ncd_screenings + curr.camp_ncd_screenings,
                        camp_ayurvidya_sessions: acc.camp_ayurvidya_sessions + curr.camp_ayurvidya_sessions,
                      };
                    }, {
                      daysSubmitted: 0, opd_male_new: 0, opd_male_old: 0, opd_female_new: 0, opd_female_old: 0,
                      opd_child_new: 0, opd_child_old: 0, opd_total: 0, ipd_admissions: 0, avg_bed_occupancy: 0,
                      panchkarma_male: 0, panchkarma_female: 0, panchkarma_child: 0, panchkarma_total: 0,
                      levy_charges: 0, aadhaar_seeded: 0, mobile_seeded: 0, hemoglobin: 0, blood_sugar: 0,
                      urine_sugar: 0, urine_albumin: 0, malaria: 0, dengue: 0, typhoid: 0, hepatitis_a: 0,
                      hepatitis_b: 0, hepatitis_c: 0, pregnancy_tests: 0, total_tests: 0, camp_count: 0,
                      camp_beneficiaries_total: 0, camp_medicines_distributed: 0, camp_ncd_screenings: 0, camp_ayurvidya_sessions: 0
                    });
                    const avgOcc = filteredHospitals.length > 0 ? Math.round(sub.avg_bed_occupancy / filteredHospitals.length) : 0;
                    return (
                      <tr className="bg-amber-100 font-bold text-slate-900 hover:bg-amber-150 transition-all text-center">
                        <td className="py-2.5 px-2 text-left border-r border-amber-200 font-mono text-[10px] text-amber-950">SUBTOTAL</td>
                        <td className="py-2.5 px-2 text-left border-r border-amber-200 text-amber-950 font-bold">Type: {selectedCustomHospitalType} Cumulative</td>
                        <td className="py-2.5 px-2 border-r border-amber-200"><span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[9px] font-bold">{selectedCustomHospitalType}</span></td>
                        <td className="py-2.5 px-2 border-r border-amber-200 text-amber-950">{sub.daysSubmitted}</td>
                        <td className="py-2 px-1">{sub.opd_male_new}</td><td className="py-2 px-1">{sub.opd_male_old}</td>
                        <td className="py-2 px-1">{sub.opd_female_new}</td><td className="py-2 px-1">{sub.opd_female_old}</td>
                        <td className="py-2 px-1">{sub.opd_child_new}</td><td className="py-2 px-1">{sub.opd_child_old}</td>
                        <td className="py-2 px-1 bg-amber-250 border-r border-amber-200 font-extrabold">{sub.opd_total}</td>
                        <td className="py-2 px-1 border-r border-amber-100">{sub.ipd_admissions}</td>
                        <td className="py-2 px-1">{sub.panchkarma_male}</td><td className="py-2 px-1">{sub.panchkarma_female}</td>
                        <td className="py-2 px-1">{sub.panchkarma_child}</td>
                        <td className="py-2 px-1 bg-amber-250 border-r border-amber-200 font-extrabold">{sub.panchkarma_total}</td>
                        <td className="py-2 px-1 bg-amber-250 font-extrabold text-amber-950">₹{sub.levy_charges}</td>
                        <td className="py-2 px-1">{sub.aadhaar_seeded}</td>
                        <td className="py-2 px-1 border-r border-amber-200">{sub.mobile_seeded}</td>
                        <td className="py-2 px-1">{sub.hemoglobin}</td><td className="py-2 px-1">{sub.blood_sugar}</td>
                        <td className="py-2 px-1">{sub.urine_sugar}</td><td className="py-2 px-1">{sub.urine_albumin}</td>
                        <td className="py-2 px-1">{sub.malaria}</td><td className="py-2 px-1">{sub.dengue}</td>
                        <td className="py-2 px-1">{sub.typhoid}</td><td className="py-2 px-1">{sub.hepatitis_a}</td>
                        <td className="py-2 px-1">{sub.hepatitis_b}</td><td className="py-2 px-1">{sub.hepatitis_c}</td>
                        <td className="py-2 px-1">{sub.pregnancy_tests}</td>
                        <td className="py-2 px-1 bg-amber-250 border-r border-amber-200 font-extrabold">{sub.total_tests}</td>
                        <td className="py-2 px-1">{sub.camp_count}</td>
                        <td className="py-2 px-1">{sub.camp_beneficiaries_total}</td>
                        <td className="py-2 px-1">{sub.camp_medicines_distributed}</td>
                        <td className="py-2 px-1">{sub.camp_ncd_screenings}</td>
                        <td className="py-2 px-1">{sub.camp_ayurvidya_sessions}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* AI SUMMARY BOX */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-slate-800/80 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold tracking-wide">Gemini 3.5 AI Executive Officer Briefing</h4>
              <p className="text-[10px] text-slate-400">Policy insights, caseload anomalies, and inventory alerts analysis</p>
            </div>
          </div>
          <button
            onClick={handleAiSummarize}
            disabled={isSummarizing || !data}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Analyze Reporting Month
              </>
            )}
          </button>
        </div>

        {isSummarizing ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs text-slate-400 italic">Processing District Clinical Reports and streaming clinical feedback...</p>
          </div>
        ) : aiSummary ? (
          <div className="text-xs text-slate-200 leading-relaxed bg-slate-900/40 p-4 border border-slate-800 rounded-xl max-h-72 overflow-y-auto space-y-2 prose prose-invert">
            <div className="whitespace-pre-line">{aiSummary}</div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Click "Analyze Reporting Month" to generate an official district summary using Google Gemini AI.</p>
        )}
      </div>

      {isReportModalOpen && (
        <PremiumReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          initialReportType={selectedReportType}
          initialMonth={month}
          user={user}
        />
      )}

    </div>
  );
}
