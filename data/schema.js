import { generateId } from "../core/utils.js";

export const APP_SCHEMA_VERSION = 3;
// Bei jeder inhaltlichen Änderung an der App (jede neue Session/jedes
// Update) muss diese Zahl von Hand erhöht werden - es gibt keinen
// automatischen Build-Schritt dafür, und die Versionsanzeige im Dashboard
// ist für den Therapeuten die einzige sichtbare Bestätigung, dass ein
// Update tatsächlich angekommen ist.
export const APP_VERSION = "3.10.0";
export const APP_MODULE = "doku";

export const PRACTICE_ADDRESS = `Physio Strobl
- Abteilung FaSt -
Münchener Str. 155
85051 Ingolstadt`;
export const PRACTICE_PHONE = "0841-45674267";

export function createEmptyAppData() {
  const now = new Date().toISOString();

  return {
    schemaVersion: APP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    module: APP_MODULE,
    viewerCompatible: true,
    exportTimestamp: "",

    settings: {
      therapistId: generateId("therapist"),
      therapistName: "",
      therapistEmail: "",
      therapistFax: "",
      practicePhone: PRACTICE_PHONE,
      practiceAddress: PRACTICE_ADDRESS,
      workDays: [],
      weeklyHours: "",
      fastStartDatum: "",
      stundenStartsaldoMinuten: 0,
      jahresurlaubTage: 0,
      fastiEnabled: true,
      zertifikate: {
        kgzns: false,
        mt: false,
        mld: false
      },
      supportUrl: "",
      buero: {
        email: ""
      },
      assessmentIntervalMonths: 3,
      createdAt: now,
      updatedAt: now
    },

    homes: [],

    doku: {
      version: 1
    },

    zeit: {
      version: 1,
      therapists: [],
      workModels: [],
      timeEntries: [],
      approvals: [],
      kilometer: [],
      reports: []
    },

    kilometer: {
      startPoint: {
        label: "",
        address: ""
      },
      knownRoutes: [],
      travelLog: [],
      kmExports: []
    },

    abwesenheiten: [],
    specialDays: [],
    stundenAbgleiche: [],
    aerzte: [],
    freikuvertHistory: [],

    abgabeHistory: [],
    nachbestellHistory: [],
    autoExportHistory: [],

    security: {
      log: [],
      lastSecurityChangeAt: ""
    },

    ui: {
      lastBackupAt: "",
      lastAutoExportAt: "",
      lastFastiWeeklySummaryAt: ""
    }
  };
}