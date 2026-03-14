import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ProductType = 'goodies' | 'terroir' | 'pastry';

export type CartItem = {
  productType: ProductType;
  productId: number;
  variantId?: number;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  /** @deprecated Use productId instead */
  goodieId?: number;
};

type CartContextType = {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (item: CartItem) => void;
  updateQuantity: (index: number, delta: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
  getCartByType: (type: ProductType) => CartItem[];
  getCartCountByType: (type: ProductType) => number;
  getCartTotalByType: (type: ProductType) => number;
  clearCartByType: (type: ProductType) => void;
  getCartIndexByType: (type: ProductType, productId: number, variantId?: number) => number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'ftour-unified-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount (migrate old format if needed)
  useEffect(() => {
    try {
      // Try new unified key first
      let stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setCart(JSON.parse(stored));
        return;
      }
      // Migrate from old goodies-only key
      const oldStored = localStorage.getItem('ftour-goodies-cart');
      if (oldStored) {
        const oldCart: any[] = JSON.parse(oldStored);
        const migrated = oldCart.map(item => ({
          ...item,
          productType: 'goodies' as ProductType,
          productId: item.goodieId ?? item.productId,
        }));
        setCart(migrated);
        localStorage.removeItem('ftour-goodies-cart');
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }, [cart]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (newItem: CartItem) => {
    // Ensure backward compat: set goodieId for goodies
    const item = {
      ...newItem,
      goodieId: newItem.productType === 'goodies' ? newItem.productId : undefined,
    };

    const existingIndex = cart.findIndex(
      ci => ci.productType === item.productType && ci.productId === item.productId && ci.variantId === item.variantId
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += item.quantity;
      setCart(newCart);
    } else {
      setCart([...cart, item]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartByType = (type: ProductType) => cart.filter(item => item.productType === type);
  const getCartCountByType = (type: ProductType) => getCartByType(type).reduce((sum, item) => sum + item.quantity, 0);
  const getCartTotalByType = (type: ProductType) => getCartByType(type).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const clearCartByType = (type: ProductType) => setCart(cart.filter(item => item.productType !== type));
  const getCartIndexByType = (type: ProductType, productId: number, variantId?: number) =>
    cart.findIndex(
      item =>
        item.productType === type &&
        item.productId === productId &&
        item.variantId === variantId
    );

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        cartTotal,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        setCart,
        getCartByType,
        getCartCountByType,
        getCartTotalByType,
        clearCartByType,
        getCartIndexByType,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
