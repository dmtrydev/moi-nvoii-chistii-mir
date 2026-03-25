/** Ответ identify ПКК (упрощённо, по pkk.js / открытым примерам). */
export type PkkIdentifyFeature = {
  id?: string;
  attrs?: Record<string, string | number | null | undefined>;
};

export type PkkIdentifyResponse = {
  status?: number;
  note?: string;
  features?: PkkIdentifyFeature[];
};

export type PkkFeatureDetailResponse = {
  status?: number;
  feature?: {
    type?: string;
    attrs?: Record<string, string | number | null | undefined>;
  };
};
