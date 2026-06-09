export type BotHealthStatus = "Online" | "Warning" | "Offline" | "Unknown";

export type MissionControlBot = {
  id: string;
  name: string;
  category: "Leasing" | "Maintenance" | "Resident" | "Budgeting" | "Operations";
  status: BotHealthStatus;
  healthUrl?: string;
  statusUrl?: string;
  runUrl?: string;
  logsPath?: string;
  screenshotsPath?: string;
};

export const missionControlBots: MissionControlBot[] = [
  {
  id: "mission-control",
  name: "Mission Control",
  category: "Operations",
  status: "Online",
  healthUrl: process.env.NEXT_PUBLIC_MISSION_CONTROL_URL || "http://206.81.13.133:8790/",
}
  {
    id: "renewal-bot",
    name: "Renewal Bot",
    category: "Operations",
    status: "Online",
  },
  {
    id: "property-onboarding-bot",
    name: "Property Onboarding Bot",
    category: "Operations",
    status: "Online",
  },
  {
    id: "mls-bot",
    name: "MLS Bot",
    category: "Operations",
    status: "Online",
    healthUrl: process.env.NEXT_PUBLIC_MLS_BOT_HEALTH_URL || "http://localhost:8793/health",
    statusUrl: process.env.NEXT_PUBLIC_MLS_BOT_STATUS_URL || "http://localhost:8793/status",
    runUrl: process.env.NEXT_PUBLIC_MLS_BOT_RUN_URL || "http://localhost:8793/run",
    logsPath: "logs/mls-bot",
    screenshotsPath: "logs/mls-bot/screenshots",
  },
];

export function getMissionControlBot(id: string) {
  return missionControlBots.find((bot) => bot.id === id);
}
