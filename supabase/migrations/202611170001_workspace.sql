-- All application authorization runs in the authenticated Edge Function.
-- Browsers must never read the complete workspace document through the Data API.
create table if not exists public.coursestudio_workspace (
  id text primary key check (id = 'team'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);
alter table public.coursestudio_workspace enable row level security;
revoke all on table public.coursestudio_workspace from public, anon, authenticated;
grant select, insert, update on table public.coursestudio_workspace to service_role;
comment on table public.coursestudio_workspace is 'Server-only CourseStudio records; no direct browser policies. Access is filtered by the authenticated workflow Edge Function.';

create table if not exists public.coursestudio_settings (
 id text primary key check (id = 'team'),
 owner_email text not null,
 allowed_origins jsonb not null check (jsonb_typeof(allowed_origins) = 'array')
);
alter table public.coursestudio_settings enable row level security;
revoke all on table public.coursestudio_settings from public, anon, authenticated;
grant select, insert, update on table public.coursestudio_settings to service_role;
