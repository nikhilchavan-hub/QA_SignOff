-- Add defect_filter_link column to Sign_Off_Req table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Sign_Off_Req' AND column_name='defect_filter_link') THEN
        ALTER TABLE "Sign_Off_Req" ADD COLUMN defect_filter_link TEXT;
    END IF;
END $$;
