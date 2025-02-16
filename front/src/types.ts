export enum OptionKey {
  BASE = "BASE",
  HPHC = "HPHC",
  TEMPO = "TEMPO",
  WEEK_END_HPHC = "WEEK_END_HPHC",
  FLEX_ECO = "FLEX_ECO",
  FLEX_SOBRIETE = "FLEX_SOBRIETE",
  WEEK_END_PLUS_LUNDI = "WEEK_END_PLUS_LUNDI",
  WEEK_END_PLUS_MERCREDI = "WEEK_END_PLUS_MERCREDI",
  WEEK_END_PLUS_VENDREDI = "WEEK_END_PLUS_VENDREDI",
  WEEK_END_PLUS_HPHC_LUNDI = "WEEK_END_PLUS_HPHC_LUNDI",
  WEEK_END_PLUS_HPHC_MERCREDI = "WEEK_END_PLUS_HPHC_MERCREDI",
  WEEK_END_PLUS_HPHC_VENDREDI = "WEEK_END_PLUS_HPHC_VENDREDI",
  FIXE_BASE = "FIXE_BASE",
  FIXE_HPHC = "FIXE_HPHC",
  ONLINE_BASE = "ONLINE_BASE",
}

export enum OfferType {
  BLEU = "BLEU",
  ZEN = "ZEN",
  VERT = "VERT",
}

export type Season = "Été" | "Hiver" | "Automne" | "Printemps";
export type PowerClass = 6 | 9 | 12 | 15 | 18 | 24 | 30 | 36;

export interface SeasonHourlyAnalysis {
  season: Season;
  seasonTotalSum: number;
  hourly: { hour: string; value: number }[];
}

export type PriceMappingFile = Option[];

export interface TempoMapping {
  tempoCodeDay: number;
  HP: number;
  HC: number;
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

export type Provider = "EDF" | "TotalEnergies" | "Engie";

export interface Option {
  optionKey: OptionKey;
  provider: Provider;
  optionName: string;
  link: string;
  offerType: OfferType;
  subscriptions: Subscription[];
  mappings: Mapping[];
  tempoMappings?: TempoMapping[];
  overridingHpHcKey?: string;
}
export interface Subscription {
  powerClass: PowerClass;
  monthlyCost: number;
}

export interface ComparisonTableInterfaceRow {
  provider: Provider;
  offerType: OfferType;
  optionKey: OptionKey;
  optionName: string;
  totalConsumptionCost: number;
  fullSubscriptionCost: number;
  total: number;
  link: string;
  overridingHpHcKey?: string;
}

export const APP_VERSION = process.env.REACT_APP_VERSION || "dev";

export interface HourTime {
  hour: number;
  minute: number;
}

export interface HpHcSlot {
  slotType: SlotType;
  startSlot: HourTime;
  endSlot: HourTime;
}
