-- Run with psql -X -qAt -v ON_ERROR_STOP=1. The output contains personal data.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- SQLite requires an array. Stop the export if any legacy row lacks one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.business_profile_submissions WHERE services IS NULL) THEN
    RAISE EXCEPTION 'The source has rows with SQL NULL services. Review the historical data before import.';
  END IF;
END $$;

SELECT
  'INSERT INTO business_profile_submissions ' ||
  '(id, reference_id, business_structure, services, annual_revenue, team_size, accounting_method, ' ||
  'first_name, last_name, email, phone, preferred_contact_method, additional_message, status, ' ||
  'source, ip_hash, user_agent, created_at, updated_at) VALUES (' ||
  (
    SELECT string_agg(
      CASE
        WHEN value IS NULL THEN 'NULL'
        ELSE 'CAST(X' || chr(39) || encode(convert_to(value, 'UTF8'), 'hex') || chr(39) || ' AS TEXT)'
      END,
      ', ' ORDER BY position
    )
    FROM unnest(ARRAY[
      p.id::text, p.reference_id, p.business_structure, array_to_json(p.services)::text,
      p.annual_revenue, p.team_size, p.accounting_method, p.first_name, p.last_name, p.email,
      p.phone, p.preferred_contact_method, p.additional_message, p.status, p.source,
      p.ip_hash, p.user_agent
    ]) WITH ORDINALITY AS fields(value, position)
  ) || ', ' ||
  (extract(epoch FROM p.created_at) * 1000)::bigint::text || ', ' ||
  (extract(epoch FROM p.updated_at) * 1000)::bigint::text || ');'
FROM public.business_profile_submissions AS p
ORDER BY p.id;

COMMIT;
