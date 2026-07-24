import React, { createContext, useContext, useState } from "react";

type Currency = "QAR" | "USD";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatAmount: (amountInQar: number, fractionDigits?: number) => string;
  convertAmount: (amountInQar: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const QAR_USD_PEG = 3.64; // 1 USD = 3.64 QAR

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    return (localStorage.getItem("preferred_currency") as Currency) || "QAR";
  });

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("preferred_currency", newCurrency);
  };

  const convertAmount = (amountInQar: number): number => {
    return currency === "USD" ? amountInQar / QAR_USD_PEG : amountInQar;
  };

  const formatAmount = (amountInQar: number, fractionDigits: number = 0): string => {
    const converted = convertAmount(amountInQar);
    if (currency === "USD") {
      return `$${Math.round(converted).toLocaleString(undefined, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })}`;
    } else {
      return `${Math.round(amountInQar).toLocaleString(undefined, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })} QAR`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, convertAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
