-- Add vehicle cost and RDR date to loaner_requests (run in Supabase SQL Editor if needed)
ALTER TABLE loaner_requests
ADD COLUMN IF NOT EXISTS vehicle_cost NUMERIC(12, 2);

ALTER TABLE loaner_requests
ADD COLUMN IF NOT EXISTS rdr_date DATE;

COMMENT ON COLUMN loaner_requests.vehicle_cost IS 'Vehicle cost for cost velocity tracking';
COMMENT ON COLUMN loaner_requests.rdr_date IS 'RDR Date - service loaner in-service date; timer for velocity/cost alerts';

ALTER TABLE loaner_requests
ADD COLUMN IF NOT EXISTS p_stock_number TEXT;

COMMENT ON COLUMN loaner_requests.p_stock_number IS 'P stock number assigned when loaner comes out and goes to history';
