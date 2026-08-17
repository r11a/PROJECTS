DO $$ DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_professionals','professional_role_types','professionals','equipment_catalog',
    'project_site_reviews','project_meeting_summaries','project_time_entries',
    'priority_orders','priority_order_lines','app_settings'
  ] LOOP
    IF to_regclass(table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS projects_live_change ON %I',table_name);
      EXECUTE format('CREATE TRIGGER projects_live_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change()',table_name);
    END IF;
  END LOOP;
END $$;
