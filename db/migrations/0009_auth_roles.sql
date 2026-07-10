-- =====================================================================
-- Authentification applicative : ROLES, rattachement & invitations (additif)
-- =====================================================================
-- Introduit le modele multi-utilisateur au-dessus du socle cabinet->entreprise
-- (0006). Deux roles :
--   - comptable  : possede un cabinet, voit/gere SES entreprises (0006 :
--                  entreprise.cabinet_id = auth.uid()).
--   - entreprise : utilisateur d'UNE entreprise cliente, saisit ses operations
--                  (rattachement via `membre_entreprise`).
--
-- Onboarding : le comptable INVITE l'utilisateur d'une entreprise par email
-- (`invitation`). Une entreprise ne rejoint que le cabinet qui l'a invitee
-- (couple cabinet_id / entreprise_id porte par la ligne invitation).
--
-- Reutilise set_updated_at() (0001). Conventions RLS : cf. 0001 / 0006.
-- =====================================================================

create type app_role as enum ('comptable', 'entreprise');
create type statut_invitation as enum ('en_attente', 'acceptee', 'revoquee', 'expiree');

-- ------------------------------------------------------------------
-- profil — une ligne par utilisateur Auth. SOURCE du role.
-- ------------------------------------------------------------------
create table profil (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        app_role not null default 'comptable',
  nom         text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table profil is 'Profil applicatif (role) d''un utilisateur Auth.';

create trigger trg_profil_updated
  before update on profil
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- membre_entreprise — rattache un utilisateur (role entreprise) a une entreprise
-- ------------------------------------------------------------------
create table membre_entreprise (
  user_id       uuid not null references auth.users(id) on delete cascade,
  entreprise_id uuid not null references entreprise(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, entreprise_id)
);
create index idx_membre_entreprise_entreprise on membre_entreprise (entreprise_id);

-- ------------------------------------------------------------------
-- invitation — le comptable invite l'utilisateur d'une entreprise
-- ------------------------------------------------------------------
create table invitation (
  id              uuid primary key default gen_random_uuid(),
  entreprise_id   uuid not null references entreprise(id) on delete cascade,
  cabinet_id      uuid not null references auth.users(id) on delete cascade,
  email           text not null,
  token           text not null unique,
  statut          statut_invitation not null default 'en_attente',
  invitee_user_id uuid references auth.users(id) on delete set null,
  expires_at      timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_invitation_entreprise on invitation (entreprise_id);
create index idx_invitation_email on invitation (email);

-- ------------------------------------------------------------------
-- Fonctions helper pour la RLS.
-- SECURITY DEFINER : s'executent avec les droits du proprietaire et
-- CONTOURNENT la RLS des tables interrogees -> evite la recursion des policies.
-- search_path verrouille (bonne pratique securite).
-- ------------------------------------------------------------------
create or replace function est_comptable_du(eid uuid)
  returns boolean language sql stable security definer
  set search_path = public, pg_temp as $$
  select exists (
    select 1 from entreprise e where e.id = eid and e.cabinet_id = auth.uid()
  );
$$;

create or replace function est_membre_de(eid uuid)
  returns boolean language sql stable security definer
  set search_path = public, pg_temp as $$
  select exists (
    select 1 from membre_entreprise m where m.entreprise_id = eid and m.user_id = auth.uid()
  );
$$;

create or replace function peut_acceder(eid uuid)
  returns boolean language sql stable security definer
  set search_path = public, pg_temp as $$
  select est_comptable_du(eid) or est_membre_de(eid);
$$;

create or replace function role_courant()
  returns app_role language sql stable security definer
  set search_path = public, pg_temp as $$
  select role from profil where id = auth.uid();
$$;

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
-- profil : chacun gere sa propre ligne. L'insert self permet la creation du
-- profil au 1er acces authentifie (cas confirmation email) sous le client session.
alter table profil enable row level security;
create policy profil_select_self on profil for select using (id = auth.uid());
create policy profil_insert_self on profil for insert with check (id = auth.uid());
create policy profil_update_self on profil for update
  using (id = auth.uid()) with check (id = auth.uid());

-- membre_entreprise : le membre lit ses rattachements ; le comptable lit ceux
-- de ses entreprises. (Insert/delete se font via service_role a l'invitation.)
alter table membre_entreprise enable row level security;
create policy membre_select_self on membre_entreprise for select using (user_id = auth.uid());
create policy membre_select_comptable on membre_entreprise for select using (est_comptable_du(entreprise_id));

-- invitation : gestion complete par le comptable proprietaire de l'entreprise.
-- (La lecture par token a l'acceptation passe par service_role.)
alter table invitation enable row level security;
create policy invitation_comptable_all on invitation for all
  using (est_comptable_du(entreprise_id))
  with check (est_comptable_du(entreprise_id));

-- entreprise (0006 ne couvrait que le cabinet) : le membre lit la fiche de SON
-- entreprise. Policy SELECT additionnelle (permissive => OR avec cabinet_id).
create policy entreprise_select_membre on entreprise for select using (est_membre_de(id));
