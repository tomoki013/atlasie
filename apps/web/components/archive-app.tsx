"use client";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Globe2,
  Images,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  Menu,
  Mountain,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  auth,
  cloudClient,
  cloudConfigured,
  importGuest,
  remoteMap,
  remotePlaces,
  remoteVisits,
  uploadPhotos,
} from "@/lib/cloud";
import {
  countryPlaces,
  demoVisits,
  type Place,
  places as starterPlaces,
  type Visit,
} from "@/lib/data";
import { preparePhoto, readArchive, writeArchive } from "@/lib/guest";
import type { RemoteVisit } from "../../../packages/api-client/src";
import { type Archive, summarize } from "../../../packages/domain/src";
import { PhotonPlaceProvider } from "../../../packages/geo/src/photon";
import ArchiveHighlights from "./archive-highlights";
import CloudSave from "./cloud-save";
import CloudSettings from "./cloud-settings";
import EditMemory from "./edit-memory";
import GuestTrips from "./guest-trips";
import MapTimeSlider from "./map-time-slider";
import PhotoAlbum from "./photo-album";
import TripDetails from "./trip-details";

const WorldMap = dynamic(() => import("./world-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">あなたの世界をひろげています…</div>
  ),
});
type View =
  | "map"
  | "timeline"
  | "photos"
  | "stats"
  | "profile"
  | "settings"
  | "country";
type Modal = "add" | "save" | null;
const nav = [
  { id: "map", label: "世界地図", icon: MapIcon },
  { id: "timeline", label: "旅の記録", icon: BookOpen },
  { id: "photos", label: "写真", icon: Images },
  { id: "stats", label: "旅の統計", icon: BarChart3 },
] as const;
export default function ArchiveApp() {
  const [mapUntil, setMapUntil] = useState<string | null>(null);
  const [mapHistory, setMapHistory] = useState<Visit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [timelineMode, setTimelineMode] = useState<"time" | "trip">("time");
  const [view, setView] = useState<View>("map");
  const [archive, setArchive] = useState<Archive | null>(null);
  const [cloudPlaces, setCloudPlaces] = useState<Place[]>([]);
  const [cloudVisits, setCloudVisits] = useState<Visit[] | null>(null);
  const [cloudStats, setCloudStats] = useState<
    (ReturnType<typeof summarize> & { years: string[] }) | null
  >(null);
  const [cloudMap, setCloudMap] = useState<Awaited<
    ReturnType<typeof remoteMap>
  > | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [userName, setUserName] = useState("旅するゲスト");
  const [demo, setDemo] = useState(true);
  const [selected, setSelected] = useState<Place | null>(starterPlaces[0]);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [year, setYear] = useState("all");
  const [memoryQuery, setMemoryQuery] = useState("");
  const visits = demo ? demoVisits : (cloudVisits ?? archive?.visits ?? []);
  const places = [
    ...countryPlaces,
    ...starterPlaces,
    ...(archive?.places ?? []),
    ...cloudPlaces,
  ].filter((p, i, list) => list.findIndex((q) => q.id === p.id) === i);
  const ownVisits = cloudVisits ?? archive?.visits ?? [];
  const ownStats = cloudStats ?? summarize(ownVisits, places);
  const placeImage = (place: Place) =>
    demo ? place.image : "/place-placeholder.svg";
  const displayPlaces = demo
    ? places
    : places.map((p) => ({ ...p, image: "/place-placeholder.svg" }));
  const stats = (!demo && cloudStats) || summarize(visits, places);
  const mapVisits = demo ? demoVisits : (cloudMap?.visits ?? visits);
  const history = demo
    ? demoVisits
    : cloudVisits !== null
      ? mapHistory
      : (archive?.visits ?? []);
  const mapDates = [...new Set(history.map((v) => v.date))].sort();
  const visibleMapVisits =
    mapUntil === null ? mapVisits : history.filter((v) => v.date <= mapUntil);
  const visibleMapStats =
    mapUntil === null ? stats : summarize(visibleMapVisits, places);
  useEffect(() => {
    setMapUntil(null);
  }, [demo]);
  const countrySummary =
    !demo && mapUntil === null
      ? cloudMap?.countries.find((c) => c.code === selected?.code)
      : undefined;
  const detailVisits =
    view === "map" && mapUntil !== null ? visibleMapVisits : visits;
  const selectedVisits = detailVisits.filter((v) => v.placeId === selected?.id);
  const countryVisits = detailVisits.filter(
    (v) => places.find((p) => p.id === v.placeId)?.code === selected?.code,
  );
  useEffect(() => {
    readArchive()
      .then(async (value) => {
        setArchive(value);
        if (cloudConfigured) {
          try {
            const client = await auth();
            if (await client.isAuthenticated()) {
              const api = await cloudClient();
              const user = await api.request<{ displayName: string }>("/me");
              setUserName(user.displayName);
              try {
                if (await importGuest(value)) {
                  const empty: Archive = {
                    version: 1,
                    importKey: crypto.randomUUID(),
                    visits: [],
                  };
                  await writeArchive(empty);
                  setArchive(empty);
                  setNotice("あなたの旅をアカウントに保存しました。");
                }
              } catch {
                setNotice(
                  "取り込みを完了できませんでした。元の記録はこのブラウザに残っています。地図を保存から再試行できます。",
                );
              }
              const remoteLocations = await remotePlaces();
              setCloudPlaces(remoteLocations);
              const saved = await remoteVisits();
              setCloudVisits(saved);
              setDemo(false);
              setSelected(
                [...starterPlaces, ...remoteLocations].find(
                  (p) => p.id === saved[0]?.placeId,
                ) ?? null,
              );
              return;
            }
          } catch {
            setNotice(
              "アカウントに接続できませんでした。ブラウザの記録を表示します。",
            );
          }
        }
        if (value.visits.length) {
          setDemo(false);
          setSelected(
            [...starterPlaces, ...(value.places ?? [])].find(
              (p) => p.id === value.visits[0].placeId,
            ) ?? null,
          );
        }
      })
      .catch(() =>
        setNotice("ブラウザの保存領域を開けません。設定をご確認ください。"),
      );
  }, []);
  const isCloud = cloudVisits !== null;
  useEffect(() => {
    if (!isCloud || demo || view !== "map") return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(false);
    void (async () => {
      try {
        const api = await cloudClient();
        const all: Visit[] = [];
        for (let offset = 0; ; offset += 100) {
          const { items } = await api.request<{ items: RemoteVisit[] }>(
            `/visits?limit=100&offset=${offset}`,
          );
          if (cancelled) return;
          all.push(
            ...items.map((v) => ({
              ...v,
              tripId: v.tripId ?? undefined,
              photos: [],
            })),
          );
          if (items.length < 100) break;
        }
        if (!cancelled) setMapHistory(all);
      } catch {
        if (!cancelled) setHistoryError(true);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCloud, demo, view, cloudStats?.visits]);
  const detailCountry = view === "country" ? selected?.code : undefined;
  useEffect(() => {
    if (!isCloud) return;
    let cancelled = false;
    const load = async () => {
      setLoadingCloud(true);
      try {
        const api = await cloudClient();
        const limit = view === "map" ? 5 : 20;
        const [rows, overview, totals] = await Promise.all([
          remoteVisits({
            limit,
            country: detailCountry,
            year: view === "timeline" ? year : undefined,
            allPhotos: view === "photos" || view === "country",
          }),
          remoteMap(),
          api.request<ReturnType<typeof summarize> & { years: string[] }>(
            "/stats",
          ),
        ]);
        if (!cancelled) {
          setCloudVisits(rows);
          setCloudMap(overview);
          setCloudStats(totals);
          setHasMore(rows.length === limit);
        }
      } catch {
        if (!cancelled)
          setNotice("旅の記録を読み込めませんでした。接続を確認してください。");
      } finally {
        if (!cancelled) setLoadingCloud(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 240000);
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [isCloud, view, detailCountry, year]);
  async function loadMore() {
    if (loadingCloud || !cloudVisits) return;
    setLoadingCloud(true);
    try {
      const rows = await remoteVisits({
        limit: 20,
        offset: cloudVisits.length,
        country: detailCountry,
        year: view === "timeline" ? year : undefined,
        allPhotos: view === "photos" || view === "country",
      });
      setCloudVisits((previous) => [...(previous ?? []), ...rows]);
      setHasMore(rows.length === 20);
    } catch {
      setNotice("続きを読み込めませんでした。");
    } finally {
      setLoadingCloud(false);
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  function navigate(next: View) {
    if (next !== "map") setMapUntil(null);
    if (next === "profile" || next === "settings") setDemo(false);
    setView(next);
    setMenu(false);
    setSearch("");
  }
  async function addVisit(visit: Visit, place: Place) {
    if (!archive)
      throw new Error(
        "保存領域の準備ができていません。再読み込みしてください。",
      );
    if (cloudVisits !== null) {
      const api = await cloudClient();
      await api.request("/places", {
        method: "POST",
        body: JSON.stringify(place),
      });
      setCloudPlaces((p) => [...p, place]);
      const { photos: _, ...input } = visit;
      await api.request("/visits", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await uploadPhotos(api, visit);
      setCloudVisits(await remoteVisits());
    } else {
      const next = {
        ...archive,
        visits: [visit, ...archive.visits],
        places: [
          ...(archive.places ?? []).filter((p) => p.id !== place.id),
          place,
        ],
      };
      await writeArchive(next);
      setArchive(next);
    }
    setDemo(false);
    setSelected(place);
    setView("map");
    setModal(null);
    setNotice(
      cloudVisits !== null
        ? "旅の思い出をアカウントに保存しました。"
        : "旅の思い出を、このブラウザに保存しました。",
    );
  }
  async function removeVisit(id: string) {
    if (demo) {
      setNotice(
        "サンプルの記録です。「場所を追加」から自分の旅を始めましょう。",
      );
      return;
    }
    if (!archive) return;
    try {
      if (cloudVisits !== null) {
        const api = await cloudClient();
        await api.request(`/visits/${id}`, { method: "DELETE" });
        setCloudVisits(cloudVisits.filter((v) => v.id !== id));
        setCloudMap(await remoteMap());
        setCloudStats(await api.request("/stats"));
        setNotice("記録を削除しました。");
        return;
      }
      const next = {
        ...archive,
        visits: archive.visits.filter((v) => v.id !== id),
      };
      await writeArchive(next);
      setArchive(next);
      setNotice("記録を削除しました。");
    } catch {
      setNotice("削除できませんでした。もう一度お試しください。");
    }
  }
  async function editMemory(visit: Visit) {
    if (demo) return;
    if (cloudVisits !== null) {
      await (await cloudClient()).request(`/memories/${visit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: visit.title, memo: visit.memo }),
      });
      setCloudVisits(cloudVisits.map((v) => (v.id === visit.id ? visit : v)));
    } else if (archive) {
      const next = {
        ...archive,
        visits: archive.visits.map((v) => (v.id === visit.id ? visit : v)),
      };
      await writeArchive(next);
      setArchive(next);
    }
    setNotice("思い出を更新しました。");
  }
  async function deletePhoto(visit: Visit, index: number) {
    if (demo || !window.confirm("この写真を削除しますか？")) return;
    try {
      if (cloudVisits !== null) {
        const id = visit.photoIds?.[index];
        if (!id) throw new Error();
        await (await cloudClient()).request(`/photos/${id}`, {
          method: "DELETE",
        });
        setCloudVisits(
          cloudVisits.map((v) =>
            v.id === visit.id
              ? {
                  ...v,
                  photos: v.photos.filter((_, i) => i !== index),
                  photoIds: v.photoIds?.filter((_, i) => i !== index),
                }
              : v,
          ),
        );
        setCloudMap(await remoteMap());
        setCloudStats(await (await cloudClient()).request("/stats"));
      } else if (archive) {
        const next = {
          ...archive,
          visits: archive.visits.map((v) =>
            v.id === visit.id
              ? { ...v, photos: v.photos.filter((_, i) => i !== index) }
              : v,
          ),
        };
        await writeArchive(next);
        setArchive(next);
      }
      setNotice("写真を削除しました。");
    } catch {
      setNotice("写真を削除できませんでした。");
    }
  }
  function exportArchive() {
    if (!archive) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-travel-archive.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("このブラウザの旅データを書き出しました。");
  }
  const sorted = [...visits]
    .filter(
      (v) => view !== "timeline" || year === "all" || v.date.startsWith(year),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const timelineVisits = sorted.filter((visit) => {
    const place = places.find((p) => p.id === visit.placeId);
    return `${visit.title} ${visit.memo} ${place?.name ?? ""} ${place?.country ?? ""}`
      .normalize("NFKC")
      .toLocaleLowerCase()
      .includes(memoryQuery.trim().normalize("NFKC").toLocaleLowerCase());
  });
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a href="/" className="brand">
          <div className="brand-mark">
            <Mountain size={38} strokeWidth={1.5} />
            <Mountain size={25} strokeWidth={1.8} />
          </div>
          <span>
            tomokichi-diary<small>旅した場所が、わたしをつくる。</small>
          </span>
        </a>
        <div className="workspace-label">MY TRAVEL ARCHIVE</div>
        <nav aria-label="メインナビゲーション">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-line" />
          <p>
            あの景色が、
            <br />
            きっと、どこかで
            <br />
            また会いにいこう。
          </p>
          <span className="handwritten">
            More Places,
            <br />A Kinder You.
          </span>
          <Mountain size={122} strokeWidth={0.65} />
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={() => navigate("settings")}
            className={view === "settings" ? "active" : ""}
          >
            <Settings size={18} />
            設定
          </button>
          <button className="account" onClick={() => navigate("profile")}>
            <span className="avatar">
              <UserRound size={20} />
            </span>
            <span>
              {userName}
              <small>あなたの旅を、ここから。</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="メニュー"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            マイアーカイブ <span>/</span>{" "}
            <strong>
              {view === "country"
                ? "国の詳細"
                : view === "profile"
                  ? "プロフィール"
                  : view === "settings"
                    ? "設定"
                    : nav.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <span className="private">
              <LockKeyhole size={13} />
              {demo ? "サンプルを閲覧中" : "自分だけの旅の記録"}
            </span>
            <button className="save-button" onClick={() => setModal("save")}>
              <ArrowDownToLine size={15} />
              地図を保存
            </button>
            <button
              className="avatar"
              aria-label="プロフィール"
              onClick={() => navigate("profile")}
            >
              <UserRound size={19} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "map"
                  ? "YOUR WORLD, YOUR STORIES"
                  : "COLLECT MOMENTS, KEEP MEMORIES"}
              </div>
              <h1>
                {view === "map"
                  ? "わたしが見てきた、世界。"
                  : view === "timeline"
                    ? "旅の記録を、たどる。"
                    : view === "photos"
                      ? "心が動いた、その瞬間。"
                      : view === "stats"
                        ? "少しずつ、広がる世界。"
                        : view === "profile"
                          ? "旅した場所が、わたしをつくる。"
                          : view === "country"
                            ? `${selected?.country}の思い出`
                            : "あなたの旅を、大切に。"}
              </h1>
              <p>
                {view === "map"
                  ? "写真と、ことばと、地図でつづる。あなただけの旅のアーカイブ。"
                  : "ひとつひとつの景色が、あなたの物語になる。"}
              </p>
            </div>
            <button
              className="primary add-main"
              onClick={() => setModal("add")}
            >
              <Plus size={18} />
              場所を追加
            </button>
          </section>
          {!["profile", "settings"].includes(view) && (
            <div className="archive-toolbar">
              <div className="mode-switch">
                <button
                  className={demo ? "active" : ""}
                  onClick={() => {
                    setDemo(true);
                    setMemoryQuery("");
                    setYear("all");
                    setSearch("");
                    if (view === "country") setView("map");
                    setSelected(starterPlaces[0]);
                  }}
                >
                  サンプルの旅
                </button>
                <button
                  className={!demo ? "active" : ""}
                  onClick={() => {
                    setDemo(false);
                    setMemoryQuery("");
                    setYear("all");
                    setSearch("");
                    if (view === "country") setView("map");
                    setSelected(
                      (cloudVisits ?? archive?.visits)?.length
                        ? (places.find(
                            (p) =>
                              p.id ===
                              (cloudVisits ?? archive?.visits)?.[0].placeId,
                          ) ?? null)
                        : null,
                    );
                  }}
                >
                  自分の旅{" "}
                  <span>
                    {cloudStats?.visits ??
                      cloudVisits?.length ??
                      archive?.visits.length ??
                      0}
                  </span>
                </button>
              </div>
              <span className="local-status">
                <span />
                {demo
                  ? "サンプルを見ながら、旅のイメージを。"
                  : cloudVisits !== null
                    ? "アカウントに保存済み"
                    : "このブラウザに自動保存"}{" "}
              </span>
            </div>
          )}
          {view === "map" && (
            <ArchiveHighlights
              visits={visits}
              places={places}
              stats={stats}
              demo={demo}
              onAdd={() => setModal("add")}
              onPlace={(place) => {
                setSelected(place);
                navigate("country");
              }}
            />
          )}
          {view === "timeline" && (
            <div className="mode-switch timeline-mode">
              <button
                className={timelineMode === "time" ? "active" : ""}
                onClick={() => setTimelineMode("time")}
              >
                時系列で見る
              </button>
              <button
                className={timelineMode === "trip" ? "active" : ""}
                onClick={() => setTimelineMode("trip")}
              >
                旅ごとに見る
              </button>
            </div>
          )}
          {view === "timeline" && timelineMode === "trip" && (
            <TripDetails
              cloud={!demo && isCloud}
              trips={demo ? [] : (archive?.trips ?? [])}
              visits={visits}
              places={displayPlaces}
              onPlace={(p) => {
                setSelected(p);
                navigate("country");
              }}
            />
          )}
          {view === "map" && (
            <>
              <section
                className={`world-card ${selected ? "" : "map-expanded"}`}
                aria-label="旅の世界地図"
              >
                <WorldMap
                  places={displayPlaces}
                  visits={visibleMapVisits}
                  selected={selected}
                  onSelect={setSelected}
                />
                <div className="map-top">
                  <div className="map-title">
                    <Globe2 size={17} />
                    <span>
                      {demo ? "サンプルの世界地図" : "わたしの世界地図"}
                    </span>
                    <span className="tiny-pill">
                      {visibleMapStats.countries}か国
                    </span>
                  </div>
                  <div className="search-wrap">
                    <Search size={17} />
                    <input
                      aria-label="地図の場所を検索"
                      placeholder="国・都市・場所を検索…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <div className="search-results">
                        {places
                          .filter((p) => (p.country + p.name).includes(search))
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelected(p);
                                setSearch("");
                              }}
                            >
                              {p.flag} {p.name}
                              <small>{p.country}</small>
                            </button>
                          ))}
                        {!places.some((p) =>
                          (p.country + p.name).includes(search),
                        ) && <p>該当する場所はありません。</p>}
                      </div>
                    )}
                  </div>
                </div>
                {selected && (
                  <aside className="country-preview">
                    <div className="preview-image">
                      <img
                        src={
                          selectedVisits[0]?.photos[0] ||
                          visibleMapVisits.find(
                            (v) => v.placeId === selected.id,
                          )?.photos[0] ||
                          placeImage(selected)
                        }
                        alt={selected.name}
                      />
                      <span className="image-tag">
                        <MapPin size={11} />
                        {selected.name}
                      </span>
                      <button
                        className="close-preview"
                        aria-label="国のプレビューを閉じる"
                        onClick={() => setSelected(null)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="preview-body">
                      <div className="country-name">
                        <div>
                          <h2>{selected.country}</h2>
                          <small>
                            {new Intl.DisplayNames(["en"], {
                              type: "region",
                            }).of(selected.code)}
                          </small>
                        </div>
                        <span>{selected.flag}</span>
                      </div>
                      <p>{selected.description}</p>
                      <div className="mini-stats">
                        <div>
                          <MapPin size={13} />
                          <span>訪問回数</span>
                          <strong>
                            {countrySummary?.visits ?? countryVisits.length}
                          </strong>
                        </div>
                        <div>
                          <MapIcon size={13} />
                          <span>都市</span>
                          <strong>
                            {new Set(countryVisits.map((v) => v.placeId)).size}
                          </strong>
                        </div>
                        <div>
                          <Camera size={13} />
                          <span>写真</span>
                          <strong>
                            {countryVisits.reduce(
                              (n, v) => n + v.photos.length,
                              0,
                            )}
                          </strong>
                        </div>
                      </div>
                      <button
                        className="primary full"
                        onClick={() => navigate("country")}
                      >
                        この国の思い出を見る
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </aside>
                )}
                <div className="map-bottom-note">
                  <span className="legend-dot" /> 訪れた国{" "}
                  <span className="legend-photo" /> 旅の写真
                </div>
                <span className="map-script">Every place has a story.</span>
              </section>
              <MapTimeSlider
                key={`${demo ? "sample" : "own"}-${history.length}`}
                dates={mapDates}
                loading={!demo && historyLoading}
                error={!demo && historyError}
                onChange={(date) => {
                  setMapUntil(date);
                  setSelected(null);
                }}
              />
              <section className="recent-section">
                <div className="section-heading">
                  <h2>
                    <BookOpen size={18} />
                    最近の旅の記録 <span>RECENT MEMORIES</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => navigate("timeline")}
                  >
                    すべて見る
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="recent-grid">
                  {sorted.slice(0, 5).map((v) => {
                    const p = places.find((p) => p.id === v.placeId);
                    if (!p) return null;
                    return (
                      <button
                        key={v.id}
                        className="travel-card"
                        onClick={() => {
                          setSelected(p);
                          navigate("country");
                        }}
                      >
                        <div className="travel-image">
                          <img
                            src={v.photos[0] || placeImage(p)}
                            alt={p.name}
                          />
                          <span>
                            {p.flag} {p.country}
                          </span>
                        </div>
                        <div className="travel-caption">
                          <h3>{p.name}</h3>
                          <time>{v.date.replaceAll("-", ".")}</time>
                        </div>
                        <p>{v.title || "旅の思い出"}</p>
                      </button>
                    );
                  })}
                  {!visits.length && (
                    <div className="empty-inline">
                      まだ旅の記録はありません。思い出の場所から始めましょう。
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          {view === "timeline" && timelineMode === "time" && (
            <section className="content-panel">
              <div className="section-heading">
                <h2>旅のタイムライン</h2>
                <label className="filter">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="年で絞り込む"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="all">すべての年</option>
                    {[
                      ...new Set(
                        !demo && cloudStats
                          ? cloudStats.years
                          : visits.map((v) => v.date.slice(0, 4)),
                      ),
                    ]
                      .sort()
                      .reverse()
                      .map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="album-search timeline-search">
                <Search size={17} />
                <input
                  aria-label="旅の記録を検索"
                  placeholder="場所・タイトル・メモで探す"
                  value={memoryQuery}
                  onChange={(event) => setMemoryQuery(event.target.value)}
                />
              </label>
              {memoryQuery && (
                <div className="album-results">
                  <span role="status">
                    {timelineVisits.length}件の記録
                    {!demo && hasMore && "（読み込み済みの記録から）"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setMemoryQuery("")}
                  >
                    検索をクリア
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="timeline">
                {timelineVisits.map((v, i) => {
                  const p = places.find((p) => p.id === v.placeId);
                  if (!p) return null;
                  return (
                    <div key={v.id}>
                      {(i === 0 ||
                        timelineVisits[i - 1].date.slice(0, 4) !==
                          v.date.slice(0, 4)) && (
                        <h2 className="timeline-year">{v.date.slice(0, 4)}</h2>
                      )}
                      <button
                        className="timeline-row"
                        onClick={() => {
                          setSelected(p);
                          navigate("country");
                        }}
                      >
                        <time>{v.date.slice(5).replace("-", " / ")}</time>
                        <div>
                          <span>
                            {p.flag} {p.country} · {p.name}
                          </span>
                          <h3>{v.title || "旅の思い出"}</h3>
                          <p>{v.memo}</p>
                        </div>
                        <img src={v.photos[0] || placeImage(p)} alt={p.name} />
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {!timelineVisits.length &&
                (memoryQuery || year !== "all" ? (
                  <div className="empty">
                    <Search size={30} />
                    <h3>条件に合う思い出が見つかりませんでした。</h3>
                    <p>検索することばや年を変えてみてください。</p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setMemoryQuery("");
                        setYear("all");
                      }}
                    >
                      すべての記録を見る
                    </button>
                  </div>
                ) : (
                  <Empty onAdd={() => setModal("add")} />
                ))}
            </section>
          )}
          {view === "photos" && (
            <PhotoAlbum
              key={demo ? "demo" : "own"}
              visits={visits}
              places={places}
              partial={!demo && hasMore}
              onAdd={() => setModal("add")}
              onPlace={(place) => {
                setSelected(place);
                navigate("country");
              }}
            />
          )}
          {view === "stats" && (
            <section className="content-panel">
              <div className="stats-banner">
                <Globe2 size={48} strokeWidth={1} />
                <h2>ひとつの旅が、世界を広げる。</h2>
                <p>これまでの旅の足あとを、数字で振り返って。</p>
              </div>
              <div className="stats-grid">
                {[
                  ["訪れた国", stats.countries, "COUNTRIES"],
                  ["訪れた場所", stats.places, "PLACES"],
                  ["訪問回数", stats.visits, "VISITS"],
                  ["旅の写真", stats.photos, "PHOTOS"],
                  ["思い出", stats.memories, "MEMORIES"],
                  ["まとめた旅", stats.trips, "TRIPS"],
                ].map(([label, value, en]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{en}</small>
                  </div>
                ))}
              </div>
              <div className="country-chips">
                {places
                  .filter((p) => visits.some((v) => v.placeId === p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p);
                        navigate("country");
                      }}
                    >
                      {p.flag} {p.country}
                      <ArrowRight size={14} />
                    </button>
                  ))}
              </div>
            </section>
          )}
          {view === "country" && selected && (
            <section className="country-detail content-panel">
              <button
                className="text-button back"
                onClick={() => navigate("map")}
              >
                <ArrowLeft size={16} />
                世界地図に戻る
              </button>
              <div className="country-hero">
                <img
                  src={
                    selectedVisits[0]?.photos[0] ||
                    mapVisits.find((v) => v.placeId === selected.id)
                      ?.photos[0] ||
                    placeImage(selected)
                  }
                  alt={selected.name}
                />
                <div>
                  <span>THE PLACES WE KEEP</span>
                  <h2>
                    {selected.country} {selected.flag}
                  </h2>
                  <p>{selected.description}</p>
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  旅の記録 <span>{countryVisits.length} VISITS</span>
                </h2>
                <button className="text-button" onClick={() => setModal("add")}>
                  <Plus size={16} />
                  この場所の思い出を追加
                </button>
              </div>
              {countryVisits.map((v) => (
                <article className="memory-entry" key={v.id}>
                  <img
                    src={v.photos[0] || placeImage(selected)}
                    alt={selected.name}
                  />
                  <div>
                    <time>
                      <CalendarDays size={13} />
                      {v.date.replaceAll("-", ".")}
                    </time>
                    <h3>{v.title || selected.name}</h3>
                    <p>{v.memo || "この景色を、ずっと。"}</p>
                    {!demo && (
                      <button
                        className="text-button"
                        onClick={() => setEditing(v)}
                      >
                        <Pencil size={13} />
                        思い出を編集
                      </button>
                    )}
                    {!demo && (
                      <div className="photo-edit-strip">
                        {v.photos.map((src, index) => (
                          <div key={src}>
                            <img src={src} alt={`写真 ${index + 1}`} />
                            <button
                              className="icon-button"
                              aria-label={`写真 ${index + 1}を削除`}
                              onClick={() => void deletePhoto(v, index)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="memory-thumbs">
                      {v.photos.slice(1).map((src, i) => (
                        <img
                          key={`${v.id}-${i}`}
                          src={src}
                          alt={`旅の写真 ${i + 2}`}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    className="icon-button delete"
                    aria-label="記録を削除"
                    onClick={() => {
                      if (
                        demo ||
                        window.confirm("この旅の記録と写真を削除しますか？")
                      )
                        void removeVisit(v.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
              {!countryVisits.length && <Empty onAdd={() => setModal("add")} />}
            </section>
          )}
          {view === "profile" && (
            <section className="content-panel profile">
              <div
                className="profile-cover"
                style={{
                  backgroundImage: ownVisits[0]?.photos[0]
                    ? `url(${ownVisits[0].photos[0]})`
                    : "linear-gradient(135deg, #d6eaf0, #d8dfca)",
                }}
              />
              <div className="profile-avatar">
                <UserRound size={40} />
              </div>
              <h2>{userName}</h2>
              <p>
                見たことのない景色を、まだ見に行きたい。
                <br />
                旅を通して、少しずつ、やさしい自分になっていく。
              </p>
              <div className="profile-stats">
                <span>
                  <strong>{ownStats.countries}</strong>訪れた国
                </span>
                <span>
                  <strong>{ownStats.places}</strong>訪れた場所
                </span>
                <span>
                  <strong>{ownStats.photos}</strong>写真
                </span>
              </div>
              <div className="privacy-box">
                <ShieldCheck size={24} />
                <div>
                  <h3>このアーカイブは非公開です</h3>
                  <p>
                    旅の記録は、あなただけのもの。公開プロフィールはアカウント連携後に設定できます。
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("save")}>
                  アカウントに保存
                </button>
              </div>
            </section>
          )}
          {view === "settings" && (
            <section className="content-panel settings">
              <h2>アカウントとプライバシー</h2>
              {cloudVisits === null && archive && (
                <GuestTrips
                  archive={archive}
                  onSave={async (next) => {
                    await writeArchive(next);
                    setArchive(next);
                    setNotice("旅のまとまりを保存しました。");
                  }}
                />
              )}
              {cloudVisits !== null && (
                <CloudSettings
                  name={userName}
                  onName={setUserName}
                  visits={cloudVisits}
                  onVisits={setCloudVisits}
                />
              )}
              <div className="setting-row">
                <div>
                  <h3>
                    <LockKeyhole size={17} />
                    非公開のアーカイブ
                  </h3>
                  <p>正確な場所・日付・写真・メモは公開されません。</p>
                </div>
                <span className="status-badge">非公開</span>
              </div>
              <div className="setting-row">
                <div>
                  <h3>保存先</h3>
                  <p>
                    {cloudVisits !== null
                      ? "自分の記録は、アカウントに非公開で保存されています。"
                      : "自分の記録は、このブラウザに保存されています。"}
                  </p>
                </div>
                <button className="secondary" onClick={() => setModal("save")}>
                  アカウントに保存
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <h3>ブラウザのデータを書き出す</h3>
                  <p>
                    このブラウザに残っている記録と写真を JSON
                    でダウンロードします。
                  </p>
                </div>
                <button className="secondary" onClick={exportArchive}>
                  <ArrowDownToLine size={15} />
                  エクスポート
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <h3>このブラウザの記録を削除</h3>
                  <p>
                    自分で追加した記録と写真をすべて削除します。元に戻せません。
                  </p>
                </div>
                <button
                  className="danger"
                  onClick={async () => {
                    if (
                      !archive ||
                      !window.confirm(
                        "このブラウザに保存した旅の記録をすべて削除しますか？",
                      )
                    )
                      return;
                    try {
                      const next: Archive = {
                        version: 1,
                        importKey: crypto.randomUUID(),
                        visits: [],
                      };
                      await writeArchive(next);
                      setArchive(next);
                      setDemo(false);
                      setSelected(null);
                      setNotice("このブラウザの記録を削除しました。");
                    } catch {
                      setNotice("削除できませんでした。");
                    }
                  }}
                >
                  すべて削除
                </button>
              </div>
            </section>
          )}
          {!demo &&
            isCloud &&
            ["timeline", "photos", "country"].includes(view) &&
            hasMore && (
              <div className="load-more">
                <button
                  className="secondary"
                  disabled={loadingCloud}
                  onClick={() => void loadMore()}
                >
                  {loadingCloud ? "読み込み中…" : "もう少し、旅をたどる"}
                  <ArrowDownToLine size={15} />
                </button>
              </div>
            )}
          <footer className="page-footer">
            <span>
              <Mountain size={16} />
              Every journey becomes a part of you.
            </span>
            <span>
              <LockKeyhole size={11} />
              Private by default <span className="footer-dot">·</span> Made for
              your memories
            </span>
          </footer>
        </div>
      </main>
      <nav className="bottom-nav" aria-label="モバイルナビゲーション">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
      {editing && (
        <EditMemory
          visit={editing}
          onClose={() => setEditing(null)}
          onSave={editMemory}
        />
      )}
      {modal === "add" && (
        <AddMemory
          initial={demo ? null : selected}
          onClose={() => setModal(null)}
          onSave={addVisit}
          allPlaces={places}
        />
      )}
      {modal === "save" && (
        <Dialog title="あなたの世界を、ずっと。" onClose={() => setModal(null)}>
          <div
            className="save-illustration"
            style={{ backgroundImage: `url(${starterPlaces[0].image})` }}
          >
            <Mountain size={45} />
            <span>More Places, A Kinder You.</span>
          </div>
          <p className="dialog-intro">
            アカウントを作成して、
            <br />
            あなたの旅の地図を保存しましょう。
          </p>
          <p className="save-scope">
            保存対象は「自分の旅」の{archive?.visits.length ?? 0}
            件です。サンプルの旅は含まれません。
          </p>
          <CloudSave archive={archive} />
          <small className="save-footnote">
            ブラウザのデータを消すと、記録も削除されます。
            <br />
            設定からバックアップを書き出せます。
          </small>
          <button
            className="text-button centered"
            onClick={() => {
              setModal(null);
              navigate("settings");
            }}
          >
            バックアップを保存する
            <ArrowRight size={15} />
          </button>
        </Dialog>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty">
      <MapPin size={34} strokeWidth={1} />
      <h3>まだ白紙の、あなたの物語。</h3>
      <p>心に残っている旅を、ひとつ記録してみませんか。</p>
      <button className="primary" onClick={onAdd}>
        <Plus size={16} />
        思い出を追加
      </button>
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function AddMemory({
  initial,
  onClose,
  onSave,
  allPlaces,
}: {
  allPlaces: Place[];
  initial: Place | null;
  onClose: () => void;
  onSave: (v: Visit, p: Place) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [countryOnly, setCountryOnly] = useState(initial?.kind === "country");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const places = [...allPlaces, ...results];
  const [visitId] = useState(() => crypto.randomUUID());
  async function searchWorld() {
    setSearching(true);
    setError("");
    try {
      setResults(await new PhotonPlaceProvider().search(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "検索できませんでした。");
    } finally {
      setSearching(false);
    }
  }

  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<Place | null>(initial);
  const [photos, setPhotos] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function upload(files: FileList | null) {
    if (!files) return;
    setError("");
    if (photos.length + files.length > 10) {
      setError("写真は10枚まで追加できます。");
      return;
    }
    setBusy(true);
    try {
      const images = await Promise.all(Array.from(files).map(preparePhoto));
      setPhotos((p) => [...p, ...images]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "写真を読み込めませんでした。");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <Dialog
      title={
        step === 1 ? "場所を追加" : step === 2 ? "写真を追加" : "思い出を残す"
      }
      onClose={onClose}
    >
      <div className="steps">
        {["場所", "写真", "思い出"].map((s, i) => (
          <div key={s} className={step >= i + 1 ? "active" : ""}>
            <span>{step > i + 1 ? <Check size={12} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      {step === 1 && (
        <>
          <p className="dialog-intro">どこで、心が動きましたか？</p>
          <div className="mode-switch place-mode">
            <button
              className={!countryOnly ? "active" : ""}
              onClick={() => setCountryOnly(false)}
            >
              都市・スポット
            </button>
            <button
              className={countryOnly ? "active" : ""}
              onClick={() => setCountryOnly(true)}
            >
              国だけを記録
            </button>
          </div>
          <div className="place-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="訪問した場所を検索"
              placeholder="国・都市・場所を検索…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query.trim().length >= 2 && (
            <button
              className="text-button world-search"
              disabled={searching}
              onClick={() => void searchWorld()}
            >
              <Globe2 size={15} />
              {searching ? "検索しています…" : "世界の場所を検索"}
            </button>
          )}
          {results.length > 0 && (
            <small className="search-attribution">
              検索：Photon · © OpenStreetMap contributors
            </small>
          )}
          <div className="place-options">
            {places
              .filter((p) =>
                countryOnly ? p.kind === "country" : p.kind !== "country",
              )
              .filter((p) => (p.country + p.name).includes(query))
              .map((p) => (
                <button
                  key={p.id}
                  className={place?.id === p.id ? "selected" : ""}
                  onClick={() => setPlace(p)}
                >
                  <img src={p.image} alt="" />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.flag} {p.country}
                    </small>
                  </span>
                  {place?.id === p.id ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              ))}
            {!places.some((p) => (p.country + p.name).includes(query)) && (
              <p className="search-hint">
                見つからないときは、世界の場所を検索できます。
              </p>
            )}
          </div>
          <button
            className="primary full"
            disabled={!place}
            onClick={() => setStep(2)}
          >
            この場所を追加
            <ArrowRight size={16} />
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <p className="dialog-intro">あの日の景色を、地図の上に。</p>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void upload(e.target.files)}
          />
          <button
            className="upload-zone"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) void upload(e.dataTransfer.files);
            }}
          >
            <UploadCloud size={34} strokeWidth={1.3} />
            <strong>
              {busy ? "写真を読み込み中…" : "写真をドラッグ＆ドロップ"}
            </strong>
            <span>またはクリックして選択</span>
            <small>JPG / PNG / WebP ・ 最大10枚、1枚20MB</small>
          </button>
          <div className="upload-previews">
            {photos.map((src, i) => (
              <div key={src.slice(-40) + i}>
                <img src={src} alt={`追加する写真 ${i + 1}`} />
                <button
                  aria-label={`写真 ${i + 1}を削除`}
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={15} />
              戻る
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => setStep(3)}
            >
              {photos.length ? "思い出を書く" : "写真なしで続ける"}
              <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!place) return;
            setBusy(true);
            setError("");
            try {
              await onSave(
                {
                  id: visitId,
                  placeId: place.id,
                  date,
                  title: title.trim(),
                  memo: memo.trim(),
                  photos,
                },
                place,
              );
            } catch {
              setError(
                "保存できませんでした。接続状況とブラウザの空き容量を確認して再試行してください。",
              );
              setBusy(false);
            }
          }}
        >
          <div className="memory-form-image">
            <img
              src={photos[0] || "/place-placeholder.svg"}
              alt={place?.name}
            />
            <span>
              {place?.flag} {place?.name}
            </span>
          </div>
          <label className="form-label">
            日付
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="form-label">
            タイトル <small>（任意）</small>
            <input
              maxLength={100}
              placeholder="この旅を、ひとことで。"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="form-label">
            メモ <small>（任意）</small>
            <textarea
              maxLength={500}
              placeholder="見た景色、感じたこと。また行きたい場所。"
              rows={4}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <span className="character-count">{memo.length}/500</span>
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={15} />
              戻る
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "保存しています…" : "この思い出を保存"}
              <Check size={15} />
            </button>
          </div>
          <small className="local-hint">
            <LockKeyhole size={11} /> このブラウザに非公開で保存します
          </small>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
