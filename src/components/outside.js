"use client";

import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faTemperatureLow, faTint } from '@fortawesome/free-solid-svg-icons';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function WeatherWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const shownAlertKeysRef = useRef(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/weather");
        const alertRes = await fetch("/api/voltage-alert", { cache: "no-store" });
        
        // If the server is still warming up (503), keep loading
        if (res.status === 503) {
          console.log("Server cache warming up...");
          return; 
        }

        const json = await res.json();

        if (alertRes.ok) {
          const alertJson = await alertRes.json();
          const alertAt = alertJson?.lastAlertAt ?? null;
          const alerts = Array.isArray(alertJson?.lastAlerts)
            ? alertJson.lastAlerts
            : [];

          for (const item of alerts) {
            const field = item?.field;
            const message = item?.message;
            if (!alertAt || !field || !message) {
              continue;
            }

            const key = `${alertAt}:${field}`;
            if (shownAlertKeysRef.current.has(key)) {
              continue;
            }

            toast.warning(message);
            shownAlertKeysRef.current.add(key);
          }
        }

        
        // Check if json actually has the sensors array before stopping the loader
        if (json && json.sensors) {
          setData({ ...json });
          setLoading(false);
        }
      } catch (err) {
        console.error("Frontend fetch error:", err);
        // We don't set loading to false here so it tries again in 60s
      }
    }

    load();
    const interval = setInterval(load, 10000); // Check every 10s until loaded
    return () => clearInterval(interval);
  }, []);



  // Show a nice loading state instead of a blank screen
  if (loading || !data) {
    return (
      <div 
        style={{ backgroundColor: "hsl(218, 46%, 8%)" }}
        className="w-[38.33rem] rounded-3xl m-[2.5rem] p-[1.5rem] h-[26rem] flex items-center justify-center"
      >
        <p className="text-white text-xl animate-pulse">Loading data...</p>
      </div>
    );
  }

  const weather = data.weather;

  return (
    <div
      style={{ backgroundColor: "hsl(218, 46%, 8%)" }}
      className="w-[38.33rem] rounded-3xl m-[2.5rem] p-[1.5rem] h-[26rem] hss:h-[24rem] hss:w-[29rem] ml-[1.5rem] hss:px-[2.5rem] sl:w-[90%] sl:h-[80%]"
    >
      <ToastContainer position="top-right" autoClose={false} />
      <p className="text-[3.125rem] sl:text-[2rem] text-center items-center font-bold hss:text-white">
        Outside
      </p>
      <div className="flex flex-row pt-[1rem]">
          <div className="flex flex-col gap-[2.5rem] items-center ml-[0.525rem] pt-[1rem] p-[1.25rem] rounded-3xl sl:gap-[1rem]">
            <FontAwesomeIcon icon={faSun} color="orange" className="text-5xl sl:text-3xl" />
            <FontAwesomeIcon icon={faTemperatureLow} color="orange" className="text-5xl sl:text-3xl" />
            <FontAwesomeIcon icon={faTint} color="orange" className="text-5xl sl:text-3xl pr-[0.1875rem]" />
          </div>
        <div className="flex flex-col gap-[0.125rem] items-center ml-[-1rem]">
          <div className="flex flex-row gap-[3.5rem] items-center ml-[7.5rem] hss:ml-[3rem] hss:gap-[0.5rem] sl:text-[1rem] sl:gap-[0.1rem] sl:ml-[2rem]">
            <p className="text-[2.8rem] sl:text-[1.5rem] hss:text-white">
              {weather?.main ?? "Loading..."}
            </p>
            {weather?.icon && <img src={weather.icon} alt={weather.main} className=" hss:w-13 hss:h-13 sl:w-12 sl:h-12" />}
          </div>
          <div className="flex flex-row gap-[2.5rem] items-center">
            <p className="text-[2.8rem] sl:text-[1.5rem] hss:text-white">
              {data.sensors.find((d) => d._field === "temperature_out")?._value ?? "--"}°C
            </p>
          </div>
          <div className="flex flex-row gap-[2.5rem] items-center pt-[1rem]">
            <p className="text-[2.8rem] sl:text-[1.5rem] hss:text-white">
              {data.sensors.find((d) => d._field === "humidity_out")?._value ?? "--"}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}