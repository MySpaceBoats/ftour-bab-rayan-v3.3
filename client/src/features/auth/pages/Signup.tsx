import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Heart, Loader2, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [location] = useLocation();
  const lang = location.split('/').filter(Boolean)[0] || 'fr';

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Erreur lors de l\'inscription');
    }
  });

  // signupByLink lives on the Worker router only; the client types come from the Node router
  type LinkInput = { firstName: string; lastName: string; email: string; lang: string };
  const linkMutation = (trpc.auth as unknown as {
    signupByLink: { useMutation: (o: { onSuccess: () => void; onError: (e: { message?: string }) => void }) => { mutate: (i: LinkInput) => void; isPending: boolean } };
  }).signupByLink.useMutation({
    onSuccess: () => setSuccess(true),
    onError: err => setError(err.message || 'Erreur lors de l\'inscription'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setError('Veuillez renseigner votre prénom et votre nom');
      return;
    }

    if (mode === 'link') {
      if (!email) {
        setError('Veuillez renseigner votre adresse email');
        return;
      }
      linkMutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), email, lang });
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    signupMutation.mutate({ email, password, name: `${firstName.trim()} ${lastName.trim()}`, phone: phone || undefined });
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-stone-100 to-white">
        <Navbar />
        
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-emerald-100 p-3 rounded-full">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-stone-800">{mode === 'link' ? 'Vérifiez votre boîte mail' : 'Inscription réussie !'}</CardTitle>
              <CardDescription>
                {mode === 'link'
                  ? 'Si cette adresse n\'a pas encore de compte, nous venons de vous envoyer un lien pour choisir votre mot de passe.'
                  : 'Votre compte a été créé avec succès.'}
              </CardDescription>
            </CardHeader>
            
            <CardFooter className="flex flex-col gap-4">
              <Link href="/connexion" className="w-full">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Se connecter
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-stone-100 to-white">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-emerald-100 p-3 rounded-full">
                <Heart className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-stone-800">Créer un compte</CardTitle>
            <CardDescription>
              Créez votre compte pour rejoindre Ftour Bab Rayan
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input id="firstName" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
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
              
              {mode === 'password' && (
                <>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+212 6XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
                </>
              )}

              <button type="button" className="text-sm text-emerald-700 hover:underline" onClick={() => { setError(null); setMode(mode === 'password' ? 'link' : 'password'); }}>
                {mode === 'password' ? 'Recevoir un lien par email à la place d\'un mot de passe' : 'Choisir un mot de passe maintenant'}
              </button>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={signupMutation.isPending || linkMutation.isPending}
              >
                {signupMutation.isPending || linkMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inscription...
                  </>
                ) : (
                  mode === 'link' ? 'Recevoir mon lien' : 'Créer mon compte'
                )}
              </Button>
              
              <p className="text-sm text-stone-500 text-center">
                Déjà un compte ?{' '}
                <Link href={`/${lang}/connexion`} className="text-emerald-600 hover:underline">
                  Se connecter
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
