import nodemailer from "nodemailer";

let cachedTransporter = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  };
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) return null;

  cachedTransporter = nodemailer.createTransport(smtpConfig);
  return cachedTransporter;
}

export async function sendFeederLowFillEmail({ thresholdPercent, currentPercent, distanceCm, measuredAt }) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;

  if (!transporter || !from || !to) {
    console.warn("[feeder-alert] Email not sent: SMTP or recipient config missing");
    return { ok: false, skipped: true, reason: "missing_email_config" };
  }

  const measuredText = measuredAt ? new Date(measuredAt).toLocaleString() : "Unknown";
  const subject = `Feeder alert: fill ${currentPercent}% (below ${thresholdPercent}%)`;
  const text = [
    "Pet feeder low-fill alert",
    `Current percentage: ${currentPercent}%`,
    `Threshold: ${thresholdPercent}%`,
    `Measured distance: ${distanceCm ?? "Unknown"} cm`,
    `Measured at: ${measuredText}`,
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });

  return { ok: true };
}
