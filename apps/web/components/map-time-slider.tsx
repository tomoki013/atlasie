"use client";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export default function MapTimeSlider({
  dates,
  onChange,
  loading,
  error,
}: {
  dates: string[];
  onChange: (date: string | null) => void;
  loading: boolean;
  error: boolean;
}) {
  const [position, setPosition] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const change = useRef(onChange);
  change.current = onChange;
  const index =
    position === null ? dates.length : Math.min(position, dates.length);
  function select(next: number) {
    setPosition(next);
    change.current(
      next === dates.length ? null : next === 0 ? "" : dates[next - 1],
    );
  }
  useEffect(() => {
    if (!playing) return;
    if (index >= dates.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      const next = index + 1;
      setPosition(next);
      change.current(next === dates.length ? null : dates[next - 1]);
    }, 1100);
    return () => clearTimeout(timer);
  }, [playing, index, dates]);
  const disabled = loading || error || !dates.length;
  return (
    <section className="map-time-slider" aria-label="地図の時間スライダー">
      <div className="time-slider-heading">
        <span>旅とともに、育つ地図</span>
        <output aria-live={playing ? "off" : "polite"}>
          {loading
            ? "旅の時間を読み込み中…"
            : error
              ? "時間を読み込めませんでした"
              : !dates.length
                ? "訪問を記録すると、地図の歩みを振り返れます"
                : index === 0
                  ? "旅のはじまり"
                  : `${dates[index - 1].replaceAll("-", ".")}まで`}
        </output>
      </div>
      <div className="time-slider-controls">
        <button
          className="time-play"
          aria-label={playing ? "地図の再生を一時停止" : "地図の歩みを再生"}
          disabled={disabled}
          onClick={() => {
            if (!playing && index >= dates.length) select(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <input
          aria-label="地図に表示する時点"
          type="range"
          min={0}
          max={dates.length || 1}
          value={index}
          disabled={disabled}
          aria-valuetext={index === 0 ? "旅のはじまり" : dates[index - 1]}
          onChange={(e) => {
            setPlaying(false);
            select(Number(e.target.value));
          }}
        />
        <button
          className="text-button"
          disabled={disabled}
          onClick={() => {
            setPlaying(false);
            select(dates.length);
          }}
        >
          <RotateCcw size={14} />
          すべて
        </button>
      </div>
      {dates.length > 0 && (
        <div className="time-slider-labels">
          <span>{dates[0].replaceAll("-", ".")}</span>
          <span>{dates[dates.length - 1].replaceAll("-", ".")}</span>
        </div>
      )}
    </section>
  );
}
