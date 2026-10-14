export type BeefoodWebhookEvent = {
  eventType: string;
  orderId: string;
};

export type BeefoodOrder = {
  orderType?: string;
  total?: { orderAmount?: number | string };
  payments?: { pending?: number | string };
  merchant?: { storeId?: string };
};

export type OrderFetcher = (orderId: string) => Promise<BeefoodOrder>;
