import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, Mail, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

type MessageFilter = 'all' | 'read' | 'unread';

export default function AdminMessages() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locallyRead, setLocallyRead] = useState<Record<number, boolean>>({});

  const utils = trpc.useUtils();
  const { data: messages = [], isLoading } = trpc.contact.list.useQuery();
  const markReadMutation = trpc.contact.markRead.useMutation({
    onSuccess: async () => {
      await utils.contact.list.invalidate();
    },
  });
  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: async () => {
      await utils.contact.list.invalidate();
      toast.success('Message supprimé');
      setSelectedId(null);
    },
  });

  const normalizedMessages = useMemo(() => {
    return messages.map((message: any) => {
      const readFromServer = Boolean(message.is_read ?? message.isRead);
      const read = locallyRead[message.id] ?? readFromServer;
      return {
        ...message,
        isRead: read,
      };
    });
  }, [messages, locallyRead]);

  const filteredMessages = normalizedMessages.filter((message: any) => {
    const text = `${message.name} ${message.email} ${message.subject || ''} ${message.message || ''}`.toLowerCase();
    const matchesSearch = searchQuery === '' || text.includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'read' ? message.isRead : !message.isRead);
    return matchesSearch && matchesFilter;
  });

  const selectedMessage = filteredMessages.find((message: any) => message.id === selectedId) || null;

  const markAsRead = async (id: number) => {
    await markReadMutation.mutateAsync({ id });
    setLocallyRead((prev) => ({ ...prev, [id]: true }));
    toast.success('Message marqué comme lu');
  };

  const exportCsv = () => {
    if (filteredMessages.length === 0) {
      toast.error('Aucun message à exporter');
      return;
    }

    const header = ['ID', 'Nom', 'Email', 'Téléphone', 'Sujet', 'Message', 'Lu', 'Date'];
    const rows = filteredMessages.map((message: any) => [
      message.id,
      message.name,
      message.email,
      message.phone || '',
      message.subject || '',
      (message.message || '').replace(/\n/g, ' '),
      message.isRead ? 'Oui' : 'Non',
      new Date(message.created_at || message.createdAt || '').toLocaleString('fr-FR'),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `messages_contact_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Export CSV téléchargé');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Messages de contact</h1>
            <p className="text-xs text-muted-foreground">{filteredMessages.length} message(s)</p>
          </div>
        </div>
      </header>

      <main className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Liste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un message..."
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Tous</Button>
                <Button variant={filter === 'unread' ? 'default' : 'outline'} onClick={() => setFilter('unread')}>Non lus</Button>
                <Button variant={filter === 'read' ? 'default' : 'outline'} onClick={() => setFilter('read')}>Lus</Button>
              </div>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
            </div>

            <div className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
              {!isLoading && filteredMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun message trouvé.</p>
              )}

              {filteredMessages.map((message: any) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedId(message.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedId === message.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium">{message.name}</p>
                    <Badge variant={message.isRead ? 'secondary' : 'default'}>{message.isRead ? 'Lu' : 'Non lu'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{message.email}</p>
                  <p className="text-sm mt-1 line-clamp-1">{message.subject || 'Sans sujet'}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détail</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedMessage && <p className="text-sm text-muted-foreground">Sélectionnez un message.</p>}
            {selectedMessage && (
              <div className="space-y-3">
                <p className="font-semibold">{selectedMessage.name}</p>
                <p className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />{selectedMessage.email}</p>
                {selectedMessage.phone && <p className="text-sm">📞 {selectedMessage.phone}</p>}
                <p className="text-sm font-medium">{selectedMessage.subject || 'Sans sujet'}</p>
                <Textarea value={selectedMessage.message || ''} readOnly className="min-h-[180px]" />
                <Button
                  onClick={() => markAsRead(selectedMessage.id)}
                  disabled={selectedMessage.isRead || markReadMutation.isPending}
                  className="w-full"
                >
                  {selectedMessage.isRead ? 'Déjà lu' : 'Marquer comme lu'}
                </Button>
                {user?.role === 'super_admin' && (
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ id: selectedMessage.id })}
                    disabled={deleteMutation.isPending}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
