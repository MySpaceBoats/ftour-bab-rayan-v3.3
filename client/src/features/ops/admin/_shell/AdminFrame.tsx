import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import AdminCommandPalette from './AdminCommandPalette';
import { ROUTE_TO_NAV_ID, ROUTE_TO_TITLE } from './adminRouteMap';

export type AdminPageConfig = {
  title?: string;
  crumb?: string[];
  actions?: ReactNode;
  active?: string;
};

type AdminShellContextType = {
  setPageConfig: (config: AdminPageConfig) => void;
};

export const AdminShellContext = createContext<AdminShellContextType>({
  setPageConfig: () => {},
});

export function useAdminPage(config: AdminPageConfig) {
  const { setPageConfig } = useContext(AdminShellContext);
  useEffect(() => {
    setPageConfig(config);
    return () => setPageConfig({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

interface AdminFrameProps {
  children: ReactNode;
  /** If provided, override the auto-derived active nav item */
  active?: string;
  /** If provided, override the auto-derived title */
  title?: string;
  /** Breadcrumb override */
  crumb?: string[];
  /** Topbar action buttons */
  actions?: ReactNode;
  /** Main content padding (default 24) */
  pad?: number;
}

export default function AdminFrame({
  children,
  active: activeProp,
  title: titleProp,
  crumb: crumbProp,
  actions: actionsProp,
  pad = 24,
}: AdminFrameProps) {
  const [location] = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [pageConfig, setPageConfig] = useState<AdminPageConfig>({});

  // Derive from URL
  const normalizedLocation = location.replace(/^\/admin3/, '/admin');
  const derivedActive = ROUTE_TO_NAV_ID[normalizedLocation] || 'dashboard';
  const derivedTitle = ROUTE_TO_TITLE[normalizedLocation] || 'Admin';

  const active = activeProp ?? pageConfig.active ?? derivedActive;
  const title = titleProp ?? pageConfig.title ?? derivedTitle;
  const crumb = crumbProp ?? pageConfig.crumb;
  const actions = actionsProp ?? pageConfig.actions;

  // Global ⌘K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <AdminShellContext.Provider value={{ setPageConfig }}>
      <div
        data-theme="admin-v2"
        style={{
          display: 'flex',
          width: '100%',
          height: '100dvh',
          overflow: 'hidden',
          background: 'var(--bg)',
          color: 'var(--ink)',
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <AdminSidebar active={active} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
          <AdminTopbar
            title={title}
            crumb={crumb}
            actions={actions}
            onSearchClick={() => setCmdOpen(true)}
          />
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--bg)',
              padding: pad,
            }}
          >
            {children}
          </main>
        </div>
        <AdminCommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </AdminShellContext.Provider>
  );
}
