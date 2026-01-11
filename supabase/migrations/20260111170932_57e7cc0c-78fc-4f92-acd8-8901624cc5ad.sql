-- Replace handle_new_user function with hardened version that includes validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_avatar_url TEXT;
BEGIN
  -- Validate and sanitize metadata - trim whitespace and handle nulls
  v_full_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'name'), '')
  );
  
  -- Limit name length to prevent oversized inputs
  IF LENGTH(v_full_name) > 255 THEN
    v_full_name := SUBSTRING(v_full_name, 1, 255);
  END IF;
  
  -- Validate and sanitize avatar URL
  v_avatar_url := NULLIF(TRIM(new.raw_user_meta_data ->> 'avatar_url'), '');
  
  -- Limit avatar URL length
  IF LENGTH(v_avatar_url) > 2048 THEN
    v_avatar_url := NULL;
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_avatar_url
  );
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth - user can still sign up
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;