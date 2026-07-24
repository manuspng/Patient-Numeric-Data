/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { createFirebaseUser } from "../firebase";
import { getComponentTheme } from "../utils/theme";
import ReportDesigner from "./ReportDesigner";
import { 
  Plus, 
  Trash2, 
  Upload, 
  ShieldCheck, 
  UserPlus, 
  Users, 
  ToggleLeft, 
  ToggleRight, 
  History, 
  Loader2, 
  FileSpreadsheet,
  Settings,
  Sparkles,
  Search,
  CheckCircle,
  FileUp,
  Award,
  BookmarkCheck,
  UserCheck,
  UserX,
  Clock,
  Database,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Zap
} from "lucide-react";
import { UserRole, UserProfile, Hospital } from "../types";

interface AdminMasterTablesProps {
  user: UserProfile;
  onSuccessToast: (receipt: { title: string; content: string }) => void;
}

const locationToEnglish: Record<string, string> = {
  "बाजपुर": "bajpur",
  "बन्नाखेड़ा": "bannakhera",
  "बरा": "bara",
  "बेरिया दौलतपुर": "beriadaulatpur",
  "भिटौरा": "bhitaura",
  "बिडौरा": "bidaura",
  "चकरपुर": "chakarpur",
  "ढकिया": "dhakiya",
  "धनौरी": "dhanauri",
  "दिनेशपुर": "dineshpur",
  "दिउरी": "diuri",
  "गदरपुर": "gadarpur",
  "गूलरभोज": "gularbhoj",
  "हरिपुरा हसन": "haripurahasan",
  "जसपुर": "jaspur",
  "झनकट": "jhankat",
  "रुद्रपुर": "rudrapur",
  "केलाखेड़ा": "kelakhera",
  "खानपुर पश्चिम": "khanpurpaschim",
  "खटीमा": "khatima",
  "किच्छा": "kichha",
  "लालपुर": "lalpur",
  "महुआ डबरा": "mahuadabra",
  "महुआ खेड़ा गंज": "mahuakheraganj",
  "मैनाजुंडी": "mainajundi",
  "मझोला": "majhola",
  "मसीत": "masit",
  "मोहनपुर": "mohanpur",
  "नादेही": "nadehi",
  "नागलतराई": "nagaltarai",
  "नगर रुद्रपुर": "nagarrudrapur",
  "नारायणपुर": "narayanpur",
  "परमानदपुर": "parmanandpur",
  "पतरामपुर": "patrampur",
  "प्रतापपुर": "pratappur",
  "राम नगर वन": "ramnagarwan",
  "शक्ति फ़ार्म": "shaktifarm",
  "सितारगंज": "sitarganj",
  "स्केनिया": "skenia",
  "श्रीपुर बिचवा": "shripurbichwa",
  "सुल्तानपुर पट्टी": "sultanpurpatti"
};

const getDesignatedEmailForLocation = (loc: string): string => {
  if (!loc) return "";
  const cleaned = loc.trim();
  const english = locationToEnglish[cleaned];
  if (english) {
    return `${english}.ayush@gov.in`;
  }
  const fallback = cleaned.toLowerCase().replace(/[^a-zA-Z]/g, "") || "hospital";
  return `${fallback}.ayush@gov.in`;
};

const getLocationAbbreviation = (loc: string): string => {
  if (!loc) return "HSP";
  const cleaned = loc.trim();
  if (cleaned === "झनकट") return "JHK";
  if (cleaned === "खटीमा") return "KHT";
  if (cleaned === "टनकपुर") return "TNK";
  if (cleaned === "बनबसा") return "BBS";
  if (cleaned === "सितारगंज") return "STG";
  if (cleaned === "रुद्रपुर") return "RDP";
  if (cleaned === "गदरपुर") return "GDR";
  if (cleaned === "जसपुर") return "JSP";
  if (cleaned === "काशीपुर") return "KSP";
  if (cleaned === "बाजपुर") return "BJP";
  if (cleaned === "किच्छा") return "KCH";

  const eng = locationToEnglish[cleaned] || cleaned.toLowerCase().replace(/[^a-z]/g, "");
  if (!eng) return "HSP";
  return eng.substring(0, 3).toUpperCase();
};

const getFacilityTypeAbbreviation = (typeStr: string): string => {
  if (!typeStr) return "SAD";
  const clean = typeStr.trim();
  const lower = clean.toLowerCase();

  if (lower.includes("ayurvedic") || lower.includes("ayur") || lower.includes("चिकित्सालय") || lower.includes("dispensary") || lower.includes("sad")) return "SAD";
  if (lower.includes("unani") || lower.includes("यूनानी") || lower.includes("sud")) return "SUD";
  if (lower.includes("wing") || lower.includes("विंग")) return "AYUSH WING";
  if (lower.includes("aarogya") || lower.includes("arogya") || lower.includes("आरोग्य") || lower.includes("aam")) return "AAM";
  if (lower.includes("moch") || lower.includes("m.o.c.h.")) return "MOCH";

  if (clean === "SAD" || clean === "SUD" || clean === "AYUSH WING" || clean === "AAM" || clean === "MOCH") {
    return clean;
  }

  if (/^[A-Za-z\s-]+$/.test(clean) && clean.length <= 15) {
    return clean.toUpperCase();
  }

  return "SAD";
};

export default function AdminMasterTables({ user, onSuccessToast }: AdminMasterTablesProps) {
  const ct = getComponentTheme(user.role);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "hospitals" | "sheets" | "audits">("users");
  const [hospSubMode, setHospSubMode] = useState<"single" | "bulk">("single");
  const [bulkPastedData, setBulkPastedData] = useState("");
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Master lists and configuration state
  const [masterDiseases, setMasterDiseases] = useState<any[]>([]);
  const [masterTests, setMasterTests] = useState<any[]>([]);
  const [configSubTab, setConfigSubTab] = useState<"dropdowns" | "diseases" | "tests">("dropdowns");

  // State for active dropdown list selected inside the "Hospital Dropdowns" sub-tab
  const [selectedDropdownCategory, setSelectedDropdownCategory] = useState<string>("hospitalTypes");

  // Inputs for disease management
  const [newDiseaseName, setNewDiseaseName] = useState("");
  const [newDiseaseCategory, setNewDiseaseCategory] = useState("General");
  const [editingDisease, setEditingDisease] = useState<{ id: string; name: string; category: string } | null>(null);

  // Inputs for test management
  const [newTestName, setNewTestName] = useState("");
  const [newTestNormalRange, setNewTestNormalRange] = useState("");
  const [editingTest, setEditingTest] = useState<{ id: string; name: string; normalRange: string } | null>(null);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const fetchDiseasesAndTests = async () => {
    try {
      const [resDis, resTest] = await Promise.all([
        fetch("/api/master/diseases"),
        fetch("/api/master/tests")
      ]);
      const disData = await resDis.json();
      const testData = await resTest.json();
      setMasterDiseases(disData || []);
      setMasterTests(testData || []);
    } catch (e) {
      console.error("Error fetching diseases and tests:", e);
    }
  };

  const handleAddDisease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiseaseName.trim()) return;
    try {
      const res = await fetch("/api/admin/diseases/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDiseaseName.trim(),
          category: newDiseaseCategory.trim(),
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🦠 Disease Added",
          content: `Added "${newDiseaseName}" to clinical disease vector masters.`
        });
        setNewDiseaseName("");
        await fetchDiseasesAndTests();
      } else {
        alert(data.message || "Failed to add disease");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditDiseaseSave = async () => {
    if (!editingDisease || !editingDisease.name.trim()) return;
    try {
      const res = await fetch("/api/admin/diseases/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDisease.id,
          name: editingDisease.name.trim(),
          category: editingDisease.category.trim(),
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "✏️ Disease Updated",
          content: `Disease updated successfully.`
        });
        setEditingDisease(null);
        await fetchDiseasesAndTests();
      } else {
        alert(data.message || "Failed to update disease");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDisease = async (id: string, name: string) => {
    triggerConfirm(
      "Confirm Delete Disease",
      `Are you sure you want to delete the disease "${name}"?`,
      async () => {
        try {
          const res = await fetch("/api/admin/diseases/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              adminEmail: user.email
            })
          });
          const data = await res.json();
          if (data.success) {
            onSuccessToast({
              title: "🗑️ Disease Deleted",
              content: `Removed "${name}" from master lists.`
            });
            await fetchDiseasesAndTests();
          } else {
            alert(data.message || "Failed to delete disease");
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestName.trim()) return;
    try {
      const res = await fetch("/api/admin/tests/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTestName.trim(),
          normalRange: newTestNormalRange.trim() || "Negative",
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🧪 Lab Test Added",
          content: `Added "${newTestName}" to clinical test masters.`
        });
        setNewTestName("");
        setNewTestNormalRange("");
        await fetchDiseasesAndTests();
      } else {
        alert(data.message || "Failed to add test");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditTestSave = async () => {
    if (!editingTest || !editingTest.name.trim()) return;
    try {
      const res = await fetch("/api/admin/tests/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTest.id,
          name: editingTest.name.trim(),
          normalRange: editingTest.normalRange.trim(),
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "✏️ Test Updated",
          content: `Test updated successfully.`
        });
        setEditingTest(null);
        await fetchDiseasesAndTests();
      } else {
        alert(data.message || "Failed to update test");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTest = async (id: string, name: string) => {
    triggerConfirm(
      "Confirm Delete Test",
      `Are you sure you want to delete the test "${name}"?`,
      async () => {
        try {
          const res = await fetch("/api/admin/tests/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              adminEmail: user.email
            })
          });
          const data = await res.json();
          if (data.success) {
            onSuccessToast({
              title: "🗑️ Test Deleted",
              content: `Removed "${name}" from master lists.`
            });
            await fetchDiseasesAndTests();
          } else {
            alert(data.message || "Failed to delete test");
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  // User input fields
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.HOSPITAL_USER);
  const [newUserHospId, setNewUserHospId] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isWhitelisting, setIsWhitelisting] = useState(false);

  // States for password management of existing users
  const [selectedUserIdForCredentials, setSelectedUserIdForCredentials] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState("");
  const [showPasswordForUserId, setShowPasswordForUserId] = useState<Record<string, boolean>>({});



  // Hospital Form management states
  const [selectedHospId, setSelectedHospId] = useState<string>("new");
  const [hospName, setHospName] = useState("");
  const [hospCode, setHospCode] = useState("");
  const [hospType, setHospType] = useState("");
  const [hospCategory, setHospCategory] = useState("");
  const [hospAddress, setHospAddress] = useState("");
  const [hospEmail, setHospEmail] = useState("");
  const [hospPhone, setHospPhone] = useState("");
  const [hospIncharge, setHospIncharge] = useState("");
  const [isSavingHosp, setIsSavingHosp] = useState(false);
  const [isDeletingHosp, setIsDeletingHosp] = useState(false);

  // Custom configuration masters states
  const [masters, setMasters] = useState<{
    hospitalTypes: string[];
    streams: string[];
    locations: string[];
    blocks: string[];
    districts: string[];
    emailIds: string[];
    categories: string[];
  }>({
    hospitalTypes: [],
    streams: [],
    locations: [],
    blocks: [],
    districts: [],
    emailIds: [],
    categories: []
  });

  const [expandedMasters, setExpandedMasters] = useState<Record<string, boolean>>({
    hospitalTypes: true,
    streams: false,
    locations: false,
    blocks: false,
    districts: false,
    emailIds: false,
    categories: false
  });

  const [expandedHospitals, setExpandedHospitals] = useState<Record<string, boolean>>({});
  const [expandedUserDetails, setExpandedUserDetails] = useState<Record<string, boolean>>({});
  const [hospitalSearch, setHospitalSearch] = useState("");

  const [editingItem, setEditingItem] = useState<{ category: string; index: number; value: string } | null>(null);
  const [newItemValue, setNewItemValue] = useState<Record<string, string>>({
    hospitalTypes: "",
    streams: "",
    locations: "",
    blocks: "",
    districts: "",
    emailIds: "",
    categories: ""
  });

  const [hospStream, setHospStream] = useState("Ayurved");
  const [hospLocation, setHospLocation] = useState("");
  const [hospBlock, setHospBlock] = useState("");
  const [hospDistrict, setHospDistrict] = useState("उधम सिंह नगर");

  const fetchMasters = async () => {
    try {
      const res = await fetch("/api/admin/masters");
      const data = await res.json();
      setMasters(data);
    } catch (e) {
      console.error("Error fetching masters:", e);
    }
  };

  const handleUpdateMasterList = async (category: string, updatedItems: string[]) => {
    try {
      const res = await fetch("/api/admin/masters/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          items: updatedItems,
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "✅ Master List Updated",
          content: data.message
        });
        await fetchMasters();
      } else {
        alert(data.message || "Failed to update master list.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving master list.");
    }
  };

  const handleAddMasterItem = (category: string) => {
    const val = newItemValue[category]?.trim();
    if (!val) return;
    const currentList = masters[category as keyof typeof masters] || [];
    if (currentList.includes(val)) {
      alert("Item already exists in this list.");
      return;
    }
    const updated = [...currentList, val];
    handleUpdateMasterList(category, updated);
    setNewItemValue(prev => ({ ...prev, [category]: "" }));
  };

  const handleSaveMasterItemEdit = (category: string, index: number) => {
    if (!editingItem || editingItem.category !== category || editingItem.index !== index) return;
    const val = editingItem.value.trim();
    if (!val) return;
    const currentList = [...(masters[category as keyof typeof masters] || [])];
    currentList[index] = val;
    handleUpdateMasterList(category, currentList);
    setEditingItem(null);
  };

  const handleDeleteMasterItem = (category: string, index: number) => {
    const currentList = masters[category as keyof typeof masters] || [];
    const itemToDelete = currentList[index];
    triggerConfirm(
      "Confirm Delete Item",
      `Are you sure you want to delete "${itemToDelete}" from the ${category} list?`,
      () => {
        const updated = currentList.filter((_, i) => i !== index);
        handleUpdateMasterList(category, updated);
      }
    );
  };

  const selectHospital = (id: string, currentHospitalsList = hospitals) => {
    setSelectedHospId(id);
    if (id === "new") {
      setHospName("");
      setHospCode("");
      setHospType(masters.hospitalTypes[0] || "राजकीय आयुर्वेदिक चिकित्सालय");
      setHospCategory(masters.categories[0] || "");
      setHospAddress("");
      setHospEmail(masters.emailIds[0] || "");
      setHospPhone("");
      setHospStream(masters.streams[0] || "Ayurved");
      setHospLocation(masters.locations[0] || "");
      setHospBlock(masters.blocks[0] || "");
      setHospDistrict(masters.districts[0] || "उधम सिंह नगर");
      setHospIncharge("");
    } else {
      const h = currentHospitalsList.find(x => x.id === id);
      if (h) {
        setHospName(h.name);
        setHospCode(h.code);
        setHospType(h.type || masters.hospitalTypes[0] || "राजकीय आयुर्वेदिक चिकित्सालय");
        setHospCategory((h as any).category || masters.categories[0] || "");
        setHospAddress(h.address || "");
        setHospEmail(h.contactEmail || masters.emailIds[0] || "");
        setHospPhone(h.contactPhone || "");
        setHospStream((h as any).stream || masters.streams[0] || "Ayurved");
        setHospLocation((h as any).location || masters.locations[0] || "");
        setHospBlock((h as any).block || masters.blocks[0] || "");
        setHospDistrict((h as any).district || masters.districts[0] || "उधम सिंह नगर");
        setHospIncharge(h.incharge || "");
      }
    }
  };

  const handleSaveHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospName.trim() || !hospCode.trim()) {
      alert("Name and Code are required.");
      return;
    }
    if (!hospIncharge.trim()) {
      alert("⚠️ Hospital In-charge Name is mandatory to complete hospital profile registration.");
      return;
    }

    try {
      setIsSavingHosp(true);
      const res = await fetch("/api/admin/hospitals/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user.email,
          hospital: {
            id: selectedHospId === "new" ? undefined : selectedHospId,
            name: hospName.trim(),
            code: hospCode.trim().toUpperCase(),
            type: hospType,
            address: hospAddress.trim(),
            contactEmail: (hospEmail.trim() === "manu.spng@gmail.com" || hospEmail.trim() === "manu.spng")
              ? "manu.spng@gmail.com"
              : hospEmail.trim().includes("@")
                ? hospEmail.trim()
                : `${hospEmail.trim()}@uttarakhandayurved.co.in`,
            contactPhone: hospPhone.trim(),
            incharge: hospIncharge.trim(),
            stream: hospStream,
            location: hospLocation,
            block: hospBlock,
            district: hospDistrict,
            category: hospCategory
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: selectedHospId === "new" ? "🏥 Hospital Registered" : "💾 Changes Saved",
          content: data.message
        });
        
        // Refresh hospital list and keep selection
        const refreshedListResponse = await fetch("/api/hospitals");
        const refreshedList = await refreshedListResponse.json();
        setHospitals(refreshedList);
        
        // Trigger real-time sync across the app
        window.dispatchEvent(new CustomEvent("hospitals-updated"));
        
        if (selectedHospId === "new" && data.hospital?.id) {
          setSelectedHospId(data.hospital.id);
        }
      } else {
        alert(data.message || "Failed to save hospital.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving the hospital.");
    } finally {
      setIsSavingHosp(false);
    }
  };

  const handleBulkSaveHospitals = async () => {
    if (!bulkPastedData.trim()) {
      alert("Please paste some data or load the template first.");
      return;
    }

    try {
      setIsBulkSaving(true);
      setBulkErrors([]);

      // Split into lines
      const lines = bulkPastedData.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("The pasted content doesn't seem to have data rows (or only has a header row).");
        setIsBulkSaving(false);
        return;
      }

      // Determine delimiter by looking at the first line
      const headerLine = lines[0];
      let delimiter = ",";
      if (headerLine.includes("\t")) {
        delimiter = "\t";
      } else if (headerLine.includes(";")) {
        delimiter = ";";
      }

      // Parse headers
      const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

      // Find indexes of columns:
      const colIdx = {
        location: headers.findIndex(h => h.includes("location") || h.includes("town") || h.includes("स्थान")),
        contactEmail: headers.findIndex(h => h.includes("email") || h.includes("login") || h.includes("ईमेल")),
        incharge: headers.findIndex(h => h.includes("incharge") || h.includes("in-charge") || h.includes("प्रभारी")),
        type: headers.findIndex(h => h.includes("type") || h.includes("category") || h.includes("प्रकार")),
        code: headers.findIndex(h => h.includes("code") || h.includes("कोड")),
        address: headers.findIndex(h => h.includes("address") || h.includes("पता")),
        contactPhone: headers.findIndex(h => h.includes("phone") || h.includes("contact") || h.includes("फ़ोन")),
        block: headers.findIndex(h => h.includes("block") || h.includes("विकासखंड")),
        district: headers.findIndex(h => h.includes("district") || h.includes("जनपद")),
        stream: headers.findIndex(h => h.includes("stream") || h.includes("पद्धति")),
        password: headers.findIndex(h => h.includes("password") || h.includes("पासवर्ड")),
      };

      // Validate required headers
      if (colIdx.location === -1 || colIdx.contactEmail === -1 || colIdx.incharge === -1) {
        alert(`❌ Could not identify all required columns. Please ensure your header row contains:
- Location / Town (स्थान)
- In-charge Name (प्रभारी)
- Official Email (ईमेल)`);
        setIsBulkSaving(false);
        return;
      }

      // Helper function to split CSV line respecting quotes
      const parseCSVLine = (line: string, delim: string) => {
        const result = [];
        let curVal = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delim && !inQuotes) {
            result.push(curVal.trim());
            curVal = "";
          } else {
            curVal += char;
          }
        }
        result.push(curVal.trim());
        return result;
      };

      const rows: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = parseCSVLine(line, delimiter);
        if (cells.length < 3) continue; // Skip too short lines

        const getVal = (idx: number, fallback = "") => {
          if (idx !== -1 && cells[idx] !== undefined) {
            return cells[idx].replace(/^"|"$/g, "").trim(); // strip outer quotes
          }
          return fallback;
        };

        const location = getVal(colIdx.location);
        const contactEmail = getVal(colIdx.contactEmail);
        const incharge = getVal(colIdx.incharge);

        if (!location || !contactEmail || !incharge) {
          errors.push(`Row ${i + 1}: Missing location, email, or in-charge name.`);
          continue;
        }

        rows.push({
          location,
          contactEmail,
          incharge,
          type: getVal(colIdx.type, "राजकीय आयुर्वेदिक चिकित्सालय"),
          code: getVal(colIdx.code),
          address: getVal(colIdx.address),
          contactPhone: getVal(colIdx.contactPhone),
          block: getVal(colIdx.block),
          district: getVal(colIdx.district, "उधम सिंह नगर"),
          stream: getVal(colIdx.stream, "Ayurved"),
          password: getVal(colIdx.password, "123456"),
        });
      }

      if (errors.length > 0) {
        setBulkErrors(errors);
      }

      if (rows.length === 0) {
        alert("No valid data rows found to submit.");
        setIsBulkSaving(false);
        return;
      }

      // Send to server
      const res = await fetch("/api/admin/hospitals/bulk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user.email,
          rows
        })
      });

      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🏥 Bulk Registration Completed",
          content: `Successfully registered ${data.addedHospitals} hospitals and ${data.addedUsers} credentials.`
        });

        if (data.errors && data.errors.length > 0) {
          setBulkErrors(prev => [...prev, ...data.errors]);
        } else if (errors.length === 0) {
          setBulkPastedData("");
          setBulkErrors([]);
        }

        // Refresh hospitals list
        const refreshedListResponse = await fetch("/api/hospitals");
        const refreshedList = await refreshedListResponse.json();
        setHospitals(refreshedList);

        // Trigger real-time sync across the app
        window.dispatchEvent(new CustomEvent("hospitals-updated"));
      } else {
        alert(data.message || "Failed to bulk register hospitals.");
      }

    } catch (err) {
      console.error(err);
      alert("An error occurred during bulk registration.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleDeleteHospital = async () => {
    if (selectedHospId === "new") return;
    triggerConfirm(
      "Confirm Delete Hospital",
      `Are you absolutely sure you want to delete "${hospName}"? This action is permanent and will remove all associated user and record configurations.`,
      async () => {
        try {
          setIsDeletingHosp(true);
          const res = await fetch("/api/admin/hospitals/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adminEmail: user.email,
              hospitalId: selectedHospId
            })
          });

          const data = await res.json();
          if (data.success) {
            onSuccessToast({
              title: "🗑️ Hospital Deleted",
              content: data.message
            });
            
            // Refresh hospital list
            const refreshedListResponse = await fetch("/api/hospitals");
            const refreshedList = await refreshedListResponse.json();
            setHospitals(refreshedList);
            
            // Trigger real-time sync across the app
            window.dispatchEvent(new CustomEvent("hospitals-updated"));
            
            // Reset to new hospital form
            selectHospital("new", refreshedList);
          } else {
            alert(data.message || "Failed to delete hospital.");
          }
        } catch (err) {
          console.error(err);
          alert("An error occurred while deleting the hospital.");
        } finally {
          setIsDeletingHosp(false);
        }
      }
    );
  };

  useEffect(() => {
    fetchUsers();
    fetchHospitals();
    fetchAuditLogs();
    fetchRequests();
    fetchMasters();
    fetchDiseasesAndTests();

    const handleHospitalsUpdated = () => {
      fetchHospitals();
    };
    window.addEventListener("hospitals-updated", handleHospitalsUpdated);
    return () => {
      window.removeEventListener("hospitals-updated", handleHospitalsUpdated);
    };
  }, [activeTab]);

  useEffect(() => {
    const types = masters?.hospitalTypes || [];
    if (selectedHospId === "new" && types.length > 0) {
      if (!hospType) setHospType(types[0]);
      if (!hospEmail) setHospEmail((masters?.emailIds || [])[0] || "");
      if (!hospStream) setHospStream((masters?.streams || [])[0] || "");
      if (!hospLocation) setHospLocation((masters?.locations || [])[0] || "");
      if (!hospBlock) setHospBlock((masters?.blocks || [])[0] || "");
      if (!hospDistrict) setHospDistrict((masters?.districts || [])[0] || "उधम सिंह नगर");
    }
  }, [masters]);

  // Keep hospital name, code, and email synced
  useEffect(() => {
    let computedName = "";
    const activeSelection = hospCategory ? hospCategory.trim() : (hospType ? hospType.trim() : "");
    if (activeSelection && hospLocation) {
      computedName = `${activeSelection} - ${hospLocation.trim()}`;
    } else if (activeSelection) {
      computedName = activeSelection;
    } else if (hospLocation) {
      computedName = hospLocation.trim();
    }
    setHospName(computedName);

    // Auto generate unique code if it's a new hospital using Facility Type abbreviation & Sequence
    if (selectedHospId === "new") {
      const prefix = getFacilityTypeAbbreviation(hospType);
      const existingWithPrefix = hospitals.filter(h => h.code && h.code.startsWith(prefix + "-"));
      let maxSeq = 0;
      existingWithPrefix.forEach(h => {
        const parts = h.code.split("-");
        const seqStr = parts[parts.length - 1];
        const num = parseInt(seqStr, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      });
      const nextSeq = Math.max(existingWithPrefix.length, maxSeq) + 1;
      const seqStr = nextSeq.toString().padStart(3, '0');
      setHospCode(`${prefix}-${seqStr}`);
    }

    // Look up in the synced google sheet list of hospitals
    let syncedEmail = "";
    let syncedIncharge = "";
    
    if (computedName) {
      const matched = hospitals.find(h => h.name.trim().toLowerCase() === computedName.trim().toLowerCase());
      if (matched) {
        if (matched.contactEmail) {
          syncedEmail = matched.contactEmail.trim();
          if (syncedEmail.endsWith("@uttarakhandayurved.co.in")) {
            syncedEmail = syncedEmail.replace("@uttarakhandayurved.co.in", "");
          }
        }
        if (matched.incharge) {
          syncedIncharge = matched.incharge.trim();
        }
      }
    }
    
    if (!syncedEmail && hospLocation) {
      const matchedByLoc = hospitals.find(h => (h as any).location?.trim().toLowerCase() === hospLocation.trim().toLowerCase());
      if (matchedByLoc) {
        if (matchedByLoc.contactEmail) {
          syncedEmail = matchedByLoc.contactEmail.trim();
          if (syncedEmail.endsWith("@uttarakhandayurved.co.in")) {
            syncedEmail = syncedEmail.replace("@uttarakhandayurved.co.in", "");
          }
        }
        if (matchedByLoc.incharge) {
          syncedIncharge = matchedByLoc.incharge.trim();
        }
      }
    }

    if (syncedEmail) {
      setHospEmail(syncedEmail);
    } else if (hospLocation) {
      setHospEmail(getDesignatedEmailForLocation(hospLocation));
    }

    if (syncedIncharge) {
      setHospIncharge(syncedIncharge);
    }
  }, [hospCategory, hospType, hospLocation, hospitals, selectedHospId]);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/admin/registration-requests");
      const d = await res.json();
      setRequests(d);
    } catch (e) { console.error(e); }
  };

  const handleRequestAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    try {
      setIsLoading(true);
      const reqToApprove = requests.find(r => r.id === requestId);

      const res = await fetch("/api/admin/registration-requests/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        if (action === "APPROVE" && reqToApprove) {
          try {
            await createFirebaseUser(reqToApprove.email, reqToApprove.password);
          } catch (fbErr: any) {
            console.warn("Could not register approved user in Firebase Auth:", fbErr.message);
          }
        }
        onSuccessToast({
          title: action === "APPROVE" ? "🎉 User Approved & Whitelisted" : "❌ Request Rejected",
          content: data.message
        });
        fetchRequests();
        fetchUsers();
      } else {
        alert(data.message || "Operation failed");
      }
    } catch (e) { console.error(e); } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const d = await res.json();
      setUsersList(d);
    } catch (e) { console.error(e); }
  };

  const fetchHospitals = async () => {
    try {
      const res = await fetch("/api/hospitals");
      const d = await res.json();
      setHospitals(d);
    } catch (e) { console.error(e); }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      const d = await res.json();
      setAuditLogs(d);
    } catch (e) { console.error(e); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) {
      alert("Name and Email are required.");
      return;
    }

    if (newUserRole === UserRole.HOSPITAL_USER && !newUserHospId) {
      alert("Please assign a facility scope (Hospital) for this user.");
      return;
    }

    const trimmedEmail = newUserEmail.trim();
    const finalEmail = (trimmedEmail === "manu.spng@gmail.com" || trimmedEmail === "manu.spng")
      ? "manu.spng@gmail.com"
      : trimmedEmail.includes("@") 
        ? trimmedEmail 
        : `${trimmedEmail}@uttarakhandayurved.co.in`;

    try {
      setIsWhitelisting(true);
      const res = await fetch("/api/admin/users/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: finalEmail,
          userName: newUserName,
          role: newUserRole,
          hospitalId: newUserRole === UserRole.HOSPITAL_USER ? newUserHospId : undefined,
          phone: newUserPhone,
          password: newUserPassword,
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        // Automatically create/ensure the account exists in Firebase Auth
        try {
          await createFirebaseUser(finalEmail, newUserPassword || "Welcome@123");
        } catch (fbErr: any) {
          console.warn("Could not create/ensure Firebase Auth account during whitelist:", fbErr.message);
        }

        onSuccessToast({
          title: "👤 Whitelist Updated",
          content: `Successfully registered & whitelisted ${finalEmail} as ${newUserRole}!`
        });
        setNewUserEmail("");
        setNewUserName("");
        setNewUserPhone("");
        setNewUserPassword("");
        setNewUserHospId("");
        fetchUsers();
      } else {
        alert(data.message || "Failed to update whitelist.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while whitelisting the user.");
    } finally {
      setIsWhitelisting(false);
    }
  };

  const handleToggleUserStatus = async (targetEmail: string) => {
    try {
      const res = await fetch("/api/admin/users/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail,
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🔄 Account Toggled",
          content: `Account access for ${targetEmail} is now ${data.user.isWhitelisted ? "ACTIVATED" : "DEACTIVATED"}.`
        });
        fetchUsers();
      } else {
        alert(data.message);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (targetEmail: string) => {
    triggerConfirm(
      "Confirm Delete User Account",
      `Are you sure you want to permanently delete user ${targetEmail}? This action is irreversible.`,
      async () => {
        try {
          const res = await fetch("/api/admin/users/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetEmail,
              adminEmail: user.email
            })
          });
          const data = await res.json();
          if (data.success) {
            onSuccessToast({
              title: "🗑️ User Deleted",
              content: `User ${targetEmail} was successfully deleted.`
            });
            fetchUsers();
          } else {
            alert(data.message || "Failed to delete user");
          }
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  const handleChangeUserPassword = async (targetEmail: string, newPassword: string) => {
    if (!newPassword.trim()) {
      alert("Please enter a valid password.");
      return;
    }
    try {
      const res = await fetch("/api/admin/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: targetEmail,
          newPassword,
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🔐 Password Changed",
          content: `Successfully changed password for ${targetEmail}!`
        });
        setSelectedUserIdForCredentials(null);
        setEditPasswordValue("");
        fetchUsers();
      } else {
        alert(data.message || "Failed to change password.");
      }
    } catch (err) {
      console.error(err);
      alert("Error changing password.");
    }
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="admin-master-root">
      
      {/* TABS SELECTOR (Left Column) */}
      <div className={`lg:col-span-3 bg-white border ${ct.cardBorder} rounded-2xl p-4 shadow-sm h-fit space-y-2`}>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2.5 pb-2 border-b border-slate-100">
          Super Admin Console
        </span>

        <button
          onClick={() => setActiveTab("users")}
          className={`w-full text-left text-xs font-semibold px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 border ${
            activeTab === "users" ? `${ct.badgeBg} ${ct.accentText}` : "border-transparent text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Users className={`w-4 h-4 ${activeTab === "users" ? ct.accentText : "text-slate-400"}`} />
          Registered Users ({usersList.length})
        </button>

        <button
          onClick={() => setActiveTab("hospitals")}
          className={`w-full text-left text-xs font-semibold px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 border ${
            activeTab === "hospitals" ? `${ct.badgeBg} ${ct.accentText}` : "border-transparent text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Settings className={`w-4 h-4 ${activeTab === "hospitals" ? ct.accentText : "text-slate-400"}`} />
          Manage Hospitals ({hospitals.length})
        </button>

        <button
          onClick={() => setActiveTab("sheets")}
          className={`w-full text-left text-xs font-semibold px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 border ${
            activeTab === "sheets" ? `${ct.badgeBg} ${ct.accentText}` : "border-transparent text-slate-600 hover:bg-slate-50"
          }`}
        >
          <FileSpreadsheet className={`w-4 h-4 ${activeTab === "sheets" ? ct.accentText : "text-slate-400"}`} />
          Google Sheets Sync
        </button>



        <button
          onClick={() => setActiveTab("audits")}
          className={`w-full text-left text-xs font-semibold px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 border ${
            activeTab === "audits" ? `${ct.badgeBg} ${ct.accentText}` : "border-transparent text-slate-600 hover:bg-slate-50"
          }`}
        >
          <History className={`w-4 h-4 ${activeTab === "audits" ? ct.accentText : "text-slate-400"}`} />
          System Audit Logs
        </button>
      </div>

      {/* TABS DETAILS (Right Column) */}
      <div className={`lg:col-span-9 bg-white border ${ct.cardBorder} rounded-2xl p-6 shadow-sm min-h-96`}>
        
        {/* TABS: WHITELIST USERS */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* PENDING REGISTRATION REQUESTS SECTION */}
            <div className="bg-amber-50/30 border border-amber-200/50 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-amber-200/40 pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                  <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Pending Registration Requests ({requests.filter(r => r.status === "PENDING").length})</h5>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                  Awaiting Verification
                </span>
              </div>

              {requests.filter(r => r.status === "PENDING").length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider pb-1.5">
                        <th className="py-2">Name</th>
                        <th className="py-2">Requested Email</th>
                        <th className="py-2">Role</th>
                        <th className="py-2">Phone</th>
                        <th className="py-2">Facility Scope</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {requests.filter(r => r.status === "PENDING").map((req) => (
                        <tr key={req.id} className="hover:bg-amber-50/20 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">{req.name}</td>
                          <td className="py-2.5 font-mono text-[11px] text-emerald-800 font-bold">{req.email}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                              {req.role === UserRole.SUPER_ADMIN ? "super admin" : req.role === UserRole.DAUO ? "admin" : (hospitals.find(h => h.id === req.hospitalId)?.name || "Hospital")}
                            </span>
                          </td>
                          <td className="py-2.5 font-semibold text-slate-500">{req.phone || "—"}</td>
                          <td className="py-2.5 font-semibold text-slate-600">
                            {req.role === UserRole.SUPER_ADMIN ? "District Universal" :
                              hospitals.find(h => h.id === req.hospitalId)?.name || "Not assigned"
                            }
                          </td>
                          <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRequestAction(req.id, "APPROVE")}
                              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition-all shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestAction(req.id, "REJECT")}
                              className="inline-flex items-center gap-1 bg-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition-all border border-slate-300 hover:border-rose-200"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-2">No pending registration requests to verify.</p>
              )}
            </div>

            {/* Registered users directory table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider pb-2">
                    <th className="py-2">Name</th>
                    <th className="py-2">Credential Email</th>
                    <th className="py-2">Security Role</th>
                    <th className="py-2">Assigned Facility Scope</th>
                    <th className="py-2 text-center">Suspended / Active</th>
                    {user.role === UserRole.SUPER_ADMIN && (
                      <th className="py-2 text-right">Credentials & Password</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {usersList.map(u => {
                    const h = hospitals.find(hosp => hosp.id === u.hospitalId);
                    return (
                      <React.Fragment key={u.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">{u.name}</td>
                          <td className="py-2.5 font-mono text-[11px]">{u.email}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === UserRole.SUPER_ADMIN ? "bg-rose-50 text-rose-800 border border-rose-100" :
                              u.role === UserRole.DAUO ? "bg-amber-50 text-amber-800 border border-amber-100" :
                              "bg-blue-50 text-blue-800 border border-blue-100"
                            }`}>
                              {u.role === UserRole.SUPER_ADMIN ? "super admin" : u.role === UserRole.DAUO ? "admin" : (hospitals.find(hosp => hosp.id === u.hospitalId)?.name || "Hospital")}
                            </span>
                          </td>
                          <td className="py-2.5 font-semibold text-slate-500">
                            {u.role === UserRole.SUPER_ADMIN ? (
                              "District Universal"
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{h?.name || "Not assigned"}</span>
                                {h && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedUserDetails(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 px-2 py-0.5 rounded-md transition-all inline-flex items-center gap-1 cursor-pointer w-fit"
                                  >
                                    {expandedUserDetails[u.id] ? (
                                      <>
                                        <span>Hide Details</span>
                                        <ChevronUp className="w-3 h-3" />
                                      </>
                                    ) : (
                                      <>
                                        <span>View Details</span>
                                        <ChevronDown className="w-3 h-3" />
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u.email)}
                                disabled={u.email === "manu.spng@gmail.com"}
                                title={u.isWhitelisted ? "Deactivate User" : "Activate User"}
                                className={`hover:scale-105 transition-all outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                  u.isWhitelisted ? "text-emerald-600 hover:text-emerald-700" : "text-slate-400 hover:text-slate-500"
                                }`}
                              >
                                {u.isWhitelisted ? (
                                  <ToggleRight className="w-8 h-8" />
                                ) : (
                                  <ToggleLeft className="w-8 h-8" />
                                )}
                              </button>
                              {u.email !== "manu.spng@gmail.com" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.email)}
                                  title="Delete User Account"
                                  className="text-rose-500 hover:text-rose-700 hover:scale-110 transition-all outline-none cursor-pointer p-1 rounded hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                          {user.role === UserRole.SUPER_ADMIN && (
                            <td className="py-2.5 text-right">
                              {selectedUserIdForCredentials === u.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="text"
                                    value={editPasswordValue}
                                    onChange={(e) => setEditPasswordValue(e.target.value)}
                                    className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-800 font-mono w-28 outline-none focus:ring-1 focus:ring-emerald-500"
                                    placeholder="New password"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleChangeUserPassword(u.email, editPasswordValue)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded font-bold text-[10px] transition-all cursor-pointer shadow-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedUserIdForCredentials(null)}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded font-bold text-[10px] transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono font-medium">
                                    {showPasswordForUserId[u.id] ? (u.password || "Not set") : "••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowPasswordForUserId(prev => ({
                                        ...prev,
                                        [u.id]: !prev[u.id]
                                      }));
                                    }}
                                    className="text-slate-400 hover:text-slate-600 text-[10px] font-bold underline cursor-pointer"
                                  >
                                    {showPasswordForUserId[u.id] ? "Hide" : "See"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUserIdForCredentials(u.id);
                                      setEditPasswordValue(u.password || "");
                                    }}
                                    className="bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                        {u.role === UserRole.HOSPITAL_USER && h && expandedUserDetails[u.id] && (
                          <tr className="bg-slate-50/55 animate-fadeIn">
                            <td colSpan={user.role === UserRole.SUPER_ADMIN ? 6 : 5} className="px-4 py-3.5 border-t border-b border-slate-100">
                              <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-sm space-y-3.5 font-sans">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <h6 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Hospital Registration Credentials</h6>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold uppercase">
                                      {h.type || "Government Facility"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedUserDetails(prev => ({ ...prev, [u.id]: false }))}
                                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                                    >
                                      <span>Collapse</span>
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Hospital Name</span>
                                    <span className="text-slate-800 font-bold">{h.name}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Hospital Code</span>
                                    <span className="text-slate-800 font-mono font-bold bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">{h.code}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Stream</span>
                                    <span className="text-slate-800 font-semibold">{(h as any).stream || "Ayurved"}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Incharge Name</span>
                                    <span className="text-slate-800 font-bold">{h.incharge || "Dr Manvinder Pal Singh"}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Block / District</span>
                                    <span className="text-slate-800 font-semibold">{(h as any).block || "Khatima"} / {(h as any).district || "उधम सिंह नगर"}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Location</span>
                                    <span className="text-slate-800 font-semibold">{(h as any).location || "झनकट"}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Official Email</span>
                                    <span className="text-slate-700 font-semibold truncate block max-w-[180px]">{h.contactEmail || "usn.jhankat@uttarakhandayurved.co.in"}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Contact Phone</span>
                                    <span className="text-slate-700 font-semibold">{h.contactPhone ? `+91 ${h.contactPhone}` : "9455959592"}</span>
                                  </div>
                                </div>
                                <div className="border-t border-slate-100 pt-2.5">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Address</span>
                                  <p className="text-slate-600 font-medium text-xs leading-relaxed">{h.address || "jhankat, khatima, us nagar"}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABS: MANAGE HOSPITALS */}
        {activeTab === "hospitals" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">District Institute Directory & Custom Master Management</h4>
                <p className="text-xs text-slate-400 font-medium">Configure facility types, codes, official logins, contact info, and directory metadata details</p>
              </div>

              {/* Toggle Mode Pills */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit self-end md:self-auto animate-fadeIn">
                <button
                  type="button"
                  onClick={() => setHospSubMode("single")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    hospSubMode === "single" ? "bg-white text-emerald-850 shadow-sm" : "text-slate-500 hover:text-slate-850"
                  }`}
                >
                  🏥 Single Registration
                </button>
                <button
                  type="button"
                  onClick={() => setHospSubMode("bulk")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    hospSubMode === "bulk" ? "bg-white text-emerald-850 shadow-sm" : "text-slate-500 hover:text-slate-850"
                  }`}
                >
                  ⚡ Bulk Registration
                </button>
              </div>
            </div>

            {hospSubMode === "single" ? (
              <>
                {/* Dropdown Selector section */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Hospital to View/Edit or Add New (संस्थान चुनें):</label>
                <select
                  value={selectedHospId}
                  onChange={(e) => selectHospital(e.target.value)}
                  className="bg-white border border-slate-250 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer min-w-[200px] md:min-w-[280px]"
                >
                  <option value="new">➕ Register / Add New Hospital (नया संस्थान जोड़ें)</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.code} - {h.type})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {selectedHospId !== "new" && (
                  <button
                    type="button"
                    onClick={() => selectHospital("new")}
                    className="bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    Switch to Add New (नया जोड़ें)
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Form block */}
            <form onSubmit={handleSaveHospital} className="border border-slate-150 rounded-2xl p-5 bg-white space-y-4 shadow-sm">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                  {selectedHospId === "new" ? "Register New Institution Details (नए संस्थान का विवरण)" : `Edit details of "${hospName}"`}
                </h5>
                {selectedHospId !== "new" && (
                  <button
                    type="button"
                    onClick={handleDeleteHospital}
                    disabled={isDeletingHosp}
                    className="text-[10px] text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Hospital
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hospital Name (संस्थान का नाम)*</label>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Auto-generated from Category + Location"
                    value={hospName}
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-600 font-bold outline-none cursor-not-allowed shadow-inner transition-all"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Automatically derived as: [Hospital Category] - [Location]</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unique Hospital Code (संस्थान कोड)*</label>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Auto-generated from Facility Type"
                    value={hospCode}
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-600 font-mono outline-none cursor-not-allowed shadow-inner transition-all"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Automatically generated as: [FACILITY_TYPE_CODE]-[SEQ] (e.g. SAD-001)</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hospital Category (चिकित्सालय श्रेणी)*</label>
                  <select
                    value={hospCategory}
                    required
                    onChange={(e) => setHospCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-850 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 hover:border-emerald-500/50 cursor-pointer shadow-sm transition-all"
                  >
                    {!hospCategory && <option value="">-- Choose Category --</option>}
                    {masters?.categories && masters.categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Facility Type (संस्थान प्रकार)*</label>
                  <select
                    value={hospType}
                    required
                    onChange={(e) => setHospType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-850 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 hover:border-emerald-500/50 cursor-pointer shadow-sm transition-all"
                  >
                    {!(masters?.hospitalTypes) || masters.hospitalTypes.length === 0 ? (
                      <option value="">No types configured. Add them below.</option>
                    ) : (
                      masters.hospitalTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Stream (चिकित्सा पद्धति)*</label>
                  <select
                    value={hospStream}
                    required
                    onChange={(e) => setHospStream(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-850 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 hover:border-emerald-500/50 cursor-pointer shadow-sm transition-all"
                  >
                    <option value="Ayurved">Ayurved</option>
                    <option value="Unani">Unani</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Location / Town (स्थान)*</label>
                  <select
                    value={hospLocation}
                    required
                    onChange={(e) => setHospLocation(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-850 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 hover:border-emerald-500/50 cursor-pointer shadow-sm transition-all"
                  >
                    {!(masters?.locations) || masters.locations.length === 0 ? (
                      <option value="">No locations configured. Add them below.</option>
                    ) : (
                      masters.locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Block (विकासखंड)*</label>
                  <select
                    value={hospBlock}
                    required
                    onChange={(e) => setHospBlock(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-850 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {!(masters?.blocks) || masters.blocks.length === 0 ? (
                      <option value="">No blocks configured. Add them below.</option>
                    ) : (
                      masters.blocks.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">District (जनपद)*</label>
                  <select
                    value={hospDistrict}
                    required
                    onChange={(e) => setHospDistrict(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-850 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {!(masters?.districts) || masters.districts.length === 0 ? (
                      <option value="">No districts configured. Add them below.</option>
                    ) : (
                      masters.districts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Official Email Prefix / Login ID (ईमेल आईडी)*</label>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 transition-colors">
                    <input
                      type="text"
                      required
                      id="hospital-email-input"
                      placeholder="e.g. jhankat.ayush"
                      value={hospEmail}
                      onChange={(e) => setHospEmail(e.target.value)}
                      className="w-full bg-transparent px-3 py-1.5 text-xs text-slate-805 font-mono font-bold outline-none"
                    />
                    {!hospEmail.includes("@") && (
                      <span className="flex items-center bg-slate-50 px-2.5 border-l border-slate-150 text-[10px] text-emerald-800 font-bold select-none whitespace-nowrap">
                        @uttarakhandayurved.co.in
                      </span>
                    )}
                  </div>
                  {!hospEmail.includes("@") && hospEmail.trim().length > 0 && (
                    <p className="text-[9px] text-slate-400 mt-1 font-semibold">
                      Will save as: <span className="text-emerald-700 font-bold">{hospEmail.trim()}@uttarakhandayurved.co.in</span>
                    </p>
                  )}
                  <span className="text-[9px] text-emerald-600 mt-1 block font-semibold flex items-center gap-1">
                    ✨ Auto-fetched and synced based on selected Location. You can also edit it.
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hospital In-charge Name (प्रभारी का नाम)</label>
                  <input
                    type="text"
                    id="hospital-incharge-input"
                    placeholder="e.g. Dr. Rajesh Negi"
                    value={hospIncharge}
                    onChange={(e) => setHospIncharge(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-850 outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                  />
                  <span className="text-[9px] text-emerald-600 mt-1 block font-semibold">
                    ✨ Auto-fetched from Sheet. Placed above signing authority in reports.
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Phone (फोन नंबर)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9412345678"
                    value={hospPhone}
                    onChange={(e) => setHospPhone(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-805 outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Complete Physical Address (पता)</label>
                  <input
                    type="text"
                    placeholder="e.g. Tanakpur Road, Jhankat, Khatima, Uttarakhand"
                    value={hospAddress}
                    onChange={(e) => setHospAddress(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-805 outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                  />
                </div>
              </div>

              <div className="text-right pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingHosp}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ml-auto"
                >
                  {isSavingHosp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      {selectedHospId === "new" ? "Create / Register Hospital" : "Save after Editing / Update Details"}
                    </>
                  )}
                </button>
              </div>
            </form>
              </>
            ) : (
              <div className="border border-slate-150 rounded-2xl p-5 bg-white space-y-4 shadow-sm animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
                      Bulk Register Institutions (थोक पंजीकरण और लॉगिन आईडी निर्माण)
                    </h5>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Enter hospital records using our structured template. Registered facilities will instantly have login accounts generated.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkPastedData(
                          "Type,Location,Code,Address,ContactPhone,Official Email,In-charge,Block,District,Stream,Password\n" +
                          "राजकीय आयुर्वेदिक चिकित्सालय,Kashipur,,Kashipur Bazar,9876543210,sad.kashipur,Dr. Rajesh Sharma,Kashipur,उधम सिंह नगर,Ayurved,kash123\n" +
                          "राजकीय यूनानी चिकित्सालय,Jaspur,SUB-JAS-452,Jaspur,9876543211,sub.jaspur,Dr. Imran Khan,Jaspur,उधम सिंह नगर,Unani,jas567"
                        );
                        onSuccessToast({
                          title: "📋 Template Loaded",
                          content: "A standard template with 2 sample entries has been loaded in the workspace below."
                        });
                      }}
                      className="bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      📋 Load Sample Template
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  {/* Left Column: Rules & instructions */}
                  <div className="xl:col-span-1 bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
                    <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Guidelines & Expected Format</span>
                    <ul className="space-y-2 text-[11px] text-slate-600 font-medium list-disc list-inside">
                      <li>Copy records directly from **Google Sheets** or **Excel** and paste them into the box.</li>
                      <li>Columns can be separated by commas (CSV) or tabs (spreadsheet copy-paste).</li>
                      <li>
                        Required headers:
                        <ul className="pl-4 list-square text-[10px] text-slate-500 font-bold">
                          <li><span className="text-rose-600">Location*</span> (e.g. Kashipur)</li>
                          <li><span className="text-rose-600">In-charge*</span> (Manager Name)</li>
                          <li><span className="text-rose-600">Official Email*</span> (Official login prefix, e.g. `sad.kashipur` which becomes `sad.kashipur@uttarakhandayurved.co.in`)</li>
                        </ul>
                      </li>
                      <li>
                        Optional columns:
                        <ul className="pl-4 list-square text-[10px] text-slate-500">
                          <li>Type (Defaults to राजकीय आयुर्वेदिक चिकित्सालय)</li>
                          <li>Code (Auto-computed if left blank)</li>
                          <li>Password (Defaults to 123456 if blank)</li>
                          <li>Address, ContactPhone, Block, District, Stream</li>
                        </ul>
                      </li>
                    </ul>

                    {/* File Upload zone */}
                    <div className="pt-2">
                      <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px] mb-2">Or Upload CSV File</span>
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-4 bg-white hover:bg-emerald-50/20 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm">
                        <Upload className="w-6 h-6 text-emerald-600 mb-1" />
                        <span className="font-bold text-[10px] text-slate-500">Click to upload or Drag CSV here</span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const text = event.target?.result as string;
                              if (text) {
                                setBulkPastedData(text);
                                onSuccessToast({
                                  title: "📄 CSV File Loaded",
                                  content: "Your CSV file content has been loaded into the input workspace below. Review and click Register."
                                });
                              }
                            };
                            reader.readAsText(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Right Column: Paste workspace */}
                  <div className="xl:col-span-2 space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Spreadsheet Data Workspace (डाटा पेस्ट क्षेत्र):</label>
                      <textarea
                        value={bulkPastedData}
                        onChange={(e) => setBulkPastedData(e.target.value)}
                        placeholder="Paste Google Sheets or CSV data here...&#10;e.g.&#10;Location,In-charge,Official Email,Type,Password&#10;Kashipur,Dr. Rajesh Sharma,sad.kashipur,राजकीय आयुर्वेदिक चिकित्सालय,kash123"
                        className="w-full bg-slate-50/50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl p-4 h-64 text-xs font-mono outline-none shadow-inner"
                      />
                    </div>

                    {/* Show parsing error logs */}
                    {bulkErrors.length > 0 && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 space-y-1.5 max-h-40 overflow-y-auto">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          ⚠️ Parsing Warnings / Conflict Errors ({bulkErrors.length}):
                        </span>
                        <ul className="text-[11px] list-disc list-inside font-semibold font-mono text-rose-700">
                          {bulkErrors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleBulkSaveHospitals}
                        disabled={isBulkSaving || !bulkPastedData.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isBulkSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing & Registering...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            ⚡ Register & Create Login Credentials
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Configuration Masters Panel */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  Custom Configuration Masters Management (मास्टर सूची प्रबंधन)
                </h5>
                <p className="text-[11px] text-slate-400 font-medium">Configure options available in dropdown menus by expanding each section below. Add, edit, or delete items instantly.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "categories", label: "Hospital Categories (चिकित्सालय श्रेणी सूची)", placeholder: "e.g. Sub-District Hospital" },
                  { key: "hospitalTypes", label: "Hospital Types (चिकित्सालय वर्ग सूची)", placeholder: "e.g. राजकीय यूनानी चिकित्सालय" },
                  { key: "locations", label: "Locations (स्थान/ग्राम सूची)", placeholder: "e.g. केलाखेड़ा" },
                  { key: "blocks", label: "Blocks (विकासखंड सूची)", placeholder: "e.g. काशीपुर" },
                  { key: "districts", label: "Districts (जनपद सूची)", placeholder: "e.g. उधम सिंह नगर" },
                  { key: "emailIds", label: "Official Email IDs Section (ईमेल आईडी सूची)", placeholder: "e.g. kashipur.unani@gov.in" }
                ].map(cat => {
                  const items = masters[cat.key as keyof typeof masters] || [];
                  const isExpanded = !!expandedMasters[cat.key];
                  return (
                    <div key={cat.key} className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm transition-all hover:border-slate-300">
                      <button
                        type="button"
                        onClick={() => setExpandedMasters(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                        className="w-full flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-100/70 font-bold text-xs text-slate-700 select-none cursor-pointer border-b border-slate-100"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                            {items.length}
                          </span>
                          {cat.label}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {isExpanded ? "▲ Collapse" : "▼ Expand"}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
                          {/* Add New Row */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder={cat.placeholder}
                              value={newItemValue[cat.key] || ""}
                              onChange={(e) => setNewItemValue(prev => ({ ...prev, [cat.key]: e.target.value }))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddMasterItem(cat.key)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          </div>

                          {/* List of items */}
                          <div className="space-y-1">
                            {items.map((item, idx) => {
                              const isEditing = editingItem?.category === cat.key && editingItem?.index === idx;
                              return (
                                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50/70 border border-slate-100 text-[11px] font-semibold">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editingItem.value}
                                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, value: e.target.value } : null)}
                                      className="flex-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="text-slate-700 truncate max-w-[200px]">
                                      {item}
                                    </span>
                                  )}

                                  <div className="flex items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveMasterItemEdit(cat.key, idx)}
                                          className="text-emerald-700 hover:underline font-extrabold text-[10px] cursor-pointer"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingItem(null)}
                                          className="text-slate-400 hover:underline text-[10px] cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setEditingItem({ category: cat.key, index: idx, value: item })}
                                          className="text-slate-500 hover:text-slate-800 text-[10px] cursor-pointer"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMasterItem(cat.key, idx)}
                                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid display directory list */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Registered Directory Overview ({hospitals.length} Facilities)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allExpanded: Record<string, boolean> = {};
                      hospitals.forEach(h => { allExpanded[h.id] = true; });
                      setExpandedHospitals(allExpanded);
                    }}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedHospitals({})}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Search filter for large hospital directory */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search facilities by name, code, location, block, district..."
                  value={hospitalSearch}
                  onChange={(e) => setHospitalSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                />
                {hospitalSearch && (
                  <button
                    type="button"
                    onClick={() => setHospitalSearch("")}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {hospitals
                  .filter(h => {
                    if (!hospitalSearch.trim()) return true;
                    const q = hospitalSearch.toLowerCase();
                    return (
                      h.name.toLowerCase().includes(q) ||
                      h.code.toLowerCase().includes(q) ||
                      (h.type && h.type.toLowerCase().includes(q)) ||
                      ((h as any).location && (h as any).location.toLowerCase().includes(q)) ||
                      ((h as any).block && (h as any).block.toLowerCase().includes(q)) ||
                      ((h as any).district && (h as any).district.toLowerCase().includes(q))
                    );
                  })
                  .map(h => {
                  const isExpanded = !!expandedHospitals[h.id];
                  return (
                    <div
                      key={h.id}
                      className={`border rounded-xl shadow-sm bg-slate-50/10 hover:shadow transition-all border-slate-200/80 hover:border-slate-300 border-l-4 ${
                        selectedHospId === h.id ? "border-l-emerald-500 bg-emerald-50/5 ring-1 ring-emerald-500/10 shadow-md" : "border-l-slate-300"
                      }`}
                    >
                      {/* Header line: always visible */}
                      <div 
                        onClick={() => setExpandedHospitals(prev => ({ ...prev, [h.id]: !prev[h.id] }))}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex-1 flex items-center gap-3">
                          <div className="text-slate-400 shrink-0">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                            <h5 className="font-semibold text-slate-800 text-sm font-sans">{h.name}</h5>
                            <span className="text-xs text-slate-500 font-normal font-sans">
                              Location: {(h as any).location || "—"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                          {/* Facility Type Badge */}
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase font-sans">
                            {h.type}
                          </span>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectHospital(h.id);
                            }}
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                              selectedHospId === h.id 
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm" 
                                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-250 shadow-sm"
                            }`}
                          >
                            {selectedHospId === h.id ? "Active Editing" : "Select & Edit"}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Section */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/30 p-5 space-y-4 font-sans text-xs">
                          {/* Info details grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-slate-600 font-normal">
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Hospital Code</span>
                              <span className="font-mono text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{h.code}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Stream</span>
                              <span className="text-slate-800 font-semibold">{(h as any).stream || "Ayurved"}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Block</span>
                              <span className="text-slate-800 font-semibold">{(h as any).block || "—"}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">District</span>
                              <span className="text-slate-800 font-semibold">{(h as any).district || "—"}</span>
                            </div>
                          </div>

                          {/* Incharge highlight */}
                          <div className="bg-white border border-slate-150 rounded-xl p-3 flex items-center justify-between shadow-sm">
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 font-sans">Incharge Status</span>
                              <span className="text-slate-800 text-xs font-bold font-sans">
                                {h.incharge ? `Hospital Incharge: ${h.incharge}` : "Hospital Incharge: Not assigned"}
                              </span>
                            </div>
                            {h.incharge ? (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold font-sans">
                                Profile Active
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold font-sans">
                                Needs Profile Update
                              </span>
                            )}
                          </div>

                          {/* Additional contact and address info */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            <div className="md:col-span-2">
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Address</span>
                              <p className="text-slate-700 leading-relaxed font-medium">{h.address || "No address listed."}</p>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Official Email</span>
                                <span className="text-slate-700 font-semibold block truncate">{h.contactEmail || "—"}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Contact Phone</span>
                                <span className="text-slate-700 font-semibold block">{h.contactPhone ? `+91 ${h.contactPhone}` : "—"}</span>
                              </div>
                            </div>
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



        {/* TABS: GOOGLE SHEETS INTEGRATION HUB */}
        {activeTab === "sheets" && (
          <ReportDesigner
            user={user}
            onSuccessToast={onSuccessToast}
            setActiveTab={() => {}}
          />
        )}

        {/* TABS: SYSTEM AUDIT LOGS */}
        {activeTab === "audits" && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">System Audit Trails & Locks</h4>
                <p className="text-xs text-slate-400">Silent chronological ledger tracking all logins, whitelist modifications, and log overrides</p>
              </div>
              <BookmarkCheck className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/30 text-[11px] space-y-1 transition-colors hover:bg-slate-50">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded uppercase">
                      {log.action}
                    </span>
                    <span className="font-semibold">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-700 font-medium">
                    {log.details}
                  </p>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    OPERATOR: {log.userName} ({log.userEmail}) | Table: {log.tableName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" id="custom-confirm-modal">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider">{confirmModal.title}</h3>
                <p className="text-sm text-slate-500 font-semibold leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
