-- Tambahkan kolom payment_amount jika belum ada
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS payment_amount numeric;

-- Perbarui fungsi trigger check_and_activate_listing
CREATE OR REPLACE FUNCTION public.check_and_activate_listing()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_listing_id uuid;
BEGIN
  -- We assume this trigger is ON public.mutations FOR EACH ROW
  IF NEW.amount IS NOT NULL THEN
     SELECT id INTO v_listing_id 
     FROM public.listings 
     WHERE payment_status = 'pending' 
       AND payment_amount = NEW.amount 
     LIMIT 1;
     
     IF v_listing_id IS NOT NULL THEN
        UPDATE public.listings
        SET payment_status = 'paid',
            is_bu = true,
            qris_verified = true,
            bu_activated_at = now()
        WHERE id = v_listing_id;
     END IF;
  END IF;
  RETURN NEW;
END;
$function$;
