import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TRIGGER_LEVEL = 2.8;

const ALERT_STATE_FILE = path.join(process.cwd(), ".next", "voltage-alert-state.json");

if (!global.voltageAlertStore) {
  global.voltageAlertStore = {
    lastCheckedAt: null,
    lastAlertAt: null,
    lastAlertMessage: null,
    lastAlerts: [],
    lastDailyCheckDate: null,
    stateLoaded: false,
    schedulerStarted: false,
    schedulerTimerId: null,
  };
}

function getMonitorConfig() {
  return {
    checkHour: Number(process.env.FEEDER_FILL_ALERT_HOUR ?? 17),
    checkMinute: Number(process.env.FEEDER_FILL_ALERT_MINUTE ?? 0),
  };
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextScheduledTime(now, hour, minute) {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function loadAlertState(store) {
  if (store.stateLoaded) return;

  try {
    const raw = readFileSync(ALERT_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.lastDailyCheckDate === "string") {
      store.lastDailyCheckDate = parsed.lastDailyCheckDate;
    }
    if (typeof parsed.lastAlertAt === "string") {
      store.lastAlertAt = parsed.lastAlertAt;
    }
    if (typeof parsed.lastAlertMessage === "string") {
      store.lastAlertMessage = parsed.lastAlertMessage;
    }
    if (Array.isArray(parsed.lastAlerts)) {
      store.lastAlerts = parsed.lastAlerts;
    }
  } catch {}

  store.stateLoaded = true;
}

function saveAlertState(store) {
  try {
    mkdirSync(path.dirname(ALERT_STATE_FILE), { recursive: true });
    writeFileSync(
      ALERT_STATE_FILE,
      JSON.stringify(
        {
          lastDailyCheckDate: store.lastDailyCheckDate,
          lastAlertAt: store.lastAlertAt,
          lastAlertMessage: store.lastAlertMessage,
          lastAlerts: store.lastAlerts,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (err) {
    console.error("[voltage-alert] failed to persist state:", err);
  }
}

export async function fetchAlerts() {
  try {
    const store = global.voltageAlertStore;
    const now = new Date();
    const todayKey = getLocalDateKey(now);

    const data = global.voltageStore?.cachedData;
    if (!data) {
      console.log("[voltage-alert] No cached voltage data yet");
      return { skipped: true, reason: "no_voltage_cache" };
    }

    const fields = ["voltage_out", "voltage_in", "voltage_in_2"];
    const lowReadings = [];

    for (const field of fields) {
      const rawValue = data[field]?.value;
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      const voltage = Number(rawValue);
      if (!Number.isFinite(voltage)) {
        console.warn(`[voltage-alert] ${field} is not numeric:`, rawValue);
        continue;
      }

      if (voltage < TRIGGER_LEVEL) {
        lowReadings.push({ field, voltage });
      }
    }

    store.lastCheckedAt = now.toISOString();
    store.lastDailyCheckDate = todayKey;

    if (lowReadings.length > 0) {
      store.lastAlertAt = now.toISOString();
      store.lastAlerts = lowReadings.map((item) => ({
        field: item.field,
        voltage: item.voltage,
        message: `${item.field} ${item.voltage}V is below ${TRIGGER_LEVEL}V`,
      }));
      store.lastAlertMessage = store.lastAlerts[0]?.message ?? null;
      store.lastAlerts.forEach((item) => {
        console.warn(`[voltage-alert] ${item.message}`);
      });
    } else {
      store.lastAlertMessage = null;
      store.lastAlerts = [];
      console.log("[voltage-alert] Daily check complete: all voltages above threshold");
    }

    saveAlertState(store);
    return { skipped: false, lowReadingsCount: lowReadings.length };
  } catch (err) {
    console.error("[voltage-alert] Failed to process alert:", err);
    return { skipped: true, reason: "error" };
  }
}



function scheduleNextDailyRun() {
  const store = global.voltageAlertStore;
  const { checkHour, checkMinute } = getMonitorConfig();
  const now = new Date();
  const nextRun = getNextScheduledTime(now, checkHour, checkMinute);
  const delayMs = Math.max(1, nextRun.getTime() - now.getTime());

  store.schedulerTimerId = setTimeout(async () => {
    try {
      await fetchAlerts();
    } finally {
      scheduleNextDailyRun();
    }
  }, delayMs);

  console.log(`[voltage-alert] Next daily check scheduled for ${nextRun.toLocaleString()}`);
}

export function startVoltageDailyAlertScheduler() {
  const store = global.voltageAlertStore;
  if (store.schedulerStarted) {
    return;
  }

  loadAlertState(store);
  store.schedulerStarted = true;
  scheduleNextDailyRun();
}

export function getVoltageAlertStatus() {
  const store = global.voltageAlertStore;
  loadAlertState(store);

  return {
    threshold: TRIGGER_LEVEL,
    lastCheckedAt: store.lastCheckedAt,
    lastAlertAt: store.lastAlertAt,
    lastAlertMessage: store.lastAlertMessage,
    lastAlerts: store.lastAlerts,
    lastDailyCheckDate: store.lastDailyCheckDate,
  };
}
