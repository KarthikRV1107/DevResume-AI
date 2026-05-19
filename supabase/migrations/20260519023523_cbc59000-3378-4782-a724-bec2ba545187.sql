
-- 1) Remove privilege-escalation UPDATE policy on user_credits
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;

-- 2) Server-side credit deduction function (SECURITY DEFINER, runs as owner)
CREATE OR REPLACE FUNCTION public.deduct_user_credit()
RETURNS TABLE(total_credits integer, used_credits integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_credits
     SET used_credits = used_credits + 1,
         updated_at = now()
   WHERE user_id = v_user
     AND used_credits < total_credits
  RETURNING user_credits.total_credits, user_credits.used_credits
    INTO total_credits, used_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credits remaining';
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_user_credit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_user_credit() TO authenticated;

-- 3) Lock down trigger-only SECURITY DEFINER functions from API exposure
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_credits() FROM PUBLIC, anon, authenticated;

-- 4) Remove broad public listing policy on storage.objects for avatars bucket.
--    The bucket remains public, so files are still accessible via their public URL.
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
