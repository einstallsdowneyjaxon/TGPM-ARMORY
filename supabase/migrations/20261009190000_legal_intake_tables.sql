-- Legal summons / complaint intake (TGPM Armory)

create table if not exists public.legal_matters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  case_number text,
  court_name text,
  county text,
  plaintiff text,
  defendant text,
  property_address text,
  public_docket_url text,
  docket_page_hash text,
  docket_last_checked_at timestamptz,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  intake_summary text,
  action_court_dates jsonb not null default '[]'::jsonb,
  florida_research text,
  proposed_next_steps text,
  analysis_disclaimer text not null default 'This is AI-generated operational guidance, not legal advice. Consult licensed Florida counsel before taking action.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  doc_role text not null check (doc_role in ('summons_complaint', 'supporting')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  ocr_text text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_legal_documents_matter_id on public.legal_documents(matter_id);

create table if not exists public.legal_court_dates (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  label text not null,
  event_at timestamptz not null,
  timezone text not null default 'America/New_York',
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_legal_court_dates_matter_id on public.legal_court_dates(matter_id);
create index if not exists idx_legal_court_dates_event_at on public.legal_court_dates(event_at);

create table if not exists public.legal_docket_events (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  filed_at date,
  title text not null,
  description text,
  source text not null default 'manual' check (source in ('manual', 'auto_check', 'intake')),
  detected_at timestamptz not null default now()
);

create index if not exists idx_legal_docket_events_matter_id on public.legal_docket_events(matter_id);

create table if not exists public.legal_notification_log (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references public.legal_matters(id) on delete set null,
  kind text not null,
  recipients text[] not null,
  subject text not null,
  sent_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_legal_notification_log_matter_id on public.legal_notification_log(matter_id);

insert into storage.buckets (id, name, public)
values ('legal-intake-docs', 'legal-intake-docs', false)
on conflict (id) do nothing;
