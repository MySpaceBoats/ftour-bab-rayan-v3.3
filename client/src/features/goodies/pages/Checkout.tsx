import { useState } from 'react';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type PaymentMethod = 'bank_transfer' | 'cheque' | 'cash' | 'paypal';

interface PaymentFormData {
  userName: string;
  email: string;
  phone: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string;
  // Bank transfer specific
  bankName?: string;
  accountHolder?: string;
  iban?: string;
  swift?: string;
  // Cheque specific
  chequeNumber?: string;
  chequeDate?: string;
  // Cash specific
  pickupDate?: string;
  // PayPal specific
  paypalEmail?: string;
}

export function Checkout() {
  const { t, lang } = useI18n();
  const [formData, setFormData] = useState<PaymentFormData>({
    userName: '',
    email: '',
    phone: '',
    amount: 0,
    paymentMethod: 'cash',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const createPaymentMutation = trpc.payments.create.useMutation();

  const paymentMethods = [
    {
      id: 'bank_transfer' as PaymentMethod,
      label: t.checkout?.bankTransfer || 'Bank Transfer',
      description: t.checkout?.bankTransferDesc || 'Transfer funds to our bank account',
      icon: '🏦',
    },
    {
      id: 'cheque' as PaymentMethod,
      label: t.checkout?.cheque || 'Cheque',
      description: t.checkout?.chequeDesc || 'Send a cheque by mail',
      icon: '📄',
    },
    {
      id: 'cash' as PaymentMethod,
      label: t.checkout?.cash || 'Cash',
      description: t.checkout?.cashDesc || 'Pay in cash on site',
      icon: '💵',
    },
    {
      id: 'paypal' as PaymentMethod,
      label: t.checkout?.paypal || 'PayPal',
      description: t.checkout?.paypalDesc || 'Secure online payment',
      icon: '🔒',
    },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.userName.trim()) {
      newErrors.userName = t.checkout?.nameRequired || 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = t.checkout?.emailRequired || 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t.checkout?.invalidEmail || 'Invalid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t.checkout?.phoneRequired || 'Phone is required';
    }

    if (formData.amount <= 0) {
      newErrors.amount = t.checkout?.amountRequired || 'Amount must be greater than 0';
    }

    // Payment method specific validation
    if (formData.paymentMethod === 'bank_transfer') {
      if (!formData.iban?.trim()) {
        newErrors.iban = t.checkout?.ibanRequired || 'IBAN is required';
      }
      if (!formData.accountHolder?.trim()) {
        newErrors.accountHolder = t.checkout?.accountHolderRequired || 'Account holder is required';
      }
    }

    if (formData.paymentMethod === 'cheque') {
      if (!formData.chequeNumber?.trim()) {
        newErrors.chequeNumber = t.checkout?.chequeNumberRequired || 'Cheque number is required';
      }
      if (!formData.chequeDate) {
        newErrors.chequeDate = t.checkout?.chequeDateRequired || 'Cheque date is required';
      }
    }

    if (formData.paymentMethod === 'paypal') {
      if (!formData.paypalEmail?.trim()) {
        newErrors.paypalEmail = t.checkout?.paypalEmailRequired || 'PayPal email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.paypalEmail)) {
        newErrors.paypalEmail = t.checkout?.invalidEmail || 'Invalid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      const result = await createPaymentMutation.mutateAsync({
        userName: formData.userName,
        email: formData.email,
        phone: formData.phone,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        description: formData.description,
        metadata: {
          bankName: formData.bankName,
          accountHolder: formData.accountHolder,
          iban: formData.iban,
          swift: formData.swift,
          chequeNumber: formData.chequeNumber,
          chequeDate: formData.chequeDate,
          pickupDate: formData.pickupDate,
          paypalEmail: formData.paypalEmail,
        },
      });

      if (result.success) {
        setSuccessMessage(result.message);
        setFormData({
          userName: '',
          email: '',
          phone: '',
          amount: 0,
          paymentMethod: 'cash',
        });
        setErrors({});

        // Redirect to payment confirmation page
        setTimeout(() => {
          window.location.href = `/payment-confirmation/${result.payment.payment_reference}`;
        }, 2000);
      }
    } catch (error) {
      setErrors({ submit: t.checkout?.paymentError || 'Error creating payment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f5f0] to-[#efefea] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#5d5a3c] mb-2">
            {t.checkout?.title || 'Payment'}
          </h1>
          <p className="text-gray-600">
            {t.checkout?.subtitle || 'Choose your preferred payment method'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.checkout?.personalInfo || 'Personal Information'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userName">{t.checkout?.fullName || 'Full Name'}</Label>
                <Input
                  id="userName"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  className={errors.userName ? 'border-red-500' : ''}
                  placeholder={t.checkout?.namePlaceholder || 'John Doe'}
                />
                {errors.userName && (
                  <p className="text-red-500 text-sm mt-1">{errors.userName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">{t.checkout?.email || 'Email'}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? 'border-red-500' : ''}
                  placeholder="john@example.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="phone">{t.checkout?.phone || 'Phone'}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={errors.phone ? 'border-red-500' : ''}
                  placeholder="+212 6XX XXX XXX"
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <Label htmlFor="amount">{t.checkout?.amount || 'Amount (MAD)'}</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                  className={errors.amount ? 'border-red-500' : ''}
                  placeholder="1000"
                />
                {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
              </div>

              <div>
                <Label htmlFor="description">{t.checkout?.description || 'Description'}</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.checkout?.descriptionPlaceholder || 'Optional notes'}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t.checkout?.paymentMethod || 'Payment Method'}</CardTitle>
              <CardDescription>
                {t.checkout?.selectPaymentMethod || 'Choose how you would like to pay'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.paymentMethod}
                onValueChange={(value) =>
                  setFormData({ ...formData, paymentMethod: value as PaymentMethod })
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                      <Label htmlFor={method.id} className="cursor-pointer flex-1">
                        <div className="text-lg mb-1">
                          {method.icon} {method.label}
                        </div>
                        <p className="text-sm text-gray-600">{method.description}</p>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Payment Method Specific Fields */}
          {formData.paymentMethod === 'bank_transfer' && (
            <Card>
              <CardHeader>
                <CardTitle>{t.checkout?.bankDetails || 'Bank Details'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="accountHolder">
                    {t.checkout?.accountHolder || 'Account Holder'}
                  </Label>
                  <Input
                    id="accountHolder"
                    value={formData.accountHolder || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, accountHolder: e.target.value })
                    }
                    className={errors.accountHolder ? 'border-red-500' : ''}
                    placeholder="Association Bab Rayan"
                  />
                  {errors.accountHolder && (
                    <p className="text-red-500 text-sm mt-1">{errors.accountHolder}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="iban">{t.checkout?.iban || 'IBAN'}</Label>
                  <Input
                    id="iban"
                    value={formData.iban || ''}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className={errors.iban ? 'border-red-500' : ''}
                    placeholder="MA64 0000 0000 0000 0000 0000"
                  />
                  {errors.iban && <p className="text-red-500 text-sm mt-1">{errors.iban}</p>}
                </div>

                <div>
                  <Label htmlFor="swift">{t.checkout?.swift || 'SWIFT Code'}</Label>
                  <Input
                    id="swift"
                    value={formData.swift || ''}
                    onChange={(e) => setFormData({ ...formData, swift: e.target.value })}
                    placeholder="BMCEMAMC"
                  />
                </div>

                <div>
                  <Label htmlFor="bankName">{t.checkout?.bankName || 'Bank Name'}</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Bank Name"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {formData.paymentMethod === 'cheque' && (
            <Card>
              <CardHeader>
                <CardTitle>{t.checkout?.chequeDetails || 'Cheque Details'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="chequeNumber">
                    {t.checkout?.chequeNumber || 'Cheque Number'}
                  </Label>
                  <Input
                    id="chequeNumber"
                    value={formData.chequeNumber || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, chequeNumber: e.target.value })
                    }
                    className={errors.chequeNumber ? 'border-red-500' : ''}
                    placeholder="123456789"
                  />
                  {errors.chequeNumber && (
                    <p className="text-red-500 text-sm mt-1">{errors.chequeNumber}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="chequeDate">{t.checkout?.chequeDate || 'Cheque Date'}</Label>
                  <Input
                    id="chequeDate"
                    type="date"
                    value={formData.chequeDate || ''}
                    onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                    className={errors.chequeDate ? 'border-red-500' : ''}
                  />
                  {errors.chequeDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.chequeDate}</p>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t.checkout?.chequeInstructions ||
                      'Please send your cheque to: Association Bab Rayan, 4 rue Bayt Lahm, Casablanca'}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {formData.paymentMethod === 'cash' && (
            <Card>
              <CardHeader>
                <CardTitle>{t.checkout?.cashDetails || 'Cash Payment'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pickupDate">
                    {t.checkout?.preferredPickupDate || 'Preferred Pickup Date'}
                  </Label>
                  <Input
                    id="pickupDate"
                    type="date"
                    value={formData.pickupDate || ''}
                    onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t.checkout?.cashInstructions ||
                      'Please bring cash to our office at: 4 rue Bayt Lahm, Casablanca. Contact us at +212 664-887978'}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {formData.paymentMethod === 'paypal' && (
            <Card>
              <CardHeader>
                <CardTitle>{t.checkout?.paypalDetails || 'PayPal Details'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="paypalEmail">
                    {t.checkout?.paypalEmail || 'PayPal Email'}
                  </Label>
                  <Input
                    id="paypalEmail"
                    type="email"
                    value={formData.paypalEmail || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, paypalEmail: e.target.value })
                    }
                    className={errors.paypalEmail ? 'border-red-500' : ''}
                    placeholder="paypal@example.com"
                  />
                  {errors.paypalEmail && (
                    <p className="text-red-500 text-sm mt-1">{errors.paypalEmail}</p>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t.checkout?.paypalInstructions ||
                      'You will be redirected to PayPal to complete your payment securely.'}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {successMessage && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#5d5a3c] hover:bg-[#4a4730] text-white py-6 text-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.checkout?.processing || 'Processing...'}
                </>
              ) : (
                t.checkout?.submitPayment || 'Submit Payment'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
