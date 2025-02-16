export type PriceMappingFile = Option[];

export interface FullCalculatedData {
  detailedData: CalculatedData[];
  totalCost: number;
  optionKey: OptionKey;
  offerType: OfferType;
}
export enum OptionKey {
  BASE = "BASE",
  HPHC = "HPHC",
  BLEU_TEMPO = "BLEU_TEMPO",
  WEEK_END_HPHC = "WEEK_END_HPHC",
  ZEN_FLEX = "ZEN_FLEX",
  WEEK_END_PLUS_LUNDI = "WEEK_END_PLUS_LUNDI",
  WEEK_END_PLUS_MERCREDI = "WEEK_END_PLUS_MERCREDI",
  WEEK_END_PLUS_VENDREDI = "WEEK_END_PLUS_VENDREDI",
  WEEK_END_PLUS_HPHC_LUNDI = "WEEK_END_PLUS_HPHC_LUNDI",
  WEEK_END_PLUS_HPHC_MERCREDI = "WEEK_END_PLUS_HPHC_MERCREDI",
  WEEK_END_PLUS_HPHC_VENDREDI = "WEEK_END_PLUS_HPHC_VENDREDI",
  FIXE_BASE = "FIXE_BASE",
  FIXE_HPHC = "FIXE_HPHC",
  ONLINE_BASE = "ONLINE_BASE",
  ONLINE_HPHC = "ONLINE_HPHC",
}

export enum OfferType {
  BLEU = "BLEU",
  ZEN = "ZEN",
  VERT = "VERT",
}

export interface ConsumptionLoadCurveData {
  recordedAt: string;
  value: number;
}

export interface CalculatedData extends ConsumptionLoadCurveData {
  costs?: Cost[];
}
export type TempoDates = TempoDate[];

export interface TempoDate {
  dateJour: string;
  codeJour: TempoCodeDay;
  periode: string;
}

export interface TempoMapping {
  tempoCodeDay: number;
  HP: number;
  HC: number;
}

interface HourTime {
  minute: number;
  hour: number;
}

export type TempoCodeDay = 1 | 2 | 3;

export interface Cost {
  cost: number;
  hourType?: SlotType;
  tempoCodeDay?: TempoCodeDay;
}

export interface HpHcSlot {
  slotType: string;
  startSlot: HourTime;
  endSlot: HourTime;
}

export type SlotType = "HP" | "HC";

export interface HpHcConfigParent {
  slotType: SlotType;
  price: number;
}

export interface Mapping {
  applicableDays: number[];
  price?: number;
  hpHcConfig?: HpHcConfigParent[];
  include_holidays?: boolean;
}

export type Season = "Été" | "Hiver" | "Automne" | "Printemps";

export type OverridingHpHcKey = "BLEU_TEMPO" | "ZEN_FLEX";

export type Provider = "EDF" | "TotalEnergies" | "Engie";
export interface Option {
  provider: Provider;
  optionKey: OptionKey;
  optionName: string;
  link: string;
  offerType: OfferType;
  subscriptions: Subscription[];
  mappings: Mapping[];
  tempoMappings?: TempoMapping[];
  overridingHpHcKey?: OverridingHpHcKey;
}

export interface Subscription {
  powerClass: PowerClass;
  monthlyCost: number;
}

export type PowerClass = 6 | 9 | 12 | 15 | 18 | 24 | 30 | 36;

export interface ComparisonTableInterfaceRow {
  provider: "EDF";
  offerType: OfferType;
  optionKey: OptionKey;
  totalConsumptionCost: number;
  fullSubscriptionCost: number;
  total: number;
}
