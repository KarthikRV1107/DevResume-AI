ALTER TABLE public.analyses 
ADD COLUMN IF NOT EXISTS security_issues jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dependency_audit jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS compliance_checks jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS project_name text,
ADD COLUMN IF NOT EXISTS total_files integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_size_bytes bigint DEFAULT 0;