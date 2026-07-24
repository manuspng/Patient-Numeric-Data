import React, { useState, useEffect } from "react";
import { SlidersHorizontal, Info, ShieldCheck, DollarSign, ArrowRight } from "lucide-react";
import { UserProfile, UserRole } from "../types";
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

interface FacilitySettingsProps {
  user: UserProfile;
  hospitalId: string;
  hospitalName: string;
  onSuccessToast: (msg: { title: string; content: string }) => void;
  onProfileUpdate?: (updatedUser: UserProfile) => void;
  hasIpd: boolean;
  setHasIpd: (val: boolean) => void;
  hasPanchkarma: boolean;
  setHasPanchkarma: (val: boolean) => void;
  alwaysAllowInventoryEdit: boolean;
  setAlwaysAllowInventoryEdit: (val: boolean) => void;
}

export const FacilitySettings: React.FC<FacilitySettingsProps> = ({
  user,
  hospitalId,
  hospitalName,
  onSuccessToast,
  onProfileUpdate,
  hasIpd,
  setHasIpd,
  hasPanchkarma,
  setHasPanchkarma,
  alwaysAllowInventoryEdit,
  setAlwaysAllowInventoryEdit,
}) => {
  const ct = getComponentTheme(user.role);
  const [opdRate, setOpdRate] = useState<number>(5);
  const [ipdRate, setIpdRate] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isHospitalUser = user.role === UserRole.HOSPITAL_USER;
  const [profileName, setProfileName] = useState(user.name);
  const [profileDesignation, setProfileDesignation] = useState(user.designation || "Clinical Super Admin");
  const [profileContact, setProfileContact] = useState(user.phone || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync profile details when user prop changes
  useEffect(() => {
    setProfileName(user.name);
    setProfileDesignation(user.designation || "Clinical Super Admin");
    setProfileContact(user.phone || "");
  }, [user]);

  // Load existing settings on mount
  useEffect(() => {
    try {
      const stored = safeStorage.getItem(`facility-settings-${hospitalId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setOpdRate(parsed.opd_levy_rate !== undefined ? Number(parsed.opd_levy_rate) : 5);
        setIpdRate(parsed.ipd_levy_rate !== undefined ? Number(parsed.ipd_levy_rate) : 10);
      } else {
        setOpdRate(5);
        setIpdRate(10);
      }
    } catch (e) {
      console.warn("Failed to load facility settings", e);
      setOpdRate(5);
      setIpdRate(10);
    }
  }, [hospitalId]);

  const handleSave = () => {
    setIsSaving(true);
    try {
      const settings = {
        opd_levy_rate: opdRate,
        ipd_levy_rate: ipdRate,
        updatedAt: new Date().toISOString(),
      };
      safeStorage.setItem(`facility-settings-${hospitalId}`, JSON.stringify(settings));
      safeStorage.setItem(`facility-has-ipd-${hospitalId}`, String(hasIpd));
      safeStorage.setItem(`facility-has-panchkarma-${hospitalId}`, String(hasPanchkarma));
      safeStorage.setItem(`facility-always-allow-inventory-edit-${hospitalId}`, String(alwaysAllowInventoryEdit));
      
      setTimeout(() => {
        setIsSaving(false);
        onSuccessToast({
          title: "🔧 Settings Saved Successfully",
          content: `Levy rates and active departments updated. Daily entry panels will dynamically adapt to these configurations.`,
        });
      }, 500);
    } catch (e) {
      console.error("Failed to save facility settings", e);
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/admin/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: profileName,
          designation: profileDesignation,
          contact: profileContact,
          phone: profileContact
        })
      });
      const data = await res.json();
      if (data.success) {
        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        onSuccessToast({
          title: "👤 Profile Updated Successfully",
          content: "Your Super Admin details (Name, Designation, and Contact) have been securely saved to Firestore."
        });
      } else {
        alert(data.message || "Failed to update profile.");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while updating your profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const rateOptions = [0, 5, 10, 15, 20];

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="facility-settings-tab-view">
      {/* Super Admin Profile Editor */}
      {isSuperAdmin && (
        <div className={`bg-white border ${ct.cardBorder} rounded-3xl p-6 sm:p-8 shadow-sm space-y-6`}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="p-2 bg-slate-50 text-slate-700 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Super Admin Profile Details</h3>
              <p className="text-[11px] text-slate-400 font-medium">Manage your personal credential metadata saved in the live cloud database</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 transition-all outline-none"
                placeholder="Dr. M. P. Singh"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Designation
              </label>
              <input
                type="text"
                value={profileDesignation}
                onChange={(e) => setProfileDesignation(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 transition-all outline-none"
                placeholder="Senior Clinical Director / Super Admin"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Contact Phone / WhatsApp
              </label>
              <input
                type="text"
                value={profileContact}
                onChange={(e) => setProfileContact(e.target.value)}
                className="w-full text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 transition-all outline-none"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSavingProfile ? "Saving Profile..." : "Update Profile Details"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Panel */}
      {isHospitalUser && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className={`md:col-span-3 bg-white border ${ct.cardBorder} rounded-3xl p-6 sm:p-8 shadow-sm space-y-6`}>
            <h3 className={`text-xs font-black text-slate-400 uppercase tracking-widest border-b ${ct.cardBorder} pb-3`}>
              Levy Rate Configuration
            </h3>

            <div className="space-y-6">
              {/* OPD Rate selector */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${ct.accentText.replace('text-', 'bg-')}`}></span>
                    OPD Levy Rate (नवीन रोगी)
                  </label>
                  <span className={`text-xs font-black font-mono ${ct.accentText} ${ct.badgeBg} px-2.5 py-0.5 rounded-full`}>
                    ₹{opdRate} / card
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  Select the government fee charged per newly registered OPD card.
                </p>
                
                <div className="grid grid-cols-5 gap-2">
                  {rateOptions.map((rate) => (
                    <button
                      key={`opd-opt-${rate}`}
                      type="button"
                      onClick={() => setOpdRate(rate)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        opdRate === rate
                          ? `${ct.buttonBg} text-white border-current shadow-md scale-102`
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      ₹{rate}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1.5">
                  <span className="text-xs font-medium text-slate-500">Custom Rate:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={opdRate}
                      onChange={(e) => setOpdRate(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* IPD Rate selector */}
              <div className={`space-y-3 pt-4 border-t ${ct.cardBorder}`}>
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${ct.accentText.replace('text-', 'bg-')}`}></span>
                    IPD Levy Rate (नवीन रोगी भर्ती)
                  </label>
                  <span className={`text-xs font-black font-mono ${ct.accentText} ${ct.badgeBg} px-2.5 py-0.5 rounded-full`}>
                    ₹{ipdRate} / admission
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  Select the government fee charged per newly admitted IPD patient.
                </p>

                <div className="grid grid-cols-5 gap-2">
                  {rateOptions.map((rate) => (
                    <button
                      key={`ipd-opt-${rate}`}
                      type="button"
                      onClick={() => setIpdRate(rate)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        ipdRate === rate
                          ? `${ct.buttonBg} text-white border-current shadow-md scale-102`
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      ₹{rate}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1.5">
                  <span className="text-xs font-medium text-slate-500">Custom Rate:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={ipdRate}
                      onChange={(e) => setIpdRate(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-current/15 focus:border-current outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Active Departments & Capabilities */}
              <div className={`space-y-4 pt-6 border-t ${ct.cardBorder}`} id="active-departments-config-section">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Active Facility Departments
                  </label>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  Toggle which departments are active in your hospital. Inactive departments will be hidden from your Daily Log entries to optimize your workspace.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* IPD Toggle Card */}
                  <div className={`p-4 border rounded-2xl transition-all duration-200 ${
                    hasIpd 
                      ? `${ct.subSectionBg} shadow-xs` 
                      : "bg-slate-50/50 border-slate-200/60"
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Inpatient Dept (IPD)
                      </span>
                      <button
                        type="button"
                        onClick={() => setHasIpd(!hasIpd)}
                        className={`${
                          hasIpd ? ct.accentText.replace('text-', 'bg-') : 'bg-slate-200'
                        } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                      >
                        <span
                          className={`${
                            hasIpd ? 'translate-x-5' : 'translate-x-0'
                          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Enables admissions logging, IPD breakdown, and dynamic IPD levy calculations on the daily log entry.
                    </p>
                  </div>

                  {/* Panchkarma Toggle Card */}
                  <div className={`p-4 border rounded-2xl transition-all duration-200 ${
                    hasPanchkarma 
                      ? `${ct.subSectionBg} shadow-xs` 
                      : "bg-slate-50/50 border-slate-200/60"
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Panchkarma Dept
                      </span>
                      <button
                        type="button"
                        onClick={() => setHasPanchkarma(!hasPanchkarma)}
                        className={`${
                          hasPanchkarma ? ct.accentText.replace('text-', 'bg-') : 'bg-slate-200'
                        } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                      >
                        <span
                          className={`${
                            hasPanchkarma ? 'translate-x-5' : 'translate-x-0'
                          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Enables Panchkarma gender-wise counts, procedure counters, and manual procedure levy tracking.
                    </p>
                  </div>
                </div>
              </div>

              {/* Inventory & Stock Settings */}
              <div className={`space-y-4 pt-6 border-t ${ct.cardBorder}`} id="inventory-stock-rule-config-section">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${ct.accentText.replace('text-', 'bg-')}`}></span>
                    Inventory & Stock Settings
                  </label>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  To maintain strict inventory auditing, opening balance values are normally only editable in the month of April (the start of the financial year). Toggle the switch below to allow manual override edits in any month of the year.
                </p>

                <div className={`p-4 border rounded-2xl transition-all duration-200 ${
                  alwaysAllowInventoryEdit 
                    ? `${ct.subSectionBg} shadow-xs` 
                    : "bg-slate-50/50 border-slate-200/60"
                }`}>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Always Allow Stock Balance Edits
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        सत्र के बीच प्रारंभिक स्टॉक संपादन की अनुमति दें
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlwaysAllowInventoryEdit(!alwaysAllowInventoryEdit)}
                      className={`${
                        alwaysAllowInventoryEdit ? ct.accentText.replace('text-', 'bg-') : 'bg-slate-200'
                      } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                    >
                      <span
                        className={`${
                          alwaysAllowInventoryEdit ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    When enabled, opening balances of diagnostic kits can be modified at any time. When disabled, they can only be changed for entries recorded in the month of April.
                  </p>
                </div>
              </div>
            </div>

            <div className={`pt-6 border-t ${ct.cardBorder} flex justify-end`}>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`${ct.buttonBg} disabled:opacity-50 text-white font-extrabold text-xs px-6 py-3 rounded-2xl shadow-lg shadow-current/15 transition-all flex items-center gap-2 cursor-pointer`}
              >
                {isSaving ? "Saving Config..." : "Save Settings & Update Rates"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
