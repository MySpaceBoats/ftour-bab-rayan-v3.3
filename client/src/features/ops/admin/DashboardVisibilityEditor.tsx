import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Props {
  users: Array<{ openId: string; name?: string | null; email?: string | null }>;
}

export default function DashboardVisibilityEditor({ users }: Props) {
  const [selectedUser, setSelectedUser] = useState('');
  const [search, setSearch] = useState('');
  const [draftKeys, setDraftKeys] = useState<string[]>([]);

  const { data: registry } = trpc.users.dashboardRegistry.useQuery();
  const keysQuery = trpc.users.dashboardKeys.useQuery(
    { userOpenId: selectedUser },
    { enabled: !!selectedUser }
  );

  const replaceMutation = trpc.users.replaceDashboardKeys.useMutation({
    onSuccess: () => {
      toast.success('Visibilité dashboard enregistrée');
      keysQuery.refetch();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const grouped = useMemo(() => {
    const filtered = (registry ?? []).filter((item: any) =>
      !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.key.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce((acc: Record<string, any[]>, item: any) => {
      acc[item.category] = acc[item.category] || [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [registry, search]);

  useEffect(() => {
    if (keysQuery.data) {
      setDraftKeys(keysQuery.data);
    }
  }, [keysQuery.data]);

  const toggle = (key: string, checked: boolean) => {
    setDraftKeys(prev => (checked ? Array.from(new Set([...prev, key])) : prev.filter(k => k !== key)));
  };

  const selectCategory = (category: string) => {
    const keys = (grouped[category] ?? []).map(item => item.key);
    setDraftKeys(prev => Array.from(new Set([...prev, ...keys])));
  };

  const save = () => {
    if (!selectedUser) return;
    replaceMutation.mutate({ userOpenId: selectedUser, itemKeys: draftKeys as any });
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold">Dashboard visibility</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Utilisateur</Label>
            <Select
              value={selectedUser}
              onValueChange={(value) => {
                setSelectedUser(value);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.openId} value={u.openId}>{u.name || u.email || u.openId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Recherche</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer les sections..." />
          </div>
        </div>

        {selectedUser && (
          <>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium capitalize">{category}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectCategory(category)}>
                    Tout sélectionner
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {(items as any[]).map(item => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draftKeys.includes(item.key)}
                        onCheckedChange={(checked) => toggle(item.key, checked === true)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={save} disabled={replaceMutation.isPending}>
              Enregistrer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
