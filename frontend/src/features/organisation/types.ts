export type Branch = { id: string; name: string; address: string };
export type Department = { id: string; name: string; branch: string };
export type Position = { id: string; name: string; department: string };
export type Assignment = { employee: string; position: string; manager: string };
export type ChartPoint = { x: number; y: number };
export type ChartArrangement = {
  positions: Record<string, ChartPoint>;
  company: ChartPoint;
  routes?: Record<string, { manager: string; point: ChartPoint }>;
};
export type Org = {
  branches: Branch[];
  departments: Department[];
  positions: Position[];
  assignments: Assignment[];
  chartLayout?: ChartArrangement;
};

/** Minimal employee projection used only by the organisation canvas adapter. */
export type ChartRecord = { id: string; values: string[]; status: string };

// A drop can wait for the reporting form without losing the original card positions.
export type ChartPlacement = {
  employee: string;
  manager: string;
  point: ChartPoint;
  base: ChartArrangement;
  connect: boolean;
};
