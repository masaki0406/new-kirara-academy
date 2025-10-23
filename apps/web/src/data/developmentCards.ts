export interface DevelopmentCardQuadrants {
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
}

export interface DevelopmentCardColumn {
  top?: string;
  middle?: string;
  bottom?: string;
}

export interface DevelopmentCardData {
  id: string;
  name: string;
  category: string;
  summary?: string;
  quadrants?: DevelopmentCardQuadrants;
  leftColumn?: DevelopmentCardColumn;
  rightColumn?: DevelopmentCardColumn;
  notes?: string;
}

export const DEVELOPMENT_CARDS: DevelopmentCardData[] = [
  {
    id: 'dev-card-001',
    name: '光彩の集束',
    category: '光学',
    summary: '光 2 を獲得し、任意で虹へ変換できる。',
    quadrants: {
      topLeft: '光 1',
      topRight: '虹 0',
      bottomLeft: 'VP +2',
      bottomRight: '行動力 1',
    },
    leftColumn: {
      top: 'コスト: 光トークン 1',
      middle: '消費: 行動力 1',
      bottom: '追加: 虹へ変換 1 回',
    },
    rightColumn: {
      top: '獲得: 光トークン 2',
      middle: '任意: 虹 1',
      bottom: '終了時: VP +2',
    },
    notes: '光優先のラボと好相性。',
  },
  {
    id: 'dev-card-002',
    name: '虹彩プリズム',
    category: '虹彩',
    summary: '虹 1 を VP と創造力に転換する。',
    quadrants: {
      topLeft: '虹 1',
      topRight: 'VP +3',
      bottomLeft: '創造 +1',
      bottomRight: '行動力 0',
    },
    leftColumn: {
      top: 'コスト: 虹トークン 1',
      middle: '条件: ロビー未使用',
      bottom: '制限: ラウンド 1 回',
    },
    rightColumn: {
      top: '効果: VP +3',
      middle: '創造力 +1',
      bottom: '変換後: 虹 → 淀み',
    },
    notes: '最終ラウンドで VP ブースト。',
  },
  {
    id: 'dev-card-003',
    name: '淀み浄化装置',
    category: '環境',
    summary: '淀みを光へ変換し、追加 VP を得る。',
    quadrants: {
      topLeft: '淀み 1',
      topRight: '光 +1',
      bottomLeft: 'VP +1',
      bottomRight: 'ロビー +1',
    },
    leftColumn: {
      top: 'コスト: 淀みトークン 1',
      middle: '設備: ラボ受付',
      bottom: 'タイミング: 即時',
    },
    rightColumn: {
      top: '効果: 光トークン +1',
      middle: '報酬: VP +1',
      bottom: '貯蔵: ロビー在庫 +1',
    },
    notes: '淀みが溢れた時の緊急処置。',
  },
];
