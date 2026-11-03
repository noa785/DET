-- DET: run the Google Sheets sync every 5 minutes (Systems Engineering, Automation, Governance).
-- Paste all of this into Supabase > SQL Editor and press Run, once.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- A secret only the database and DET know; nobody has to copy it.
create table if not exists public.det_sync_secret (id int primary key default 1, value text not null);
alter table public.det_sync_secret enable row level security;
insert into public.det_sync_secret (id, value)
values (1, md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text))
on conflict (id) do nothing;

-- Remove older copies of the schedule, if any, then add the three runs (one minute apart).
select cron.unschedule(jobname) from cron.job where jobname in ('det-sheets-se', 'det-sheets-au', 'det-sheets-gov');
select cron.schedule('det-sheets-se',  '*/5 * * * *',    $$select net.http_get(url := 'https://eli-det.vercel.app/api/sync/run?file=se',  headers := jsonb_build_object('x-det-sync-token', (select value from public.det_sync_secret where id = 1)), timeout_milliseconds := 60000)$$);
select cron.schedule('det-sheets-au',  '1-59/5 * * * *', $$select net.http_get(url := 'https://eli-det.vercel.app/api/sync/run?file=au',  headers := jsonb_build_object('x-det-sync-token', (select value from public.det_sync_secret where id = 1)), timeout_milliseconds := 60000)$$);
select cron.schedule('det-sheets-gov', '2-59/5 * * * *', $$select net.http_get(url := 'https://eli-det.vercel.app/api/sync/run?file=gov', headers := jsonb_build_object('x-det-sync-token', (select value from public.det_sync_secret where id = 1)), timeout_milliseconds := 60000)$$);

select jobname, schedule from cron.job where jobname like 'det-sheets-%';
