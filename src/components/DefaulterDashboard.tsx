/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { getComponentTheme } from "../utils/theme";
import { 
  ShieldAlert, 
  Send, 
  Clock, 
  UserCheck, 
  CheckCircle, 
  AlertCircle, 
  BellRing, 
  Smartphone,
  RefreshCw,
  Loader2,
  Nfc
} from "lucide-react";
import { UserProfile } from "../types";

interface DefaulterDashboardProps {
  user: UserProfile;
  onSuccessToast: (receipt: { title: string; content: string }) => void;
}

export default function DefaulterDashboard({ user, onSuccessToast }: DefaulterDashboardProps) {
  const ct = getComponentTheme(user.role);
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [totalHospitalsCount, setTotalHospitalsCount] = useState<number>(4);
  const [isLoading, setIsLoading] = useState(false);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [nudgeTime, setNudgeTime] = useState<string>("13:30");

  const formatTime12h = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(":");
      const hr = parseInt(hours, 10);
      const ampm = hr >= 12 ? "PM" : "AM";
      const displayHr = hr % 12 || 12;
      return `${displayHr}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  useEffect(() => {
    fetchDefaulters();
  }, [month]);

  const fetchDefaulters = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/mpr/defaulters?month=${month}`);
      const data = await res.json();
      if (data.success) {
        setDefaulters(data.defaulters);
        if (typeof data.totalHospitalsCount === "number") {
          setTotalHospitalsCount(data.totalHospitalsCount);
        }
      }
    } catch (err) {
      console.error("Failed to fetch defaulters list", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNudge = async (def: any) => {
    setNudgingId(def.hospitalId);
    try {
      const res = await fetch("/api/mpr/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: def.hospitalId,
          month,
          missingCount: def.missingDates.length,
          adminEmail: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🔔 Compliance Nudge Sent",
          content: `Automated alert notification successfully dispatched to ${def.hospitalName} (${def.contactEmail})!`
        });
        // Mock updated state
        setDefaulters(prev => prev.map(d => d.hospitalId === def.hospitalId ? { ...d, nudged: true } : d));
      }
    } catch (err) {
      console.error("Nudge trigger failed", err);
    } finally {
      setNudgingId(null);
    }
  };

  // Daily scheduler trigger simulation
  const handleTriggerDailySchedule = async () => {
    setIsScheduling(true);
    try {
      const res = await fetch("/api/notifications/trigger-daily-schedule", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: formatTime12h(nudgeTime) })
      });
      const data = await res.json();
      if (data.success) {
        onSuccessToast({
          title: "🕒 Daily Schedule Broadcasted",
          content: `Simulated Web Push Notification successfully scheduled at ${formatTime12h(nudgeTime)} for all non-compliant hospital tablets/phones!`
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-6" id="defaulter-dashboard-root">
      
      {/* COGNITIVE CONTROL BANNER */}
      <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${ct.accentBg}`}>
            <ShieldAlert className={`w-6 h-6 ${ct.accentText}`} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">District Compliance Control</h3>
            <p className="text-xs text-slate-500">Real-time backlog audit monitoring and active nudges</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-current/15"
          />

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus-within:ring-2 focus-within:ring-current/15">
            <Clock className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
            <span className="text-[10px] text-slate-500 mr-1.5 font-bold uppercase">Time:</span>
            <input
              type="time"
              value={nudgeTime}
              onChange={(e) => setNudgeTime(e.target.value)}
              className={`bg-transparent border-none outline-none font-bold text-xs ${ct.accentText} w-20`}
            />
          </div>

          <button
            onClick={handleTriggerDailySchedule}
            disabled={isScheduling}
            className={`${ct.buttonBg} disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all`}
          >
            {isScheduling ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Smartphone className="w-3.5 h-3.5" />
            )}
            Simulate {formatTime12h(nudgeTime)} Broadcast
          </button>
        </div>
      </div>

      {/* COMPLIANCE OVERVIEW SUMMARY CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-2 border border-slate-850">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tracked Clinics</span>
          <span className="text-3xl font-black block">{totalHospitalsCount} Facilities</span>
          <p className="text-[10px] text-slate-400">All public health institutions registered in active master records</p>
        </div>

        <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-5 shadow-sm space-y-2`}>
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Defaulting Centers</span>
          <span className="text-3xl font-black text-rose-600 block">{defaulters.length} Facilities</span>
          <p className="text-[10px] text-slate-400">Centers missing one or more daily log entries this month</p>
        </div>

        <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-5 shadow-sm space-y-2`}>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Compliance Standard</span>
          <span className={`text-3xl font-black ${ct.accentText} block`}>
            {totalHospitalsCount === 0 ? "100%" : `${Math.max(0, Math.round(((totalHospitalsCount - defaulters.length) / totalHospitalsCount) * 100))}%`}
          </span>
          <p className="text-[10px] text-slate-400">Aggregate district compliance coefficient</p>
        </div>
      </div>

      {/* DEFAULTERS LIST / COMPLIANCE GRID */}
      {isLoading ? (
        <div className={`bg-white border ${ct.cardBorder} rounded-2xl p-12 text-center shadow-sm`}>
          <Loader2 className={`w-8 h-8 ${ct.accentText} animate-spin mx-auto mb-2`} />
          <p className="text-sm text-slate-500 font-medium">Scanning facility records for non-compliance gaps...</p>
        </div>
      ) : defaulters.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {defaulters.map((def) => {
            const isNudged = def.nudged || false;
            return (
              <div 
                key={def.hospitalId} 
                className={`bg-white border ${ct.cardBorder} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all grid grid-cols-1 lg:grid-cols-12 gap-4 items-center`}
              >
                {/* Hospital info */}
                <div className="lg:col-span-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                    <h4 className="font-bold text-slate-800 text-sm">{def.hospitalName}</h4>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider">
                    CODE: {def.hospitalCode} | Email: {def.contactEmail}
                  </div>
                </div>

                {/* Progress compliance bar */}
                <div className="lg:col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Log Compliance</span>
                    <span className="text-rose-600">{def.compliancePercentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-rose-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${def.compliancePercentage}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Logged: <strong>{def.submittedCount}</strong> / {def.expectedCount} days this month
                  </div>
                </div>

                {/* Missing days list */}
                <div className="lg:col-span-3 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Missing dates backlog</span>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {def.missingDates.map((d: string) => (
                      <span key={d} className="bg-rose-50 text-rose-700 font-mono text-[9px] px-1.5 py-0.5 rounded border border-rose-100 font-semibold">
                        {d.substring(8)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Nudge button action */}
                <div className="lg:col-span-2 text-right">
                  <button
                    onClick={() => handleNudge(def)}
                    disabled={nudgingId === def.hospitalId || isNudged}
                    className={`w-full lg:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm inline-flex ${
                      isNudged 
                        ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed" 
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                    }`}
                  >
                    {nudgingId === def.hospitalId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Alerting...
                      </>
                    ) : isNudged ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                        Nudge Alert Sent
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        1-Click Nudge
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm space-y-3">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full inline-flex">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Perfect Compliance Achieved!</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Outstanding! All registered Ayush hospitals have submitted 100% of their daily logs for the selected month {month}.
          </p>
        </div>
      )}

    </div>
  );
}
