import { generateId } from "../core/utils.js";

export const APP_SCHEMA_VERSION = 3;
export const APP_VERSION = "3.9.20";
export const APP_MODULE = "doku";

export const PRACTICE_ADDRESS = ``;

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
      therapistFax: "",
      practicePhone: "",
      practiceAddress: PRACTICE_ADDRESS,
      workDays: [],
      weeklyHours: "",
      fastStartDatum: "",
      stundenStartsaldoMinuten: 0,
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
      lastAutoExportAt: ""
    }
  };
}