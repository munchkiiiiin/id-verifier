-- Seed data imported from the provided employee screenshot.
-- QR codes are generated from the row id in the app, so no separate QR asset is stored here.

insert into public.employees (
  employee_code,
  name,
  department,
  expiry_date,
  is_active
)
values
  ('520601', 'FADZRANA ASIDDIN', 'Sales Associate', '2026-06-30', true),
  ('520602', 'JONES BALACIO', 'Maintenance Personnel', '2026-06-30', true),
  ('520603', 'MARY BANTAYAO', 'Sales Associate', '2026-06-30', true),
  ('520604', 'ENGRACIA BERCEDE', 'Sales Associate', '2026-06-30', true),
  ('520605', 'SALMAH BORJONGAN', 'Cashier', '2026-06-30', true),
  ('520606', 'IRIN CHIN CAÑETE', 'Cashier', '2026-06-30', true),
  ('520607', 'ROSALIE CAOILE', 'Sales Associate', '2026-06-30', true),
  ('520608', 'RHEA GENOGIN', 'Cashier', '2026-06-30', true),
  ('520609', 'JALAL IMRAN', 'Maintenance Personnel', '2026-06-30', true),
  ('520610', 'LOWELA LANTACA', 'Cashier/ OIC', '2026-06-30', true),
  ('520611', 'CRISTY MARIE LASWE', 'Sales Associate', '2026-06-30', true),
  ('520612', 'MAMA MAMAD', 'Maintenance Personnel', '2026-06-30', true),
  ('520613', 'NICOL MATINA-AO', 'Sales Associate', '2026-06-30', true),
  ('520614', 'LOVEMIE MUNDO', 'Sales Associate', '2026-06-30', true),
  ('520615', 'CHERELL NUEVO', 'Sales Associate', '2026-06-30', true),
  ('520616', 'JENNIFER OROSCO', 'Sales Associate', '2026-06-30', true),
  ('520617', 'JONALYN PASLANGAN', 'Cashier', '2026-06-30', true),
  ('520618', 'MARGIE QUIOBE', 'Sales Associate', '2026-06-30', true),
  ('520619', 'AIRAH SAJOL', 'Cashier', '2026-06-30', true),
  ('520620', 'DANTE SAN JOSE', 'Warehouse Personnel', '2026-06-30', true),
  ('520621', 'RENZ SERAÑO', 'Warehouse Personnel', '2026-06-30', true),
  ('520622', 'JOY SUAREZ', 'Sales Associate', '2026-06-30', true),
  ('520623', 'ARGIE TISADO', 'Warehouse Personnel', '2026-06-30', true),
  ('520624', 'NENITA UDAC', 'Cashier', '2026-06-30', true),
  ('520625', 'JASON VALERA', 'Warehouse Personnel', '2026-06-30', true)
on conflict (employee_code) do update set
  name = excluded.name,
  department = excluded.department,
  expiry_date = excluded.expiry_date,
  is_active = excluded.is_active,
  updated_at = now();
