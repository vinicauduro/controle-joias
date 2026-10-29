-- Controle de Joias: tabela da nuvem.
-- Rode no Supabase em SQL Editor › New query › Run. Pode rodar de novo sem perder nada.
--
-- Cada peça, venda, cliente, fornecedor e a configuração viram uma linha, com o
-- conteúdo em "dados". Cada pessoa logada só enxerga e altera as próprias linhas.

create table if not exists public.joias_registros (
  dono          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  colecao       text        not null,
  id            text        not null,
  dados         jsonb,
  excluido      boolean     not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (dono, colecao, id)
);

create index if not exists joias_registros_sincronia on public.joias_registros (dono, atualizado_em);

-- O horário da alteração é sempre o do servidor: é por ele que cada aparelho
-- descobre o que mudou desde a última vez.
create or replace function public.joias_marcar_alteracao() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists joias_registros_alteracao on public.joias_registros;
create trigger joias_registros_alteracao
  before insert or update on public.joias_registros
  for each row execute function public.joias_marcar_alteracao();

alter table public.joias_registros enable row level security;

drop policy if exists "joias: ver as minhas" on public.joias_registros;
create policy "joias: ver as minhas" on public.joias_registros
  for select to authenticated using (dono = auth.uid());

drop policy if exists "joias: criar as minhas" on public.joias_registros;
create policy "joias: criar as minhas" on public.joias_registros
  for insert to authenticated with check (dono = auth.uid());

drop policy if exists "joias: alterar as minhas" on public.joias_registros;
create policy "joias: alterar as minhas" on public.joias_registros
  for update to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists "joias: apagar as minhas" on public.joias_registros;
create policy "joias: apagar as minhas" on public.joias_registros
  for delete to authenticated using (dono = auth.uid());

grant select, insert, update, delete on public.joias_registros to authenticated;
