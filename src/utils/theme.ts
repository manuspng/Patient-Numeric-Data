import { UserRole } from "../types";

export interface ComponentTheme {
  cardBg: string;
  cardBorder: string;
  headerIcon: string;
  headerText: string;
  subHeader: string;
  subSectionBg: string;
  badgeBg: string;
  rowHighlightBg: string;
  buttonBg: string;
  totalDisplayBg: string;
  totalDisplaySub: string;
  totalBadge: string;
  computedBg: string;
  accentText: string;
  accentBg: string;
  calendarSelected: string;
  calendarSubmitted: string;
}

export const getComponentTheme = (role: UserRole): ComponentTheme => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return {
        cardBg: "bg-white border-[#DCD0C0]",
        cardBorder: "border-[#DCD0C0]",
        headerIcon: "text-[#8D6E63]",
        headerText: "text-[#3E2723]",
        subHeader: "text-[#5C4033]",
        subSectionBg: "bg-[#FAF6F0] border-[#EADBC8]",
        badgeBg: "bg-[#A1887F]/15 text-[#5D4037] border-[#A1887F]/30",
        rowHighlightBg: "hover:bg-[#EADBC8]/30",
        buttonBg: "bg-[#8D6E63] hover:bg-[#7D5A50] text-white",
        totalDisplayBg: "bg-[#5D4037] border-[#4E342E] text-white",
        totalDisplaySub: "text-[#D5C0AB]",
        totalBadge: "bg-[#FAF6F0] border-[#EADBC8] text-[#3E2723]",
        computedBg: "bg-[#FAF6F0] border-[#EADBC8] text-[#3E2723]",
        accentText: "text-[#8D6E63]",
        accentBg: "bg-[#8D6E63]/10",
        calendarSelected: "bg-[#8D6E63] text-white font-bold ring-2 ring-[#8D6E63]/30",
        calendarSubmitted: "bg-[#FAF6F0] text-[#5C4033] font-semibold border border-[#EADBC8]"
      };
    case UserRole.DAUO:
      return {
        cardBg: "bg-white border-indigo-100",
        cardBorder: "border-indigo-100",
        headerIcon: "text-indigo-600",
        headerText: "text-indigo-950",
        subHeader: "text-indigo-900",
        subSectionBg: "bg-indigo-50/30 border-indigo-100",
        badgeBg: "bg-indigo-100 text-indigo-800 border-indigo-200/50",
        rowHighlightBg: "hover:bg-indigo-50/40",
        buttonBg: "bg-indigo-700 hover:bg-indigo-800 text-white",
        totalDisplayBg: "bg-indigo-950 border-indigo-900 text-white",
        totalDisplaySub: "text-indigo-300",
        totalBadge: "bg-indigo-900 border-indigo-800 text-white",
        computedBg: "bg-indigo-50/80 border-indigo-100 text-indigo-900",
        accentText: "text-indigo-600",
        accentBg: "bg-indigo-50",
        calendarSelected: "bg-indigo-700 text-white font-bold ring-2 ring-indigo-500/30",
        calendarSubmitted: "bg-indigo-50 text-indigo-800 font-semibold border border-indigo-100"
      };
    case UserRole.HOSPITAL_USER:
    default:
      return {
        cardBg: "bg-white border-[#D6BCFA]",
        cardBorder: "border-[#D6BCFA]",
        headerIcon: "text-[#8E24AA]",
        headerText: "text-[#311B92]",
        subHeader: "text-[#4A148C]",
        subSectionBg: "bg-[#FAF5FF] border-[#E9D5FF]",
        badgeBg: "bg-[#9C27B0]/10 text-[#4A148C] border-[#9C27B0]/20",
        rowHighlightBg: "hover:bg-[#FAF5FF]",
        buttonBg: "bg-[#8E24AA] hover:bg-[#7B1FA2] text-white",
        totalDisplayBg: "bg-[#311B92] border-[#4A148C] text-white",
        totalDisplaySub: "text-[#E9D5FF]",
        totalBadge: "bg-[#FAF5FF] border-[#E9D5FF] text-[#311B92]",
        computedBg: "bg-[#FAF5FF] border-[#E9D5FF] text-[#311B92]",
        accentText: "text-[#8E24AA]",
        accentBg: "bg-[#FAF5FF]",
        calendarSelected: "bg-[#8E24AA] text-white font-bold ring-2 ring-[#8E24AA]/30",
        calendarSubmitted: "bg-[#FAF5FF] text-[#4A148C] font-semibold border border-[#E9D5FF]"
      };
  }
};
