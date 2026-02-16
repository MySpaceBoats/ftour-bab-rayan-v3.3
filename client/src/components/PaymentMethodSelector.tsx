import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Banknote, DollarSign } from 'lucide-react';

export type PaymentMethod = 'bank_transfer' | 'cheque' | 'cash';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  availableMethods?: PaymentMethod[];
  showDescriptions?: boolean;
}

export default function PaymentMethodSelector({
  value,
  onChange,
  availableMethods = ['bank_transfer', 'cheque', 'cash'],
  showDescriptions = true,
}: PaymentMethodSelectorProps) {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const paymentMethods: Record<PaymentMethod, { icon: React.ReactNode; label: string; description: string }> = {
    bank_transfer: {
      icon: <CreditCard className="h-6 w-6" />,
      label: t.checkout?.bankTransfer || 'Bank Transfer',
      description: t.checkout?.bankTransferDesc || 'Transfer funds to our bank account',
    },
    cheque: {
      icon: <Banknote className="h-6 w-6" />,
      label: t.checkout?.cheque || 'Cheque',
      description: t.checkout?.chequeDesc || 'Send a cheque by mail',
    },
    cash: {
      icon: <DollarSign className="h-6 w-6" />,
      label: t.checkout?.cash || 'Cash',
      description: t.checkout?.cashDesc || 'Pay in cash on site',
    },
  };

  const visibleMethods = availableMethods.filter(method => paymentMethods[method]);

  return (
    <div className="space-y-3" dir={dir}>
      <label className="text-sm font-semibold text-[#F2E9D3]">
        {t.checkout?.paymentMethod || 'Payment Method'}
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleMethods.map((method) => {
          const methodInfo = paymentMethods[method];
          const isSelected = value === method;

          return (
            <Card
              key={method}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#F2E9D3] border-[#F2E9D3]'
                  : 'bg-[#4A4829] border-[#F2E9D3]/20 hover:border-[#F2E9D3]/40'
              }`}
              onClick={() => onChange(method)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={isSelected}
                    onChange={() => onChange(method)}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={isSelected ? 'text-[#4A4829]' : 'text-[#F2E9D3]'}>
                        {methodInfo.icon}
                      </div>
                      <label
                        className={`font-semibold cursor-pointer ${
                          isSelected ? 'text-[#4A4829]' : 'text-[#F2E9D3]'
                        }`}
                      >
                        {methodInfo.label}
                      </label>
                    </div>
                    {showDescriptions && (
                      <p
                        className={`text-xs ${
                          isSelected ? 'text-[#4A4829]/70' : 'text-[#E6DCC3]'
                        }`}
                      >
                        {methodInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
