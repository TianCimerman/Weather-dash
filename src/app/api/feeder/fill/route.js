export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const PI = process.env.PI_FEEDER_URL;
    if (!PI) {
      return Response.json(
        { ok: false, error: "PI_FEEDER_URL is not set" },
        { status: 500 }
      );
    }

    const res = await fetch(`${PI}/sensor/distance`, {
      cache: "no-store"
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: res.ok, error: text || "Non-JSON response from Pi" };
    }

    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json(
      { ok: false, error: `Website API crashed: ${String(err)}` },
      { status: 502 }
    );
  }
}
