export type CalendarCategory = "medical" | "medication" | "social" | "personal";

export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, string> = {
  medical: "#D64545",
  medication: "#7A5FD1",
  social: "#3E9C6D",
  personal: "#3E7CB1",
};

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  medical: "Medical",
  medication: "Medication",
  social: "Social",
  personal: "Personal",
};
