import { getMissionControlBot, type BotHealthStatus } from "@/config/mission-control";

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
  bot?: {
    label: string;
    status: BotHealthStatus;
    lastRun?: string;
  };
};

export const toolCategories: ToolCategory[] = [
  "Leasing",
  "Maintenance",
  "Resident",
  "Budgeting",
];

const renewalBot = getMissionControlBot("renewal-bot");
const mlsBot = getMissionControlBot("mls-bot");
const propertyOnboardingBot = getMissionControlBot("property-onboarding-bot");

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
    name: "Renewal Bot",
    description: "Review upcoming renewals, risk signals, and automation status.",
    category: "Leasing",
    url: "https://script.google.com/macros/s/AKfycbxF1dletvJqqGAgnVSSpkqIsu22QSx9izB96qbAUlzrqHFWT0e2oHgbQOaWt9lbSmnrIQ/exec",
    bot: {
      label: renewalBot?.name || "Renewal Bot",
      status: renewalBot?.status || "Unknown",
    },
  },
  {
    name: "MLS Bot",
    description:
      "Complete missing PM fields for MLS_READY rows before the MLS automation runs.",
    category: "Leasing",
    url: "/mls-ready",
    bot: {
      label: mlsBot?.name || "MLS Bot",
      status: mlsBot?.status || "Unknown",
    },
  },
  {
    name: "Property Onboarding Bot",
    description:
      "Track property onboarding automation health and handoff readiness.",
    category: "Leasing",
    url: "https://example.com/property-onboarding-bot",
    bot: {
      label: propertyOnboardingBot?.name || "Property Onboarding Bot",
      status: propertyOnboardingBot?.status || "Unknown",
    },
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
  {
    name: "Property Health Analyzer",
    description:
      "Upload an AppFolio GL CSV for AI-assisted owner and internal property health reporting.",
    category: "Budgeting",
    url: "/property-health-analyzer",
  },
];
