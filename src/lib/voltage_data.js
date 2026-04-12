import { InfluxDB } from "@influxdata/influxdb-client";

// Ensure the global object exists
if (!global.voltageStore) {
  global.voltageStore = {
    cachedData: null,
  };
}

export async function fetchVoltage() {
  try {
    const influxToken = process.env.INFLUX_TOKEN;
    const url = process.env.INFLUX_URL;
    const org = process.env.INFLUX_ORG;

    const queryApi = new InfluxDB({ url, token: influxToken }).getQueryApi(org);

    // Note: range(start: -1h) is good, but make sure your DB has data in the last hour
    const flux = `
      from(bucket: "data")
        |> range(start: -1h)
        |> filter(fn: (r) => r["_measurement"] == "climate_2")
        |> filter(fn: (r) =>
          r["_field"] == "voltage_out" or
          r["_field"] == "voltage_in" or
          r["_field"] == "voltage_in_2"
        )
        |> last()

    `;

    const rows = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(flux, {
        next(row, meta) { rows.push(meta.toObject(row)); },
        error: reject,
        complete: resolve,
      });
    });
    const result = {
      voltage_out: null,
      voltage_in: null,
      voltage_in_2: null,
    };
    rows.forEach(r => {
    result[r._field] = {
        value: r._value,
        time: r._time
    };
    });

    global.voltageStore.cachedData = result;

    }
 catch (err) {
    console.error("Error fetching voltage data:", err);

  }
}

