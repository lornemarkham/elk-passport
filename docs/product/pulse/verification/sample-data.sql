-- Realistic sample data for People's Pulse on the LOCAL verification stack
-- only (docs/product/pulse/PEOPLES-PULSE.md, "Verification"). Never apply
-- to a real project: the rows are invented. Votes are spread over the last
-- two days, across provinces, with a referral circle on the first Pulse.

INSERT INTO passport_pulses (id, status, data, expires_at, creator, net, created_at) VALUES
('dstime26', 'live', '{"question":"Should Canada stay on daylight time all year?","description":"Changing the clocks twice a year is back in the news. BC passed a law in 2019 to stop, if its neighbours do too.","options":[{"id":"o1","label":"Yes"},{"id":"o2","label":"No"}],"claim":{"text":"A national survey reported that 65% of Canadians want to stop changing the clocks.","percent":65,"optionId":"o1","source":"Example National Survey","url":"https://example.com/daylight-survey"},"sourceUrl":null,"scope":{"kind":"canada"}}', NULL, 'seed-a', 'seed-a', now() - interval '46 hours'),
('icesheet', 'live', '{"question":"Should Vernon build a second sheet of ice?","description":null,"options":[{"id":"o1","label":"Yes"},{"id":"o2","label":"No"},{"id":"o3","label":"Not sure"}],"claim":null,"sourceUrl":null,"scope":{"kind":"city","province":"BC","city":"Vernon"}}', now() + interval '6 days', 'seed-b', 'seed-b', now() - interval '20 hours'),
('transit4', 'live', '{"question":"Would you take a bus to work if it came every 15 minutes?","description":null,"options":[{"id":"o1","label":"Yes"},{"id":"o2","label":"No"},{"id":"o3","label":"I already do"}],"claim":null,"sourceUrl":null,"scope":{"kind":"province","province":"BC"}}', NULL, 'seed-c', 'seed-c', now() - interval '5 hours')
ON CONFLICT (id) DO NOTHING;

-- Daylight time: 240 votes, 12 provinces, a circle rooted at code 'hostcode'.
INSERT INTO passport_pulse_votes (pulse_id, voter, net, option_id, circle, via, province, city, created_at)
SELECT 'dstime26', 'seed-v' || g, 'seed-n' || (g % 90),
       CASE WHEN (g * 7) % 100 < 52 THEN 'o1' ELSE 'o2' END,
       translate(lpad(to_hex(g * 2654435761 % 4294967296), 8, 'a'), '01lo', '2345'),
       CASE WHEN g <= 18 THEN 'hostcode' ELSE NULL END,
       (ARRAY['BC','BC','BC','AB','AB','ON','ON','ON','QC','QC','MB','SK','NS',NULL])[1 + g % 14],
       CASE WHEN g % 14 IN (0,1) THEN (ARRAY['Vernon','Kelowna'])[1 + g % 2] ELSE NULL END,
       now() - interval '46 hours' + (g * interval '11 minutes')
FROM generate_series(1, 240) g
ON CONFLICT DO NOTHING;

-- Ice: 63 votes, mostly Vernon.
INSERT INTO passport_pulse_votes (pulse_id, voter, net, option_id, circle, via, province, city, created_at)
SELECT 'icesheet', 'seed-w' || g, 'seed-m' || (g % 40),
       (ARRAY['o1','o1','o2','o1','o3','o2','o1'])[1 + g % 7],
       translate(lpad(to_hex(g * 2246822519 % 4294967296), 8, 'b'), '01lo', '2345'),
       NULL, CASE WHEN g % 6 = 0 THEN NULL ELSE 'BC' END,
       CASE WHEN g % 6 = 0 THEN NULL WHEN g % 4 = 0 THEN 'Coldstream' ELSE 'Vernon' END,
       now() - interval '20 hours' + (g * interval '18 minutes')
FROM generate_series(1, 63) g
ON CONFLICT DO NOTHING;

-- Transit: 21 votes in the last few hours.
INSERT INTO passport_pulse_votes (pulse_id, voter, net, option_id, circle, via, province, city, created_at)
SELECT 'transit4', 'seed-x' || g, 'seed-k' || g,
       (ARRAY['o1','o2','o3','o1'])[1 + g % 4],
       translate(lpad(to_hex(g * 3266489917 % 4294967296), 8, 'c'), '01lo', '2345'),
       NULL, 'BC', NULL, now() - interval '5 hours' + (g * interval '13 minutes')
FROM generate_series(1, 21) g
ON CONFLICT DO NOTHING;
