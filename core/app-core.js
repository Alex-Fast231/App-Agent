import { normalizeAppData } from "../data/normalization.js";
import { encryptJSON } from "../crypto/crypto-engine.js";
import { saveEncryptedAppData } from "../storage/secure-store.js";

let runtimeKey = null;
let runtimeData = null;
let cryptoMeta = null;
let securityState = null;
let currentView = "boot";
let currentContext = {};
let persistPromise = null;

export function setRuntimeSession(session) {
  runtimeKey = session.runtimeKey ?? null;
  runtimeData = session.runtimeData ? normalizeAppData(session.runtimeData) : null;
  cryptoMeta = session.cryptoMeta ?? cryptoMeta;
  securityState = session.securityState ?? securityState;
}

export function clearRuntimeSession() {
  runtimeKey = null;
  runtimeData = null;
  currentContext = {};
}

export function setCryptoMeta(value) {
  cryptoMeta = value;
}

export function setSecurityState(value) {
  securityState = value;
}

export function getRuntimeData() {
  return runtimeData;
}

export function getRuntimeKey() {
  return runtimeKey;
}

export function getCryptoMeta() {
  return cryptoMeta;
}

export function getSecurityState() {
  return securityState;
}

export function setCurrentView(viewName, context = {}) {
  currentView = viewName;
  currentContext = context;
}

export function getCurrentView() {
  return currentView;
}

export function getCurrentContext() {
  return currentContext;
}

export function mutateRuntimeData(mutatorFn) {
  if (!runtimeData) {
    throw new Error("Kein runtimeData Zustand vorhanden");
  }

  mutatorFn(runtimeData);
  runtimeData = normalizeAppData(runtimeData);
  return runtimeData;
}

export async function persistRuntimeData() {
  if (!runtimeKey || !runtimeData) {
    throw new Error("Runtime Session ist nicht entsperrt");
  }

  // Der Schlüssel wird hier als Wert für encryptJSON übergeben, ist also
  // auch dann noch korrekt, wenn runtimeKey währenddessen extern auf null
  // gesetzt wird (z.B. durch einen Lock). Der Speichervorgang selbst ist
  // damit sicher und wird nicht abgebrochen.
  const keyForThisWrite = runtimeKey;
  const normalized = normalizeAppData(runtimeData);
  const encrypted = await encryptJSON(normalized, keyForThisWrite);
  await saveEncryptedAppData(encrypted);

  // Nur dann den entschlüsselten Stand wieder im Speicher ablegen, wenn
  // die Session währenddessen NICHT gesperrt wurde. Sonst würde ein Lock,
  // der genau während dieses Speichervorgangs passiert, die entschlüsselten
  // Daten direkt wieder zurück in den Speicher schreiben.
  if (runtimeKey === keyForThisWrite) {
    runtimeData = normalized;
  }
}

export function queuePersistRuntimeData() {
  if (persistPromise) return persistPromise;

  persistPromise = new Promise((resolve, reject) => {
    queueMicrotask(async () => {
      try {
        await persistRuntimeData();
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        persistPromise = null;
      }
    });
  });

  return persistPromise;
}