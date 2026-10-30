-- An opening record for one location only (data.scope = 'location', e.g. ICONSIAM's starting
-- stock taken from delivery forms) is not the business's agreed opening balances, so it must not
-- clear "opening balances not recorded" on the Overview and Business Report.
-- Rewrites just that condition in the current function definitions.
do $$
declare
  f text;
  def text;
  old_cond constant text := 'exists (select 1 from public.documents where doc_type = ''opening'' and status = ''posted'')';
  new_cond constant text := 'exists (select 1 from public.documents where doc_type = ''opening'' and status = ''posted'' and coalesce(data ->> ''scope'', '''') <> ''location'')';
begin
  foreach f in array array['public.overview_report(date, date, text)', 'public.business_report(date, date, text)'] loop
    def := pg_get_functiondef(f::regprocedure);
    if position(new_cond in def) > 0 then continue; end if;
    if position(old_cond in def) = 0 then raise exception 'opening condition not found in %', f; end if;
    execute replace(def, old_cond, new_cond);
  end loop;
end $$;
