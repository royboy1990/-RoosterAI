import type { Connector } from "../types";
import { demoConnector } from "./demo";
import { ga4Connector } from "./ga4";
import { imapConnector } from "./imap";

/**
 * Connector registry. Contributors add one line here.
 * Pipeline looks up by id from rooster.config.json — no special cases.
 */
export const connectors: readonly Connector[] = [
  demoConnector,
  imapConnector,
  ga4Connector,
];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}
