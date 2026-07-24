export const INSTALLATION_DELIVERY_TYPE_OPTIONS = [
  { value: "install", label: "설치" },
  { value: "delivery", label: "택배발송" },
  { value: "as", label: "AS" },
  { value: "name_change", label: "명변" },
  { value: "transfer", label: "전환" },
] as const;

export type InstallationDeliveryType = (typeof INSTALLATION_DELIVERY_TYPE_OPTIONS)[number]["value"];

export const INSTALLATION_DELIVERY_TYPE_LABEL: Record<InstallationDeliveryType, string> =
  Object.fromEntries(
    INSTALLATION_DELIVERY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<InstallationDeliveryType, string>;

export function isInstallationDeliveryType(value: string): value is InstallationDeliveryType {
  return INSTALLATION_DELIVERY_TYPE_OPTIONS.some((option) => option.value === value);
}
