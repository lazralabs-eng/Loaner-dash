-- Loaner Command Center: loaner_requests and loaner_audit
-- Run in Supabase SQL Editor or via supabase db push

-- loaner_requests: tracks each loaner from request through return
CREATE TABLE IF NOT EXISTS loaner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT DEFAULT 'infleet' CHECK (request_type IN ('infleet', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'active', 'return_requested', 'confirmed', 'closed'
  )),

  -- Vehicle (from Dealerware or manual)
  vin TEXT,
  year INT,
  make TEXT,
  model TEXT,
  color TEXT,
  license_plate TEXT,
  mileage_at_infleet INT,
  current_mileage INT,
  mileage_at_defleet INT,

  -- Customer
  customer_id TEXT,
  customer_name TEXT,
  deal_id TEXT,
  notes TEXT,

  -- Infleet (webhook or manual)
  infleet_approved_at TIMESTAMPTZ,
  infleet_approved_by TEXT,
  infleet_dealer_matched BOOLEAN DEFAULT FALSE,
  date_infleet DATE,

  -- Defleet (webhook or manual)
  defleet_dealer_timestamp TIMESTAMPTZ,
  defleet_dealer_matched BOOLEAN DEFAULT FALSE,
  defleet_confirmed_at TIMESTAMPTZ,
  defleet_confirmed_by TEXT,
  vehicle_condition TEXT,
  defleet_notes TEXT,

  -- Manual request flow
  requested_by TEXT,
  requested_at TIMESTAMPTZ,
  reason TEXT,

  -- Cost control (can be computed by app or triggers)
  exceeds_duration BOOLEAN DEFAULT FALSE,
  exceeds_mileage BOOLEAN DEFAULT FALSE,
  mileage_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Defleet lookup: find active loaner by VIN
CREATE INDEX IF NOT EXISTS idx_loaner_requests_vin_status
  ON loaner_requests (vin, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_loaner_requests_status
  ON loaner_requests (status);

-- loaner_audit: event log for matching and accountability
CREATE TABLE IF NOT EXISTS loaner_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  loaner_request_id UUID REFERENCES loaner_requests (id) ON DELETE SET NULL,
  actor TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loaner_audit_event
  ON loaner_audit (event);
CREATE INDEX IF NOT EXISTS idx_loaner_audit_loaner_request_id
  ON loaner_audit (loaner_request_id);

-- RLS
ALTER TABLE loaner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loaner_audit ENABLE ROW LEVEL SECURITY;

-- Service role / worker uses service key and bypasses RLS by default when using service_role key.
-- For anon/authenticated users, allow read/write as needed (adjust for your auth model).
CREATE POLICY "Allow authenticated read loaner_requests"
  ON loaner_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert loaner_requests"
  ON loaner_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update loaner_requests"
  ON loaner_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read loaner_audit"
  ON loaner_audit FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert loaner_audit"
  ON loaner_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role can do everything (worker uses SUPABASE_KEY which should be service_role for inserts)
CREATE POLICY "Allow service role all loaner_requests"
  ON loaner_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role all loaner_audit"
  ON loaner_audit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loaner_requests_updated_at
  BEFORE UPDATE ON loaner_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE loaner_requests IS 'Loaner Command Center: requests from infleet through defleet';
COMMENT ON TABLE loaner_audit IS 'Audit log for webhook matching and user actions';
