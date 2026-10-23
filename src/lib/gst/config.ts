import rateConfigJson from "../../config/gst-rates.json";
import stateCodesJson from "../../config/state-codes.json";
import type { RateConfig, StateCodes } from "./types";

export const rateConfig = rateConfigJson as unknown as RateConfig;

/** State codes without the "_note" metadata key. */
export const stateCodes: StateCodes = Object.fromEntries(
  Object.entries(stateCodesJson).filter(([key]) => /^\d{2}$/.test(key)),
) as StateCodes;
