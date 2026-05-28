import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const escapeCsvField = (value?: string | number | null) => {
  const safeValue = value ?? "";
  return `"${String(safeValue).replace(/"/g, '""')}"`;
};

export const splitTechStack = (value?: string | null) =>
  value
    ?.split(",")
    .map((skill) => skill.trim())
    .filter(Boolean) ?? [];

export const formatDateDe = (isoDate?: string | null) => {
  if (!isoDate) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(isoDate));
};
