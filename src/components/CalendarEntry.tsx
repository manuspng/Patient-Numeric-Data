/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Sparkles,
  ClipboardCheck,
  Activity,
  FileSpreadsheet,
  AlertOctagon,
  TrendingUp,
  UserCheck,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Edit,
  Info,
  AlertCircle
} from "lucide-react";
import { UserRole, UserProfile, DailyReport, PatientMatrixLog, InvestigationsLabLog, InventoryItemLog, OutreachCampLog, MasterDisease, DiseaseOPDLog, CustomReportField, Hospital } from "../types";
import { getComponentTheme } from "../utils/theme";

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access denied for key:", key, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage write denied for key:", key, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage removal denied for key:", key, e);
    }
  }
};

const getUsedQtyFromLab = (kitType: string, labData: InvestigationsLabLog): number => {
  const normalized = kitType.toLowerCase();
  if (normalized.includes("hemoglobin") || normalized.includes("hb")) {
    return Number(labData.hemoglobin || 0);
  }
  if (normalized.includes("blood sugar") || normalized.includes("glucometer")) {
    return Number(labData.blood_sugar || 0);
  }
  if (normalized.includes("urine")) {
    return Number(labData.urine_sugar || 0) + Number(labData.urine_albumin || 0);
  }
  if (normalized.includes("malaria")) {
    return Number(labData.malaria || 0);
  }
  if (normalized.includes("dengue")) {
    return Number(labData.dengue || 0);
  }
  if (normalized.includes("typhoid")) {
    return Number(labData.typhoid || 0);
  }
  if (normalized.includes("pregnancy") || normalized.includes("hcg") || normalized.includes("upt")) {
    return Number(labData.pregnancy_tests || 0);
  }
  if (normalized.includes("hepatitis a")) {
    return Number(labData.hepatitis_a || 0);
  }
  if (normalized.includes("hepatitis b")) {
    return Number(labData.hepatitis_b || 0);
  }
  if (normalized.includes("hepatitis c")) {
    return Number(labData.hepatitis_c || 0);
  }
  return 0;
};

const cleanKitName = (name: string): string => {
  let clean = name;
  // Remove descriptors like Strips, Cards, Rapid, Antigen, Test, Cassettes, Multiparameter, HCG
  clean = clean.replace(/\bStrips\b/gi, "");
  clean = clean.replace(/\bCards\b/gi, "");
  clean = clean.replace(/\bRapid\b/gi, "");
  clean = clean.replace(/\bAntigen\b/gi, "");
  clean = clean.replace(/\bTest\b/gi, "");
  clean = clean.replace(/\bCassettes\b/gi, "");
  clean = clean.replace(/\bMultiparameter\b/gi, "");
  clean = clean.replace(/\bHCG\b/gi, "");
  
  // Clean up extra spaces
  clean = clean.replace(/\s+/g, " ").trim();
  
  // Specific mappings for ultra-clean presentation
  const lower = clean.toLowerCase();
  if (lower === "hemoglobin" || lower === "hb") {
    return "Hemoglobin (Hb)";
  }
  if (lower === "blood sugar" || lower === "sugar") {
    return "Blood Sugar";
  }
  if (lower === "urine") {
    return "Urine Analysis";
  }
  if (lower === "pregnancy" || lower === "pregnancy tests" || lower === "upt") {
    return "Pregnancy (UPT)";
  }
  return clean;
};

const isFutureDate = (dateStr: string) => {
  if (!dateStr) return false;
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  return dateStr > todayStr;
};

const formatReportingDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  if (monthIdx >= 0 && monthIdx < 12) {
    const dd = day < 10 ? `0${day}` : `${day}`;
    return `${dd} ${months[monthIdx]} ${year}`;
  }
  return dateStr;
};

const getEntryLabel = (dateStr: string) => {
  if (!dateStr) return "";
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (dateStr === todayStr) {
    return "Today";
  }
  return "Backlog";
};

interface CalendarEntryProps {
  user: UserProfile;
  hospitalId: string;
  isOnline: boolean;
  toggleOnline: () => void;
  onSuccessToast: (receipt: { title: string; content: string }) => void;
  sharedMonth?: string;
  setSharedMonth?: (month: string) => void;
  activeTab?: string;
  hasIpd?: boolean;
  setHasIpd?: (val: boolean) => void;
  hasPanchkarma?: boolean;
  setHasPanchkarma?: (val: boolean) => void;
  alwaysAllowInventoryEdit?: boolean;
  setAlwaysAllowInventoryEdit?: (val: boolean) => void;
}

export default function CalendarEntry({ 
  user, 
  hospitalId, 
  isOnline, 
  toggleOnline, 
  onSuccessToast,
  sharedMonth,
  setSharedMonth,
  activeTab,
  hasIpd: propHasIpd,
  hasPanchkarma: propHasPanchkarma,
  alwaysAllowInventoryEdit: propAlwaysAllowInventoryEdit,
}: CalendarEntryProps) {
  const ct = getComponentTheme(user.role);

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospitalId);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<Partial<DailyReport> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLockedDb, setIsLocked] = useState(false);
  const [isNew, setIsNew] = useState(true);

  const isFuture = isFutureDate(selectedDate);
  const isReadOnly = isLockedDb || isFuture || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.DAUO;
  const isLocked = isReadOnly;

  useEffect(() => {
    if (user.role === UserRole.HOSPITAL_USER) {
      setSelectedHospitalId(user.hospitalId || "");
    } else {
      setSelectedHospitalId(hospitalId);
    }
  }, [hospitalId, user]);

  // Bidirectional Synchronization of selected reporting month
  useEffect(() => {
    if (sharedMonth && !selectedDate.startsWith(sharedMonth)) {
      setSelectedDate(`${sharedMonth}-01`);
    }
  }, [sharedMonth]);

  useEffect(() => {
    if (selectedDate && setSharedMonth) {
      const parts = selectedDate.split("-");
      if (parts.length >= 2) {
        const dateMonth = `${parts[0]}-${parts[1]}`;
        setSharedMonth(dateMonth);
      }
    }
  }, [selectedDate, setSharedMonth]);

  useEffect(() => {
    if (user.role !== UserRole.HOSPITAL_USER) {
      const fetchHospitals = async () => {
        try {
          const res = await fetch("/api/hospitals");
          const data = await res.json();
          if (Array.isArray(data)) {
            setHospitals(data);
            if (data.length > 0 && !selectedHospitalId) {
              setSelectedHospitalId(data[0].id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch hospitals list inside CalendarEntry", e);
        }
      };
      fetchHospitals();
    }
  }, [user.role]);
  
  // Local modifications
  const [matrix, setMatrix] = useState<PatientMatrixLog>({
    opd_male_new: 0, opd_male_old: 0,
    opd_female_new: 0, opd_female_old: 0,
    opd_child_new: 0, opd_child_old: 0,
    opd_elderly_new: 0, opd_elderly_old: 0,
    ipd_admissions: 0,
    ipd_male_new: 0, ipd_male_old: 0,
    ipd_female_new: 0, ipd_female_old: 0,
    ipd_child_new: 0, ipd_child_old: 0,
    ipd_bed_occupancy_percentage: 0,
    panchkarma_male: 0, panchkarma_female: 0,
    panchkarma_child: 0, panchkarma_elderly: 0,
    levy_charges: 0,
    aadhaar_seeded_count: 0,
    mobile_seeded_count: 0
  });

  const [masterDiseases, setMasterDiseases] = useState<MasterDisease[]>([]);
  const [diseaseLogs, setDiseaseLogs] = useState<DiseaseOPDLog[]>([]);
  
  // Form states for adding/editing a disease-wise OPD log
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<string>("");
  const [customDiseaseName, setCustomDiseaseName] = useState<string>("");
  const [isCustomDisease, setIsCustomDisease] = useState<boolean>(false);
  const [editingDiseaseId, setEditingDiseaseId] = useState<string | null>(null);
  
  const [diseaseMaleNew, setDiseaseMaleNew] = useState<number>(0);
  const [diseaseMaleOld, setDiseaseMaleOld] = useState<number>(0);
  const [diseaseFemaleNew, setDiseaseFemaleNew] = useState<number>(0);
  const [diseaseFemaleOld, setDiseaseFemaleOld] = useState<number>(0);
  const [diseaseChildNew, setDiseaseChildNew] = useState<number>(0);
  const [diseaseChildOld, setDiseaseChildOld] = useState<number>(0);
  const [diseaseElderlyNew, setDiseaseElderlyNew] = useState<number>(0);
  const [diseaseElderlyOld, setDiseaseElderlyOld] = useState<number>(0);

  const [diseaseSearchQuery, setDiseaseSearchQuery] = useState<string>("");
  const [showOnlyEntered, setShowOnlyEntered] = useState<boolean>(false);

  const [lab, setLab] = useState<InvestigationsLabLog>({
    hemoglobin: 0, blood_sugar: 0, urine_sugar: 0, urine_albumin: 0,
    malaria: 0, dengue: 0, typhoid: 0,
    hepatitis_a: 0, hepatitis_b: 0, hepatitis_c: 0,
    pregnancy_tests: 0
  });

  const [inventory, setInventory] = useState<InventoryItemLog[]>([]);
  const [camps, setCamps] = useState<OutreachCampLog[]>([]);
  
  // Active camp form state
  const [newCamp, setNewCamp] = useState<OutreachCampLog>({
    village_location: "",
    beneficiaries_male: 0, beneficiaries_female: 0, beneficiaries_child: 0, beneficiaries_total: 0,
    medicine_distributed_count: 0, ncd_screenings: "", ayurvidya_sessions: 0
  });

  // Anomaly warning modal state
  const [anomalyModal, setAnomalyModal] = useState<{
    show: boolean;
    anomalies: Array<{ path: string; label: string; entered: number; avg: number; reason: string }>;
  } | null>(null);

  // Calendar statuses for current month
  const [calendarStatuses, setCalendarStatuses] = useState<{ [date: string]: "submitted" | "missing" | "locked" }>({});

  const [customFields, setCustomFields] = useState<CustomReportField[]>([]);
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, string | number>>({});

  // Section collapsible states
  const [isSection1Open, setIsSection1Open] = useState<boolean>(false);
  const [isSection2Open, setIsSection2Open] = useState<boolean>(false);
  const [isSection4Open, setIsSection4Open] = useState<boolean>(false);
  const [isSection5Open, setIsSection5Open] = useState<boolean>(false);

  // Individual test kits collapsible state
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});

  const toggleKitExpanded = (kitType: string) => {
    setExpandedKits(prev => ({
      ...prev,
      [kitType]: !prev[kitType]
    }));
  };

  const toggleAllKits = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    inventory.forEach(inv => {
      updated[inv.kit_type] = expand;
    });
    setExpandedKits(updated);
  };

  // Custom modal states for iFrame-safe confirmations
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showFutureDateModal, setShowFutureDateModal] = useState<boolean>(false);
  const [pendingReport, setPendingReport] = useState<DailyReport | null>(null);
  const [successReportSummary, setSuccessReportSummary] = useState<{
    date: string;
    totalOPD: number;
    totalTests: number;
    levyCharges: number;
  } | null>(null);

  // Facility-specific active capabilities
  const [hasIpd, setHasIpd] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem(`facility-has-ipd-${selectedHospitalId}`);
      return saved !== null ? saved === "true" : true;
    } catch (e) {
      return true;
    }
  });

  const [hasPanchkarma, setHasPanchkarma] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem(`facility-has-panchkarma-${selectedHospitalId}`);
      return saved !== null ? saved === "true" : true;
    } catch (e) {
      return true;
    }
  });

  const [alwaysAllowInventoryEdit, setAlwaysAllowInventoryEdit] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem(`facility-always-allow-inventory-edit-${selectedHospitalId}`);
      return saved !== null ? saved === "true" : false;
    } catch (e) {
      return false;
    }
  });

  const [isMobileCalendarCollapsed, setIsMobileCalendarCollapsed] = useState<boolean>(true);

  // Sync capability toggles when selected hospital ID, activeTab, or parent props change
  useEffect(() => {
    if (selectedHospitalId === hospitalId) {
      if (propHasIpd !== undefined) setHasIpd(propHasIpd);
      if (propHasPanchkarma !== undefined) setHasPanchkarma(propHasPanchkarma);
      if (propAlwaysAllowInventoryEdit !== undefined) setAlwaysAllowInventoryEdit(propAlwaysAllowInventoryEdit);
    } else {
      try {
        const savedIpd = safeStorage.getItem(`facility-has-ipd-${selectedHospitalId}`);
        setHasIpd(savedIpd !== null ? savedIpd === "true" : true);

        const savedPk = safeStorage.getItem(`facility-has-panchkarma-${selectedHospitalId}`);
        setHasPanchkarma(savedPk !== null ? savedPk === "true" : true);

        const savedInvEdit = safeStorage.getItem(`facility-always-allow-inventory-edit-${selectedHospitalId}`);
        setAlwaysAllowInventoryEdit(savedInvEdit !== null ? savedInvEdit === "true" : false);
      } catch (e) {
        setHasIpd(true);
        setHasPanchkarma(true);
        setAlwaysAllowInventoryEdit(false);
      }
    }
  }, [selectedHospitalId, hospitalId, propHasIpd, propHasPanchkarma, propAlwaysAllowInventoryEdit, activeTab]);

  // Fetch rates dynamically from facility settings stored in safeStorage
  const getStoredRates = () => {
    try {
      const stored = safeStorage.getItem(`facility-settings-${selectedHospitalId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          opdRate: Number(parsed.opd_levy_rate !== undefined ? parsed.opd_levy_rate : 5),
          ipdRate: Number(parsed.ipd_levy_rate !== undefined ? parsed.ipd_levy_rate : 10)
        };
      }
    } catch (e) {
      console.warn("Failed to read stored rates from safeStorage", e);
    }
    return { opdRate: 5, ipdRate: 10 };
  };

  const storedRates = getStoredRates();

  const opdLevyRate = Number(customFieldsData["opd_levy_rate"] !== undefined ? customFieldsData["opd_levy_rate"] : storedRates.opdRate);
  const ipdLevyRate = Number(customFieldsData["ipd_levy_rate"] !== undefined ? customFieldsData["ipd_levy_rate"] : storedRates.ipdRate);

  // Dynamic levy fragments & totals calculated from diseaseLogs
  const totalNewOPD = diseaseLogs.reduce((acc, curr) => acc + Number(curr.opd_male_new || 0) + Number(curr.opd_female_new || 0), 0);
  const totalOldOPD = diseaseLogs.reduce((acc, curr) => acc + Number(curr.opd_male_old || 0) + Number(curr.opd_female_old || 0), 0);
  const grandTotalOPD = totalNewOPD + totalOldOPD;

  const opdLevy = totalNewOPD * opdLevyRate;

  const totalNewIPD = Number(matrix.ipd_male_new || 0) + Number(matrix.ipd_female_new || 0);
  const ipdLevy = totalNewIPD * ipdLevyRate;

  const panchkarmaLevy = Number(customFieldsData["panchkarma_levy"] !== undefined ? customFieldsData["panchkarma_levy"] : 0);
  const otherLevy = Number(customFieldsData["other_levy"] !== undefined ? customFieldsData["other_levy"] : 0);

  const setPanchkarmaLevy = (val: number) => {
    setCustomFieldsData(prev => ({ ...prev, panchkarma_levy: val }));
  };

  const setOtherLevy = (val: number) => {
    setCustomFieldsData(prev => ({ ...prev, other_levy: val }));
  };

  // Synchronize all levy fragments and rates to customFieldsData for backend persistence
  useEffect(() => {
    setCustomFieldsData(prev => {
      if (
        prev["opd_levy_rate"] === opdLevyRate &&
        prev["ipd_levy_rate"] === ipdLevyRate &&
        prev["opd_levy"] === opdLevy &&
        prev["ipd_levy"] === ipdLevy &&
        prev["panchkarma_levy"] === panchkarmaLevy &&
        prev["other_levy"] === otherLevy
      ) {
        return prev;
      }
      return {
        ...prev,
        opd_levy_rate: opdLevyRate,
        ipd_levy_rate: ipdLevyRate,
        opd_levy: opdLevy,
        ipd_levy: ipdLevy,
        panchkarma_levy: panchkarmaLevy,
        other_levy: otherLevy
      };
    });
  }, [opdLevyRate, ipdLevyRate, opdLevy, ipdLevy, panchkarmaLevy, otherLevy]);

  useEffect(() => {
    fetchReportForDate(selectedDate);
    fetchMonthSubmissionStatus();
  }, [selectedDate, selectedHospitalId]);

  useEffect(() => {
    if (isFutureDate(selectedDate)) {
      setShowFutureDateModal(true);
    } else {
      setShowFutureDateModal(false);
    }
  }, [selectedDate]);

  // Fetch Custom Fields from templates on mount
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const res = await fetch("/api/templates");
        const d = await res.json();
        if (d.success && d.templates) {
          const fields: CustomReportField[] = [];
          const seen = new Set<string>();
          d.templates.forEach((t: any) => {
            if (t.customFields) {
              t.customFields.forEach((f: any) => {
                if (!seen.has(f.id)) {
                  seen.add(f.id);
                  fields.push(f);
                }
              });
            }
          });
          setCustomFields(fields);
        }
      } catch (e) {
        console.warn("Failed to fetch custom fields", e);
      }
    };
    fetchCustomFields();
  }, []);

  // Fetch Master Diseases on mount
  useEffect(() => {
    const loadMasterDiseases = async () => {
      const fallback = [
        { id: "dis-1", name: "ज्वर", category: "रोगवार विवरण" },
        { id: "dis-2", name: "अतिसार", category: "रोगवार विवरण" },
        { id: "dis-3", name: "वमन", category: "रोगवार विवरण" },
        { id: "dis-4", name: "श्वासकास", category: "रोगवार विवरण" },
        { id: "dis-5", name: "अम्लिपत्त", category: "रोगवार विवरण" },
        { id: "dis-6", name: "पाण्डु", category: "रोगवार विवरण" },
        { id: "dis-7", name: "कामला", category: "रोगवार विवरण" },
        { id: "dis-8", name: "उदर रोग", category: "रोगवार विवरण" },
        { id: "dis-9", name: "प्रमेह", category: "रोगवार विवरण" },
        { id: "dis-10", name: "मूत्र रोग", category: "रोगवार विवरण" },
        { id: "dis-11", name: "आमवात", category: "रोगवार विवरण" },
        { id: "dis-12", name: "संधिवात", category: "रोगवार विवरण" },
        { id: "dis-13", name: "मनो रोग", category: "रोगवार विवरण" },
        { id: "dis-14", name: "नेत्र शोथ", category: "रोगवार विवरण" },
        { id: "dis-15", name: "पक्षाघात", category: "रोगवार विवरण" },
        { id: "dis-16", name: "गृध्रसी", category: "रोगवार विवरण" },
        { id: "dis-17", name: "वातरक्त", category: "रोगवार विवरण" },
        { id: "dis-18", name: "वात व्याधि", category: "रोगवार विवरण" },
        { id: "dis-19", name: "त्वक विकार", category: "रोगवार विवरण" },
        { id: "dis-20", name: "ऊँच्चरक्त चाप", category: "रोगवार विवरण" },
        { id: "dis-21", name: "हृदय रोग", category: "रोगवार विवरण" },
        { id: "dis-22", name: "रक्त पित्त", category: "रोगवार विवरण" },
        { id: "dis-23", name: "शिरोरोग", category: "रोगवार विवरण" },
        { id: "dis-24", name: "मुखरोग", category: "रोगवार विवरण" },
        { id: "dis-25", name: "कर्ण रोग", category: "रोगवार विवरण" },
        { id: "dis-26", name: "प्रदर रोग", category: "रोगवार विवरण" },
        { id: "dis-27", name: "रजोरोग", category: "रोगवार विवरण" },
        { id: "dis-28", name: "रक्तअल्पता", category: "रोगवार विवरण" },
        { id: "dis-29", name: "बालातिसार", category: "रोगवार विवरण" },
        { id: "dis-30", name: "बालशोथ", category: "रोगवार विवरण" },
        { id: "dis-31", name: "श्वसनक ज्वर", category: "रोगवार विवरण" },
        { id: "dis-32", name: "कुपोषण", category: "रोगवार विवरण" },
        { id: "dis-33", name: "भगन्दर", category: "रोगवार विवरण" },
        { id: "dis-34", name: "व्रण", category: "रोगवार विवरण" },
        { id: "dis-35", name: "विदृधि", category: "रोगवार विवरण" },
        { id: "dis-36", name: "अर्श", category: "रोगवार विवरण" },
        { id: "dis-37", name: "अिस्थभंग", category: "रोगवार विवरण" },
        { id: "dis-38", name: "अन्य रोग", category: "रोगवार विवरण" },
        { id: "dis-39", name: "योग", category: "रोगवार विवरण" }
      ];

      try {
        const res = await fetch("/api/master/diseases");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const cleaned = data.filter(d => d.name.toLowerCase() !== "abc");
          setMasterDiseases(cleaned);
          if (cleaned.length > 0) {
            setSelectedDiseaseId(cleaned[0].id);
          }
        } else {
          setMasterDiseases(fallback);
          setSelectedDiseaseId("dis-1");
        }
      } catch (e) {
        console.warn("Failed to load master diseases", e);
        setMasterDiseases(fallback);
        setSelectedDiseaseId("dis-1");
      }
    };
    loadMasterDiseases();
  }, []);

  // Sync disease logs modifications with matrix totals
  useEffect(() => {
    const sumNewMale = diseaseLogs.reduce((acc, curr) => acc + Number(curr.opd_male_new || 0), 0);
    const sumNewFemale = diseaseLogs.reduce((acc, curr) => acc + Number(curr.opd_female_new || 0), 0);
    const sumOldMale = diseaseLogs.reduce((acc, curr) => acc + Number(curr.opd_male_old || 0), 0);
    const sumOldFemale = diseaseLogs.reduce((acc, curr) => acc + Number(curr.opd_female_old || 0), 0);

    setMatrix(prev => {
      return {
        ...prev,
        opd_male_new: sumNewMale,
        opd_female_new: sumNewFemale,
        opd_male_old: sumOldMale,
        opd_female_old: sumOldFemale,
        opd_child_new: 0,
        opd_child_old: 0,
        opd_elderly_new: 0,
        opd_elderly_old: 0,
      };
    });
  }, [diseaseLogs]);

  // Sync IPD breakdowns with IPD Admissions total
  useEffect(() => {
    const totalIPD = Number(matrix.ipd_male_new || 0) + Number(matrix.ipd_male_old || 0) + 
                     Number(matrix.ipd_female_new || 0) + Number(matrix.ipd_female_old || 0);
    setMatrix(prev => ({ 
      ...prev, 
      ipd_admissions: totalIPD,
      ipd_child_new: 0,
      ipd_child_old: 0 
    }));
  }, [
    matrix.ipd_male_new, matrix.ipd_male_old,
    matrix.ipd_female_new, matrix.ipd_female_old
  ]);

  const handleDiseaseSelectChange = (val: string) => {
    setSelectedDiseaseId(val);
    setEditingDiseaseId(null);
    if (val === "CUSTOM") {
      setIsCustomDisease(true);
      setCustomDiseaseName("");
      setDiseaseMaleNew(0);
      setDiseaseMaleOld(0);
      setDiseaseFemaleNew(0);
      setDiseaseFemaleOld(0);
      setDiseaseChildNew(0);
      setDiseaseChildOld(0);
      setDiseaseElderlyNew(0);
      setDiseaseElderlyOld(0);
    } else {
      setIsCustomDisease(false);
      const existing = diseaseLogs.find(log => log.diseaseId === val);
      if (existing) {
        setDiseaseMaleNew(existing.opd_male_new);
        setDiseaseMaleOld(existing.opd_male_old);
        setDiseaseFemaleNew(existing.opd_female_new);
        setDiseaseFemaleOld(existing.opd_female_old);
        setDiseaseChildNew(existing.opd_child_new);
        setDiseaseChildOld(existing.opd_child_old);
        setDiseaseElderlyNew(existing.opd_elderly_new || 0);
        setDiseaseElderlyOld(existing.opd_elderly_old || 0);
      } else {
        setDiseaseMaleNew(0);
        setDiseaseMaleOld(0);
        setDiseaseFemaleNew(0);
        setDiseaseFemaleOld(0);
        setDiseaseChildNew(0);
        setDiseaseChildOld(0);
        setDiseaseElderlyNew(0);
        setDiseaseElderlyOld(0);
      }
    }
  };

  const handleEditDiseaseLog = (log: DiseaseOPDLog) => {
    setEditingDiseaseId(log.diseaseId);
    if (log.diseaseId.startsWith("custom-")) {
      setIsCustomDisease(true);
      setCustomDiseaseName(log.diseaseName);
      setSelectedDiseaseId("CUSTOM");
    } else {
      setIsCustomDisease(false);
      setSelectedDiseaseId(log.diseaseId);
    }
    setDiseaseMaleNew(log.opd_male_new || 0);
    setDiseaseMaleOld(log.opd_male_old || 0);
    setDiseaseFemaleNew(log.opd_female_new || 0);
    setDiseaseFemaleOld(log.opd_female_old || 0);
    setDiseaseChildNew(log.opd_child_new || 0);
    setDiseaseChildOld(log.opd_child_old || 0);
    setDiseaseElderlyNew(log.opd_elderly_new || 0);
    setDiseaseElderlyOld(log.opd_elderly_old || 0);

    const element = document.getElementById("opd-disease-form-container");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleAddDiseaseLog = () => {
    let name = "";
    let id = "";
    if (isCustomDisease) {
      name = customDiseaseName.trim();
      if (!name) {
        alert("Please enter a custom disease name");
        return;
      }
      if (editingDiseaseId && editingDiseaseId.startsWith("custom-")) {
        id = editingDiseaseId;
      } else {
        id = `custom-${Date.now()}`;
      }
    } else {
      const master = masterDiseases.find(d => d.id === selectedDiseaseId);
      if (!master) return;
      name = master.name;
      id = master.id;
    }

    const newLog: DiseaseOPDLog = {
      diseaseId: id,
      diseaseName: name,
      opd_male_new: diseaseMaleNew,
      opd_male_old: diseaseMaleOld,
      opd_female_new: diseaseFemaleNew,
      opd_female_old: diseaseFemaleOld,
      opd_child_new: diseaseChildNew,
      opd_child_old: diseaseChildOld,
      opd_elderly_new: diseaseElderlyNew,
      opd_elderly_old: diseaseElderlyOld,
    };

    setDiseaseLogs(prev => {
      const filtered = prev.filter(l => l.diseaseId !== id && l.diseaseId !== editingDiseaseId);
      return [...filtered, newLog];
    });

    setDiseaseMaleNew(0);
    setDiseaseMaleOld(0);
    setDiseaseFemaleNew(0);
    setDiseaseFemaleOld(0);
    setDiseaseChildNew(0);
    setDiseaseChildOld(0);
    setDiseaseElderlyNew(0);
    setDiseaseElderlyOld(0);
    setIsCustomDisease(false);
    setEditingDiseaseId(null);
    if (masterDiseases.length > 0) {
      setSelectedDiseaseId(masterDiseases[0].id);
    }
  };

  const handleRemoveDiseaseLog = (idx: number) => {
    const log = diseaseLogs[idx];
    if (log && log.diseaseId === editingDiseaseId) {
      setEditingDiseaseId(null);
    }
    setDiseaseLogs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBulkCellChange = (
    diseaseId: string, 
    diseaseName: string, 
    field: "new" | "old", 
    val: number
  ) => {
    const sanitizedVal = Math.max(0, val);

    setDiseaseLogs(prevLogs => {
      const existingLog = prevLogs.find(l => l.diseaseId === diseaseId) || {
        diseaseId,
        diseaseName,
        opd_male_new: 0,
        opd_male_old: 0,
        opd_female_new: 0,
        opd_female_old: 0,
        opd_child_new: 0,
        opd_child_old: 0,
        opd_elderly_new: 0,
        opd_elderly_old: 0,
      };

      let currentNew = (existingLog.opd_male_new || 0) + (existingLog.opd_female_new || 0);
      let currentOld = (existingLog.opd_male_old || 0) + (existingLog.opd_female_old || 0);

      if (field === "new") currentNew = sanitizedVal;
      if (field === "old") currentOld = sanitizedVal;

      const currentTotal = currentNew + currentOld;

      if (currentTotal === 0) {
        return prevLogs.filter(l => l.diseaseId !== diseaseId);
      }

      const totalMalePrev = (existingLog.opd_male_new || 0) + (existingLog.opd_male_old || 0);
      const prevTotal = (existingLog.opd_male_new || 0) + (existingLog.opd_female_new || 0) + (existingLog.opd_male_old || 0) + (existingLog.opd_female_old || 0);
      const maleRatio = prevTotal > 0 ? (totalMalePrev / prevTotal) : 0.5;

      const opd_male_new = Math.round(currentNew * maleRatio);
      const opd_female_new = currentNew - opd_male_new;
      const opd_male_old = Math.round(currentOld * maleRatio);
      const opd_female_old = currentOld - opd_male_old;

      const updatedLog: DiseaseOPDLog = {
        ...existingLog,
        diseaseId,
        diseaseName,
        opd_male_new,
        opd_male_old,
        opd_female_new,
        opd_female_old
      };

      const exists = prevLogs.some(l => l.diseaseId === diseaseId);
      if (exists) {
        return prevLogs.map(l => (l.diseaseId === diseaseId ? updatedLog : l));
      } else {
        return [...prevLogs, updatedLog];
      }
    });
  };

  const fetchMonthSubmissionStatus = async () => {
    try {
      const yearMonth = selectedDate.substring(0, 7);
      // Scan status from database or local
      const res = await fetch(`/api/mpr/aggregate?month=${yearMonth}&userEmail=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data.success) {
        // Query server details to mark calendar days
        // Fetch from defaulters to find missing days
        const defRes = await fetch(`/api/mpr/defaulters?month=${yearMonth}&userEmail=${encodeURIComponent(user.email)}`);
        const defData = await defRes.json();
        const statuses: { [date: string]: "submitted" | "missing" | "locked" } = {};

        // Default mark all days so far
        const now = new Date();
        const checkYearMonth = now.toISOString().slice(0, 7);
        const [year, m] = yearMonth.split("-").map(Number);
        const daysInMonth = new Date(year, m, 0).getDate();
        const maxDay = yearMonth === checkYearMonth ? now.getDate() : daysInMonth;

        for (let d = 1; d <= maxDay; d++) {
          const dStr = d < 10 ? `0${d}` : `${d}`;
          statuses[`${yearMonth}-${dStr}`] = "submitted"; // default compliant
        }

        if (defData.success) {
          const myDef = defData.defaulters.find((d: any) => d.hospitalId === selectedHospitalId);
          if (myDef && myDef.missingDates) {
            myDef.missingDates.forEach((date: string) => {
              statuses[date] = "missing";
            });
          }
        }
        
        // Also check if they are locked
        setCalendarStatuses(statuses);
      }
    } catch (e) {
      console.warn("Failed to retrieve calendar statuses", e);
    }
  };

  const fetchReportForDate = async (dateStr: string) => {
    setIsLoading(true);
    try {
      // Offline simulation fallback
      if (!isOnline) {
        const cached = safeStorage.getItem(`offline-report-${selectedHospitalId}-${dateStr}`);
        if (cached) {
          const rep = JSON.parse(cached);
          loadReportIntoState(rep, false);
          setIsLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/mpr/daily?date=${dateStr}&hospitalId=${selectedHospitalId}&userEmail=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data.success && data.report) {
        loadReportIntoState(data.report, data.isNew || false);
      } else {
        setReport(null);
        setIsNew(true);
        setIsLocked(false);
        setMatrix({
          opd_male_new: 0, opd_male_old: 0,
          opd_female_new: 0, opd_female_old: 0,
          opd_child_new: 0, opd_child_old: 0,
          opd_elderly_new: 0, opd_elderly_old: 0,
          ipd_admissions: 0,
          ipd_male_new: 0, ipd_male_old: 0,
          ipd_female_new: 0, ipd_female_old: 0,
          ipd_child_new: 0, ipd_child_old: 0,
          ipd_bed_occupancy_percentage: 0,
          panchkarma_male: 0, panchkarma_female: 0,
          panchkarma_child: 0, panchkarma_elderly: 0,
          levy_charges: 0,
          aadhaar_seeded_count: 0,
          mobile_seeded_count: 0
        });
        setDiseaseLogs([]);
        setLab({
          hemoglobin: 0, blood_sugar: 0, urine_sugar: 0, urine_albumin: 0,
          malaria: 0, dengue: 0, typhoid: 0,
          hepatitis_a: 0, hepatitis_b: 0, hepatitis_c: 0,
          pregnancy_tests: 0
        });
        setInventory([]);
        setCamps([]);
        setCustomFieldsData({});
      }
    } catch (err) {
      console.error("Error fetching daily report", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReportIntoState = (rep: DailyReport, isNewRep: boolean) => {
    setReport(rep);
    setIsNew(isNewRep);
    setIsLocked(rep.isLocked || false);
    
    const pm = (rep.patientMatrix || {}) as any;
    if (rep.patientMatrix) {
      setMatrix({
        opd_male_new: 0, opd_male_old: 0,
        opd_female_new: 0, opd_female_old: 0,
        opd_child_new: 0, opd_child_old: 0,
        opd_elderly_new: 0, opd_elderly_old: 0,
        ipd_admissions: 0,
        ipd_male_new: 0, ipd_male_old: 0,
        ipd_female_new: 0, ipd_female_old: 0,
        ipd_child_new: 0, ipd_child_old: 0,
        ipd_bed_occupancy_percentage: 0,
        panchkarma_male: 0, panchkarma_female: 0,
        panchkarma_child: 0, panchkarma_elderly: 0,
        levy_charges: 0,
        aadhaar_seeded_count: 0,
        mobile_seeded_count: 0,
        ...rep.patientMatrix
      });
    }

    if (Array.isArray((rep as any).diseaseLogs) && (rep as any).diseaseLogs.length > 0) {
      setDiseaseLogs((rep as any).diseaseLogs);
    } else {
      const totalOPD = Number(pm.opd_male_new || 0) + Number(pm.opd_male_old || 0) + 
                       Number(pm.opd_female_new || 0) + Number(pm.opd_female_old || 0) + 
                       Number(pm.opd_child_new || 0) + Number(pm.opd_child_old || 0) + 
                       Number(pm.opd_elderly_new || 0) + Number(pm.opd_elderly_old || 0);
      if (totalOPD > 0) {
        setDiseaseLogs([
          {
            diseaseId: "dis-38",
            diseaseName: "अन्य रोग",
            opd_male_new: Number(pm.opd_male_new || 0),
            opd_male_old: Number(pm.opd_male_old || 0),
            opd_female_new: Number(pm.opd_female_new || 0),
            opd_female_old: Number(pm.opd_female_old || 0),
            opd_child_new: Number(pm.opd_child_new || 0),
            opd_child_old: Number(pm.opd_child_old || 0),
            opd_elderly_new: Number(pm.opd_elderly_new || 0),
            opd_elderly_old: Number(pm.opd_elderly_old || 0),
          }
        ]);
      } else {
        setDiseaseLogs([]);
      }
    }

    if (rep.investigationsLab) setLab({ ...rep.investigationsLab });
    if (Array.isArray(rep.inventory)) setInventory([...rep.inventory]);
    if (Array.isArray(rep.camps)) setCamps([...rep.camps]);
    setCustomFieldsData(rep.customFieldsData || {});
  };

  // Automated logic: total beneficiaries sum
  useEffect(() => {
    const total = Number(newCamp.beneficiaries_male) + Number(newCamp.beneficiaries_female) + Number(newCamp.beneficiaries_child);
    setNewCamp(prev => ({ ...prev, beneficiaries_total: total }));
  }, [newCamp.beneficiaries_male, newCamp.beneficiaries_female, newCamp.beneficiaries_child]);

  // Dynamic Levy Charges calculation: OPD Levy + IPD Levy + Panchkarma Levy + Other Levy
  useEffect(() => {
    const computedLevy = opdLevy + (hasIpd ? ipdLevy : 0) + (hasPanchkarma ? panchkarmaLevy : 0) + otherLevy;
    setMatrix(prev => {
      if (prev.levy_charges === computedLevy) return prev;
      return { ...prev, levy_charges: computedLevy };
    });
  }, [opdLevy, ipdLevy, panchkarmaLevy, otherLevy, hasIpd, hasPanchkarma]);

  // Dynamically synchronize inventory used quantities based on Topic 2 Lab Investigations count
  useEffect(() => {
    setInventory(prev => {
      let changed = false;
      const updated = prev.map(item => {
        const expectedUsed = getUsedQtyFromLab(item.kit_type, lab);
        if (item.used_qty !== expectedUsed) {
          changed = true;
          const open = Number(item.opening_balance || 0);
          const rec = Number(item.received_qty || 0);
          const def = Number(item.defective_qty || 0);
          return {
            ...item,
            used_qty: expectedUsed,
            closing_balance: open + rec - expectedUsed - def
          };
        }
        return item;
      });
      return changed ? updated : prev;
    });
  }, [lab]);

  const handleMatrixChange = (key: keyof PatientMatrixLog, val: number) => {
    setMatrix(prev => ({ ...prev, [key]: val }));
  };

  const handleLabChange = (key: keyof InvestigationsLabLog, val: number) => {
    setLab(prev => ({ ...prev, [key]: val }));
  };

  const handleDynamicCellClick = () => {
    onSuccessToast({
      title: "⚠️ Dynamic Component (लिंग-वार विवरण)",
      content: "These components are dynamic and cannot be input directly. Please enter patient details in the disease-wise section above."
    });
  };

  const handleInventoryChange = (index: number, field: keyof InventoryItemLog, val: number) => {
    const updated = [...inventory];
    updated[index] = { ...updated[index], [field]: val } as any;
    // Recalculate closing balance dynamically
    const item = updated[index];
    const open = Number(item.opening_balance || 0);
    const rec = Number(item.received_qty || 0);
    const used = Number(item.used_qty || 0);
    const def = Number(item.defective_qty || 0);
    item.closing_balance = open + rec - used - def;
    setInventory(updated);
  };

  const addCamp = () => {
    if (!newCamp.village_location.trim()) return;
    setCamps(prev => [...prev, newCamp]);
    setNewCamp({
      village_location: "",
      beneficiaries_male: 0, beneficiaries_female: 0, beneficiaries_child: 0, beneficiaries_total: 0,
      medicine_distributed_count: 0, ncd_screenings: "", ayurvidya_sessions: 0
    });
  };

  const removeCamp = (idx: number) => {
    setCamps(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit Handler with Custom Confirm Modal
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const payloadReport: DailyReport = {
      id: report?.id || `rep-${hospitalId}-${selectedDate}`,
      hospitalId,
      recordDate: selectedDate,
      submittedAt: new Date().toISOString(),
      submittedBy: user.email,
      patientMatrix: matrix,
      investigationsLab: lab,
      inventory,
      camps,
      isLocked: false,
      anomalyConfirmed: false,
      anomalyFlags: [],
      diseaseLogs: diseaseLogs,
      customFieldsData: customFieldsData
    } as any;

    setPendingReport(payloadReport);
    setShowConfirmModal(true);
  };

  const handleConfirmAndSubmit = async () => {
    if (!pendingReport) return;
    setShowConfirmModal(false);

    // Offline mode simulation
    if (!isOnline) {
      safeStorage.setItem(`offline-report-${hospitalId}-${selectedDate}`, JSON.stringify(pendingReport));
      // Add to offline sync queue
      const queueStr = safeStorage.getItem("offline-sync-queue") || "[]";
      const queue = JSON.parse(queueStr);
      // Avoid duplicate
      const filteredQueue = queue.filter((q: any) => q.recordDate !== selectedDate || q.hospitalId !== hospitalId);
      filteredQueue.push(pendingReport);
      safeStorage.setItem("offline-sync-queue", JSON.stringify(filteredQueue));

      onSuccessToast({
        title: "💾 Offline Saved",
        content: `Data saved locally for ${selectedDate}. It will auto-sync once internet is toggled Online.`
      });
      setIsNew(false);
      fetchMonthSubmissionStatus();
      setPendingReport(null);
      return;
    }

    try {
      // Check anomalies
      const checkRes = await fetch("/api/mpr/check-anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: pendingReport, hospitalId })
      });
      const checkData = await checkRes.json();

      if (checkData.success && checkData.hasAnomalies) {
        // Trigger Anomaly Modal
        setAnomalyModal({
          show: true,
          anomalies: checkData.anomalies
        });
        return;
      }

      // If no anomalies, proceed to submit
      await submitData(pendingReport);
    } catch (err) {
      console.error("Error checking anomalies", err);
      // Submit directly if API check fails
      await submitData(pendingReport);
    }
  };

  const proceedWithAnomaly = async () => {
    if (!anomalyModal) return;
    
    const payloadReport: DailyReport = {
      id: report?.id || `rep-${hospitalId}-${selectedDate}`,
      hospitalId,
      recordDate: selectedDate,
      submittedAt: new Date().toISOString(),
      submittedBy: user.email,
      patientMatrix: matrix,
      investigationsLab: lab,
      inventory,
      camps,
      isLocked: false,
      anomalyConfirmed: true,
      anomalyFlags: anomalyModal.anomalies.map(a => a.path),
      diseaseLogs: diseaseLogs,
      customFieldsData: customFieldsData
    } as any;

    setAnomalyModal(null);
    await submitData(payloadReport);
  };

  const submitData = async (payload: DailyReport) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/mpr/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: payload, userEmail: user.email })
      });
      const data = await res.json();
      if (data.success) {
        // Premium success receipt toast
        const totalOPD = Number(payload.patientMatrix.opd_male_new || 0) + 
                         Number(payload.patientMatrix.opd_male_old || 0) + 
                         Number(payload.patientMatrix.opd_female_new || 0) + 
                         Number(payload.patientMatrix.opd_female_old || 0);
        const totalTests = (Object.values(payload.investigationsLab || {}) as number[]).reduce((a: number, b: number) => a + Number(b), 0);

        onSuccessToast({
          title: "✨ Premium Submission Receipt",
          content: `Facility Report Submitted! Total OPD: ${totalOPD} | Lab Tests: ${totalTests} | Gov Levy: ₹${payload.patientMatrix.levy_charges}`
        });

        setSuccessReportSummary({
          date: selectedDate,
          totalOPD,
          totalTests,
          levyCharges: Number(payload.patientMatrix.levy_charges || 0)
        });

        // Open the custom success confirmation modal
        setShowSuccessModal(true);
        
        setIsNew(false);
        fetchMonthSubmissionStatus();
        setPendingReport(null);
      }
    } catch (err) {
      console.error("Submit failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync offline queue helper
  const syncOfflineData = async () => {
    const queueStr = safeStorage.getItem("offline-sync-queue");
    if (!queueStr) return;
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;

    let successCount = 0;
    for (const reportToSync of queue) {
      try {
        const res = await fetch("/api/mpr/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report: reportToSync, userEmail: user.email })
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        }
      } catch (e) {
        console.error("Sync item failed", e);
      }
    }

    // Clear queue on success
    safeStorage.removeItem("offline-sync-queue");
    onSuccessToast({
      title: "🔄 Auto-Synced Offline Data",
      content: `Successfully synchronized ${successCount} cached daily logs with the Central District Server!`
    });
    fetchReportForDate(selectedDate);
    fetchMonthSubmissionStatus();
  };

  // Watch network status toggles
  useEffect(() => {
    if (isOnline) {
      syncOfflineData();
    }
  }, [isOnline]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="calendar-entry-root">
      
      {/* Mobile-only Collapsible Calendar Trigger Banner */}
      <button
        type="button"
        onClick={() => setIsMobileCalendarCollapsed(!isMobileCalendarCollapsed)}
        className={`lg:hidden col-span-1 w-full ${ct.subSectionBg} hover:opacity-95 rounded-2xl p-3.5 flex items-center justify-between shadow-3xs transition-all outline-none border`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 ${ct.buttonBg.split(" ")[0]} text-white rounded-lg shadow-3xs`}>
            <CalendarIcon className="w-4 h-4" />
          </div>
          <span className={`text-xs font-bold ${ct.headerText} tracking-tight`}>
            {(() => {
              const todayStr = new Date().toISOString().split("T")[0];
              const isToday = selectedDate === todayStr;
              const formattedDate = new Date(selectedDate).toLocaleDateString(undefined, { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
              return isToday ? `Today, ${formattedDate}` : formattedDate;
            })()}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${ct.badgeBg} border px-2.5 py-1 rounded-lg`}>
          <span>{isMobileCalendarCollapsed ? "Show Calendar" : "Hide Calendar"}</span>
          {isMobileCalendarCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* LEFT SIDEBAR: Date Picker and Calendar status */}
      <div className={`lg:col-span-4 ${ct.cardBg} border rounded-2xl p-5 shadow-sm space-y-5 ${isMobileCalendarCollapsed ? "hidden lg:block" : "block"}`}>
        {user.role !== UserRole.HOSPITAL_USER && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Select Facility (Hospital)
            </label>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none text-xs"
            >
              {hospitals
                .filter((h) => h.incharge && h.incharge.trim() !== "")
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.type})
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Select Month & Year
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedDate.split("-")[1]}
              onChange={(e) => {
                const [y, m, d] = selectedDate.split("-");
                const newMonth = e.target.value;
                const maxDays = new Date(Number(y), Number(newMonth), 0).getDate();
                const newDay = Math.min(Number(d), maxDays).toString().padStart(2, '0');
                setSelectedDate(`${y}-${newMonth}-${newDay}`);
                setIsMobileCalendarCollapsed(true);
              }}
              className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
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
              value={selectedDate.split("-")[0]}
              onChange={(e) => {
                const [y, m, d] = selectedDate.split("-");
                const newYear = e.target.value;
                const maxDays = new Date(Number(newYear), Number(m), 0).getDate();
                const newDay = Math.min(Number(d), maxDays).toString().padStart(2, '0');
                setSelectedDate(`${newYear}-${m}-${newDay}`);
                setIsMobileCalendarCollapsed(true);
              }}
              className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>

        {/* Dynamic Month Calendar grid visualization */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Compliance Calendar
            </span>
            <span className="text-[9px] text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-full font-medium">
              Sync active
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {(() => {
              const [year, m] = selectedDate.split("-").map(Number);
              const firstDayIndex = new Date(year, m - 1, 1).getDay();
              const daysCount = new Date(year, m, 0).getDate();
              const cells = [];

              // Empty spacer cells
              for (let i = 0; i < firstDayIndex; i++) {
                cells.push(<div key={`empty-${i}`} className="h-8"></div>);
              }

              // Real days
              for (let d = 1; d <= daysCount; d++) {
                const dayStr = d < 10 ? `0${d}` : `${d}`;
                const currDateStr = `${selectedDate.substring(0, 7)}-${dayStr}`;
                const isSelected = selectedDate === currDateStr;
                const status = calendarStatuses[currDateStr];

                let bgClass = "bg-slate-50 text-slate-700 hover:bg-slate-100";
                if (status === "submitted") bgClass = ct.calendarSubmitted;
                if (status === "missing") bgClass = "bg-rose-50 text-rose-800 font-medium border border-rose-100";
                if (isSelected) bgClass = ct.calendarSelected;

                cells.push(
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSelectedDate(currDateStr);
                      setIsMobileCalendarCollapsed(true);
                    }}
                    className={`h-8 rounded-lg text-xs transition-all flex flex-col items-center justify-center relative ${bgClass}`}
                  >
                    <span>{d}</span>
                    {status === "submitted" && !isSelected && (
                      <span className={`absolute bottom-1 w-1 h-1 rounded-full ${ct.buttonBg.split(" ")[0]}`}></span>
                    )}
                    {status === "missing" && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-rose-500 animate-pulse"></span>
                    )}
                  </button>
                );
              }
              return cells;
            })()}
          </div>

          {/* Compliance legend */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-[10px] text-slate-500 font-medium border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded border ${ct.calendarSubmitted}`}></span>
              Compliant
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-50 border border-rose-200"></span>
              Missing Log
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded ${ct.calendarSelected}`}></span>
              Selected
            </span>
          </div>
        </div>

        {/* Status indicator panel */}
        <div className={`border rounded-xl p-4 space-y-3 ${ct.subSectionBg}`}>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Lock Status</span>
            {user.role === UserRole.SUPER_ADMIN || user.role === UserRole.DAUO ? (
              <span className="text-indigo-600 font-semibold flex items-center gap-1 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                INTROSPECT ONLY
              </span>
            ) : isLocked ? (
              <span className="text-amber-600 font-semibold flex items-center gap-1 bg-amber-50 px-2.5 py-0.5 rounded-full">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                LOCKED
              </span>
            ) : (
              <span className={`font-semibold flex items-center gap-1 px-2.5 py-0.5 rounded-full border ${ct.accentText} ${ct.accentBg} ${ct.cardBorder}`}>
                <Unlock className={`w-3.5 h-3.5 ${ct.accentText}`} />
                OPEN FOR ENTRY
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Log State</span>
            {isNew ? (
              <span className="text-slate-500 font-semibold bg-slate-200 px-2.5 py-0.5 rounded-full">
                Not Started
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Submitted Log
              </span>
            )}
          </div>

          {report?.submittedAt && (
            <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 space-y-0.5">
              <div>Logged on: {new Date(report.submittedAt).toLocaleDateString()}</div>
              <div>Reporter: {report.submittedBy}</div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Content Entry Fields */}
      <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6">
        
        {/* Patient Matrix (OPD/IPD) */}
        <div className={`${ct.cardBg} border rounded-2xl p-6 shadow-sm space-y-5`}>
          <div 
            onClick={() => setIsSection1Open(!isSection1Open)}
            className="flex items-center justify-between border-b border-slate-100 pb-3 cursor-pointer select-none group"
          >
            <h4 className={`font-semibold ${ct.headerText} flex items-center gap-2 text-[12px]`}>
              <Activity className={`w-5 h-5 ${ct.headerIcon}`} />
              Patient Numeric Entry
            </h4>
            <div className="flex items-center gap-3">
              {!isSection1Open && (
                <span className="text-[11px] font-semibold text-slate-500 font-sans tracking-wide select-none">
                  {getEntryLabel(selectedDate)}
                </span>
              )}
              {isSection1Open ? (
                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              )}
            </div>
          </div>

          {isSection1Open && (
            <>
              {/* 1. TOP SECTION: DISEASE-WISE ENTRY (NO GENDER BREAKDOWN ON ROWS) */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                  <div>
                    <span className={`text-xs font-bold ${ct.subHeader} uppercase tracking-wider block`}>
                      1. Disease-Wise OPD Entry (रोगवार विवरण)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Tab key workflow: Enter New & Old patient counts. Gender distribution is collected in the bottom table.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="🔍 Search disease by name..."
                      value={diseaseSearchQuery}
                      onChange={(e) => setDiseaseSearchQuery(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 w-48 md:w-56"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOnlyEntered(!showOnlyEntered)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                        showOnlyEntered
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-3xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {showOnlyEntered ? "Entered Only (>0)" : "Show All"}
                    </button>
                  </div>
                </div>

                {/* Bulk Entry Registry Table (No Gender Breakdown) */}
                <div className={`overflow-x-auto border ${ct.cardBorder} rounded-xl shadow-xs scrollbar-thin max-h-[550px] overflow-y-auto`}>
                  <table className="w-full text-left border-collapse min-w-[500px]" id="bulk-disease-registry-table">
                    <thead className="sticky top-0 z-10 shadow-3xs">
                      <tr className="bg-slate-800 text-white text-[10px] md:text-[11px] font-bold uppercase tracking-wider">
                        <th className="px-3 py-2.5 w-12 text-center">S.No</th>
                        <th className="px-3 py-2.5 text-left">Disease Name (रोग विवरण)</th>
                        <th className="px-3 py-2.5 text-center w-36 bg-slate-750">New Patients<br/><span className="text-[9px] font-normal text-emerald-300">(नवीन रोगी)</span></th>
                        <th className="px-3 py-2.5 text-center w-36 bg-slate-750">Old Patients<br/><span className="text-[9px] font-normal text-amber-300">(प्राचीन रोगी)</span></th>
                        <th className="px-3 py-2.5 text-center w-36 bg-slate-700 text-amber-200">Total Patients<br/><span className="text-[9px] font-normal text-slate-300">(Auto Total)</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {masterDiseases
                        .filter(d => {
                          const matchesSearch = d.name.toLowerCase().includes(diseaseSearchQuery.toLowerCase());
                          if (!matchesSearch) return false;
                          if (showOnlyEntered) {
                            const log = diseaseLogs.find(l => l.diseaseId === d.id);
                            const total = log ? (log.opd_male_new + log.opd_female_new + log.opd_male_old + log.opd_female_old) : 0;
                            return total > 0;
                          }
                          return true;
                        })
                        .map((disease, idx) => {
                          const existingLog = diseaseLogs.find(l => l.diseaseId === disease.id);
                          const newVal = existingLog ? (existingLog.opd_male_new + existingLog.opd_female_new) : 0;
                          const oldVal = existingLog ? (existingLog.opd_male_old + existingLog.opd_female_old) : 0;
                          const totalVal = newVal + oldVal;

                          return (
                            <tr 
                              key={disease.id}
                              className={`transition-colors ${
                                totalVal > 0 
                                  ? "bg-emerald-50/30 hover:bg-emerald-50/60" 
                                  : "bg-white hover:bg-slate-50/80"
                              }`}
                            >
                              <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">{disease.name}</td>
                              
                              {/* New Patients Input */}
                              <td className="px-3 py-1.5 text-center">
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  min="0"
                                  value={newVal || ""}
                                  placeholder="0"
                                  onChange={(e) => handleBulkCellChange(disease.id, disease.name, "new", Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-center font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                                />
                              </td>

                              {/* Old Patients Input */}
                              <td className="px-3 py-1.5 text-center">
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  min="0"
                                  value={oldVal || ""}
                                  placeholder="0"
                                  onChange={(e) => handleBulkCellChange(disease.id, disease.name, "old", Number(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-center font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                                />
                              </td>

                              {/* Total Patients (Computed Readonly) */}
                              <td className="px-3 py-1.5 text-center">
                                <input
                                  type="number"
                                  readOnly={true}
                                  disabled={true}
                                  value={totalVal}
                                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-center font-extrabold text-amber-900 cursor-not-allowed shadow-inner"
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Reactive Totals Header Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700">
                    <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
                      Recorded Diseases: <strong className="text-emerald-700 font-mono">{diseaseLogs.length}</strong>
                    </span>
                    <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
                      Total New OPD: <strong className="text-emerald-700 font-mono">{totalNewOPD}</strong>
                    </span>
                    <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
                      Total Old OPD: <strong className="text-amber-800 font-mono">{totalOldOPD}</strong>
                    </span>
                    <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
                      Grand Total OPD: <strong className="text-indigo-800 font-mono">{grandTotalOPD}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLocked || diseaseLogs.length === 0}
                      onClick={() => setDiseaseLogs([])}
                      aria-label="Clear all disease log entries"
                      className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg transition-all disabled:opacity-40"
                    >
                      Clear Registry
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. BOTTOM SECTION: CUMULATIVE DAILY GENDER DISTRIBUTION */}
              <div className={`${ct.subSectionBg} border rounded-2xl p-5 shadow-xs space-y-4 mt-6`} id="cumulative-gender-distribution-section">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <UserCheck className="w-4.5 h-4.5 text-emerald-600" />
                      2. Cumulative Daily Gender Distribution (कुल लिंगवार विवरण)
                    </h5>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Overall daily gender breakdown. Male counts entered here; Female counts auto-calculated from disease totals above.
                    </span>
                  </div>
                  <div className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-extrabold text-xs px-3 py-1 rounded-full shadow-3xs text-center font-mono">
                    Grand Total: {grandTotalOPD} Patients
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* ROW 1 / CARD 1: NEW PATIENTS OVERALL */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Row 1: New Patients Overall (नवीन रोगी)
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                        Total New: {totalNewOPD}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Total New (Readonly Auto-summed from top section) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Total New (Auto)</label>
                        <input
                          type="number"
                          readOnly={true}
                          disabled={true}
                          value={totalNewOPD}
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-center font-extrabold text-slate-800 cursor-not-allowed shadow-inner"
                        />
                      </div>

                      {/* Male New Patients (Number Input) */}
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Male New (पुरुष)*</label>
                        <input
                          type="number"
                          disabled={isLocked || totalNewOPD === 0}
                          min="0"
                          max={totalNewOPD}
                          value={matrix.opd_male_new || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            handleMatrixChange("opd_male_new", val);
                          }}
                          className={`w-full border rounded-lg px-2.5 py-1.5 text-xs text-center font-bold outline-none transition-all ${
                            (matrix.opd_male_new || 0) > totalNewOPD && totalNewOPD > 0
                              ? "bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-300 animate-pulse font-black"
                              : "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          }`}
                        />
                      </div>

                      {/* Female New Patients (Readonly Auto-computed) */}
                      <div>
                        <label className="block text-[10px] font-bold text-pink-700 mb-1">Female New (Auto)</label>
                        <input
                          type="number"
                          readOnly={true}
                          disabled={true}
                          value={Math.max(0, totalNewOPD - (matrix.opd_male_new || 0))}
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-center font-extrabold text-pink-900 cursor-not-allowed shadow-inner"
                        />
                      </div>
                    </div>

                    {(matrix.opd_male_new || 0) > totalNewOPD && totalNewOPD > 0 && (
                      <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 p-1.5 rounded-md border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Male New Patients ({matrix.opd_male_new}) cannot exceed Total New Patients ({totalNewOPD})!
                      </p>
                    )}
                  </div>

                  {/* ROW 2 / CARD 2: OLD PATIENTS OVERALL */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Row 2: Old Patients Overall (प्राचीन रोगी)
                      </span>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
                        Total Old: {totalOldOPD}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Total Old (Readonly Auto-summed from top section) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Total Old (Auto)</label>
                        <input
                          type="number"
                          readOnly={true}
                          disabled={true}
                          value={totalOldOPD}
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-center font-extrabold text-slate-800 cursor-not-allowed shadow-inner"
                        />
                      </div>

                      {/* Male Old Patients (Number Input) */}
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Male Old (पुरुष)*</label>
                        <input
                          type="number"
                          disabled={isLocked || totalOldOPD === 0}
                          min="0"
                          max={totalOldOPD}
                          value={matrix.opd_male_old || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            handleMatrixChange("opd_male_old", val);
                          }}
                          className={`w-full border rounded-lg px-2.5 py-1.5 text-xs text-center font-bold outline-none transition-all ${
                            (matrix.opd_male_old || 0) > totalOldOPD && totalOldOPD > 0
                              ? "bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-300 animate-pulse font-black"
                              : "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          }`}
                        />
                      </div>

                      {/* Female Old Patients (Readonly Auto-computed) */}
                      <div>
                        <label className="block text-[10px] font-bold text-pink-700 mb-1">Female Old (Auto)</label>
                        <input
                          type="number"
                          readOnly={true}
                          disabled={true}
                          value={Math.max(0, totalOldOPD - (matrix.opd_male_old || 0))}
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-center font-extrabold text-pink-900 cursor-not-allowed shadow-inner"
                        />
                      </div>
                    </div>

                    {(matrix.opd_male_old || 0) > totalOldOPD && totalOldOPD > 0 && (
                      <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 p-1.5 rounded-md border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Male Old Patients ({matrix.opd_male_old}) cannot exceed Total Old Patients ({totalOldOPD})!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            
          {/* IPD Admissions Breakdown */}



            {(hasIpd || hasPanchkarma) && (
              <div className={`grid grid-cols-1 gap-6 border-t ${ct.cardBorder} pt-4`}>
                {hasIpd && (
                  <div className={`bg-white border ${ct.cardBorder} rounded-xl p-4 shadow-xs`}>
                    <span className={`text-xs font-bold ${ct.subHeader} uppercase tracking-wider block mb-3 -ml-[14px]`}>IPD Entry</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" id="ipd-subfields-grid">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Male (New)</label>
                        <input
                          id="ipd-male-new-input"
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={matrix.ipd_male_new || 0}
                          onChange={(e) => handleMatrixChange("ipd_male_new", Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Male (Old)</label>
                        <input
                          id="ipd-male-old-input"
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={matrix.ipd_male_old || 0}
                          onChange={(e) => handleMatrixChange("ipd_male_old", Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Female (New)</label>
                        <input
                          id="ipd-female-new-input"
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={matrix.ipd_female_new || 0}
                          onChange={(e) => handleMatrixChange("ipd_female_new", Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Female (Old)</label>
                        <input
                          id="ipd-female-old-input"
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={matrix.ipd_female_old || 0}
                          onChange={(e) => handleMatrixChange("ipd_female_old", Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-4 mt-2">
                        <label className="block text-xs font-semibold text-amber-800 mb-1">Total Indore Patients</label>
                        <input
                          id="ipd-computed-total-admissions"
                          type="number"
                          readOnly={true}
                          value={matrix.ipd_admissions || 0}
                          className={`w-full ${ct.computedBg} border rounded-lg px-3 py-1.5 text-sm font-bold text-center cursor-not-allowed shadow-sm focus:outline-none`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {hasPanchkarma && (
                  <div className={`bg-white border ${ct.cardBorder} rounded-xl p-4 shadow-xs`}>
                    <span className={`text-xs font-bold ${ct.subHeader} uppercase tracking-wider block mb-3 -ml-[14px]`}>Number of Panchkarma Beneficiary</span>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Male</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={matrix.panchkarma_male}
                          onChange={(e) => handleMatrixChange("panchkarma_male", Number(e.target.value))}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Female</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={matrix.panchkarma_female}
                          onChange={(e) => handleMatrixChange("panchkarma_female", Number(e.target.value))}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none font-medium"
                        />
                      </div>
                      <div className="col-span-2 mt-2">
                        <span className="block text-xs font-semibold text-amber-850 mb-1">Total Panchkarma Patients</span>
                        <input
                          id="panchkarma-computed-total"
                          type="number"
                          readOnly={true}
                          value={Number(matrix.panchkarma_male || 0) + Number(matrix.panchkarma_female || 0)}
                          className={`w-full ${ct.computedBg} border rounded-lg px-3 py-1.5 text-sm font-bold text-center cursor-not-allowed shadow-sm focus:outline-none`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Seeded and Govt Metrics */}
          <div className={`border-t ${ct.cardBorder} pt-4 ${ct.subSectionBg} p-5 rounded-xl space-y-3`} id="govt-metrics-container">
            {/* Top Row: Aadhaar & Mobile Seeded Merged Panel */}
            <div className={`bg-white border ${ct.cardBorder} p-4 rounded-xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between`} id="govt-seeded-metrics-panel">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 md:border-none md:pb-0">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">OPD Digitization Metrics:</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center justify-between gap-3 bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 sm:p-1.5 shadow-3xs w-full sm:w-auto transition-all duration-200">
                  <label className="text-[11px] font-bold text-slate-600">Aadhaar Seeded:</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    min="0"
                    value={matrix.aadhaar_seeded_count}
                    onChange={(e) => handleMatrixChange("aadhaar_seeded_count", Number(e.target.value))}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-center"
                    id="aadhaar-seeded-count-input"
                  />
                </div>
                <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
                <div className="flex items-center justify-between gap-3 bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 sm:p-1.5 shadow-3xs w-full sm:w-auto transition-all duration-200">
                  <label className="text-[11px] font-bold text-slate-600">Mobile Seeded:</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    min="0"
                    value={matrix.mobile_seeded_count}
                    onChange={(e) => handleMatrixChange("mobile_seeded_count", Number(e.target.value))}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-center"
                    id="mobile-seeded-count-input"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Section: Government Levy Collected Breakdown */}
            <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs`} id="levy-breakdown-panel">
              <span className={`text-xs font-bold ${ct.subHeader} uppercase tracking-wider block border-b ${ct.cardBorder} pb-2.5`}>
                Levy Collected
              </span>

              <div className="flex flex-col gap-3">
                {/* 1. OPD Levy (Dynamic) */}
                <div className={`${ct.accentBg}/10 hover:${ct.accentBg}/20 border ${ct.cardBorder} p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${ct.badgeBg} border flex items-center justify-center font-bold text-xs shrink-0`}>
                      OPD
                    </div>
                    <div>
                      <span className={`text-xs font-bold ${ct.subHeader} block`}>Levy from OPD</span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        {totalNewOPD} New OPD × ₹{opdLevyRate}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 pt-2 sm:pt-0 sm:border-0">
                    <span className="text-[10px] text-slate-400 sm:hidden block">Amount</span>
                    <div className={`text-base font-extrabold ${ct.headerText} font-mono`}>
                      ₹{opdLevy}
                    </div>
                  </div>
                </div>

                {/* 2. IPD Levy (Dynamic) */}
                {hasIpd && (
                  <div className={`${ct.accentBg}/10 hover:${ct.accentBg}/20 border ${ct.cardBorder} p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${ct.badgeBg} border flex items-center justify-center font-bold text-xs shrink-0`}>
                        IPD
                      </div>
                      <div>
                        <span className={`text-xs font-bold ${ct.subHeader} block`}>Levy from IPD</span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          {totalNewIPD} New IPD × ₹{ipdLevyRate}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 pt-2 sm:pt-0 sm:border-0">
                      <span className="text-[10px] text-slate-400 sm:hidden block">Amount</span>
                      <div className={`text-base font-extrabold ${ct.headerText} font-mono`}>
                        ₹{ipdLevy}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Panchkarma Levy (Manual Input) */}
                {hasPanchkarma && (
                  <div className={`${ct.accentBg}/10 hover:${ct.accentBg}/20 border ${ct.cardBorder} p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${ct.badgeBg} border flex items-center justify-center font-bold text-xs shrink-0`}>
                        PK
                      </div>
                      <div>
                        <span className={`text-xs font-bold ${ct.subHeader} block`}>Panchkarma Levy</span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Manual procedure levy
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 pt-2 sm:pt-0 sm:border-0">
                      <span className="text-[10px] text-slate-400 sm:hidden block">Enter Levy</span>
                      <div className="relative w-full sm:w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">₹</span>
                        <input
                          type="number"
                          disabled={isLocked}
                          min="0"
                          value={panchkarmaLevy || ""}
                          onChange={(e) => setPanchkarmaLevy(Math.max(0, Number(e.target.value)))}
                          className="w-full bg-white border border-slate-200 focus:border-current focus:ring-2 focus:ring-current/15 rounded-lg pl-6 pr-2.5 py-1 text-xs font-bold text-slate-800 outline-none transition-all duration-150 font-mono text-right"
                          placeholder="0"
                          id="panchkarma-levy-input"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Other Levy (Manual Input) */}
                <div className={`${ct.accentBg}/10 hover:${ct.accentBg}/20 border ${ct.cardBorder} p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${ct.badgeBg} border flex items-center justify-center font-bold text-xs shrink-0`}>
                      OT
                    </div>
                    <div>
                      <span className={`text-xs font-bold ${ct.subHeader} block`}>Other Levy</span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        Other miscellaneous levy
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 pt-2 sm:pt-0 sm:border-0">
                    <span className="text-[10px] text-slate-400 sm:hidden block">Enter Levy</span>
                    <div className="relative w-full sm:w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">₹</span>
                      <input
                        type="number"
                        disabled={isLocked}
                        min="0"
                        value={otherLevy || ""}
                        onChange={(e) => setOtherLevy(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-200 focus:border-current focus:ring-2 focus:ring-current/15 rounded-lg pl-6 pr-2.5 py-1 text-xs font-bold text-slate-800 outline-none transition-all duration-150 font-mono text-right"
                        placeholder="0"
                        id="other-levy-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Display Block */}
              <div className={`flex flex-col items-center justify-center text-center gap-2 ${ct.totalDisplayBg} rounded-2xl p-6 shadow-sm mt-4 border`} id="total-levy-display-block">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${ct.totalDisplaySub} block mb-1`}>
                  TOTAL COLLECTED LEVY
                </span>
                <div className="bg-amber-400 text-emerald-950 text-2xl font-black font-mono px-6 py-2.5 rounded-xl shadow-md border border-amber-300 flex items-center justify-center" id="main-total-levy-div">
                  ₹{matrix.levy_charges}
                </div>
                <span className={`text-[10px] ${ct.totalDisplaySub}/80 font-mono block`}>
                  ({opdLevy}{hasIpd ? ` + ${ipdLevy}` : ""}{hasPanchkarma ? ` + ${panchkarmaLevy}` : ""}{` + ${otherLevy}`})
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>

        {/* Lab Investigations & Test Kits Tracker */}
        <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
          <div 
            onClick={() => setIsSection2Open(!isSection2Open)}
            className={`flex items-center justify-between border-b ${ct.cardBorder} pb-3 cursor-pointer select-none group`}
          >
            <h4 className="font-semibold text-[#3c0e49] flex items-center gap-2 text-[12px]">
              <ClipboardCheck className={`w-5 h-5 ${ct.headerIcon}`} />
              Lab Test Entry
            </h4>
            <div className="flex items-center gap-3">
              {!isSection2Open && (
                <span className="text-[11px] font-semibold text-slate-500 font-sans tracking-wide select-none">
                  {getEntryLabel(selectedDate)}
                </span>
              )}
              {isSection2Open ? (
                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              )}
            </div>
          </div>

          {isSection2Open && (
            <div className="space-y-6">
              {/* Part A: Lab Test Log Entry */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <span className={`w-2 h-2 rounded-full ${ct.headerIcon} bg-current`}></span>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">A. Lab Test Log Entry</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Hemoglobin (Hb)</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.hemoglobin}
                      onChange={(e) => handleLabChange("hemoglobin", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Blood Sugar</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.blood_sugar}
                      onChange={(e) => handleLabChange("blood_sugar", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Urine Sugar</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.urine_sugar}
                      onChange={(e) => handleLabChange("urine_sugar", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Urine Albumin</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.urine_albumin}
                      onChange={(e) => handleLabChange("urine_albumin", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Malaria RDT</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.malaria}
                      onChange={(e) => handleLabChange("malaria", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Dengue Rapid</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.dengue}
                      onChange={(e) => handleLabChange("dengue", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Typhoid</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.typhoid}
                      onChange={(e) => handleLabChange("typhoid", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Pregnancy Test (UPT)</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.pregnancy_tests}
                      onChange={(e) => handleLabChange("pregnancy_tests", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Hepatitis A</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.hepatitis_a}
                      onChange={(e) => handleLabChange("hepatitis_a", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Hepatitis B</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.hepatitis_b}
                      onChange={(e) => handleLabChange("hepatitis_b", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Hepatitis C</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      min="0"
                      value={lab.hepatitis_c}
                      onChange={(e) => handleLabChange("hepatitis_c", Number(e.target.value))}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Part B: Test Kits Tracker */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ct.headerIcon} bg-current`}></span>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">B. Test Kits Tracker</span>
                  </div>
                  <div className="flex gap-2.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => toggleAllKits(true)}
                      className={`${ct.accentText} font-bold hover:underline transition-all cursor-pointer`}
                    >
                      Expand All
                    </button>
                    <span className="text-slate-200">|</span>
                    <button
                      type="button"
                      onClick={() => toggleAllKits(false)}
                      className="text-slate-400 hover:text-slate-600 font-medium hover:underline transition-all cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Audit Notice for Opening Balance */}
                {!(selectedDate.split("-")[1] === "04") && !alwaysAllowInventoryEdit && (
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-800 flex items-start gap-2 shadow-3xs">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-normal font-medium">
                      Opening balances are locked outside of <strong>April</strong>. You can override this in <strong>Facility Settings</strong>.
                    </p>
                  </div>
                )}

                {/* Responsive Collapsible List */}
                <div className="space-y-3" id="test-kits-collapsible-container">
                  {inventory.map((inv, idx) => {
                    const isLow = inv.closing_balance <= inv.low_stock_threshold;
                    const cleanName = cleanKitName(inv.kit_type);
                    const isExpanded = !!expandedKits[inv.kit_type];

                    const isApril = selectedDate.split("-")[1] === "04";
                    const canEditOpeningBalance = isApril || alwaysAllowInventoryEdit;

                    return (
                      <div
                        key={inv.kit_type || idx}
                        className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                          isExpanded 
                            ? "border-current bg-current/5 shadow-3xs" 
                            : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-3xs"
                        }`}
                      >
                        {/* Accordion Trigger Header */}
                        <div
                          onClick={() => toggleKitExpanded(inv.kit_type)}
                          className="w-full flex flex-row items-center justify-between p-3.5 cursor-pointer select-none gap-3"
                        >
                          {/* Left: Name & Unit badge */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs tracking-tight">{cleanName}</span>
                            <span className="text-[9px] bg-slate-50 text-slate-500 font-medium px-1.5 py-0.5 rounded border border-slate-100">
                              {(inv as any).unit || "Kits"}
                            </span>
                          </div>

                          {/* Right side information (status at a glance) */}
                          <div className="flex items-center gap-3">
                            {/* Closing Balance badge */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-medium">Closing:</span>
                              <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${
                                isLow 
                                  ? "bg-rose-50 text-rose-700 border-rose-100" 
                                  : `${ct.badgeBg} ${ct.accentText}`
                              }`}>
                                {inv.closing_balance}
                              </span>
                            </div>

                            {/* Status Alert Badge */}
                            {isLow && (
                              <span className="text-[9px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-100 animate-pulse">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                                Low Stock
                              </span>
                            )}

                            {/* Chevron Icon */}
                            {isExpanded ? (
                              <ChevronUp className={`w-4 h-4 ${ct.accentText} shrink-0`} />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Collapsible Content Section */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/10 p-3.5 space-y-3">
                            {/* Responsive grid for inputs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                              {/* Opening Balance */}
                              <div className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-3xs flex flex-col justify-between">
                                <span className="text-[10px] font-medium text-slate-400 block mb-1">Opening</span>
                                <input
                                  type="number"
                                  disabled={isLocked || !canEditOpeningBalance}
                                  min="0"
                                  value={inv.opening_balance}
                                  onChange={(e) => handleInventoryChange(idx, "opening_balance", Number(e.target.value))}
                                  className={`w-full border rounded-md px-2 py-1 text-xs font-bold text-center outline-none transition-all ${
                                    !canEditOpeningBalance 
                                      ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                                      : "bg-slate-50/50 border-slate-100 text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current"
                                  }`}
                                />
                              </div>

                              {/* Received Qty */}
                              <div className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-3xs flex flex-col justify-between">
                                <span className="text-[10px] font-medium text-slate-400 block mb-1">Received</span>
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  min="0"
                                  value={inv.received_qty}
                                  onChange={(e) => handleInventoryChange(idx, "received_qty", Number(e.target.value))}
                                  className="w-full bg-slate-50/50 border border-slate-100 rounded-md px-2 py-1 text-xs font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-current/15 focus:border-current transition-all"
                                />
                              </div>

                              {/* Used Qty (Auto calculated) */}
                              <div className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-3xs flex flex-col justify-between">
                                <span className="text-[10px] font-medium text-slate-400 block mb-1">Used (Auto)</span>
                                <input
                                  type="number"
                                  readOnly={true}
                                  value={inv.used_qty}
                                  className={`w-full ${ct.computedBg} border rounded-md px-2 py-1 text-xs text-center cursor-not-allowed outline-none font-bold`}
                                />
                              </div>

                              {/* Defective Qty */}
                              <div className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-3xs flex flex-col justify-between">
                                <span className="text-[10px] font-medium text-slate-400 block mb-1">Defective</span>
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  min="0"
                                  value={inv.defective_qty}
                                  onChange={(e) => handleInventoryChange(idx, "defective_qty", Number(e.target.value))}
                                  className="w-full bg-slate-50/50 border border-slate-200 rounded-md px-2 py-1 text-xs font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-current/15 focus:border-current transition-all"
                                />
                              </div>
                            </div>

                            {/* Footer info showing threshold & formula config */}
                            <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-100/60">
                              <span>Open + Rec - Used - Def = Closing</span>
                              <span>Low stock threshold: <strong>{inv.low_stock_threshold}</strong></span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Outreach Camps */}
        <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
          <div 
            onClick={() => setIsSection4Open(!isSection4Open)}
            className={`flex items-center justify-between border-b ${ct.cardBorder} pb-3 cursor-pointer select-none group`}
          >
            <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-[12px] text-left">
              <Sparkles className={`w-5 h-5 ${ct.headerIcon}`} />
              Camp Entry
            </h4>
            <div className="flex items-center gap-3">
              {!isSection4Open && (
                <span className="text-[11px] font-semibold text-slate-500 font-sans tracking-wide select-none">
                  {getEntryLabel(selectedDate)}
                </span>
              )}
              {isSection4Open ? (
                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              )}
            </div>
          </div>

          {isSection4Open && (
            <>

          {/* Active Camps List */}
          {camps.length > 0 ? (
            <div className="space-y-2">
              {camps.map((camp, idx) => (
                <div key={idx} className={`${ct.subSectionBg} border ${ct.cardBorder} rounded-xl p-3 flex items-center justify-between text-xs`}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                    <div>
                      <span className="text-slate-400 block font-medium uppercase tracking-wider text-[10px]">Village Location</span>
                      <span className="font-semibold text-slate-700">{camp.village_location}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium uppercase tracking-wider text-[10px]">Beneficiaries</span>
                      <span className="font-semibold text-slate-700">{camp.beneficiaries_total} (M:{camp.beneficiaries_male} F:{camp.beneficiaries_female} C:{camp.beneficiaries_child || 0})</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400 block font-medium uppercase tracking-wider text-[10px]">Remarks (NCD / General टिप्पणी)</span>
                      <span className="font-semibold text-slate-700">{camp.ncd_screenings || "N/A"}</span>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => removeCamp(idx)}
                      className="text-rose-600 hover:bg-rose-50 p-1 rounded-lg ml-2 transition-colors font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-xs text-slate-400 italic ${ct.subSectionBg} py-3 text-center rounded-xl`}>No outreach camps recorded for this date yet.</p>
          )}

          {/* Add Camp Sub-Form */}
          {!isReadOnly && (
            <div className={`border ${ct.cardBorder} rounded-xl p-4 ${ct.subSectionBg} space-y-4`}>
              <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className={`w-4 h-4 ${ct.accentText}`} />
                Record Outreach Health Camp details
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">Village/Camp Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Jhankat Village"
                    value={newCamp.village_location}
                    onChange={(e) => setNewCamp(prev => ({ ...prev, village_location: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">Camp Remarks (NCD / General टिप्पणी)</label>
                  <input
                    type="text"
                    placeholder="e.g. Conducted successfully, 35 screened for hypertension"
                    value={newCamp.ncd_screenings}
                    onChange={(e) => setNewCamp(prev => ({ ...prev, ncd_screenings: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">Male Beneficiaries</label>
                  <input
                    type="number"
                    min="0"
                    value={newCamp.beneficiaries_male}
                    onChange={(e) => setNewCamp(prev => ({ ...prev, beneficiaries_male: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">Female Beneficiaries</label>
                  <input
                    type="number"
                    min="0"
                    value={newCamp.beneficiaries_female}
                    onChange={(e) => setNewCamp(prev => ({ ...prev, beneficiaries_female: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">Child Beneficiaries</label>
                  <input
                    type="number"
                    min="0"
                    value={newCamp.beneficiaries_child}
                    onChange={(e) => setNewCamp(prev => ({ ...prev, beneficiaries_child: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">Total Beneficiaries</label>
                  <input
                    type="number"
                    disabled
                    value={newCamp.beneficiaries_total}
                    className={`w-full ${ct.computedBg} border rounded-lg px-3 py-1.5 text-xs outline-none text-center font-bold`}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={addCamp}
                  className={`w-full md:w-auto ${ct.buttonBg} text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5`}
                >
                  <Plus className="w-4 h-4" />
                  Add Camp entry to Daily Log
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Custom Parameters Sections */}
        {customFields.length > 0 && (
          <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
            <div 
              onClick={() => setIsSection5Open(!isSection5Open)}
              className={`flex items-center justify-between border-b ${ct.cardBorder} pb-3 cursor-pointer select-none group`}
            >
              <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-[10px]">
                <FileSpreadsheet className={`w-5 h-5 ${ct.headerIcon}`} />
                4. Additional Required Parameters (अतिरिक्त वांछित जानकारी)
              </h4>
              <div className="flex items-center gap-3">
                {!isSection5Open && (
                  <span className="text-xs font-semibold text-slate-500 font-sans tracking-wide select-none">
                    {getEntryLabel(selectedDate)}
                  </span>
                )}
                <span className={`text-xs font-semibold ${ct.accentText} ${ct.badgeBg} px-2.5 py-1 rounded-full uppercase border border-emerald-100 hidden sm:inline-block`}>
                  Custom Template Fields
                </span>
                {isSection5Open ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                )}
              </div>
            </div>

            {isSection5Open && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1 text-xs font-bold text-slate-700">
                    <label className="block text-slate-600">
                      {field.name}
                      <span className="text-slate-400 font-mono text-[9px] ml-1.5 uppercase">({field.category})</span>
                    </label>
                    {field.type === "number" ? (
                      <input
                        type="number"
                        disabled={isLocked}
                        min="0"
                        value={customFieldsData[field.id] !== undefined ? String(customFieldsData[field.id]) : ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                          setCustomFieldsData(prev => ({ ...prev, [field.id]: val }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-current/15 focus:border-current outline-none disabled:opacity-60"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled={isLocked}
                        value={customFieldsData[field.id] !== undefined ? String(customFieldsData[field.id]) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomFieldsData(prev => ({ ...prev, [field.id]: val }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-current/15 focus:border-current outline-none disabled:opacity-60"
                        placeholder="Enter information detail..."
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submission control bar */}
        <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-4 shadow-sm flex flex-col gap-3`}>
          {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.DAUO) ? (
            <div className="text-xs text-slate-500 flex items-center justify-center py-1">
              <span className={`flex items-center gap-1 ${ct.accentText} font-medium`}>
                <AlertOctagon className="w-4 h-4 text-current" />
                Administrative View: Introspecting submitted records. Editing is disabled.
              </span>
            </div>
          ) : isLocked ? (
            <div className="text-xs text-slate-500 flex items-center justify-center py-1">
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <AlertOctagon className="w-4 h-4 text-amber-500" />
                This entry is finalized & locked by administrative rules.
              </span>
            </div>
          ) : null}

          {!isReadOnly && (
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${ct.buttonBg} text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md shadow-current/15 hover:shadow-current/25 transition-all flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  Submit Daily Log
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {/* SMART ANOMALY DETECTION "ARE YOU SURE" WARNING DIALOG */}
      {anomalyModal && anomalyModal.show && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 text-amber-700 p-2 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-800">Smart Anomaly Verification Warning</h4>
                <p className="text-xs text-slate-500">
                  Our system has detected numbers that deviate significantly from your hospital's historical average. Please verify these entries before continuing.
                </p>
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-2.5 text-xs max-h-48 overflow-y-auto">
              {anomalyModal.anomalies.map((anom, i) => (
                <div key={i} className="flex items-start justify-between border-b border-amber-100/50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-semibold text-slate-700">{anom.label}</span>
                    <span className="text-[10px] text-amber-700 block">{anom.reason}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-rose-600 font-bold block">{anom.entered} entered</span>
                    <span className="text-[10px] text-slate-400 block">Avg: {anom.avg}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setAnomalyModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Go Back & Fix Fields
              </button>
              <button
                type="button"
                onClick={proceedWithAnomaly}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Yes, Confirm Anomaly & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SOFT WARNING INPUT CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div id="custom-confirm-modal-overlay" className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="custom-confirm-modal" className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-extrabold text-slate-800">Verify Daily Log Entry Summary</h4>
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Please review the primary outpatient and inpatient distribution counts for <span className="font-bold text-slate-700 font-mono">{selectedDate}</span> before finalizing the submission.
                </p>
              </div>
            </div>

            {/* Metrics Checklist Card */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4.5 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Key Metrics Reconciliation</span>
              
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[9px] font-semibold text-slate-500 block uppercase tracking-tight">New Male</span>
                  <span className="text-xs font-extrabold text-slate-800">{matrix.opd_male_new || 0}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[9px] font-semibold text-slate-500 block uppercase tracking-tight">New Female</span>
                  <span className="text-xs font-extrabold text-slate-800">{matrix.opd_female_new || 0}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[9px] font-semibold text-slate-500 block uppercase tracking-tight">Old Male</span>
                  <span className="text-xs font-extrabold text-slate-800">{matrix.opd_male_old || 0}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[9px] font-semibold text-slate-500 block uppercase tracking-tight">Old Female</span>
                  <span className="text-xs font-extrabold text-slate-800">{matrix.opd_female_old || 0}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 flex justify-between items-center">
                  <span className="font-bold text-emerald-800 text-[11px]">Total Male:</span>
                  <span className="text-xs font-black text-emerald-900 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    {Number(matrix.opd_male_new || 0) + Number(matrix.opd_male_old || 0)}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 flex justify-between items-center">
                  <span className="font-bold text-emerald-800 text-[11px]">Total Female:</span>
                  <span className="text-xs font-black text-emerald-900 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    {Number(matrix.opd_female_new || 0) + Number(matrix.opd_female_old || 0)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-500 font-medium text-[11px]">Computed Admissions:</span>
                  <span className="font-bold text-slate-800 text-xs">{matrix.ipd_admissions || 0}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-500 font-medium text-[11px]">Total Panchkarma:</span>
                  <span className="font-bold text-slate-800 text-xs">{Number(matrix.panchkarma_male || 0) + Number(matrix.panchkarma_female || 0)}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex gap-2.5 items-start">
              <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 leading-relaxed font-medium">
                <strong>Attention Required:</strong> Double check that the number of male and female patients matches your physical register counts. Submission will lock this date for editing unless administrative permission is granted.
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end border-t border-slate-100 pt-3">
              <button
                id="cancel-submit-modal-btn"
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Go Back & Edit
              </button>
              <button
                id="confirm-submit-modal-btn"
                type="button"
                onClick={handleConfirmAndSubmit}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md hover:shadow-emerald-600/10 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SUCCESS CONFIRMATION MODAL */}
      {showSuccessModal && successReportSummary && (
        <div id="custom-success-modal-overlay" className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="custom-success-modal" className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-250">
            <div className="mx-auto bg-emerald-100 text-emerald-600 p-3.5 rounded-full w-14 h-14 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-extrabold text-slate-900">Daily Log Submitted Successfully!</h4>
              <p className="text-xs text-slate-500 font-medium">
                दैनिक रिपोर्ट सफलतापूर्वक सर्वर पर सबमिट कर दी गई है।
              </p>
            </div>

            {/* Receipt Summary Details */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-left divide-y divide-slate-200/60 text-xs">
              <div className="pb-2.5 flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Submission Date:</span>
                <span className="font-mono font-bold text-slate-700">{successReportSummary.date}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Total OPD Registrations:</span>
                <span className="font-bold text-slate-800">{successReportSummary.totalOPD} patients</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Lab Tests Conducted:</span>
                <span className="font-bold text-slate-800">{successReportSummary.totalTests} tests</span>
              </div>
              <div className="pt-2.5 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Government Levy Collected:</span>
                <span className="font-bold text-emerald-700">₹{successReportSummary.levyCharges}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-snug">
              Note: This log is logged as locked. Administrative roles can lock, edit or run automated checks on this record.
            </p>

            <button
              id="close-success-modal-btn"
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 rounded-xl transition-colors shadow-md shadow-slate-950/10"
            >
              Great, Continue
            </button>
          </div>
        </div>
      )}

      {/* FUTURE DATE LOCKOUT ALERT MODAL */}
      {showFutureDateModal && (
        <div id="future-date-modal-overlay" className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="future-date-modal" className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-base font-extrabold text-slate-800">Advanced Entry Prohibited</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Daily entry logging is only permitted for the current and backlogged dates. Advanced entries are not permitted.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-600 leading-normal">
                You can browse future dates to view scheduled records, but adding or editing metrics is locked.
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowFutureDateModal(false);
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, '0');
                  const day = String(today.getDate()).padStart(2, '0');
                  setSelectedDate(`${year}-${month}-${day}`);
                }}
                className={`px-4.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-950 rounded-xl shadow-md transition-all duration-200`}
              >
                Go to Today's Date
              </button>
              <button
                type="button"
                onClick={() => setShowFutureDateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Just View Calendar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
