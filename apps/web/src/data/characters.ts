export interface CharacterGrowthNode {
  id: string;
  position: string;
  name: string;
  description: string;
  aliases?: string[];
}

export interface CharacterSummary {
  id: string;
  name: string;
  title: string;
  theme: string;
  overview: string;
  difficulty?: "easy" | "normal" | "hard";
  growthNodes?: CharacterGrowthNode[];
}

export const CHARACTER_CATALOG: CharacterSummary[] = [
  {
    id: "shirogami-yuu",
    name: "白神 幽",
    title: "幻燈の観察者",
    theme: "他者の行動を利用して得点を伸ばす妨害型キャラクター",
    overview:
      "他プレイヤーが自分のレンズを起動するとボーナスを得るなど、受動的なトリガーでVPを稼ぐタイプ。序盤のマイナスVPを取り返す判断が鍵。",
    difficulty: "hard",
    growthNodes: [
      {
        id: "shirogami-yuu:s",
        position: "S",
        name: "呪われた契約",
        description:
          "ゲーム終了時に−10VP。【意思】創造力-2で淀み+1 / 光+1 / 虹+1 を獲得。",
        aliases: ["S", "start"],
      },
      {
        id: "shirogami-yuu:1",
        position: "①",
        name: "束縛の緩和",
        description: "ゲーム終了時のペナルティが−5VPまで軽減される。",
        aliases: ["①", "1"],
      },
      {
        id: "shirogami-yuu:2",
        position: "②",
        name: "矛盾の共鳴",
        description:
          "自分のレンズを自分で起動し、素材と報酬が一致しない場合に+2VP。",
        aliases: ["②", "2"],
      },
      {
        id: "shirogami-yuu:3",
        position: "③",
        name: "他者起動の祝福",
        description: "他プレイヤーが自分のレンズを起動するたびに+3VP。",
        aliases: ["③", "3"],
      },
      {
        id: "shirogami-yuu:4",
        position: "④",
        name: "更なる代償",
        description: "ゲーム終了時に追加で−10VPを受ける。",
        aliases: ["④", "4"],
      },
      {
        id: "shirogami-yuu:5",
        position: "⑤",
        name: "強制徴収",
        description:
          "他プレイヤー全員から光1・虹1を奪い、各プレイヤーのロビーを1体戻させる。",
        aliases: ["⑤", "5"],
      },
      {
        id: "shirogami-yuu:6",
        position: "⑥",
        name: "意思：終焉の決意",
        description: "【意思】創造力-3で+13VPを獲得する。",
        aliases: ["⑥", "6"],
      },
      {
        id: "shirogami-yuu:7",
        position: "⑦",
        name: "ロビーの加護",
        description: "ゲーム終了時、ロビー1体につき+3VPを得る。",
        aliases: ["⑦", "7"],
      },
      {
        id: "shirogami-yuu:8",
        position: "⑧",
        name: "無垢なる証明",
        description: "光と虹を一切持っていなければ+20VP。",
        aliases: ["⑧", "8"],
      },
      {
        id: "shirogami-yuu:9",
        position: "⑨",
        name: "罪過の浄化",
        description: "ゲーム終了時、マイナス換算されるVPをすべてプラスに変換する。",
        aliases: ["⑨", "9"],
      },
    ],
  },
  {
    id: "akito-daidou",
    name: "橙堂 アキラ",
    title: "共鳴する調停者",
    theme: "交渉と説得でリソースをやり取りしながらバランスを取る外交型",
    overview:
      "説得（交渉）アクションを強化し、他プレイヤーとの協力で追加VPや資源を得る。常にテーブル全体の状況を見極める必要がある。",
    difficulty: "normal",
    growthNodes: [
      {
        id: "akito-daidou:s",
        position: "S",
        name: "共振の契約",
        description: "他プレイヤーのレンズを起動するたびに+2VP。",
        aliases: ["S", "start"],
      },
      {
        id: "akito-daidou:1",
        position: "①",
        name: "交渉術の研磨",
        description: "説得アクションに必要な行動力が1少なくなる。",
        aliases: ["①", "1"],
      },
      {
        id: "akito-daidou:2",
        position: "②",
        name: "交渉の達人",
        description: "これ以上成長できない。ゲーム終了時に+10VP。",
        aliases: ["②", "2"],
      },
      {
        id: "akito-daidou:3",
        position: "③",
        name: "受動的交渉",
        description: "他者が自分に説得を行うたびに+2VPし、淀み+1を得る。",
        aliases: ["③", "3"],
      },
      {
        id: "akito-daidou:4",
        position: "④",
        name: "調停の分岐",
        description: "効果なし。成長経路を拡張するだけのノード。",
        aliases: ["④", "4"],
      },
      {
        id: "akito-daidou:5",
        position: "⑤",
        name: "能動的交渉",
        description: "自分が他者に説得を行うたびに+2VP。",
        aliases: ["⑤", "5"],
      },
      {
        id: "akito-daidou:6",
        position: "⑥",
        name: "静寂の枝",
        description: "効果なし。経路用ノード。",
        aliases: ["⑥", "6"],
      },
      {
        id: "akito-daidou:7",
        position: "⑦",
        name: "意思：共鳴介入",
        description:
          "【意思】創造力-1。相手プレイヤーのレンズに限り、説得または再起動を追加で1回行える。",
        aliases: ["⑦", "7"],
      },
      {
        id: "akito-daidou:8",
        position: "⑧",
        name: "静穏の枝",
        description: "効果なし。終盤への接続ノード。",
        aliases: ["⑧", "8"],
      },
      {
        id: "akito-daidou:9",
        position: "⑨",
        name: "審判の共鳴",
        description: "ゲーム終了時、獲得VPが1.5倍（端数切り上げ）になる。",
        aliases: ["⑨", "9"],
      },
    ],
  },
  {
    id: "kazari-hizumi",
    name: "黄昏 灯純",
    title: "光彩の錬成者",
    theme: "光・虹・淀みのバランス管理で高得点を狙う資源管理型",
    overview:
      "各資源の上限拡張や換算ボーナスを持ち、リソースマネジメントに長ける。終盤に向けてきれいに資源を整えるほど伸びる。",
    difficulty: "easy",
    growthNodes: [
      {
        id: "kazari-hizumi:s",
        position: "S",
        name: "調合の選択",
        description:
          "ロビー生成時に淀み-1光+1 または 光-1虹+1 を選択できる。【意思】創造力-2で追加成長。",
        aliases: ["S", "start"],
      },
      {
        id: "kazari-hizumi:1",
        position: "①",
        name: "淀みの収集家",
        description: "各ラウンド終了時、手元の淀み1個につき+1VP。",
        aliases: ["①", "1"],
      },
      {
        id: "kazari-hizumi:2",
        position: "②",
        name: "収束の覚悟",
        description: "これ以上成長できない。ゲーム終了時に+10VP。",
        aliases: ["②", "2"],
      },
      {
        id: "kazari-hizumi:3",
        position: "③",
        name: "光のアーカイブ",
        description: "各ラウンド終了時、手元の光1個につき+1VP。",
        aliases: ["③", "3"],
      },
      {
        id: "kazari-hizumi:4",
        position: "④",
        name: "空白の枝",
        description: "効果なし。経路を分岐させるノード。",
        aliases: ["④", "4"],
      },
      {
        id: "kazari-hizumi:5",
        position: "⑤",
        name: "虹の錬成",
        description: "各ラウンド終了時、手元の虹1個につき+2VP。",
        aliases: ["⑤", "5"],
      },
      {
        id: "kazari-hizumi:6",
        position: "⑥",
        name: "静かな枝",
        description: "効果なし。経路ノード。",
        aliases: ["⑥", "6"],
      },
      {
        id: "kazari-hizumi:7",
        position: "⑦",
        name: "意思：補充ロビー",
        description:
          "【意思】創造力-2でロビーを1体未行動状態で生成し、手元資源の上限を解除する。",
        aliases: ["⑦", "7"],
      },
      {
        id: "kazari-hizumi:8",
        position: "⑧",
        name: "静寂の枝",
        description: "効果なし。終盤につながるノード。",
        aliases: ["⑧", "8"],
      },
      {
        id: "kazari-hizumi:9",
        position: "⑨",
        name: "均衡の供与",
        description:
          "各ラウンド終了時、自分より保有資源が少ないプレイヤーに資源を渡し、光の場合+3VP、虹の場合+5VPを得る。",
        aliases: ["⑨", "9"],
      },
    ],
  },
  {
    id: "midori-rina",
    name: "翠川 燐名",
    title: "残響する設計士",
    theme: "高コストのレンズと淀みトークンを活用するテクニカル型",
    overview:
      "重いレンズを自分のものにし、淀みの扱いを軽減する能力で一気に得点を稼ぐ。リスクを取るほど爆発力が出るピーキーな構成。",
    difficulty: "hard",
    growthNodes: [
      {
        id: "midori-rina:s",
        position: "S",
        name: "意思：迅速な収集",
        description: "【意思】創造力-1で収集アクションを追加で1回行う。",
        aliases: ["S", "start"],
      },
      {
        id: "midori-rina:1",
        position: "①",
        name: "静寂の枝",
        description: "効果なし。経路用ノード。",
        aliases: ["①", "1"],
      },
      {
        id: "midori-rina:2",
        position: "②",
        name: "設計完了",
        description: "これ以上成長できない。ゲーム終了時に+10VP。",
        aliases: ["②", "2"],
      },
      {
        id: "midori-rina:3",
        position: "③",
        name: "重量レンズ適性",
        description: "コスト3以上のレンズを誰かが起動するたびに+3VP。",
        aliases: ["③", "3"],
      },
      {
        id: "midori-rina:4",
        position: "④",
        name: "意思：淀みの変換",
        description:
          "【意思】創造力-1で淀み+1〜+3を選び、1個につき+2VPを得る。",
        aliases: ["④", "4"],
      },
      {
        id: "midori-rina:5",
        position: "⑤",
        name: "淀みの共鳴",
        description: "レンズで淀みを得る／消費するたび、淀み1個につき+1VP。",
        aliases: ["⑤", "5"],
      },
      {
        id: "midori-rina:6",
        position: "⑥",
        name: "静かな分岐",
        description: "効果なし。経路ノード。",
        aliases: ["⑥", "6"],
      },
      {
        id: "midori-rina:7",
        position: "⑦",
        name: "静かな終端",
        description: "効果なし。終盤の経路を整理するだけのノード。",
        aliases: ["⑦", "7"],
      },
      {
        id: "midori-rina:8",
        position: "⑧",
        name: "巨大構造の共鳴",
        description: "4スロット以上のレンズが起動するたびに+4VP。",
        aliases: ["⑧", "8"],
      },
      {
        id: "midori-rina:9",
        position: "⑨",
        name: "終局連鎖",
        description: "ゲーム終了時、自分のレンズを行動力無しで順番に1回ずつ起動できる。",
        aliases: ["⑨", "9"],
      },
    ],
  },
  {
    id: "aono-haruyo",
    name: "青野 春陽",
    title: "光律の研究者",
    theme: "自己完結的に行動力を増やしレンズを連続起動するアタッカー型",
    overview:
      "自分のレンズ起動時に追加行動力などを得る。テンポよく行動して他プレイヤーの準備を待たずに勝負を決めたい人向け。",
    difficulty: "normal",
    growthNodes: [
      {
        id: "aono-haruyo:s",
        position: "S",
        name: "意思：行動力充填",
        description: "【意思】創造力-1で行動力+2を得る。",
        aliases: ["S", "start"],
      },
      {
        id: "aono-haruyo:1",
        position: "①",
        name: "自律起動",
        description: "自分が自分のレンズを起動するたびに+2VP。",
        aliases: ["①", "1"],
      },
      {
        id: "aono-haruyo:2",
        position: "②",
        name: "テンポ完成",
        description: "これ以上成長できない。ゲーム終了時に+10VP。",
        aliases: ["②", "2"],
      },
      {
        id: "aono-haruyo:3",
        position: "③",
        name: "成長の勢い",
        description: "成長するたびに行動力+2。",
        aliases: ["③", "3"],
      },
      {
        id: "aono-haruyo:4",
        position: "④",
        name: "調整ノード",
        description: "効果なし。経路ノード。",
        aliases: ["④", "4"],
      },
      {
        id: "aono-haruyo:5",
        position: "⑤",
        name: "専念の誓い",
        description: "他人のレンズを起動できなくなるが、自分のレンズ起動時に+2VPを得る。",
        aliases: ["⑤", "5"],
      },
      {
        id: "aono-haruyo:6",
        position: "⑥",
        name: "光の律動",
        description: "光を得るレンズを起動したとき、光+1と+2VP。",
        aliases: ["⑥", "6"],
      },
      {
        id: "aono-haruyo:7",
        position: "⑦",
        name: "虹の律動",
        description: "虹を得るレンズを起動したとき、虹+1と+2VP。",
        aliases: ["⑦", "7"],
      },
      {
        id: "aono-haruyo:8",
        position: "⑧",
        name: "終局加速",
        description: "得られるVPが1.5倍（端数切り上げ）になる。",
        aliases: ["⑧", "8"],
      },
      {
        id: "aono-haruyo:9",
        position: "⑨",
        name: "レンズ掌握",
        description: "自分のレンズの説得／再起動コストが0になる。",
        aliases: ["⑨", "9"],
      },
      {
        id: "aono-haruyo:10",
        position: "⑩",
        name: "自律連鎖",
        description: "自分のレンズを起動するたびに+2VP（追加）。",
        aliases: ["⑩", "10"],
      },
    ],
  },
  {
    id: "akane-hiyori",
    name: "赤嶺 ひより",
    title: "虹彩の演算者",
    theme: "レンズ完成時や虹資源を利用したフィニッシュ型コンボを得意とする",
    overview:
      "レンズを完成させるたびに大きなVPボーナスを得る。虹資源を先行確保しつつ、タイミングよくフィニッシュを決めるのがポイント。",
    difficulty: "normal",
    growthNodes: [
      {
        id: "akane-hiyori:s",
        position: "S",
        name: "意思：虹彩チャージ",
        description: "【意思】創造力-1で光+1を得る。",
        aliases: ["S", "start"],
      },
      {
        id: "akane-hiyori:1",
        position: "①",
        name: "完成の歓喜",
        description: "レンズを完成させるたびに+4VP。",
        aliases: ["①", "1"],
      },
      {
        id: "akane-hiyori:2",
        position: "②",
        name: "虹彩調律",
        description: "これ以上成長できない。ゲーム終了時に+10VP。",
        aliases: ["②", "2"],
      },
      {
        id: "akane-hiyori:3",
        position: "③",
        name: "虹彩生成",
        description: "成長するたびに虹+1を得る。",
        aliases: ["③", "3"],
      },
      {
        id: "akane-hiyori:4",
        position: "④",
        name: "静かな枝",
        description: "効果なし。経路ノード。",
        aliases: ["④", "4"],
      },
      {
        id: "akane-hiyori:5",
        position: "⑤",
        name: "光の消費計算",
        description: "光を消費するレンズを起動したとき+3VP。",
        aliases: ["⑤", "5"],
      },
      {
        id: "akane-hiyori:6",
        position: "⑥",
        name: "静かな分岐",
        description: "効果なし。経路ノード。",
        aliases: ["⑥", "6"],
      },
      {
        id: "akane-hiyori:7",
        position: "⑦",
        name: "虹の消費計算",
        description: "虹を消費するレンズを起動したとき+4VP。",
        aliases: ["⑦", "7"],
      },
      {
        id: "akane-hiyori:8",
        position: "⑧",
        name: "虹彩備蓄",
        description: "ゲーム終了時に虹7個を所持していれば+30VP。",
        aliases: ["⑧", "8"],
      },
      {
        id: "akane-hiyori:9",
        position: "⑨",
        name: "意思：虹彩ブースト",
        description: "【意思】創造力-1で虹+1、または行動済みロビーを1体生成する。",
        aliases: ["⑨", "9"],
      },
    ],
  },
];

const CHARACTER_COLOR_SEQUENCE = [
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#10b981",
];

const CHARACTER_COLOR_MAP = new Map<string, string>();

const CHARACTER_COLOR_OVERRIDES: Record<string, string> = {
  "shirogami-yuu": "#6b7280",
  "akito-daidou": "#f97316",
  "kazari-hizumi": "#facc15",
  "midori-rina": "#22c55e",
  "aono-haruyo": "#3b82f6",
  "akane-hiyori": "#ef4444",
};

CHARACTER_CATALOG.forEach((character, index) => {
  const override = CHARACTER_COLOR_OVERRIDES[character.id];
  if (override) {
    CHARACTER_COLOR_MAP.set(character.id, override);
    return;
  }
  if (!CHARACTER_COLOR_MAP.has(character.id)) {
    const paletteIndex = index % CHARACTER_COLOR_SEQUENCE.length;
    CHARACTER_COLOR_MAP.set(character.id, CHARACTER_COLOR_SEQUENCE[paletteIndex]);
  }
});

export function getCharacterColor(characterId: string): string | undefined {
  return CHARACTER_COLOR_MAP.get(characterId);
}
