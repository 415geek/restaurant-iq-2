-- Demo tenant: SYNTHETIC restaurant. Not a real business. Safe for public judging.
insert into public.organizations (id, name, is_demo)
values ('00000000-0000-4000-8000-000000000001', 'Demo Workspace (synthetic)', true)
on conflict (id) do nothing;

insert into public.restaurants (id, organization_id, name, neighborhood, city, region, country_code, cuisine, service_formats,
  hours_summary, price_level, cost_assumptions, objectives, pos_preference, data_mode)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'Golden Gate Noodle House (sample)',
  'Inner Sunset', 'San Francisco', 'CA', 'US',
  'Taiwanese / Chinese noodles',
  array['dine_in','takeout','third_party_delivery'],
  'Tue–Sun 11:00–21:00, closed Mon',
  2,
  '{"avg_ticket": 24, "food_cost_pct": 0.32, "labor_cost_per_hour": 22, "packaging_per_order": 0.85, "delivery_commission_pct": 0.25, "card_fee_pct": 0.029, "seats": 36, "kitchen_peak_orders_per_hour": 40}'::jsonb,
  '{"primary": "grow weekday lunch and off-peak revenue without adding staff", "constraints": ["no second fryer", "2 cooks on weekdays", "no liquor license"], "horizon_weeks": 6}'::jsonb,
  'none',
  'sample'
) on conflict (id) do nothing;

insert into public.menu_items (restaurant_id, name, category, price, food_cost, source, is_signature) values
  ('00000000-0000-4000-8000-000000000101', 'Beef Noodle Soup', 'noodles', 18.50, 6.40, 'seed', true),
  ('00000000-0000-4000-8000-000000000101', 'Dan Dan Noodles', 'noodles', 15.00, 4.10, 'seed', true),
  ('00000000-0000-4000-8000-000000000101', 'Scallion Pancake', 'small_plates', 8.00, 1.90, 'seed', false),
  ('00000000-0000-4000-8000-000000000101', 'Three Cup Chicken', 'mains', 19.00, 6.80, 'seed', false),
  ('00000000-0000-4000-8000-000000000101', 'Braised Pork Rice', 'rice', 14.50, 4.30, 'seed', false),
  ('00000000-0000-4000-8000-000000000101', 'Cucumber Salad', 'small_plates', 7.00, 1.60, 'seed', false),
  ('00000000-0000-4000-8000-000000000101', 'Boba Milk Tea', 'drinks', 6.50, 1.40, 'seed', false),
  ('00000000-0000-4000-8000-000000000101', 'Vegetarian Mapo Tofu', 'mains', 15.50, 3.90, 'seed', false)
on conflict do nothing;
