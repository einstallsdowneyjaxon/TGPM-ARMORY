export type LegalCourtDateInput = {
  label: string;
  eventAt: string;
  timezone?: string;
};

export type LegalAnalysisResult = {
  title: string;
  caseNumber: string;
  courtName: string;
  county: string;
  plaintiff: string;
  defendant: string;
  propertyAddress: string;
  intakeSummary: string;
  actionCourtDates: LegalCourtDateInput[];
  floridaResearch: string;
  proposedNextSteps: string;
  initialDocketEntries: Array<{
    filedAt: string;
    title: string;
    description: string;
  }>;
};

export type LegalMatterRecord = {
  id: string;
  title: string;
  case_number: string | null;
  court_name: string | null;
  county: string | null;
  plaintiff: string | null;
  defendant: string | null;
  property_address: string | null;
  public_docket_url: string | null;
  status: string;
  intake_summary: string | null;
  action_court_dates: unknown;
  florida_research: string | null;
  proposed_next_steps: string | null;
  analysis_disclaimer: string;
  created_at: string;
  updated_at: string;
};
