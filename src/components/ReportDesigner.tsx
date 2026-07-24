/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { getComponentTheme } from "../utils/theme";
import { 
  UploadCloud, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  Loader2,
  Settings,
  Table,
  Layers,
  Activity,
  Download,
  Info,
  X,
  Plus,
  Users,
  ShieldCheck,
  ClipboardList
} from "lucide-react";
import { UserProfile, UserRole } from "../types";

interface ReportDesignerProps {
  user: UserProfile;
  onSuccessToast: (toast: { title: string; content: string }) => void;
  setActiveTab: (tab: string) => void;
}

export default function ReportDesigner({ user, onSuccessToast, setActiveTab }: ReportDesignerProps) {
  const ct = getComponentTheme(user.role);

  // Options Sourcing States
  const [sheetUrl, setSheetUrl] = useState("");
  const [savedSheetUrl, setSavedSheetUrl] = useState("");
  const [isConfirmingDeleteSheet, setIsConfirmingDeleteSheet] = useState(false);
  const [sheetHospitals, setSheetHospitals] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  // Bulk Registration States
  const [registrationSheetUrl, setRegistrationSheetUrl] = useState("");
  const [savedRegistrationSheetUrl, setSavedRegistrationSheetUrl] = useState("");
  const [isConfirmingDeleteRegSheet, setIsConfirmingDeleteRegSheet] = useState(false);
  const [regHospitalsPreview, setRegHospitalsPreview] = useState<any[]>([]);
  const [isSyncingReg, setIsSyncingReg] = useState(false);
  const [isSavingRegUrl, setIsSavingRegUrl] = useState(false);
  const [syncRegResult, setSyncRegResult] = useState<{
    success: boolean;
    added: number;
    updated: number;
    errors: string[];
    message?: string;
  } | null>(null);

  const showError = (title: string, message: string) => {
    onSuccessToast({
      title: `❌ ${title}`,
      content: message
    });
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      // 1. Fetch Option Sheet config
      const res1 = await fetch(`/api/admin/hospitals/sheet-config?t=${Date.now()}`);
      const d1 = await res1.json();
      if (d1.success) {
        setSheetUrl(d1.url || "");
        setSavedSheetUrl(d1.url || "");
        if (d1.url) {
          fetchOptionsPreview(d1.url);
        }
      }

      // 2. Fetch Registration Sheet config
      const res2 = await fetch(`/api/admin/hospitals/registration-sheet-config?t=${Date.now()}`);
      const d2 = await res2.json();
      if (d2.success) {
        setRegistrationSheetUrl(d2.url || "");
        setSavedRegistrationSheetUrl(d2.url || "");
        if (d2.url) {
          fetchRegistrationPreview(d2.url);
        }
      }
    } catch (err) {
      console.error("Error fetching sheet configurations:", err);
    }
  };

  const fetchOptionsPreview = async (url: string) => {
    try {
      const res = await fetch("/api/admin/hospitals/sync-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, previewOnly: true, adminEmail: user.email })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setSheetHospitals(d.hospitals || []);
        }
      }
    } catch (err) {
      console.error("Error fetching option sheet preview:", err);
    }
  };

  const fetchRegistrationPreview = async (url: string) => {
    try {
      const res = await fetch("/api/admin/hospitals/sync-registration-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, previewOnly: true, adminEmail: user.email })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setRegHospitalsPreview(d.hospitals || []);
        }
      }
    } catch (err) {
      console.error("Error fetching registration sheet preview:", err);
    }
  };

  // Option Sheet URL Handlers
  const handleSaveSheetUrl = async () => {
    if (!sheetUrl) return;
    setIsSavingUrl(true);
    try {
      const res = await fetch("/api/admin/hospitals/sheet-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl, adminEmail: user.email })
      });
      const d = await res.json();
      if (d.success) {
        setSavedSheetUrl(sheetUrl);
        onSuccessToast({
          title: "🔗 Options Sheet Link Saved",
          content: "Google spreadsheet link was successfully stored in the system configuration."
        });
        fetchOptionsPreview(sheetUrl);
      } else {
        showError("Save Failed", d.message || "Failed to save options sheet URL.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Save Error", err.message || String(err));
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleDeleteSheetUrl = async () => {
    setIsSavingUrl(true);
    try {
      const res = await fetch(`/api/admin/hospitals/sheet-config?adminEmail=${encodeURIComponent(user.email)}`, {
        method: "DELETE"
      });
      const d = await res.json();
      if (d.success) {
        setSheetUrl("");
        setSavedSheetUrl("");
        setSheetHospitals([]);
        onSuccessToast({
          title: "🗑️ Options Sheet Link Removed",
          content: "Google sheet link was successfully deleted from configuration."
        });
      } else {
        showError("Remove Failed", d.message || "Failed to remove options sheet link.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Remove Error", err.message || String(err));
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    if (!sheetUrl) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/hospitals/sync-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl, previewOnly: false, adminEmail: user.email })
      });
      
      if (!res.ok) {
         const errorText = await res.text();
         throw new Error(errorText || "Internal server error occurred.");
      }

      const d = await res.json();
      if (d.success) {
        setSheetHospitals(d.hospitals || []);
        onSuccessToast({
          title: "🔄 Directory Sync Successful",
          content: d.message || "Uttarakhand Ayush Master drop-down options successfully synchronized."
        });
        // Dispatch custom event to trigger real-time updates everywhere
        window.dispatchEvent(new CustomEvent("hospitals-updated"));
      } else {
        showError("Sync Failed", d.message || "Google Sheet sync failed.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Sync Failed", err.message || String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  // Registration Sheet URL Handlers
  const handleSaveRegSheetUrl = async () => {
    if (!registrationSheetUrl) return;
    setIsSavingRegUrl(true);
    try {
      const res = await fetch("/api/admin/hospitals/registration-sheet-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: registrationSheetUrl, adminEmail: user.email })
      });
      const d = await res.json();
      if (d.success) {
        setSavedRegistrationSheetUrl(registrationSheetUrl);
        onSuccessToast({
          title: "🔗 Registration Sheet Link Saved",
          content: "Bulk registration Google Sheet link was successfully stored."
        });
        fetchRegistrationPreview(registrationSheetUrl);
      } else {
        showError("Save Failed", d.message || "Failed to save registration sheet URL.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Save Error", err.message || String(err));
    } finally {
      setIsSavingRegUrl(false);
    }
  };

  const handleDeleteRegSheetUrl = async () => {
    setIsSavingRegUrl(true);
    try {
      const res = await fetch(`/api/admin/hospitals/registration-sheet-config?adminEmail=${encodeURIComponent(user.email)}`, {
        method: "DELETE"
      });
      const d = await res.json();
      if (d.success) {
        setRegistrationSheetUrl("");
        setSavedRegistrationSheetUrl("");
        setRegHospitalsPreview([]);
        setSyncRegResult(null);
        onSuccessToast({
          title: "🗑️ Registration Sheet Removed",
          content: "Google Sheet registration link removed successfully."
        });
      } else {
        showError("Remove Failed", d.message || "Failed to remove registration sheet link.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Remove Error", err.message || String(err));
    } finally {
      setIsSavingRegUrl(false);
    }
  };

  const handleSyncRegistrationSheet = async () => {
    if (!registrationSheetUrl) return;
    setIsSyncingReg(true);
    setSyncRegResult(null);
    try {
      const res = await fetch("/api/admin/hospitals/sync-registration-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: registrationSheetUrl, previewOnly: false, adminEmail: user.email })
      });

      if (!res.ok) {
         const errorText = await res.text();
         throw new Error(errorText || "Internal server error occurred.");
      }

      const d = await res.json();
      if (d.success) {
        setSyncRegResult({
          success: true,
          added: d.added || 0,
          updated: d.updated || 0,
          errors: d.errors || []
        });
        onSuccessToast({
          title: "🚀 Registration & Credentials Synced",
          content: `Successfully registered ${d.added || 0} new hospitals and updated ${d.updated || 0} existing profiles.`
        });
        window.dispatchEvent(new CustomEvent("hospitals-updated"));
      } else {
        showError("Sync Failed", d.message || "Google Sheet bulk registration failed.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Sync Error", err.message || String(err));
    } finally {
      setIsSyncingReg(false);
    }
  };

  const downloadCSVEnergyTemplate = () => {
    const headers = [
      "Name", "Code", "Type", "Location", "Address", "ContactEmail", "ContactPhone", "Incharge", "Block", "District", "Stream", "Password"
    ];
    const sampleRow = [
      "Government Ayurvedic Hospital Dehradun",
      "SAD-DDN-789",
      "राजकीय आयुर्वेदिक चिकित्सालय",
      "Dehradun",
      "Rajpur Road, Near Clock Tower, Dehradun",
      "ddnayush",
      "9876543210",
      "Dr. Ashutosh Pant",
      "Dehradun Sadar",
      "Dehradun",
      "Ayurved",
      "ayushpass123"
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), sampleRow.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ayush_hospital_registration_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onSuccessToast({
      title: "📥 Template Downloaded",
      content: "CSV template downloaded! You can import this into Google Sheets, fill it, and copy the sheet URL."
    });
  };

  return (
    <div className="space-y-8" id="report-customizer-root">
      
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl border border-current/10 ${ct.accentBg}`}>
            <Table className={`w-6 h-6 ${ct.accentText}`} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">Dynamic Google Sheets Integration Hub</h3>
            <p className="text-xs text-slate-500">Synchronize master dropdown options, register healthcare facilities, and dynamically configure secure passwords using live Google Sheets.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* PANEL 1: DROPDOWN OPTIONS POOL SYNC */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Settings className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">1. Dropdown Options & Master Directory</h4>
                <p className="text-[11px] text-slate-400 font-medium">Keep dropdown lists (Blocks, Districts, Streams, Locations) dynamically populated.</p>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-[11px] space-y-2">
              <span className="font-black text-emerald-800 uppercase tracking-wide block">💡 Dropdown Sheet Schema</span>
              <p className="text-slate-600 leading-normal">
                Columns recognized: <code className="bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">name</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">type</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">location</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">block</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">district</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">stream</code>. Make sure spreadsheet visibility is set to <strong>"Anyone with the link can view"</strong>.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                Google Sheets Document Link
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit#gid=0"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={handleSaveSheetUrl}
                  disabled={isSavingUrl || !sheetUrl}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isSavingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save link"}
                </button>
                {savedSheetUrl && (
                  <div className="relative flex items-center shrink-0">
                    {isConfirmingDeleteSheet ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-xl p-1 shrink-0">
                        <button
                          onClick={handleDeleteSheetUrl}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] px-2 py-1.5 rounded-lg transition-all"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setIsConfirmingDeleteSheet(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[9px] px-2 py-1.5 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsConfirmingDeleteSheet(true)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-2 rounded-xl border border-rose-200 transition-all"
                        title="Remove link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-300" />
              Auto-updates options pool of the master registration dropdown menus.
            </span>
            {user.role === "SUPER_ADMIN" ? (
              <button
                onClick={handleSyncGoogleSheet}
                disabled={isSyncing || !savedSheetUrl}
                className="bg-emerald-800 hover:bg-emerald-950 text-white font-extrabold text-xs px-4.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
              >
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-200" />}
                Sync Options Pool
              </button>
            ) : (
              <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 font-bold px-2 py-1.5 rounded-lg">
                Super Admin sync only
              </span>
            )}
          </div>
        </div>

        {/* PANEL 2: BULK REGISTRATION WITH PASSWORDS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">2. Hospital Bulk Registration & logins</h4>
                  <p className="text-[11px] text-slate-400 font-medium">Bulk import hospitals, configure default in-charge medical logins and set custom passwords.</p>
                </div>
              </div>
              <button
                onClick={downloadCSVEnergyTemplate}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
                title="Get pre-formatted spreadsheet layout with all correct columns"
              >
                <Download className="w-3.5 h-3.5" />
                Get Blank Template
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-[11px] space-y-2">
              <span className="font-black text-blue-800 uppercase tracking-wide block">💡 Bulk Upload Instructions</span>
              <p className="text-slate-600 leading-normal">
                Your spreadsheet must match the downloaded template exactly with headers: <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Name</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Code</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Type</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Location</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Address</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">ContactEmail</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">ContactPhone</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Incharge</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Block</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">District</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Stream</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">Password</code>.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                Google Sheets Bulk Registration URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1XW_M8.../edit#gid=0"
                  value={registrationSheetUrl}
                  onChange={(e) => setRegistrationSheetUrl(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={handleSaveRegSheetUrl}
                  disabled={isSavingRegUrl || !registrationSheetUrl}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isSavingRegUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save link"}
                </button>
                {savedRegistrationSheetUrl && (
                  <div className="relative flex items-center shrink-0">
                    {isConfirmingDeleteRegSheet ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-xl p-1 shrink-0">
                        <button
                          onClick={handleDeleteRegSheetUrl}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] px-2 py-1.5 rounded-lg transition-all"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setIsConfirmingDeleteRegSheet(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[9px] px-2 py-1.5 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsConfirmingDeleteRegSheet(true)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-2 rounded-xl border border-rose-200 transition-all"
                        title="Remove link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              Registers new clinics and updates user passwords dynamically.
            </span>
            {user.role === "SUPER_ADMIN" ? (
              <button
                onClick={handleSyncRegistrationSheet}
                disabled={isSyncingReg || !savedRegistrationSheetUrl}
                className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs px-4.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
              >
                {isSyncingReg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-4 h-4 text-blue-200" />}
                Apply & Register clinics
              </button>
            ) : (
              <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 font-bold px-2 py-1.5 rounded-lg">
                Super Admin sync only
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SYNC REGISTRATION RESPONSE DETAILS */}
      {syncRegResult && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h4 className="font-extrabold text-xs tracking-wide uppercase">Bulk Registration Report (पंजीकरण रिपोर्ट)</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="block text-[10px] text-slate-400 uppercase font-black">Newly Registered</span>
              <span className="block text-2xl font-black text-emerald-400 mt-1">{syncRegResult.added}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="block text-[10px] text-slate-400 uppercase font-black">Updated profiles</span>
              <span className="block text-2xl font-black text-blue-400 mt-1">{syncRegResult.updated}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="block text-[10px] text-slate-400 uppercase font-black">Validation errors</span>
              <span className="block text-2xl font-black text-rose-400 mt-1">{syncRegResult.errors.length}</span>
            </div>
          </div>
          {syncRegResult.errors.length > 0 && (
            <div className="bg-rose-950/40 border border-rose-900/50 rounded-2xl p-4 text-[11px] text-rose-300 space-y-1.5">
              <span className="font-bold block">🚨 Row Validation Errors:</span>
              <ul className="list-disc pl-4 space-y-1 max-h-36 overflow-y-auto">
                {syncRegResult.errors.map((err, idx) => (
                  <li key={idx} className="font-mono">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* GRID SHOWING BOTH LIVE PREVIEWS SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        
        {/* PREVIEW 1: DROPDOWN OPTIONS EXTRACTED */}
        {sheetHospitals.length > 0 && (() => {
          const uniqueTypes = Array.from(new Set(sheetHospitals.map(h => h.type).filter(Boolean))).sort();
          const uniqueLocations = Array.from(new Set(sheetHospitals.map(h => h.location).filter(Boolean))).sort();
          const uniqueStreams = Array.from(new Set(sheetHospitals.map(h => h.stream).filter(Boolean))).sort();
          const uniqueBlocks = Array.from(new Set(sheetHospitals.map(h => h.block).filter(Boolean))).sort();
          const uniqueDistricts = Array.from(new Set(sheetHospitals.map(h => h.district).filter(Boolean))).sort();

          return (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-950 text-xs flex items-center gap-1.5 uppercase">
                      <ClipboardList className="w-4.5 h-4.5 text-emerald-600" />
                      Extracted Option Pools (निकाले गए विकल्प पूल)
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5 leading-relaxed">
                      Unique values pulled dynamically from Google Sheet to feed input menu options.
                    </p>
                  </div>
                  <button
                    onClick={() => setSheetHospitals([])}
                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3.5 max-h-[350px] overflow-y-auto pr-1 text-[11px] font-bold">
                  
                  {/* Districts */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-1.5">
                    <span className="block text-[9px] uppercase text-slate-400">Districts ({uniqueDistricts.length})</span>
                    <div className="space-y-1 max-h-24 overflow-y-auto font-semibold text-slate-700">
                      {uniqueDistricts.map((d, i) => <div key={i} className="bg-white border border-slate-100 px-2 py-1 rounded-lg truncate">{d}</div>)}
                    </div>
                  </div>

                  {/* Blocks */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-1.5">
                    <span className="block text-[9px] uppercase text-slate-400">Blocks ({uniqueBlocks.length})</span>
                    <div className="space-y-1 max-h-24 overflow-y-auto font-semibold text-slate-700">
                      {uniqueBlocks.map((b, i) => <div key={i} className="bg-white border border-slate-100 px-2 py-1 rounded-lg truncate">{b}</div>)}
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-1.5">
                    <span className="block text-[9px] uppercase text-slate-400">Locations ({uniqueLocations.length})</span>
                    <div className="space-y-1 max-h-24 overflow-y-auto font-semibold text-slate-700">
                      {uniqueLocations.map((l, i) => <div key={i} className="bg-white border border-slate-100 px-2 py-1 rounded-lg truncate">{l}</div>)}
                    </div>
                  </div>

                  {/* Streams */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-1.5">
                    <span className="block text-[9px] uppercase text-slate-400">Streams ({uniqueStreams.length})</span>
                    <div className="space-y-1 max-h-24 overflow-y-auto font-semibold text-slate-700">
                      {uniqueStreams.map((s, i) => <div key={i} className="bg-white border border-slate-100 px-2 py-1 rounded-lg truncate text-emerald-700">{s}</div>)}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

        {/* PREVIEW 2: HOSPITAL REGISTRATIONS PREVIEW GRID */}
        {regHospitalsPreview.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-950 text-xs flex items-center gap-1.5 uppercase">
                    <Users className="w-4.5 h-4.5 text-blue-600" />
                    Pending registration records ({regHospitalsPreview.length})
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5 leading-relaxed">
                    Hospitals read from the linked sheet. Click 'Apply & Register' above to commit updates and configure login access.
                  </p>
                </div>
                <button
                  onClick={() => setRegHospitalsPreview([])}
                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto max-h-[350px] overflow-y-auto pr-1 border border-slate-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-black tracking-wide sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Name / Type</th>
                      <th className="py-2.5 px-3">Credentials (Login)</th>
                      <th className="py-2.5 px-3">Incharge</th>
                      <th className="py-2.5 px-3">Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {regHospitalsPreview.map((h, i) => {
                      const emailPrefix = h.contactEmail || "";
                      const fullEmail = emailPrefix.includes("@") ? emailPrefix : `${emailPrefix}@uttarakhandayurved.co.in`;
                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3">
                            <span className="block font-bold text-slate-900 truncate max-w-[160px]">{h.name || `${h.type} - ${h.location}`}</span>
                            <span className="block text-[9px] text-slate-400 truncate max-w-[160px]">{h.type}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] text-blue-700 block truncate max-w-[150px]">{fullEmail}</span>
                            <span className="text-[9px] text-slate-400 block">{h.contactPhone || "No Phone"}</span>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800">
                            <span className="block truncate max-w-[100px]">{h.incharge || "Not Specified"}</span>
                            <span className="block text-[9px] text-slate-400">{h.district}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                              {h.password || "123456"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
      </div>

    </div>
  );
}
