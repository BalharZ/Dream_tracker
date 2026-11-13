-- S72: negative motivation image on dreams ("the opposite of my dream").
-- Reminders show it, taking turns with the dream image, when a habit for the
-- dream gets no progress for a week (a month for monthly habits).
alter table public.dreams add column if not exists negative_image text;
