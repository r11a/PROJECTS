import { useCallback, useEffect, useState } from 'react';

const pages = new Set(['dashboard','my-work','calendar','projects','project','gis','clients','professionals','catalog','forms','finance','tasks','gantt','control','reports','settings']);
export function readWorkspaceRoute(search) {
  const params = new URLSearchParams(search);
  const projectId = params.get('project') || '';
  const requested = params.get('page');
  return { page: projectId ? 'project' : pages.has(requested) ? requested : 'dashboard', projectId, taskId: params.get('task') || '' };
}

export function useWorkspaceNavigation() {
  const [route, setRoute] = useState(() => readWorkspaceRoute(window.location.search));
  useEffect(() => {
    const restore = () => setRoute(readWorkspaceRoute(window.location.search));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const navigate = useCallback((page, context = {}) => {
    if (!pages.has(page)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    for (const name of ['project','task','tab']) url.searchParams.delete(name);
    if (page === 'project' && context.projectId) url.searchParams.set('project', context.projectId);
    if (context.taskId) url.searchParams.set('task', context.taskId);
    if (url.href !== window.location.href) window.history.pushState({}, '', url);
    setRoute(readWorkspaceRoute(url.search));
  }, []);
  return [route, navigate];
}
