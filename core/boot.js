import { openDatabase } from "../storage/indexeddb.js";
import { hasSecuritySetup, loadCryptoMeta, loadSecurityState } from "../storage/secure-store.js";
import { setCryptoMeta, setSecurityState, getRuntimeData, getCurrentView } from "./app-core.js";
import { createAutoLockController } from "../security/lock.js";
import { APP_VERSION } from "../data/schema.js";
import { runAutoExportIfDue } from "../modules/autoExport.js";
import {
  showSetupView,
  showLoginView,
  showDashboardView,
  performLock,
  resumeCurrentView,
  showToast
} from "../ui/views.js";

let autoLockController = null;

// Die App ist kein Offline-PWA mehr (Service Worker wurde entfernt, App
// funktioniert nur mit aktiver Internetverbindung). Bei Geräten, auf denen
// noch ein alter Service Worker aus einer früheren Version installiert ist,
// wird dieser hier deaktiviert, damit keine veralteten Dateien mehr aus
// einem Cache ausgeliefert werden.
async function removeLegacyServiceWorker() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.error("Alter Service Worker konnte nicht entfernt werden:", err);
  }
}

function showVersionLabel() {
  const versionLabel = document.getElementById("appVersionLabel");
  if (versionLabel) {
    versionLabel.textContent = APP_VERSION;
  }
}

async function ensurePersistentStorage() {
  try {
    if (!navigator.storage || typeof navigator.storage.persist !== "function") {
      return { supported: false, persisted: false };
    }

    const alreadyPersisted = typeof navigator.storage.persisted === "function"
      ? await navigator.storage.persisted()
      : false;

    if (alreadyPersisted) {
      return { supported: true, persisted: true };
    }

    const granted = await navigator.storage.persist();
    return { supported: true, persisted: granted };
  } catch (err) {
    console.error("Persistent Storage Anfrage fehlgeschlagen:", err);
    return { supported: true, persisted: false, error: err };
  }
}

async function determineStartupState() {
  const setupExists = await hasSecuritySetup();
  return setupExists ? "login" : "setup";
}

function lockApp() {
  if (autoLockController) {
    autoLockController.stop();
  }

  performLock({
    onLocked: async () => {
      const state = await loadSecurityState();
      setSecurityState(state);
      showLoginView({ onSuccess: handleUnlocked });
    }
  });
}

function ensureAutoLock() {
  if (!autoLockController) {
    autoLockController = createAutoLockController(() => lockApp());
    autoLockController.bindActivityEvents();
  }
  autoLockController.start();
}

function handleUnlocked() {
  ensureAutoLock();
  resumeCurrentView({ onLock: lockApp });
  triggerAutoExportIfDue();
}

// Läuft still im Hintergrund, ohne die UI zu blockieren oder den
// Therapeuten um Bestätigung zu bitten (Vorgabe Funktion 8). Der kurze
// Hinweis "Daten abgeschickt" ist bewusst nur für den aktuellen Testbetrieb
// gedacht (Vorgabe des Nutzers) und kann später wieder entfernt werden,
// sobald der tägliche Versand zuverlässig bestätigt ist.
function triggerAutoExportIfDue() {
  const runtimeData = getRuntimeData();
  if (!runtimeData) {
    console.warn("Auto-Export: übersprungen, da beim Entsperren keine App-Daten im Speicher waren (runtimeData ist leer).");
    return;
  }

  runAutoExportIfDue(runtimeData)
    .then((result) => {
      if (result?.sent) {
        showToast("Daten abgeschickt");
      }
      // Falls der Therapeut in der Zwischenzeit weiterhin auf dem
      // Dashboard ist, dessen Verlaufs-Anzeige mit dem frischen Ergebnis
      // aktualisieren (die Ansicht wurde beim Entsperren gerendert, bevor
      // dieser asynchrone Versand abgeschlossen war). Andere Ansichten
      // (z.B. ein gerade bearbeitetes Formular) bewusst nicht neu rendern,
      // um keine ungespeicherten Eingaben zu verwerfen.
      if (getCurrentView() === "dashboard") {
        resumeCurrentView({ onLock: lockApp });
      }
    })
    .catch((err) => console.error("Automatischer Export fehlgeschlagen:", err));
}

async function bootstrapApp() {
  showVersionLabel();
  await removeLegacyServiceWorker();

  const persistResult = await ensurePersistentStorage();
  if (persistResult.supported && !persistResult.persisted) {
    console.warn(
      "Persistenter Speicher wurde vom Browser nicht gewährt. " +
      "Die App-Daten könnten bei Speicherdruck vom System gelöscht werden. " +
      "Regelmäßige Backups werden dringend empfohlen."
    );
  }

  await openDatabase();

  const startupState = await determineStartupState();

  if (startupState === "setup") {
    showSetupView({
      onSuccess: handleUnlocked
    });
    return;
  }

  const cryptoMeta = await loadCryptoMeta();
  const securityState = await loadSecurityState();

  setCryptoMeta(cryptoMeta);
  setSecurityState(securityState);

  showLoginView({
    onSuccess: handleUnlocked
  });
}

bootstrapApp().catch((err) => {
  console.error(err);
  document.getElementById("app").innerHTML = `
    <div class="card">
      <h2>Startfehler</h2>
      <p>Die App konnte nicht gestartet werden.</p>
      <p class="error">${String(err?.message || err)}</p>
    </div>
  `;
});