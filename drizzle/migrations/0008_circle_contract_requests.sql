CREATE TABLE public.circle_contract_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 wallet_id text NOT NULL,
 operation text NOT NULL,
 reference_id text NOT NULL,
 phase text NOT NULL,
 contract_address text NOT NULL,
 call_data text NOT NULL,
 challenge_id text,
 transaction_id text,
 tx_hash text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, operation, reference_id, phase)
);
GRANT SELECT ON public.circle_contract_requests TO authenticated;
GRANT ALL ON public.circle_contract_requests TO service_role;
ALTER TABLE public.circle_contract_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own contract requests" ON public.circle_contract_requests FOR SELECT TO authenticated USING (user_id = auth.uid());