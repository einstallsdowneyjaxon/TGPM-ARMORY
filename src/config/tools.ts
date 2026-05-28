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
    description: "Evaluate repair cost, asset life, and determine whether replacement is best.",
    category: "Maintenance",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbxVdM1jgRAVr0aairLzkD5LaE3mKtRuidGDJg_sYaBVH9zr9oXt9TwI2IgQqDUHH--3Aw/exec",
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
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbz7d_PzZvAPYOxSg1Q7TQhe3p7Ea2RWZTloeQ_ZnDGrVXMCswHHk8_TQ__oqlNz8ianLA/exec",
  },
  {
    name: "Resident Summary",
    description: "Open a concise resident view for account and life at the property.",
    category: "Resident",
    url: "https://script.google.com/macros/s/AKfycbwJsG32THdeCzatqV_hSg4qw9yLjskKoGqQpQA0ociRw8t4tgd5CG-cd73vDbWVVgRU/exec",
  },
  {
  name: "Applicant Review Portal",
  description: "Upload applicant documents for AI screening review. Include Application | Screening Docs | Paystubs",
  category: "Leasing",
  url: "https://applicant-review-portal-4xv7grx8m.vercel.app/",
},
  {
    name: "Turn Budget Analyzer",
    description: "Plan unit turns with budget targets and variance review. Compare Cosmetic vs Necessary",
    category: "Maintenance",
    url: "https://script.google.com/a/macros/thetgpm.com/s/AKfycbx2Q0pwDqNMniSz08BsDjlMdMSyynE8hpK1qx1_GHATCxjNpsyl9b8b33SXBkklK6N0Fg/exec",
  },
  {
  name: "WO Search",
  description: "Search and review work orders from AppFolio.",
  category: "Maintenance",
  url: "https://script.google.com/macros/s/AKfycbwIsdJ6uWmnedApJXB3P-ejfa5eMw9XMSFChl2OJrd_3bohz2qttckae6NoQybk7D-HTA/exec",
},
  {
  name: "New Property Onboarding",
  description: "Complete onboarding setup and intake for new management properties.",
  category: "Leasing",
  url: "https://appfolio-property-onboarding.vercel.app/",
},
  {
  name: "PM Order Request",
  description: "Submit property management order requests ex: New Appliance from Lowes.",
  category: "Maintenance",
  url: "https://pm-order-request-git-main-einstallsdowneyjaxons-projects.vercel.app",
},
];
