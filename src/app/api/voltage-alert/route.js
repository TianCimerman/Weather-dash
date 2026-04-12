import { NextResponse } from "next/server";
import { getVoltageAlertStatus } from "@/lib/voltage_alerts";

export async function GET() {
  const status = getVoltageAlertStatus();
  return NextResponse.json(status);
}
