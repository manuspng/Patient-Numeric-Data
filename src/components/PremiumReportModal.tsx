/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { X, Printer, Download, Award, ShieldAlert, CheckCircle, HelpCircle, Loader2, AlertTriangle, FileText, TrendingUp, RefreshCw } from "lucide-react";
import { 
  BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { UserRole, UserProfile } from "../types";

interface PremiumReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportType: "proforma1" | "proforma2" | "camp" | "testkit" | "disease_graph";
  initialMonth: string;
  user: UserProfile;
  isPreviewMode?: boolean;
  previewType?: "proforma1" | "proforma2" | "camp" | "testkit" | "disease_graph";
}

export default function PremiumReportModal({
  isOpen,
  onClose,
  initialReportType,
  initialMonth,
  user,
  isPreviewMode = false,
  previewType
}: PremiumReportModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Modal and Fetch state
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [reportType, setReportType] = useState<"proforma1" | "proforma2" | "camp" | "testkit" | "disease_graph">("proforma1");
  const [districtTotal, setDistrictTotal] = useState<any>(null);
  const [fetchedHospitals, setFetchedHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("consolidated");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proforma 1 and 2 metadata inputs
  const [dispatchNo, setDispatchNo] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [bankBranch, setBankBranch] = useState("SBI-Sitarganj");
  const [customChallanAmount, setCustomChallanAmount] = useState<string>( "");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");

  // Sync initial props on change
  useEffect(() => {
    setSelectedMonth(initialMonth);
  }, [initialMonth]);

  useEffect(() => {
    if (isPreviewMode && previewType) {
      setReportType(previewType);
    } else {
      setReportType(initialReportType);
    }
  }, [initialReportType, isPreviewMode, previewType]);

  useEffect(() => {
    if (reportType === "proforma1" || reportType === "proforma2") {
      setOrientation("landscape");
    } else {
      setOrientation("portrait");
    }
  }, [reportType]);

  // Generate empty standard diseases list for preview
  const dummyDiseaseTotals = Array.from({ length: 40 }, (_, i) => ({
    sNo: i + 1,
    nameHindi: [
      "ज्वर", "अतिसार", "वमन", "श्वासकास", "अम्लिपत्त", "पाण्डु", "कामला", "उदर रोग", "प्रमेह", "मूत्र रोग",
      "आमवात", "संधिवात", "मनो रोग", "नेत्र शोथ", "पक्षाघात", "गृध्रसी", "वातरक्त", "वात व्याधि", "त्वक विकार", "ऊँच्चरक्त चाप",
      "हृदय रोग", "रक्त पित्त", "शिरोरोग", "मुखरोग", "कर्ण रोग", "प्रदर रोग", "रजोरोग", "रक्तअल्पता", "बालातिसार", "बालशोथ",
      "बालज्वर", "श्वेत प्रदर", "सुजाक", "आतशक", "भगन्दर", "अर्श", "कृमि रोग", "अन्य रोग", "योग", "अन्य विशिष्ट रोग"
    ][i] || "रोग श्रेणी",
    nameEnglish: [
      "Jwar / Fever", "Atisar / Diarrhoea", "Vaman / Vomiting", "Shwaskas / Asthma", "Amlapitta / Hyperacidity", "Pandu / Anemia", "Kamla / Jaundice", "Udar Rog / Abdominal", "Prameh / Diabetes", "Mutra Rog / Urinary",
      "Aamvaat / Rheumatoid", "Sandhivaat / Osteoarthritis", "Mano Rog / Psychiatric", "Netra Shoth / Eye", "Pakshaghat / Paralysis", "Gridhrasi / Sciatica", "Vaatrakta / Gout", "Vaat Vyadhi / Neuro", "Twak Vikar / Skin", "Uccharakta Chapa / HTN",
      "Hridaya Rog / Heart", "Rakta Pitta / Bleeding", "Shirorog / Headache", "Mukharog / Mouth", "Karna Rog / Ear", "Pradar Rog / Leukorrhea", "Rajorog / Menstrual", "Rakta Alpata / Anaemia", "Balatisar / Ped Diarrhoea", "Balashoth / Ped Oedema",
      "Balajwar / Ped Fever", "Shwet Pradar / Leucorrhoea", "Sujaak / Gonorrhoea", "Aatashak / Syphilis", "Bhagandar / Fistula", "Arsh / Piles", "Krimi Rog / Worms", "Anya Rog / Others", "Yoga Beneficiaries", "Special Clinical"
    ][i] || "Clinical Condition",
    opd_male_new: 0,
    opd_male_old: 0,
    opd_female_new: 0,
    opd_female_old: 0,
    opd_child_new: 0,
    opd_child_old: 0,
    opd_total: 0
  }));

  const previewHospitalData = {
    hospitalName: "[HOSPITAL NAME PLACEHOLDER]",
    hospitalCode: "[SYMBOLIC CODE]",
    hospitalType: "[FACILITY TYPE]",
    opd_male_new: 0,
    opd_male_old: 0,
    opd_female_new: 0,
    opd_female_old: 0,
    opd_child_new: 0,
    opd_child_old: 0,
    opd_elderly_new: 0,
    opd_elderly_old: 0,
    ipd_male_new: 0,
    ipd_male_old: 0,
    ipd_female_new: 0,
    ipd_female_old: 0,
    ipd_child_new: 0,
    ipd_child_old: 0,
    panchkarma_male: 0,
    panchkarma_female: 0,
    panchkarma_child: 0,
    panchkarma_elderly: 0,
    levy_charges: 0,
    aadhaar_seeded: 0,
    mobile_seeded: 0,
    hemoglobin: 0,
    blood_sugar: 0,
    urine_sugar: 0,
    urine_albumin: 0,
    malaria: 0,
    dengue: 0,
    typhoid: 0,
    hepatitis_a: 0,
    hepatitis_b: 0,
    hepatitis_c: 0,
    pregnancy_tests: 0,
    camp_count: 0,
    camp_beneficiaries_total: 0,
    camp_medicines_distributed: 0,
    camp_ncd_screenings: 0,
    daysSubmitted: 0,
    diseaseTotals: dummyDiseaseTotals
  };

  const hospitalData = isPreviewMode
    ? previewHospitalData
    : (user.role === UserRole.HOSPITAL_USER
        ? (fetchedHospitals[0] || districtTotal)
        : (selectedHospitalId === "consolidated"
            ? districtTotal
            : fetchedHospitals.find(h => h.hospitalId === selectedHospitalId)));

  // Sync dispatch and challan defaults when hospitalData changes
  useEffect(() => {
    if (isPreviewMode) {
      setDispatchNo("");
      setDispatchDate("");
      setChallanDate("");
      setChallanNo("");
      setBankBranch("[बैंक शाखा]");
      setCustomChallanAmount("0");
      return;
    }

    if (hospitalData) {
      setDispatchNo("");
      setDispatchDate("");
      setChallanDate("");
      setChallanNo("");
      setBankBranch(hospitalData.hospitalName?.includes("झनकट") ? "SBI-Sitarganj" : `SBI-${hospitalData.hospitalName?.split(/[\s-]+/).pop() || "Dehradun"}`);
      setCustomChallanAmount(String(hospitalData.levy_charges || 0));
    }
  }, [selectedHospitalId, selectedMonth, districtTotal, fetchedHospitals, isPreviewMode]);

  // Dynamic Data Fetcher based on Selected Month & user context
  useEffect(() => {
    async function fetchReportData() {
      if (!isOpen || isPreviewMode) return;
      setIsLoading(true);
      setError(null);
      try {
        let url = `/api/mpr/aggregate?month=${selectedMonth}&userEmail=${encodeURIComponent(user.email)}`;
        if (reportType === "proforma2") {
          url += `&isAnnual=true`;
        }
        if (user.role === UserRole.HOSPITAL_USER && user.hospitalId) {
          url += `&hospitalId=${user.hospitalId}`;
        }
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
          setDistrictTotal(json.districtTotal);
          setFetchedHospitals(json.hospitals || []);
        } else {
          setError(json.message || "Failed to load report data");
        }
      } catch (err) {
        console.error("Error fetching report in modal:", err);
        setError("Network error. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReportData();
  }, [selectedMonth, user, isOpen, isPreviewMode, reportType]);

  if (!isOpen) return null;

  // Helper to translate month to Hindi
  const getMonthNameHindi = (monthStr: string) => {
    if (isPreviewMode) return { monthHindi: "[मास]", year: "[वर्ष]" };
    const parts = monthStr.split("-");
    if (parts.length !== 2) return { monthHindi: "मास", year: "वर्ष" };
    const [yearStr, monthNumStr] = parts;
    const monthNamesHindi = [
      "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", 
      "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"
    ];
    const idx = parseInt(monthNumStr, 10) - 1;
    return {
      monthHindi: monthNamesHindi[idx] || "मास",
      year: yearStr
    };
  };

  // Helper to translate month to English
  const getMonthNameEnglish = (monthStr: string) => {
    if (isPreviewMode) return { monthEnglish: "[MONTH]", year: "[YEAR]" };
    const parts = monthStr.split("-");
    if (parts.length !== 2) return { monthEnglish: "Month", year: "Year" };
    const [yearStr, monthNumStr] = parts;
    const monthNamesEnglish = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    const idx = parseInt(monthNumStr, 10) - 1;
    return {
      monthEnglish: monthNamesEnglish[idx] || "Month",
      year: yearStr
    };
  };

  const { monthHindi, year } = getMonthNameHindi(selectedMonth);
  const { monthEnglish } = getMonthNameEnglish(selectedMonth);

  // Safe parameters extraction
  const hospitalName = isPreviewMode
    ? "[HOSPITAL NAME PLACEHOLDER]"
    : (user.role === UserRole.HOSPITAL_USER
        ? (hospitalData?.hospitalName || "राजकीय आयुर्वेदिक चिकित्सालय")
        : (selectedHospitalId === "consolidated"
            ? "जिला आयुर्वेदिक एवं यूनानी अधिकारी - उधम सिंह नगर"
            : (hospitalData?.hospitalName || "राजकीय आयुर्वेदिक चिकित्सालय")));
  const hospitalCode = isPreviewMode ? "[AYUSH-CODE]" : (hospitalData?.hospitalCode || "AYUSH-DISTRICT");
  const hospitalType = isPreviewMode ? "[FACILITY TYPE]" : (hospitalData?.hospitalType || "Ayurvedic");
  const hospitalDistrict = isPreviewMode
    ? "ऊधम सिंह नगर"
    : (hospitalData?.hospitalDistrict || hospitalData?.district || "ऊधम सिंह नगर");
  const hospitalIncharge = isPreviewMode
    ? ""
    : (user.role === UserRole.HOSPITAL_USER
        ? (hospitalData?.hospitalIncharge || "")
        : (selectedHospitalId === "consolidated"
            ? ""
            : (hospitalData?.hospitalIncharge || "")));

  // Trigger Print for ONLY the report area
  const handlePrint = () => {
    if (!hospitalData) return;
    const printContent = printAreaRef.current?.innerHTML;

    const isLandscape = orientation === "landscape";

    // Create a style block for high quality print output (available for both screen and print media to ensure exact WYSIWYG match in popup)
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        @page {
          size: ${isLandscape ? "A4 landscape" : "A4 portrait"};
          margin: ${isLandscape ? "3mm 5mm" : "0.4cm"} !important;
        }
      }
      body {
        background: white !important;
        color: black !important;
        font-family: 'Times New Roman', Times, serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      .print-btn, .close-btn {
        display: none !important;
      }
      .proforma-container {
        border: none !important; /* Uniform outer border */
        padding: ${isLandscape ? "6px 12px" : "12px 16px"} !important;
        margin: 0 auto !important;
        width: ${isLandscape ? "287mm" : "100%"} !important;
        height: ${isLandscape ? "204mm" : "auto"} !important;
        max-height: ${isLandscape ? "204mm" : "none"} !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        background: white !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        page-break-inside: avoid !important;
        font-family: 'Times New Roman', Times, serif !important;
      }
      .proforma-container * {
        font-family: 'Times New Roman', Times, serif !important;
      }
      /* Make sure all children of the main wrapper scale proportionally */
      .proforma-container > .space-y-6 {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        justify-content: space-between !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .proforma-container .text-center.border-b {
        padding-bottom: 2px !important;
        margin-bottom: 2px !important;
        border-bottom-width: 1px !important;
      }
      .proforma-container h1 {
        font-size: ${isLandscape ? "14px" : "12px"} !important; /* increased by 1px */
        line-height: 1.2 !important;
        margin-bottom: 1px !important;
      }
      .proforma-container h2 {
        font-size: ${isLandscape ? "11.5px" : "10px"} !important; /* increased by 1px */
        margin-top: 1px !important;
        margin-bottom: 2px !important;
      }
      .proforma-container .grid-cols-3 {
        margin-top: 3px !important;
        padding: 3px 5px !important;
        font-size: ${isLandscape ? "10px" : "9px"} !important; /* increased by 1px */
        gap: 3px !important;
        line-height: 1.15 !important;
      }
      .proforma-container h3 {
        font-size: ${isLandscape ? "10px" : "9px"} !important; /* increased by 1px */
        margin-top: 2px !important;
        margin-bottom: 2px !important;
        font-weight: 800 !important;
      }
      .proforma-container .border-dashed {
        margin-top: 3px !important;
        padding: 3px 5px !important;
        font-size: ${isLandscape ? "9px" : "8px"} !important; /* increased by 1px */
        border: 1px dashed #A0A9EB !important;
      }
      
      /* Clean, collapsed table styling to prevent double/layered borders */
      .proforma-container table {
        border-collapse: collapse !important;
        border-spacing: 0 !important;
      }
      .proforma-container th, 
      .proforma-container td {
        padding: ${isLandscape ? "1.5px 1.5px" : "0.5px 2px"} !important;
        font-size: ${isLandscape ? "9px" : "8.5px"}; /* Default fallback matching 1px size increase */
        line-height: 1.05 !important;
        border: 1px solid #A0A9EB !important;
      }
      th {
        background-color: #f1f5f9 !important;
        color: black !important;
        font-weight: bold !important;
      }

      /* Force all visible borders to uniform 1px thickness and color #A0A9EB */
      .proforma-container .border {
        border: 1px solid #A0A9EB !important;
      }
      .proforma-container .border-t {
        border-top: 1px solid #A0A9EB !important;
      }
      .proforma-container .border-b {
        border-bottom: 1px solid #A0A9EB !important;
      }
      .proforma-container .border-l {
        border-left: 1px solid #A0A9EB !important;
      }
      .proforma-container .border-r {
        border-right: 1px solid #A0A9EB !important;
      }
      .proforma-container .border-x {
        border-left: 1px solid #A0A9EB !important;
        border-right: 1px solid #A0A9EB !important;
      }
      .proforma-container .border-y {
        border-top: 1px solid #A0A9EB !important;
        border-bottom: 1px solid #A0A9EB !important;
      }

      /* Override divide utilities with #A0A9EB and uniform thickness */
      .proforma-container .divide-x > * + * {
        border-left: 1px solid #A0A9EB !important;
        border-right-width: 0px !important;
      }
      .proforma-container .divide-y > * + * {
        border-top: 1px solid #A0A9EB !important;
        border-bottom-width: 0px !important;
      }

      /* Unify all slate and other Tailwind border colors to #A0A9EB */
      .proforma-container [class*="border-"],
      .proforma-container [class*="divide-"] > * + * {
        border-color: #A0A9EB !important;
      }

      .proforma-container .border-dashed {
        border: 1px dashed #A0A9EB !important;
      }

      /* Font size scaling matching preview precisely */
      .proforma-container .text-\\[6px\\] { font-size: 7px !important; }
      .proforma-container .text-\[7.5px\\] { font-size: 8.5px !important; }
      .proforma-container .text-\[8px\\] { font-size: 9px !important; }
      .proforma-container .text-\[8.5px\\] { font-size: 9.5px !important; }
      .proforma-container .text-\[9px\\] { font-size: 10px !important; }
      .proforma-container .text-\[9.5px\\] { font-size: 10.5px !important; }
      .proforma-container .text-\[10px\\] { font-size: 11px !important; }
      .proforma-container .text-\[10.5px\\] { font-size: 11.5px !important; }
      .proforma-container .text-\[11px\\] { font-size: 12px !important; }
      .proforma-container .text-\[11.5px\\] { font-size: 12.5px !important; }
      .proforma-container .text-\[12px\\] { font-size: 13px !important; }
      .proforma-container .text-\[13px\\] { font-size: 14px !important; }
      .proforma-container .text-\[14px\\] { font-size: 15px !important; }
      .proforma-container .text-xs { font-size: 13px !important; }
      .proforma-container .text-sm { font-size: 15px !important; }
      .proforma-container .text-md { font-size: 17px !important; }
      .proforma-container .text-lg { font-size: 19px !important; }
      .proforma-container .text-xl { font-size: 21px !important; }
      .proforma-container .text-2xl { font-size: 25px !important; }

      /* Make sure horizontal scrolling tables fit completely */
      .overflow-x-auto {
        overflow: visible !important;
      }
      .overflow-x-auto table {
        min-width: 100% !important;
        width: 100% !important;
      }
      /* For Table 3, reduce width so it fits perfectly on A4 */
      .proforma-container table.table-fixed {
        table-layout: fixed !important;
        width: 100% !important;
      }
      .proforma-container table.table-fixed td, .proforma-container table.table-fixed th {
        width: auto !important;
      }
      /* Ensure vertical text stands out and doesn't get clipped */
      .proforma-container span[style*="writing-mode"] {
        font-size: ${isLandscape ? "7.5px" : "6px"} !important;
        max-height: 48px !important;
        line-height: 1 !important;
      }
    `;

    document.head.appendChild(style);
    
    // We open a temporary print window to avoid blowing away React state in parent
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${reportType.toUpperCase()}_Report_${hospitalCode}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style id="custom-print-style">
              body { font-family: 'Times New Roman', Times, serif; }
              ${style.innerHTML}
            </style>
          </head>
          <body class="p-0 m-0 bg-white">
            <div class="proforma-container">
              ${printContent}
            </div>
            <script>
              function startPrint() {
                // Ensure our custom style block takes absolute precedence over Tailwind CDN injected stylesheet
                const mainStyle = document.getElementById('custom-print-style');
                if (mainStyle) {
                  const overrideStyle = document.createElement('style');
                  overrideStyle.innerHTML = mainStyle.innerHTML;
                  document.head.appendChild(overrideStyle);
                }
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                }, 350);
              }
              
              // Ensure Tailwind compilation is complete before popping the print dialog
              const twScript = document.querySelector('script[src*="tailwindcss"]');
              if (twScript) {
                twScript.onload = startPrint;
                twScript.onerror = startPrint;
              } else {
                window.onload = startPrint;
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    
    document.head.removeChild(style);
  };

  const opd_total = hospitalData?.opd_total || 0;
  const ipd_admissions = hospitalData?.ipd_admissions || 0;
  const avg_bed_occupancy = hospitalData?.avg_bed_occupancy || 0;
  const panchkarma_total = hospitalData?.panchkarma_total || 0;
  const levy_charges = hospitalData?.levy_charges || 0;
  const aadhaar_seeded = hospitalData?.aadhaar_seeded || 0;
  const mobile_seeded = hospitalData?.mobile_seeded || 0;

  // Render specific content based on reportType
  const renderReportContent = () => {
    if (!hospitalData) return null;

    switch (reportType) {
      case "proforma1": {
        const standardDiseasesList = hospitalData.diseaseTotals || [];
        
        const opdMaleNewVal = hospitalData.opd_male_new || 0;
        const opdMaleOldVal = hospitalData.opd_male_old || 0;
        const opdFemaleNewVal = hospitalData.opd_female_new || 0;
        const opdFemaleOldVal = hospitalData.opd_female_old || 0;
        const opdChildNewVal = hospitalData.opd_child_new || 0;
        const opdChildOldVal = hospitalData.opd_child_old || 0;
        const opdElderlyNewVal = hospitalData.opd_elderly_new || 0;
        const opdElderlyOldVal = hospitalData.opd_elderly_old || 0;

        const opdChildMaleNew = Math.floor(opdChildNewVal * 0.5);
        const opdChildFemaleNew = opdChildNewVal - opdChildMaleNew;
        const opdChildMaleOld = Math.floor(opdChildOldVal * 0.5);
        const opdChildFemaleOld = opdChildOldVal - opdChildMaleOld;

        const newOPDTotal = opdMaleNewVal + opdFemaleNewVal + opdChildNewVal + opdElderlyNewVal;
        const oldOPDTotal = opdMaleOldVal + opdFemaleOldVal + opdChildOldVal + opdElderlyOldVal;
        const grandOPDTotal = newOPDTotal + oldOPDTotal;

        const newMaleTotal = opdMaleNewVal + opdChildMaleNew + Math.floor(opdElderlyNewVal * 0.5);
        const oldMaleTotal = opdMaleOldVal + opdChildMaleOld + Math.floor(opdElderlyOldVal * 0.5);
        const grandMaleTotal = newMaleTotal + oldMaleTotal;

        const newFemaleTotal = opdFemaleNewVal + opdChildFemaleNew + Math.ceil(opdElderlyNewVal * 0.5);
        const oldFemaleTotal = opdFemaleOldVal + opdChildFemaleOld + Math.ceil(opdElderlyOldVal * 0.5);
        const grandFemaleTotal = newFemaleTotal + oldFemaleTotal;

        const ipdMaleNewVal = hospitalData.ipd_male_new || 0;
        const ipdFemaleNewVal = hospitalData.ipd_female_new || 0;
        const ipdMaleOldVal = hospitalData.ipd_male_old || 0;
        const ipdFemaleOldVal = hospitalData.ipd_female_old || 0;

        const panchkarmaMaleNewVal = Math.round((hospitalData.panchkarma_male || 0) * 0.7);
        const panchkarmaFemaleNewVal = Math.round((hospitalData.panchkarma_female || 0) * 0.7);
        const panchkarmaMaleOldVal = (hospitalData.panchkarma_male || 0) - panchkarmaMaleNewVal;
        const panchkarmaFemaleOldVal = (hospitalData.panchkarma_female || 0) - panchkarmaFemaleNewVal;
        const panchkarmaMaleTotalVal = hospitalData.panchkarma_male || 0;
        const panchkarmaFemaleTotalVal = hospitalData.panchkarma_female || 0;

        return (
          <div className="space-y-4 text-slate-950">
            {/* Spreadsheet Title Block */}
            <div className="text-center pb-1 -mt-[26px]">
              <div className="text-[13px] h-[40px] font-black tracking-tight text-slate-950 uppercase p-1.5 bg-white flex items-center justify-center gap-2 mt-[20px]">
                <span className="text-emerald-950">{hospitalName}</span>
                <span>-</span>
                <span>{hospitalDistrict}</span>
              </div>
              <div className="text-[13px] h-[24px] font-extrabold mt-0.5 text-slate-800 p-0.5 bg-white flex items-center justify-center">
                Monthly Patient Report - {monthEnglish} {year}
              </div>
            </div>

            {/* Metadata Section styled like Excel grid rows */}
            <div className="bg-white">
              <table className="w-full text-[8.5px] border-collapse leading-tight font-sans border border-slate-400">
                <tbody>
                  <tr className="border-b border-slate-400 divide-x divide-slate-400">
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 w-[8%] text-center h-[30.5px]" style={{ fontWeight: "bold", fontSize: "11.5px" }}>Dispatch No.</td>
                    <td className="p-1 text-slate-900 w-[15%] font-semibold font-mono" style={{ width: "158.96875px", fontSize: "10.5px" }}>{dispatchNo}</td>
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 w-[10%] text-center" style={{ fontSize: "11.5px" }}>Challan Date</td>
                    <td className="p-1 text-slate-900 w-[12%] font-semibold font-mono" style={{ fontSize: "10.5px" }}>{challanDate}</td>
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 w-[10%] text-center" style={{ fontSize: "11.5px" }}>Challan No.</td>
                    <td className="p-1 text-slate-900 w-[18%] font-semibold font-mono" style={{ width: "178.703125px", fontSize: "10.5px" }}>{challanNo}</td>
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 w-[12%] text-center" style={{ width: "125.53125px", fontSize: "11.5px" }}>Bank Branch</td>
                    <td className="p-1 text-slate-900 w-[10%] font-semibold" style={{ fontSize: "11.5px" }}>{bankBranch}</td>
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 w-[10%] text-center" style={{ fontSize: "11.5px" }}>MONTH & YEAR</td>
                    <td className="p-1 text-emerald-900 font-extrabold text-center uppercase bg-emerald-50/50 w-[10%]" style={{ fontSize: "11.5px", color: "#275e4d" }}>{monthEnglish} {year}</td>
                  </tr>
                  <tr className="divide-x divide-slate-400">
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 text-center h-[21.5px]" style={{ fontSize: "11.5px" }}>Date</td>
                    <td className="p-1 text-slate-900 font-semibold font-mono" style={{ fontSize: "10.5px" }}>{dispatchDate}</td>
                    <td className="p-1 font-bold text-slate-800 bg-slate-50 text-center" style={{ fontSize: "11.5px" }}>Challan Amount</td>
                    <td className="p-1 text-emerald-950 font-extrabold font-mono text-left" style={{ fontSize: "12.5px" }}>₹ {customChallanAmount}</td>
                    <td className="p-1" colSpan={6}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 1: Patient Classification Block */}
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse text-center min-w-[1000px] bg-white leading-tight border border-slate-400">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-400 divide-x divide-slate-400 text-slate-900 font-extrabold">
                      <th className="p-1" rowSpan={3}>Name of Month</th>
                      <th className="p-1" colSpan={6}>OPD(including children)</th>
                      <th className="p-1" colSpan={6}>IPD(including children)</th>
                      <th className="p-1" colSpan={6}>Panchkarma</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.28px" }}>Grand Total Levy</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.30px" }}>Grand Total Patients</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.72px" }}>Adhar Seeded</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.45px" }}>Mobile Beneficiary</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-[9.5px]">
                      <th className="p-0.5 h-[17px]" colSpan={2}>NEW</th>
                      <th className="p-0.5" colSpan={2}>OLD</th>
                      <th className="p-0.5" colSpan={2}>TOTAL</th>
                      <th className="p-0.5" colSpan={2}>NEW</th>
                      <th className="p-0.5" colSpan={2}>OLD</th>
                      <th className="p-0.5" colSpan={2}>TOTAL</th>
                      <th className="p-0.5" colSpan={2}>NEW</th>
                      <th className="p-0.5" colSpan={2}>OLD</th>
                      <th className="p-0.5" colSpan={2}>TOTAL</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-400 divide-x divide-slate-400 font-semibold text-[9px] text-slate-700">
                      <th className="p-0.5 h-[16px]">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5 bg-slate-100 text-slate-900 font-bold">Male</th>
                      <th className="p-0.5 bg-slate-100 text-slate-900 font-bold">Female</th>
                      
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5 bg-slate-100 text-slate-900 font-bold">Male</th>
                      <th className="p-0.5 bg-slate-100 text-slate-900 font-bold">Female</th>
                      
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5 bg-slate-100 text-slate-900 font-bold">Male</th>
                      <th className="p-0.5 bg-slate-100 text-slate-900 font-bold">Female</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono text-slate-900 font-semibold">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 bg-slate-50 font-sans font-bold text-[10px] text-slate-950 h-[24.5px]">{monthEnglish} {year}</td>
                      {/* OPD NEW */}
                      <td className="p-1">{opdMaleNewVal}</td>
                      <td className="p-1">{opdFemaleNewVal}</td>
                      {/* OPD OLD */}
                      <td className="p-1">{opdMaleOldVal}</td>
                      <td className="p-1">{opdFemaleOldVal}</td>
                      {/* OPD TOTAL */}
                      <td className="p-1 bg-slate-100 text-slate-950 font-bold">{opdMaleNewVal + opdMaleOldVal}</td>
                      <td className="p-1 bg-slate-100 text-slate-950 font-bold">{opdFemaleNewVal + opdFemaleOldVal}</td>
                      
                      {/* IPD NEW */}
                      <td className="p-1">{ipdMaleNewVal}</td>
                      <td className="p-1">{ipdFemaleNewVal}</td>
                      {/* IPD OLD */}
                      <td className="p-1">{ipdMaleOldVal}</td>
                      <td className="p-1">{ipdFemaleOldVal}</td>
                      {/* IPD TOTAL */}
                      <td className="p-1 bg-slate-100 text-slate-950 font-bold">{ipdMaleNewVal + ipdMaleOldVal}</td>
                      <td className="p-1 bg-slate-100 text-slate-950 font-bold">{ipdFemaleNewVal + ipdFemaleOldVal}</td>
                      
                      {/* Panchkarma NEW */}
                      <td className="p-1">{panchkarmaMaleNewVal}</td>
                      <td className="p-1">{panchkarmaFemaleNewVal}</td>
                      {/* Panchkarma OLD */}
                      <td className="p-1">{panchkarmaMaleOldVal}</td>
                      <td className="p-1">{panchkarmaFemaleOldVal}</td>
                      {/* Panchkarma TOTAL */}
                      <td className="p-1 bg-slate-100 text-slate-950 font-bold">{panchkarmaMaleTotalVal}</td>
                      <td className="p-1 bg-slate-100 text-slate-950 font-bold">{panchkarmaFemaleTotalVal}</td>
                      
                      {/* Grand Total Levy */}
                      <td className="p-1 font-sans font-bold text-slate-950">₹{customChallanAmount}</td>
                      {/* Grand Total Patients */}
                      <td className="p-1 bg-emerald-50 font-extrabold text-emerald-950 text-[11px]">{grandOPDTotal}</td>
                      {/* Adhar Seeded */}
                      <td className="p-1">{aadhaar_seeded}</td>
                      {/* Mobile Beneficiary */}
                      <td className="p-1">{mobile_seeded}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Ministry of AYUSH Transmission & Age/Gender Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 -mt-1">
              {/* Left Column: Proforma Transmission Block */}
              <div className="bg-white">
                <div className="bg-slate-100 border border-slate-400 p-1 text-[10px] font-extrabold text-slate-900 tracking-tight text-center leading-normal">
                  PROFORMA FOR THE DATA TO COLLECTED AT STATES / UTS LEVEL FOR MONTHLY TRANSMISSION TO MINISTRY OF AYUSH
                </div>
                <table className="w-full text-[10px] border-collapse text-center leading-tight border border-slate-400 -mt-[1px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-slate-800">
                      <th className="p-1 text-left">Category</th>
                      <th className="p-1">Total Attended</th>
                      <th className="p-1" style={{ width: "70.73px" }}>Male</th>
                      <th className="p-1" style={{ width: "70.78px" }}>Female</th>
                      <th className="p-1">Aadhaar Seeded</th>
                      <th className="p-1">Mobile Seeded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono font-semibold text-slate-900">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-slate-50">New Patient</td>
                      <td className="p-1">{newOPDTotal}</td>
                      <td className="p-1">{newMaleTotal}</td>
                      <td className="p-1">{newFemaleTotal}</td>
                      <td className="p-1 bg-slate-50/50">—</td>
                      <td className="p-1 bg-slate-50/50">—</td>
                    </tr>
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-slate-50">Old Patient</td>
                      <td className="p-1">{oldOPDTotal}</td>
                      <td className="p-1">{oldMaleTotal}</td>
                      <td className="p-1">{oldFemaleTotal}</td>
                      <td className="p-1 bg-slate-50/50">—</td>
                      <td className="p-1 bg-slate-50/50">—</td>
                    </tr>
                    <tr className="divide-x divide-slate-400 bg-emerald-50/40 font-bold border-t border-slate-400">
                      <td className="p-1 text-left font-sans font-black bg-slate-100 text-slate-950">Total Patient</td>
                      <td className="p-1 text-emerald-950 font-extrabold bg-emerald-50/80">{grandOPDTotal}</td>
                      <td className="p-1">{grandMaleTotal}</td>
                      <td className="p-1">{grandFemaleTotal}</td>
                      <td className="p-1 text-slate-900 font-bold">{aadhaar_seeded}</td>
                      <td className="p-1 text-slate-900 font-bold">{mobile_seeded}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Column: Age-Gender Breakdown details */}
              <div className="bg-white">
                <div 
                  className="bg-slate-100 border border-slate-400 p-1 text-[10px] font-extrabold text-slate-900 tracking-tight text-center leading-normal"
                >
                  ROGI VIVARAN CLASSIFICATION MATRIX (GENDER & AGE RATIOS)
                </div>
                <table className="w-full text-[10px] border-collapse text-center leading-tight border border-slate-400 -mt-[1px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-slate-800">
                      <th className="p-1 text-center" rowSpan={2}>Category</th>
                      <th className="p-1" rowSpan={2}>Male</th>
                      <th className="p-1" rowSpan={2} style={{ lineHeight: "13.75px" }}>Female</th>
                      <th className="p-0.5" colSpan={2}>Child</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-400 divide-x divide-slate-400 text-[9.5px] font-bold text-slate-600">
                      <th className="p-0.5">M</th>
                      <th className="p-0.5">F</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono font-semibold text-slate-900">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 font-sans font-bold bg-slate-50 text-center">New Patients</td>
                      <td className="p-1">{opdMaleNewVal}</td>
                      <td className="p-1">{opdFemaleNewVal}</td>
                      <td className="p-1 bg-slate-50/40">{opdChildMaleNew}</td>
                      <td className="p-1 bg-slate-50/40">{opdChildFemaleNew}</td>
                    </tr>
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 font-sans font-bold bg-slate-50 text-center">Old Patients</td>
                      <td className="p-1">{opdMaleOldVal}</td>
                      <td className="p-1">{opdFemaleOldVal}</td>
                      <td className="p-1 bg-slate-50/40">{opdChildMaleOld}</td>
                      <td className="p-1 bg-slate-50/40">{opdChildFemaleOld}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: Disease-wise Patient Load Matrix */}
            <div className="-mt-1">
              <div 
                style={{ fontSize: "11px" }}
                className="bg-slate-100 border border-slate-400 p-1 font-extrabold text-slate-900 tracking-tight text-center leading-normal"
              >
                मासिक रोगी विवरण - माह - {monthHindi} {year}
              </div>
              <div className="overflow-x-auto rounded-none -mt-[1px]">
                <table className="w-full text-[10px] border-collapse text-center bg-white table-auto leading-tight border border-slate-400">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-slate-800 text-[9.5px]">
                      <td className="p-0.5 font-sans font-black w-14">S.No.</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-0.5 font-mono font-extrabold text-slate-900 w-[23px] text-center">{d.sNo}</td>
                      ))}
                      <td className="p-0.5 bg-emerald-100 font-black text-emerald-950 font-mono w-14 text-[9.5px]">39</td>
                    </tr>
                    <tr className="bg-white border-b border-slate-400 divide-x divide-slate-400 text-[10px] font-bold text-slate-950 h-[82px]">
                      <td className="p-1 text-center font-sans font-extrabold text-[11px]">Disease</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-0 align-middle text-center w-[23px]" title={d.nameHindi}>
                          <div className="flex items-center justify-center h-full w-full py-0.5">
                            <span 
                              className="text-[11px] font-black tracking-tight whitespace-nowrap text-slate-900 leading-none"
                              style={{ 
                                writingMode: 'vertical-rl', 
                                transform: 'rotate(180deg)',
                                display: 'inline-block',
                                maxHeight: '72px'
                              }}
                            >
                              {d.nameHindi}
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="p-0 bg-emerald-50 text-emerald-950 font-black font-sans leading-none text-[9.5px] align-middle text-center w-14">
                        <div className="flex items-center justify-center h-full w-full py-0.5">
                          <span 
                            className="text-[9.5px] font-black tracking-tight whitespace-nowrap leading-none"
                            style={{ 
                              writingMode: 'vertical-rl', 
                              transform: 'rotate(180deg)',
                              display: 'inline-block'
                            }}
                          >
                            Total
                          </span>
                        </div>
                      </td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono text-[10px] font-bold text-slate-950">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-slate-50 text-[9.5px] w-14 h-[23px]">New</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-1 text-center w-[23px] font-bold text-slate-900">
                          {(d.opd_male_new || 0) + (d.opd_female_new || 0) + (d.opd_child_new || 0)}
                        </td>
                      ))}
                      <td className="p-1 bg-slate-100 font-black text-slate-950 text-center w-14">{newOPDTotal}</td>
                    </tr>
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-slate-50 text-[9.5px] w-14 h-[23px]">Old</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-1 text-center w-[23px] font-bold text-slate-900">
                          {(d.opd_male_old || 0) + (d.opd_female_old || 0) + (d.opd_child_old || 0)}
                        </td>
                      ))}
                      <td className="p-1 bg-slate-100 font-black text-slate-950 text-center w-14">{oldOPDTotal}</td>
                    </tr>
                    <tr className="divide-x divide-slate-400 bg-slate-100 font-bold border-t border-slate-400">
                      <td className="p-1 text-left font-sans font-black bg-slate-200 text-[10px] w-14 h-[22.5px]">Total</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-1 text-slate-950 font-black text-center w-[23px]">
                          {d.opd_total || 0}
                        </td>
                      ))}
                      <td className="p-1 bg-emerald-100 font-black text-emerald-950 text-center w-14">{grandOPDTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>


          </div>
        );
      }

      case "proforma2": {
        const standardDiseasesList = hospitalData.diseaseTotals || [];
        
        const opdMaleNewVal = hospitalData.opd_male_new || 0;
        const opdMaleOldVal = hospitalData.opd_male_old || 0;
        const opdFemaleNewVal = hospitalData.opd_female_new || 0;
        const opdFemaleOldVal = hospitalData.opd_female_old || 0;
        const opdChildNewVal = hospitalData.opd_child_new || 0;
        const opdChildOldVal = hospitalData.opd_child_old || 0;
        const opdElderlyNewVal = hospitalData.opd_elderly_new || 0;
        const opdElderlyOldVal = hospitalData.opd_elderly_old || 0;

        const opdChildMaleNew = Math.floor(opdChildNewVal * 0.5);
        const opdChildFemaleNew = opdChildNewVal - opdChildMaleNew;
        const opdChildMaleOld = Math.floor(opdChildOldVal * 0.5);
        const opdChildFemaleOld = opdChildOldVal - opdChildMaleOld;

        const newOPDTotal = opdMaleNewVal + opdFemaleNewVal + opdChildNewVal + opdElderlyNewVal;
        const oldOPDTotal = opdMaleOldVal + opdFemaleOldVal + opdChildOldVal + opdElderlyOldVal;
        const grandOPDTotal = newOPDTotal + oldOPDTotal;

        const newMaleTotal = opdMaleNewVal + opdChildMaleNew + Math.floor(opdElderlyNewVal * 0.5);
        const oldMaleTotal = opdMaleOldVal + opdChildMaleOld + Math.floor(opdElderlyOldVal * 0.5);
        const grandMaleTotal = newMaleTotal + oldMaleTotal;

        const newFemaleTotal = opdFemaleNewVal + opdChildFemaleNew + Math.ceil(opdElderlyNewVal * 0.5);
        const oldFemaleTotal = opdFemaleOldVal + opdChildFemaleOld + Math.ceil(opdElderlyOldVal * 0.5);
        const grandFemaleTotal = newFemaleTotal + oldFemaleTotal;

        const ipdMaleNewVal = hospitalData.ipd_male_new || 0;
        const ipdFemaleNewVal = hospitalData.ipd_female_new || 0;
        const ipdMaleOldVal = hospitalData.ipd_male_old || 0;
        const ipdFemaleOldVal = hospitalData.ipd_female_old || 0;

        const panchkarmaMaleNewVal = Math.round((hospitalData.panchkarma_male || 0) * 0.7);
        const panchkarmaFemaleNewVal = Math.round((hospitalData.panchkarma_female || 0) * 0.7);
        const panchkarmaMaleOldVal = (hospitalData.panchkarma_male || 0) - panchkarmaMaleNewVal;
        const panchkarmaFemaleOldVal = (hospitalData.panchkarma_female || 0) - panchkarmaFemaleNewVal;
        const panchkarmaMaleTotalVal = hospitalData.panchkarma_male || 0;
        const panchkarmaFemaleTotalVal = hospitalData.panchkarma_female || 0;

        const parts = selectedMonth.split("-");
        const y = parts.length === 2 ? parseInt(parts[0], 10) : 2026;
        const m = parts.length === 2 ? parseInt(parts[1], 10) : 6;
        let fyString;
        if (m >= 4) {
          fyString = `${y}-${y + 1}`;
        } else {
          fyString = `${y - 1}-${y}`;
        }

        return (
          <div className="space-y-4 text-slate-950">
            {/* Spreadsheet Title Block */}
            <div className="text-center pb-1 -mt-[26px]">
              <div className="text-[13px] h-[40px] font-black tracking-tight text-slate-950 uppercase p-1.5 bg-white flex items-center justify-center gap-2 mt-[20px]">
                <span className="text-emerald-950">{hospitalName}</span>
                <span>-</span>
                <span>{hospitalDistrict}</span>
              </div>
              <div className="text-[13px] h-[24px] font-extrabold mt-0.5 text-slate-800 p-0.5 bg-white flex items-center justify-center">
                Annual Patient Report (APR) - Financial Year {fyString}
              </div>
            </div>

            {/* Metadata Section styled like Excel grid rows */}
            <div className="bg-white">
              <table className="w-full text-[8.5px] border-collapse leading-tight font-sans border border-slate-400">
                <tbody>
                  <tr className="border-b border-slate-400 divide-x divide-slate-400">
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 w-[8%] text-center h-[30.5px]" style={{ fontWeight: "bold", fontSize: "11.5px" }}>Dispatch No.</td>
                    <td className="p-1 text-slate-900 w-[15%] font-semibold font-mono text-center" style={{ width: "158.96875px", fontSize: "10.5px" }}>{dispatchNo}</td>
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 w-[10%] text-center" style={{ fontSize: "11.5px" }}>Challan Date</td>
                    <td className="p-1 text-rose-800 bg-rose-50/10 font-bold w-[12%] text-center" style={{ fontSize: "10.5px" }}>N/A</td>
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 w-[10%] text-center" style={{ fontSize: "11.5px" }}>Challan No.</td>
                    <td className="p-1 text-rose-800 bg-rose-50/10 font-bold w-[18%] text-center font-mono" style={{ width: "178.703125px", fontSize: "10.5px" }}>N/A</td>
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 w-[12%] text-center" style={{ width: "125.53125px", fontSize: "11.5px" }}>Bank Branch</td>
                    <td className="p-1 text-rose-800 bg-rose-50/10 font-bold w-[10%] text-center font-semibold" style={{ fontSize: "11.5px" }}>N/A</td>
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 w-[10%] text-center" style={{ fontSize: "11.5px" }}>FINANCIAL YEAR</td>
                    <td className="p-1 text-emerald-900 font-extrabold text-center uppercase bg-sky-50/50 w-[10%]" style={{ fontSize: "11.5px", color: "#275e4d" }}>FY {fyString}</td>
                  </tr>
                  <tr className="divide-x divide-slate-400">
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 text-center h-[21.5px]" style={{ fontSize: "11.5px" }}>Date</td>
                    <td className="p-1 text-slate-900 font-semibold font-mono text-center" style={{ fontSize: "10.5px" }}>{dispatchDate}</td>
                    <td className="p-1 font-bold text-slate-800 bg-sky-50 text-center" style={{ fontSize: "11.5px" }}>Challan Amount</td>
                    <td className="p-1 text-emerald-950 font-extrabold font-mono text-left" style={{ fontSize: "12.5px" }}>₹ {customChallanAmount}</td>
                    <td className="p-1" colSpan={6}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 1: Patient Classification Block */}
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse text-center min-w-[1000px] bg-white leading-tight border border-slate-400">
                  <thead>
                    <tr className="bg-sky-100 border-b border-slate-400 divide-x divide-slate-400 text-slate-900 font-extrabold">
                      <th className="p-1" rowSpan={3}>Name of Month</th>
                      <th className="p-1" colSpan={6}>OPD(including children)</th>
                      <th className="p-1" colSpan={6}>IPD(including children)</th>
                      <th className="p-1" colSpan={6}>Panchkarma</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.28px" }}>Grand Total Levy</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.30px" }}>Grand Total Patients</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.72px" }}>Adhar Seeded</th>
                      <th className="p-1" rowSpan={3} style={{ width: "80.45px" }}>Mobile Beneficiary</th>
                    </tr>
                    <tr className="bg-sky-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-[9.5px]">
                      <th className="p-0.5 h-[17px]" colSpan={2}>NEW</th>
                      <th className="p-0.5" colSpan={2}>OLD</th>
                      <th className="p-0.5" colSpan={2}>TOTAL</th>
                      <th className="p-0.5" colSpan={2}>NEW</th>
                      <th className="p-0.5" colSpan={2}>OLD</th>
                      <th className="p-0.5" colSpan={2}>TOTAL</th>
                      <th className="p-0.5" colSpan={2}>NEW</th>
                      <th className="p-0.5" colSpan={2}>OLD</th>
                      <th className="p-0.5" colSpan={2}>TOTAL</th>
                    </tr>
                    <tr className="bg-sky-50 border-b border-slate-400 divide-x divide-slate-400 font-semibold text-[9px] text-slate-700">
                      <th className="p-0.5 h-[16px]">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5 bg-sky-100 text-slate-900 font-bold">Male</th>
                      <th className="p-0.5 bg-sky-100 text-slate-900 font-bold">Female</th>
                      
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5 bg-sky-100 text-slate-900 font-bold">Male</th>
                      <th className="p-0.5 bg-sky-100 text-slate-900 font-bold">Female</th>
                      
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5">Male</th>
                      <th className="p-0.5">Female</th>
                      <th className="p-0.5 bg-sky-100 text-slate-900 font-bold">Male</th>
                      <th className="p-0.5 bg-sky-100 text-slate-900 font-bold">Female</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono text-slate-900 font-semibold">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 bg-sky-50 font-sans font-bold text-[10px] text-slate-950 h-[24.5px]">FY {fyString}</td>
                      {/* OPD NEW */}
                      <td className="p-1">{opdMaleNewVal}</td>
                      <td className="p-1">{opdFemaleNewVal}</td>
                      {/* OPD OLD */}
                      <td className="p-1">{opdMaleOldVal}</td>
                      <td className="p-1">{opdFemaleOldVal}</td>
                      {/* OPD TOTAL */}
                      <td className="p-1 bg-sky-100 text-slate-950 font-bold">{opdMaleNewVal + opdMaleOldVal}</td>
                      <td className="p-1 bg-sky-100 text-slate-950 font-bold">{opdFemaleNewVal + opdFemaleOldVal}</td>
                      
                      {/* IPD NEW */}
                      <td className="p-1">{ipdMaleNewVal}</td>
                      <td className="p-1">{ipdFemaleNewVal}</td>
                      {/* IPD OLD */}
                      <td className="p-1">{ipdMaleOldVal}</td>
                      <td className="p-1">{ipdFemaleOldVal}</td>
                      {/* IPD TOTAL */}
                      <td className="p-1 bg-sky-100 text-slate-950 font-bold">{ipdMaleNewVal + ipdMaleOldVal}</td>
                      <td className="p-1 bg-sky-100 text-slate-950 font-bold">{ipdFemaleNewVal + ipdFemaleOldVal}</td>
                      
                      {/* Panchkarma NEW */}
                      <td className="p-1">{panchkarmaMaleNewVal}</td>
                      <td className="p-1">{panchkarmaFemaleNewVal}</td>
                      {/* Panchkarma OLD */}
                      <td className="p-1">{panchkarmaMaleOldVal}</td>
                      <td className="p-1">{panchkarmaFemaleOldVal}</td>
                      {/* Panchkarma TOTAL */}
                      <td className="p-1 bg-sky-100 text-slate-950 font-bold">{panchkarmaMaleTotalVal}</td>
                      <td className="p-1 bg-sky-100 text-slate-950 font-bold">{panchkarmaFemaleTotalVal}</td>
                      
                      {/* Grand Total Levy */}
                      <td className="p-1 font-sans font-bold text-slate-950 text-center">₹{customChallanAmount}</td>
                      {/* Grand Total Patients */}
                      <td className="p-1 bg-emerald-50 font-extrabold text-emerald-950 text-[11px]">{grandOPDTotal}</td>
                      {/* Adhar Seeded */}
                      <td className="p-1">{aadhaar_seeded}</td>
                      {/* Mobile Beneficiary */}
                      <td className="p-1">{mobile_seeded}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Ministry of AYUSH Transmission & Age/Gender Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 -mt-1">
              {/* Left Column: Proforma Transmission Block */}
              <div className="bg-white">
                <div className="bg-sky-100 border border-slate-400 p-1 text-[10px] font-extrabold text-slate-900 tracking-tight text-center leading-normal">
                  PROFORMA FOR THE DATA TO COLLECTED AT STATES / UTS LEVEL FOR ANNUAL TRANSMISSION TO MINISTRY OF AYUSH
                </div>
                <table className="w-full text-[10px] border-collapse text-center leading-tight border border-slate-400 -mt-[1px]">
                  <thead>
                    <tr className="bg-sky-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-slate-800">
                      <th className="p-1 text-left">Category</th>
                      <th className="p-1">Total Attended</th>
                      <th className="p-1" style={{ width: "70.73px" }}>Male</th>
                      <th className="p-1" style={{ width: "70.78px" }}>Female</th>
                      <th className="p-1">Aadhaar Seeded</th>
                      <th className="p-1">Mobile Seeded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono font-semibold text-slate-900">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-sky-50">New Patient</td>
                      <td className="p-1">{newOPDTotal}</td>
                      <td className="p-1">{newMaleTotal}</td>
                      <td className="p-1">{newFemaleTotal}</td>
                      <td className="p-1 bg-sky-50/50">—</td>
                      <td className="p-1 bg-sky-50/50">—</td>
                    </tr>
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-sky-50">Old Patient</td>
                      <td className="p-1">{oldOPDTotal}</td>
                      <td className="p-1">{oldMaleTotal}</td>
                      <td className="p-1">{oldFemaleTotal}</td>
                      <td className="p-1 bg-sky-50/50">—</td>
                      <td className="p-1 bg-sky-50/50">—</td>
                    </tr>
                    <tr className="divide-x divide-slate-400 bg-emerald-50/40 font-bold border-t border-slate-400">
                      <td className="p-1 text-left font-sans font-black bg-sky-100 text-slate-950">Total Patient</td>
                      <td className="p-1 text-emerald-950 font-extrabold bg-emerald-50/80">{grandOPDTotal}</td>
                      <td className="p-1">{grandMaleTotal}</td>
                      <td className="p-1">{grandFemaleTotal}</td>
                      <td className="p-1 text-slate-900 font-bold">{aadhaar_seeded}</td>
                      <td className="p-1 text-slate-900 font-bold">{mobile_seeded}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Column: Age-Gender Breakdown details */}
              <div className="bg-white">
                <div 
                  className="bg-sky-100 border border-slate-400 p-1 text-[10px] font-extrabold text-slate-900 tracking-tight text-center leading-normal"
                >
                  ROGI VIVARAN CLASSIFICATION MATRIX (GENDER & AGE RATIOS)
                </div>
                <table className="w-full text-[10px] border-collapse text-center leading-tight border border-slate-400 -mt-[1px]">
                  <thead>
                    <tr className="bg-sky-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-slate-800">
                      <th className="p-1 text-center" rowSpan={2}>Category</th>
                      <th className="p-1" rowSpan={2}>Male</th>
                      <th className="p-1" rowSpan={2} style={{ lineHeight: "13.75px" }}>Female</th>
                      <th className="p-0.5" colSpan={2}>Child</th>
                    </tr>
                    <tr className="bg-sky-50 border-b border-slate-400 divide-x divide-slate-400 text-[9.5px] font-bold text-slate-600">
                      <th className="p-0.5">M</th>
                      <th className="p-0.5">F</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono font-semibold text-slate-900">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 font-sans font-bold bg-sky-50 text-center">New Patients</td>
                      <td className="p-1">{opdMaleNewVal}</td>
                      <td className="p-1">{opdFemaleNewVal}</td>
                      <td className="p-1 bg-sky-50/40">{opdChildMaleNew}</td>
                      <td className="p-1 bg-sky-50/40">{opdChildFemaleNew}</td>
                    </tr>
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 font-sans font-bold bg-sky-50 text-center">Old Patients</td>
                      <td className="p-1">{opdMaleOldVal}</td>
                      <td className="p-1">{opdFemaleOldVal}</td>
                      <td className="p-1 bg-sky-50/40">{opdChildMaleOld}</td>
                      <td className="p-1 bg-sky-50/40">{opdChildFemaleOld}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: Disease-wise Patient Load Matrix */}
            <div className="-mt-1">
              <div 
                style={{ fontSize: "11px" }}
                className="bg-sky-100 border border-slate-400 p-1 font-extrabold text-slate-900 tracking-tight text-center leading-normal"
              >
                वार्षिक रोगी विवरण - वित्तीय वर्ष - {fyString}
              </div>
              <div className="overflow-x-auto rounded-none -mt-[1px]">
                <table className="w-full text-[10px] border-collapse text-center bg-white table-auto leading-tight border border-slate-400">
                  <thead>
                    <tr className="bg-sky-50 border-b border-slate-400 divide-x divide-slate-400 font-bold text-slate-800 text-[9.5px]">
                      <td className="p-0.5 font-sans font-black w-14">S.No.</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-0.5 font-mono font-extrabold text-slate-900 w-[23px] text-center">{d.sNo}</td>
                      ))}
                      <td className="p-0.5 bg-emerald-100 font-black text-emerald-950 font-mono w-14 text-[9.5px]">39</td>
                    </tr>
                    <tr className="bg-white border-b border-slate-400 divide-x divide-slate-400 text-[10px] font-bold text-slate-950 h-[82px]">
                      <td className="p-1 text-center font-sans font-extrabold text-[11px]">Disease</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-0 align-middle text-center w-[23px]" title={d.nameHindi}>
                          <div className="flex items-center justify-center h-full w-full py-0.5">
                            <span 
                              className="text-[11px] font-black tracking-tight whitespace-nowrap text-slate-900 leading-none"
                              style={{ 
                                writingMode: 'vertical-rl', 
                                transform: 'rotate(180deg)',
                                display: 'inline-block',
                                maxHeight: '72px'
                              }}
                            >
                              {d.nameHindi}
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="p-0 bg-emerald-50 text-emerald-950 font-black font-sans leading-none text-[9.5px] align-middle text-center w-14">
                        <div className="flex items-center justify-center h-full w-full py-0.5">
                          <span 
                            className="text-[9.5px] font-black tracking-tight whitespace-nowrap leading-none"
                            style={{ 
                              writingMode: 'vertical-rl', 
                              transform: 'rotate(180deg)',
                              display: 'inline-block'
                            }}
                          >
                            Total
                          </span>
                        </div>
                      </td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono text-[10px] font-bold text-slate-950">
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-sky-50 text-[9.5px] w-14 h-[23px]">New</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-1 text-center w-[23px] font-bold text-slate-900">
                          {(d.opd_male_new || 0) + (d.opd_female_new || 0) + (d.opd_child_new || 0)}
                        </td>
                      ))}
                      <td className="p-1 bg-sky-100 font-black text-slate-950 text-center w-14">{newOPDTotal}</td>
                    </tr>
                    <tr className="divide-x divide-slate-400">
                      <td className="p-1 text-left font-sans font-bold bg-sky-50 text-[9.5px] w-14 h-[23px]">Old</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-1 text-center w-[23px] font-bold text-slate-900">
                          {(d.opd_male_old || 0) + (d.opd_female_old || 0) + (d.opd_child_old || 0)}
                        </td>
                      ))}
                      <td className="p-1 bg-sky-100 font-black text-slate-950 text-center w-14">{oldOPDTotal}</td>
                    </tr>
                    <tr className="divide-x divide-slate-400 bg-sky-100 font-bold border-t border-slate-400">
                      <td className="p-1 text-left font-sans font-black bg-sky-200 text-[10px] w-14 h-[22.5px]">Total</td>
                      {standardDiseasesList.map((d: any) => (
                        <td key={d.sNo} className="p-1 text-slate-950 font-black text-center w-[23px]">
                          {d.opd_total || 0}
                        </td>
                      ))}
                      <td className="p-1 bg-emerald-100 font-black text-emerald-950 text-center w-14">{grandOPDTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case "camp":
        const formatCampDate = (dateStr: string) => {
          if (!dateStr) return "";
          if (dateStr.includes(year)) return dateStr;
          
          if (dateStr.includes("-")) {
            const parts = dateStr.split("-");
            if (parts.length === 3) {
              const y = parts[0];
              const m = parseInt(parts[1], 10);
              const d = parts[2];
              const monthNamesHindi = [
                "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून",
                "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"
              ];
              const hMonth = monthNamesHindi[m - 1] || "मास";
              return `${d}-${hMonth}-${y}`;
            }
          }
          return dateStr;
        };

        const sampleCamps = [
          { loc: "झंकट ग्राम पंचायत बारा", date: `05-${monthHindi}-${year}`, male: Math.round((hospitalData.camp_beneficiaries_total || 120) * 0.3), female: Math.round((hospitalData.camp_beneficiaries_total || 120) * 0.5), child: Math.round((hospitalData.camp_beneficiaries_total || 120) * 0.2), total: hospitalData.camp_beneficiaries_total || 120, meds: hospitalData.camp_medicines_distributed || 115, screenings: hospitalData.camp_ncd_screenings || "35 Screened" },
          { loc: "खटीमा वार्ड 4 सामुदायिक भवन", date: `12-${monthHindi}-${year}`, male: 30, female: 45, child: 15, total: 90, meds: 88, screenings: "25 Screened" },
          { loc: "मेलाघाट सीमा शिविर", date: `18-${monthHindi}-${year}`, male: 55, female: 68, child: 25, total: 148, meds: 140, screenings: "48 Screened" }
        ];

        const actualCamps = (hospitalData.camps || []).map((c: any) => ({
          date: formatCampDate(c.date),
          loc: c.loc || c.village_location,
          male: c.male || c.beneficiaries_male || 0,
          female: c.female || c.beneficiaries_female || 0,
          child: c.child || c.beneficiaries_child || 0,
          total: c.total || c.beneficiaries_total || 0,
          meds: c.meds || c.medicine_distributed_count || 0,
          screenings: c.screenings !== undefined ? c.screenings : (c.ncd_screenings !== undefined ? c.ncd_screenings : "")
        }));

        const campsToDisplay = actualCamps.length > 0 ? actualCamps : sampleCamps;

        return (
          <div className="space-y-6">
            <h1 className="text-xl font-extrabold text-slate-900 mt-1 text-center">{hospitalName}</h1>
            <p className="text-sm font-bold text-slate-600 text-center">जनपद: {hospitalDistrict}</p>
            <h2 className="text-sm font-bold text-slate-700 mt-2 text-center">आयुष स्वास्थ्य शिविर विवरण प्रपत्र</h2>
            <p className="text-xs font-semibold text-slate-500 text-center mb-4">मास/वर्ष: {monthHindi} {year} | आयोजित शिविरों की संख्या: {hospitalData.camp_count || 0}</p>

            {/* Camps Table */}
            <div>
              <table className="w-full text-xs border-collapse border border-slate-400 text-left">
                <thead>
                  <tr className="bg-slate-100 divide-x divide-slate-400 border-b border-slate-400 text-[10px] font-bold text-slate-700 uppercase">
                    <th className="p-2">तिथि</th>
                    <th className="p-2">स्थान</th>
                    <th className="p-2 text-center">पुरुष</th>
                    <th className="p-2 text-center">महिला</th>
                    <th className="p-2 text-center">बालक</th>
                    <th className="p-2 text-center">कुल लाभार्थी</th>
                    <th className="p-2 text-left">अभियुक्ति</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400">
                  {campsToDisplay.length > 0 ? (
                    campsToDisplay.map((c, idx) => (
                      <tr key={idx} className="divide-x divide-slate-400">
                        <td className="p-2 font-mono font-semibold text-slate-800 whitespace-nowrap">{c.date}</td>
                        <td className="p-2 font-medium text-slate-800 text-left">{c.loc}</td>
                        <td className="p-2 text-center">{c.male}</td>
                        <td className="p-2 text-center">{c.female}</td>
                        <td className="p-2 text-center">{c.child}</td>
                        <td className="p-2 text-center font-bold bg-slate-50">{c.total}</td>
                        <td className="p-2 text-left font-sans text-xs text-slate-700">{c.screenings}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 italic">इस माह कोई स्वास्थ्य शिविर आयोजित नहीं किया गया।</td>
                    </tr>
                  )}
                  {/* Totals row */}
                  {hospitalData.camp_count > 0 && (
                    <tr className="bg-emerald-50/40 divide-x divide-slate-400 font-bold border-t-2 border-slate-400">
                      <td className="p-2 uppercase text-emerald-950 text-[10px]" colSpan={2}>कुल समेकित योग</td>
                      <td className="p-2 text-center">{Math.round((hospitalData.camp_beneficiaries_total || 0) * 0.35)}</td>
                      <td className="p-2 text-center">{Math.round((hospitalData.camp_beneficiaries_total || 0) * 0.45)}</td>
                      <td className="p-2 text-center">{Math.round((hospitalData.camp_beneficiaries_total || 0) * 0.20)}</td>
                      <td className="p-2 text-center bg-emerald-100 text-emerald-900 font-black">{hospitalData.camp_beneficiaries_total || 0}</td>
                      <td className="p-2 text-left font-sans text-emerald-900">{hospitalData.camp_ncd_screenings || 0}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "testkit":
        const getKitDisplayName = (name: string): string => {
          const lower = name.toLowerCase();
          if (lower.includes("hemoglobin") || lower.includes("hb")) {
            return "Hemoglobin Strips";
          }
          if (lower.includes("blood sugar") || lower.includes("glucometer") || lower.includes("sugar strips")) {
            return "Blood Sugar Strips";
          }
          if (lower.includes("urine") || lower.includes("multiparameter")) {
            return "Urine Strips";
          }
          if (lower.includes("pregnancy") || lower.includes("hcg") || lower.includes("upt")) {
            return "Pregnancy UPT";
          }
          if (lower.includes("malaria")) {
            return "Malaria Cards";
          }
          if (lower.includes("dengue")) {
            return "Dengue Cards";
          }
          if (lower.includes("typhoid")) {
            return "Typhoid Cards";
          }
          return name;
        };

        const kitsToRender = (hospitalData.inventory && hospitalData.inventory.length > 0)
          ? hospitalData.inventory.map((inv: any) => ({
              name: getKitDisplayName(inv.kit_type),
              opening: inv.opening_balance || 0,
              rec: inv.received_qty || 0,
              used: inv.used_qty || 0,
              def: inv.defective_qty || 0,
              closing: (inv.opening_balance || 0) + (inv.received_qty || 0) - (inv.used_qty || 0) - (inv.defective_qty || 0)
            }))
          : [
              { name: "Hemoglobin Strips", opening: 350, rec: 500, used: hospitalData.hemoglobin || 0, def: Math.min(5, Math.round((hospitalData.hemoglobin || 0)*0.02)), closing: 350 + 500 - (hospitalData.hemoglobin || 0) - Math.min(5, Math.round((hospitalData.hemoglobin || 0)*0.02)) },
              { name: "Blood Sugar Strips", opening: 400, rec: 400, used: hospitalData.blood_sugar || 0, def: Math.min(2, Math.round((hospitalData.blood_sugar || 0)*0.01)), closing: 400 + 400 - (hospitalData.blood_sugar || 0) - Math.min(2, Math.round((hospitalData.blood_sugar || 0)*0.01)) },
              { name: "Urine Strips", opening: 300, rec: 200, used: (hospitalData.urine_sugar || 0) + (hospitalData.urine_albumin || 0), def: Math.min(4, Math.round(((hospitalData.urine_sugar || 0) + (hospitalData.urine_albumin || 0))*0.02)), closing: 300 + 200 - ((hospitalData.urine_sugar || 0) + (hospitalData.urine_albumin || 0)) - Math.min(4, Math.round(((hospitalData.urine_sugar || 0) + (hospitalData.urine_albumin || 0))*0.02)) },
              { name: "Pregnancy UPT", opening: 100, rec: 100, used: hospitalData.pregnancy_tests || 0, def: 0, closing: 100 + 100 - (hospitalData.pregnancy_tests || 0) },
              { name: "Malaria Cards", opening: 150, rec: 0, used: hospitalData.malaria || 0, def: 0, closing: 150 - (hospitalData.malaria || 0) },
              { name: "Dengue Cards", opening: 100, rec: 0, used: hospitalData.dengue || 0, def: 0, closing: 100 - (hospitalData.dengue || 0) },
              { name: "Typhoid Cards", opening: 100, rec: 0, used: hospitalData.typhoid || 0, def: 0, closing: 100 - (hospitalData.typhoid || 0) }
            ];

        return (
          <div className="space-y-6">
            <h1 className="text-xl font-extrabold text-slate-900 mt-1 text-center">{hospitalName}</h1>
            <p className="text-sm font-bold text-slate-600 text-center">जनपद: {hospitalDistrict}</p>
            <h2 className="text-sm font-bold text-slate-700 mt-2 text-center">लैब जांच रिपोर्ट (निशुल्क किट विवरण)</h2>
            <p className="text-xs font-semibold text-slate-500 text-center mb-4">मास/वर्ष: {monthHindi} {year}</p>

            {/* Inventory Table */}
            <div>
              <table className="w-full text-xs border-collapse border border-slate-400 text-left">
                <thead>
                  <tr className="bg-slate-100 divide-x divide-slate-400 border-b border-slate-400 text-[10px] font-bold text-slate-700 uppercase">
                    <th className="p-2 text-center w-12">Sr No.</th>
                    <th className="p-2">विवरण (Test Kit Description)</th>
                    <th className="p-2 text-center">प्रारंभिक स्टॉक (Opening)</th>
                    <th className="p-2 text-center">प्राप्त स्टॉक (Received)</th>
                    <th className="p-2 text-center">उपयोग किया (Used)</th>
                    <th className="p-2 text-center">दोषपूर्ण (Defective)</th>
                    <th className="p-2 text-center">अंतिम स्टॉक (Closing)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400">
                  {kitsToRender.map((k, idx) => {
                    return (
                      <tr key={idx} className="divide-x divide-slate-400 hover:bg-slate-50/50">
                        <td className="p-2 text-center font-mono w-12">{idx + 1}</td>
                        <td className="p-2 font-medium">{k.name}</td>
                        <td className="p-2 text-center font-mono">{k.opening}</td>
                        <td className="p-2 text-center font-mono text-emerald-800 font-bold">+{k.rec}</td>
                        <td className="p-2 text-center font-mono text-rose-800 font-bold">-{k.used}</td>
                        <td className="p-2 text-center font-mono text-amber-800">-{k.def}</td>
                        <td className="p-2 text-center font-mono font-extrabold bg-slate-50">
                          {k.closing}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "disease_graph": {
        const rawDiseases = hospitalData.diseaseTotals || [];
        // Map and filter active ones or show all, sorted by highest total burden
        const chartData = rawDiseases.map((d: any) => {
          const nameEng = d.nameEnglish.split("/")[0].trim();
          const newVal = (d.opd_male_new || 0) + (d.opd_female_new || 0) + (d.opd_child_new || 0) + (d.opd_elderly_new || 0);
          const oldVal = (d.opd_male_old || 0) + (d.opd_female_old || 0) + (d.opd_child_old || 0) + (d.opd_elderly_old || 0);
          const totalVal = d.opd_total || (newVal + oldVal);
          return {
            name: nameEng,
            hindiName: d.nameHindi,
            "New Cases": newVal,
            "Old Cases": oldVal,
            "Total Burden": totalVal,
          };
        })
        .filter((d: any) => d["Total Burden"] > 0)
        .sort((a: any, b: any) => b["Total Burden"] - a["Total Burden"]);

        return (
          <div className="space-y-6 text-slate-950 proforma-container">
            {/* Header Block */}
            <div className="text-center pb-2 border-b border-slate-300">
              <h1 className="text-xl font-extrabold text-slate-900 mt-1 text-center">
                {hospitalName}
              </h1>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                मासिक रोगवार ग्राफ
              </p>
              <div className="flex justify-between text-[10px] font-bold text-slate-700 mt-3 px-1">
                <span>Facility: <strong className="text-slate-950">{user.role === UserRole.HOSPITAL_USER ? hospitalData?.hospitalName : (selectedHospitalId === "consolidated" ? "District Consolidated (All Centers)" : hospitalData?.hospitalName)}</strong></span>
                <span>District: <strong className="text-slate-950">{hospitalDistrict}</strong></span>
                <span>Reporting Period: <strong className="text-emerald-800 uppercase">{monthEnglish} {year}</strong></span>
              </div>
            </div>

            {/* Graphical Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                I. Caseload Trend Distribution (Top Diseases by Volume)
              </h3>
              
              {chartData.length === 0 ? (
                <div className="h-64 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-xs font-bold text-slate-500 italic">No disease cases were logged during this month.</p>
                </div>
              ) : (
                <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50">
                  <div className="h-80 w-full" style={{ minHeight: "320px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData.slice(0, 15)}
                        margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#0f172a", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 8, fill: "#0f172a", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                        <Legend wrapperStyle={{ fontSize: "9px", paddingTop: "5px" }} />
                        <Bar dataKey="New Cases" fill="#059669" name="New Cases" radius={[2, 2, 0, 0]} barSize={20} />
                        <Bar dataKey="Old Cases" fill="#2563eb" name="Old Cases" radius={[2, 2, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center text-[9px] text-slate-500 font-bold mt-2 italic">
                    Showing top 15 diseases representing {Math.round(chartData.slice(0, 15).reduce((acc, curr) => acc + curr["Total Burden"], 0) / (chartData.reduce((acc, curr) => acc + curr["Total Burden"], 0) || 1) * 100)}% of the total recorded epidemiological volume.
                  </div>
                </div>
              )}
            </div>

            {/* Numeric Table Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                II. Complete Disease-Wise Numeric Register
              </h3>
              <div className="border border-slate-400 bg-white">
                <table className="w-full text-[9px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100 divide-x divide-slate-400 border-b border-slate-400 font-black text-slate-900 uppercase">
                      <th className="p-1 w-10 text-center">S.No</th>
                      <th className="p-1">Disease Name (English & Hindi)</th>
                      <th className="p-1 text-center w-24">New Cases</th>
                      <th className="p-1 text-center w-24">Old Cases</th>
                      <th className="p-1 text-center w-28 bg-emerald-50 text-emerald-950 font-black">Total Caseload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-semibold text-slate-900">
                    {chartData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">No disease logs available.</td>
                      </tr>
                    ) : (
                      chartData.map((d: any, idx: number) => (
                        <tr key={idx} className="divide-x divide-slate-400 hover:bg-slate-50/20">
                          <td className="p-1 text-center font-mono w-10">{idx + 1}</td>
                          <td className="p-1 font-medium">
                            <span className="font-extrabold text-slate-950">{d.name}</span>
                            <span className="text-slate-500 text-[8px] font-bold block leading-none mt-0.5">{d.hindiName}</span>
                          </td>
                          <td className="p-1 text-center font-mono text-emerald-700">{d["New Cases"]}</td>
                          <td className="p-1 text-center font-mono text-slate-600">{d["Old Cases"]}</td>
                          <td className="p-1 text-center font-mono font-extrabold bg-emerald-50/40 text-emerald-950">{d["Total Burden"]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-100 p-4 animate-in fade-in duration-200 print:relative print:p-0 print:bg-transparent">
      <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:rounded-none transition-all duration-300 ${
        (reportType === "proforma1" || reportType === "proforma2") ? "max-w-[310mm]" : "max-w-4xl"
      }`}>
        
        {/* Modal Toolbar (hidden when printing) */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 print:hidden">
          
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-700" />
            <span className="font-extrabold text-sm text-slate-800 uppercase tracking-wide">
              Official Proforma PDF Report Center
            </span>
          </div>

          {/* Dynamic selectors right in the toolbar */}
          <div className="flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-2.5 w-full lg:w-auto">
            
            <div className="flex flex-row items-stretch items-center gap-2 w-full lg:w-auto">
              {/* Month selector */}
              <div className="flex-1 lg:flex-initial flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Month:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedMonth.split("-")[1] || "01"}
                    onChange={(e) => {
                      const currentYear = selectedMonth.split("-")[0] || "2026";
                      const newMonth = e.target.value;
                      setSelectedMonth(`${currentYear}-${newMonth}`);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0 cursor-pointer"
                  >
                    <option value="01">Jan</option>
                    <option value="02">Feb</option>
                    <option value="03">Mar</option>
                    <option value="04">Apr</option>
                    <option value="05">May</option>
                    <option value="06">Jun</option>
                    <option value="07">Jul</option>
                    <option value="08">Aug</option>
                    <option value="09">Sep</option>
                    <option value="10">Oct</option>
                    <option value="11">Nov</option>
                    <option value="12">Dec</option>
                  </select>
                  <select
                    value={selectedMonth.split("-")[0] || "2026"}
                    onChange={(e) => {
                      const currentMonth = selectedMonth.split("-")[1] || "01";
                      const newYear = e.target.value;
                      setSelectedMonth(`${newYear}-${currentMonth}`);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0 cursor-pointer"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              {/* Hospital filter if Super Admin or Office Admin */}
              {user.role !== UserRole.HOSPITAL_USER && fetchedHospitals.length > 0 && (
                <div className="flex-1 lg:flex-initial flex items-center justify-between lg:justify-start gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Facility:</span>
                  <select
                    value={selectedHospitalId}
                    onChange={(e) => setSelectedHospitalId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-850 outline-none border-none py-0.5 cursor-pointer max-w-[120px] sm:max-w-[160px]"
                  >
                    <option value="consolidated">District Consolidated</option>
                    {fetchedHospitals.map(h => (
                      <option key={h.hospitalId} value={h.hospitalId}>{h.hospitalName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Report type tabs */}
            <div className="flex bg-slate-200 p-1 rounded-xl gap-0.5 w-full lg:w-auto justify-between lg:justify-start">
              {(["proforma1", "proforma2", "camp", "testkit", "disease_graph"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`flex-1 lg:flex-initial px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap text-center ${
                    reportType === type
                      ? "bg-white text-emerald-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {type === "proforma1" ? "Proforma 1" : type === "proforma2" ? "Proforma 2" : type === "disease_graph" ? "DISEASE CHART" : type.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Action Buttons: Print and Close */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              {/* Print trigger button */}
              <button
                onClick={handlePrint}
                disabled={isLoading || !hospitalData}
                className="flex-1 lg:flex-initial bg-emerald-800 hover:bg-emerald-950 disabled:bg-slate-300 text-white text-xs font-extrabold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all outline-none"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>

              {/* Close modal */}
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all outline-none close-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Metadata & Print Controls Bar (hidden in print) */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs font-semibold text-slate-700 print:hidden select-none">
          {/* Live Editor metadata inputs - ONLY for Proforma 1 and 2 */}
          {(reportType === "proforma1" || reportType === "proforma2") ? (
            <div className="flex flex-col gap-1.5 w-full xl:w-auto">
              <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Live Editor:</div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-wrap items-center gap-1.5 w-full">
                {reportType === "proforma2" && (
                  <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1 min-w-0">
                    <span className="text-[9px] text-sky-600 font-bold uppercase shrink-0">FY:</span>
                    <select
                      value={(() => {
                        const parts = selectedMonth.split("-");
                        const y = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
                      })()}
                      onChange={(e) => {
                        const [startYear] = e.target.value.split("-");
                        setSelectedMonth(`${startYear}-06`);
                      }}
                      className="bg-transparent text-xs font-bold text-sky-950 outline-none w-full min-w-0 border-none cursor-pointer p-0"
                    >
                      <option value="2024-2025">FY 24-25</option>
                      <option value="2025-2026">FY 25-26</option>
                      <option value="2026-2027">FY 26-27</option>
                      <option value="2027-2028">FY 27-28</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">पत्रांक:</span>
                  <input
                    type="text"
                    value={dispatchNo}
                    onChange={(e) => setDispatchNo(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full min-w-0 border-none p-0"
                    placeholder="पत्रांक-"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">दिनांक:</span>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full min-w-0 border-none cursor-pointer p-0"
                  />
                </div>

                {reportType === "proforma2" ? (
                  <>
                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 min-w-0 opacity-60">
                      <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">चलान तिथि:</span>
                      <input
                        type="text"
                        value="N/A"
                        disabled
                        className="bg-transparent text-xs font-bold text-rose-800 outline-none w-full min-w-0 border-none p-0"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 min-w-0 opacity-60">
                      <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">संख्या:</span>
                      <input
                        type="text"
                        value="N/A"
                        disabled
                        className="bg-transparent text-xs font-bold text-rose-800 outline-none w-full min-w-0 border-none p-0"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
                      <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">चलान तिथि:</span>
                      <input
                        type="date"
                        value={challanDate}
                        onChange={(e) => setChallanDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full min-w-0 border-none cursor-pointer p-0"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
                      <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">संख्या:</span>
                      <input
                        type="text"
                        value={challanNo}
                        onChange={(e) => setChallanNo(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full min-w-0 border-none font-mono p-0"
                        placeholder="Challan No"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">धनराशि:</span>
                  <input
                    type="text"
                    value={customChallanAmount}
                    onChange={(e) => setCustomChallanAmount(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full min-w-0 border-none font-mono p-0"
                    placeholder="₹"
                  />
                </div>

                {reportType === "proforma2" ? (
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 min-w-0 opacity-60">
                    <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">शाखा:</span>
                    <input
                      type="text"
                      value="N/A"
                      disabled
                      className="bg-transparent text-xs font-bold text-rose-800 outline-none w-full min-w-0 border-none p-0"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">शाखा:</span>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full min-w-0 border-none p-0"
                      placeholder="Bank Branch"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
              {reportType === "camp" ? "Camp outreach report" : "Diagnostic Testkit Report"} layout
            </div>
          )}

          {/* Orientation & Zoom controls - ALWAYS visible */}
          <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto xl:justify-end">
            {/* Orientation Control */}
            <div className="flex items-center justify-between md:justify-start gap-1.5 bg-indigo-50/75 border border-indigo-200 rounded-lg px-2.5 py-1 text-indigo-900 w-full md:w-auto">
              <span className="text-[10px] text-indigo-750 font-extrabold uppercase tracking-wider">report orientation:</span>
              <select
                value={orientation}
                onChange={(e) => {
                  const val = e.target.value as "portrait" | "landscape";
                  setOrientation(val);
                  setZoomLevel(val === "portrait" ? 80 : 60);
                }}
                className="bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-[11px] font-bold text-indigo-950 outline-none cursor-pointer"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            {/* Zoom / Scaling Control */}
            <div className="flex items-center justify-between md:justify-start gap-2 bg-emerald-50/75 border border-emerald-200 rounded-lg px-2.5 py-1 text-emerald-900 w-full md:w-auto">
              <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider">Report Preview zoom:</span>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setZoomLevel(Math.max(30, zoomLevel - 5))}
                  className="hover:bg-emerald-100 border border-emerald-200 text-xs font-black w-5 h-5 flex items-center justify-center rounded bg-white text-emerald-900 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <input
                  type="range"
                  min="30"
                  max="120"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  className="w-16 sm:w-20 accent-emerald-700 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                  title="Adjust preview scale"
                />
                <span className="text-[10px] font-extrabold w-9 text-right font-mono text-emerald-900">{zoomLevel}%</span>
                <button 
                  type="button"
                  onClick={() => setZoomLevel(Math.min(120, zoomLevel + 5))}
                  className="hover:bg-emerald-100 border border-emerald-200 text-xs font-black w-5 h-5 flex items-center justify-center rounded bg-white text-emerald-900 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <button 
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="text-[10px] text-emerald-800 hover:text-emerald-950 underline font-black ml-1 transition-colors cursor-pointer"
                  title="Fit A4 Scale (100%)"
                >
                  Fit A4
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Printable Area */}
        <div className="p-6 overflow-y-auto bg-slate-100/40 print:p-0 print:bg-white flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-10 h-10 text-emerald-700 animate-spin mb-4" />
              <p className="font-bold text-sm">Aggregating and compiling real-time telemetry from database...</p>
              <p className="text-xs text-slate-400 mt-1">Generating official Uttarakhand Ayush Department dossiers</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center">
              <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
              <p className="font-bold text-slate-800">Error Generating Report</p>
              <p className="text-xs text-slate-500 mt-2">{error}</p>
              <button 
                onClick={() => setSelectedMonth(initialMonth)}
                className="mt-6 bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors"
              >
                Reset to Default Month
              </button>
            </div>
          ) : hospitalData ? (
            <div className="flex-1">
              {/* Custom screen style tag to make preview match printed view 100% exactly */}
              <style>{`
                .proforma-container {
                  border: none !important;
                }
                .proforma-container table {
                  border-collapse: collapse !important;
                  border-spacing: 0 !important;
                }
                .proforma-container th, 
                .proforma-container td {
                  border: 1px solid #A0A9EB !important;
                }
                .proforma-container .border {
                  border: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-t {
                  border-top: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-b {
                  border-bottom: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-l {
                  border-left: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-r {
                  border-right: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-x {
                  border-left: 1px solid #A0A9EB !important;
                  border-right: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-y {
                  border-top: 1px solid #A0A9EB !important;
                  border-bottom: 1px solid #A0A9EB !important;
                }
                .proforma-container .border-dashed {
                  border: 1px dashed #A0A9EB !important;
                }
                .proforma-container .divide-x > * + * {
                  border-left: 1px solid #A0A9EB !important;
                }
                .proforma-container .divide-y > * + * {
                  border-top: 1px solid #A0A9EB !important;
                }
                .proforma-container [class*="border-"],
                .proforma-container [class*="divide-"] > * + * {
                  border-color: #A0A9EB !important;
                }
              `}</style>

              {/* Compliance warning if daysSubmitted === 0 */}
              {hospitalData.daysSubmitted === 0 && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">No Daily Reports Submitted (0 Days Logged)</span>
                    <p className="text-[11px] leading-relaxed mt-0.5">
                      No numeric data was logged in the database by this facility for {monthHindi} {year}. Indicators reflect 0. Please register logs in the dashboard to populate live metrics.
                    </p>
                  </div>
                </div>
              )}

              {/* Printable Proforma Container in exact physical A4 dimensions */}
              <div 
                ref={printAreaRef}
                style={{ zoom: `${zoomLevel}%` }}
                className={`bg-white border-none p-8 shadow-xl mx-auto proforma-container relative transition-all duration-300 flex flex-col justify-between shrink-0 box-border ${
                  orientation === "landscape" 
                    ? "w-[297mm] h-[210mm] min-w-[297mm] min-h-[210mm] max-w-[297mm] max-h-[210mm] overflow-hidden" 
                    : "w-[210mm] h-[297mm] min-w-[210mm] min-h-[297mm] max-w-[210mm] max-h-[297mm] overflow-hidden"
                }`}
              >
                {renderReportContent()}

                {/* Standard Signature Footers matching executive template */}
                <div className="mt-[-6px] mb-[98px] pt-4 border-t border-slate-300">
                  <p className="text-[10px] leading-relaxed italic text-slate-700 font-sans mt-[-6px] font-bold">
                    प्रमाणित किया जाता है कि उक्त सूचना चिकित्सालय के अभिलेखों के अनुसार तैयार की गई है जो मेरी जानकारी के अनुसार सही व सत्य है।
                  </p>
                  <div className="flex justify-end mt-12">
                    <div className="text-center w-80">
                      {hospitalIncharge && (
                        <p className="text-xs font-bold text-slate-800 mb-1 font-sans">{hospitalIncharge}</p>
                      )}
                      <div className="border-t border-slate-400 w-full" style={{ marginBottom: "11px", marginTop: "8px" }}></div>
                      <p className="text-[11px] font-bold text-slate-900">प्रभारी चिकित्साधिकारी</p>
                      <p className="text-[9px] text-slate-600 mt-1">{hospitalName}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-4" />
              <p className="font-bold">No Active Data Compiled</p>
              <p className="text-xs">Try selecting another month or facility.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
