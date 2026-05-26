export type ToolCategory =
  | "Leasing"
  | "Maintenance"
  | "Resident"
  | "Budgeting";

export type ToolLink = {
  name: string;
  description: string;
  category: ToolCategory;
  url: string;
};

export const toolCategories: ToolCategory[] = [
  "Leasing",
  "Maintenance",
  "Resident",
  "Budgeting",
];

export const tools: ToolLink[] = [
  {
    name: "Get Rent Comps",
    description: "Compare nearby rent signals and market positioning.",
    category: "Leasing",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbxpJRtlwgSNLUeXnMJSTSIJnDye0yQSuIT5Zu3vMkRXYpZsYeBAortgu3OFZNMB3iuy/exec",
  },
  {
    name: "Repair vs Replace",
    description: "Evaluate repair cost, asset life, and replacement timing.",
    category: "Maintenance",
    url: "https://example.com/repair-vs-replace",
  },
  {
    name: "Lease Renewal Dashboard",
    description: "Review upcoming renewals, risk signals, and offer status.",
    category: "Leasing",
    url: "https://script.google.com/macros/s/AKfycbxF1dletvJqqGAgnVSSpkqIsu22QSx9izB96qbAUlzrqHFWT0e2oHgbQOaWt9lbSmnrIQ/exec",
  },
  {
    name: "Estimate Analyzer",
    description: "Check vendor estimates against scope and historical costs.",
    category: "Maintenance",
    url: "https://example.com/estimate-analyzer",
  },
  {
    name: "PM Order Request",
    description: "Submit property management order requests for team review.",
    category: "Maintenance",
    url: "https://pm-order-request-git-main-einstallsdowneyjaxons-projects.vercel.app",
  },
  {
    name: "Resident Summary",
    description: "Open a concise resident view for account and service context.",
    category: "Resident",
    url: "https://example.com/resident-summary",
  },
  {
    name: "Turn Budget Analyzer",
    description: "Plan unit turns with budget targets and variance review.",
    category: "Budgeting",
    url: "https://example.com/turn-budget-analyzer",
  },
];
