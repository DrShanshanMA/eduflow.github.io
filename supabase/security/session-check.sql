create table if not exists public.coursestudio_revoked_sessions (
 session_id uuid primary key,
 user_id uuid not null,
 revoked_at timestamptz not null default now()
);
alter table public.coursestudio_revoked_sessions enable row level security;
revoke all on table public.coursestudio_revoked_sessions from public, anon, authenticated;
grant select, insert on table public.coursestudio_revoked_sessions to service_role;
create or replace function public.coursestudio_session_active(p_session_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from auth.sessions s where s.id = p_session_id and s.user_id = p_user_id)
 and not exists(select 1 from public.coursestudio_revoked_sessions r where r.session_id = p_session_id and r.user_id = p_user_id);
$$;
revoke all on function public.coursestudio_session_active(uuid,uuid) from public, anon, authenticated;
grant execute on function public.coursestudio_session_active(uuid,uuid) to service_role;
