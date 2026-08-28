-- Migration: sync default users to Supabase
-- Upserts default user list into the 'users' table.
-- Columns: id, name, store_name, email, phone, region, district

INSERT INTO users (id, name, store_name, email, phone, region, district) VALUES
  ('user-102', 'Joko Supriyanto', 'Toko Pak Joko', 'joko.kra@gmail.com', '085725012345', 'karanganyar', 'Jaten'),
  ('user-103', 'Rian Kurniawan', 'Rian Gadget Kartasura', 'rian.gadget@gmail.com', '089678123456', 'sukoharjo', 'Kartasura'),
  ('user-104', 'Siti Aisyah', 'Aisyah''s Crafts Solo', 'aisyah.crafts@example.com', '081234567890', 'solo', 'Mojosongo'),
  ('user-1787309560138', 'Ridho Hari Nugroho', 'Zamir Shop', 'ridho.harinugroho@gmail.com', '081251018765', 'karanganyar', 'Tawangmangi')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  store_name = EXCLUDED.store_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  region = EXCLUDED.region,
  district = EXCLUDED.district;
