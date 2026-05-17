import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient, type PlatformPermissions, type PermissionKey } from '../api/client';

interface PermissionsContextValue {
  permissions: PlatformPermissions | null;
  loading: boolean;
  can: (role: string | undefined, key: PermissionKey) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: null,
  loading: true,
  can: () => false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<PlatformPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.admin.getPermissions()
      .then((res) => setPermissions(res.permissions))
      .catch(() => setPermissions(null))
      .finally(() => setLoading(false));
  }, []);

  function can(role: string | undefined, key: PermissionKey): boolean {
    if (!role) return false;
    if (role === 'SUPER_ADMIN') return true;
    if (!permissions) return true; // fail open while loading
    const rolePerms = permissions[role as keyof PlatformPermissions];
    if (!rolePerms) return false;
    return rolePerms[key] ?? false;
  }

  return (
    <PermissionsContext.Provider value={{ permissions, loading, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
