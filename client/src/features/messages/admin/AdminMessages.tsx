import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, Mail, Search, Trash2, CheckCircle, Loader2, Phone, AlertCircle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

type MessageFilter = 'all' | 'read' | 'unread';

export default function AdminMessages() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: messages = [], isLoading, error } = trpc.contact.list.useQuery();

  // Mutations
  const markRead = trpc.contact.markRead.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      toast.success('Message marqué comme lu');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMessage = trpc.contact.delete.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      setSelectedId(null);
      toast.success('Message supprimé');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const normalizedMessages = useMemo(() => {
    return messages.map((message: any) => ({
      ...message,
      isRead: Boolean(message.is_read ?? message.isRead),
    }));
  }, [messages]);

  const filteredMessages = normalizedMessages.filter((message: any) => {
    const text = `${message.name} ${message.email} ${message.subject || ''} ${message.message || ''}`.toLowerCase();
    const matchesSearch = searchQuery === '' || text.includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'read' ? message.isRead : !message.isRead);
    return matchesSearch && matchesFilter;
  });

  const selectedMessage = filteredMessages.find((message: any) => message.id === selectedId) || null;

  // Stats
  const stats = {
    total: normalizedMessages.length,
    unread: normalizedMessages.filter((m: any) => !m.isRead).length,
    read: normalizedMessages.filter((m: any) => m.isRead).length,
  };

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id });
  };

  const handleDelete = (id: number) => {
    if (confirm('Supprimer ce message ?')) {
      deleteMessage.mutate({ id });
    }
  };

  const exportCsv = () => {
    if (filteredMessages.length === 0) {
      toast.error('Aucun message à exporter');
      return;
    }
    const header = ['ID', 'Nom', 'Email', 'Téléphone', 'Sujet', 'Message', 'Lu', 'Date'];
    const rows = filteredMessages.map((message: any) => [
      message.id, message.name, message.email, message.phone || '',
      message.subject || '', (message.message || '').replace(/\n/g, ' '),
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-bold text-xl flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> Messages de contact
            </h1>
            <p className="text-sm text-muted-foreground">{stats.total} message(s) — {stats.unread} non lu(s)</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.unread}</p>
          <p className="text-sm text-muted-foreground">Non lus</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.read}</p>
          <p className="text-sm text-muted-foreground">Lus</p>
        </Card>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Erreur: {error.message}</p>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Liste</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un message..." className="pl-10" />
                </div>
                <div className="flex gap-2">
                  <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tous</Button>
                  <Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>Non lus</Button>
                  <Button variant={filter === 'read' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('read')}>Lus</Button>
                </div>
              </div>

              {filteredMessages.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Aucun message trouvé</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredMessages.map((message: any) => (
                    <button
                      key={message.id}
                      onClick={() => {
                        setSelectedId(message.id);
                        if (!message.isRead) handleMarkRead(message.id);
                      }}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        selectedId === message.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      } ${!message.isRead ? 'border-l-4 border-l-amber-500' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`font-medium ${!message.isRead ? 'font-bold' : ''}`}>{message.name}</p>
                        <Badge variant={message.isRead ? 'secondary' : 'default'}>
                          {message.isRead ? 'Lu' : 'Non lu'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{message.email}</p>
                      <p className="text-sm mt-1 line-clamp-1">{message.subject || 'Sans sujet'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(message.created_at || message.createdAt || '').toLocaleString('fr-FR')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Détail</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedMessage ? (
                <p className="text-sm text-muted-foreground">Sélectionnez un message.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={selectedMessage.isRead ? 'secondary' : 'default'}>
                      {selectedMessage.isRead ? 'Lu' : 'Non lu'}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedMessage.created_at || selectedMessage.createdAt || '').toLocaleString('fr-FR')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-lg">{selectedMessage.name}</p>
                    <p className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> {selectedMessage.email}</p>
                    {selectedMessage.phone && <p className="text-sm flex items-center gap-2"><Phone className="h-4 w-4" /> {selectedMessage.phone}</p>}
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1">{selectedMessage.subject || 'Sans sujet'}</p>
                    <Textarea value={selectedMessage.message || ''} readOnly className="min-h-[180px]" />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2">
                    {!selectedMessage.isRead && (
                      <Button onClick={() => handleMarkRead(selectedMessage.id)} disabled={markRead.isPending} className="w-full">
                        {markRead.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Marquer comme lu
                      </Button>
                    )}
                    <Button variant="destructive" onClick={() => handleDelete(selectedMessage.id)} disabled={deleteMessage.isPending} className="w-full">
                      {deleteMessage.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Supprimer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
