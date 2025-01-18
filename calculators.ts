import { format, subDays } from "date-fns";
import fetch from "node-fetch";
import hphc_mapping from "./hp_hc.json";
import price_mapping from "./price_mapping.json";
import {
  CalculatedData,
  Cost,
  HpHcFile,
  HpHcFileMapping,
  Mapping,
  OfferType,
  Option,
  OptionName,
  PriceMappingFile,
  SlotType,
  TempoCodeDay,
  TempoDates,
  TempoMapping,
} from "./types";
import { isFrenchHoliday, isHpOrHcSlot } from "./utils";

interface CalculateProps {
  data: CalculatedData[];
  optionName: OptionName;
  offerType: OfferType;
}

function isDayApplicable(mapping: Mapping, endOfSlotRecorded: Date): boolean {
  return (
    mapping.applicableDays.includes(endOfSlotRecorded.getDay()) ||
    (mapping.include_holidays && isFrenchHoliday(endOfSlotRecorded))
  );
}

function findCorrespondingMapping(
  option: Option,
  endOfSlotRecorded: Date,
  hpHcMappingData: HpHcFileMapping[],
  item: CalculatedData
): Cost {
  for (const singleMapping of option.mappings) {
    if (isDayApplicable(singleMapping, endOfSlotRecorded)) {
      if (singleMapping.hpHcConfig) {
        return calculateHpHcPrices(
          hpHcMappingData,
          endOfSlotRecorded,
          singleMapping,
          option,
          item
        );
      } else {
        if (!singleMapping.price) {
          throw new Error(`No base price found ${endOfSlotRecorded}`);
        }
        return {
          optionName: option.optionName,
          offerType: option.offerType,
          cost: singleMapping.price * item.value,
        } as Cost;
      }
    } else {
      throw new Error(
        `No applicableDays found nor include_holidays ${endOfSlotRecorded}`
      );
    }
  }
}

function calculateHpHcPrices(
  hphc_mapping: HpHcFileMapping[],
  endOfSlotRecorded: Date,
  mapping: Mapping,
  option: Option,
  item: CalculatedData
): Cost {
  const commonThrowError = `${option.offerType}-${
    option.optionName
  }-${endOfSlotRecorded.toISOString()}`;

  const applicableHpHcGrids = hphc_mapping.find(
    (item) => item.offerType === option.offerType
  ).grids;
  const slotType = isHpOrHcSlot(endOfSlotRecorded, applicableHpHcGrids);
  let new_cost: Cost | null = null;
  for (const hpHcConfig of mapping.hpHcConfig) {
    if (hpHcConfig.slotType === slotType) {
      if (new_cost) {
        throw new Error(
          `Multiple slotType found ${commonThrowError} ${slotType}`
        );
      }
      new_cost = {
        optionName: option.optionName,
        offerType: option.offerType,
        cost: hpHcConfig.price * item.value,
        hourType: slotType,
      };
    }
  }
  if (!new_cost) {
    throw new Error(`No slotType found ${commonThrowError} ${slotType}`);
  }
  return new_cost;
}

async function fetchTempoData() {
  /* TODO take periode filter */
  const response = await fetch(
    "https://www.api-couleur-tempo.fr/api/joursTempo?periode%5B%5D=2024-2025&periode%5B%5D=2023-2024&periode%5B%5D=2022-2023"
  );
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  return response.json() as Promise<TempoDates>;
}

function calculateTempoPrices(
  tempoDates: TempoDates,
  item: CalculatedData,
  tempoMapping: TempoMapping[]
): Cost {
  // Determine hourType
  const endOfSlotRecorded = new Date(item.recordedAt);
  const hour = endOfSlotRecorded.getHours();
  const minute = endOfSlotRecorded.getMinutes();

  let slotType: SlotType | null = null;
  let tempoCodeDay: TempoCodeDay | null = null;
  if (
    (6 < hour && hour < 22) ||
    (hour === 22 && minute == 0) ||
    (hour === 6 && minute == 30)
  ) {
    slotType = "HP";
  } else {
    slotType = "HC";
  }

  // Determine codeJour (handling the day change at midnight)
  if (0 <= hour && (hour < 6 || (hour === 6 && minute == 0))) {
    const dayBefore = subDays(endOfSlotRecorded, 1);
    const yesterdayStr = format(dayBefore, "yyyy-MM-dd");
    tempoCodeDay = tempoDates.find(
      (item) => item.dateJour === yesterdayStr
    )?.codeJour;
    if (!tempoCodeDay) {
      throw new Error(`No tempoCodeDay found ${yesterdayStr}`);
    }
  } else {
    tempoCodeDay = tempoDates.find(
      (item) => item.dateJour === format(endOfSlotRecorded, "yyyy-MM-dd")
    ).codeJour;
  }
  if (tempoCodeDay && slotType) {
    const relevantTempoMapping = tempoMapping.find((elt) => {
      return elt.tempoCodeDay == tempoCodeDay;
    });
    const relevantCost =
      slotType === "HP" ? relevantTempoMapping.HP : relevantTempoMapping.HC;
    return {
      optionName: "TEMPO",
      offerType: "BLEU",
      cost: item.value * relevantCost,
      hourType: slotType,
      tempoCodeDay,
    };
  }
  throw new Error(
    `No tempoCodeDay or slotType found ${tempoCodeDay} ${slotType}`
  );
}

export async function calculatePrices({
  data,
  optionName,
  offerType,
}: CalculateProps): Promise<CalculatedData[]> {
  const tempoDates = await fetchTempoData();
  const priceMappingData = price_mapping as PriceMappingFile;
  const hpHcMappingData = hphc_mapping as HpHcFile;
  const option = priceMappingData.find(
    (item) => item.optionName === optionName && item.offerType === offerType
  );
  const new_data: CalculatedData[] = [];

  data.forEach(async (item) => {
    const endOfSlotRecorded = new Date(item.recordedAt);
    const commonThrowError = `${offerType}-${optionName}-${endOfSlotRecorded.toISOString()}`;

    let new_cost: Cost | null = null;

    if (option.mappings) {
      new_cost = findCorrespondingMapping(
        option,
        endOfSlotRecorded,
        hpHcMappingData,
        item
      );
    }
    if (option.tempoMappings) {
      if (!tempoDates) {
        throw new Error(`No tempoDates found ${commonThrowError}`);
      }
      new_cost = calculateTempoPrices(tempoDates, item, option.tempoMappings);
    }

    if (new_cost) {
      new_data.push({
        ...item,
        costs: [...(item.costs ?? []), new_cost],
      });
    } else {
      throw new Error(`No new_cost found ${commonThrowError}`);
    }
  });

  return new_data;
}
