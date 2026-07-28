-- 002_dashboard_view.sql
-- Chunk 1.1 — materialized view so the dashboard is a single fast query
-- instead of scanning every transaction on every page load.
-- Run this SECOND, after 001_schema.sql.

create materialized view dashboard_current_month as
select
  t.direction,
  c.id    as category_id,
  c.name  as category_name,
  c.icon  as category_icon,
  c.color as category_color,
  sum(t.amount) as total,
  count(*)      as tx_count
from transactions t
left join merchants  m on m.id = t.merchant_id
left join categories c on c.id = m.category_id
where t.direction <> 'transfer'
  and date_trunc('month', t.date) = date_trunc('month', current_date)
group by t.direction, c.id, c.name, c.icon, c.color;

create index idx_dashboard_current_month_direction on dashboard_current_month(direction);

-- This view goes stale as new transactions land. Refresh it with:
--   refresh materialized view dashboard_current_month;
-- The sync script (Phase 2) refreshes it after every run; the nightly
-- cron (Phase 4) refreshes it again in case anything else changed.
