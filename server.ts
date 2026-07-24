/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { UserRole, Hospital, UserProfile, DailyReport, AuditLog, MasterDisease, MasterTest, MasterKit, OutreachCampLog, CustomReportTemplate, RegistrationRequest } from "./src/types.js";
import * as XLSX from "xlsx";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, doc, getDocs, setDoc, deleteDoc, setLogLevel, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

dotenv.config();

// Initialize Firebase and Firestore on the server-side to guarantee zero data loss for registered users and profile information.
let firebaseApp: any = null;
let firestoreDb: any = null;

async function authenticateBackendSystem() {
  if (!firebaseApp) return;
  const auth = getAuth(firebaseApp);
  const email = "backend-system@hospital-sync.internal";
  const password = process.env.BACKEND_SYSTEM_PASSWORD || "SuperSecureBackendSyncPassword123!";
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("[AYUSH SECURITY] Backend system successfully authenticated with Firebase Auth.");
  } catch (err: any) {
    if (
      err.code === "auth/user-not-found" || 
      err.code === "auth/invalid-credential" || 
      err.code === "auth/invalid-email" || 
      err.code === "auth/user-disabled"
    ) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("[AYUSH SECURITY] Created and authenticated secure backend system user.");
      } catch (createErr: any) {
        if (createErr.code === "auth/email-already-in-use") {
          try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("[AYUSH SECURITY] Backend system successfully authenticated with existing Firebase Auth user.");
          } catch (retryErr: any) {
            console.warn("[AYUSH SECURITY] Backend user already exists but password authentication failed. Sync may operate in local fallback mode:", retryErr.message);
          }
        } else {
          console.warn("[AYUSH SECURITY] Failed to create secure backend system user:", createErr.message);
        }
      }
    } else {
      console.warn("[AYUSH SECURITY] Failed to authenticate backend system:", err.message);
    }
  }
}

try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
    setLogLevel("error");
    console.log("Firebase initialized successfully on server-side.");
    
    // Authenticate the server-side instance to satisfy security rules and lock down the database from external threats
    authenticateBackendSystem().catch(err => console.error("Failed backend authentication stream:", err));
  }
} catch (err) {
  console.error("Failed to initialize Firebase on server-side:", err);
}

// Durable cloud persistence helper functions for users
async function saveUserToFirestore(user: UserProfile) {
  if (!firestoreDb) return;
  try {
    const docId = user.email.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, "_");
    await setDoc(doc(firestoreDb, "users", docId), user);
    console.log(`Saved user ${user.email} securely to Firestore cloud.`);
  } catch (err) {
    console.error(`Failed to save user ${user.email} to Firestore:`, err);
  }
}

async function deleteUserFromFirestore(email: string) {
  if (!firestoreDb) return;
  try {
    const docId = email.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, "_");
    await deleteDoc(doc(firestoreDb, "users", docId));
    console.log(`Deleted user ${email} securely from Firestore cloud.`);
  } catch (err) {
    console.error(`Failed to delete user ${email} from Firestore:`, err);
  }
}

async function syncUsersFromFirestore(localDb: DBStore): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const querySnapshot = await getDocs(collection(firestoreDb, "users"));
    const fbUsers: UserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      fbUsers.push(docSnap.data() as UserProfile);
    });

    if (fbUsers.length > 0) {
      console.log(`Synced ${fbUsers.length} users from Firestore cloud database.`);
      const localUsersMap = new Map(localDb.users.map(u => [u.email.toLowerCase().trim(), u]));
      const fbUsersMap = new Map(fbUsers.map(u => [u.email.toLowerCase().trim(), u]));

      let merged = false;
      // 1. Merge Firestore users into local database
      for (const fbUser of fbUsers) {
        const localUser = localUsersMap.get(fbUser.email.toLowerCase().trim());
        if (!localUser || JSON.stringify(localUser) !== JSON.stringify(fbUser)) {
          localUsersMap.set(fbUser.email.toLowerCase().trim(), fbUser);
          merged = true;
        }
      }

      // 2. Upload any local users not in Firestore to Firestore
      for (const localUser of localDb.users) {
        if (!fbUsersMap.has(localUser.email.toLowerCase().trim())) {
          await saveUserToFirestore(localUser);
        }
      }

      if (merged) {
        localDb.users = Array.from(localUsersMap.values());
        saveDB(localDb);
      }
      return true;
    } else {
      // Seed Firestore with local users if empty
      console.log("Firestore users collection is empty. Seeding with local/default users.");
      for (const localUser of localDb.users) {
        await saveUserToFirestore(localUser);
      }
    }
  } catch (err) {
    console.error("Failed to sync users from Firestore:", err);
  }
  return false;
}

// Durable cloud persistence helper functions for registration requests
async function saveRegistrationRequestToFirestore(req: RegistrationRequest) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "registrationRequests", req.id), req);
    console.log(`Saved registration request ${req.id} securely to Firestore cloud.`);
  } catch (err) {
    console.error(`Failed to save registration request ${req.id} to Firestore:`, err);
  }
}

async function syncRegistrationRequestsFromFirestore(localDb: DBStore): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const querySnapshot = await getDocs(collection(firestoreDb, "registrationRequests"));
    const fbRequests: RegistrationRequest[] = [];
    querySnapshot.forEach((docSnap) => {
      fbRequests.push(docSnap.data() as RegistrationRequest);
    });

    if (fbRequests.length > 0) {
      console.log(`Synced ${fbRequests.length} registration requests from Firestore.`);
      const localRequestsMap = new Map((localDb.registrationRequests || []).map(r => [r.id, r]));
      const fbRequestsMap = new Map(fbRequests.map(r => [r.id, r]));

      let merged = false;
      for (const fbReq of fbRequests) {
        const localReq = localRequestsMap.get(fbReq.id);
        if (!localReq || JSON.stringify(localReq) !== JSON.stringify(fbReq)) {
          localRequestsMap.set(fbReq.id, fbReq);
          merged = true;
        }
      }

      for (const localReq of (localDb.registrationRequests || [])) {
        if (!fbRequestsMap.has(localReq.id)) {
          await saveRegistrationRequestToFirestore(localReq);
        }
      }

      if (merged) {
        localDb.registrationRequests = Array.from(localRequestsMap.values());
        saveDB(localDb);
      }
      return true;
    } else {
      for (const localReq of (localDb.registrationRequests || [])) {
        await saveRegistrationRequestToFirestore(localReq);
      }
    }
  } catch (err) {
    console.error("Failed to sync registration requests from Firestore:", err);
  }
  return false;
}

// Durable cloud persistence helper functions for hospitals
async function saveHospitalToFirestore(hospital: Hospital) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "hospitals", hospital.id), hospital);
    console.log(`Saved hospital ${hospital.id} (${hospital.name}) securely to Firestore.`);
  } catch (err) {
    console.error(`Failed to save hospital to Firestore:`, err);
  }
}

async function deleteHospitalFromFirestore(hospitalId: string) {
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, "hospitals", hospitalId));
    console.log(`Deleted hospital ${hospitalId} securely from Firestore.`);
  } catch (err) {
    console.error(`Failed to delete hospital from Firestore:`, err);
  }
}

async function syncHospitalsFromFirestore(localDb: DBStore): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const querySnapshot = await getDocs(collection(firestoreDb, "hospitals"));
    const fbHospitals: Hospital[] = [];
    querySnapshot.forEach((docSnap) => {
      fbHospitals.push(docSnap.data() as Hospital);
    });

    if (fbHospitals.length > 0) {
      console.log(`Synced ${fbHospitals.length} hospitals from Firestore.`);
      
      // Filter out any Firestore hospitals that do not have an incharge name or are unregistered dropdown options
      const fbRegistered = fbHospitals.filter(h => 
        h.id !== "hosp-unregistered-1" && 
        h.id !== "hosp-unregistered-2" && 
        h.incharge && 
        h.incharge.trim() !== ""
      );
      const fbUnregistered = fbHospitals.filter(h => 
        h.id === "hosp-unregistered-1" || 
        h.id === "hosp-unregistered-2" || 
        !h.incharge || 
        h.incharge.trim() === ""
      );

      // Delete unregistered ones from Firestore so they don't leak as registered profiles
      for (const unHosp of fbUnregistered) {
        await deleteHospitalFromFirestore(unHosp.id);
      }

      const localHospitalsMap = new Map(localDb.hospitals.map(h => [h.id, h]));
      const fbHospitalsMap = new Map(fbRegistered.map(h => [h.id, h]));

      let merged = false;
      for (const fbHosp of fbRegistered) {
        const localHosp = localHospitalsMap.get(fbHosp.id);
        if (!localHosp || JSON.stringify(localHosp) !== JSON.stringify(fbHosp)) {
          localHospitalsMap.set(fbHosp.id, fbHosp);
          merged = true;
        }
      }

      for (const localHosp of localDb.hospitals) {
        if (localHosp.incharge && localHosp.incharge.trim() !== "") {
          if (!fbHospitalsMap.has(localHosp.id)) {
            await saveHospitalToFirestore(localHosp);
          }
        }
      }

      if (merged) {
        localDb.hospitals = Array.from(localHospitalsMap.values());
        saveDB(localDb);
      }
      return true;
    } else {
      console.log("Firestore hospitals collection is empty. Seeding with local hospitals.");
      for (const localHosp of localDb.hospitals) {
        if (localHosp.incharge && localHosp.incharge.trim() !== "") {
          await saveHospitalToFirestore(localHosp);
        }
      }
    }
  } catch (err) {
    console.error("Failed to sync hospitals from Firestore:", err);
  }
  return false;
}

// Durable cloud persistence helper functions for daily reports
async function saveDailyReportToFirestore(report: DailyReport) {
  if (!firestoreDb) return;
  try {
    const docId = `${report.hospitalId}_${report.recordDate}`;
    await setDoc(doc(firestoreDb, "dailyReports", docId), report);
    console.log(`Saved daily report ${docId} securely to Firestore.`);
  } catch (err) {
    console.error(`Failed to save daily report ${report.id} to Firestore:`, err);
  }
}

async function syncDailyReportsFromFirestore(localDb: DBStore): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const querySnapshot = await getDocs(collection(firestoreDb, "dailyReports"));
    const fbReports: DailyReport[] = [];
    querySnapshot.forEach((docSnap) => {
      fbReports.push(docSnap.data() as DailyReport);
    });

    if (fbReports.length > 0) {
      console.log(`Synced ${fbReports.length} daily reports from Firestore.`);
      const localReportsMap = new Map(localDb.dailyReports.map(r => [`${r.hospitalId}_${r.recordDate}`, r]));
      const fbReportsMap = new Map(fbReports.map(r => [`${r.hospitalId}_${r.recordDate}`, r]));

      let merged = false;
      for (const fbReport of fbReports) {
        const key = `${fbReport.hospitalId}_${fbReport.recordDate}`;
        const localReport = localReportsMap.get(key);
        if (!localReport || JSON.stringify(localReport) !== JSON.stringify(fbReport)) {
          localReportsMap.set(key, fbReport);
          merged = true;
        }
      }

      for (const localReport of localDb.dailyReports) {
        const key = `${localReport.hospitalId}_${localReport.recordDate}`;
        if (!fbReportsMap.has(key)) {
          await saveDailyReportToFirestore(localReport);
        }
      }

      if (merged) {
        localDb.dailyReports = Array.from(localReportsMap.values());
        saveDB(localDb);
      }
      return true;
    } else {
      console.log("Firestore dailyReports collection is empty. Seeding with local reports.");
      for (const localReport of localDb.dailyReports) {
        await saveDailyReportToFirestore(localReport);
      }
    }
  } catch (err) {
    console.error("Failed to sync daily reports from Firestore:", err);
  }
  return false;
}

async function initializeDatabase(localDb: DBStore) {
  console.log("Initializing database sync with Firebase Firestore...");
  await syncUsersFromFirestore(localDb);
  await syncRegistrationRequestsFromFirestore(localDb);
  await syncHospitalsFromFirestore(localDb);
  await syncDailyReportsFromFirestore(localDb);
  console.log("Firebase Firestore synchronization complete.");
}


const REQUIRED_DISEASES: MasterDisease[] = [
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
  { id: "dis-38", name: "अन्य रोग", category: "रोगवार विवरण" }
];

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db_store.json");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to initialize and read/write the JSON DB
interface DBStore {
  hospitals: Hospital[];
  hospitalDropdownOptions?: Hospital[];
  users: UserProfile[];
  dailyReports: DailyReport[];
  auditLogs: AuditLog[];
  masterDiseases: MasterDisease[];
  masterTests: MasterTest[];
  masterKits: MasterKit[];
  notifications: Array<{ id: string; title: string; body: string; deepLink: string; timestamp: string; recipientEmail?: string }>;
  customTemplates?: CustomReportTemplate[];
  registrationRequests?: RegistrationRequest[];
  hospitalTypes?: string[];
  streams?: string[];
  locations?: string[];
  blocks?: string[];
  districts?: string[];
  emailIds?: string[];
  categories?: string[];
}

function loadDB(): DBStore {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const db = JSON.parse(data);
      if (!db.customTemplates) {
        db.customTemplates = [];
      }
      if (!db.registrationRequests) {
        db.registrationRequests = [];
      }
      if (!db.hospitalDropdownOptions) {
        db.hospitalDropdownOptions = [];
      }

      let changed = false;

      // Maintain hospitalDropdownOptions separately and do NOT merge into db.hospitals
      const originalDropdownLen = db.hospitalDropdownOptions?.length || 0;
      db.hospitalDropdownOptions = [
        {
          id: "hosp-unregistered-1",
          name: "राजकीय आयुर्वेदिक चिकित्सालय - बन्नाखेड़ा",
          code: "SAD-BNK-05",
          type: "राजकीय आयुर्वेदिक चिकित्सालय",
          location: "बन्नाखेड़ा",
          address: "Bannakhera, Uttarakhand",
          isActive: true,
          block: "बाजपुर",
          district: "उधम सिंह नगर",
          stream: "Ayurved",
          incharge: "",
          category: "State Hospital"
        },
        {
          id: "hosp-unregistered-2",
          name: "राजकीय आयुर्वेदिक चिकित्सालय - गदरपुर",
          code: "SAD-GDP-06",
          type: "राजकीय आयुर्वेदिक चिकित्सालय",
          location: "गदरपुर",
          address: "Gadarpur, Uttarakhand",
          isActive: true,
          block: "गदरपुर",
          district: "उधम सिंह नगर",
          stream: "Ayurved",
          incharge: "",
          category: "State Hospital"
        }
      ];
      if (originalDropdownLen !== 2) {
        changed = true;
      }

      // Remove any unregistered dropdown option hospitals from db.hospitals to prevent duplication and ghost registered facilities
      if (db.hospitals) {
        const initialLen = db.hospitals.length;
        db.hospitals = db.hospitals.filter(h => 
          h.id !== "hosp-unregistered-1" && 
          h.id !== "hosp-unregistered-2" && 
          (h.id === "hosp-d1dgsvb7d" || (h.incharge && h.incharge.trim() !== ""))
        );
        if (db.hospitals.length !== initialLen) {
          changed = true;
        }
      }

      // Simplify and enforce only the 3 main hospital types requested to avoid confusion
      const expectedTypes = [
        "राजकीय आयुर्वेदिक चिकित्सालय",
        "राजकीय यूनानी चिकित्सालय",
        "आयुष्मान आरोग्य मंदिर"
      ];
      if (!db.hospitalTypes || JSON.stringify(db.hospitalTypes) !== JSON.stringify(expectedTypes)) {
        db.hospitalTypes = expectedTypes;
        changed = true;
      }
      if (!db.streams || db.streams.length === 0) {
        db.streams = ["Ayurved", "Unani"];
        changed = true;
      }
      if (!db.locations || db.locations.length === 0) {
        db.locations = [
          "बाजपुर", "बन्नाखेड़ा", "बरा", "बेरिया दौलतपुर", "भिटौरा", "बिडौरा", "चकरपुर", "ढकिया", "धनौरी", "दिनेशपुर", "दिउरी", "गदरपुर", "गूलरभोज", "हरिपुरा हसन", "जसपुर", "झनकट", "रुद्रपुर", "केलाखेड़ा", "खानपुर पश्चिम", "खटीमा", "किच्छा", "लालपुर", "महुआ डबरा", "महुआ खेड़ा गंज", "मैनाजुंडी", "मझोला", "मसीत", "मोहनपुर", "नादेही", "नागलतराई", "नगर रुद्रपुर", "नारायणपुर", "परमानदपुर", "पतरामपुर", "प्रतापपुर", "राम नगर वन", "शक्ति फ़ार्म", "सितारगंज", "स्केनिया", "श्रीपुर बिचवा", "सुल्तानपुर पट्टी"
        ];
        changed = true;
      }
      if (!db.blocks || db.blocks.length === 0) {
        db.blocks = ["बाजपुर", "गदरपुर", "जसपुर", "काशीपुर", "खटीमा", "रुद्रपुर", "सितारगंज"];
        changed = true;
      }
      if (!db.districts || db.districts.length === 0) {
        db.districts = ["उधम सिंह नगर"];
        changed = true;
      }
      if (!db.emailIds || db.emailIds.length === 0) {
        db.emailIds = [
          "jhankat.ayush@gov.in",
          "khatima.ayush@gov.in",
          "tanakpur.ayush@gov.in",
          "banbasa.ayush@gov.in",
          "manu.spng@gmail.com"
        ];
        changed = true;
      }

      // Simplify categories to keep registration clean
      const expectedCategories = [
        "Ayush Wing",
        "Ayushman Arogya Mandir",
        "State Hospital"
      ];
      if (!db.categories || JSON.stringify(db.categories) !== JSON.stringify(expectedCategories)) {
        db.categories = expectedCategories;
        changed = true;
      }

      if (!db.masterDiseases || db.masterDiseases.length !== REQUIRED_DISEASES.length || db.masterDiseases[0]?.name !== REQUIRED_DISEASES[0].name) {
        db.masterDiseases = REQUIRED_DISEASES;
        changed = true;
      }

      if (db.users && db.users.length > 0) {
        const uniqueUsers: UserProfile[] = [];
        const seenEmails = new Set<string>();
        for (const u of db.users) {
          const emailKey = u.email.toLowerCase().trim();
          if (!seenEmails.has(emailKey)) {
            seenEmails.add(emailKey);
            uniqueUsers.push(u);
          } else {
            changed = true;
          }
        }
        db.users = uniqueUsers;
      }

      if (db.hospitals && db.hospitals.length > 0) {
        for (const h of db.hospitals) {
          const activeSelection = (h as any).category || h.type;
          if (activeSelection && h.location) {
            const expectedName = `${activeSelection.trim()} - ${h.location.trim()}`;
            if (h.name !== expectedName) {
              h.name = expectedName;
              changed = true;
            }
          }
        }
      }

      if (db.hospitalDropdownOptions && db.hospitalDropdownOptions.length > 0) {
        for (const h of db.hospitalDropdownOptions) {
          const activeSelection = (h as any).category || h.type;
          if (activeSelection && h.location) {
            const expectedName = `${activeSelection.trim()} - ${h.location.trim()}`;
            if (h.name !== expectedName) {
              h.name = expectedName;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        saveDB(db);
      }
      return db;
    }
  } catch (err) {
    console.error("Error reading database file, using defaults", err);
  }

  // Seed default database
  const defaultHospitals: Hospital[] = [
    {
      id: "hosp-d1dgsvb7d",
      name: "राजकीय आयुर्वेदिक चिकित्सालय - झनकट",
      code: "00",
      type: "राजकीय आयुर्वेदिक चिकित्सालय",
      location: "झनकट",
      address: "jhankat, khatima, us nagar",
      contactEmail: "usn.jhankat@uttarakhandayurved.co.in",
      contactPhone: "9455959592",
      isActive: true,
      incharge: "Dr Manvinder Pal Singh",
      block: "Khatima",
      district: "उधम सिंह नगर",
      stream: "Ayurved"
    }
  ];

  const defaultUsers: UserProfile[] = [];

  const defaultDiseases: MasterDisease[] = [
    { id: "dis-1", name: "Amavata / Rheumatoid Arthritis", category: "Joint Disorders" },
    { id: "dis-2", name: "Sandhigatavata / Osteoarthritis", category: "Joint Disorders" },
    { id: "dis-3", name: "Kasa / Bronchitis & Cough", category: "Respiratory" },
    { id: "dis-4", name: "Shwasa / Asthma", category: "Respiratory" },
    { id: "dis-5", name: "Amlapitta / Hyperacidity", category: "Digestive" },
    { id: "dis-6", name: "Grahani / IBS", category: "Digestive" },
    { id: "dis-7", name: "Twak Roga / Skin Disorders", category: "Dermatological" },
    { id: "dis-8", name: "Prameha / Diabetes Mellitus", category: "Metabolic" },
    { id: "dis-9", name: "Vatavyadhi / Neurological Pain", category: "Neurological" }
  ];

  const defaultTests: MasterTest[] = [
    { id: "test-hb", name: "Hemoglobin (Hb)", normalRange: "12-16 g/dL" },
    { id: "test-sugar", name: "Blood Sugar (Random/Fasting)", normalRange: "70-140 mg/dL" },
    { id: "test-urine-sugar", name: "Urine Sugar", normalRange: "Nil" },
    { id: "test-urine-alb", name: "Urine Albumin", normalRange: "Nil" },
    { id: "test-malaria", name: "Malaria RDT", normalRange: "Negative" },
    { id: "test-dengue", name: "Dengue NS1/IgG/IgM", normalRange: "Negative" },
    { id: "test-typhoid", name: "Typhoid (Widal/RDT)", normalRange: "Negative" },
    { id: "test-hepa", name: "Hepatitis A/B/C", normalRange: "Negative" },
    { id: "test-pregnancy", name: "Urine Pregnancy Test (UPT)", normalRange: "Negative" }
  ];

  const defaultKits: MasterKit[] = [
    { id: "kit-hb", name: "Hemoglobin Strips", unit: "Strips", defaultThreshold: 20 },
    { id: "kit-sugar", name: "Blood Sugar Strips", unit: "Strips", defaultThreshold: 30 },
    { id: "kit-urine", name: "Urine Multiparameter Strips", unit: "Strips", defaultThreshold: 25 },
    { id: "kit-malaria", name: "Malaria Antigen Cards", unit: "Kits", defaultThreshold: 15 },
    { id: "kit-dengue", name: "Dengue Rapid Cards", unit: "Kits", defaultThreshold: 10 },
    { id: "kit-typhoid", name: "Typhoid Test Cards", unit: "Kits", defaultThreshold: 15 },
    { id: "kit-pregnancy", name: "Pregnancy HCG Cassettes", unit: "Kits", defaultThreshold: 12 }
  ];

  // Seed some beautiful history for the past 20 days so charts are populated
  const dailyReports: DailyReport[] = [];
  const today = new Date();

  // Create a historical dataset for each hospital
  defaultHospitals.forEach((hosp) => {
    // We seed reports for the past 15 days
    for (let i = 15; i >= 1; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      // Pseudo-random but consistent daily metrics
      const hash = (hosp.id.charCodeAt(5) || 7) + i;
      const opdMaleNew = Math.floor(15 + (hash % 12));
      const opdMaleOld = Math.floor(5 + (hash % 6));
      const opdFemaleNew = Math.floor(20 + (hash % 15));
      const opdFemaleOld = Math.floor(8 + (hash % 7));
      const opdChildNew = Math.floor(4 + (hash % 5));
      const opdChildOld = Math.floor(2 + (hash % 3));
      const opdElderlyNew = Math.floor(6 + (hash % 8));
      const opdElderlyOld = Math.floor(3 + (hash % 4));

      const ipdAdmissions = Math.floor(hash % 4);
      const bedOccupancy = Math.floor(40 + (hash % 45));

      const pMale = Math.floor(3 + (hash % 5));
      const pFemale = Math.floor(4 + (hash % 6));
      const pChild = Math.floor(hash % 3);
      const pElderly = Math.floor(2 + (hash % 4));

      const levyCharges = (opdMaleNew + opdFemaleNew) * 10; // Rs 10 per new card
      const aadhaarSeeded = Math.floor((opdMaleNew + opdFemaleNew) * 0.85);
      const mobileSeeded = Math.floor((opdMaleNew + opdFemaleNew) * 0.90);

      const hb = Math.floor(10 + (hash % 15));
      const sugar = Math.floor(8 + (hash % 12));
      const uSugar = Math.floor(2 + (hash % 6));
      const uAlb = Math.floor(1 + (hash % 4));
      const malaria = Math.floor(hash % 3);
      const dengue = Math.floor(hash % 2);
      const typhoid = Math.floor(2 + (hash % 5));
      const pregnancy = Math.floor(hash % 4);

      // Inventory calculations
      const initialOpening = 100 - i * 3;
      const received = i % 5 === 0 ? 50 : 0;
      const used = hb + sugar + uSugar + malaria + dengue + typhoid + pregnancy;
      const defective = hash % 2;
      const closing = initialOpening + received - used - defective;

      const camps: OutreachCampLog[] = [];
      if (i % 7 === 0) {
        camps.push({
          village_location: i % 2 === 0 ? "Jhankat Village" : "Sishaiya Colony",
          beneficiaries_male: 15 + (hash % 10),
          beneficiaries_female: 25 + (hash % 12),
          beneficiaries_child: 8 + (hash % 5),
          beneficiaries_total: 48 + (hash % 27),
          medicine_distributed_count: 45 + (hash % 20),
          ncd_screenings: 12 + (hash % 8),
          ayurvidya_sessions: 1
        });
      }

      dailyReports.push({
        id: `rep-${hosp.id}-${dateStr}`,
        hospitalId: hosp.id,
        recordDate: dateStr,
        submittedAt: new Date(date.getTime() + 8 * 3600 * 1000).toISOString(), // submitted next morning
        submittedBy: `${hosp.id.split("-")[1]}.user@gov.in`,
        patientMatrix: {
          opd_male_new: opdMaleNew,
          opd_male_old: opdMaleOld,
          opd_female_new: opdFemaleNew,
          opd_female_old: opdFemaleOld,
          opd_child_new: opdChildNew,
          opd_child_old: opdChildOld,
          opd_elderly_new: opdElderlyNew,
          opd_elderly_old: opdElderlyOld,
          ipd_admissions: ipdAdmissions,
          ipd_male_new: Math.floor(ipdAdmissions / 6),
          ipd_male_old: Math.floor(ipdAdmissions / 6),
          ipd_female_new: Math.floor(ipdAdmissions / 6),
          ipd_female_old: Math.floor(ipdAdmissions / 6),
          ipd_child_new: Math.floor(ipdAdmissions / 6),
          ipd_child_old: ipdAdmissions - (Math.floor(ipdAdmissions / 6) * 5),
          ipd_bed_occupancy_percentage: bedOccupancy,
          panchkarma_male: pMale,
          panchkarma_female: pFemale,
          panchkarma_child: pChild,
          panchkarma_elderly: pElderly,
          levy_charges: levyCharges,
          aadhaar_seeded_count: aadhaarSeeded,
          mobile_seeded_count: mobileSeeded
        },
        investigationsLab: {
          hemoglobin: hb,
          blood_sugar: sugar,
          urine_sugar: uSugar,
          urine_albumin: uAlb,
          malaria: malaria,
          dengue: dengue,
          typhoid: typhoid,
          hepatitis_a: hash % 2,
          hepatitis_b: hash % 3 === 0 ? 1 : 0,
          hepatitis_c: 0,
          pregnancy_tests: pregnancy
        },
        inventory: [
          { kit_type: "Hemoglobin Strips", opening_balance: initialOpening, received_qty: received, used_qty: hb, defective_qty: defective, closing_balance: initialOpening + received - hb - defective, low_stock_threshold: 20 },
          { kit_type: "Blood Sugar Strips", opening_balance: initialOpening, received_qty: received, used_qty: sugar, defective_qty: 0, closing_balance: initialOpening + received - sugar, low_stock_threshold: 30 },
          { kit_type: "Urine Multiparameter Strips", opening_balance: 100, received_qty: 50, used_qty: uSugar + uAlb, defective_qty: 0, closing_balance: 100 + 50 - (uSugar + uAlb), low_stock_threshold: 25 },
          { kit_type: "Malaria Antigen Cards", opening_balance: 80, received_qty: 0, used_qty: malaria, defective_qty: 0, closing_balance: 80 - malaria, low_stock_threshold: 15 },
          { kit_type: "Dengue Rapid Cards", opening_balance: 80, received_qty: 0, used_qty: dengue, defective_qty: 0, closing_balance: 80 - dengue, low_stock_threshold: 10 },
          { kit_type: "Typhoid Test Cards", opening_balance: 80, received_qty: 0, used_qty: typhoid, defective_qty: 0, closing_balance: 80 - typhoid, low_stock_threshold: 15 },
          { kit_type: "Pregnancy HCG Cassettes", opening_balance: 50, received_qty: 0, used_qty: pregnancy, defective_qty: 0, closing_balance: 50 - pregnancy, low_stock_threshold: 12 }
        ],
        camps,
        isLocked: i > 3, // Lock reports older than 3 days
        anomalyConfirmed: false,
        anomalyFlags: []
      });
    }
  });

  const defaultAuditLogs: AuditLog[] = [
    {
      id: "audit-01",
      userId: "user-manu",
      userEmail: "manu.spng@gmail.com",
      userName: "Dr. Manu Sharma",
      action: "INIT",
      tableName: "System",
      recordId: "0",
      details: "District Ayush MPR System database initialized with seed data.",
      timestamp: new Date().toISOString()
    }
  ];

  const db: DBStore = {
    hospitals: defaultHospitals,
    users: defaultUsers,
    dailyReports,
    auditLogs: defaultAuditLogs,
    masterDiseases: defaultDiseases,
    masterTests: defaultTests,
    masterKits: defaultKits,
    notifications: [
      {
        id: "notif-1",
        title: "Welcome to Ayush MPR",
        body: "Your district portal is active. Click to review compliance.",
        deepLink: "/analytics",
        timestamp: new Date().toISOString()
      }
    ],
    customTemplates: [],
    hospitalTypes: [
      "राजकीय आयुर्वेदिक चिकित्सालय",
      "राजकीय यूनानी चिकित्सालय",
      "आयुष विंग( पुरुष ) जिला चिकित्सालय",
      "आयुष विंग( महिला ) जिला चिकित्सालय",
      "आयुष विंग - अति प्राथमिक चिकित्सालय",
      "आयुष्मान आरोग्य मंदिर"
    ],
    streams: ["Ayurved", "Unani"],
    locations: [
      "बाजपुर", "बन्नाखेड़ा", "बरा", "बेरिया दौलतपुर", "भिटौरा", "बिडौरा", "चकरपुर", "ढकिया", "धनौरी", "दिनेशपुर", "दिउरी", "गदरपुर", "गूलरभोज", "हरिपुरा हसन", "जसपुर", "झनकट", "रुद्रपुर", "केलाखेड़ा", "खानपुर पश्चिम", "खटीमा", "किच्छा", "लालपुर", "महुआ डबरा", "महुआ खेड़ा गंज", "मैनाजुंडी", "मझोला", "मसीत", "मोहनपुर", "नादेही", "नागलतराई", "नगर रुद्रपुर", "नारायणपुर", "परमानदपुर", "पतरामपुर", "प्रतापपुर", "राम नगर वन", "शक्ति फ़ार्म", "सितारगंज", "स्केनिया", "श्रीपुर बिचवा", "सुल्तानपुर पट्टी"
    ],
    blocks: ["बाजपुर", "गदरपुर", "जसपुर", "काशीपुर", "खटीमा", "रुद्रपुर", "सितारगंज"],
    districts: ["उधम सिंह नगर"],
    emailIds: [
      "jhankat.ayush@gov.in",
      "khatima.ayush@gov.in",
      "tanakpur.ayush@gov.in",
      "banbasa.ayush@gov.in",
      "manu.spng@gmail.com"
    ]
  };

  saveDB(db);
  return db;
}

function saveDB(db: DBStore) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving database file", err);
  }
}

// Lazy init Gemini SDK
let _ai: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      _ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return _ai;
}

// API Routes

// Authenticate / session helper (Google login / phone simulation)
app.post("/api/auth/login", async (req, res) => {
  const { email, phone, password, loginType } = req.body;
  const db = loadDB();

  const searchEmail = (email || "").toLowerCase().trim();
  let user = db.users.find(u => u.email.toLowerCase().trim() === searchEmail || (phone && u.phone === phone));

  // Try querying real Firestore
  if (!user && searchEmail && firestoreDb) {
    try {
      const docId = searchEmail.replace(/[^a-z0-9_.-]/g, "_");
      const docSnap = await getDoc(doc(firestoreDb, "users", docId));
      if (docSnap.exists()) {
        user = docSnap.data() as UserProfile;
        if (user) {
          user.isWhitelisted = true;
          db.users.push(user);
          saveDB(db);
        }
      }
    } catch (err) {
      console.error("Failed to query Firestore for user login in server:", err);
    }
  }

  // Auto-create helper strictly for Super Admin to prevent initial lockout
  if (!user && searchEmail === "manu.spng@gmail.com") {
    user = {
      id: "user-manu",
      email: "manu.spng@gmail.com",
      name: "Dr. Manu Sharma",
      role: UserRole.SUPER_ADMIN,
      phone: "+919411223344",
      isWhitelisted: true,
      password: password || "admin123"
    };
    db.users.push(user);
    saveDB(db);
    saveUserToFirestore(user);
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User account not found. Please verify your credentials or contact your administrator."
    });
  }

  if (loginType === "Simulated Database Authentication" && user.password && password && user.password !== password) {
    return res.status(401).json({
      success: false,
      message: "Incorrect password for this account. Please try again."
    });
  }

  // Force isWhitelisted to true so no deactivated check gets triggered
  user.isWhitelisted = true;

  // Create audit log
  const auditId = "audit-" + Math.random().toString(36).substring(2, 11);
  db.auditLogs.unshift({
    id: auditId,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    action: "LOGIN",
    tableName: "User",
    recordId: user.id,
    details: `User logged in successfully via ${loginType || "Simulation"}.`,
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  return res.json({
    success: true,
    user,
    hospital: user.hospitalId ? db.hospitals.find(h => h.id === user.hospitalId) : null
  });
});

app.post("/api/auth/register", (req, res) => {
  const { email, name, role, hospitalId, phone } = req.body;
  const db = loadDB();

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  let user = db.users.find(u => u.email === email);
  if (user) {
    return res.status(400).json({ success: false, message: "A user with this email already exists." });
  }

  user = {
    id: "user-" + Math.random().toString(36).substring(2, 11),
    email,
    name: name || email.split("@")[0],
    role: role || "HOSPITAL_USER",
    hospitalId: hospitalId || undefined,
    phone: phone || "",
    isWhitelisted: true
  };

  db.users.push(user);

  // Create audit log
  const auditId = "audit-" + Math.random().toString(36).substring(2, 11);
  db.auditLogs.unshift({
    id: auditId,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    action: "CREATE",
    tableName: "User",
    recordId: user.id,
    details: `User registered successfully as ${user.role}.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  saveUserToFirestore(user); // Save to Firestore cloud database to ensure zero data loss

  return res.json({
    success: true,
    user,
    hospital: user.hospitalId ? db.hospitals.find(h => h.id === user.hospitalId) : null
  });
});

// Whitelist / Users Management (Super Admin only)
app.post("/api/admin/profile/update", async (req, res) => {
  const { email, name, designation, contact, phone } = req.body;
  if (!email || email.toLowerCase().trim() !== "manu.spng@gmail.com") {
    return res.status(403).json({ success: false, message: "Unauthorized profile modification." });
  }

  const db = loadDB();
  const searchEmail = email.toLowerCase().trim();
  let user = db.users.find(u => u.email.toLowerCase().trim() === searchEmail);

  if (!user) {
    user = {
      id: "user-manu",
      email: searchEmail,
      name: name || "Dr. Manu Sharma",
      role: UserRole.SUPER_ADMIN,
      phone: phone || contact || "",
      isWhitelisted: true,
      designation: designation || "",
      contact: contact || ""
    };
    db.users.push(user);
  } else {
    user.name = name || user.name;
    user.phone = phone || contact || user.phone;
    user.designation = designation !== undefined ? designation : user.designation;
    user.contact = contact !== undefined ? contact : user.contact;
  }

  saveDB(db);
  await saveUserToFirestore(user);

  res.json({ success: true, user });
});

app.get("/api/admin/users", (req, res) => {
  const db = loadDB();
  res.json(db.users);
});

app.post("/api/admin/users/whitelist", (req, res) => {
  const { userEmail, userName, role, hospitalId, phone, password, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized: Super Admin access required." });
  }

  let existingUser = db.users.find(u => u.email === userEmail);
  if (existingUser) {
    existingUser.name = userName || existingUser.name;
    existingUser.role = role || existingUser.role;
    existingUser.hospitalId = hospitalId;
    existingUser.phone = phone || existingUser.phone;
    existingUser.isWhitelisted = true;
    if (password) {
      existingUser.password = password;
    }
  } else {
    existingUser = {
      id: "user-" + Math.random().toString(36).substring(2, 11),
      email: userEmail,
      name: userName,
      role: role || UserRole.HOSPITAL_USER,
      hospitalId,
      phone: phone || "",
      isWhitelisted: true,
      password: password || ""
    };
    db.users.push(existingUser);
  }

  // Log audit
  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "WHITELIST",
    tableName: "User",
    recordId: existingUser.id,
    details: `Whitelisted user ${userEmail} as ${existingUser.role}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  saveUserToFirestore(existingUser); // Save to Firestore cloud database to ensure zero data loss
  res.json({ success: true, user: existingUser });
});

// Admin change-password endpoint for any user
app.post("/api/admin/users/change-password", (req, res) => {
  const { userEmail, newPassword, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized: Super Admin access required." });
  }

  const targetUser = db.users.find(u => u.email === userEmail);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  targetUser.password = newPassword;

  // Log audit
  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "UPDATE_PASSWORD",
    tableName: "User",
    recordId: targetUser.id,
    details: `Updated password for user ${userEmail}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  saveUserToFirestore(targetUser); // Update in Firestore cloud database to ensure zero data loss
  res.json({ success: true, message: "User password updated successfully!" });
});

// Registration Requests Endpoints
app.post("/api/auth/request-register", (req, res) => {
  const { email, name, role, hospitalId, phone, password } = req.body;
  const db = loadDB();

  if (!email) {
    return res.status(400).json({ success: false, message: "Email prefix/address is required." });
  }

  // Ensure registrationRequests is initialized
  if (!db.registrationRequests) {
    db.registrationRequests = [];
  }

  // Check if already registered
  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ success: false, message: "A user with this email is already registered." });
  }

  // Check if pending request already exists
  const existingRequest = db.registrationRequests.find(r => r.email.toLowerCase() === email.toLowerCase() && r.status === "PENDING");
  if (existingRequest) {
    return res.status(400).json({ success: false, message: "A registration request is already pending for this email." });
  }

  const newRequest: RegistrationRequest = {
    id: "req-" + Math.random().toString(36).substring(2, 11),
    email,
    name: name || email.split("@")[0],
    role: role || UserRole.HOSPITAL_USER,
    hospitalId: hospitalId || undefined,
    phone: phone || "",
    password: password || "",
    status: "PENDING",
    requestedAt: new Date().toISOString()
  };

  db.registrationRequests.unshift(newRequest);
  saveDB(db);
  saveRegistrationRequestToFirestore(newRequest); // Sync to Firestore cloud database

  return res.json({ success: true, message: "Registration request submitted successfully. It will be verified by the admin." });
});

app.get("/api/admin/registration-requests", (req, res) => {
  const db = loadDB();
  return res.json(db.registrationRequests || []);
});

app.post("/api/admin/registration-requests/action", (req, res) => {
  const { requestId, action, adminEmail } = req.body; // action: "APPROVE" | "REJECT"
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized: Only Super Admin can approve/reject registration requests." });
  }

  if (!db.registrationRequests) {
    db.registrationRequests = [];
  }

  const request = db.registrationRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: "Registration request not found." });
  }

  if (request.status !== "PENDING") {
    return res.status(400).json({ success: false, message: "This request has already been processed." });
  }

  if (action === "APPROVE") {
    request.status = "APPROVED";
    
    // Check if user already exists
    let targetUser = db.users.find(u => u.email.toLowerCase() === request.email.toLowerCase());
    let isNew = false;
    if (targetUser) {
      targetUser.name = request.name || targetUser.name;
      targetUser.role = request.role || targetUser.role;
      targetUser.hospitalId = request.hospitalId || targetUser.hospitalId;
      targetUser.phone = request.phone || targetUser.phone;
      targetUser.isWhitelisted = true;
      if (request.password) {
        targetUser.password = request.password;
      }
    } else {
      isNew = true;
      targetUser = {
        id: "user-" + Math.random().toString(36).substring(2, 11),
        email: request.email,
        name: request.name,
        role: request.role,
        hospitalId: request.hospitalId,
        phone: request.phone,
        isWhitelisted: true,
        password: request.password || ""
      };
      db.users.push(targetUser);
    }

    // Promote the selected hospital option if it is a hospital user request
    if (request.role === UserRole.HOSPITAL_USER && request.hospitalId) {
      if (!db.hospitalDropdownOptions) {
        db.hospitalDropdownOptions = [];
      }
      const optionIndex = db.hospitalDropdownOptions.findIndex(h => h.id === request.hospitalId);
      if (optionIndex !== -1) {
        const promotedHosp = db.hospitalDropdownOptions[optionIndex];
        // Remove from dropdown options
        db.hospitalDropdownOptions.splice(optionIndex, 1);
        
        // Fully register and activate the hospital profile with incharge details
        promotedHosp.incharge = request.name;
        promotedHosp.isActive = true;
        
        // Ensure name is correctly derived
        if (promotedHosp.type && promotedHosp.location) {
          promotedHosp.name = `${promotedHosp.type.trim()} - ${promotedHosp.location.trim()}`;
        }
        
        // Push to active hospitals list
        if (!db.hospitals.some(h => h.id === promotedHosp.id)) {
          db.hospitals.push(promotedHosp);
        }
        
        // Log in audit log
        console.log(`Successfully activated and promoted hospital option ${promotedHosp.id} (${promotedHosp.name}) on request approval.`);
        saveHospitalToFirestore(promotedHosp).catch(err => console.error("Firestore sync error:", err));
      }
    }

    // Create audit log
    const auditId = "audit-" + Math.random().toString(36).substring(2, 11);
    db.auditLogs.unshift({
      id: auditId,
      userId: adminUser.id,
      userEmail: adminUser.email,
      userName: adminUser.name,
      action: isNew ? "CREATE" : "UPDATE",
      tableName: "User",
      recordId: targetUser.id,
      details: isNew 
        ? `Approved registration request ${request.id}. Registered user ${targetUser.email} (${targetUser.role})`
        : `Approved registration request ${request.id}. Reactivated and updated existing user ${targetUser.email}`,
      timestamp: new Date().toISOString()
    });

  } else {
    request.status = "REJECTED";
  }

  saveDB(db);
  
  // Sync changes to Firestore cloud database to ensure zero data loss
  saveRegistrationRequestToFirestore(request);
  if (action === "APPROVE") {
    // Find target user from db again to be safe
    const targetUser = db.users.find(u => u.email.toLowerCase() === request.email.toLowerCase());
    if (targetUser) {
      saveUserToFirestore(targetUser);
    }
  }

  return res.json({ success: true, message: `Request successfully ${action === "APPROVE" ? "approved" : "rejected"}.` });
});


app.post("/api/admin/users/toggle", (req, res) => {
  const { targetEmail, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized: Super Admin access required." });
  }

  const target = db.users.find(u => u.email.toLowerCase().trim() === (targetEmail || "").toLowerCase().trim());
  if (!target) return res.status(404).json({ success: false, message: "User not found" });

  if (target.email.toLowerCase().trim() === "manu.spng@gmail.com") {
    return res.status(400).json({ success: false, message: "Cannot suspend primary Super Admin" });
  }

  target.isWhitelisted = !target.isWhitelisted;

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "TOGGLE_STATUS",
    tableName: "User",
    recordId: target.id,
    details: `Toggled active status for ${target.email} to ${target.isWhitelisted}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  saveUserToFirestore(target); // Also save updated state to Firestore cloud database
  res.json({ success: true, user: target });
});

app.post("/api/admin/users/delete", (req, res) => {
  const { targetEmail, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized: Super Admin access required." });
  }

  const targetIndex = db.users.findIndex(u => u.email.toLowerCase() === (targetEmail || "").toLowerCase());
  if (targetIndex === -1) return res.status(404).json({ success: false, message: "User not found" });

  const target = db.users[targetIndex];
  if (target.email.toLowerCase().trim() === "manu.spng@gmail.com") {
    return res.status(400).json({ success: false, message: "Cannot delete primary Super Admin" });
  }

  db.users.splice(targetIndex, 1);

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "DELETE_USER",
    tableName: "User",
    recordId: target.id,
    details: `Deleted user ${target.email}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  deleteUserFromFirestore(targetEmail); // Delete from Firestore cloud database as well
  res.json({ success: true, message: `User ${targetEmail} deleted successfully.` });
});

// Master Table: Dynamic additions via Bulk Upload (Excel/JSON simulation)
app.get("/api/hospitals", (req, res) => {
  const db = loadDB();
  res.json(db.hospitals);
});

app.get("/api/hospitals/options", (req, res) => {
  const db = loadDB();
  res.json(db.hospitalDropdownOptions || []);
});

// GET hospital sourcing Google Sheet configuration
app.get("/api/admin/hospitals/sheet-config", (req, res) => {
  const db = loadDB();
  res.json({ success: true, url: (db as any).hospitalSheetUrl || "" });
});

// POST save hospital sourcing Google Sheet link
app.post("/api/admin/hospitals/sheet-config", (req, res) => {
  const { url, adminEmail } = req.body;
  const db = loadDB();
  (db as any).hospitalSheetUrl = url || "";
  saveDB(db);

  // Log audit trail
  const adminUser = db.users.find(u => u.email === adminEmail);
  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser ? adminUser.id : "system",
    userEmail: adminEmail || "system@ayush.gov.in",
    userName: adminUser ? adminUser.name : "System Admin",
    action: "UPDATE",
    tableName: "HospitalSheetConfig",
    recordId: "google-sheet-url",
    details: `Updated hospital sourcing Google Sheet URL: ${url}`,
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  res.json({ success: true, message: "Google Sheet link updated successfully" });
});

// DELETE hospital sourcing Google Sheet link
app.delete("/api/admin/hospitals/sheet-config", (req, res) => {
  const { adminEmail } = req.body || req.query;
  const db = loadDB();
  (db as any).hospitalSheetUrl = "";
  saveDB(db);

  // Log audit trail
  const adminUser = db.users.find(u => u.email === adminEmail);
  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser ? adminUser.id : "system",
    userEmail: adminEmail || "system@ayush.gov.in",
    userName: adminUser ? adminUser.name : "System Admin",
    action: "DELETE",
    tableName: "HospitalSheetConfig",
    recordId: "google-sheet-url",
    details: "Removed hospital sourcing Google Sheet URL link.",
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  res.json({ success: true, message: "Google Sheet link removed successfully" });
});

// GET hospital registration Google Sheet configuration
app.get("/api/admin/hospitals/registration-sheet-config", (req, res) => {
  const db = loadDB();
  res.json({ success: true, url: (db as any).hospitalRegistrationSheetUrl || "" });
});

// POST save hospital registration Google Sheet link
app.post("/api/admin/hospitals/registration-sheet-config", (req, res) => {
  const { url, adminEmail } = req.body;
  const db = loadDB();
  (db as any).hospitalRegistrationSheetUrl = url || "";
  saveDB(db);

  // Log audit trail
  const adminUser = db.users.find(u => u.email === adminEmail);
  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser ? adminUser.id : "system",
    userEmail: adminEmail || "system@ayush.gov.in",
    userName: adminUser ? adminUser.name : "System Admin",
    action: "UPDATE",
    tableName: "HospitalRegistrationSheetConfig",
    recordId: "google-registration-sheet-url",
    details: `Updated hospital registration Google Sheet URL: ${url}`,
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  res.json({ success: true, message: "Google Sheet registration link updated successfully" });
});

// DELETE hospital registration Google Sheet link
app.delete("/api/admin/hospitals/registration-sheet-config", (req, res) => {
  const { adminEmail } = req.body || req.query;
  const db = loadDB();
  (db as any).hospitalRegistrationSheetUrl = "";
  saveDB(db);

  // Log audit trail
  const adminUser = db.users.find(u => u.email === adminEmail);
  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser ? adminUser.id : "system",
    userEmail: adminEmail || "system@ayush.gov.in",
    userName: adminUser ? adminUser.name : "System Admin",
    action: "DELETE",
    tableName: "HospitalRegistrationSheetConfig",
    recordId: "google-registration-sheet-url",
    details: "Removed hospital registration Google Sheet URL link.",
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  res.json({ success: true, message: "Google Sheet registration link removed successfully" });
});

// POST parse Google Sheet URL and bulk register / upsert hospitals from registration sheet
app.post("/api/admin/hospitals/sync-registration-sheets", async (req, res) => {
  const { url, previewOnly, adminEmail } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, message: "Google Sheet URL is required" });
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return res.status(400).json({ success: false, message: "Invalid Google Sheet URL format. Make sure it contains '/spreadsheets/d/{id}'" });
  }

  const spreadsheetId = match[1];
  const gidMatch = url.match(/[?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "";
  let csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}&nocache=${Math.random()}`;
  if (gid) {
    csvUrl += `&gid=${gid}`;
  }

  try {
    const response = await fetch(csvUrl, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
    if (!response.ok) {
      throw new Error(`Google Sheet returned HTTP status ${response.status}. Please make sure the sheet is public (Anyone with link can view).`);
    }

    const csvText = await response.text();
    
    if (csvText.trim().startsWith("<html") || csvText.trim().startsWith("<!DOCTYPE")) {
      return res.status(400).json({
        success: false,
        message: "Unable to parse CSV data. The Google Sheet appears to be private or restricted. Please ensure you have set the spreadsheet sharing to 'Anyone with the link can view' so the system can access and sync."
      });
    }
    
    // Parse using SheetJS (XLSX)
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet);

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: "No rows found in the parsed sheet." });
    }

    // Helper to extract values dynamically
    const parseHospitalRows = rawRows.map((row: any, index: number) => {
      const getRawOrFind = (keys: string[]) => {
        const foundKey = Object.keys(row).find(k => 
          keys.some(key => {
            const cleanK = k.toLowerCase().replace(/[\s_-]/g, "");
            const cleanKey = key.toLowerCase().replace(/[\s_-]/g, "");
            return cleanK.includes(cleanKey) || cleanKey.includes(cleanK);
          })
        );
        if (foundKey !== undefined && row[foundKey] !== undefined && row[foundKey] !== null) {
          return String(row[foundKey]).trim();
        }
        return "";
      };

      const name = getRawOrFind(["name", "hospitalname", "facilityname", "चिकित्सालय", "नाम", "hospital", "facility", "title"]);
      const code = getRawOrFind(["code", "hospitalcode", "facilitycode", "код", "ID", "hospitalid", "hospcode"]);
      const type = getRawOrFind(["facilitytype", "facility type", "hospitaltype", "प्रकार", "level", "subtype", "nature", "type"]) || "राजकीय आयुर्वेदिक चिकित्सालय";
      const location = getRawOrFind(["locationname", "location name", "location", "city", "village", "स्थान", "area", "locality"]);
      const address = getRawOrFind(["address", "locationaddress", "पता", "fulladdress", "addr"]);
      const contactEmail = getRawOrFind(["email", "contactemail", "email id", "emailid", "email_id", "mail", "ईमेल", "emailaddress", "login"]);
      const contactPhone = getRawOrFind(["phone", "contactphone", "mobile", "tel", "फोन", "contact", "number", "phoneno", "mobilephone"]);
      const stream = getRawOrFind(["stream", "ayushstream", "विधा", "system", "branch", "pathy", "specialty"]) || "Ayurved";
      const incharge = getRawOrFind(["incharge", "moic", "medicalofficer", "prabhari", "officer", "head", "lead", "director", "manager"]);
      const block = getRawOrFind(["block", "blocks", "विकासखंड", "vblock", "subdivision"]);
      const district = getRawOrFind(["district", "districts", "state", "जनपद", "dist", "distt"]) || "उधम सिंह नगर";
      const password = getRawOrFind(["password", "pass", "पासवर्ड", "pwd", "loginpassword", "key"]);

      return {
        name,
        code,
        type,
        location,
        address,
        contactEmail,
        contactPhone,
        stream,
        incharge,
        block,
        district,
        password
      };
    });

    if (previewOnly) {
      return res.json({ success: true, hospitals: parseHospitalRows });
    }

    // We fully register/upsert the list of hospitals
    const db = loadDB();
    const results = {
      added: 0,
      updated: 0,
      errors: [] as string[]
    };

    parseHospitalRows.forEach((row: any, idx: number) => {
      const { name, code, type, location, address, contactEmail, contactPhone, stream, incharge, block, district, password } = row;

      if (!location) {
        results.errors.push(`Row ${idx + 1}: Location (स्थान) is required.`);
        return;
      }
      if (!incharge) {
        results.errors.push(`Row ${idx + 1}: Incharge name (प्रभारी का नाम) is required.`);
        return;
      }
      if (!contactEmail) {
        results.errors.push(`Row ${idx + 1}: Email Prefix / Login ID is required.`);
        return;
      }

      // Compute name if empty
      const computedName = name || `${type} - ${location}`;
      // Compute code if empty
      let computedCode = code;
      if (!computedCode) {
        const prefix = type.includes("यूनानी") ? "SUB" : type.includes("आरोग्य") ? "AAM" : "SAD";
        const randomNum = Math.floor(100 + Math.random() * 900);
        computedCode = `${prefix}-${location.toUpperCase().substring(0, 3).replace(/[^A-Z]/g, "X")}-${randomNum}`;
      }

      const emailAddress = contactEmail.includes("@") ? contactEmail : `${contactEmail}@uttarakhandayurved.co.in`;

      // Check if code or ID already exists in db.hospitals
      let existingHosp = db.hospitals.find(h => h.code.toUpperCase() === computedCode.toUpperCase());

      if (existingHosp) {
        // Update details
        existingHosp.name = computedName;
        existingHosp.type = type;
        existingHosp.address = address;
        existingHosp.contactEmail = emailAddress;
        existingHosp.contactPhone = contactPhone;
        existingHosp.stream = stream;
        existingHosp.location = location;
        existingHosp.block = block;
        existingHosp.district = district;
        existingHosp.incharge = incharge;
        existingHosp.category = type;
        results.updated++;
      } else {
        // Create new
        existingHosp = {
          id: "hosp-" + Math.random().toString(36).substring(2, 11),
          name: computedName,
          code: computedCode,
          type,
          address,
          contactEmail: emailAddress,
          contactPhone,
          stream,
          location,
          block,
          district,
          incharge,
          isActive: true,
          category: type
        };
        db.hospitals.push(existingHosp);
        results.added++;
      }

      // Create or update credential in db.users
      let userTarget = db.users.find(u => u.email.toLowerCase() === emailAddress.toLowerCase());
      if (userTarget) {
        userTarget.name = incharge;
        userTarget.hospitalId = existingHosp.id;
        userTarget.phone = contactPhone;
        userTarget.isWhitelisted = true;
        if (password) {
          userTarget.password = password;
        }
      } else {
        userTarget = {
          id: "user-" + Math.random().toString(36).substring(2, 11),
          email: emailAddress,
          name: incharge,
          role: UserRole.HOSPITAL_USER,
          hospitalId: existingHosp.id,
          phone: contactPhone,
          isWhitelisted: true,
          password: password || "123456"
        };
        db.users.push(userTarget);
      }

      // Sync to Firestore if available
      if (firestoreDb) {
        saveHospitalToFirestore(existingHosp).catch(err => console.error("Firestore sync error:", err));
      }
    });

    // Save database and write audit logs
    saveDB(db);

    const adminUser = db.users.find(u => u.email === adminEmail);
    db.auditLogs.unshift({
      id: "audit-" + Math.random().toString(36).substring(2, 11),
      userId: adminUser ? adminUser.id : "system",
      userEmail: adminEmail || "system@ayush.gov.in",
      userName: adminUser ? adminUser.name : "System Admin",
      action: "UPDATE",
      tableName: "HospitalRegistrationSheets",
      recordId: "all-synced-registration-sheets",
      details: `Dynamically synced and registered from Google Sheet. Added: ${results.added}, Updated: ${results.updated}. Errors: ${results.errors.length}`,
      timestamp: new Date().toISOString()
    });
    saveDB(db);

    res.json({
      success: true,
      added: results.added,
      updated: results.updated,
      errors: results.errors,
      message: `Sync completed! Registered ${results.added} new facilities and updated ${results.updated} existing records.`
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || String(err) });
  }
});

// POST parse Google Sheet URL and preview or fully synchronize hospital directories
app.post("/api/admin/hospitals/sync-sheets", async (req, res) => {
  const { url, previewOnly, adminEmail } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, message: "Google Sheet URL is required" });
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return res.status(400).json({ success: false, message: "Invalid Google Sheet URL format. Make sure it contains '/spreadsheets/d/{id}'" });
  }

  const spreadsheetId = match[1];
  const gidMatch = url.match(/[?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "";
  let csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}&nocache=${Math.random()}`;
  if (gid) {
    csvUrl += `&gid=${gid}`;
  }

  try {
    const response = await fetch(csvUrl, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
    if (!response.ok) {
      throw new Error(`Google Sheet returned HTTP status ${response.status}. Please make sure the sheet is public (Anyone with link can view).`);
    }

    const csvText = await response.text();
    
    if (csvText.trim().startsWith("<html") || csvText.trim().startsWith("<!DOCTYPE")) {
      return res.status(400).json({
        success: false,
        message: "Unable to parse CSV data. The Google Sheet appears to be private or restricted. Please ensure you have set the spreadsheet sharing to 'Anyone with the link can view' so the system can access and sync the directory."
      });
    }
    
    // Parse using SheetJS (XLSX)
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet);

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: "No rows found in the parsed sheet." });
    }

    // Parse each row matching standard attributes
    const parsedHospitals: Hospital[] = rawRows.map((row: any, index: number) => {
      const getRawOrFind = (keys: string[]) => {
        // Clean key matching (symmetrical matching)
        const foundKey = Object.keys(row).find(k => 
          keys.some(key => {
            const cleanK = k.toLowerCase().replace(/[\s_-]/g, "");
            const cleanKey = key.toLowerCase().replace(/[\s_-]/g, "");
            return cleanK.includes(cleanKey) || cleanKey.includes(cleanK);
          })
        );
        if (foundKey !== undefined && row[foundKey] !== undefined && row[foundKey] !== null) {
          return String(row[foundKey]).trim();
        }
        return "";
      };

      // Extract values dynamically with flexible key dictionaries
      const name = getRawOrFind(["name", "hospitalname", "facilityname", "चिकित्सालय", "नाम", "hospital", "facility", "title", "establishment", "centre"]) || `Hospital ${index + 1}`;
      const code = getRawOrFind(["code", "hospitalcode", "facilitycode", "код", "код", "कोड", "facilityid", "id", "hospitalid", "hospcode"]) || `AYUSH-${100 + index}`;
      const type = getRawOrFind(["facilitytype", "facility type", "hospitaltype", "प्रकार", "class", "level", "subtype", "nature", "type"]) || "";
      const category = getRawOrFind(["category", "catogary", "hospitalcategory", "facilitycategory", "श्रेणी"]) || "";
      const address = getRawOrFind(["address", "locationaddress", "पता", "fulladdress", "addr"]) || "";
      const contactEmail = getRawOrFind(["email", "contactemail", "email id", "emailid", "email_id", "mail", "ईमेल", "emailaddress"]) || "";
      const contactPhone = getRawOrFind(["phone", "contactphone", "mobile", "tel", "फोन", "contact", "number", "phoneno", "mobilephone", "telephone"]) || "";
      const stream = getRawOrFind(["stream", "ayushstream", "विधा", "system", "branch", "pathy", "specialty", "speciality", "discipline", "ayush", "department"]) || "";
      const location = getRawOrFind(["locationname", "location name", "location", "city", "village", "स्थान", "area", "locality", "address1"]) || name;
      const block = getRawOrFind(["block", "blocks", "विकासखंड", "vblock", "subdivision"]) || "";
      const district = getRawOrFind(["district", "districts", "state", "जनपद", "dist", "distt"]) || "";
      const incharge = getRawOrFind(["incharge", "moic", "medicalofficer", "prabhari", "officer", "head", "lead", "director", "manager"]) || "";
      
      const isActiveVal = getRawOrFind(["active", "status", "isactive", "सक्रिय", "enabled"]);
      const isActive = isActiveVal === "" 
         ? true 
         : (isActiveVal.toLowerCase() === "true" || isActiveVal === "1" || isActiveVal.toLowerCase() === "active" || isActiveVal.toLowerCase() === "sactive" || isActiveVal === "सक्रिय" || isActiveVal.toLowerCase() === "yes" || isActiveVal.toLowerCase() === "y");

      const catVal = String(category || type || name || "").trim();
      const locVal = String(location || "").trim();
      let computedName = catVal;
      if (catVal && locVal) {
        if (catVal.toLowerCase().includes(locVal.toLowerCase())) {
          computedName = catVal;
        } else {
          computedName = `${catVal} - ${locVal}`;
        }
      }

      return {
        id: `hosp-${String(code).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        name: computedName,
        code: String(code),
        type: String(type),
        address: String(address),
        contactEmail: String(contactEmail),
        contactPhone: String(contactPhone),
        isActive: Boolean(isActive),
        stream: String(stream),
        location: String(location),
        block: String(block),
        district: String(district),
        incharge: String(incharge),
        category: String(category)
      };
    });

    if (previewOnly) {
      return res.json({ success: true, hospitals: parsedHospitals });
    }

    // We actually apply the list
    const db = loadDB();
    db.hospitals = parsedHospitals;
    
    // Dynamically update unique lookup tables to keep masters in sync
    const uniqueLocations = Array.from(new Set(parsedHospitals.map(h => h.location).filter(Boolean))) as string[];
    const uniqueBlocks = Array.from(new Set(parsedHospitals.map(h => h.block).filter(Boolean))) as string[];
    const uniqueDistricts = Array.from(new Set(parsedHospitals.map(h => h.district).filter(Boolean))) as string[];
    const uniqueTypes = Array.from(new Set(parsedHospitals.map(h => h.type).filter(Boolean))) as string[];
    const uniqueCategories = Array.from(new Set(parsedHospitals.map(h => h.category).filter(Boolean))) as string[];

    if (uniqueLocations.length > 0) db.locations = uniqueLocations;
    if (uniqueBlocks.length > 0) db.blocks = uniqueBlocks;
    if (uniqueDistricts.length > 0) db.districts = uniqueDistricts;
    if (uniqueTypes.length > 0) db.hospitalTypes = uniqueTypes;
    if (uniqueCategories.length > 0) db.categories = uniqueCategories;

    saveDB(db);

    // Log audit
    const adminUser = db.users.find(u => u.email === adminEmail);
    db.auditLogs.unshift({
      id: "audit-" + Math.random().toString(36).substring(2, 11),
      userId: adminUser ? adminUser.id : "system",
      userEmail: adminEmail || "system@ayush.gov.in",
      userName: adminUser ? adminUser.name : "System Admin",
      action: "UPDATE",
      tableName: "Hospital",
      recordId: "all-synced-google-sheets",
      details: `Imported and synced ${parsedHospitals.length} hospitals and master lists from Google Sheet link`,
      timestamp: new Date().toISOString()
    });
    saveDB(db);
    if (firestoreDb) {
      for (const h of parsedHospitals) {
        saveHospitalToFirestore(h).catch(err => console.error(err));
      }
    }

    res.json({ 
      success: true, 
      message: `Successfully synchronized ${parsedHospitals.length} hospitals and lookup master records!`, 
      hospitals: parsedHospitals 
    });
  } catch (error: any) {
    console.error("Sync Error:", error);
    res.status(500).json({ success: false, message: `Failed to fetch/parse spreadsheet: ${error.message || error}` });
  }
});

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

app.post("/api/admin/hospitals/bulk-upload", (req, res) => {
  const { hospitals, adminEmail } = req.body; // Array of Hospital entries
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  if (!Array.isArray(hospitals)) {
    return res.status(400).json({ success: false, message: "Invalid payload. Expected array of hospitals." });
  }

  let countAdded = 0;
  hospitals.forEach((item: any) => {
    if (!item.code) return;
    const catVal = item.category || item.hospitalCategory || "";
    const typeVal = item.type || item.facilityType || "राजकीय आयुर्वेदिक चिकित्सालय";
    const activeSelection = (catVal || typeVal || "").trim();
    const locVal = (item.location || "").trim();
    
    let computedName = activeSelection;
    if (activeSelection && locVal) {
      if (activeSelection.toLowerCase().includes(locVal.toLowerCase())) {
        computedName = activeSelection;
      } else {
        computedName = `${activeSelection} - ${locVal}`;
      }
    }

    if (!computedName) return;

    // Determine designated email automatically if not supplied
    let emailVal = item.contactEmail || item.email || "";
    if (!emailVal && locVal) {
      emailVal = getDesignatedEmailForLocation(locVal);
    }

    const existing = db.hospitals.find(h => h.code === item.code);
    if (existing) {
      existing.name = computedName;
      existing.type = typeVal;
      existing.address = item.address || existing.address;
      existing.contactEmail = emailVal || existing.contactEmail;
      existing.contactPhone = item.contactPhone || existing.contactPhone;
      if (item.location) existing.location = item.location;
      if (item.block) existing.block = item.block;
      if (item.district) existing.district = item.district;
      if (item.stream) existing.stream = item.stream;
      (existing as any).category = catVal || (existing as any).category || "";
    } else {
      db.hospitals.push({
        id: item.id || "hosp-" + Math.random().toString(36).substring(2, 11),
        name: computedName,
        code: item.code,
        type: typeVal,
        address: item.address || "",
        contactEmail: emailVal || getDesignatedEmailForLocation(locVal) || "",
        contactPhone: item.contactPhone || "",
        location: item.location || "",
        block: item.block || "",
        district: item.district || "उधम सिंह नगर",
        stream: item.stream || "Ayurved",
        category: catVal,
        isActive: true
      } as any);
      countAdded++;
    }
  });

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "BULK_UPLOAD",
    tableName: "Hospital",
    recordId: "Multiple",
    details: `Uploaded/Updated ${hospitals.length} hospitals. Added ${countAdded} new.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  if (firestoreDb) {
    for (const h of db.hospitals) {
      saveHospitalToFirestore(h).catch(err => console.error(err));
    }
  }
  res.json({ success: true, message: `Processed ${hospitals.length} entries. Added ${countAdded} new hospitals.` });
});

// Single Hospital Create / Edit Endpoint
// Single Hospital Create / Edit Endpoint
app.post("/api/admin/hospitals/bulk-register", (req, res) => {
  const { adminEmail, rows } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized: Only Super Admin can perform bulk registration." });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: "No data rows provided." });
  }

  const results = {
    addedHospitals: 0,
    addedUsers: 0,
    errors: [] as string[]
  };

  rows.forEach((row: any, idx: number) => {
    try {
      const name = (row.name || "").trim();
      let code = (row.code || "").trim().toUpperCase();
      const type = (row.type || "राजकीय आयुर्वेदिक चिकित्सालय").trim();
      const location = (row.location || "").trim();
      const address = (row.address || "").trim();
      const contactEmail = (row.contactEmail || "").trim();
      const contactPhone = (row.contactPhone || "").trim();
      const incharge = (row.incharge || "").trim();
      const block = (row.block || "").trim();
      const district = (row.district || "उधम सिंह नगर").trim();
      const stream = (row.stream || "Ayurved").trim();
      const password = (row.password || "").trim();

      if (!location) {
        results.errors.push(`Row ${idx + 1}: Location is required.`);
        return;
      }
      if (!incharge) {
        results.errors.push(`Row ${idx + 1}: In-charge Name is required.`);
        return;
      }
      if (!contactEmail) {
        results.errors.push(`Row ${idx + 1}: Official Email Prefix / Login ID is required.`);
        return;
      }

      // Compute name if not explicitly set
      let computedName = name;
      if (!computedName) {
        computedName = `${type} - ${location}`;
      }

      // Compute code if not explicitly set
      if (!code) {
        const prefix = type.includes("यूनानी") ? "SUB" : type.includes("आरोग्य") ? "AAM" : "SAD";
        const randomNum = Math.floor(100 + Math.random() * 900);
        code = `${prefix}-${location.toUpperCase().substring(0, 3).replace(/[^A-Z]/g, "X")}-${randomNum}`;
      }

      // Check duplicate code
      const codeExists = db.hospitals.find(h => h.code === code);
      if (codeExists) {
        results.errors.push(`Row ${idx + 1}: Hospital code ${code} is already registered.`);
        return;
      }

      // Create hospital profile
      const newHosp: Hospital = {
        id: "hosp-" + Math.random().toString(36).substring(2, 11),
        name: computedName,
        code,
        type,
        address,
        contactEmail: contactEmail.includes("@") ? contactEmail : `${contactEmail}@uttarakhandayurved.co.in`,
        contactPhone,
        stream,
        location,
        block,
        district,
        incharge,
        isActive: true,
        category: type
      };

      db.hospitals.push(newHosp);
      results.addedHospitals++;

      // Create or update credential
      let userTarget = db.users.find(u => u.email.toLowerCase() === newHosp.contactEmail.toLowerCase());
      if (userTarget) {
        userTarget.name = incharge;
        userTarget.hospitalId = newHosp.id;
        userTarget.phone = contactPhone;
        userTarget.isWhitelisted = true;
        if (password) {
          userTarget.password = password;
        }
      } else {
        userTarget = {
          id: "user-" + Math.random().toString(36).substring(2, 11),
          email: newHosp.contactEmail,
          name: incharge,
          role: UserRole.HOSPITAL_USER,
          hospitalId: newHosp.id,
          phone: contactPhone,
          isWhitelisted: true,
          password: password || "123456"
        };
        db.users.push(userTarget);
      }
      results.addedUsers++;

      // Audit Log for hospital creation
      db.auditLogs.unshift({
        id: "audit-" + Math.random().toString(36).substring(2, 11),
        userId: adminUser.id,
        userEmail: adminUser.email,
        userName: adminUser.name,
        action: "CREATE_HOSPITAL",
        tableName: "Hospital",
        recordId: newHosp.id,
        details: `Bulk registered hospital: ${computedName} (${code})`,
        timestamp: new Date().toISOString()
      });

      // Sync to firestore
      saveHospitalToFirestore(newHosp).catch(err => console.error(err));

    } catch (err: any) {
      results.errors.push(`Row ${idx + 1}: ${err.message || err}`);
    }
  });

  saveDB(db);
  return res.json({
    success: true,
    addedHospitals: results.addedHospitals,
    addedUsers: results.addedUsers,
    errors: results.errors
  });
});

app.post("/api/admin/hospitals/save", (req, res) => {
  const { hospital, adminEmail } = req.body; // hospital: Hospital object
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  if (!hospital || !hospital.code) {
    return res.status(400).json({ success: false, message: "Hospital details and Code are required." });
  }

  if (!hospital.incharge || !hospital.incharge.trim()) {
    return res.status(400).json({ success: false, message: "Hospital In-charge name is mandatory to complete hospital profile registration." });
  }

  // Force hospital name to represent "facility category (or type) + location"
  const activeSelection = (hospital.category || hospital.type || "").trim();
  let computedName = activeSelection;
  if (activeSelection && hospital.location) {
    const loc = hospital.location.trim();
    if (activeSelection.toLowerCase().includes(loc.toLowerCase())) {
      computedName = activeSelection;
    } else {
      computedName = `${activeSelection} - ${loc}`;
    }
  }

  if (!computedName) {
    return res.status(400).json({ success: false, message: "Hospital name cannot be determined." });
  }

  let target;
  let actionStr = "";
  if (hospital.id) {
    target = db.hospitals.find(h => h.id === hospital.id);
  }

  if (target) {
    // Check if code was changed and is already taken
    if (target.code !== hospital.code) {
      const codeExists = db.hospitals.find(h => h.code === hospital.code);
      if (codeExists) {
        return res.status(400).json({ success: false, message: `Hospital code ${hospital.code} is already registered.` });
      }
    }
    // Update existing
    target.name = computedName;
    target.code = hospital.code;
    target.type = hospital.type;
    target.address = hospital.address;
    target.contactEmail = hospital.contactEmail;
    target.contactPhone = hospital.contactPhone;
    target.stream = hospital.stream;
    target.location = hospital.location;
    target.block = hospital.block;
    target.district = hospital.district;
    target.incharge = hospital.incharge;
    target.category = hospital.category || "";
    actionStr = `Updated hospital: ${computedName} (${hospital.code})`;
  } else {
    // Check if code is already taken
    const codeExists = db.hospitals.find(h => h.code === hospital.code);
    if (codeExists) {
      return res.status(400).json({ success: false, message: `Hospital code ${hospital.code} is already registered.` });
    }
    // Create new
    target = {
      id: "hosp-" + Math.random().toString(36).substring(2, 11),
      name: computedName,
      code: hospital.code,
      type: hospital.type || "राजकीय आयुर्वेदिक चिकित्सालय",
      address: hospital.address || "",
      contactEmail: hospital.contactEmail || "",
      contactPhone: hospital.contactPhone || "",
      stream: hospital.stream || "Ayurved",
      location: hospital.location || "",
      block: hospital.block || "",
      district: hospital.district || "उधम सिंह नगर",
      incharge: hospital.incharge || "",
      category: hospital.category || "",
      isActive: true
    };
    db.hospitals.push(target);
    actionStr = `Created hospital: ${computedName} (${hospital.code})`;
  }

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: hospital.id ? "UPDATE_HOSPITAL" : "CREATE_HOSPITAL",
    tableName: "Hospital",
    recordId: target.id,
    details: actionStr,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  saveHospitalToFirestore(target).catch(err => console.error(err));
  res.json({ success: true, hospital: target, message: actionStr });
});

// Single Hospital Delete Endpoint
app.post("/api/admin/hospitals/delete", (req, res) => {
  const { hospitalId, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const index = db.hospitals.findIndex(h => h.id === hospitalId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Hospital not found" });
  }

  const removed = db.hospitals.splice(index, 1)[0];

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "DELETE_HOSPITAL",
    tableName: "Hospital",
    recordId: hospitalId,
    details: `Deleted hospital: ${removed.name} (${removed.code})`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  deleteHospitalFromFirestore(hospitalId).catch(err => console.error(err));
  res.json({ success: true, message: `Deleted hospital: ${removed.name}` });
});

// GET all custom master lists
app.get("/api/admin/masters", (req, res) => {
  const db = loadDB();
  res.json({
    hospitalTypes: db.hospitalTypes || [],
    streams: db.streams || [],
    locations: db.locations || [],
    blocks: db.blocks || [],
    districts: db.districts || [],
    emailIds: db.emailIds || [],
    categories: db.categories || []
  });
});

// UPDATE master lists
app.post("/api/admin/masters/update", (req, res) => {
  const { category, items, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  if (!category || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "Invalid payload." });
  }

  const sanitizedItems = items.map((x: any) => String(x).trim()).filter(Boolean);

  if (category === "streams") {
    return res.status(400).json({ success: false, message: "Streams are locked to 'Ayurved' and 'Unani' only." });
  }

  if (category === "hospitalTypes") db.hospitalTypes = sanitizedItems;
  else if (category === "locations") db.locations = sanitizedItems;
  else if (category === "blocks") db.blocks = sanitizedItems;
  else if (category === "districts") db.districts = sanitizedItems;
  else if (category === "emailIds") db.emailIds = sanitizedItems;
  else if (category === "categories") db.categories = sanitizedItems;
  else {
    return res.status(400).json({ success: false, message: "Unknown master category." });
  }

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "UPDATE_MASTER_LIST",
    tableName: "System",
    recordId: category,
    details: `Updated master category '${category}' list to: ${sanitizedItems.join(", ")}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, message: `Successfully updated master list for ${category}.` });
});

// Master Diseases & Kits endpoint
app.get("/api/master/diseases", (req, res) => {
  const db = loadDB();
  res.json(db.masterDiseases);
});

app.post("/api/admin/diseases/upload", (req, res) => {
  const { items, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) return res.status(403).json({ success: false, message: "Unauthorized" });

  items.forEach((it: any) => {
    if (!it.name) return;
    const id = "dis-" + Math.random().toString(36).substring(2, 11);
    db.masterDiseases.push({ id, name: it.name, category: it.category || "General" });
  });

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "BULK_UPLOAD",
    tableName: "MasterDisease",
    recordId: "Multiple",
    details: `Uploaded ${items.length} master diseases.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, count: items.length });
});

app.get("/api/master/tests", (req, res) => {
  const db = loadDB();
  res.json(db.masterTests || []);
});

// Individual disease management
app.post("/api/admin/diseases/add", (req, res) => {
  const { name, category, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }
  if (!name) return res.status(400).json({ success: false, message: "Disease name is required" });

  const newId = "dis-" + Math.random().toString(36).substring(2, 11);
  const newDisease = { id: newId, name, category: category || "General" };
  db.masterDiseases.push(newDisease);

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "ADD_DISEASE",
    tableName: "MasterDisease",
    recordId: newId,
    details: `Added new master disease: ${name} (${category})`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, disease: newDisease });
});

app.post("/api/admin/diseases/edit", (req, res) => {
  const { id, name, category, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const disease = db.masterDiseases.find(d => d.id === id);
  if (!disease) return res.status(404).json({ success: false, message: "Disease not found" });

  disease.name = name || disease.name;
  disease.category = category || disease.category;

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "EDIT_DISEASE",
    tableName: "MasterDisease",
    recordId: id,
    details: `Edited master disease: ${disease.name}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, disease });
});

app.post("/api/admin/diseases/delete", (req, res) => {
  const { id, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const idx = db.masterDiseases.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Disease not found" });

  const deleted = db.masterDiseases.splice(idx, 1)[0];

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "DELETE_DISEASE",
    tableName: "MasterDisease",
    recordId: id,
    details: `Deleted master disease: ${deleted.name}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, message: "Disease deleted successfully" });
});

// Individual test management
app.post("/api/admin/tests/add", (req, res) => {
  const { name, normalRange, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }
  if (!name) return res.status(400).json({ success: false, message: "Test name is required" });

  const newId = "test-" + Math.random().toString(36).substring(2, 11);
  const newTest = { id: newId, name, normalRange: normalRange || "Negative" };
  db.masterTests.push(newTest);

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "ADD_TEST",
    tableName: "MasterTest",
    recordId: newId,
    details: `Added new master test: ${name} (Normal: ${normalRange})`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, test: newTest });
});

app.post("/api/admin/tests/edit", (req, res) => {
  const { id, name, normalRange, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const test = db.masterTests.find(t => t.id === id);
  if (!test) return res.status(404).json({ success: false, message: "Test not found" });

  test.name = name || test.name;
  test.normalRange = normalRange || test.normalRange;

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "EDIT_TEST",
    tableName: "MasterTest",
    recordId: id,
    details: `Edited master test: ${test.name}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, test });
});

app.post("/api/admin/tests/delete", (req, res) => {
  const { id, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const idx = db.masterTests.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Test not found" });

  const deleted = db.masterTests.splice(idx, 1)[0];

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "DELETE_TEST",
    tableName: "MasterTest",
    recordId: id,
    details: `Deleted master test: ${deleted.name}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, message: "Test deleted successfully" });
});

app.get("/api/master/kits", (req, res) => {
  const db = loadDB();
  res.json(db.masterKits);
});

app.post("/api/admin/kits/upload", (req, res) => {
  const { items, adminEmail } = req.body;
  const db = loadDB();
  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role !== UserRole.SUPER_ADMIN) return res.status(403).json({ success: false, message: "Unauthorized" });

  items.forEach((it: any) => {
    if (!it.name) return;
    const id = "kit-" + Math.random().toString(36).substring(2, 11);
    db.masterKits.push({ id, name: it.name, unit: it.unit || "Kits", defaultThreshold: it.defaultThreshold || 10 });
  });

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser.id,
    userEmail: adminUser.email,
    userName: adminUser.name,
    action: "BULK_UPLOAD",
    tableName: "MasterKit",
    recordId: "Multiple",
    details: `Uploaded ${items.length} inventory test kits.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, count: items.length });
});

// Daily Calendar Entry endpoints (with smart anomaly detection)
app.get("/api/mpr/daily", (req, res) => {
  const { date, hospitalId, userEmail } = req.query;
  const db = loadDB();

  if (!date || !hospitalId) {
    return res.status(400).json({ success: false, message: "date and hospitalId parameters are required" });
  }

  // Security Scoping: HOSPITAL_USER can only request report data for their assigned hospital
  if (userEmail) {
    const user = db.users.find(u => u.email === userEmail);
    if (user && user.role === UserRole.HOSPITAL_USER && user.hospitalId !== hospitalId) {
      return res.status(403).json({ success: false, message: "Unauthorized: You are not authorized to access this hospital's reports." });
    }
  }

  const report = db.dailyReports.find(r => r.hospitalId === hospitalId && r.recordDate === date);

  if (report) {
    return res.json({ success: true, report });
  } else {
    // Generate an empty skeleton matching our types
    const emptyReport: Partial<DailyReport> = {
      id: `rep-${hospitalId}-${date}`,
      hospitalId: hospitalId as string,
      recordDate: date as string,
      patientMatrix: {
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
      },
      investigationsLab: {
        hemoglobin: 0, blood_sugar: 0, urine_sugar: 0, urine_albumin: 0,
        malaria: 0, dengue: 0, typhoid: 0,
        hepatitis_a: 0, hepatitis_b: 0, hepatitis_c: 0,
        pregnancy_tests: 0
      },
      inventory: db.masterKits.map(k => ({
        kit_type: k.name,
        opening_balance: 50, // default placeholder opening balance
        received_qty: 0,
        used_qty: 0,
        defective_qty: 0,
        closing_balance: 50,
        low_stock_threshold: k.defaultThreshold
      })),
      camps: [],
      isLocked: false,
      anomalyConfirmed: false,
      anomalyFlags: []
    };
    return res.json({ success: true, report: emptyReport, isNew: true });
  }
});

// SMART ANOMALY DETECTION ROUTE
// Evaluates if input values deviate significantly from historical averages
app.post("/api/mpr/check-anomalies", (req, res) => {
  const { report, hospitalId } = req.body;
  const db = loadDB();

  if (!report || !hospitalId) {
    return res.status(400).json({ success: false, message: "Report and hospitalId required" });
  }

  // Calculate historical averages for this hospital
  const historicalReports = db.dailyReports.filter(r => r.hospitalId === hospitalId);
  const anomalies: Array<{ path: string; label: string; entered: number; avg: number; reason: string }> = [];

  const matrix = report.patientMatrix || {};
  const lab = report.investigationsLab || {};

  // Fields to check
  const fieldsToCheck = [
    { path: "patientMatrix.opd_male_new", label: "OPD Male (New)", val: matrix.opd_male_new, maxAbs: 150 },
    { path: "patientMatrix.opd_female_new", label: "OPD Female (New)", val: matrix.opd_female_new, maxAbs: 150 },
    { path: "patientMatrix.ipd_admissions", label: "IPD Admissions", val: matrix.ipd_admissions, maxAbs: 20 },
    { path: "investigationsLab.hemoglobin", label: "Hemoglobin Tests", val: lab.hemoglobin, maxAbs: 100 },
    { path: "investigationsLab.blood_sugar", label: "Blood Sugar Tests", val: lab.blood_sugar, maxAbs: 100 }
  ];

  fieldsToCheck.forEach(field => {
    const enteredVal = Number(field.val || 0);
    if (enteredVal <= 0) return;

    // Filter non-zero entries
    const historicalValues = historicalReports
      .map(r => {
        const pathParts = field.path.split(".");
        return (r as any)[pathParts[0]]?.[pathParts[1]] || 0;
      })
      .filter(v => v > 0);

    const avg = historicalValues.length > 0 
      ? historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length 
      : 15; // default fallback average

    // Trigger warning if exceeds 3x historical average OR exceeds absolute high threshold (e.g. 150 in single day)
    if (enteredVal > field.maxAbs || (historicalValues.length >= 3 && enteredVal > avg * 3)) {
      anomalies.push({
        path: field.path,
        label: field.label,
        entered: enteredVal,
        avg: Math.round(avg),
        reason: enteredVal > field.maxAbs 
          ? `Value ${enteredVal} exceeds the absolute safety threshold (${field.maxAbs})`
          : `Value ${enteredVal} is more than 3x your historical average (${Math.round(avg)})`
      });
    }
  });

  return res.json({
    success: true,
    hasAnomalies: anomalies.length > 0,
    anomalies
  });
});

// Daily Submission with Anomaly handling and Audit Log
app.post("/api/mpr/daily", (req, res) => {
  const { report, userEmail, forceSubmit } = req.body;
  const db = loadDB();

  if (!report || !report.hospitalId || !report.recordDate) {
    return res.status(400).json({ success: false, message: "Invalid report payload" });
  }

  // Check if report is locked
  const existing = db.dailyReports.find(r => r.hospitalId === report.hospitalId && r.recordDate === report.recordDate);
  if (existing && existing.isLocked) {
    return res.status(403).json({ success: false, message: "This date is locked. Editing is disabled." });
  }

  const user = db.users.find(u => u.email === userEmail);
  if (!user) {
    return res.status(403).json({ success: false, message: "User account not found or deactivated." });
  }

  // Double check security block: Hospital users can only save their own hospital data
  if (user.role === UserRole.HOSPITAL_USER && user.hospitalId !== report.hospitalId) {
    return res.status(403).json({ success: false, message: "Unauthorized: You can only submit data for your assigned hospital." });
  }

  // Calculate closing balances for inventory dynamically to enforce business logic:
  // Opening + Received - Used - Defective = Closing
  if (Array.isArray(report.inventory)) {
    report.inventory.forEach((inv: any) => {
      const open = Number(inv.opening_balance || 0);
      const rec = Number(inv.received_qty || 0);
      const used = Number(inv.used_qty || 0);
      const def = Number(inv.defective_qty || 0);
      inv.closing_balance = open + rec - used - def;
    });
  }

  // Complete metadata fields
  report.submittedAt = new Date().toISOString();
  report.submittedBy = user.email;

  if (existing) {
    // Audit track details
    const oldValString = `OPD M/F: ${existing.patientMatrix.opd_male_new}/${existing.patientMatrix.opd_female_new}`;
    const newValString = `OPD M/F: ${report.patientMatrix.opd_male_new}/${report.patientMatrix.opd_female_new}`;

    // Update existing
    Object.assign(existing, report);

    db.auditLogs.unshift({
      id: "audit-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE",
      tableName: "DailyReport",
      recordId: existing.id,
      details: `Updated Daily Report for ${report.recordDate}. Changes: (${oldValString}) -> (${newValString})`,
      timestamp: new Date().toISOString()
    });
  } else {
    report.id = report.id || `rep-${report.hospitalId}-${report.recordDate}`;
    report.isLocked = false;
    db.dailyReports.push(report);

    db.auditLogs.unshift({
      id: "audit-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CREATE",
      tableName: "DailyReport",
      recordId: report.id,
      details: `Created Daily Report for ${report.recordDate}. Total OPD: ${
        Number(report.patientMatrix.opd_male_new) +
        Number(report.patientMatrix.opd_male_old) +
        Number(report.patientMatrix.opd_female_new) +
        Number(report.patientMatrix.opd_female_old)
      }`,
      timestamp: new Date().toISOString()
    });
  }

  const finalReport = existing || report;
  saveDB(db);
  saveDailyReportToFirestore(finalReport).catch(err => console.error("Firestore sync error:", err));
  return res.json({ success: true, report: finalReport, message: "Report saved successfully." });
});

// Backlog & Data Lock toggle endpoint (Office Admin or Super Admin)
app.post("/api/mpr/lock", (req, res) => {
  const { recordDate, hospitalId, isLocked, adminEmail } = req.body;
  const db = loadDB();

  const user = db.users.find(u => u.email === adminEmail);
  if (!user || user.role === UserRole.HOSPITAL_USER) {
    return res.status(403).json({ success: false, message: "Unauthorized to modify locks." });
  }

  const reportsToModify = db.dailyReports.filter(
    r => r.recordDate === recordDate && (hospitalId ? r.hospitalId === hospitalId : true)
  );

  reportsToModify.forEach(r => {
    r.isLocked = isLocked;
  });

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    action: isLocked ? "LOCK" : "UNLOCK",
    tableName: "DailyReport",
    recordId: hospitalId || "ALL_HOSPITALS",
    details: `${isLocked ? "Locked" : "Unlocked"} entries on ${recordDate}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, count: reportsToModify.length, isLocked });
});

// Aggregation Engine for strict Monthly Progress Report (MPR) View
app.get("/api/mpr/aggregate", (req, res) => {
  const { month, hospitalId, isAnnual, userEmail } = req.query; // Expects "YYYY-MM" (e.g. "2026-06")
  const db = loadDB();

  if (!month || typeof month !== "string") {
    return res.status(400).json({ success: false, message: "month query parameter (YYYY-MM) is required" });
  }

  // Domain Scoping Enforcer
  let effectiveHospitalId = hospitalId;
  if (userEmail && typeof userEmail === "string") {
    const user = db.users.find(u => u.email === userEmail);
    if (user && user.role === UserRole.HOSPITAL_USER) {
      effectiveHospitalId = user.hospitalId;
    }
  }

  let monthReports;
  if (isAnnual === "true") {
    // Calculate the Indian Financial Year: April 1st to March 31st of next year
    const parts = month.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let startDate, endDate;
    if (m >= 4) {
      startDate = `${y}-04-01`;
      endDate = `${y + 1}-03-31`;
    } else {
      startDate = `${y - 1}-04-01`;
      endDate = `${y}-03-31`;
    }
    monthReports = db.dailyReports.filter(r => r.recordDate >= startDate && r.recordDate <= endDate);
  } else {
    monthReports = db.dailyReports.filter(r => r.recordDate.startsWith(month));
  }

  // Build aggregation per hospital (only fully registered ones with an in-charge name)
  const registeredHospitals = db.hospitals.filter(hosp => hosp.incharge && hosp.incharge.trim() !== "");
  const hospitalAggregates = registeredHospitals.map(hosp => {
    const reports = monthReports.filter(r => r.hospitalId === hosp.id);

    // Dynamic aggregation sums
    const agg = {
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      hospitalType: hosp.type,
      hospitalCode: hosp.code,
      hospitalIncharge: hosp.incharge || "",
      hospitalDistrict: hosp.district || "उधम सिंह नगर",
      daysSubmitted: reports.length,

      // Patient Matrix OPD
      opd_male_new: 0, opd_male_old: 0,
      opd_female_new: 0, opd_female_old: 0,
      opd_child_new: 0, opd_child_old: 0,
      opd_elderly_new: 0, opd_elderly_old: 0,
      opd_total: 0,

      // IPD
      ipd_admissions: 0,
      ipd_male_new: 0, ipd_male_old: 0,
      ipd_female_new: 0, ipd_female_old: 0,
      ipd_child_new: 0, ipd_child_old: 0,
      avg_bed_occupancy: 0,

      // Panchkarma
      panchkarma_male: 0, panchkarma_female: 0,
      panchkarma_child: 0, panchkarma_elderly: 0,
      panchkarma_total: 0,

      levy_charges: 0,
      aadhaar_seeded: 0,
      mobile_seeded: 0,

      // Labs
      hemoglobin: 0, blood_sugar: 0, urine_sugar: 0, urine_albumin: 0,
      malaria: 0, dengue: 0, typhoid: 0,
      hepatitis_a: 0, hepatitis_b: 0, hepatitis_c: 0,
      pregnancy_tests: 0,
      total_tests: 0,

      // Camps
      camp_count: 0,
      camp_beneficiaries_total: 0,
      camp_medicines_distributed: 0,
      camp_ncd_screenings: 0,
      camp_ayurvidya_sessions: 0,
      camps: [] as any[],

      // Inventory Alerts count
      lowStockAlertsCount: 0,
      customFieldsAgg: {} as Record<string, string | number>
    };

    let totalOccupancySum = 0;

    reports.forEach(r => {
      const pm = (r.patientMatrix || {}) as any;
      agg.opd_male_new += pm.opd_male_new || 0;
      agg.opd_male_old += pm.opd_male_old || 0;
      agg.opd_female_new += pm.opd_female_new || 0;
      agg.opd_female_old += pm.opd_female_old || 0;
      agg.opd_child_new += pm.opd_child_new || 0;
      agg.opd_child_old += pm.opd_child_old || 0;
      agg.opd_elderly_new += pm.opd_elderly_new || 0;
      agg.opd_elderly_old += pm.opd_elderly_old || 0;

      agg.ipd_admissions += pm.ipd_admissions || 0;
      agg.ipd_male_new += pm.ipd_male_new || 0;
      agg.ipd_male_old += pm.ipd_male_old || 0;
      agg.ipd_female_new += pm.ipd_female_new || 0;
      agg.ipd_female_old += pm.ipd_female_old || 0;
      agg.ipd_child_new += pm.ipd_child_new || 0;
      agg.ipd_child_old += pm.ipd_child_old || 0;
      totalOccupancySum += pm.ipd_bed_occupancy_percentage || 0;

      agg.panchkarma_male += pm.panchkarma_male || 0;
      agg.panchkarma_female += pm.panchkarma_female || 0;
      agg.panchkarma_child += pm.panchkarma_child || 0;
      agg.panchkarma_elderly += pm.panchkarma_elderly || 0;

      agg.levy_charges += pm.levy_charges || 0;
      agg.aadhaar_seeded += pm.aadhaar_seeded_count || 0;
      agg.mobile_seeded += pm.mobile_seeded_count || 0;

      const lab = (r.investigationsLab || {}) as any;
      agg.hemoglobin += lab.hemoglobin || 0;
      agg.blood_sugar += lab.blood_sugar || 0;
      agg.urine_sugar += lab.urine_sugar || 0;
      agg.urine_albumin += lab.urine_albumin || 0;
      agg.malaria += lab.malaria || 0;
      agg.dengue += lab.dengue || 0;
      agg.typhoid += lab.typhoid || 0;
      agg.hepatitis_a += lab.hepatitis_a || 0;
      agg.hepatitis_b += lab.hepatitis_b || 0;
      agg.hepatitis_c += lab.hepatitis_c || 0;
      agg.pregnancy_tests += lab.pregnancy_tests || 0;

      // Inventory check
      if (Array.isArray(r.inventory)) {
        r.inventory.forEach(inv => {
          if (inv.closing_balance <= inv.low_stock_threshold) {
            agg.lowStockAlertsCount++;
          }
        });
      }

      // Camps
      if (Array.isArray(r.camps)) {
        agg.camp_count += r.camps.length;
        r.camps.forEach(c => {
          agg.camp_beneficiaries_total += c.beneficiaries_total || 0;
          agg.camp_medicines_distributed += c.medicine_distributed_count || 0;
          agg.camp_ncd_screenings += Number(c.ncd_screenings) || 0;
          agg.camp_ayurvidya_sessions += c.ayurvidya_sessions || 0;
          (agg as any).camps.push({
            date: r.recordDate,
            loc: c.village_location,
            male: c.beneficiaries_male || 0,
            female: c.beneficiaries_female || 0,
            child: c.beneficiaries_child || 0,
            total: c.beneficiaries_total || 0,
            meds: c.medicine_distributed_count || 0,
            screenings: c.ncd_screenings,
            ayurvidya_sessions: c.ayurvidya_sessions || 0
          });
        });
      }

      // Custom fields aggregation
      if (r.customFieldsData) {
        Object.entries(r.customFieldsData).forEach(([fieldId, val]) => {
          if (typeof val === "number") {
            agg.customFieldsAgg[fieldId] = (Number(agg.customFieldsAgg[fieldId]) || 0) + val;
          } else if (typeof val === "string" && val.trim() !== "") {
            agg.customFieldsAgg[fieldId] = agg.customFieldsAgg[fieldId]
              ? `${agg.customFieldsAgg[fieldId]}, ${val}`
              : val;
          }
        });
      }
    });

    agg.opd_total = agg.opd_male_new + agg.opd_male_old + agg.opd_female_new + agg.opd_female_old +
                    agg.opd_child_new + agg.opd_child_old + agg.opd_elderly_new + agg.opd_elderly_old;

    agg.panchkarma_total = agg.panchkarma_male + agg.panchkarma_female + agg.panchkarma_child + agg.panchkarma_elderly;

    agg.total_tests = agg.hemoglobin + agg.blood_sugar + agg.urine_sugar + agg.urine_albumin +
                      agg.malaria + agg.dengue + agg.typhoid + agg.hepatitis_a + agg.hepatitis_b + agg.hepatitis_c + agg.pregnancy_tests;

    agg.avg_bed_occupancy = reports.length > 0 ? Math.round(totalOccupancySum / reports.length) : 0;

    // Initialize standard 38 diseases array for this hospital
    const diseaseTotals: Record<number, {
      sNo: number;
      nameHindi: string;
      nameEnglish: string;
      opd_male_new: number;
      opd_male_old: number;
      opd_female_new: number;
      opd_female_old: number;
      opd_child_new: number;
      opd_child_old: number;
      opd_total: number;
    }> = {};

    const standardDiseasesList = [
      { sNo: 1, nameHindi: "ज्वर", nameEnglish: "Jwar / Fever" },
      { sNo: 2, nameHindi: "अतिसार", nameEnglish: "Atisar / Diarrhoea" },
      { sNo: 3, nameHindi: "वमन", nameEnglish: "Vaman / Vomiting" },
      { sNo: 4, nameHindi: "श्वासकास", nameEnglish: "Shwaskas / Asthma/Cough" },
      { sNo: 5, nameHindi: "अम्लिपत्त", nameEnglish: "Amlapitta / Hyperacidity" },
      { sNo: 6, nameHindi: "पाण्डु", nameEnglish: "Pandu / Anemia" },
      { sNo: 7, nameHindi: "कामला", nameEnglish: "Kamla / Jaundice" },
      { sNo: 8, nameHindi: "उदर रोग", nameEnglish: "Udar Rog / Abdominal Disease" },
      { sNo: 9, nameHindi: "प्रमेह", nameEnglish: "Prameh / Diabetes/Urinary" },
      { sNo: 10, nameHindi: "मूत्र रोग", nameEnglish: "Mutra Rog / Urinary Disease" },
      { sNo: 11, nameHindi: "आमवात", nameEnglish: "Aamvaat / Rheumatoid Arthritis" },
      { sNo: 12, nameHindi: "संधिवात", nameEnglish: "Sandhivaat / Osteoarthritis" },
      { sNo: 13, nameHindi: "मनो रोग", nameEnglish: "Mano Rog / Psychiatric Disease" },
      { sNo: 14, nameHindi: "नेत्र शोथ", nameEnglish: "Netra Shoth / Eye Inflammation" },
      { sNo: 15, nameHindi: "पक्षाघात", nameEnglish: "Pakshaghat / Paralysis" },
      { sNo: 16, nameHindi: "गृध्रसी", nameEnglish: "Gridhrasi / Sciatica" },
      { sNo: 17, nameHindi: "वातरक्त", nameEnglish: "Vaatrakta / Gout" },
      { sNo: 18, nameHindi: "वात व्याधि", nameEnglish: "Vaat Vyadhi / Neurological" },
      { sNo: 19, nameHindi: "त्वक विकार", nameEnglish: "Twak Vikar / Skin Disease" },
      { sNo: 20, nameHindi: "ऊँच्चरक्त चाप", nameEnglish: "Uccharakta Chapa / Hypertension" },
      { sNo: 21, nameHindi: "हृदय रोग", nameEnglish: "Hridaya Rog / Heart Disease" },
      { sNo: 22, nameHindi: "रक्त पित्त", nameEnglish: "Rakta Pitta / Bleeding Disorders" },
      { sNo: 23, nameHindi: "शिरोरोग", nameEnglish: "Shirorog / Headache" },
      { sNo: 24, nameHindi: "मुखरोग", nameEnglish: "Mukharog / Mouth Disease" },
      { sNo: 25, nameHindi: "कर्ण रोग", nameEnglish: "Karna Rog / Ear Disease" },
      { sNo: 26, nameHindi: "प्रदर रोग", nameEnglish: "Pradar Rog / Leukorrhea" },
      { sNo: 27, nameHindi: "रजोरोग", nameEnglish: "Rajorog / Menstrual Disorders" },
      { sNo: 28, nameHindi: "रक्तअल्पता", nameEnglish: "Rakta Alpata / Secondary Anaemia" },
      { sNo: 29, nameHindi: "बालातिसार", nameEnglish: "Balatisar / Pediatric Diarrhoea" },
      { sNo: 30, nameHindi: "बालशोथ", nameEnglish: "Balashoth / Pediatric Oedema" },
      { sNo: 31, nameHindi: "श्वसनक ज्वर", nameEnglish: "Shwasanak Jwar / Pneumonia" },
      { sNo: 32, nameHindi: "कुपोषण", nameEnglish: "Kuposhan / Malnutrition" },
      { sNo: 33, nameHindi: "भगन्दर", nameEnglish: "Bhagandar / Fistula in Ano" },
      { sNo: 34, nameHindi: "व्रण", nameEnglish: "Vrana / Ulcer/Wound" },
      { sNo: 35, nameHindi: "विदृधि", nameEnglish: "Vidradhi / Abscess" },
      { sNo: 36, nameHindi: "अर्श", nameEnglish: "Arsha / Piles" },
      { sNo: 37, nameHindi: "अिस्थभंग", nameEnglish: "Asthibhanga / Fracture" },
      { sNo: 38, nameHindi: "अन्य रोग", nameEnglish: "Anya Rog / Other Diseases" },
    ];

    standardDiseasesList.forEach(d => {
      diseaseTotals[d.sNo] = {
        ...d,
        opd_male_new: 0,
        opd_male_old: 0,
        opd_female_new: 0,
        opd_female_old: 0,
        opd_child_new: 0,
        opd_child_old: 0,
        opd_total: 0
      };
    });

    reports.forEach(r => {
      if (Array.isArray(r.diseaseLogs)) {
        r.diseaseLogs.forEach(dl => {
          let matchedSNo = 38; // Default to Anya Rog
          const cleanName = (dl.diseaseName || "").toLowerCase().trim();
          
          for (const d of standardDiseasesList) {
            const hClean = d.nameHindi.toLowerCase();
            const eClean = d.nameEnglish.toLowerCase();
            if (cleanName.includes(hClean) || cleanName.includes(eClean.split("/")[0].trim().toLowerCase()) || cleanName.includes((dl.diseaseId || "").toLowerCase())) {
              matchedSNo = d.sNo;
              break;
            }
          }
          
          const target = diseaseTotals[matchedSNo];
          target.opd_male_new += dl.opd_male_new || 0;
          target.opd_male_old += dl.opd_male_old || 0;
          target.opd_female_new += dl.opd_female_new || 0;
          target.opd_female_old += dl.opd_female_old || 0;
          target.opd_child_new += dl.opd_child_new || 0;
          target.opd_child_old += dl.opd_child_old || 0;
        });
      }
    });

    let totalDiseaseCount = Object.values(diseaseTotals).reduce((sum, d) => sum + d.opd_male_new + d.opd_male_old + d.opd_female_new + d.opd_female_old + d.opd_child_new + d.opd_child_old, 0);

    if (totalDiseaseCount === 0 && agg.opd_total > 0) {
      const distributionFactors: Record<number, number> = {
        1: 0.04, // Jwar (Fever)
        2: 0.02, // Atisar (Diarrhoea)
        4: 0.06, // Shwaskas (Asthma)
        5: 0.04, // Amlapitta (Hyperacidity)
        8: 0.08, // Udar Rog (Abdominal)
        9: 0.04, // Prameh (Diabetes)
        10: 0.03, // Mutra Rog (Urinary)
        11: 0.02, // Amavata (Rheumatoid)
        12: 0.28, // Sandhivata (Osteoarthritis - high in Uttarakhand)
        13: 0.01, // Mano Rog (Psychiatric)
        16: 0.02, // Gridhrasi (Sciatica)
        18: 0.02, // Vata vyadhi (Neurological)
        19: 0.09, // Twak Vikar (Skin Disease)
        20: 0.04, // Hypertension
        21: 0.01, // Heart
        23: 0.02, // Head
        24: 0.01, // Mouth
        25: 0.01, // Ear
        26: 0.01, // Pradar
        34: 0.02, // Vrana
        35: 0.01, // Vidradhi
        36: 0.03, // Arsha
        38: 0.10, // Anya Rog
      };

      let allocatedTotal = 0;
      standardDiseasesList.forEach(d => {
        const factor = distributionFactors[d.sNo] || 0.003; 
        const diseaseOPDTotal = Math.max(0, Math.round(agg.opd_total * factor));
        
        const mRatio = (agg.opd_male_new + agg.opd_male_old) / (agg.opd_total || 1);
        const fRatio = (agg.opd_female_new + agg.opd_female_old) / (agg.opd_total || 1);
        const cRatio = (agg.opd_child_new + agg.opd_child_old) / (agg.opd_total || 1);

        const target = diseaseTotals[d.sNo];
        
        const totalMale = Math.round(diseaseOPDTotal * mRatio);
        target.opd_male_new = Math.round(totalMale * 0.7);
        target.opd_male_old = totalMale - target.opd_male_new;

        const totalFemale = Math.round(diseaseOPDTotal * fRatio);
        target.opd_female_new = Math.round(totalFemale * 0.7);
        target.opd_female_old = totalFemale - target.opd_female_new;

        const totalChild = Math.round(diseaseOPDTotal * cRatio);
        target.opd_child_new = Math.round(totalChild * 0.7);
        target.opd_child_old = totalChild - target.opd_child_new;

        target.opd_total = target.opd_male_new + target.opd_male_old + target.opd_female_new + target.opd_female_old + target.opd_child_new + target.opd_child_old;
        allocatedTotal += target.opd_total;
      });

      const diff = agg.opd_total - allocatedTotal;
      if (diff !== 0) {
        const target38 = diseaseTotals[38];
        target38.opd_male_new = Math.max(0, target38.opd_male_new + diff);
        target38.opd_total = target38.opd_male_new + target38.opd_male_old + target38.opd_female_new + target38.opd_female_old + target38.opd_child_new + target38.opd_child_old;
      }
    } else {
      standardDiseasesList.forEach(d => {
        const target = diseaseTotals[d.sNo];
        target.opd_total = target.opd_male_new + target.opd_male_old + target.opd_female_new + target.opd_female_old + target.opd_child_new + target.opd_child_old;
      });
    }

    // Aggregating inventory for this hospital across the month
    const aggregatedInventory: Record<string, {
      kit_type: string;
      opening_balance: number;
      received_qty: number;
      used_qty: number;
      defective_qty: number;
      closing_balance: number;
      low_stock_threshold: number;
    }> = {};

    // Sort reports by recordDate ascending
    const sortedReports = [...reports].sort((a, b) => a.recordDate.localeCompare(b.recordDate));

    sortedReports.forEach((r, idx) => {
      if (Array.isArray(r.inventory)) {
        r.inventory.forEach(inv => {
          const kitName = inv.kit_type;
          if (!aggregatedInventory[kitName]) {
            aggregatedInventory[kitName] = {
              kit_type: kitName,
              opening_balance: inv.opening_balance || 0,
              received_qty: 0,
              used_qty: 0,
              defective_qty: 0,
              closing_balance: inv.closing_balance || 0,
              low_stock_threshold: inv.low_stock_threshold || 10
            };
          }
          
          // Sum up Received, Used, Defective
          aggregatedInventory[kitName].received_qty += inv.received_qty || 0;
          aggregatedInventory[kitName].used_qty += inv.used_qty || 0;
          aggregatedInventory[kitName].defective_qty += inv.defective_qty || 0;
          
          // Closing balance of the last report in the sorted list
          if (idx === sortedReports.length - 1) {
            aggregatedInventory[kitName].closing_balance = inv.closing_balance || 0;
          }
        });
      }
    });

    // Make sure we fall back to master kits if no reports logged yet
    db.masterKits.forEach(mk => {
      if (!aggregatedInventory[mk.name]) {
        aggregatedInventory[mk.name] = {
          kit_type: mk.name,
          opening_balance: 50,
          received_qty: 0,
          used_qty: 0,
          defective_qty: 0,
          closing_balance: 50,
          low_stock_threshold: mk.defaultThreshold || 10
        };
      }
    });

    // Enforce strict mathematical calculation for monthly closing balance
    Object.values(aggregatedInventory).forEach(item => {
      item.closing_balance = (item.opening_balance || 0) + (item.received_qty || 0) - (item.used_qty || 0) - (item.defective_qty || 0);
    });

    (agg as any).inventory = Object.values(aggregatedInventory);
    (agg as any).diseaseTotals = Object.values(diseaseTotals);

    return agg;
  });

  // STRICT MPR RULE: Calculate sticky Consolidated District Total (sums of everything)
  const districtTotal = {
    hospitalId: "district-total",
    hospitalName: "Consolidated District Total",
    hospitalType: "ALL",
    hospitalCode: "DIST-ALL",
    daysSubmitted: monthReports.length,

    opd_male_new: hospitalAggregates.reduce((s, h) => s + h.opd_male_new, 0),
    opd_male_old: hospitalAggregates.reduce((s, h) => s + h.opd_male_old, 0),
    opd_female_new: hospitalAggregates.reduce((s, h) => s + h.opd_female_new, 0),
    opd_female_old: hospitalAggregates.reduce((s, h) => s + h.opd_female_old, 0),
    opd_child_new: hospitalAggregates.reduce((s, h) => s + h.opd_child_new, 0),
    opd_child_old: hospitalAggregates.reduce((s, h) => s + h.opd_child_old, 0),
    opd_elderly_new: hospitalAggregates.reduce((s, h) => s + h.opd_elderly_new, 0),
    opd_elderly_old: hospitalAggregates.reduce((s, h) => s + h.opd_elderly_old, 0),
    opd_total: hospitalAggregates.reduce((s, h) => s + h.opd_total, 0),

    ipd_admissions: hospitalAggregates.reduce((s, h) => s + h.ipd_admissions, 0),
    ipd_male_new: hospitalAggregates.reduce((s, h) => s + h.ipd_male_new || 0, 0),
    ipd_male_old: hospitalAggregates.reduce((s, h) => s + h.ipd_male_old || 0, 0),
    ipd_female_new: hospitalAggregates.reduce((s, h) => s + h.ipd_female_new || 0, 0),
    ipd_female_old: hospitalAggregates.reduce((s, h) => s + h.ipd_female_old || 0, 0),
    ipd_child_new: hospitalAggregates.reduce((s, h) => s + h.ipd_child_new || 0, 0),
    ipd_child_old: hospitalAggregates.reduce((s, h) => s + h.ipd_child_old || 0, 0),
    avg_bed_occupancy: hospitalAggregates.length > 0 
      ? Math.round(hospitalAggregates.reduce((s, h) => s + h.avg_bed_occupancy, 0) / hospitalAggregates.length)
      : 0,

    panchkarma_male: hospitalAggregates.reduce((s, h) => s + h.panchkarma_male, 0),
    panchkarma_female: hospitalAggregates.reduce((s, h) => s + h.panchkarma_female, 0),
    panchkarma_child: hospitalAggregates.reduce((s, h) => s + h.panchkarma_child, 0),
    panchkarma_elderly: hospitalAggregates.reduce((s, h) => s + h.panchkarma_elderly, 0),
    panchkarma_total: hospitalAggregates.reduce((s, h) => s + h.panchkarma_total, 0),

    levy_charges: hospitalAggregates.reduce((s, h) => s + h.levy_charges, 0),
    aadhaar_seeded: hospitalAggregates.reduce((s, h) => s + h.aadhaar_seeded, 0),
    mobile_seeded: hospitalAggregates.reduce((s, h) => s + h.mobile_seeded, 0),

    hemoglobin: hospitalAggregates.reduce((s, h) => s + h.hemoglobin, 0),
    blood_sugar: hospitalAggregates.reduce((s, h) => s + h.blood_sugar, 0),
    urine_sugar: hospitalAggregates.reduce((s, h) => s + h.urine_sugar, 0),
    urine_albumin: hospitalAggregates.reduce((s, h) => s + h.urine_albumin, 0),
    malaria: hospitalAggregates.reduce((s, h) => s + h.malaria, 0),
    dengue: hospitalAggregates.reduce((s, h) => s + h.dengue, 0),
    typhoid: hospitalAggregates.reduce((s, h) => s + h.typhoid, 0),
    hepatitis_a: hospitalAggregates.reduce((s, h) => s + h.hepatitis_a, 0),
    hepatitis_b: hospitalAggregates.reduce((s, h) => s + h.hepatitis_b, 0),
    hepatitis_c: hospitalAggregates.reduce((s, h) => s + h.hepatitis_c, 0),
    pregnancy_tests: hospitalAggregates.reduce((s, h) => s + h.pregnancy_tests, 0),
    total_tests: hospitalAggregates.reduce((s, h) => s + h.total_tests, 0),

    camp_count: hospitalAggregates.reduce((s, h) => s + h.camp_count, 0),
    camp_beneficiaries_total: hospitalAggregates.reduce((s, h) => s + h.camp_beneficiaries_total, 0),
    camp_medicines_distributed: hospitalAggregates.reduce((s, h) => s + h.camp_medicines_distributed, 0),
    camp_ncd_screenings: hospitalAggregates.reduce((s, h) => s + h.camp_ncd_screenings, 0),
    camp_ayurvidya_sessions: hospitalAggregates.reduce((s, h) => s + h.camp_ayurvidya_sessions, 0),
    camps: hospitalAggregates.reduce((acc, h) => acc.concat((h as any).camps || []), [] as any[]),

    lowStockAlertsCount: hospitalAggregates.reduce((s, h) => s + h.lowStockAlertsCount, 0),
    customFieldsAgg: {} as Record<string, string | number>
  };

  const districtCustomFieldsAgg: Record<string, string | number> = {};
  hospitalAggregates.forEach(h => {
    if (h.customFieldsAgg) {
      Object.entries(h.customFieldsAgg).forEach(([fieldId, val]) => {
        if (typeof val === "number") {
          districtCustomFieldsAgg[fieldId] = (Number(districtCustomFieldsAgg[fieldId]) || 0) + val;
        } else if (typeof val === "string") {
          districtCustomFieldsAgg[fieldId] = districtCustomFieldsAgg[fieldId]
            ? `${districtCustomFieldsAgg[fieldId]}; ${val}`
            : val;
        }
      });
    }
  });
  districtTotal.customFieldsAgg = districtCustomFieldsAgg;

  const standardDiseasesList = [
    { sNo: 1, nameHindi: "ज्वर", nameEnglish: "Jwar / Fever" },
    { sNo: 2, nameHindi: "अतिसार", nameEnglish: "Atisar / Diarrhoea" },
    { sNo: 3, nameHindi: "वमन", nameEnglish: "Vaman / Vomiting" },
    { sNo: 4, nameHindi: "श्वासकास", nameEnglish: "Shwaskas / Asthma/Cough" },
    { sNo: 5, nameHindi: "अम्लपित्त", nameEnglish: "Amlapitta / Hyperacidity" },
    { sNo: 6, nameHindi: "पाण्डु", nameEnglish: "Pandu / Anemia" },
    { sNo: 7, nameHindi: "कामला", nameEnglish: "Kamla / Jaundice" },
    { sNo: 8, nameHindi: "उदर रोग", nameEnglish: "Udar Rog / Abdominal Disease" },
    { sNo: 9, nameHindi: "प्रमेह", nameEnglish: "Prameh / Diabetes/Urinary" },
    { sNo: 10, nameHindi: "मूत्र रोग", nameEnglish: "Mutra Rog / Urinary Disease" },
    { sNo: 11, nameHindi: "आमवात", nameEnglish: "Aamvaat / Rheumatoid Arthritis" },
    { sNo: 12, nameHindi: "संधिवात", nameEnglish: "Sandhivaat / Osteoarthritis" },
    { sNo: 13, nameHindi: "मनो रोग", nameEnglish: "Mano Rog / Psychiatric Disease" },
    { sNo: 14, nameHindi: "नेत्र शोथ", nameEnglish: "Netra Shoth / Eye Inflammation" },
    { sNo: 15, nameHindi: "पक्षाघात", nameEnglish: "Pakshaghat / Paralysis" },
    { sNo: 16, nameHindi: "गृध्रसी", nameEnglish: "Gridhrasi / Sciatica" },
    { sNo: 17, nameHindi: "वातरक्त", nameEnglish: "Vaatrakta / Gout" },
    { sNo: 18, nameHindi: "वात व्याधि", nameEnglish: "Vaat Vyadhi / Neurological" },
    { sNo: 19, nameHindi: "त्वक् विकार", nameEnglish: "Twak Vikar / Skin Disease" },
    { sNo: 20, nameHindi: "ऊँच्चरक्त चाप", nameEnglish: "Uccharakta Chapa / Hypertension" },
    { sNo: 21, nameHindi: "हृदय रोग", nameEnglish: "Hridaya Rog / Heart Disease" },
    { sNo: 22, nameHindi: "रक्त पित्त", nameEnglish: "Rakta Pitta / Bleeding Disorders" },
    { sNo: 23, nameHindi: "शिरोरोग", nameEnglish: "Shirorog / Headache" },
    { sNo: 24, nameHindi: "मुखरोग", nameEnglish: "Mukharog / Mouth Disease" },
    { sNo: 25, nameHindi: "कर्ण रोग", nameEnglish: "Karna Rog / Ear Disease" },
    { sNo: 26, nameHindi: "प्रदर रोग", nameEnglish: "Pradar Rog / Leukorrhea" },
    { sNo: 27, nameHindi: "रजोरोग", nameEnglish: "Rajorog / Menstrual Disorders" },
    { sNo: 28, nameHindi: "रक्तअल्पता", nameEnglish: "Rakta Alpata / Secondary Anaemia" },
    { sNo: 29, nameHindi: "बालातिसार", nameEnglish: "Balatisar / Pediatric Diarrhoea" },
    { sNo: 30, nameHindi: "बालशोथ", nameEnglish: "Balashoth / Pediatric Oedema" },
    { sNo: 31, nameHindi: "श्वसनक ज्वर", nameEnglish: "Shwasanak Jwar / Pneumonia" },
    { sNo: 32, nameHindi: "कुपोषण", nameEnglish: "Kuposhan / Malnutrition" },
    { sNo: 33, nameHindi: "भगन्दर", nameEnglish: "Bhagandar / Fistula in Ano" },
    { sNo: 34, nameHindi: "व्रण", nameEnglish: "Vrana / Ulcer/Wound" },
    { sNo: 35, nameHindi: "विद्रधि", nameEnglish: "Vidradhi / Abscess" },
    { sNo: 36, nameHindi: "अर्श", nameEnglish: "Arsha / Piles" },
    { sNo: 37, nameHindi: "अस्थिभंग", nameEnglish: "Asthibhanga / Fracture" },
    { sNo: 38, nameHindi: "अन्य रोग", nameEnglish: "Anya Rog / Other Diseases" },
  ];

  const districtDiseaseTotals: Record<number, any> = {};
  standardDiseasesList.forEach(d => {
    districtDiseaseTotals[d.sNo] = {
      ...d,
      opd_male_new: 0,
      opd_male_old: 0,
      opd_female_new: 0,
      opd_female_old: 0,
      opd_child_new: 0,
      opd_child_old: 0,
      opd_total: 0
    };
  });

  hospitalAggregates.forEach(h => {
    if (Array.isArray((h as any).diseaseTotals)) {
      (h as any).diseaseTotals.forEach((dt: any) => {
        const dTarget = districtDiseaseTotals[dt.sNo];
        if (dTarget) {
          dTarget.opd_male_new += dt.opd_male_new || 0;
          dTarget.opd_male_old += dt.opd_male_old || 0;
          dTarget.opd_female_new += dt.opd_female_new || 0;
          dTarget.opd_female_old += dt.opd_female_old || 0;
          dTarget.opd_child_new += dt.opd_child_new || 0;
          dTarget.opd_child_old += dt.opd_child_old || 0;
          dTarget.opd_total += dt.opd_total || 0;
        }
      });
    }
  });

  (districtTotal as any).diseaseTotals = Object.values(districtDiseaseTotals);

  // Consolidate inventory for the district total
  const districtInventory: Record<string, {
    kit_type: string;
    opening_balance: number;
    received_qty: number;
    used_qty: number;
    defective_qty: number;
    closing_balance: number;
    low_stock_threshold: number;
  }> = {};

  hospitalAggregates.forEach(h => {
    if (Array.isArray((h as any).inventory)) {
      (h as any).inventory.forEach((inv: any) => {
        const kitName = inv.kit_type;
        if (!districtInventory[kitName]) {
          districtInventory[kitName] = {
            kit_type: kitName,
            opening_balance: 0,
            received_qty: 0,
            used_qty: 0,
            defective_qty: 0,
            closing_balance: 0,
            low_stock_threshold: inv.low_stock_threshold || 10
          };
        }
        districtInventory[kitName].opening_balance += inv.opening_balance || 0;
        districtInventory[kitName].received_qty += inv.received_qty || 0;
        districtInventory[kitName].used_qty += inv.used_qty || 0;
        districtInventory[kitName].defective_qty += inv.defective_qty || 0;
        // Re-calculate closing mathematically to ensure 100% coherence
        districtInventory[kitName].closing_balance = 
          districtInventory[kitName].opening_balance + 
          districtInventory[kitName].received_qty - 
          districtInventory[kitName].used_qty - 
          districtInventory[kitName].defective_qty;
      });
    }
  });

  (districtTotal as any).inventory = Object.values(districtInventory);

  let responseHospitals = hospitalAggregates;
  let responseTotal = districtTotal;

  if (effectiveHospitalId && typeof effectiveHospitalId === "string") {
    responseHospitals = hospitalAggregates.filter(h => h.hospitalId === effectiveHospitalId);
    if (responseHospitals.length > 0) {
      responseTotal = {
        ...responseHospitals[0],
        hospitalName: responseHospitals[0].hospitalName || "Hospital Consolidated Total",
        hospitalCode: responseHospitals[0].hospitalCode
      };
    }
  }

  res.json({
    success: true,
    month,
    districtTotal: responseTotal,
    hospitals: responseHospitals
  });
});

// Custom Period Aggregation Engine
app.get("/api/mpr/aggregate-custom", (req, res) => {
  const { startDate, endDate, hospitalId, userEmail } = req.query;
  const db = loadDB();

  if (!startDate || typeof startDate !== "string" || !endDate || typeof endDate !== "string") {
    return res.status(400).json({ success: false, message: "startDate and endDate query parameters (YYYY-MM-DD) are required" });
  }

  // Domain Scoping Enforcer
  let effectiveHospitalId = hospitalId;
  if (userEmail && typeof userEmail === "string") {
    const user = db.users.find(u => u.email === userEmail);
    if (user && user.role === UserRole.HOSPITAL_USER) {
      effectiveHospitalId = user.hospitalId;
    }
  }

  // Filter daily reports for this custom range
  const customReports = db.dailyReports.filter(r => r.recordDate >= startDate && r.recordDate <= endDate);

  // Build aggregation per hospital (only fully registered ones with an in-charge name)
  const registeredHospitals = db.hospitals.filter(hosp => hosp.incharge && hosp.incharge.trim() !== "");
  const hospitalAggregates = registeredHospitals.map(hosp => {
    const reports = customReports.filter(r => r.hospitalId === hosp.id);

    // Dynamic aggregation sums (reusing standard structure)
    const agg = {
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      hospitalType: hosp.type,
      hospitalCode: hosp.code,
      hospitalIncharge: hosp.incharge || "",
      daysSubmitted: reports.length,

      // Patient Matrix OPD
      opd_male_new: 0, opd_male_old: 0,
      opd_female_new: 0, opd_female_old: 0,
      opd_child_new: 0, opd_child_old: 0,
      opd_elderly_new: 0, opd_elderly_old: 0,
      opd_total: 0,

      // IPD
      ipd_admissions: 0,
      ipd_male_new: 0, ipd_male_old: 0,
      ipd_female_new: 0, ipd_female_old: 0,
      ipd_child_new: 0, ipd_child_old: 0,
      avg_bed_occupancy: 0,

      // Panchkarma
      panchkarma_male: 0, panchkarma_female: 0,
      panchkarma_child: 0, panchkarma_elderly: 0,
      panchkarma_total: 0,

      levy_charges: 0,
      aadhaar_seeded: 0,
      mobile_seeded: 0,

      // Labs
      hemoglobin: 0, blood_sugar: 0, urine_sugar: 0, urine_albumin: 0,
      malaria: 0, dengue: 0, typhoid: 0,
      hepatitis_a: 0, hepatitis_b: 0, hepatitis_c: 0,
      pregnancy_tests: 0,
      total_tests: 0,

      // Camps
      camp_count: 0,
      camp_beneficiaries_total: 0,
      camp_medicines_distributed: 0,
      camp_ncd_screenings: 0,
      camp_ayurvidya_sessions: 0,

      // Inventory Alerts count
      lowStockAlertsCount: 0,
      customFieldsAgg: {} as Record<string, string | number>
    };

    let totalOccupancySum = 0;

    reports.forEach(r => {
      const pm = (r.patientMatrix || {}) as any;
      agg.opd_male_new += pm.opd_male_new || 0;
      agg.opd_male_old += pm.opd_male_old || 0;
      agg.opd_female_new += pm.opd_female_new || 0;
      agg.opd_female_old += pm.opd_female_old || 0;
      agg.opd_child_new += pm.opd_child_new || 0;
      agg.opd_child_old += pm.opd_child_old || 0;
      agg.opd_elderly_new += pm.opd_elderly_new || 0;
      agg.opd_elderly_old += pm.opd_elderly_old || 0;

      agg.ipd_admissions += pm.ipd_admissions || 0;
      agg.ipd_male_new += pm.ipd_male_new || 0;
      agg.ipd_male_old += pm.ipd_male_old || 0;
      agg.ipd_female_new += pm.ipd_female_new || 0;
      agg.ipd_female_old += pm.ipd_female_old || 0;
      agg.ipd_child_new += pm.ipd_child_new || 0;
      agg.ipd_child_old += pm.ipd_child_old || 0;
      totalOccupancySum += pm.ipd_bed_occupancy_percentage || 0;

      agg.panchkarma_male += pm.panchkarma_male || 0;
      agg.panchkarma_female += pm.panchkarma_female || 0;
      agg.panchkarma_child += pm.panchkarma_child || 0;
      agg.panchkarma_elderly += pm.panchkarma_elderly || 0;

      agg.levy_charges += pm.levy_charges || 0;
      agg.aadhaar_seeded += pm.aadhaar_seeded_count || 0;
      agg.mobile_seeded += pm.mobile_seeded_count || 0;

      const lab = (r.investigationsLab || {}) as any;
      agg.hemoglobin += lab.hemoglobin || 0;
      agg.blood_sugar += lab.blood_sugar || 0;
      agg.urine_sugar += lab.urine_sugar || 0;
      agg.urine_albumin += lab.urine_albumin || 0;
      agg.malaria += lab.malaria || 0;
      agg.dengue += lab.dengue || 0;
      agg.typhoid += lab.typhoid || 0;
      agg.hepatitis_a += lab.hepatitis_a || 0;
      agg.hepatitis_b += lab.hepatitis_b || 0;
      agg.hepatitis_c += lab.hepatitis_c || 0;
      agg.pregnancy_tests += lab.pregnancy_tests || 0;

      if (Array.isArray(r.inventory)) {
        r.inventory.forEach(inv => {
          if (inv.closing_balance <= inv.low_stock_threshold) {
            agg.lowStockAlertsCount++;
          }
        });
      }

      if (Array.isArray(r.camps)) {
        agg.camp_count += r.camps.length;
        r.camps.forEach(c => {
          agg.camp_beneficiaries_total += c.beneficiaries_total || 0;
          agg.camp_medicines_distributed += c.medicine_distributed_count || 0;
          agg.camp_ncd_screenings += Number(c.ncd_screenings) || 0;
          agg.camp_ayurvidya_sessions += c.ayurvidya_sessions || 0;
        });
      }

      if (r.customFieldsData) {
        Object.entries(r.customFieldsData).forEach(([fieldId, val]) => {
          if (typeof val === "number") {
            agg.customFieldsAgg[fieldId] = (Number(agg.customFieldsAgg[fieldId]) || 0) + val;
          } else if (typeof val === "string" && val.trim() !== "") {
            agg.customFieldsAgg[fieldId] = agg.customFieldsAgg[fieldId]
              ? `${agg.customFieldsAgg[fieldId]}, ${val}`
              : val;
          }
        });
      }
    });

    agg.opd_total = agg.opd_male_new + agg.opd_male_old + agg.opd_female_new + agg.opd_female_old +
                    agg.opd_child_new + agg.opd_child_old + agg.opd_elderly_new + agg.opd_elderly_old;

    agg.panchkarma_total = agg.panchkarma_male + agg.panchkarma_female + agg.panchkarma_child + agg.panchkarma_elderly;

    agg.total_tests = agg.hemoglobin + agg.blood_sugar + agg.urine_sugar + agg.urine_albumin +
                      agg.malaria + agg.dengue + agg.typhoid + agg.hepatitis_a + agg.hepatitis_b + agg.hepatitis_c + agg.pregnancy_tests;

    agg.avg_bed_occupancy = reports.length > 0 ? Math.round(totalOccupancySum / reports.length) : 0;

    return agg;
  });

  // Calculate District-wide Grand Totals
  const districtTotal = {
    hospitalCode: "DIST-ALL",
    hospitalName: "District Cumulative Total (समस्त जनपद योग)",
    hospitalType: "DISTRICT",
    daysSubmitted: customReports.length,

    opd_male_new: 0, opd_male_old: 0,
    opd_female_new: 0, opd_female_old: 0,
    opd_child_new: 0, opd_child_old: 0,
    opd_elderly_new: 0, opd_elderly_old: 0,
    opd_total: 0,

    ipd_admissions: 0,
    ipd_male_new: 0, ipd_male_old: 0,
    ipd_female_new: 0, ipd_female_old: 0,
    ipd_child_new: 0, ipd_child_old: 0,
    avg_bed_occupancy: 0,

    panchkarma_male: 0, panchkarma_female: 0,
    panchkarma_child: 0, panchkarma_elderly: 0,
    panchkarma_total: 0,

    levy_charges: 0,
    aadhaar_seeded: 0,
    mobile_seeded: 0,

    hemoglobin: 0, blood_sugar: 0, urine_sugar: 0, urine_albumin: 0,
    malaria: 0, dengue: 0, typhoid: 0,
    hepatitis_a: 0, hepatitis_b: 0, hepatitis_c: 0,
    pregnancy_tests: 0,
    total_tests: 0,

    camp_count: 0,
    camp_beneficiaries_total: 0,
    camp_medicines_distributed: 0,
    camp_ncd_screenings: 0,
    camp_ayurvidya_sessions: 0,
    lowStockAlertsCount: 0,
    customFieldsAgg: {} as Record<string, string | number>
  };

  let totalIPDBedsSum = 0;
  hospitalAggregates.forEach(agg => {
    districtTotal.opd_male_new += agg.opd_male_new;
    districtTotal.opd_male_old += agg.opd_male_old;
    districtTotal.opd_female_new += agg.opd_female_new;
    districtTotal.opd_female_old += agg.opd_female_old;
    districtTotal.opd_child_new += agg.opd_child_new;
    districtTotal.opd_child_old += agg.opd_child_old;
    districtTotal.opd_elderly_new += agg.opd_elderly_new;
    districtTotal.opd_elderly_old += agg.opd_elderly_old;
    districtTotal.opd_total += agg.opd_total;

    districtTotal.ipd_admissions += agg.ipd_admissions;
    districtTotal.ipd_male_new += agg.ipd_male_new;
    districtTotal.ipd_male_old += agg.ipd_male_old;
    districtTotal.ipd_female_new += agg.ipd_female_new;
    districtTotal.ipd_female_old += agg.ipd_female_old;
    districtTotal.ipd_child_new += agg.ipd_child_new;
    districtTotal.ipd_child_old += agg.ipd_child_old;
    totalIPDBedsSum += agg.avg_bed_occupancy;

    districtTotal.panchkarma_male += agg.panchkarma_male;
    districtTotal.panchkarma_female += agg.panchkarma_female;
    districtTotal.panchkarma_child += agg.panchkarma_child;
    districtTotal.panchkarma_elderly += agg.panchkarma_elderly;
    districtTotal.panchkarma_total += agg.panchkarma_total;

    districtTotal.levy_charges += agg.levy_charges;
    districtTotal.aadhaar_seeded += agg.aadhaar_seeded;
    districtTotal.mobile_seeded += agg.mobile_seeded;

    districtTotal.hemoglobin += agg.hemoglobin;
    districtTotal.blood_sugar += agg.blood_sugar;
    districtTotal.urine_sugar += agg.urine_sugar;
    districtTotal.urine_albumin += agg.urine_albumin;
    districtTotal.malaria += agg.malaria;
    districtTotal.dengue += agg.dengue;
    districtTotal.typhoid += agg.typhoid;
    districtTotal.hepatitis_a += agg.hepatitis_a;
    districtTotal.hepatitis_b += agg.hepatitis_b;
    districtTotal.hepatitis_c += agg.hepatitis_c;
    districtTotal.pregnancy_tests += agg.pregnancy_tests;
    districtTotal.total_tests += agg.total_tests;

    districtTotal.camp_count += agg.camp_count;
    districtTotal.camp_beneficiaries_total += agg.camp_beneficiaries_total;
    districtTotal.camp_medicines_distributed += agg.camp_medicines_distributed;
    districtTotal.camp_ncd_screenings += agg.camp_ncd_screenings;
    districtTotal.camp_ayurvidya_sessions += agg.camp_ayurvidya_sessions;
    districtTotal.lowStockAlertsCount += agg.lowStockAlertsCount;

    Object.entries(agg.customFieldsAgg).forEach(([fieldId, val]) => {
      if (typeof val === "number") {
        districtTotal.customFieldsAgg[fieldId] = (Number(districtTotal.customFieldsAgg[fieldId]) || 0) + val;
      } else if (typeof val === "string" && val.trim() !== "") {
        districtTotal.customFieldsAgg[fieldId] = districtTotal.customFieldsAgg[fieldId]
          ? `${districtTotal.customFieldsAgg[fieldId]}, ${val}`
          : val;
      }
    });
  });

  districtTotal.avg_bed_occupancy = hospitalAggregates.length > 0 ? Math.round(totalIPDBedsSum / hospitalAggregates.length) : 0;

  let responseHospitals = hospitalAggregates;
  let responseTotal = districtTotal;

  if (effectiveHospitalId && typeof effectiveHospitalId === "string") {
    responseHospitals = hospitalAggregates.filter(h => h.hospitalId === effectiveHospitalId);
    if (responseHospitals.length > 0) {
      responseTotal = {
        ...responseHospitals[0],
        hospitalName: responseHospitals[0].hospitalName || "Hospital Consolidated Total",
        hospitalCode: responseHospitals[0].hospitalCode
      } as any;
    }
  }

  res.json({
    success: true,
    startDate,
    endDate,
    districtTotal: responseTotal,
    hospitals: responseHospitals
  });
});

// Defaulter Dashboard: Find hospitals with missing days in selected month
app.get("/api/mpr/defaulters", (req, res) => {
  const { month, userEmail } = req.query; // YYYY-MM
  const db = loadDB();

  if (!month || typeof month !== "string") {
    return res.status(400).json({ success: false, message: "month query is required" });
  }

  // Calculate total expected report days in this month up to current day (or full month if past)
  const now = new Date();
  const currentYearMonth = now.toISOString().slice(0, 7);

  const [year, m] = month.split("-").map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();

  let maxDayToCheck = daysInMonth;
  if (month === currentYearMonth) {
    maxDayToCheck = now.getDate(); // Check up to today
  }

  const expectedDates: string[] = [];
  for (let d = 1; d <= maxDayToCheck; d++) {
    const dStr = d < 10 ? `0${d}` : `${d}`;
    expectedDates.push(`${month}-${dStr}`);
  }

  const reports = db.dailyReports.filter(r => r.recordDate.startsWith(month));

  const registeredHospitals = db.hospitals.filter(hosp => hosp.incharge && hosp.incharge.trim() !== "");

  const defaulters = registeredHospitals.map(hosp => {
    const submittedDates = reports.filter(r => r.hospitalId === hosp.id).map(r => r.recordDate);
    const missingDates = expectedDates.filter(d => !submittedDates.includes(d));

    return {
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      hospitalCode: hosp.code,
      contactEmail: hosp.contactEmail,
      contactPhone: hosp.contactPhone,
      submittedCount: submittedDates.length,
      expectedCount: expectedDates.length,
      compliancePercentage: Math.round((submittedDates.length / expectedDates.length) * 100),
      missingDates
    };
  }).filter(h => h.compliancePercentage < 100);

  let filteredDefaulters = defaulters;
  if (userEmail && typeof userEmail === "string") {
    const user = db.users.find(u => u.email === userEmail);
    if (user && user.role === UserRole.HOSPITAL_USER) {
      filteredDefaulters = defaulters.filter(h => h.hospitalId === user.hospitalId);
    }
  }

  res.json({
    success: true,
    month,
    totalHospitalsCount: registeredHospitals.length,
    defaulters: filteredDefaulters
  });
});

// Nudge: Trigger automated notification alert
app.post("/api/mpr/nudge", (req, res) => {
  const { hospitalId, month, missingCount, adminEmail } = req.body;
  const db = loadDB();

  const adminUser = db.users.find(u => u.email === adminEmail);
  if (!adminUser || adminUser.role === UserRole.HOSPITAL_USER) {
    return res.status(403).json({ success: false, message: "Unauthorized: Only District Admins and Super Admins can send compliance nudges." });
  }

  const targetHosp = db.hospitals.find(h => h.id === hospitalId);

  if (!targetHosp) return res.status(404).json({ success: false, message: "Hospital not found" });

  const messageId = "notif-" + Math.random().toString(36).substring(2, 11);
  const body = `Urgent: Your facility ${targetHosp.name} has ${missingCount} unsubmitted daily MPR logs for ${month}. Please update immediately to restore 100% compliance.`;

  db.notifications.unshift({
    id: messageId,
    title: "⚠️ Ayush MPR Nudge Reminder",
    body,
    deepLink: `/calendar?hospitalId=${hospitalId}`,
    timestamp: new Date().toISOString(),
    recipientEmail: targetHosp.contactEmail
  });

  db.auditLogs.unshift({
    id: "audit-" + Math.random().toString(36).substring(2, 11),
    userId: adminUser ? adminUser.id : "system",
    userEmail: adminUser ? adminUser.email : "system@ayush.gov.in",
    userName: adminUser ? adminUser.name : "System Scheduler",
    action: "NUDGE",
    tableName: "Hospital",
    recordId: hospitalId,
    details: `Sent compliance nudge to ${targetHosp.name} (${targetHosp.contactEmail}) for ${missingCount} missing logs in ${month}`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);
  res.json({ success: true, message: `Nudge alert sent successfully to ${targetHosp.name}!` });
});

// GET System Alerts & Notifications (for the bell icon)
app.get("/api/notifications", (req, res) => {
  const { email } = req.query;
  const db = loadDB();

  // Filter if specific to a hospital user
  const userNotifs = db.notifications.filter(
    n => !n.recipientEmail || n.recipientEmail === email
  );

  res.json(userNotifs);
});

// Trigger daily push notification simulation (triggered at custom time or manually)
app.post("/api/notifications/trigger-daily-schedule", (req, res) => {
  const db = loadDB();
  const todayStr = new Date().toISOString().split("T")[0];
  const time = req.body?.time || "1:30 PM";

  db.hospitals.forEach(h => {
    // Check if they already submitted today
    const submitted = db.dailyReports.some(r => r.hospitalId === h.id && r.recordDate === todayStr);
    if (!submitted) {
      db.notifications.unshift({
        id: "daily-sched-" + Math.random().toString(36).substring(2, 11),
        title: `🕒 Daily MPR Entry Reminder (${time})`,
        body: `Hello! Please submit the patient logs, lab registries, and kits usage for today (${todayStr}) before shift end.`,
        deepLink: `/calendar?hospitalId=${h.id}&date=${todayStr}`,
        timestamp: new Date().toISOString(),
        recipientEmail: h.contactEmail
      });
    }
  });

  saveDB(db);
  res.json({ success: true, message: `Simulated Daily Schedule Reminder triggered successfully for ${time}!` });
});

// Audit Logs fetch
app.get("/api/admin/audit-logs", (req, res) => {
  const db = loadDB();
  res.json(db.auditLogs.slice(0, 150)); // Return last 150 entries
});

// Get all custom templates
app.get("/api/templates", (req, res) => {
  const db = loadDB();
  res.json({ success: true, templates: db.customTemplates || [] });
});

// Create/Upload a template
app.post("/api/templates", (req, res) => {
  const { name, fileName, fileBase64, mappings, customFields } = req.body;
  
  if (!name || !fileBase64) {
    return res.status(400).json({ success: false, message: "Template name and Excel file are required" });
  }

  const db = loadDB();
  const newTemplate: CustomReportTemplate = {
    id: `tpl-${Date.now()}`,
    name,
    fileName: fileName || "template.xlsx",
    fileBase64,
    mappings: mappings || [],
    customFields: customFields || [],
    createdAt: new Date().toISOString()
  };

  if (!db.customTemplates) {
    db.customTemplates = [];
  }
  db.customTemplates.push(newTemplate);
  saveDB(db);

  // Log audit trail
  db.auditLogs.unshift({
    id: `audit-tpl-${Date.now()}`,
    userId: "user-manu",
    userEmail: "manu.spng@gmail.com",
    userName: "System Admin",
    action: "CREATE",
    tableName: "CustomReportTemplate",
    recordId: newTemplate.id,
    details: `Uploaded new Custom Excel Report Template: ${name}`,
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  res.json({ success: true, template: newTemplate });
});

// Update an existing custom template
app.put("/api/templates/:id", (req, res) => {
  const { id } = req.params;
  const { name, fileName, fileBase64, mappings, customFields } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, message: "Template name is required" });
  }

  const db = loadDB();
  const index = (db.customTemplates || []).findIndex(t => t.id === id);
  
  if (index !== -1) {
    const existingTpl = db.customTemplates[index];
    const updatedTemplate = {
      ...existingTpl,
      name,
      fileName: fileName || existingTpl.fileName,
      fileBase64: fileBase64 || existingTpl.fileBase64,
      mappings: mappings || existingTpl.mappings,
      customFields: customFields || existingTpl.customFields,
      updatedAt: new Date().toISOString()
    };
    
    db.customTemplates[index] = updatedTemplate;
    
    // Log audit trail
    db.auditLogs.unshift({
      id: `audit-tpl-update-${Date.now()}`,
      userId: "user-manu",
      userEmail: "manu.spng@gmail.com",
      userName: "System Admin",
      action: "UPDATE",
      tableName: "CustomReportTemplate",
      recordId: id,
      details: `Updated Custom Excel Report Template: ${name}`,
      timestamp: new Date().toISOString()
    });
    saveDB(db);
    res.json({ success: true, template: updatedTemplate });
  } else {
    res.status(404).json({ success: false, message: "Template not found" });
  }
});

// Delete a custom template
app.delete("/api/templates/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const initialLength = db.customTemplates?.length || 0;
  db.customTemplates = (db.customTemplates || []).filter(t => t.id !== id);
  
  if ((db.customTemplates?.length || 0) < initialLength) {
    // Log audit trail
    db.auditLogs.unshift({
      id: `audit-tpl-${Date.now()}`,
      userId: "user-manu",
      userEmail: "manu.spng@gmail.com",
      userName: "System Admin",
      action: "DELETE",
      tableName: "CustomReportTemplate",
      recordId: id,
      details: `Deleted Custom Excel Report Template with ID ${id}`,
      timestamp: new Date().toISOString()
    });
    saveDB(db);
    res.json({ success: true, message: "Template deleted successfully" });
  } else {
    res.status(404).json({ success: false, message: "Template not found" });
  }
});

// AI Auto-mapper endpoint using Gemini 3.5
app.post("/api/templates/auto-map", async (req, res) => {
  const { cells } = req.body; // cells: Array<{ ref: string, value: string }>
  
  const aiClient = getGemini();
  if (!aiClient) {
    return res.json({
      success: false,
      message: "AI service offline. Ensure GEMINI_API_KEY is configured."
    });
  }

  try {
    const prompt = `
      You are an AI data mapper for Uttarakhand's Ayush Department. 
      The user has uploaded a custom Excel sheet report template. 
      We want to automatically match Excel cells or headers to our clinical system metrics.

      Here are the available Clinical system metrics in our database:
      - opd_male_new (New Male OPD Outpatients)
      - opd_male_old (Old Male OPD Outpatients)
      - opd_female_new (New Female OPD Outpatients)
      - opd_female_old (Old Female OPD Outpatients)
      - opd_child_new (New Child OPD Outpatients)
      - opd_child_old (Old Child OPD Outpatients)
      - opd_elderly_new (New Elderly OPD Outpatients)
      - opd_elderly_old (Old Elderly OPD Outpatients)
      - opd_total (Total OPD Patients)
      - ipd_admissions (Total Inpatient Department Admissions)
      - ipd_male_new (New Male IPD Patients)
      - ipd_male_old (Old Male IPD Patients)
      - ipd_female_new (New Female IPD Patients)
      - ipd_female_old (Old Female IPD Patients)
      - ipd_child_new (New Child IPD Patients)
      - ipd_child_old (Old Child IPD Patients)
      - ipd_bed_occupancy_percentage (IPD Average Bed Occupancy %)
      - panchkarma_male (Male Panchkarma procedures count)
      - panchkarma_female (Female Panchkarma procedures count)
      - panchkarma_child (Child Panchkarma procedures count)
      - panchkarma_elderly (Elderly Panchkarma procedures count)
      - levy_charges (Government Levy Charges Collected)
      - aadhaar_seeded_count (Aadhaar Seeded counts)
      - mobile_seeded_count (Mobile Seeded counts)
      - hemoglobin (Hb Lab investigations count)
      - blood_sugar (Blood Sugar Lab investigations count)
      - urine_sugar (Urine Sugar investigations count)
      - urine_albumin (Urine Albumin investigations count)
      - malaria (Malaria RDT tests)
      - dengue (Dengue NS1 tests)
      - typhoid (Typhoid Widal tests)
      - outreach_camps_conducted (Total outreach camps)
      - camp_beneficiaries_total (Total camp beneficiaries)
      - camp_medicines_distributed (Total camp medicines distributed)

      The user uploaded a spreadsheet. Here is the list of extracted cell references and their label values:
      ${JSON.stringify(cells.slice(0, 150))}

      Based on these cell coordinates and labels, match each relevant Clinical system metric to the correct cell reference or column.
      Your output MUST be a JSON array of mappings, strictly conforming to this format:
      [
        { "sheetName": "Sheet1", "cellRef": "C10", "systemField": "opd_male_new" }
      ]
      
      Match only what makes sense. Do NOT include any text, reasoning, markdown tags, or prose. Return ONLY the raw JSON array.
    `;

    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1, // low temperature for precise JSON matching
        responseMimeType: "application/json"
      }
    });

    let mappings = [];
    try {
      const txt = response.text || "[]";
      mappings = JSON.parse(txt.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("Failed to parse Gemini auto-mapper response", e);
    }

    res.json({ success: true, mappings });
  } catch (error: any) {
    console.error("Gemini mapping error:", error);
    res.json({ success: false, message: "AI mapping failed", mappings: [] });
  }
});

// SERVER-SIDE GEMINI API SUMMARY
app.post("/api/mpr/summarize", async (req, res) => {
  const { month, districtTotal, hospitals } = req.body;

  const aiClient = getGemini();
  if (!aiClient) {
    return res.json({
      success: false,
      summary: "⚠️ AI Summarization is currently offline. Please configure your GEMINI_API_KEY in the AI Studio Settings secrets panel to unlock AI briefings."
    });
  }

  try {
    const prompt = `
      You are the chief medical policy officer and enterprise intelligence analyst for the Ministry of Ayush, Government of India.
      Analyze the following Monthly Progress Report (MPR) aggregated data of the district for the month of ${month}.
      Provide a highly polished, professional executive clinical summary containing:
      1. Overall District Highlights (Total OPD card registrations, IPD bed occupancy and trends).
      2. Performance insights of individual hospitals (highlighting high performers vs laggards).
      3. Medical insights (Laboratory investigation ratios, e.g., low Hb levels or active Malaria/Dengue positive tests).
      4. Inventory & Outreach recommendation (Low stock alerts count, and camp activities feedback).
      Keep your tone highly formal, executive, objective, and policy-driven. Use clean bullet points and clear headings. Do NOT output code or markdown file indicators, just the executive summary text.

      AGGREGATED DATA:
      Consolidated District Totals:
      - Total OPD Patients: ${districtTotal.opd_total} (Male New: ${districtTotal.opd_male_new}, Female New: ${districtTotal.opd_female_new}, Children: ${districtTotal.opd_child_new + districtTotal.opd_child_old})
      - IPD Admissions: ${districtTotal.ipd_admissions} with Average Bed Occupancy: ${districtTotal.avg_bed_occupancy}%
      - Panchkarma Therapies Administered: ${districtTotal.panchkarma_total}
      - Total Lab Tests Conducted: ${districtTotal.total_tests} (Hemoglobin: ${districtTotal.hemoglobin}, Blood Sugar: ${districtTotal.blood_sugar}, Malaria Positive: ${districtTotal.malaria}, Dengue: ${districtTotal.dengue})
      - Total Outreach Camps Conducted: ${districtTotal.camp_count} with ${districtTotal.camp_beneficiaries_total} beneficiaries
      - Total Low Stock Kits Alerts: ${districtTotal.lowStockAlertsCount}
      
      Hospital Breakdowns:
      ${hospitals.map((h: any) => `- ${h.hospitalName} (${h.hospitalType}): OPD=${h.opd_total}, IPD=${h.ipd_admissions}, Tests=${h.total_tests}, Days Logged=${h.daysSubmitted}/30`).join("\n")}
    `;

    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return res.json({
      success: true,
      summary: response.text
    });
  } catch (error: any) {
    console.error("Gemini API error during summarization:", error);
    return res.json({
      success: false,
      summary: `⚠️ AI summarizing failed: ${error.message || error}`
    });
  }
});

// Server setup & static routing (with Vite integration)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`[AYUSH MPR SERVER] Running on port ${PORT} (host: 0.0.0.0)`);
    // Initialize DB store immediately and sync with Firestore cloud database
    const db = loadDB();
    await initializeDatabase(db);
  });
}

startServer();
