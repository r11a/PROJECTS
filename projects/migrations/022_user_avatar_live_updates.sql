DROP TRIGGER IF EXISTS projects_live_change ON users;
CREATE TRIGGER projects_live_change
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change();
