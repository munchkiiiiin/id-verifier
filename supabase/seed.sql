-- Seed data imported from the provided employee screenshot.
-- QR codes are generated from the row id in the app, so no separate QR asset is stored here.

insert into public.employees (
  employee_code,
  name,
  designation,
  establishment,
  expiry_date,
  is_active
)
values
  ('520601', 'ALEX SMITH', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520602', 'JORDAN JONES', 'Maintenance Personnel', 'Fashion Depot', '2026-06-30', true),
  ('520603', 'TAYLOR BROWN', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520604', 'CASEY DAVIS', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520605', 'MORGAN MILLER', 'Cashier', 'Fashion Depot', '2026-06-30', true),
  ('520606', 'SAM WILSON', 'Cashier', 'Fashion Depot', '2026-06-30', true),
  ('520607', 'CHRIS MOORE', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520608', 'PAT TAYLOR', 'Cashier', 'Fashion Depot', '2026-06-30', true),
  ('520609', 'JAMIE ANDERSON', 'Maintenance Personnel', 'Fashion Depot', '2026-06-30', true),
  ('520610', 'ROBIN THOMAS', 'Cashier/ OIC', 'Fashion Depot', '2026-06-30', true),
  ('520611', 'TERRY JACKSON', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520612', 'MOCK USER A', 'Maintenance Personnel', 'Fashion Depot', '2026-06-30', true),
  ('520613', 'MOCK USER B', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520614', 'MOCK USER C', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520615', 'MOCK USER D', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520616', 'MOCK USER E', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520617', 'MOCK USER F', 'Cashier', 'Fashion Depot', '2026-06-30', true),
  ('520618', 'MOCK USER G', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520619', 'MOCK USER H', 'Cashier', 'Fashion Depot', '2026-06-30', true),
  ('520620', 'MOCK USER I', 'Warehouse Personnel', 'Fashion Depot', '2026-06-30', true),
  ('520621', 'MOCK USER J', 'Warehouse Personnel', 'Fashion Depot', '2026-06-30', true),
  ('520622', 'MOCK USER K', 'Sales Associate', 'Fashion Depot', '2026-06-30', true),
  ('520623', 'MOCK USER L', 'Warehouse Personnel', 'Fashion Depot', '2026-06-30', true),
  ('520624', 'MOCK USER M', 'Cashier', 'Fashion Depot', '2026-06-30', true),
  ('520625', 'MOCK USER N', 'Warehouse Personnel', 'Fashion Depot', '2026-06-30', true)
on conflict (employee_code) do update set
  name = excluded.name,
  designation = excluded.designation,
  establishment = excluded.establishment,
  expiry_date = excluded.expiry_date,
  is_active = excluded.is_active,
  updated_at = now();
