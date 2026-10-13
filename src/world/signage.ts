/**
 * Curated sign text. Every Chinese label here is a real Traditional Chinese
 * shop type or name, as used in Hong Kong. Nothing is generated from random
 * characters. English lines are the usual bilingual shopfront wording or a
 * Cantonese romanisation of the name.
 */

export type SignTone = 'white' | 'cream' | 'yellow' | 'red' | 'green' | 'blue' | 'charcoal' | 'teal'

export type ShopCategory = 'food' | 'retail' | 'service' | 'trade' | 'medical'

export interface ShopLabel {
  zh: string
  en: string
  category: ShopCategory
  /** Preferred sign tones. */
  tones: readonly SignTone[]
}

export const SHOP_LABELS: readonly ShopLabel[] = [
  // Food
  { zh: '榮記粥麵', en: 'WING KEE CONGEE & NOODLES', category: 'food', tones: ['white', 'red'] },
  { zh: '福祥燒臘', en: 'FUK CHEUNG ROAST MEATS', category: 'food', tones: ['red', 'yellow'] },
  { zh: '泰昌餅店', en: 'TAI CHEONG BAKERY', category: 'food', tones: ['cream', 'yellow'] },
  { zh: '糖水', en: 'DESSERTS', category: 'food', tones: ['white', 'teal'] },
  { zh: '大興水果', en: 'TAI HING FRUIT', category: 'food', tones: ['green', 'yellow'] },
  { zh: '鮮魚', en: 'FRESH FISH', category: 'food', tones: ['blue', 'white'] },
  { zh: '金盛海味', en: 'KAM SING DRIED SEAFOOD', category: 'food', tones: ['red', 'cream'] },
  { zh: '米行', en: 'RICE', category: 'food', tones: ['cream', 'green'] },
  { zh: '德記茶莊', en: 'TAK KEE TEA', category: 'food', tones: ['charcoal', 'cream'] },
  { zh: '酒樓', en: 'RESTAURANT', category: 'food', tones: ['red', 'charcoal'] },
  // Retail
  { zh: '永發雜貨', en: 'WING FAT GROCERY', category: 'retail', tones: ['yellow', 'white'] },
  { zh: '新興五金', en: 'SUN HING HARDWARE', category: 'retail', tones: ['blue', 'yellow'] },
  { zh: '長發電器', en: 'CHEUNG FAT ELECTRICAL', category: 'retail', tones: ['white', 'blue'] },
  { zh: '文具', en: 'STATIONERY', category: 'retail', tones: ['white', 'green'] },
  { zh: '布疋', en: 'FABRICS', category: 'retail', tones: ['teal', 'cream'] },
  { zh: '手機', en: 'MOBILE', category: 'retail', tones: ['charcoal', 'white'] },
  { zh: '眼鏡', en: 'OPTICAL', category: 'retail', tones: ['white', 'teal'] },
  // Service
  { zh: '樂記理髮', en: 'LOK KEE BARBER', category: 'service', tones: ['white', 'red'] },
  { zh: '同樂洗衣', en: 'TUNG LOK LAUNDRY', category: 'service', tones: ['blue', 'white'] },
  { zh: '鎖匙', en: 'KEYS', category: 'service', tones: ['yellow', 'charcoal'] },
  { zh: '裁縫', en: 'TAILOR', category: 'service', tones: ['cream', 'green'] },
  { zh: '聯發印刷', en: 'LUEN FAT PRINTING', category: 'service', tones: ['white', 'blue'] },
  { zh: '地產', en: 'PROPERTY', category: 'service', tones: ['red', 'white'] },
  // Medical
  { zh: '利源藥房', en: 'LEE YUEN PHARMACY', category: 'medical', tones: ['green', 'white'] },
  { zh: '中藥', en: 'HERBAL MEDICINE', category: 'medical', tones: ['cream', 'green'] },
  { zh: '診所', en: 'CLINIC', category: 'medical', tones: ['white', 'teal'] },
  // Trades
  { zh: '裝修工程', en: 'RENOVATION', category: 'trade', tones: ['yellow', 'charcoal'] },
  { zh: '水電工程', en: 'PLUMBING & ELECTRICAL', category: 'trade', tones: ['blue', 'cream'] },
  { zh: '冷氣工程', en: 'AIR-CON', category: 'trade', tones: ['white', 'blue'] },
  { zh: '車房', en: 'GARAGE', category: 'trade', tones: ['charcoal', 'yellow'] },
]

/** The cha chaan teng. The English line is the usual translation of the name. */
export const RESTAURANT_LABEL = { zh: '美華茶餐廳', en: 'MEI WAH CAFE' }
export const CONVENIENCE_LABEL = { zh: '便利店', en: '24 HOURS CONVENIENCE' }
export const STATION_LABEL = { zh: '海旁站', en: 'HOI PONG STATION' }
export const PLATFORM_LABEL = { zh: '往月台', en: 'TO PLATFORMS' }
/** Dead-end and closure signs: private property, staff-only service doors, roadworks. */
export const PRIVATE_LABEL = { zh: '私人地方', en: 'PRIVATE PROPERTY' }
export const STAFF_LABEL = { zh: '員工專用', en: 'STAFF ONLY' }
export const ROADWORKS_LABEL = { zh: '前面施工', en: 'ROAD WORKS' }
export const FOOTBRIDGE_LABEL = { zh: '行人天橋', en: 'FOOTBRIDGE' }

/** Subtle transit hints, used sparingly close to the trunk road only. */
export const TRANSIT_LABELS = [
  { zh: '鐵路', en: 'RAIL' },
  { zh: '小巴站', en: 'MINIBUS' },
  { zh: '的士站', en: 'TAXI' },
] as const

/** Category order for shop mixes by zone. */
export const CATEGORY_WEIGHTS: Readonly<Record<string, readonly (readonly [ShopCategory, number])[]>> = {
  commercial: [['food', 3], ['retail', 3], ['service', 2], ['medical', 1.2], ['trade', 1]],
  avenue: [['retail', 2], ['service', 2], ['medical', 1.5], ['food', 2], ['trade', 1]],
  residential: [['service', 2], ['trade', 2], ['food', 1], ['retail', 1], ['medical', 0.6]],
  market: [['food', 5], ['retail', 1.5], ['service', 0.5]],
  construction: [['trade', 3], ['service', 1]],
  trunk: [['retail', 1], ['service', 1], ['trade', 1]],
}
