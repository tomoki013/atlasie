"use client";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place, Visit } from "@/lib/data";
export default function WorldMap({
  places,
  visits,
  selected,
  onSelect,
  countryCodes,
}: {
  places: Place[];
  visits: Visit[];
  selected: Place | null;
  onSelect: (p: Place) => void;
  countryCodes?: string[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    setReady(false);
    let instance: maplibregl.Map;
    let observer: ResizeObserver | undefined;
    try {
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      instance = new maplibregl.Map({
        container: container.current,
        center: [15, 20],
        zoom: 1.35,
        minZoom: -1,
        maxZoom: 7,
        renderWorldCopies: false,
        cooperativeGestures: true,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            countries: {
              type: "geojson",
              data: "/data/countries.geojson",
              attribution: "Natural Earth · public domain",
            },
          },
          layers: [
            {
              id: "ocean",
              type: "background",
              paint: { "background-color": "#d6eaf0" },
            },
            {
              id: "land",
              type: "fill",
              source: "countries",
              paint: { "fill-color": "#d8dfca", "fill-opacity": 0.94 },
            },
            {
              id: "borders",
              type: "line",
              source: "countries",
              paint: { "line-color": "#f7f7ed", "line-width": 0.7 },
            },
            {
              id: "visited",
              type: "fill",
              source: "countries",
              filter: ["in", "ISO3166-1-Alpha-2", ""],
              paint: { "fill-color": "#9fb99b", "fill-opacity": 0.85 },
            },
          ],
        },
      });
      const fitWorld = () =>
        instance.fitBounds(
          [
            [-170, -55],
            [180, 80],
          ],
          {
            padding:
              window.innerWidth < 600
                ? { top: 60, bottom: 15, left: 10, right: 10 }
                : { top: 65, bottom: 40, left: 15, right: 15 },
            duration: 0,
          },
        );
      observer = new ResizeObserver(() => {
        instance.resize();
        if (instance.isStyleLoaded()) fitWorld();
      });
      observer.observe(container.current);
      map.current = instance;
      instance.on("load", () => {
        fitWorld();
        setReady(true);
      });
      instance.on("error", () => setError(true));
      instance.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-left",
      );
    } catch {
      setError(true);
    }
    return () => {
      observer?.disconnect();
      instance?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current?.getLayer("visited")) return;
    const currentMap = map.current;
    const active = places.filter((p) => visits.some((v) => v.placeId === p.id));
    map.current.setFilter("visited", [
      "in",
      "ISO3166-1-Alpha-2",
      ...(countryCodes ?? active.map((p) => p.code)),
    ]);
    const markers = active.map((p) => {
      const v = visits.find((v) => v.placeId === p.id);
      const button = document.createElement("button");
      button.className = `photo-pin ${selected?.id === p.id ? "selected" : ""}`;
      button.setAttribute("aria-label", `${p.country}・${p.name}を表示`);
      const img = document.createElement("img");
      img.src = v?.photos[0] || p.image;
      img.alt = p.name;
      button.append(img);
      button.onclick = () => select.current(p);
      return new maplibregl.Marker({ element: button, anchor: "bottom" })
        .setLngLat(p.coordinates)
        .addTo(currentMap);
    });
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [ready, visits, places, selected, countryCodes]);
  return (
    <>
      <div ref={container} className="map-canvas" />
      {error && (
        <div className="map-error">
          地図を読み込めません。旅のカードから記録をご覧いただけます。
        </div>
      )}
      <div className="ocean-label atlantic">
        Atlantic
        <br />
        Ocean
      </div>
      <div className="ocean-label pacific">Pacific Ocean</div>
      <div className="ocean-label indian">
        Indian
        <br />
        Ocean
      </div>
      <div className="compass">
        N<span>✧</span>S
      </div>
    </>
  );
}
