-- Demo dataset for the CRM module.
-- The frontend used to hold this data in memory; it now lives in the database.
-- Run it with psql against the erp_db database:
--   psql -U postgres -d erp_db -f seed-demo-crm.sql
-- The ids are the ones the other demo modules (invoices, sales, purchases)
-- already reference, so the whole demo keeps working.

\set tenant_id '1419d5d7-6718-4aeb-b1ed-9dff79dacfb0'

INSERT INTO crm_partners (id, tenant_id, kind, name, parent_id, is_customer, is_supplier, tax_id, email, phone, job_title, address_street, address_city, address_country, active, notes, created_at, updated_at) VALUES
('f4a1c2e0-8a01-4a10-9d21-000000000001', :'tenant_id', 'COMPANY', 'Acme Corp', NULL, true, false, '12034567/A/M/000', 'billing@acme-corp.com', '+1 415 555 0110', '', '120 Market Street', 'San Francisco', 'US', true, 'Frame contract renewed annually.', '2026-01-12T09:00:00Z', '2026-01-12T09:00:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000002', :'tenant_id', 'COMPANY', 'Global Ltd', NULL, true, false, '09876543/B/M/000', 'accounts@global-ltd.co.uk', '+44 20 7946 0001', '', '5 Bishopsgate', 'London', 'GB', true, '', '2026-01-20T11:30:00Z', '2026-01-20T11:30:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000003', :'tenant_id', 'COMPANY', 'Nord Industries', NULL, false, true, '78-3345678', 'purchasing@nord-industries.de', '+49 30 5550 0142', '', 'Wiener Strasse 12', 'Berlin', 'DE', true, 'Preferred supplier for raw material A.', '2026-02-03T08:15:00Z', '2026-02-03T08:15:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000004', :'tenant_id', 'COMPANY', 'Atlas Digital', NULL, true, true, '08812345/A/M/000', 'hello@atlasdigital.tn', '+216 71 962 000', '', '12 Rue du Lac Leman', 'Tunis', 'TN', true, 'Client and supplier: we resell their hosting.', '2026-02-14T14:45:00Z', '2026-02-14T14:45:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000005', :'tenant_id', 'COMPANY', 'Delta Logistics', NULL, false, true, '11998877/C/M/000', 'ops@deltalogistics.fr', '+33 4 72 55 00 12', '', '8 Quai Perrache', 'Lyon', 'FR', true, '', '2026-02-26T10:05:00Z', '2026-02-26T10:05:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000006', :'tenant_id', 'COMPANY', 'Horizon Media', NULL, true, false, '22334455/D/M/000', 'finance@horizonmedia.com', '+1 212 555 0177', '', '450 Broadway', 'New York', 'US', true, '', '2026-03-05T16:20:00Z', '2026-03-05T16:20:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000007', :'tenant_id', 'COMPANY', 'Verde Manufacturing', NULL, false, true, '55667788/E/M/000', 'sales@verde-mfg.com', '+1 312 555 0190', '', '900 W Randolph St', 'Chicago', 'US', true, 'Leads time of 3 weeks.', '2026-03-18T07:40:00Z', '2026-03-18T07:40:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000008', :'tenant_id', 'COMPANY', 'Societe des Thermes', NULL, true, false, '04455667/F/M/000', 'contact@thermes.tn', '+216 73 224 100', '', 'Avenue Haffouz', 'Sousse', 'TN', false, 'Archived: contract ended in March.', '2026-03-22T12:00:00Z', '2026-04-01T12:00:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000009', :'tenant_id', 'PERSON', 'John Smith', 'f4a1c2e0-8a01-4a10-9d21-000000000001', true, false, '', 'john.smith@acme-corp.com', '+1 415 555 0111', 'Procurement Manager', '120 Market Street', 'San Francisco', 'US', true, 'Main decision maker for renewals.', '2026-04-02T09:10:00Z', '2026-04-02T09:10:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000010', :'tenant_id', 'PERSON', 'Leila Ben Salah', 'f4a1c2e0-8a01-4a10-9d21-000000000004', true, true, '', 'leila.bensalah@atlasdigital.tn', '+216 22 334 556', 'Managing Director', '12 Rue du Lac Leman', 'Tunis', 'TN', true, '', '2026-04-11T13:25:00Z', '2026-04-11T13:25:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000011', :'tenant_id', 'PERSON', 'Marc Dupont', 'f4a1c2e0-8a01-4a10-9d21-000000000006', false, false, '', 'marc.dupont@old-agency.com', '+1 646 555 0133', 'Former Account Contact', '450 Broadway', 'New York', 'US', false, 'Archived: left the company.', '2026-04-19T15:55:00Z', '2026-05-02T15:55:00Z'),
('f4a1c2e0-8a01-4a10-9d21-000000000012', :'tenant_id', 'PERSON', 'Sara Nguyen', 'f4a1c2e0-8a01-4a10-9d21-000000000002', true, false, '', 'sara.nguyen@global-ltd.co.uk', '+44 20 7946 0002', 'Finance Director', '5 Bishopsgate', 'London', 'GB', true, 'Receives all invoices.', '2026-05-06T10:35:00Z', '2026-05-06T10:35:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_leads (id, tenant_id, name, company, email, phone, source, status, converted_partner_id, notes, created_at, updated_at) VALUES
('d4000000-0000-4000-8000-000000000001', :'tenant_id', 'Nadia Trabelsi', 'Carthage Logistics', 'nadia.trabelsi@carthage-log.tn', '+216 71 000 001', 'WEBSITE', 'NEW', NULL, 'Asked for a demo through the contact form.', '2026-10-18T09:00:00Z', '2026-10-18T09:00:00Z'),
('d4000000-0000-4000-8000-000000000002', :'tenant_id', 'Paul Schmidt', 'Rhein Supplies GmbH', 'paul.schmidt@rhein-supplies.de', '+49 30 1122 3344', 'REFERRAL', 'CONTACTED', NULL, 'Referred by Global Ltd. Needs a quote for 3 subsidiaries.', '2026-10-14T14:20:00Z', '2026-10-20T10:05:00Z'),
('d4000000-0000-4000-8000-000000000003', :'tenant_id', 'Fatma Gharbi', '', 'fatma.gharbi@mailbox.tn', '+216 55 889 900', 'EVENT', 'QUALIFIED', NULL, 'Met at the Tunis tech expo. Freelance consultant, self-employed.', '2026-10-08T08:40:00Z', '2026-10-16T16:30:00Z'),
('d4000000-0000-4000-8000-000000000004', :'tenant_id', 'Tom Rivera', 'Broadway Media', 'tom.rivera@broadwaymedia.us', '+1 212 555 0177', 'COLD_CALL', 'LOST', NULL, 'Already using a competitor suite, not interested.', '2026-09-28T11:10:00Z', '2026-10-05T09:45:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_opportunities (id, tenant_id, name, customer_id, stage, amount, currency, expected_close_date, notes, origin_lead_id, created_at, updated_at) VALUES
('d5000000-0000-4000-8000-000000000001', :'tenant_id', 'Carthage Logistics rollout', 'f4a1c2e0-8a01-4a10-9d21-000000000001', 'QUALIFICATION', 24000.00, 'USD', '2026-11-20', 'Full suite demo requested, waiting for the IT steering committee.', NULL, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('d5000000-0000-4000-8000-000000000002', :'tenant_id', 'Global Ltd expansion', 'f4a1c2e0-8a01-4a10-9d21-000000000002', 'PROPOSAL', 18500.00, 'USD', '2026-11-05', 'Proposal sent for the purchases + stock modules.', NULL, '2026-10-10T09:30:00Z', '2026-10-19T15:10:00Z'),
('d5000000-0000-4000-8000-000000000003', :'tenant_id', 'Atlas Digital margin gains', 'f4a1c2e0-8a01-4a10-9d21-000000000004', 'NEGOTIATION', 9800.00, 'USD', '2026-10-28', 'Negotiating the invoicing settings add-on.', NULL, '2026-10-05T08:15:00Z', '2026-10-21T11:45:00Z'),
('d5000000-0000-4000-8000-000000000004', :'tenant_id', 'Horizon Media founder pack', 'f4a1c2e0-8a01-4a10-9d21-000000000006', 'WON', 6400.00, 'USD', '2026-10-02', 'Signed for sales + invoicing.', NULL, '2026-09-12T09:00:00Z', '2026-10-02T17:00:00Z'),
('d5000000-0000-4000-8000-000000000005', :'tenant_id', 'Thermes stock revamp', 'f4a1c2e0-8a01-4a10-9d21-000000000008', 'WON', 5200.00, 'USD', '2026-09-25', 'Stock + reports modules, yearly plan.', NULL, '2026-09-01T10:00:00Z', '2026-09-25T16:30:00Z'),
('d5000000-0000-4000-8000-000000000006', :'tenant_id', 'Broadway Media suite', 'f4a1c2e0-8a01-4a10-9d21-000000000001', 'LOST', 15000.00, 'USD', '2026-10-12', 'Lost to a competing offer.', NULL, '2026-09-08T14:00:00Z', '2026-10-12T18:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_interactions (id, tenant_id, partner_id, type, interaction_date, subject, notes, reminder_at, reminder_done, created_at) VALUES
('d6000000-0000-4000-8000-000000000001', :'tenant_id', 'f4a1c2e0-8a01-4a10-9d21-000000000004', 'CALL', '2026-10-21', 'Follow-up on the invoicing add-on', 'They want stamp duty handling for B2C invoices.', '2026-10-27', false, '2026-10-21T09:15:00Z'),
('d6000000-0000-4000-8000-000000000002', :'tenant_id', 'f4a1c2e0-8a01-4a10-9d21-000000000004', 'MEETING', '2026-10-14', 'Quarterly business review', 'Renewal confirmed for next year, upsell discussion started.', NULL, false, '2026-10-14T16:40:00Z'),
('d6000000-0000-4000-8000-000000000003', :'tenant_id', 'f4a1c2e0-8a01-4a10-9d21-000000000002', 'EMAIL', '2026-10-19', 'Purchase modules proposal sent', 'Sent the pricing for the 3 subsidiaries.', '2026-10-24', false, '2026-10-19T11:05:00Z'),
('d6000000-0000-4000-8000-000000000004', :'tenant_id', 'f4a1c2e0-8a01-4a10-9d21-000000000002', 'NOTE', '2026-10-12', 'Internal note: sensitive to discounts', 'Finance director pushes hard on multi-year discount.', NULL, false, '2026-10-12T13:20:00Z'),
('d6000000-0000-4000-8000-000000000005', :'tenant_id', 'f4a1c2e0-8a01-4a10-9d21-000000000006', 'CALL', '2026-10-02', 'Contract signature call', 'Founder pack signed, onboarding scheduled.', NULL, false, '2026-10-02T15:55:00Z'),
('d6000000-0000-4000-8000-000000000006', :'tenant_id', 'f4a1c2e0-8a01-4a10-9d21-000000000001', 'MEETING', '2026-10-22', 'Full suite demo', 'IT steering committee asked for a second session.', '2026-11-03', false, '2026-10-22T10:30:00Z')
ON CONFLICT (id) DO NOTHING;
