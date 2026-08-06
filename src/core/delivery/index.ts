import type { DeliveryChannel } from "../types";
import { fileDelivery } from "./file";
import { telegramDelivery } from "./telegram";

/** Delivery channel registry. Add a channel file, then one line here. */
export const deliveryChannels: readonly DeliveryChannel[] = [
  fileDelivery,
  telegramDelivery,
];

export function getDeliveryChannel(id: string): DeliveryChannel | undefined {
  return deliveryChannels.find((c) => c.id === id);
}
