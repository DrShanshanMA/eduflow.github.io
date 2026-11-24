create table public.project_studio_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 80),
 creator_id uuid not null, payload jsonb not null check (jsonb_typeof(payload)='object'),
 version bigint not null default 0 check(version>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index project_studio_workspace_creator on public.project_studio_workspaces(creator_id);
create table public.project_studio_members (
 workspace_id uuid not null references public.project_studio_workspaces(id) on delete cascade,
 email text not null check(email=lower(email)), primary key(workspace_id,email)
);
create index project_studio_members_email on public.project_studio_members(email,workspace_id);
alter table public.project_studio_workspaces enable row level security;
alter table public.project_studio_members enable row level security;
revoke all on public.project_studio_workspaces, public.project_studio_members from public, anon, authenticated;
grant select,insert,update on public.project_studio_workspaces to service_role;
grant select,insert,delete on public.project_studio_members to service_role;

create function public.project_studio_create(p_name text,p_creator_id uuid,p_email text,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare new_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_creator_id::text,0));
 if (select count(*) from public.project_studio_workspaces where creator_id=p_creator_id)>=5 then raise exception 'Workspace limit reached'; end if;
 insert into public.project_studio_workspaces(name,creator_id,payload) values(p_name,p_creator_id,p_payload) returning id into new_id;
 insert into public.project_studio_members(workspace_id,email) values(new_id,lower(p_email));
 return new_id;
end;
$$;
create function public.project_studio_save(p_workspace_id uuid,p_email text,p_version bigint,p_payload jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.project_studio_workspaces w set payload=p_payload,version=version+1,updated_at=now()
 where w.id=p_workspace_id and w.version=p_version
 and exists(select 1 from public.project_studio_members m where m.workspace_id=w.id and m.email=lower(p_email));
 if not found then return false; end if;
 delete from public.project_studio_members where workspace_id=p_workspace_id;
 insert into public.project_studio_members(workspace_id,email)
 select p_workspace_id,lower(member->>'email') from pg_catalog.jsonb_array_elements(p_payload->'members') member
 where coalesce((member->>'active')::boolean,true) group by lower(member->>'email');
 return true;
end;
$$;
revoke all on function public.project_studio_create(text,uuid,text,jsonb),public.project_studio_save(uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.project_studio_create(text,uuid,text,jsonb),public.project_studio_save(uuid,text,bigint,jsonb) to service_role;
