-- 1. Wallet addresses: signed-in users only (anon loses these columns)
REVOKE SELECT (wallet_address) ON public.profiles FROM anon;

-- 2. has_role: answer only for the caller, or for trusted server-side roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent role probing: an end user may only ask about themselves.
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 3. Storage: uploads must be image files inside the uploader's own folder
DROP POLICY IF EXISTS "Authenticated users can upload ad photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload ad photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ad-photos'
  AND owner = auth.uid()
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','avif','heic')
);
