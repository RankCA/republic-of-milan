-- Parliament of the Republic of Milan: tables, security and the functions MPs write through.
--
-- Citizens read published acts straight from the tables (RLS: select only).
-- MPs never get table write access. Every write goes through a portal_* function
-- that checks the member's seal (a personal access code, stored only as a hash).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- Members -------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  title text not null default 'Member of Parliament' check (char_length(title) <= 80),
  party text check (char_length(party) <= 80),
  bio text check (char_length(bio) <= 1200),
  role text not null default 'mp' check (role in ('mp', 'keeper')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.seals (
  member_id uuid primary key references public.members (id) on delete cascade,
  seal_hash text not null unique,
  issued_at timestamptz not null default now(),
  last_used timestamptz
);

create table private.upload_tickets (
  path text primary key,
  member_id uuid not null references public.members (id) on delete cascade,
  expires_at timestamptz not null
);

-- Acts ----------------------------------------------------------------------

create table public.acts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('constitution', 'law', 'bill', 'treaty', 'resolution', 'decree', 'amendment', 'motion')),
  number int not null check (number > 0),
  status text not null default 'tabled' check (status in ('draft', 'tabled', 'debate', 'vote', 'passed', 'signed', 'in_force', 'rejected', 'withdrawn', 'repealed', 'expired')),
  title text not null check (char_length(trim(title)) between 3 and 200),
  subtitle text check (char_length(subtitle) <= 300),
  summary text check (char_length(summary) <= 1500),
  body text check (char_length(body) <= 300000),
  pdf_path text,
  pdf_name text,
  pdf_size int,
  pdf_pages int,
  pdf_text text check (char_length(pdf_text) <= 400000),
  parties text[] not null default '{}',
  sponsor text check (char_length(sponsor) <= 120),
  introduced_on date,
  passed_on date,
  effective_on date,
  expires_on date,
  votes_for int check (votes_for >= 0),
  votes_against int check (votes_against >= 0),
  votes_abstain int check (votes_abstain >= 0),
  published boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector,
  unique (kind, number)
);

create index acts_fts_idx on public.acts using gin (fts);
create index acts_updated_idx on public.acts (updated_at desc);

create table public.act_events (
  id bigint generated always as identity primary key,
  act_id uuid not null references public.acts (id) on delete cascade,
  happened_on date not null default current_date,
  label text not null check (char_length(trim(label)) between 1 and 120),
  detail text check (char_length(detail) <= 600),
  member_name text,
  created_at timestamptz not null default now()
);

create index act_events_act_idx on public.act_events (act_id, happened_on);

create function private.acts_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.fts :=
    setweight(to_tsvector('simple'::regconfig, coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig,
      coalesce(new.subtitle, '') || ' ' || coalesce(array_to_string(new.parties, ' '), '') || ' ' ||
      coalesce(new.summary, '') || ' ' || coalesce(new.sponsor, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig,
      left(coalesce(new.body, '') || ' ' || coalesce(new.pdf_text, ''), 500000)), 'C');
  new.updated_at := now();
  return new;
end $$;

create trigger acts_touch before insert or update on public.acts
for each row execute function private.acts_touch();

-- Row level security ---------------------------------------------------------

alter table public.members enable row level security;
alter table public.acts enable row level security;
alter table public.act_events enable row level security;
alter table private.seals enable row level security;
alter table private.upload_tickets enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on public.members, public.acts, public.act_events from anon, authenticated;
revoke all on private.seals, private.upload_tickets from public, anon, authenticated;

create policy "Active members are public" on public.members
  for select to anon, authenticated using (active);

create policy "Published acts are public" on public.acts
  for select to anon, authenticated using (published);

create policy "History of published acts is public" on public.act_events
  for select to anon, authenticated
  using (exists (select 1 from public.acts a where a.id = act_id and a.published));

-- Helpers (private schema, not reachable through the API) --------------------

create function private.norm_seal(p text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create function private.hash_seal(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(private.norm_seal(p), 'UTF8')), 'hex')
$$;

-- MIL-XXXX-XXXX-XXXX from a 32 letter alphabet with no look-alike characters.
create function private.new_seal() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(12);
  s text := 'MIL';
begin
  for i in 0..11 loop
    if i % 4 = 0 then s := s || '-'; end if;
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return s;
end $$;

create function private.member_for(p_seal text) returns public.members
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  select mem.* into m
    from private.seals s
    join public.members mem on mem.id = s.member_id
   where s.seal_hash = private.hash_seal(p_seal) and mem.active;
  if not found then
    raise exception 'This seal is not recognised.' using errcode = '28000';
  end if;
  update private.seals set last_used = now() where member_id = m.id;
  return m;
end $$;

create function private.require_keeper(m public.members) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if m.role <> 'keeper' then
    raise exception 'Only the Keeper of the Seals can do that.';
  end if;
end $$;

create function private.status_label(p text) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'draft' then 'Draft'
    when 'tabled' then 'Tabled in Parliament'
    when 'debate' then 'Opened for debate'
    when 'vote' then 'Put to the vote'
    when 'passed' then 'Passed by Parliament'
    when 'signed' then 'Signed'
    when 'in_force' then 'Entered into force'
    when 'rejected' then 'Rejected'
    when 'withdrawn' then 'Withdrawn'
    when 'repealed' then 'Repealed'
    when 'expired' then 'Expired'
    else p end
$$;

create function private.slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p, '')), 'àáâãäåèéêëìíîïòóôõöùúûüçñşğıß', 'aaaaaaeeeeiiiiooooouuuucnsgis'),
    '[^a-z0-9]+', '-', 'g')), 90)
$$;

create function private.act_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (to_jsonb(a) - 'fts') || jsonb_build_object('events', coalesce((
    select jsonb_agg(to_jsonb(e) order by e.happened_on, e.id)
      from public.act_events e where e.act_id = a.id), '[]'::jsonb))
  from public.acts a where a.id = p_id
$$;

create function private.ticket_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.upload_tickets t where t.path = p_name and t.expires_at > now())
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.ticket_ok(text) to anon, authenticated;

-- Portal functions (called by MPs with their seal) ---------------------------

create function public.portal_me(p_seal text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return to_jsonb(private.member_for(p_seal));
end $$;

create function public.portal_acts(p_seal text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.member_for(p_seal);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'slug', a.slug, 'kind', a.kind, 'number', a.number, 'status', a.status,
      'title', a.title, 'subtitle', a.subtitle, 'published', a.published, 'updated_at', a.updated_at,
      'introduced_on', a.introduced_on, 'passed_on', a.passed_on, 'has_pdf', a.pdf_path is not null,
      'has_text', a.body is not null, 'created_by', a.created_by
    ) order by a.updated_at desc)
    from public.acts a), '[]'::jsonb);
end $$;

create function public.portal_act(p_seal text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
begin
  perform private.member_for(p_seal);
  r := private.act_json(p_id);
  if r is null then
    raise exception 'That act could not be found.';
  end if;
  return r;
end $$;

create function public.portal_save_act(p_seal text, p_act jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
  v_id uuid := nullif(p_act ->> 'id', '')::uuid;
  v_kind text := p_act ->> 'kind';
  v_status text := coalesce(nullif(p_act ->> 'status', ''), 'tabled');
  v_parties text[] := coalesce(array(
    select trim(x) from jsonb_array_elements_text(coalesce(p_act -> 'parties', '[]'::jsonb)) x
     where trim(x) <> ''), '{}');
  v_old public.acts;
  v_new public.acts;
  v_num int;
begin
  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('act-number:' || coalesce(v_kind, '')));
    select coalesce(max(number), 0) + 1 into v_num from public.acts where kind = v_kind;
  else
    select * into v_old from public.acts where id = v_id for update;
    if not found then
      raise exception 'That act could not be found.';
    end if;
    v_num := v_old.number;
    if v_kind is distinct from v_old.kind then
      perform pg_advisory_xact_lock(hashtext('act-number:' || coalesce(v_kind, '')));
      select coalesce(max(number), 0) + 1 into v_num from public.acts where kind = v_kind;
    end if;
  end if;

  if v_id is null then
    insert into public.acts (slug, kind, number, status, title, published, created_by, updated_by)
    values (private.slugify(v_kind || '-' || v_num || '-' || coalesce(p_act ->> 'title', '')),
            v_kind, v_num, v_status, trim(coalesce(p_act ->> 'title', '')), true, m.id, m.id)
    returning id into v_id;
  end if;

  update public.acts set
    kind = v_kind,
    number = v_num,
    status = v_status,
    title = trim(coalesce(p_act ->> 'title', '')),
    subtitle = nullif(trim(p_act ->> 'subtitle'), ''),
    summary = nullif(trim(p_act ->> 'summary'), ''),
    body = nullif(trim(p_act ->> 'body'), ''),
    pdf_path = nullif(p_act ->> 'pdf_path', ''),
    pdf_name = nullif(p_act ->> 'pdf_name', ''),
    pdf_size = nullif(p_act ->> 'pdf_size', '')::int,
    pdf_pages = nullif(p_act ->> 'pdf_pages', '')::int,
    pdf_text = case when p_act ? 'pdf_text' then nullif(p_act ->> 'pdf_text', '') else pdf_text end,
    parties = v_parties,
    sponsor = nullif(trim(p_act ->> 'sponsor'), ''),
    introduced_on = nullif(p_act ->> 'introduced_on', '')::date,
    passed_on = nullif(p_act ->> 'passed_on', '')::date,
    effective_on = nullif(p_act ->> 'effective_on', '')::date,
    expires_on = nullif(p_act ->> 'expires_on', '')::date,
    votes_for = nullif(p_act ->> 'votes_for', '')::int,
    votes_against = nullif(p_act ->> 'votes_against', '')::int,
    votes_abstain = nullif(p_act ->> 'votes_abstain', '')::int,
    published = coalesce((p_act ->> 'published')::boolean, true),
    updated_by = m.id
  where id = v_id
  returning * into v_new;

  if v_old.id is null then
    insert into public.act_events (act_id, happened_on, label, member_name)
    values (v_id, coalesce(v_new.introduced_on, current_date), 'Entered in the register', m.name);
  end if;

  if v_old.id is null and v_new.status not in ('draft', 'tabled')
     or v_old.id is not null and v_new.status is distinct from v_old.status then
    insert into public.act_events (act_id, happened_on, label, member_name)
    values (v_id,
            case v_new.status
              when 'passed' then coalesce(v_new.passed_on, current_date)
              when 'in_force' then coalesce(v_new.effective_on, current_date)
              when 'tabled' then coalesce(v_new.introduced_on, current_date)
              else current_date end,
            private.status_label(v_new.status), m.name);
  end if;

  if v_old.id is not null and (v_new.body is distinct from v_old.body or v_new.pdf_path is distinct from v_old.pdf_path) then
    insert into public.act_events (act_id, happened_on, label, member_name)
    values (v_id, current_date, 'Text amended', m.name);
  end if;

  return private.act_json(v_id);
end $$;

create function public.portal_delete_act(p_seal text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
begin
  delete from public.acts where id = p_id and (m.role = 'keeper' or created_by = m.id);
  if not found then
    raise exception 'Only the Keeper of the Seals or the member who entered this act can delete it.';
  end if;
end $$;

create function public.portal_add_event(p_seal text, p_act_id uuid, p_date date, p_label text, p_detail text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
begin
  if not exists (select 1 from public.acts where id = p_act_id) then
    raise exception 'That act could not be found.';
  end if;
  insert into public.act_events (act_id, happened_on, label, detail, member_name)
  values (p_act_id, coalesce(p_date, current_date), trim(p_label), nullif(trim(p_detail), ''), m.name);
  return private.act_json(p_act_id);
end $$;

create function public.portal_delete_event(p_seal text, p_event_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_act uuid;
begin
  perform private.member_for(p_seal);
  delete from public.act_events where id = p_event_id returning act_id into v_act;
  if v_act is null then
    raise exception 'That entry could not be found.';
  end if;
  return private.act_json(v_act);
end $$;

create function public.portal_upload_ticket(p_seal text, p_filename text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
  v_name text := private.slugify(regexp_replace(coalesce(p_filename, ''), '\.pdf$', '', 'i'));
  v_path text;
begin
  if v_name = '' then v_name := 'document'; end if;
  v_path := gen_random_uuid()::text || '/' || v_name || '.pdf';
  delete from private.upload_tickets where expires_at < now();
  insert into private.upload_tickets (path, member_id, expires_at)
  values (v_path, m.id, now() + interval '30 minutes');
  return v_path;
end $$;

create function public.portal_members(p_seal text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
begin
  perform private.require_keeper(m);
  return coalesce((
    select jsonb_agg(to_jsonb(x) || jsonb_build_object('last_used', s.last_used, 'issued_at', s.issued_at)
                     order by x.active desc, x.role, x.name)
      from public.members x left join private.seals s on s.member_id = x.id), '[]'::jsonb);
end $$;

create function public.portal_add_member(p_seal text, p_member jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
  v_seal text := private.new_seal();
  v_new public.members;
begin
  perform private.require_keeper(m);
  insert into public.members (name, title, party, bio, role)
  values (trim(coalesce(p_member ->> 'name', '')),
          coalesce(nullif(trim(p_member ->> 'title'), ''), 'Member of Parliament'),
          nullif(trim(p_member ->> 'party'), ''),
          nullif(trim(p_member ->> 'bio'), ''),
          coalesce(nullif(p_member ->> 'role', ''), 'mp'))
  returning * into v_new;
  insert into private.seals (member_id, seal_hash) values (v_new.id, private.hash_seal(v_seal));
  return jsonb_build_object('member', to_jsonb(v_new), 'seal', v_seal);
end $$;

create function public.portal_update_member(p_seal text, p_member jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
  v_id uuid := (p_member ->> 'id')::uuid;
  v_other boolean;
  v_new public.members;
begin
  v_other := v_id is distinct from m.id;
  if v_other then
    perform private.require_keeper(m);
  end if;
  update public.members set
    name = coalesce(nullif(trim(p_member ->> 'name'), ''), name),
    title = case when p_member ? 'title' then coalesce(nullif(trim(p_member ->> 'title'), ''), 'Member of Parliament') else title end,
    party = case when p_member ? 'party' then nullif(trim(p_member ->> 'party'), '') else party end,
    bio = case when p_member ? 'bio' then nullif(trim(p_member ->> 'bio'), '') else bio end,
    role = case when v_other and p_member ? 'role' then p_member ->> 'role' else role end,
    active = case when v_other and p_member ? 'active' then (p_member ->> 'active')::boolean else active end
  where id = v_id
  returning * into v_new;
  if v_new.id is null then
    raise exception 'That member could not be found.';
  end if;
  return to_jsonb(v_new);
end $$;

create function public.portal_new_seal(p_seal text, p_member_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m public.members := private.member_for(p_seal);
  v_seal text := private.new_seal();
begin
  if p_member_id is distinct from m.id then
    perform private.require_keeper(m);
  end if;
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'That member could not be found.';
  end if;
  insert into private.seals (member_id, seal_hash) values (p_member_id, private.hash_seal(v_seal))
  on conflict (member_id) do update set seal_hash = excluded.seal_hash, issued_at = now(), last_used = null;
  return v_seal;
end $$;

-- Public search ---------------------------------------------------------------

create function public.search_acts(q text)
returns table (
  id uuid, slug text, kind text, number int, status text, title text, subtitle text,
  parties text[], introduced_on date, passed_on date, snippet text, rank real
)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_q tsquery;
begin
  select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
    into v_q
    from regexp_split_to_table(lower(coalesce(q, '')), '[^[:alnum:]]+') w
   where w <> '';
  if v_q is null then
    return;
  end if;
  return query
    select a.id, a.slug, a.kind, a.number, a.status, a.title, a.subtitle, a.parties,
           a.introduced_on, a.passed_on,
           ts_headline('simple',
             regexp_replace(coalesce(a.summary, '') || ' ' || coalesce(a.body, a.pdf_text, ''), '[#>*|_~]+', ' ', 'g'),
             v_q, 'StartSel=[[, StopSel=]], MaxWords=30, MinWords=12, MaxFragments=2, FragmentDelimiter=" ... "'),
           ts_rank(a.fts, v_q)
      from public.acts a
     where a.published and a.fts @@ v_q
     order by ts_rank(a.fts, v_q) desc, a.updated_at desc
     limit 50;
end $$;

-- PDF storage -------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', true, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "Members upload documents with a ticket" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'documents' and private.ticket_ok(name));
