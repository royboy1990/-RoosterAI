import type { Connector } from "../types";
import { calendarConnector } from "./calendar";
import { demoConnector } from "./demo";
import { ga4Connector } from "./ga4";
import { githubConnector } from "./github";
import { imapConnector } from "./imap";

/**
 * Connector registry. Contributors add one line here.
 * Pipeline looks up by id from rooster.config.json — no special cases.
 */
export const connectors: readonly Connector[] = [
  githubConnector,
  calendarConnector,
  demoConnector,
  imapConnector,
  ga4Connector,
];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

export {
  listAccessibleGa4Properties,
  parseGa4PropertyIdsFromEnv,
  type Ga4PropertyInfo,
} from "./ga4";
export { connectorCatalog, type ConnectorCatalogEntry } from "./catalog";
