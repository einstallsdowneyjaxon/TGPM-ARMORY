import {
  getMissionControlBot,
  type BotHealthStatus,
} from "@/config/mission-control";

export type ToolCategory =
  | "Operations"
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
    id: string;
    label: string;
    status: BotHealthStatus;
    lastRun?: string;
  };
  missionControlSummary?: {
    botIds: string[];
  };
};

export const toolCategories: ToolCategory[] = [
  "Operations",
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
    name: "Coco XR Mission Control",
    description: "Monitor and open the live Coco XR bot operations dashboard.",
    category: "Operations",
    url: "http://206.81.13.133:8790/",
    missionControlSummary: {
      botIds: ["renewal-bot", "property-onboarding-bot", "mls-bot"],
    },
  },
  {
    name: "Renewal Bot",
    description:
      "Review upcoming renewals, risk signals, and automation status.",
    category: "Operations",
    url: "https://script.google.com/macros/s/AKfycbxF1dletvJqqGAgnVSSpkqIsu22QSx9izB96qbAUlzrqHFWT0e2oHgbQOaWt9lbSmnrIQ/exec",
    bot: {
      id: "renewal-bot",
      label: renewalBot?.name || "Renewal Bot",
      status: renewalBot?.status || "Unknown",
    },
  },
  {
    name: "Property Onboarding Bot",
    description:
      "Complete onboarding setup, intake, and automation handoff readiness for new management properties.",
    category: "Operations",
    url: "https://appfolio-property-onboarding.vercel.app/",
    bot: {
      id: "property-onboarding-bot",
      label: propertyOnboardingBot?.name || "Property Onboarding Bot",
      status: propertyOnboardingBot?.status || "Unknown",
    },
  },
  {
    name: "MLS Bot",
    description:
      "Complete missing PM fields for MLS_READY rows before the MLS automation runs.",
    category: "Operations",
    url: "/mls-ready",
    bot: {
      id: "mls-bot",
      label: mlsBot?.name || "MLS Bot",
      status: mlsBot?.status || "Unknown",
    },
  },
  {
    name: "Get Rent Comps",
    description: "Compare nearby rent signals and market positioning.",
    category: "Leasing",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbxpJRtlwgSNLUeXnMJSTSIJnDye0yQSuIT5Zu3vMkRXYpZsYeBAortgu3OFZNMB3iuy/exec",
  },
  {
    name: "Repair vs Replace",
    description:
      "Evaluate repair cost, asset life, and determine whether replacement is best.",
    category: "Maintenance",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbxVdM1jgRAVr0aairLzkD5LaE3mKtRuidGDJg_sYaBVH9zr9oXt9TwI2IgQqDUHH--3Aw/exec",
  },
  {
    name: "Applicant Review Portal",
    description:
      "Upload applicant documents for AI screening review. Include Application | Screening Docs | Paystubs",
    category: "Leasing",
    url: "https://applicant-review-portal.vercel.app/",
  },
  {
    name: "Estimate Analyzer",
    description: "Check vendor estimates against scope and historical costs.",
    category: "Maintenance",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbz7d_PzZvAPYOxSg1Q7TQhe3p7Ea2RWZTloeQ_ZnDGrVXMCswHHk8_TQ__oqlNz8ianLA/exec",
  },
  {
    name: "PM Order Request",
    description:
      "Submit property management order requests ex: New Appliance from Lowes.",
    category: "Maintenance",
    url: "https://pm-order-request.vercel.app",
  },
  {
    name: "WO Search",
    description: "Search and review work orders from AppFolio.",
    category: "Maintenance",
    url: "https://script.google.com/macros/s/AKfycbwIsdJ6uWmnedApJXB3P-ejfa5eMw9XMSFChl2OJrd_3bohz2qttckae6NoQybk7D-HTA/exec",
  },
  {
    name: "Turn Budget Analyzer",
    description:
      "Plan unit turns with budget targets and variance review. Compare Cosmetic vs Necessary",
    category: "Maintenance",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbx2Q0pwDqNMniSz08BsDjlMdMSyynE8hpK1qx1_GHATCxjNpsyl9b8b33SXBkklK6N0Fg/exec",
  },
  {
    name: "Resident Summary",
    description:
      "Open a concise resident view for account and life at the property.",
    category: "Resident",
    url: "https://script.google.com/macros/s/AKfycbwJsG32THdeCzatqV_hSg4qw9yLjskKoGqQpQA0ociRw8t4tgd5CG-cd73vDbWVVgRU/exec",
  },
  {
    name: "Property Health Analyzer",
    description:
      "Upload an AppFolio GL CSV for AI-assisted owner and internal property health reporting.",
    category: "Budgeting",
    url: "/property-health-analyzer",
  },
];
