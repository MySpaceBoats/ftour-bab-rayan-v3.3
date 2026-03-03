import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ForgotPassword() {
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { lang, tokenHash } = useMemo(() => {
    const parts = location.split('/').filter(Boolean);
    const detectedLang = parts[0] || 'fr';
    const params = new URLSearchParams(window.location.search);
    return {
      lang: detectedLang,
      tokenHash: params.get('token_hash') || params.get('token') || '',
    };
  }, [location]);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setError(null);
      setSuccess('Si votre adresse est inscrite, vous recevrez un email de réinitialisation.');
    },
    onError: () => {
      setError('Impossible d\'envoyer l\'email de réinitialisation. Réessayez plus tard.');
    },
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setError(null);
      setSuccess('Mot de passe mis à jour. Vous pouvez maintenant vous connecter.');
      setTimeout(() => setLocation(`/${lang}/connexion`), 1400);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Lien invalide ou expiré. Veuillez refaire la demande.');
    },
  });

  const handleRequestReset = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError('Veuillez renseigner votre adresse email.');
      return;
    }

    requestResetMutation.mutate({ email, lang });
  };

  const handleCompleteReset = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!tokenHash) {
      setError('Lien de réinitialisation invalide.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    resetPasswordMutation.mutate({ tokenHash, newPassword });
  };

  const isResetMode = Boolean(tokenHash);
  const isPending = requestResetMutation.isPending || resetPasswordMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-stone-100 to-white">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-emerald-100 p-3 rounded-full">
                {isResetMode ? (
                  <Lock className="h-8 w-8 text-emerald-600" />
                ) : (
                  <Mail className="h-8 w-8 text-emerald-600" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-stone-800">
              {isResetMode ? 'Nouveau mot de passe' : 'Mot de passe oublié'}
            </CardTitle>
            <CardDescription>
              {isResetMode
                ? 'Choisissez un nouveau mot de passe pour votre compte.'
                : 'Recevez un email pour réinitialiser votre mot de passe.'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={isResetMode ? handleCompleteReset : handleRequestReset}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-emerald-200 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {!isResetMode ? (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isResetMode ? 'Mise à jour...' : 'Envoi en cours...'}
                  </>
                ) : isResetMode ? (
                  'Mettre à jour le mot de passe'
                ) : (
                  'Envoyer le lien de réinitialisation'
                )}
              </Button>

              <p className="text-sm text-stone-500 text-center">
                <Link href={`/${lang}/connexion`} className="text-emerald-600 hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
