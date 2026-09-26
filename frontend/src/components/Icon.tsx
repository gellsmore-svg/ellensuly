const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  graph: "M5 12h5m4-6-4 6 4 6 M2 9h3v6H2z M14 3h7v6h-7z M14 15h7v6h-7z",
  risk: "m12 3 10 18H2L12 3z M12 9v5 M12 17v.1",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  book: "M12 5C8 2 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-6-2-10 1v16",
  table: "M3 4h18v16H3z M3 9h18M3 14h18M9 4v16",
  chart: "M4 20V4m0 16h17M9 16v-5m5 5V6m5 10v-8",
  present: "M3 3h18v13H3z M12 16v5m-4 0 4-3 4 3",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-2 5 6 6",
} as const;

export function Icon({
  name,
  size = 20,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
