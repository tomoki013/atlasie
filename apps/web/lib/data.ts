import type { Place, Visit } from "../../../packages/domain/src";

import countries from "./country-catalog.json" with { type: "json" };

export type { Place, Visit };

const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;
export const places: Place[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "サントリーニ島",
    country: "ギリシャ",
    code: "GR",
    flag: "🇬🇷",
    coordinates: [25.46, 36.39],
    image: photo("photo-1613395877344-13d4a8e0d49e"),
    description: "青い海と白い街。何度訪れても、新しい発見がある特別な場所。",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "パリ",
    country: "フランス",
    code: "FR",
    flag: "🇫🇷",
    coordinates: [2.35, 48.85],
    image: photo("photo-1502602898657-3e91760cbb34"),
    description: "路地を歩けば、映画のワンシーンに出会える街。",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "ローマ",
    country: "イタリア",
    code: "IT",
    flag: "🇮🇹",
    coordinates: [12.49, 41.9],
    image: photo("photo-1552832230-c0197dd311b5"),
    description: "歴史が息づく、美しい街。またいつか、あの石畳を歩きたい。",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "京都",
    country: "日本",
    code: "JP",
    flag: "🇯🇵",
    coordinates: [135.77, 35.01],
    image: photo("photo-1493976040374-85c8e12f0c0e"),
    description: "朱色の鳥居、静かな庭。季節ごとに、新しい表情を見せる古都。",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "バンフ",
    country: "カナダ",
    code: "CA",
    flag: "🇨🇦",
    coordinates: [-115.57, 51.18],
    image: photo("photo-1519681393784-d120267933ba"),
    description: "澄んだ湖と、どこまでも続く山々。深呼吸したくなる景色。",
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    name: "シドニー",
    country: "オーストラリア",
    code: "AU",
    flag: "🇦🇺",
    coordinates: [151.21, -33.87],
    image: photo("photo-1506973035872-a4ec16b8e8d9"),
    description: "海風に誘われて、港沿いをゆっくり歩く。",
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    name: "ニューヨーク",
    country: "アメリカ",
    code: "US",
    flag: "🇺🇸",
    coordinates: [-74, 40.71],
    image: photo("photo-1485871981521-5b1fd3805eee"),
    description: "見上げるたび、心が動く。眠らない街の小さな思い出。",
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    name: "リオデジャネイロ",
    country: "ブラジル",
    code: "BR",
    flag: "🇧🇷",
    coordinates: [-43.17, -22.91],
    image: photo("photo-1483729558449-99ef09a8c325"),
    description: "緑の山と青い海、陽気なリズムに包まれて。",
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    name: "ケープタウン",
    country: "南アフリカ",
    code: "ZA",
    flag: "🇿🇦",
    coordinates: [18.42, -33.92],
    image: photo("photo-1580060839134-75a5edca2e99"),
    description: "大地と海が出会う場所。忘れられない夕暮れ。",
  },
];
export const countryPlaces: Place[] = countries.map((p) => ({
  ...p,
  kind: "country",
  coordinates: [p.coordinates[0], p.coordinates[1]],
}));
export const demoVisits: Visit[] = places.slice(0, 6).map((p, i) => ({
  id: `demo-${i}`,
  placeId: p.id,
  date: [
    "2024-09-14",
    "2024-08-20",
    "2024-06-12",
    "2024-10-08",
    "2024-03-21",
    "2023-12-04",
  ][i],
  title: [
    "青い海と白い街で見つけた幸せ",
    "街角が、アートだった。",
    "歴史と美食の旅。",
    "秋色の京都を歩く",
    "湖に映る、もうひとつの世界",
    "青い空と海、最高の夏だった。",
  ][i],
  memo:
    i === 0
      ? "初めてのサントリーニ島。\nどこを切り取っても絵になる景色に、ずっと心が躍っていた。\nまた、絶対に来たい。"
      : "歩いて、立ち止まって、心に残った景色。",
  photos: [p.image],
}));
