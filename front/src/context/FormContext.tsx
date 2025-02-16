import { endOfDay, startOfDay, subYears } from "date-fns";
import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  HpHcSlot,
  OfferType,
  OptionKey,
  PowerClass,
  Provider,
  SeasonHourlyAnalysis,
} from "../types";

interface FormState {
  provider: Provider;
  offerType: OfferType;
  optionType: OptionKey | "";
  powerClass: PowerClass;
  isGlobalLoading: boolean;
  seasonHourlyAnalysis?: SeasonHourlyAnalysis[];
  dateRange: [Date, Date];
  analyzedDateRange?: [number, number];
  requestId?: string;
  optionLink?: string;
  totalConsumption: number;
  hpHcConfig?: HpHcSlot[];
}

interface FormContextProps {
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
}

interface FormProviderProps {
  children: ReactNode;
}

const FormContext = createContext<FormContextProps | undefined>(undefined);

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("useFormContext must be used within a FormProvider");
  }
  return context;
};

export const FormProvider: React.FC<FormProviderProps> = ({ children }) => {
  const lastYearStart = startOfDay(subYears(new Date(), 1));
  const lastYearEnd = endOfDay(new Date());
  const [formState, setFormState] = useState<FormState>({
    provider: "EDF",
    offerType: OfferType.BLEU,
    optionType: OptionKey.BASE,
    powerClass: 6,
    isGlobalLoading: false,
    dateRange: [lastYearStart, lastYearEnd],
    totalConsumption: 1,
  });

  const contextValue = useMemo(
    () => ({ formState, setFormState }),
    [formState]
  );

  return (
    <FormContext.Provider value={contextValue}>{children}</FormContext.Provider>
  );
};
