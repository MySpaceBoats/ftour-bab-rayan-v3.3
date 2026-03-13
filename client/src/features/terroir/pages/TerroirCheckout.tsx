import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PaymentMethodSelector, { type PaymentMethod } from '@/components/PaymentMethodSelector';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface TerroirCheckoutProps {
  formData: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    notes: string;
    paymentMethod: PaymentMethod;
  };
  cartCount: number;
  cartTotal: number;
  isSubmitting: boolean;
  onFormChange: (next: TerroirCheckoutProps['formData']) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export default function TerroirCheckout({
  formData,
  cartCount,
  cartTotal,
  isSubmitting,
  onFormChange,
  onBack,
  onSubmit,
}: TerroirCheckoutProps) {
  const { t } = useI18n();

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t.terroir.finalizeReservation}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t.terroir.fullName}</Label>
            <Input
              value={formData.customerName}
              onChange={e => onFormChange({ ...formData, customerName: e.target.value })}
              placeholder={t.terroir.fullName}
            />
          </div>
          <div>
            <Label>{t.terroir.phone}</Label>
            <Input
              value={formData.customerPhone}
              onChange={e => onFormChange({ ...formData, customerPhone: e.target.value })}
              placeholder={t.terroir.phone}
            />
          </div>
          <div>
            <Label>{t.terroir.email}</Label>
            <Input
              type="email"
              value={formData.customerEmail}
              onChange={e => onFormChange({ ...formData, customerEmail: e.target.value })}
              placeholder={t.terroir.email}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={e => onFormChange({ ...formData, notes: e.target.value })}
              placeholder="Informations complémentaires (optionnel)"
            />
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">{t.checkout.paymentMethod}</h3>
            <PaymentMethodSelector
              value={formData.paymentMethod}
              onChange={method => onFormChange({ ...formData, paymentMethod: method })}
            />
          </div>

          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium mb-1">Récapitulatif</p>
            <p>{cartCount} article(s)</p>
            <p className="font-semibold">Total: {cartTotal} DH</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Retour
            </Button>
            <Button onClick={onSubmit} className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Valider la commande
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
