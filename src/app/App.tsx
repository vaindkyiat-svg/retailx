import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ShoppingCart, Package, ClipboardList, LayoutDashboard,
  Plus, Minus, Trash2, Search, Tag, Printer,
  X, Check, Edit2, TrendingUp, ShoppingBag,
  IndianRupee, Users, ChevronDown, AlertCircle,
  Save, Eye, Star, BarChart2, ArrowUpRight,
  Award, Flame, SortAsc, SortDesc, Settings,
  MapPin, Phone, Mail, Globe, Clock, Building2,
  CreditCard, Hash, CheckCircle2, Wallet,
  RotateCcw, ArrowDownLeft, ArrowUpRight as ArrowOut,
  Banknote, LockOpen, Lock, CalendarDays, History,
  ChevronRight, Recycle, PackageX, Info,
  EyeOff, LogOut, KeyRound, ShieldCheck, Loader,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { useShopData } from "../lib/useShopData";
import { fetchShops, fetchShopById, addShop, updateShop, ShopFetchError } from "../lib/database";
import { signIn, signOut, getAuthUser } from "../lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────

// Categories where batches are mandatory and expiry is enforced
const EXPIRY_CATEGORIES = new Set(["Namkeen & Snacks", "Beverages", "Mithai Boxes"]);
// Days before expiry when the batch is cut off and marked unsellable
const CUTOFF_DAYS: Record<string, number> = {
  "Namkeen & Snacks": 3,
  "Beverages": 2,
  "Mithai Boxes": 5,
};

type BatchStatus = "active" | "near-expiry" | "unsellable" | "expired";

interface Batch {
  id: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  addedDate: string;
  status: BatchStatus;
  manualUnsellable?: boolean; // shop-owner override
  notes?: string;
}

type WastageReason = "expired" | "near-expiry-cutoff" | "damaged" | "quality-issue" | "other";

interface WastageEntry {
  id: string;
  date: string;
  time: string;
  productId: number;
  productName: string;
  productEmoji: string;
  category: string;
  batchNo: string;
  batchId: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  totalLoss: number;
  reason: WastageReason;
  notes: string;
}

interface Product {
  id: number;
  name: string;
  nameHi: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  emoji: string;
  lowStockThreshold: number;
}

// ── Batch helpers ───────────────────────────────────────────────────────────

function daysUntilExpiry(expiryDate: string): number {
  const exp = new Date(expiryDate).setHours(23, 59, 59, 999);
  return Math.ceil((exp - Date.now()) / 86400000);
}

function computeBatchStatus(batch: Batch, category: string): BatchStatus {
  if (batch.manualUnsellable) return "unsellable";
  const days = daysUntilExpiry(batch.expiryDate);
  const cutoff = CUTOFF_DAYS[category] ?? 0;
  if (days < 0) return "expired";
  if (days <= cutoff) return EXPIRY_CATEGORIES.has(category) ? "unsellable" : "near-expiry";
  if (days <= cutoff + 4) return "near-expiry";
  return "active";
}

function sellableQty(batches: Batch[]): number {
  return batches
    .filter(b => b.status !== "expired" && b.status !== "unsellable")
    .reduce((s, b) => s + b.quantity, 0);
}

function totalBatchQty(batches: Batch[]): number {
  return batches.reduce((s, b) => s + b.quantity, 0);
}

function refreshBatchStatuses(batches: Batch[], category: string): Batch[] {
  return batches.map(b => ({ ...b, status: computeBatchStatus(b, category) }));
}

interface CartItem extends Product {
  qty: number;
}

interface Order {
  id: string;
  date: string;
  time: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discountType: "percent" | "flat";
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMode: "Cash" | "UPI" | "Card";
  status: "Completed" | "Pending" | "Cancelled";
}

// ── Seed data ──────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Sweets", "Namkeen & Snacks", "Beverages", "Meals", "Mithai Boxes"];

const INITIAL_PRODUCTS: Product[] = [
  { id: 1,  name: "Kaju Katli",        nameHi: "काजू कतली",    category: "Sweets",           price: 800,  unit: "500g",      stock: 45, emoji: "🟡", lowStockThreshold: 10 },
  { id: 2,  name: "Gulab Jamun",       nameHi: "गुलाब जामुन",   category: "Sweets",           price: 280,  unit: "500g",      stock: 30, emoji: "🟤", lowStockThreshold: 8  },
  { id: 3,  name: "Rasgulla",          nameHi: "रसगुल्ला",      category: "Sweets",           price: 240,  unit: "500g",      stock: 25, emoji: "⚪", lowStockThreshold: 8  },
  { id: 4,  name: "Motichur Ladoo",    nameHi: "मोतीचूर लड्डू", category: "Sweets",           price: 420,  unit: "500g",      stock: 60, emoji: "🟠", lowStockThreshold: 12 },
  { id: 5,  name: "Milk Peda",         nameHi: "मिल्क पेड़ा",   category: "Sweets",           price: 360,  unit: "500g",      stock: 40, emoji: "🍮", lowStockThreshold: 10 },
  { id: 6,  name: "Coconut Barfi",     nameHi: "नारियल बर्फी",  category: "Sweets",           price: 480,  unit: "500g",      stock: 35, emoji: "🍫", lowStockThreshold: 8  },
  { id: 7,  name: "Jalebi",            nameHi: "जलेबी",         category: "Sweets",           price: 200,  unit: "500g",      stock: 20, emoji: "🌀", lowStockThreshold: 5  },
  { id: 8,  name: "Sooji Halwa",       nameHi: "सूजी हलवा",    category: "Sweets",           price: 160,  unit: "250g",      stock: 15, emoji: "🟡", lowStockThreshold: 5  },
  { id: 9,  name: "Shrikhand",         nameHi: "श्रीखंड",       category: "Sweets",           price: 200,  unit: "250g",      stock: 22, emoji: "🍦", lowStockThreshold: 6  },
  { id: 10, name: "Samosa",            nameHi: "समोसा",         category: "Namkeen & Snacks", price: 25,   unit: "piece",     stock: 120,emoji: "🔺", lowStockThreshold: 20 },
  { id: 11, name: "Kachori",           nameHi: "कचोरी",         category: "Namkeen & Snacks", price: 30,   unit: "piece",     stock: 80, emoji: "⭕", lowStockThreshold: 15 },
  { id: 12, name: "Dahi Vada",         nameHi: "दही वड़ा",      category: "Namkeen & Snacks", price: 90,   unit: "plate",     stock: 30, emoji: "🥛", lowStockThreshold: 8  },
  { id: 13, name: "Aloo Tikki Chaat",  nameHi: "आलू टिक्की चाट",category: "Namkeen & Snacks", price: 70,   unit: "plate",     stock: 40, emoji: "🍽️", lowStockThreshold: 8  },
  { id: 14, name: "Namkeen Mix",       nameHi: "नमकीन मिक्स",   category: "Namkeen & Snacks", price: 180,  unit: "250g",      stock: 55, emoji: "🥜", lowStockThreshold: 10 },
  { id: 15, name: "Sweet Lassi",       nameHi: "मीठी लस्सी",   category: "Beverages",        price: 80,   unit: "glass",     stock: 50, emoji: "🥤", lowStockThreshold: 10 },
  { id: 16, name: "Masala Chai",       nameHi: "मसाला चाय",    category: "Beverages",        price: 30,   unit: "cup",       stock: 200,emoji: "☕", lowStockThreshold: 30 },
  { id: 17, name: "Rose Sharbat",      nameHi: "गुलाब शरबत",   category: "Beverages",        price: 60,   unit: "glass",     stock: 40, emoji: "🌹", lowStockThreshold: 10 },
  { id: 18, name: "Veg Thali",         nameHi: "वेज थाली",     category: "Meals",            price: 200,  unit: "plate",     stock: 50, emoji: "🍱", lowStockThreshold: 10 },
  { id: 19, name: "Dal Baati Churma",  nameHi: "दाल बाटी चूरमा",category: "Meals",            price: 250,  unit: "plate",     stock: 30, emoji: "🥘", lowStockThreshold: 8  },
  { id: 20, name: "Mithai Box 500g",   nameHi: "मिठाई बॉक्स",  category: "Mithai Boxes",     price: 650,  unit: "box",       stock: 25, emoji: "📦", lowStockThreshold: 5  },
  { id: 21, name: "Mithai Box 1kg",    nameHi: "मिठाई बॉक्स",  category: "Mithai Boxes",     price: 1200, unit: "box",       stock: 20, emoji: "🎁", lowStockThreshold: 4  },
  { id: 22, name: "Festival Gift Box", nameHi: "उपहार बॉक्स",  category: "Mithai Boxes",     price: 2100, unit: "box",       stock: 12, emoji: "🎀", lowStockThreshold: 3  },
];

const SEED_ORDERS: Order[] = [
  {
    id: "ORD-0001", date: "2024-06-18", time: "10:32 AM",
    customerName: "Ramesh Sharma",
    items: [{ ...INITIAL_PRODUCTS[0], qty: 2 }, { ...INITIAL_PRODUCTS[15], qty: 3 }],
    subtotal: 1690, discountType: "percent", discountValue: 5,
    discountAmount: 84.5, total: 1605.5, paymentMode: "UPI", status: "Completed",
  },
  {
    id: "ORD-0002", date: "2024-06-18", time: "11:15 AM",
    customerName: "Priya Gupta",
    items: [{ ...INITIAL_PRODUCTS[9], qty: 4 }, { ...INITIAL_PRODUCTS[14], qty: 2 }, { ...INITIAL_PRODUCTS[16], qty: 1 }],
    subtotal: 320, discountType: "flat", discountValue: 20,
    discountAmount: 20, total: 300, paymentMode: "Cash", status: "Completed",
  },
  {
    id: "ORD-0003", date: "2024-06-18", time: "02:45 PM",
    customerName: "Suresh Patel",
    items: [{ ...INITIAL_PRODUCTS[19], qty: 1 }, { ...INITIAL_PRODUCTS[20], qty: 1 }],
    subtotal: 1850, discountType: "percent", discountValue: 10,
    discountAmount: 185, total: 1665, paymentMode: "Card", status: "Completed",
  },
  {
    id: "ORD-0004", date: "2024-06-17", time: "04:10 PM",
    customerName: "Anita Verma",
    items: [{ ...INITIAL_PRODUCTS[3], qty: 1 }, { ...INITIAL_PRODUCTS[4], qty: 1 }, { ...INITIAL_PRODUCTS[15], qty: 4 }],
    subtotal: 900, discountType: "flat", discountValue: 0,
    discountAmount: 0, total: 900, paymentMode: "Cash", status: "Completed",
  },
  {
    id: "ORD-0005", date: "2024-06-17", time: "06:30 PM",
    customerName: "Deepak Joshi",
    items: [{ ...INITIAL_PRODUCTS[17], qty: 2 }, { ...INITIAL_PRODUCTS[16], qty: 1 }],
    subtotal: 460, discountType: "percent", discountValue: 0,
    discountAmount: 0, total: 460, paymentMode: "UPI", status: "Completed",
  },
  {
    id: "ORD-0006", date: "2024-06-16", time: "09:15 AM",
    customerName: "Kavita Singh",
    items: [{ ...INITIAL_PRODUCTS[0], qty: 3 }, { ...INITIAL_PRODUCTS[5], qty: 2 }, { ...INITIAL_PRODUCTS[15], qty: 2 }],
    subtotal: 3020, discountType: "percent", discountValue: 8,
    discountAmount: 241.6, total: 2778.4, paymentMode: "Card", status: "Completed",
  },
  {
    id: "ORD-0007", date: "2024-06-16", time: "12:00 PM",
    customerName: "Mohan Lal",
    items: [{ ...INITIAL_PRODUCTS[9], qty: 6 }, { ...INITIAL_PRODUCTS[10], qty: 4 }, { ...INITIAL_PRODUCTS[14], qty: 3 }],
    subtotal: 570, discountType: "flat", discountValue: 30,
    discountAmount: 30, total: 540, paymentMode: "Cash", status: "Completed",
  },
  {
    id: "ORD-0008", date: "2024-06-15", time: "03:20 PM",
    customerName: "Sunita Devi",
    items: [{ ...INITIAL_PRODUCTS[21], qty: 1 }, { ...INITIAL_PRODUCTS[6], qty: 2 }],
    subtotal: 2500, discountType: "percent", discountValue: 5,
    discountAmount: 125, total: 2375, paymentMode: "UPI", status: "Completed",
  },
  {
    id: "ORD-0009", date: "2024-06-15", time: "05:45 PM",
    customerName: "Vikram Rao",
    items: [{ ...INITIAL_PRODUCTS[1], qty: 2 }, { ...INITIAL_PRODUCTS[2], qty: 2 }, { ...INITIAL_PRODUCTS[15], qty: 4 }],
    subtotal: 1160, discountType: "flat", discountValue: 60,
    discountAmount: 60, total: 1100, paymentMode: "Cash", status: "Completed",
  },
  {
    id: "ORD-0010", date: "2024-06-14", time: "10:05 AM",
    customerName: "Geeta Kumari",
    items: [{ ...INITIAL_PRODUCTS[7], qty: 3 }, { ...INITIAL_PRODUCTS[8], qty: 2 }, { ...INITIAL_PRODUCTS[16], qty: 2 }],
    subtotal: 1000, discountType: "percent", discountValue: 0,
    discountAmount: 0, total: 1000, paymentMode: "UPI", status: "Completed",
  },
  {
    id: "ORD-0011", date: "2024-06-14", time: "01:30 PM",
    customerName: "Arvind Mishra",
    items: [{ ...INITIAL_PRODUCTS[18], qty: 2 }, { ...INITIAL_PRODUCTS[17], qty: 3 }],
    subtotal: 1100, discountType: "percent", discountValue: 10,
    discountAmount: 110, total: 990, paymentMode: "Card", status: "Completed",
  },
  {
    id: "ORD-0012", date: "2024-06-13", time: "11:45 AM",
    customerName: "Rekha Tiwari",
    items: [{ ...INITIAL_PRODUCTS[0], qty: 4 }, { ...INITIAL_PRODUCTS[4], qty: 2 }],
    subtotal: 3920, discountType: "percent", discountValue: 12,
    discountAmount: 470.4, total: 3449.6, paymentMode: "UPI", status: "Completed",
  },
  {
    id: "ORD-0013", date: "2024-06-13", time: "04:00 PM",
    customerName: "Santosh Kumar",
    items: [{ ...INITIAL_PRODUCTS[9], qty: 10 }, { ...INITIAL_PRODUCTS[12], qty: 2 }, { ...INITIAL_PRODUCTS[15], qty: 3 }],
    subtotal: 580, discountType: "flat", discountValue: 0,
    discountAmount: 0, total: 580, paymentMode: "Cash", status: "Completed",
  },
  {
    id: "ORD-0014", date: "2024-06-12", time: "09:30 AM",
    customerName: "Lalita Prasad",
    items: [{ ...INITIAL_PRODUCTS[20], qty: 2 }, { ...INITIAL_PRODUCTS[5], qty: 1 }],
    subtotal: 2880, discountType: "percent", discountValue: 5,
    discountAmount: 144, total: 2736, paymentMode: "Card", status: "Completed",
  },
  {
    id: "ORD-0015", date: "2024-06-12", time: "07:00 PM",
    customerName: "Hari Om",
    items: [{ ...INITIAL_PRODUCTS[6], qty: 3 }, { ...INITIAL_PRODUCTS[11], qty: 2 }, { ...INITIAL_PRODUCTS[16], qty: 2 }],
    subtotal: 900, discountType: "flat", discountValue: 50,
    discountAmount: 50, total: 850, paymentMode: "Cash", status: "Completed",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
const nowTime = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

// ── Invoice Modal ──────────────────────────────────────────────────────────

function InvoiceModal({ order, shop, onClose }: { order: Order; shop: RegisteredShop | null; onClose: () => void }) {
  const handlePrint = () => window.print();
  const shopName = shop?.shopName || "RetailX POS";
  const shopAddress = shop?.address || [shop?.city, shop?.state].filter(Boolean).join(", ");
  const shopGstin = shop?.gstin ? `GSTIN: ${shop.gstin}` : "";
  const shopContact = [shop?.phone ? `Ph: ${shop.phone}` : null, shop?.email || null].filter(Boolean).join(" | ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(26,14,5,0.7)" }}>
      <div className="bg-[#FFFCF2] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Tax Invoice</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary border border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Invoice body */}
        <div className="overflow-y-auto flex-1 p-6 print-area" id="invoice-print">
          {/* Shop header */}
          <div className="text-center mb-6">
            <div className="text-2xl mb-1">🪔</div>
            <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "var(--font-display)" }}>
              {shopName}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {shopAddress}{shopAddress && shopGstin ? " — " : ""}{shopGstin}
            </p>
            <p className="text-xs text-muted-foreground">{shopContact}</p>
            <div className="mt-3 border-t border-dashed border-border pt-3 flex justify-between text-xs text-muted-foreground">
              <span><span className="font-medium text-foreground">Invoice#</span> {order.id}</span>
              <span>{order.date} &nbsp;{order.time}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span><span className="font-medium text-foreground">Customer:</span> {order.customerName}</span>
              <span><span className="font-medium text-foreground">Payment:</span> {order.paymentMode}</span>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-y border-border">
                <th className="text-left py-2 text-xs font-semibold text-muted-foreground">#</th>
                <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Item</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Rate</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-2 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="py-2">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.unit}</div>
                  </td>
                  <td className="py-2 text-right font-mono text-sm">{fmt(item.price)}</td>
                  <td className="py-2 text-right font-mono text-sm">{item.qty}</td>
                  <td className="py-2 text-right font-mono text-sm font-medium">{fmt(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-accent">
                <span>Discount {order.discountType === "percent" ? `(${order.discountValue}%)` : "(flat)"}</span>
                <span className="font-mono">- {fmt(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-2 mt-2 text-base">
              <span>Total Payable</span>
              <span className="font-mono text-primary">{fmt(order.total)}</span>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground border-t border-dashed border-border pt-4">
            <p className="text-primary font-medium" style={{ fontFamily: "var(--font-display)" }}>
              ❝ Shubhkamnao ke saath, swad bhi ❞
            </p>
            <p className="mt-1">Thank you for your visit! Come again 🙏</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Product Modal ───────────────────────────────────────────────

interface ProductFormData {
  name: string; nameHi: string; category: string;
  price: string; unit: string; stock: string; emoji: string; lowStockThreshold: string;
}

function ProductModal({
  product, onClose, onSave,
}: {
  product?: Product;
  onClose: () => void;
  onSave: (data: Omit<Product, "id">) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ProductFormData>({
    name: product?.name ?? "",
    nameHi: product?.nameHi ?? "",
    category: product?.category ?? "Sweets",
    price: product?.price?.toString() ?? "",
    unit: product?.unit ?? "",
    emoji: product?.emoji ?? "🍬",
    lowStockThreshold: product?.lowStockThreshold?.toString() ?? "10",
  });
  const [formErr, setFormErr] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const set = (k: keyof ProductFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormErr("Product name is required.");
      return;
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      setFormErr("Price must be a positive number.");
      return;
    }
    if (!form.unit.trim()) {
      setFormErr("Unit is required.");
      return;
    }

    setFormErr("");
    setIsSaving(true);
    try {
      const success = await onSave({
        name: form.name.trim(), nameHi: form.nameHi.trim(),
        category: form.category,
        price: parseFloat(form.price),
        unit: form.unit.trim(),
        stock: 0, // stock is always batch-derived; never manually set
        emoji: form.emoji,
        lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      });
      if (success) {
        onClose();
      } else {
        setFormErr("Unable to save product. Please try again.");
      }
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Unable to save product. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(26,14,5,0.7)" }}>
      <div className="bg-[#FFFCF2] rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {product ? "Edit Product" : "Add New Product"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Product Name *</label>
              <input value={form.name} onChange={set("name")} placeholder="e.g. Kaju Katli"
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Hindi Name</label>
              <input value={form.nameHi} onChange={set("nameHi")} placeholder="काजू कतली"
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Emoji Icon</label>
              <input value={form.emoji} onChange={set("emoji")} placeholder="🍬"
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
              <select value={form.category} onChange={set("category")}
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Unit *</label>
              <input value={form.unit} onChange={set("unit")} placeholder="500g / piece / plate" required
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Price (₹) *</label>
              <input value={form.price} onChange={set("price")} placeholder="0.00" type="number"
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Low Stock Alert (units)</label>
              <input value={form.lowStockThreshold} onChange={set("lowStockThreshold")} placeholder="10" type="number"
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <Package size={13} className="flex-shrink-0 mt-0.5" />
                <span><strong>Stock is batch-managed.</strong> After creating this product, go to Inventory → Product Detail → Batches to add stock with expiry dates. This ensures accurate wastage tracking and expiry reports.</span>
              </div>
            </div>
          </div>
          {formErr ? (
            <p className="px-6 pb-2 text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle size={14} />{formErr}
            </p>
          ) : null}
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save size={14} /> {isSaving ? (product ? "Updating..." : "Saving...") : product ? "Update" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────────────

function Dashboard({ orders, products, batchMap }: { orders: Order[]; products: Product[]; batchMap: Record<number, Batch[]> }) {
  const todayOrders = orders.filter(o => o.date === new Date().toISOString().split("T")[0] || orders.indexOf(o) < 3);
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const todayRevenue = orders.slice(0, 3).reduce((s, o) => s + o.total, 0);
  const getStock = (p: Product) => {
    const batches = refreshBatchStatuses(batchMap[p.id] ?? [], p.category);
    return batches.length > 0 ? sellableQty(batches) : 0;
  };
  const lowStock = products.filter(p => getStock(p) <= p.lowStockThreshold);

  const catSales: Record<string, number> = {};
  orders.forEach(o => o.items.forEach(it => {
    catSales[it.category] = (catSales[it.category] ?? 0) + it.price * it.qty;
  }));
  const topCats = Object.entries(catSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = topCats[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{today()} — Good morning, Shop Owner!</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: fmt(todayRevenue), icon: IndianRupee, color: "bg-amber-50 text-amber-700 border-amber-200", iconBg: "bg-amber-100" },
          { label: "Total Orders", value: orders.length, icon: ShoppingBag, color: "bg-orange-50 text-orange-700 border-orange-200", iconBg: "bg-orange-100" },
          { label: "Total Revenue", value: fmt(totalRevenue), icon: TrendingUp, color: "bg-green-50 text-green-700 border-green-200", iconBg: "bg-green-100" },
          { label: "Low Stock Items", value: lowStock.length, icon: AlertCircle, color: lowStock.length > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-600 border-gray-200", iconBg: lowStock.length > 0 ? "bg-red-100" : "bg-gray-100" },
        ].map(({ label, value, icon: Icon, color, iconBg }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-start gap-3 ${color}`}>
            <div className={`${iconBg} p-2 rounded-lg`}><Icon size={18} /></div>
            <div>
              <div className="text-2xl font-bold font-mono">{value}</div>
              <div className="text-xs mt-0.5 opacity-80 font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales by Category */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Sales by Category</h3>
          <div className="space-y-3">
            {topCats.map(([cat, val]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground">{cat}</span>
                  <span className="font-mono text-muted-foreground">{fmt(val)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(val / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <AlertCircle size={16} className="text-destructive" /> Low Stock
          </h3>
          {lowStock.length === 0 ? (
            <div className="text-center py-4">
              <Check size={28} className="mx-auto text-accent mb-2" />
              <p className="text-sm text-muted-foreground">All items stocked well!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(p => {
                const s = getStock(p);
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">{p.emoji} {p.name}</span>
                    <span className={`font-mono font-medium ${s === 0 ? "text-destructive" : "text-amber-600"}`}>
                      {s === 0 ? "No batches" : `${s} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Order ID", "Customer", "Items", "Total", "Payment", "Status"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map(o => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{o.id}</td>
                  <td className="py-2.5 px-3 font-medium">{o.customerName}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{o.items.length} item{o.items.length !== 1 ? "s" : ""}</td>
                  <td className="py-2.5 px-3 font-mono font-medium text-primary">{fmt(o.total)}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">{o.paymentMode}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── POS / Billing View ─────────────────────────────────────────────────────

function POS({
  products, onOrderComplete, batchMap, shop,
}: {
  products: Product[];
  onOrderComplete: (order: Order) => Promise<Order | null>;
  batchMap: Record<number, Batch[]>;
  shop: RegisteredShop | null;
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [checkoutError, setCheckoutError] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "UPI" | "Card">("Cash");
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const filtered = useMemo(() =>
    products.filter(p =>
      (activeCategory === "All" || p.category === activeCategory) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.nameHi.includes(search))
    ), [products, activeCategory, search]);

  const addToCart = (product: Product) => {
    setCart(c => {
      const existing = c.find(i => i.id === product.id);
      if (existing) return c.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const removeFromCart = (id: number) => setCart(c => c.filter(i => i.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const dv = parseFloat(discountValue) || 0;
  const discountAmount = discountType === "percent" ? (subtotal * dv) / 100 : Math.min(dv, subtotal);
  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutError("");

    const order: Order = {
      id: `ORD-${String(Date.now()).slice(-4).padStart(4, "0")}`,
      date: new Date().toISOString().split("T")[0],
      time: nowTime(),
      customerName: customerName || "Walk-in Customer",
      items: cart,
      subtotal, discountType,
      discountValue: dv,
      discountAmount, total,
      paymentMode, status: "Completed",
    };

    const savedOrder = await onOrderComplete(order);
    if (!savedOrder) {
      console.error('Checkout failed: order persistence did not complete');
      setCheckoutError('Checkout failed. Please try again or contact support.');
      return;
    }

    setInvoiceOrder(savedOrder);
    setCart([]);
    setCustomerName("");
    setDiscountValue("");
    setOrderSuccess(true);
    setTimeout(() => setOrderSuccess(false), 3000);
  };

  return (
    <div className="flex gap-5 h-full" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* Product Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Billing Counter</h1>
          <p className="text-sm text-muted-foreground">Select items to add to cart</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCategory === c ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}>
              {c}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto flex-1 pr-1 scrollbar-hide">
          {filtered.map(p => {
            const hasExpiry = EXPIRY_CATEGORIES.has(p.category);
            const liveBatches = refreshBatchStatuses(batchMap[p.id] ?? [], p.category);
            const effectiveStock = liveBatches.length > 0 ? sellableQty(liveBatches) : 0;
            const nearExpiry = liveBatches.some(b => b.status === "near-expiry");
            const blocked = effectiveStock === 0 && liveBatches.some(b => b.status === "unsellable" || b.status === "expired");
            const inCart = cart.find(i => i.id === p.id);
            const canSell = effectiveStock > 0;
            return (
              <button key={p.id} onClick={() => canSell && addToCart(p)}
                disabled={!canSell}
                className={`group relative bg-card rounded-xl border p-3 text-left transition-all ${
                  !canSell ? "opacity-50 cursor-not-allowed border-border" :
                  inCart ? "border-primary ring-1 ring-primary/30 shadow-sm" :
                  nearExpiry ? "border-amber-300 hover:border-amber-400" :
                  "border-border hover:border-primary/40 hover:shadow-sm"
                }`}>
                <div className="text-2xl mb-2 text-center">{p.emoji}</div>
                <div className="text-xs font-semibold text-foreground leading-tight">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.unit}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-primary font-mono">₹{p.price}</span>
                  {canSell && effectiveStock <= p.lowStockThreshold && (
                    <span className="text-xs text-amber-600 font-medium">{effectiveStock} left</span>
                  )}
                  {blocked && <span className="text-xs text-destructive font-medium">Blocked</span>}
                  {!hasExpiry && effectiveStock === 0 && <span className="text-xs text-destructive font-medium">Out</span>}
                </div>
                {nearExpiry && canSell && (
                  <div className="mt-1 text-xs text-amber-700 font-medium flex items-center gap-0.5">
                    <AlertCircle size={9} /> Near expiry
                  </div>
                )}
                {inCart && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {inCart.qty}
                  </div>
                )}
                {canSell && !inCart && (
                  <div className="absolute top-2 right-2 bg-primary/10 text-primary rounded-full w-5 h-5 items-center justify-center hidden group-hover:flex">
                    <Plus size={12} />
                  </div>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Search size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden">
        {/* Cart header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <ShoppingCart size={16} className="text-primary" /> Cart
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-destructive hover:underline">Clear all</button>
            )}
          </div>
          <input
            value={customerName} onChange={e => setCustomerName(e.target.value)}
            placeholder="Customer name (optional)"
            className="mt-3 w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1 opacity-70">Click products to add</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="text-lg">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight truncate">{item.name}</div>
                <div className="text-xs text-primary font-mono">₹{item.price} × {item.qty}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors">
                  <Minus size={10} />
                </button>
                <span className="w-6 text-center text-sm font-bold font-mono">{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-md bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors">
                  <Plus size={10} />
                </button>
                <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center ml-1 transition-colors">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals + Discount + Checkout */}
        <div className="border-t border-border px-5 py-4 space-y-3">
          {/* Discount */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
              <Tag size={11} /> Discount
            </label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
                {(["percent", "flat"] as const).map(t => (
                  <button key={t} onClick={() => setDiscountType(t)}
                    className={`px-3 py-1.5 transition-colors ${discountType === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
                    {t === "percent" ? "%" : "₹"}
                  </button>
                ))}
              </div>
              <input
                value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50"}
                type="number"
                className="flex-1 px-3 py-1.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span className="font-mono">{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-accent">
                <span>Discount {discountType === "percent" ? `(${dv}%)` : "(flat)"}</span>
                <span className="font-mono">- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
              <span>Total</span><span className="font-mono text-primary">{fmt(total)}</span>
            </div>
          </div>

          {/* Payment mode */}
          <div className="flex gap-1.5">
            {(["Cash", "UPI", "Card"] as const).map(m => (
              <button key={m} onClick={() => setPaymentMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  paymentMode === m ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}>
                {m}
              </button>
            ))}
          </div>

          {/* Checkout */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              cart.length > 0 ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm" : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}>
            <Check size={16} /> Place Order & Invoice
          </button>

          {orderSuccess && (
            <div className="flex items-center gap-2 text-xs text-accent bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Check size={12} /> Order placed successfully!
            </div>
          )}
          {checkoutError && (
            <div className="text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {checkoutError}
            </div>
          )}
        </div>
      </div>

      {invoiceOrder && <InvoiceModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} />}
    </div>
  );
}

// ── Batch Modal ────────────────────────────────────────────────────────────

const STATUS_META: Record<BatchStatus, { label: string; cls: string }> = {
  active:      { label: "Active",      cls: "bg-green-100 text-green-700" },
  "near-expiry": { label: "Near Expiry", cls: "bg-amber-100 text-amber-700" },
  unsellable:  { label: "Unsellable",  cls: "bg-red-100 text-red-700" },
  expired:     { label: "Expired",     cls: "bg-gray-100 text-gray-500" },
};

const WASTAGE_REASONS: Record<WastageReason, string> = {
  "expired":           "Expired",
  "near-expiry-cutoff":"Past Cut-off Date",
  "damaged":           "Damaged / Broken",
  "quality-issue":     "Quality Issue",
  "other":             "Other",
};

function BatchModal({
  product,
  batches,
  onClose,
  onAddBatch,
  onDeleteBatch,
  onWaste,
}: {
  product: Product;
  batches: Batch[];
  onClose: () => void;
  onAddBatch: (b: Batch) => Promise<boolean>;
  onDeleteBatch: (id: string) => void;
  onWaste: (entry: Omit<WastageEntry, "id">, batch: Batch) => Promise<boolean>;
}) {
  const requiresExpiry = EXPIRY_CATEGORIES.has(product.category);
  const cutoff = CUTOFF_DAYS[product.category] ?? 0;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    batchNo: "", mfgDate: "", expiryDate: "",
    quantity: "", costPrice: "",
  });
  const [formErr, setFormErr] = useState("");
  const [wastingId, setWastingId] = useState<string | null>(null);
  const [wasteReason, setWasteReason] = useState<WastageReason>("expired");
  const [wasteNotes, setWasteNotes] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteErr, setWasteErr] = useState("");
  const [isWasting, setIsWasting] = useState(false);

  const confirmWaste = (batch: Batch) => {
    const autoReason: WastageReason =
      batch.status === "expired" ? "expired" :
      batch.status === "unsellable" ? "near-expiry-cutoff" : "other";
    setWasteReason(autoReason);
    setWasteNotes("");
    setWasteQty(String(batch.quantity));
    setWasteErr("");
    setWastingId(batch.id);
  };

  const submitWaste = async (batch: Batch) => {
    const qty = parseInt(wasteQty, 10);
    if (!qty || qty <= 0) { setWasteErr("Enter a valid quantity."); return; }
    if (qty > batch.quantity) { setWasteErr(`Cannot waste more than ${batch.quantity} units.`); return; }

    const entry: Omit<WastageEntry, "id"> = {
      date: todayISO, time: nowTime(),
      productId: product.id,
      productName: product.name,
      productEmoji: product.emoji,
      category: product.category,
      batchNo: batch.batchNo,
      batchId: batch.id,
      expiryDate: batch.expiryDate,
      quantity: qty,
      costPrice: batch.costPrice,
      totalLoss: qty * batch.costPrice,
      reason: wasteReason,
      notes: wasteNotes.trim(),
    };

    setIsWasting(true);
    setWasteErr("");
    const success = await onWaste(entry, batch);
    setIsWasting(false);

    if (!success) {
      setWasteErr("Unable to record wastage. Please try again.");
      return;
    }
    setWastingId(null);
  };

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.batchNo.trim()) { setFormErr("Batch number is required."); return; }
    if (!form.expiryDate) { setFormErr("Expiry date is required."); return; }
    if (!form.quantity || parseInt(form.quantity) <= 0) { setFormErr("Quantity must be > 0."); return; }
    const newBatch: Batch = {
      id: `B-${Date.now()}`,
      batchNo: form.batchNo.trim(),
      mfgDate: form.mfgDate,
      expiryDate: form.expiryDate,
      quantity: parseInt(form.quantity),
      costPrice: parseFloat(form.costPrice) || 0,
      addedDate: todayISO,
      status: "active",
    };
    newBatch.status = computeBatchStatus(newBatch, product.category);

    setIsSaving(true);
    const success = await onAddBatch(newBatch);
    setIsSaving(false);

    if (!success) {
      setFormErr("Unable to save batch. Please try again.");
      return;
    }

    setForm({ batchNo: "", mfgDate: "", expiryDate: "", quantity: "", costPrice: "" });
    setShowForm(false);
    setFormErr("");
  };

  const live = refreshBatchStatuses(batches, product.category);
  const totalSellable = sellableQty(live);
  const nearExpiry = live.filter(b => b.status === "near-expiry").length;
  const unsellable = live.filter(b => b.status === "unsellable" || b.status === "expired").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(26,14,5,0.75)" }}>
      <div className="bg-[#FFFCF2] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{product.emoji}</span>
            <div>
              <h2 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                {product.name} — Batch Manager
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {product.category}
                {requiresExpiry && (
                  <span className="ml-2 text-amber-600 font-medium">
                    · Expiry enforced · {cutoff}-day cutoff
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        {/* Summary strip */}
        <div className="px-6 py-3 bg-muted/30 border-b border-border flex gap-6 text-sm flex-shrink-0">
          <div>
            <span className="text-muted-foreground text-xs">Sellable Stock</span>
            <p className="font-bold font-mono text-accent">{totalSellable} units</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Batches</span>
            <p className="font-bold font-mono">{live.length}</p>
          </div>
          {nearExpiry > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">Near Expiry</span>
              <p className="font-bold font-mono text-amber-600">{nearExpiry}</p>
            </div>
          )}
          {unsellable > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">Unsellable / Expired</span>
              <p className="font-bold font-mono text-destructive">{unsellable}</p>
            </div>
          )}
          <div className="ml-auto">
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
              <Plus size={12} /> Add Batch
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Add Batch Form */}
          {showForm && (
            <div className="mx-5 mt-5 mb-2 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                <Plus size={11} /> New Batch
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Batch No. *</label>
                  <input value={form.batchNo} onChange={setF("batchNo")} placeholder="e.g. BT-2024-001"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Quantity (units) *</label>
                  <input type="number" value={form.quantity} onChange={setF("quantity")} placeholder="e.g. 50"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Mfg. Date</label>
                  <input type="date" value={form.mfgDate} onChange={setF("mfgDate")}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">
                    Expiry Date *
                    {requiresExpiry && <span className="text-amber-600 ml-1">(enforced)</span>}
                  </label>
                  <input type="date" value={form.expiryDate} onChange={setF("expiryDate")}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold block mb-1">Cost Price / unit (₹)</label>
                  <input type="number" value={form.costPrice} onChange={setF("costPrice")} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {form.expiryDate && requiresExpiry && (
                  <div className="flex items-end">
                    {(() => {
                      const days = daysUntilExpiry(form.expiryDate);
                      const st = computeBatchStatus({ expiryDate: form.expiryDate } as Batch, product.category);
                      return (
                        <div className={`w-full px-3 py-2 rounded-lg text-xs font-semibold text-center ${STATUS_META[st].cls}`}>
                          {days < 0 ? "Already expired!" : days === 0 ? "Expires today!" : `${days} days until expiry`}
                          {st === "unsellable" && " · Will be UNSELLABLE"}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              {formErr && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{formErr}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setFormErr(""); }}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleAdd} disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Check size={13} /> {isSaving ? "Adding…" : "Add Batch"}
                </button>
              </div>
            </div>
          )}

          {/* Batch list */}
          {live.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No batches added yet.</p>
              <p className="text-xs mt-1 opacity-70">Click "Add Batch" to record a new stock batch.</p>
            </div>
          ) : (
            <div className="p-5 space-y-2.5">
              {[...live].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map(batch => {
                const days = daysUntilExpiry(batch.expiryDate);
                const meta = STATUS_META[batch.status];
                const isUnsellable = batch.status === "unsellable" || batch.status === "expired";
                return (
                  <div key={batch.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isUnsellable ? "border-red-200 bg-red-50/50 opacity-80" :
                      batch.status === "near-expiry" ? "border-amber-200 bg-amber-50/40" :
                      "border-border bg-card"
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold font-mono text-sm">{batch.batchNo}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.cls}`}>
                            {meta.label}
                          </span>
                          {isUnsellable && EXPIRY_CATEGORIES.has(product.category) && (
                            <span className="text-xs text-destructive font-semibold flex items-center gap-0.5">
                              <AlertCircle size={10} /> Auto-blocked
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Mfg.</span>
                            <p className="font-medium font-mono">{batch.mfgDate || "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expiry</span>
                            <p className={`font-medium font-mono ${isUnsellable ? "text-destructive" : batch.status === "near-expiry" ? "text-amber-700" : ""}`}>
                              {batch.expiryDate}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Days left</span>
                            <p className={`font-bold font-mono ${days < 0 ? "text-destructive" : days <= (cutoff + 4) ? "text-amber-600" : "text-accent"}`}>
                              {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "Today" : `${days}d`}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Qty</span>
                            <p className={`font-bold font-mono ${isUnsellable ? "text-muted-foreground line-through" : ""}`}>
                              {batch.quantity} units
                            </p>
                          </div>
                        </div>
                        {batch.costPrice > 0 && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Cost: <span className="font-mono">{fmt(batch.costPrice)}</span>/unit ·
                            Added: <span className="font-mono">{batch.addedDate}</span>
                          </p>
                        )}
                        {requiresExpiry && !isUnsellable && days <= cutoff + 7 && days >= 0 && (
                          <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <AlertCircle size={10} />
                            {days <= cutoff
                              ? `Cut-off reached — will be blocked from sale`
                              : `Cut-off in ${days - cutoff} day${days - cutoff !== 1 ? "s" : ""} (${new Date(new Date(batch.expiryDate).getTime() - cutoff * 86400000).toLocaleDateString("en-IN")})`}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
                        {isUnsellable && wastingId !== batch.id && (
                          <button onClick={() => confirmWaste(batch)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 text-destructive text-xs font-semibold hover:bg-red-100 transition-colors whitespace-nowrap">
                            <Recycle size={11} /> Move to Wastage
                          </button>
                        )}
                        <button onClick={() => onDeleteBatch(batch.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Inline wastage confirm panel */}
                    {wastingId === batch.id && (
                      <div className="mt-3 pt-3 border-t border-red-200 space-y-2.5">
                        <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                          <PackageX size={12} /> Confirm Wastage — {batch.quantity} units of {product.name} (Batch {batch.batchNo})
                        </p>
                        {batch.costPrice > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Estimated loss: <span className="font-mono font-bold text-destructive">{fmt(batch.quantity * batch.costPrice)}</span>
                            <span className="ml-1">({fmt(batch.costPrice)}/unit × {batch.quantity})</span>
                          </p>
                        )}
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Quantity to waste</label>
                          <input type="number" min={1} max={batch.quantity} value={wasteQty}
                            onChange={e => { setWasteQty(e.target.value); setWasteErr(""); }}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason</label>
                          <select value={wasteReason}
                            onChange={e => setWasteReason(e.target.value as WastageReason)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                            {Object.entries(WASTAGE_REASONS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes (optional)</label>
                          <input value={wasteNotes} onChange={e => setWasteNotes(e.target.value)}
                            placeholder="e.g. Found mould, packaging torn…"
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        {wasteErr && <p className="text-xs text-destructive">{wasteErr}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => setWastingId(null)} disabled={isWasting}
                            className="flex-1 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">Cancel</button>
                          <button onClick={() => submitWaste(batch)} disabled={isWasting}
                            className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1 disabled:opacity-60">
                            <Recycle size={11} /> {isWasting ? "Saving…" : "Confirm Wastage"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {requiresExpiry && (
          <div className="px-6 py-3 border-t border-border bg-amber-50/50 flex-shrink-0">
            <p className="text-xs text-amber-800 flex items-center gap-1.5">
              <AlertCircle size={11} />
              <span>
                <strong>{product.category}</strong> items are automatically marked <strong>Unsellable</strong> {cutoff} day{cutoff !== 1 ? "s" : ""} before expiry. Expired stock is never added to cart.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Product Detail Page ────────────────────────────────────────────────────

type DetailTab = "info" | "batches";

function ProductDetailPage({
  product, batches, onBack,
  onUpdateProduct, onDeleteProduct,
  onAddBatch, onDeleteBatch, onUpdateBatch, onWaste,
}: {
  product: Product;
  batches: Batch[];
  onBack: () => void;
  onUpdateProduct: (data: Omit<Product, "id">) => void;
  onDeleteProduct: () => void;
  onAddBatch: (b: Batch) => Promise<boolean>;
  onDeleteBatch: (id: string) => void;
  onUpdateBatch: (id: string, changes: Partial<Batch>) => void;
  onWaste: (entry: Omit<WastageEntry, "id">, batch: Batch) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<DetailTab>("info");
  const hasExpiry = EXPIRY_CATEGORIES.has(product.category);
  const cutoff = CUTOFF_DAYS[product.category] ?? 0;
  const live = refreshBatchStatuses(batches, product.category);

  // ── Product edit state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...product });
  const [saved, setSaved] = useState(false);
  const setF = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft(d => ({ ...d, [k]: k === "price" || k === "stock" || k === "lowStockThreshold" ? Number(e.target.value) : e.target.value }));
  const handleSaveProduct = () => {
    onUpdateProduct({ name: draft.name, nameHi: draft.nameHi, category: draft.category, price: draft.price, unit: draft.unit, stock: draft.stock, emoji: draft.emoji, lowStockThreshold: draft.lowStockThreshold });
    setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const handleDiscard = () => { setDraft({ ...product }); setEditing(false); };

  // ── Batch form state ────────────────────────────────────────────────────
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState({ batchNo: "", mfgDate: "", expiryDate: "", quantity: "", costPrice: "", notes: "" });
  const setBF = (k: keyof typeof batchForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setBatchForm(f => ({ ...f, [k]: e.target.value }));
  const [batchErr, setBatchErr] = useState("");

  const [isAddingBatch, setIsAddingBatch] = useState(false);

  const handleAddBatch = async () => {
    if (!batchForm.batchNo.trim()) { setBatchErr("Batch number is required."); return; }
    if (!batchForm.mfgDate) { setBatchErr("Manufacture date is required."); return; }
    if (!batchForm.expiryDate) { setBatchErr("Expiry date is required."); return; }
    if (!batchForm.quantity || parseInt(batchForm.quantity) <= 0) { setBatchErr("Quantity must be greater than 0."); return; }
    const b: Batch = {
      id: `B-${Date.now()}`,
      batchNo: batchForm.batchNo.trim(),
      mfgDate: batchForm.mfgDate,
      expiryDate: batchForm.expiryDate,
      quantity: parseInt(batchForm.quantity),
      costPrice: parseFloat(batchForm.costPrice) || 0,
      addedDate: todayISO,
      notes: batchForm.notes.trim(),
      status: "active",
    };
    b.status = computeBatchStatus(b, product.category);

    setIsAddingBatch(true);
    const success = await onAddBatch(b);
    setIsAddingBatch(false);

    if (!success) {
      setBatchErr("Unable to save batch. Please try again.");
      return;
    }

    setBatchForm({ batchNo: "", mfgDate: "", expiryDate: "", quantity: "", costPrice: "", notes: "" });
    setShowBatchForm(false); setBatchErr("");
  };

  // ── Batch inline edit ───────────────────────────────────────────────────
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchEditDraft, setBatchEditDraft] = useState<Partial<Batch>>({});
  const startEditBatch = (b: Batch) => { setEditingBatchId(b.id); setBatchEditDraft({ batchNo: b.batchNo, mfgDate: b.mfgDate, expiryDate: b.expiryDate, quantity: b.quantity, costPrice: b.costPrice, notes: b.notes ?? "" }); };
  const saveEditBatch = (b: Batch) => {
    const changes = { ...batchEditDraft, quantity: Number(batchEditDraft.quantity), costPrice: Number(batchEditDraft.costPrice) };
    onUpdateBatch(b.id, changes);
    setEditingBatchId(null);
  };

  // ── Wastage confirm ─────────────────────────────────────────────────────
  const [wastingId, setWastingId] = useState<string | null>(null);
  const [wasteReason, setWasteReason] = useState<WastageReason>("expired");
  const [wasteNotes, setWasteNotes] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteErr, setWasteErr] = useState("");
  const [isWasting, setIsWasting] = useState(false);

  const startWaste = (b: Batch) => {
    setWasteReason(b.status === "expired" ? "expired" : "near-expiry-cutoff");
    setWasteNotes("");
    setWasteQty(String(b.quantity));
    setWasteErr("");
    setWastingId(b.id);
  };

  const submitWaste = async (b: Batch) => {
    const qty = parseInt(wasteQty, 10);
    if (!qty || qty <= 0) { setWasteErr("Enter a valid quantity."); return; }
    if (qty > b.quantity) { setWasteErr(`Cannot waste more than ${b.quantity} units.`); return; }

    const entry: Omit<WastageEntry, "id"> = {
      date: todayISO, time: nowTime(),
      productId: product.id, productName: product.name, productEmoji: product.emoji,
      category: product.category, batchNo: b.batchNo, batchId: b.id, expiryDate: b.expiryDate,
      quantity: qty, costPrice: b.costPrice, totalLoss: qty * b.costPrice,
      reason: wasteReason, notes: wasteNotes.trim(),
    };

    setIsWasting(true);
    setWasteErr("");
    const success = await onWaste(entry, b);
    setIsWasting(false);

    if (!success) {
      setWasteErr("Unable to record wastage. Please try again.");
      return;
    }
    setWastingId(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const totalStock = totalBatchQty(live);
  const sellable   = sellableQty(live);
  const nearExp    = live.filter(b => b.status === "near-expiry").length;
  const blocked    = live.filter(b => b.status === "unsellable" || b.status === "expired").length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Back nav */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronRight size={15} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
        Back to Inventory
      </button>

      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#2C1505] to-[#5C2A0A] rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-4xl flex-shrink-0">
          {product.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#F5E6CA]" style={{ fontFamily: "var(--font-display)" }}>
              {product.name}
            </h1>
            {saved && <span className="text-xs text-green-300 flex items-center gap-1"><CheckCircle2 size={12} />Saved</span>}
          </div>
          <p className="text-sm text-[#C8A070] mt-0.5">{product.nameHi} · {product.category}</p>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#C8A070]">
            <span>₹{product.price} / {product.unit}</span>
            <span>Low stock alert: {product.lowStockThreshold} units</span>
            {hasExpiry && <span className="text-amber-300">⏱ Expiry tracked · {cutoff}d cutoff</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={() => setEditing(e => !e)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5E6CA] text-xs font-semibold transition-colors border border-white/10">
            <Edit2 size={12} /> {editing ? "Editing…" : "Edit Product"}
          </button>
          <button onClick={onDeleteProduct}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-semibold transition-colors border border-red-700/30">
            <Trash2 size={12} /> Delete Product
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Batch Stock", value: `${totalStock} units`, cls: "bg-card border-border" },
          { label: "Sellable Stock",    value: live.length === 0 ? "No batches" : `${sellable} units`, cls: sellable === 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200" },
          { label: "Near Expiry",       value: `${nearExp} batch${nearExp !== 1 ? "es" : ""}`, cls: nearExp > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border" },
          { label: "Blocked / Wasted",  value: `${blocked} batch${blocked !== 1 ? "es" : ""}`, cls: blocked > 0 ? "bg-red-50 border-red-200" : "bg-card border-border" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${cls}`}>
            <div className="text-base font-bold font-mono">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {([["info", "Product Info", Edit2], ["batches", `Batches (${live.length})`, Package]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as DetailTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── Info Tab ── */}
      {tab === "info" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>Product Information</h3>
            {editing ? (
              <div className="flex gap-2">
                <button onClick={handleDiscard} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">Discard</button>
                <button onClick={handleSaveProduct} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5">
                  <Save size={12} />Save Changes
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium hover:bg-muted-foreground/20 transition-colors">
                <Edit2 size={12} />Edit
              </button>
            )}
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Product Name (English)", key: "name" as const, placeholder: "e.g. Kaju Katli" },
              { label: "Product Name (Hindi)", key: "nameHi" as const, placeholder: "e.g. काजू कतली" },
              { label: "Emoji / Icon", key: "emoji" as const, placeholder: "🍬" },
              { label: "Unit", key: "unit" as const, placeholder: "500g / piece / plate" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{label}</label>
                {editing ? (
                  <input value={String(draft[key])} onChange={setF(key)} placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                ) : (
                  <p className="text-sm font-medium py-2">{String(product[key]) || "—"}</p>
                )}
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Category</label>
              {editing ? (
                <select value={draft.category} onChange={setF("category")}
                  className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium py-2">{product.category}</p>
              )}
            </div>
            {[
              { label: "Selling Price (₹)", key: "price" as const, type: "number" },
              { label: "Low Stock Alert Threshold (units)", key: "lowStockThreshold" as const, type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{label}</label>
                {editing ? (
                  <input type={type} value={Number(draft[key])} onChange={setF(key)}
                    className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                ) : (
                  <p className="text-sm font-mono font-bold py-2 text-primary">{String(product[key])}</p>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className="px-6 pb-5 flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={handleDiscard} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Discard</button>
              <button onClick={handleSaveProduct} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                <Save size={13} />Save Changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Batches Tab ── */}
      {tab === "batches" && (
        <div className="space-y-4">
          {/* Add batch button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{live.length} batch{live.length !== 1 ? "es" : ""} recorded</p>
            <button onClick={() => setShowBatchForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus size={14} /> Add New Batch
            </button>
          </div>

          {/* Add batch form */}
          {showBatchForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2"><Plus size={13} />New Batch Entry</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Batch No. *", key: "batchNo" as const, placeholder: "BT-2024-001" },
                  { label: "Quantity *", key: "quantity" as const, placeholder: "50", type: "number" },
                  { label: "Mfg. Date", key: "mfgDate" as const, type: "date" },
                  { label: `Expiry Date *${hasExpiry ? " (enforced)" : ""}`, key: "expiryDate" as const, type: "date" },
                  { label: "Cost Price / unit (₹)", key: "costPrice" as const, placeholder: "0.00", type: "number" },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-amber-900/70 block mb-1">{label}</label>
                    <input type={type ?? "text"} value={batchForm[key]} onChange={setBF(key)} placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                ))}
                <div className="col-span-2 md:col-span-3">
                  <label className="text-xs font-semibold text-amber-900/70 block mb-1">Notes (optional)</label>
                  <input value={batchForm.notes} onChange={setBF("notes")} placeholder="Supplier, condition, remarks…"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {batchForm.expiryDate && hasExpiry && (() => {
                const days = daysUntilExpiry(batchForm.expiryDate);
                const st = computeBatchStatus({ expiryDate: batchForm.expiryDate, manualUnsellable: false } as Batch, product.category);
                return (
                  <div className={`px-3 py-2 rounded-lg text-xs font-semibold text-center ${STATUS_META[st].cls}`}>
                    {days < 0 ? "Already expired!" : `${days} days until expiry`}
                    {st === "unsellable" && " · Will be blocked immediately"}
                  </div>
                );
              })()}
              {batchErr && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{batchErr}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowBatchForm(false); setBatchErr(""); }} className="px-4 py-2 rounded-lg border border-amber-300 text-sm font-medium hover:bg-amber-100 transition-colors">Cancel</button>
                <button onClick={handleAddBatch} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                  <Check size={13} />Add Batch
                </button>
              </div>
            </div>
          )}

          {/* Batch cards */}
          {live.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border text-center py-16">
              <Package size={36} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold text-foreground">No batches yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add New Batch" to record your first batch.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...live].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map(batch => {
                const days = daysUntilExpiry(batch.expiryDate);
                const meta = STATUS_META[batch.status];
                const isBlocked = batch.status === "unsellable" || batch.status === "expired";
                const isEditing = editingBatchId === batch.id;
                return (
                  <div key={batch.id} className={`rounded-2xl border p-5 transition-all ${isBlocked ? "border-red-200 bg-red-50/40" : batch.status === "near-expiry" ? "border-amber-200 bg-amber-50/30" : "border-border bg-card"}`}>
                    {/* Batch header row */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold font-mono text-base">{batch.batchNo}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.cls}`}>{meta.label}</span>
                        {batch.manualUnsellable && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Manual block</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Mark unsellable / restore */}
                        {!isBlocked && (
                          <button onClick={() => onUpdateBatch(batch.id, { manualUnsellable: true })}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-destructive text-xs font-semibold hover:bg-red-100 transition-colors flex items-center gap-1">
                            <PackageX size={11} /> Block
                          </button>
                        )}
                        {batch.manualUnsellable && (
                          <button onClick={() => onUpdateBatch(batch.id, { manualUnsellable: false })}
                            className="px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-accent text-xs font-semibold hover:bg-green-100 transition-colors flex items-center gap-1">
                            <Check size={11} /> Restore
                          </button>
                        )}
                        {!isEditing && (
                          <button onClick={() => startEditBatch(batch)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Edit2 size={13} />
                          </button>
                        )}
                        {isBlocked && wastingId !== batch.id && (
                          <button onClick={() => startWaste(batch)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-100 border border-red-300 text-destructive text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1">
                            <Recycle size={11} /> Wastage
                          </button>
                        )}
                        <button onClick={() => onDeleteBatch(batch.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* View mode */}
                    {!isEditing && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Mfg. Date</p>
                          <p className="font-mono">{batch.mfgDate || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Expiry</p>
                          <p className={`font-mono ${isBlocked ? "text-destructive font-bold" : batch.status === "near-expiry" ? "text-amber-700 font-bold" : ""}`}>
                            {batch.expiryDate}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Days Left</p>
                          <p className={`font-mono font-bold ${days < 0 ? "text-destructive" : days <= cutoff + 4 ? "text-amber-600" : "text-accent"}`}>
                            {days < 0 ? `${Math.abs(days)}d expired` : days === 0 ? "Today!" : `${days} days`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Quantity</p>
                          <p className={`font-mono font-bold text-lg ${isBlocked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {batch.quantity} <span className="text-xs font-normal text-muted-foreground">units</span>
                          </p>
                        </div>
                        {batch.costPrice > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Cost / unit</p>
                            <p className="font-mono">{fmt(batch.costPrice)}</p>
                          </div>
                        )}
                        {batch.costPrice > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Batch Value</p>
                            <p className="font-mono font-semibold">{fmt(batch.quantity * batch.costPrice)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Added On</p>
                          <p className="font-mono text-xs">{batch.addedDate}</p>
                        </div>
                        {batch.notes && (
                          <div className="col-span-2 sm:col-span-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Notes</p>
                            <p className="text-sm text-muted-foreground">{batch.notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Edit mode */}
                    {isEditing && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {[
                            { label: "Batch No.", key: "batchNo" as const },
                            { label: "Quantity", key: "quantity" as const, type: "number" },
                            { label: "Mfg. Date", key: "mfgDate" as const, type: "date" },
                            { label: "Expiry Date", key: "expiryDate" as const, type: "date" },
                            { label: "Cost Price / unit (₹)", key: "costPrice" as const, type: "number" },
                          ].map(({ label, key, type }) => (
                            <div key={key}>
                              <label className="text-xs font-semibold text-muted-foreground block mb-1">{label}</label>
                              <input type={type ?? "text"} value={String(batchEditDraft[key] ?? "")}
                                onChange={e => setBatchEditDraft(d => ({ ...d, [key]: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            </div>
                          ))}
                          <div className="col-span-2 md:col-span-3">
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                            <input value={String(batchEditDraft.notes ?? "")}
                              onChange={e => setBatchEditDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Supplier, remarks…"
                              className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingBatchId(null)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                          <button onClick={() => saveEditBatch(batch)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 flex items-center gap-2">
                            <Save size={13} />Save Batch
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Wastage confirm */}
                    {wastingId === batch.id && (
                      <div className="mt-4 pt-4 border-t border-red-200 space-y-3">
                        <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                          <PackageX size={12} /> Move to Wastage — up to {batch.quantity} units available
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">Quantity to waste</label>
                            <input type="number" min={1} max={batch.quantity} value={wasteQty}
                              onChange={e => { setWasteQty(e.target.value); setWasteErr(""); }}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason</label>
                            <select value={wasteReason} onChange={e => setWasteReason(e.target.value as WastageReason)}
                              className="w-full px-3 py-2 rounded-lg bg-white border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                              {Object.entries(WASTAGE_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                            <input value={wasteNotes} onChange={e => setWasteNotes(e.target.value)} placeholder="Optional…"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                        </div>
                        {wasteErr && <p className="text-xs text-destructive">{wasteErr}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => setWastingId(null)} disabled={isWasting} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                          <button onClick={() => submitWaste(batch)} disabled={isWasting} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 flex items-center gap-2 disabled:opacity-60">
                            <Recycle size={13} />{isWasting ? "Saving…" : "Confirm Wastage"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {hasExpiry && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span><strong>{product.category}</strong> batches are auto-blocked {cutoff} day{cutoff !== 1 ? "s" : ""} before expiry. Use <strong>Block</strong> to manually mark any batch unsellable; <strong>Restore</strong> to reverse it.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inventory View ─────────────────────────────────────────────────────────

function Inventory({
  products,
  onAdd,
  onUpdate,
  onDelete,
  batchMap,
  onAddBatch,
  onDeleteBatch,
  onUpdateBatch,
  onWaste,
}: {
  products: Product[];
  onAdd: (p: Omit<Product, "id">) => Promise<boolean>;
  onUpdate: (id: number, p: Omit<Product, "id">) => void;
  onDelete: (id: number) => void;
  batchMap: Record<number, Batch[]>;
  onAddBatch: (productId: number, batch: Batch) => Promise<boolean>;
  onDeleteBatch: (productId: number, batchId: string) => void;
  onUpdateBatch: (productId: number, batchId: string, changes: Partial<Batch>) => void;
  onWaste: (productId: number, batch: Batch, entry: Omit<WastageEntry, "id">) => Promise<boolean>;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [batchProduct, setBatchProduct] = useState<Product | undefined>();
  const [sortBy, setSortBy] = useState<"name" | "stock" | "price">("name");
  const [detailProductId, setDetailProductId] = useState<number | null>(null);

  // All hooks must run before any early return
  const filtered = useMemo(() =>
    products
      .filter(p => (catFilter === "All" || p.category === catFilter) &&
        p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => sortBy === "stock" ? a.stock - b.stock : sortBy === "price" ? b.price - a.price : a.name.localeCompare(b.name)),
    [products, catFilter, search, sortBy]);

  const detailProduct = detailProductId !== null ? products.find(p => p.id === detailProductId) : null;

  // Early return after all hooks
  if (detailProduct) {
    return (
      <ProductDetailPage
        product={detailProduct}
        batches={batchMap[detailProduct.id] ?? []}
        onBack={() => setDetailProductId(null)}
        onUpdateProduct={data => onUpdate(detailProduct.id, data)}
        onDeleteProduct={() => { onDelete(detailProduct.id); setDetailProductId(null); }}
        onAddBatch={b => onAddBatch(detailProduct.id, b)}
        onDeleteBatch={id => onDeleteBatch(detailProduct.id, id)}
        onUpdateBatch={(id, changes) => onUpdateBatch(detailProduct.id, id, changes)}
        onWaste={(entry, batch) => onWaste(detailProduct.id, batch, entry)}
      />
    );
  }

  const openEdit = (p: Product) => { setEditProduct(p); setShowModal(true); };
  const openAdd = () => { setEditProduct(undefined); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditProduct(undefined); };
  const openBatch = (p: Product) => setBatchProduct(p);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Inventory</h1>
          <p className="text-sm text-muted-foreground">{products.length} products · {products.filter(p => p.stock <= p.lowStockThreshold).length} low stock</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
          <Plus size={15} /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory…"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="name">Sort: Name</option>
          <option value="stock">Sort: Stock (Low first)</option>
          <option value="price">Sort: Price (High first)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["", "Product", "Category", "Price", "Unit", "Stock", "Batches", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const rawBatches = batchMap[p.id] ?? [];
                const liveBatches = refreshBatchStatuses(rawBatches, p.category);
                const hasExpiry = EXPIRY_CATEGORIES.has(p.category);
                const effectiveStock = liveBatches.length > 0 ? sellableQty(liveBatches) : 0;
                const totalStock = totalBatchQty(liveBatches);
                const isLow = effectiveStock <= p.lowStockThreshold && effectiveStock > 0;
                const isOut = effectiveStock === 0;
                const warnBatches = liveBatches.filter(b => b.status === "near-expiry").length;
                const badBatches = liveBatches.filter(b => b.status === "unsellable" || b.status === "expired").length;
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer group/row"
                    onClick={() => setDetailProductId(p.id)}>
                    <td className="px-4 py-3 text-xl">{p.emoji}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium group-hover/row:text-primary transition-colors flex items-center gap-1">
                        {p.name}
                        <ChevronRight size={13} className="opacity-0 group-hover/row:opacity-50 transition-opacity -mb-px" />
                      </div>
                      <div className="text-xs text-muted-foreground">{p.nameHi}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">{p.category}</span>
                        {hasExpiry && <span className="text-xs text-amber-600 font-semibold">⏱ Expiry</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-primary">₹{p.price}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                    <td className="px-4 py-3">
                      {liveBatches.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">No batches</span>
                      ) : (
                        <div>
                          <span className={`font-mono font-semibold ${effectiveStock === 0 ? "text-destructive" : ""}`}>{effectiveStock}</span>
                          {totalStock !== effectiveStock && (
                            <span className="text-xs text-muted-foreground ml-1">/ {totalStock} total</span>
                          )}
                          <div className="text-xs text-muted-foreground">sellable</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openBatch(p)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                        <Package size={11} />
                        {liveBatches.length > 0 ? (
                          <span>{liveBatches.length} batch{liveBatches.length !== 1 ? "es" : ""}</span>
                        ) : (
                          <span className="text-muted-foreground">Add batches</span>
                        )}
                      </button>
                      {(warnBatches > 0 || badBatches > 0) && (
                        <div className="flex gap-1 mt-1">
                          {warnBatches > 0 && <span className="text-xs text-amber-600">⚠ {warnBatches} near expiry</span>}
                          {badBatches > 0 && <span className="text-xs text-destructive">✕ {badBatches} blocked</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isOut ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      }`}>
                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => onDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground text-sm">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={closeModal}
          onSave={async data => {
            if (editProduct) {
              await onUpdate(editProduct.id, data);
              closeModal();
              return true;
            }
            const success = await onAdd(data);
            if (success) {
              closeModal();
              return true;
            }
            return false;
          }}
        />
      )}
      {batchProduct && (
        <BatchModal
          product={batchProduct}
          batches={batchMap[batchProduct.id] ?? []}
          onClose={() => setBatchProduct(undefined)}
          onAddBatch={b => onAddBatch(batchProduct.id, b)}
          onDeleteBatch={id => onDeleteBatch(batchProduct.id, id)}
          onWaste={(entry, batch) => onWaste(batchProduct.id, batch, entry)}
        />
      )}
    </div>
  );
}

// ── Orders View ────────────────────────────────────────────────────────────

function Orders({
  orders, refunds, onRefund, shop,
}: {
  orders: Order[];
  refunds: Refund[];
  onRefund: (refund: Refund, order: Order) => Promise<boolean>;
  shop: RegisteredShop | null;
}) {
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Cash" | "UPI" | "Card" | "Refunded">("All");

  const refundedIds = new Set(refunds.map(r => r.orderId));

  const filtered = orders.filter(o => {
    const isRefunded = refundedIds.has(o.id);
    if (filter === "Refunded") return isRefunded;
    return (filter === "All" || o.paymentMode === filter) &&
      (o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search));
  });

  const total = orders.reduce((s, o) => s + o.total, 0);
  const cashTotal = orders.filter(o => o.paymentMode === "Cash").reduce((s, o) => s + o.total, 0);
  const upiTotal = orders.filter(o => o.paymentMode === "UPI").reduce((s, o) => s + o.total, 0);
  const refundTotal = refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Order Records</h1>
        <p className="text-sm text-muted-foreground">{orders.length} orders · {fmt(total)} total revenue</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Cash Collections", value: fmt(cashTotal), color: "text-green-700", bg: "bg-green-50 border-green-200" },
          { label: "UPI Collections", value: fmt(upiTotal), color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Grand Total", value: fmt(total), color: "text-primary", bg: "bg-amber-50 border-amber-200" },
          { label: "Total Refunded", value: fmt(refundTotal), color: "text-destructive", bg: "bg-red-50 border-red-200" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer or order ID…"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["All", "Cash", "UPI", "Card", "Refunded"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                filter === f
                  ? f === "Refunded" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Order ID", "Date & Time", "Customer", "Items", "Subtotal", "Discount", "Total", "Payment", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary font-medium">{o.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{o.date}</div>
                    <div className="text-xs text-muted-foreground">{o.time}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{o.customerName}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {o.items.map((i, idx) => <div key={`${i.id}-${idx}`}>{i.emoji} {i.name} ×{i.qty}</div>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">{fmt(o.subtotal)}</td>
                  <td className="px-4 py-3 font-mono text-accent">
                    {o.discountAmount > 0 ? `- ${fmt(o.discountAmount)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">{fmt(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.paymentMode === "Cash" ? "bg-green-100 text-green-700" :
                      o.paymentMode === "UPI" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>{o.paymentMode}</span>
                  </td>
                  <td className="px-4 py-3">
                    {refundedIds.has(o.id) ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <RotateCcw size={10} /> Refunded
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setInvoiceOrder(o)} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                        <Eye size={11} /> Invoice
                      </button>
                      {!refundedIds.has(o.id) && (
                        <button onClick={() => setRefundOrder(o)}
                          className="flex items-center gap-1 text-xs text-destructive hover:underline font-medium">
                          <RotateCcw size={11} /> Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground text-sm">No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invoiceOrder && <InvoiceModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} />}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onRefund={async refund => {
            const success = await onRefund(refund, refundOrder);
            if (success) setRefundOrder(null);
            return success;
          }}
        />
      )}
    </div>
  );
}

// ── Sales Records View ─────────────────────────────────────────────────────

type SortKey = "revenue" | "qty" | "orders" | "avgOrder";
type DateRange = "today" | "7d" | "30d" | "all";
type SortDir = "desc" | "asc";

const CHART_COLORS = ["#B5460A", "#1B5E20", "#7B1FA2", "#F57F17", "#0277BD", "#AD1457"];

function SalesRecords({ orders, refunds }: { orders: Order[]; refunds: Refund[] }) {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"products" | "daily" | "category" | "payment">("products");

  const refundedOrderIds = useMemo(() => new Set(refunds.map(r => r.orderId)), [refunds]);

  const inDateRange = useCallback((dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    if (dateRange === "today") return dateStr === now.toISOString().split("T")[0];
    if (dateRange === "7d") return (now.getTime() - d.getTime()) <= 7 * 86400000;
    if (dateRange === "30d") return (now.getTime() - d.getTime()) <= 30 * 86400000;
    return true;
  }, [dateRange]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (!inDateRange(o.date)) return false;
      return paymentFilter === "All" || o.paymentMode === paymentFilter;
    });
  }, [orders, inDateRange, paymentFilter]);

  const salesOrders = useMemo(() =>
    filteredOrders.filter(o => !refundedOrderIds.has(o.id)),
  [filteredOrders, refundedOrderIds]);

  const filteredRefunds = useMemo(() =>
    refunds.filter(r => inDateRange(r.date)),
  [refunds, inDateRange]);

  // KPIs (net of refunds)
  const grossRevenue = filteredOrders.reduce((s, o) => s + o.total, 0);
  const refundTotal = filteredRefunds.reduce((s, r) => s + r.amount, 0);
  const netRevenue = grossRevenue - refundTotal;
  const totalDiscount = salesOrders.reduce((s, o) => s + o.discountAmount, 0);
  const avgOrderValue = salesOrders.length ? netRevenue / salesOrders.length : 0;
  const totalItemsSold = salesOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.qty, 0), 0);

  // Product sales aggregation
  const productStats = useMemo(() => {
    const map: Record<string, { name: string; emoji: string; category: string; qty: number; revenue: number; orders: number }> = {};
    filteredOrders.forEach(o => {
      if (refundedOrderIds.has(o.id)) return;
      o.items.forEach(item => {
        if (categoryFilter !== "All" && item.category !== categoryFilter) return;
        if (!map[item.id]) map[item.id] = { name: item.name, emoji: item.emoji, category: item.category, qty: 0, revenue: 0, orders: 0 };
        map[item.id].qty += item.qty;
        map[item.id].revenue += item.price * item.qty;
        map[item.id].orders += 1;
      });
    });
    return Object.values(map).map(p => ({ ...p, avgOrder: p.revenue / p.orders }));
  }, [filteredOrders, categoryFilter, refundedOrderIds]);

  const sortedProducts = useMemo(() =>
    [...productStats].sort((a, b) => sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]),
    [productStats, sortKey, sortDir]);

  const topProduct = sortedProducts[0];

  // Daily revenue for line chart (last 7 unique dates)
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number; discount: number }> = {};
    filteredOrders.forEach(o => {
      if (!map[o.date]) map[o.date] = { date: o.date, revenue: 0, orders: 0, discount: 0 };
      map[o.date].revenue += o.total;
      map[o.date].orders += 1;
      map[o.date].discount += o.discountAmount;
    });
    filteredRefunds.forEach(r => {
      if (!map[r.date]) map[r.date] = { date: r.date, revenue: 0, orders: 0, discount: 0 };
      map[r.date].revenue -= r.amount;
    });
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: Math.round(d.revenue),
        discount: Math.round(d.discount),
      }));
  }, [filteredOrders, filteredRefunds]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    salesOrders.forEach(o => o.items.forEach(i => {
      map[i.category] = (map[i.category] ?? 0) + i.price * i.qty;
    }));
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [salesOrders]);

  // Payment mode breakdown
  const paymentData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    salesOrders.forEach(o => {
      if (!map[o.paymentMode]) map[o.paymentMode] = { count: 0, revenue: 0 };
      map[o.paymentMode].count += 1;
      map[o.paymentMode].revenue += o.total;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v, revenue: Math.round(v.revenue) }));
  }, [salesOrders]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "desc" ? <SortDesc size={12} /> : <SortAsc size={12} />) : <SortAsc size={12} className="opacity-30" />;

  const customTooltipStyle = { backgroundColor: "#FFFCF2", border: "1px solid rgba(139,90,43,0.18)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Sales Records</h1>
          <p className="text-sm text-muted-foreground">Deep analytics across {filteredOrders.length} orders</p>
        </div>
        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          {/* Date range */}
          <div className="flex rounded-xl border border-border overflow-hidden bg-card text-xs font-semibold">
            {([["today", "Today"], ["7d", "7 Days"], ["30d", "30 Days"], ["all", "All Time"]] as [DateRange, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setDateRange(v)}
                className={`px-3 py-2 transition-colors ${dateRange === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {l}
              </button>
            ))}
          </div>
          {/* Payment filter */}
          <div className="flex rounded-xl border border-border overflow-hidden bg-card text-xs font-semibold">
            {["All", "Cash", "UPI", "Card"].map(v => (
              <button key={v} onClick={() => setPaymentFilter(v)}
                className={`px-3 py-2 transition-colors ${paymentFilter === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
          {/* Category filter */}
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Net Revenue", value: fmt(netRevenue), sub: refundTotal > 0 ? `${fmt(refundTotal)} refunded · ${salesOrders.length} orders` : `${salesOrders.length} orders`, icon: IndianRupee, positive: true },
          { label: "Avg Order Value", value: fmt(avgOrderValue), sub: "per transaction", icon: TrendingUp, positive: true },
          { label: "Items Sold", value: totalItemsSold.toLocaleString("en-IN"), sub: "units across all orders", icon: ShoppingBag, positive: true },
          { label: "Total Discounts", value: fmt(totalDiscount), sub: `${netRevenue > 0 ? ((totalDiscount / (netRevenue + totalDiscount)) * 100).toFixed(1) : 0}% of net`, icon: Tag, positive: false },
        ].map(({ label, value, sub, icon: Icon, positive }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${positive ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"}`}>
                <Icon size={16} />
              </div>
              <ArrowUpRight size={14} className={positive ? "text-accent" : "text-destructive"} />
            </div>
            <div className="mt-3 font-bold text-xl font-mono text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            <div className="text-xs text-muted-foreground opacity-60 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Star product callout */}
      {topProduct && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="text-4xl">{topProduct.emoji}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Flame size={14} className="text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wide">Top Performer</span>
            </div>
            <div className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{topProduct.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {topProduct.qty} units sold · {fmt(topProduct.revenue)} revenue · appeared in {topProduct.orders} order{topProduct.orders !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold font-mono text-primary">{fmt(topProduct.revenue)}</div>
            <div className="text-xs text-muted-foreground">total revenue</div>
          </div>
        </div>
      )}

      {/* Chart tabs */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {([
            ["products", "Top Products", BarChart2],
            ["daily", "Daily Revenue", TrendingUp],
            ["category", "By Category", Award],
            ["payment", "By Payment", IndianRupee],
          ] as [typeof activeTab, string, typeof BarChart2][]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Top Products Bar Chart */}
          {activeTab === "products" && (
            <div>
              <p className="text-xs text-muted-foreground mb-4">Revenue by product (top 8)</p>
              {sortedProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No sales data for selected filters</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={sortedProducts.slice(0, 8)} margin={{ left: 0, right: 10, top: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,90,43,0.08)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "var(--font-body)", fill: "#7A5C3A" }}
                      angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "#7A5C3A" }}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [fmt(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="#B5460A" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {sortedProducts.slice(0, 8).map((_, i) => (
                        <Cell key={`prod-bar-${i}`} fill={i === 0 ? "#B5460A" : i === 1 ? "#D4621A" : "#E8691A"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Daily Revenue Line Chart */}
          {activeTab === "daily" && (
            <div>
              <p className="text-xs text-muted-foreground mb-4">Revenue and discount trends over time</p>
              {dailyData.length < 2 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Not enough daily data for selected range</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,90,43,0.08)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "var(--font-body)", fill: "#7A5C3A" }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "#7A5C3A" }}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={customTooltipStyle}
                      formatter={(v: number, name: string) => [fmt(v), name === "revenue" ? "Revenue" : "Discount"]} />
                    <Legend formatter={v => v === "revenue" ? "Revenue" : "Discount given"} />
                    <Line type="monotone" dataKey="revenue" stroke="#B5460A" strokeWidth={2.5} dot={{ r: 4, fill: "#B5460A" }} />
                    <Line type="monotone" dataKey="discount" stroke="#7B1FA2" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 3, fill: "#7B1FA2" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Category Pie Chart */}
          {activeTab === "category" && (
            <div>
              <p className="text-xs text-muted-foreground mb-4">Revenue share by product category</p>
              {categoryData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No category data available</div>
              ) : (
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} innerRadius={48} dataKey="value" paddingAngle={2} isAnimationActive={false}>
                        {categoryData.map((d, i) => <Cell key={`cat-pie-${d.name}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [fmt(v), "Revenue"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5 w-full">
                    {categoryData.map((d, i) => {
                      const pct = Math.round((d.value / (categoryData.reduce((s, x) => s + x.value, 0))) * 100);
                      return (
                        <div key={d.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              {d.name}
                            </span>
                            <span className="font-mono text-muted-foreground">{fmt(d.value)} <span className="text-xs">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Mode Chart */}
          {activeTab === "payment" && (
            <div>
              <p className="text-xs text-muted-foreground mb-4">Orders and revenue split by payment mode</p>
              {paymentData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No payment data available</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={paymentData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,90,43,0.08)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "var(--font-body)", fill: "#7A5C3A" }} />
                      <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "#7A5C3A" }}
                        tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [fmt(v), "Revenue"]} />
                      <Bar dataKey="revenue" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                        {paymentData.map((d, i) => <Cell key={`pay-bar-${d.name}`} fill={CHART_COLORS[i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="space-y-4">
                    {paymentData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-background">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                          style={{ backgroundColor: CHART_COLORS[i] }}>
                          {d.name[0]}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.count} transaction{d.count !== 1 ? "s" : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold font-mono text-primary text-sm">{fmt(d.revenue)}</div>
                          <div className="text-xs text-muted-foreground">collected</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product Rankings Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Award size={16} className="text-primary" /> Product Rankings
          </h3>
          <p className="text-xs text-muted-foreground">Click column headers to sort</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Rank</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("revenue")}>
                  <span className="flex items-center gap-1 justify-end">Revenue <SortIcon k="revenue" /></span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("qty")}>
                  <span className="flex items-center gap-1 justify-end">Units Sold <SortIcon k="qty" /></span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("orders")}>
                  <span className="flex items-center gap-1 justify-end">Orders <SortIcon k="orders" /></span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => toggleSort("avgOrder")}>
                  <span className="flex items-center gap-1 justify-end">Avg/Order <SortIcon k="avgOrder" /></span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Share</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No products match selected filters</td></tr>
              ) : sortedProducts.map((p, i) => {
                const totalRev = sortedProducts.reduce((s, x) => s + x.revenue, 0);
                const share = totalRev > 0 ? (p.revenue / totalRev) * 100 : 0;
                return (
                  <tr key={p.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      {i === 0 ? <span className="text-lg">🥇</span> :
                       i === 1 ? <span className="text-lg">🥈</span> :
                       i === 2 ? <span className="text-lg">🥉</span> :
                       <span className="font-mono text-muted-foreground text-sm">#{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-base">{p.emoji}</span>
                        <span className="font-medium">{p.name}</span>
                        {i === 0 && <Flame size={12} className="text-primary" />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">{fmt(p.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{p.qty}</td>
                    <td className="px-4 py-3 text-right font-mono">{p.orders}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(p.avgOrder)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-20">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-9 text-right">{share.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Shop Settings View ─────────────────────────────────────────────────────

interface ShopInfo {
  shopName: string;
  tagline: string;
  ownerName: string;
  phone: string;
  altPhone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  gstin: string;
  pan: string;
  fssaiNo: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upiId: string;
  openTime: string;
  closeTime: string;
  holidays: string;
  currency: string;
  taxRate: string;
}

const DEFAULT_SHOP: ShopInfo = {
  shopName: "",
  tagline: "",
  ownerName: "",
  phone: "",
  altPhone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
  gstin: "",
  pan: "",
  fssaiNo: "",
  bankName: "",
  accountNo: "",
  ifsc: "",
  upiId: "",
  openTime: "",
  closeTime: "",
  holidays: "",
  currency: "",
  taxRate: "",
};

type SettingsTab = "business" | "contact" | "address" | "banking" | "operations";

type ShopFieldChange = (k: keyof ShopInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;

function SettingsField({
  label, fieldKey, draft, onFieldChange, placeholder, type = "text", icon: Icon, hint,
}: {
  label: string;
  fieldKey: keyof ShopInfo;
  draft: ShopInfo;
  onFieldChange: ShopFieldChange;
  placeholder?: string;
  type?: string;
  icon?: typeof MapPin;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
        <input
          type={type}
          value={draft[fieldKey] ?? ""}
          onChange={onFieldChange(fieldKey)}
          placeholder={placeholder}
          className={`w-full py-2.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${Icon ? "pl-9 pr-4" : "px-3"}`}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1 opacity-70">{hint}</p>}
    </div>
  );
}

function SettingsTextArea({
  label, fieldKey, draft, onFieldChange, placeholder, rows = 3,
}: {
  label: string;
  fieldKey: keyof ShopInfo;
  draft: ShopInfo;
  onFieldChange: ShopFieldChange;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{label}</label>
      <textarea
        rows={rows}
        value={draft[fieldKey] ?? ""}
        onChange={onFieldChange(fieldKey)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
      />
    </div>
  );
}

function ShopSettings({ activeShop, onSave }: { activeShop: RegisteredShop | null; onSave: (updates: Partial<RegisteredShop>) => Promise<boolean>; }) {
  const [shop, setShop] = useState<ShopInfo>(DEFAULT_SHOP);
  const [draft, setDraft] = useState<ShopInfo>(DEFAULT_SHOP);
  const [activeTab, setActiveTab] = useState<SettingsTab>("business");
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ShopInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setDraft(d => ({ ...d, [k]: val }));
    setHasChanges(true);
    setSaved(false);
  };

  useEffect(() => {
    if (!activeShop) return;

    const initializedShop: ShopInfo = {
      shopName: activeShop.shopName,
      tagline: activeShop.category || DEFAULT_SHOP.tagline,
      ownerName: activeShop.ownerName,
      phone: activeShop.phone,
      altPhone: activeShop.phone,
      email: activeShop.email,
      website: DEFAULT_SHOP.website,
      address: activeShop.address || `${activeShop.city}, ${activeShop.state}`,
      city: activeShop.city,
      state: activeShop.state,
      pincode: DEFAULT_SHOP.pincode,
      landmark: DEFAULT_SHOP.landmark,
      gstin: activeShop.gstin,
      pan: DEFAULT_SHOP.pan,
      fssaiNo: DEFAULT_SHOP.fssaiNo,
      bankName: DEFAULT_SHOP.bankName,
      accountNo: DEFAULT_SHOP.accountNo,
      ifsc: DEFAULT_SHOP.ifsc,
      upiId: DEFAULT_SHOP.upiId,
      openTime: DEFAULT_SHOP.openTime,
      closeTime: DEFAULT_SHOP.closeTime,
      holidays: DEFAULT_SHOP.holidays,
      currency: DEFAULT_SHOP.currency,
      taxRate: DEFAULT_SHOP.taxRate,
    };

    setShop(initializedShop);
    setDraft(initializedShop);
    setHasChanges(false);
    setSaved(false);
  }, [activeShop]);

  const handleSave = async () => {
    if (!activeShop) return;
    setSaving(true);

    const updates: Partial<RegisteredShop> = {
      shopName: draft.shopName,
      ownerName: draft.ownerName,
      phone: draft.phone,
      email: draft.email,
      address: draft.address,
      city: draft.city,
      state: draft.state,
      gstin: draft.gstin,
    };

    const success = await onSave(updates);
    setSaving(false);

    if (success) {
      setShop(draft);
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleDiscard = () => {
    setDraft(shop);
    setHasChanges(false);
    setSaved(false);
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof Building2 }[] = [
    { id: "business", label: "Business Info", icon: Building2 },
    { id: "contact", label: "Contact", icon: Phone },
    { id: "address", label: "Address", icon: MapPin },
    { id: "banking", label: "Banking & Tax", icon: CreditCard },
    { id: "operations", label: "Operations", icon: Clock },
  ];

  if (!activeShop) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">No active shop selected.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Shop Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your shop profile and business details</p>
        </div>
        <div className="flex gap-2 items-center">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-accent font-semibold bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={13} /> Saved successfully
            </span>
          )}
          {hasChanges && !saved && (
            <button onClick={handleDiscard} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              hasChanges ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            disabled={!hasChanges || saving}
          >
            <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Profile banner */}
      <div className="bg-gradient-to-r from-[#2C1505] to-[#4A2010] rounded-2xl p-6 flex items-center gap-5 text-[#F5E6CA]">
        <div className="w-16 h-16 rounded-2xl bg-[#E8691A]/30 border-2 border-[#E8691A]/50 flex items-center justify-center text-3xl flex-shrink-0">
          🪔
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold truncate" style={{ fontFamily: "var(--font-display)", color: "#E8A870" }}>
            {draft.shopName || "Shop Name"}
          </div>
          <div className="text-sm opacity-60 mt-0.5 truncate">{draft.tagline}</div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs opacity-50">
            <span className="flex items-center gap-1"><MapPin size={11} />{draft.city}, {draft.state}</span>
            <span className="flex items-center gap-1"><Phone size={11} />{draft.phone}</span>
            {draft.gstin && <span className="flex items-center gap-1"><Hash size={11} />GSTIN: {draft.gstin}</span>}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">

        {/* Business Info */}
        {activeTab === "business" && (
          <div className="p-6 space-y-5">
            <SectionHead icon={Building2} title="Business Information" desc="Your shop's primary identity details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <SettingsField label="Shop / Business Name" fieldKey="shopName" draft={draft} onFieldChange={set} placeholder="Banke Bihari Sweets & Restaurants" icon={Building2} />
              </div>
              <div className="md:col-span-2">
                <SettingsField label="Tagline / Motto" fieldKey="tagline" draft={draft} onFieldChange={set} placeholder="Your shop's catchphrase" />
              </div>
              <SettingsField label="Owner / Proprietor Name" fieldKey="ownerName" draft={draft} onFieldChange={set} placeholder="Full name" icon={Users} />
              <SettingsField label="Currency" fieldKey="currency" draft={draft} onFieldChange={set} placeholder="INR" />
              <SettingsField label="Default Tax Rate (%)" fieldKey="taxRate" draft={draft} onFieldChange={set} placeholder="5" type="number" hint="Applied on invoices when tax is applicable" />
            </div>
          </div>
        )}

        {/* Contact */}
        {activeTab === "contact" && (
          <div className="p-6 space-y-5">
            <SectionHead icon={Phone} title="Contact Details" desc="How customers and suppliers can reach you" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingsField label="Primary Phone" fieldKey="phone" draft={draft} onFieldChange={set} placeholder="+91 99999 12345" icon={Phone} type="tel" />
              <SettingsField label="Alternate Phone" fieldKey="altPhone" draft={draft} onFieldChange={set} placeholder="+91 98888 00000" icon={Phone} type="tel" />
              <SettingsField label="Email Address" fieldKey="email" draft={draft} onFieldChange={set} placeholder="shop@example.com" icon={Mail} type="email" />
              <SettingsField label="Website" fieldKey="website" draft={draft} onFieldChange={set} placeholder="www.yourshop.in" icon={Globe} />
            </div>
          </div>
        )}

        {/* Address */}
        {activeTab === "address" && (
          <div className="p-6 space-y-5">
            <SectionHead icon={MapPin} title="Shop Address" desc="Used on invoices and for customer navigation" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <SettingsTextArea label="Street Address" fieldKey="address" draft={draft} onFieldChange={set} placeholder="Shop No., Street, Colony" rows={2} />
              </div>
              <SettingsField label="Landmark" fieldKey="landmark" draft={draft} onFieldChange={set} placeholder="Near famous temple, market etc." icon={MapPin} />
              <SettingsField label="City" fieldKey="city" draft={draft} onFieldChange={set} placeholder="Vrindavan" />
              <SettingsField label="State" fieldKey="state" draft={draft} onFieldChange={set} placeholder="Uttar Pradesh" />
              <SettingsField label="PIN Code" fieldKey="pincode" draft={draft} onFieldChange={set} placeholder="281121" type="text" />
            </div>
            {/* Map preview placeholder */}
            <div className="rounded-xl border border-border overflow-hidden bg-muted/40 h-32 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <MapPin size={16} />
              <span>{draft.address ? `${draft.address}, ${draft.city}, ${draft.state} — ${draft.pincode}` : "Address preview will appear here"}</span>
            </div>
          </div>
        )}

        {/* Banking & Tax */}
        {activeTab === "banking" && (
          <div className="p-6 space-y-6">
            <SectionHead icon={CreditCard} title="Banking & Tax Details" desc="For payments, tax compliance, and audit records" />

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tax Registration</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingsField label="GSTIN" fieldKey="gstin" draft={draft} onFieldChange={set} placeholder="09AABCU9603R1ZM" icon={Hash} hint="15-digit GST Identification Number" />
                <SettingsField label="PAN Number" fieldKey="pan" draft={draft} onFieldChange={set} placeholder="AABCU9603R" icon={Hash} />
                <SettingsField label="FSSAI License No." fieldKey="fssaiNo" draft={draft} onFieldChange={set} placeholder="12520999000123" icon={Hash} hint="Required for food businesses" />
              </div>
            </div>

            <div className="border-t border-border pt-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Bank Account</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingsField label="Bank Name" fieldKey="bankName" draft={draft} onFieldChange={set} placeholder="State Bank of India" icon={Building2} />
                <SettingsField label="Account Number" fieldKey="accountNo" draft={draft} onFieldChange={set} placeholder="31245678901" icon={CreditCard} type="text" />
                <SettingsField label="IFSC Code" fieldKey="ifsc" draft={draft} onFieldChange={set} placeholder="SBIN0001234" icon={Hash} />
                <SettingsField label="UPI ID" fieldKey="upiId" draft={draft} onFieldChange={set} placeholder="shopname@bank" icon={Hash} />
              </div>
            </div>
          </div>
        )}

        {/* Operations */}
        {activeTab === "operations" && (
          <div className="p-6 space-y-5">
            <SectionHead icon={Clock} title="Shop Operations" desc="Business hours and operational details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Opening Time</label>
                <input type="time" value={draft.openTime} onChange={set("openTime")}
                  className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Closing Time</label>
                <input type="time" value={draft.closeTime} onChange={set("closeTime")}
                  className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            {/* Hours visual */}
            <div className="bg-muted/40 rounded-xl p-4 flex items-center gap-4">
              <Clock size={20} className="text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Shop Hours</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {draft.openTime
                    ? `Open ${new Date(`2000-01-01T${draft.openTime}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} — Closes ${new Date(`2000-01-01T${draft.closeTime}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`
                    : "Set times above"}
                </p>
              </div>
            </div>
            <SettingsTextArea label="Holidays / Closed Days" fieldKey="holidays" draft={draft} onFieldChange={set} placeholder="List holidays or special closures" rows={3} />
          </div>
        )}
      </div>

      {/* Bottom save bar */}
      {hasChanges && (
        <div className="sticky bottom-0 bg-card border border-border rounded-xl px-5 py-3 flex items-center justify-between shadow-lg">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500" /> You have unsaved changes
          </p>
          <div className="flex gap-2">
            <button onClick={handleDiscard} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Discard</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
              <Save size={13} /> Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ icon: Icon, title, desc }: { icon: typeof Building2; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-border">
      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5"><Icon size={16} /></div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ── Wastage View ───────────────────────────────────────────────────────────

function WastageLog({ entries }: { entries: WastageEntry[] }) {
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<WastageReason | "All">("All");
  const [catFilter, setCatFilter] = useState("All");
  const [sort, setSort] = useState<"date" | "loss">("date");

  const filtered = useMemo(() =>
    entries
      .filter(e =>
        (reasonFilter === "All" || e.reason === reasonFilter) &&
        (catFilter === "All" || e.category === catFilter) &&
        (e.productName.toLowerCase().includes(search.toLowerCase()) ||
         e.batchNo.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => sort === "loss" ? b.totalLoss - a.totalLoss : b.date.localeCompare(a.date)),
    [entries, reasonFilter, catFilter, search, sort]);

  const totalLoss   = filtered.reduce((s, e) => s + e.totalLoss, 0);
  const totalQty    = filtered.reduce((s, e) => s + e.quantity, 0);
  const byCategory  = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(e => { m[e.category] = (m[e.category] ?? 0) + e.totalLoss; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const byReason    = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(e => { m[e.reason] = (m[e.reason] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const uniqueCats = [...new Set(entries.map(e => e.category))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Wastage Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track expired and unsellable inventory write-offs</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Loss Value",  value: fmt(totalLoss),              sub: "estimated cost lost",        cls: "bg-red-50 border-red-200 text-destructive" },
          { label: "Units Wasted",      value: totalQty.toLocaleString("en-IN"), sub: "across all batches",    cls: "bg-orange-50 border-orange-200 text-orange-700" },
          { label: "Wastage Entries",   value: filtered.length,              sub: "batch write-off records",   cls: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Categories Affected", value: byCategory.length,         sub: "product categories",         cls: "bg-purple-50 border-purple-200 text-purple-700" },
        ].map(({ label, value, sub, cls }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${cls}`}>
            <div className="text-2xl font-bold font-mono">{value}</div>
            <div className="text-xs font-semibold mt-0.5">{label}</div>
            <div className="text-xs opacity-60 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border flex flex-col items-center justify-center py-20 gap-3">
          <Recycle size={40} className="text-muted-foreground/30" />
          <p className="font-semibold text-foreground">No wastage recorded yet</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            When you move unsellable or expired batches to wastage from the Inventory, they will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Breakdown panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By category */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm" style={{ fontFamily: "var(--font-display)" }}>
                <PackageX size={14} className="text-destructive" /> Loss by Category
              </h3>
              <div className="space-y-2.5">
                {byCategory.map(([cat, val]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{cat}</span>
                      <span className="font-mono text-destructive">{fmt(val)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-destructive rounded-full"
                        style={{ width: `${(val / (byCategory[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By reason */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm" style={{ fontFamily: "var(--font-display)" }}>
                <Info size={14} className="text-amber-600" /> Wastage Reasons
              </h3>
              <div className="space-y-2">
                {byReason.map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive/60 inline-block" />
                      {WASTAGE_REASONS[reason as WastageReason] ?? reason}
                    </span>
                    <span className="font-mono font-bold text-muted-foreground">{count} batch{count !== 1 ? "es" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or batch no…"
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="All">All Categories</option>
              {uniqueCats.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value as WastageReason | "All")}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="All">All Reasons</option>
              {Object.entries(WASTAGE_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
              {(["date", "loss"] as const).map(s => (
                <button key={s} onClick={() => setSort(s)}
                  className={`px-3 py-2 transition-colors ${sort === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
                  {s === "date" ? "Latest First" : "Highest Loss"}
                </button>
              ))}
            </div>
          </div>

          {/* Wastage table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["", "Product", "Batch No.", "Category", "Expiry", "Qty", "Cost/unit", "Total Loss", "Reason", "Date", "Notes"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-red-50/30 transition-colors">
                      <td className="px-4 py-3 text-xl">{e.productEmoji}</td>
                      <td className="px-4 py-3 font-medium">{e.productName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.batchNo}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">{e.category}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-destructive">{e.expiryDate}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{e.quantity}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {e.costPrice > 0 ? fmt(e.costPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-destructive">
                        {e.totalLoss > 0 ? fmt(e.totalLoss) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {WASTAGE_REASONS[e.reason]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{e.date}</div>
                        <div className="text-xs text-muted-foreground">{e.time}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-32 truncate" title={e.notes}>
                        {e.notes || "—"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-8 text-muted-foreground text-sm">No entries match filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-red-50/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{filtered.length} entries · {totalQty} units</span>
                <span className="font-bold font-mono text-destructive">Total loss: {fmt(totalLoss)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Refund & Drawer Types ──────────────────────────────────────────────────

interface Refund {
  id: string;
  orderId: string;
  date: string;
  time: string;
  customerName: string;
  reason: string;
  refundMode: "Cash" | "UPI" | "Card";
  amount: number;
  type: "full" | "partial";
}

interface DrawerTx {
  id: string;
  date: string;
  time: string;
  type: "sale" | "refund" | "opening" | "withdrawal" | "deposit";
  description: string;
  amount: number; // positive = in, negative = out
  balance: number;
}

interface DrawerDay {
  date: string;
  openingBalance: number;
  closingBalance: number | null;
  transactions: DrawerTx[];
}

const todayISO = new Date().toISOString().split("T")[0];

// ── Refund Modal ───────────────────────────────────────────────────────────

function RefundModal({
  order,
  onClose,
  onRefund,
}: {
  order: Order;
  onClose: () => void;
  onRefund: (refund: Refund) => Promise<boolean>;
}) {
  const [type, setType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState(order.total.toFixed(2));
  const [reason, setReason] = useState("");
  const [refundMode, setRefundMode] = useState<"Cash" | "UPI" | "Card">(order.paymentMode);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxAmount = order.total;
  const refundAmt = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    if (!reason.trim()) { setError("Please enter a reason for refund."); return; }
    if (refundAmt <= 0 || refundAmt > maxAmount) { setError(`Amount must be between ₹0.01 and ${fmt(maxAmount)}.`); return; }
    const refund: Refund = {
      id: `REF-${Date.now().toString().slice(-5)}`,
      orderId: order.id,
      date: todayISO,
      time: nowTime(),
      customerName: order.customerName,
      reason: reason.trim(),
      refundMode,
      amount: refundAmt,
      type,
    };
    setIsSubmitting(true);
    setError("");
    try {
      const success = await onRefund(refund);
      if (!success) {
        setError("Unable to process refund. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process refund. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(26,14,5,0.75)" }}>
      <div className="bg-[#FFFCF2] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 text-destructive"><RotateCcw size={15} /></div>
            <h2 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Process Refund</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Order summary */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order</span>
              <span className="font-mono font-medium">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original Amount</span>
              <span className="font-mono font-bold text-primary">{fmt(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid via</span>
              <span>{order.paymentMode}</span>
            </div>
          </div>

          {/* Refund type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Refund Type</label>
            <div className="flex gap-2">
              {(["full", "partial"] as const).map(t => (
                <button key={t} onClick={() => { setType(t); if (t === "full") setAmount(order.total.toFixed(2)); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    type === t ? "bg-destructive text-destructive-foreground border-destructive" : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {t === "full" ? "Full Refund" : "Partial Refund"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Refund Amount {type === "full" && <span className="text-accent normal-case font-normal">(full order total)</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">₹</span>
              <input
                type="number" value={amount} max={maxAmount}
                onChange={e => { setAmount(e.target.value); setType("partial"); setError(""); }}
                disabled={type === "full"}
                className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-input-background border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Reason for Refund *</label>
            <textarea rows={2} value={reason} onChange={e => { setReason(e.target.value); setError(""); }}
              placeholder="e.g. Wrong item delivered, quality issue, customer request…"
              className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>

          {/* Refund mode */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Refund Via</label>
            <div className="flex gap-2">
              {(["Cash", "UPI", "Card"] as const).map(m => (
                <button key={m} onClick={() => setRefundMode(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    refundMode === m ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <RotateCcw size={13} /> {isSubmitting ? "Processing…" : `Refund ${fmt(refundAmt)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cash Drawer Panel ──────────────────────────────────────────────────────

function DrawerPanel({
  drawerDay,
  onClose,
  onOpenDrawer,
  onCloseDrawer,
  onWithdraw,
  onDeposit,
}: {
  drawerDay: DrawerDay | null;
  onClose: () => void;
  onOpenDrawer: (opening: number) => void;
  onCloseDrawer: () => void;
  onWithdraw: (amount: number, note: string) => void;
  onDeposit: (amount: number, note: string) => void;
}) {
  const [openingInput, setOpeningInput] = useState("0");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [txType, setTxType] = useState<"withdraw" | "deposit">("deposit");
  const [tab, setTab] = useState<"summary" | "history">("summary");
  const [txError, setTxError] = useState("");

  const isOpen = drawerDay !== null && drawerDay.closingBalance === null;
  const currentBalance = drawerDay
    ? drawerDay.transactions.reduce((s, t) => s + t.amount, 0)
    : 0;

  const handleOpen = () => { onOpenDrawer(parseFloat(openingInput) || 0); };

  const handleTx = () => {
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0) { setTxError("Enter a valid amount."); return; }
    if (txType === "withdraw" && amt > currentBalance) { setTxError("Cannot withdraw more than current balance."); return; }
    setTxError("");
    if (txType === "withdraw") onWithdraw(amt, txNote || "Manual withdrawal");
    else onDeposit(amt, txNote || "Manual deposit");
    setTxAmount(""); setTxNote("");
  };

  const txTypeColor = (type: DrawerTx["type"]) => {
    if (type === "sale" || type === "opening" || type === "deposit") return "text-accent";
    return "text-destructive";
  };

  const txIcon = (type: DrawerTx["type"]) => {
    if (type === "sale") return <ArrowUpRight size={12} />;
    if (type === "refund" || type === "withdrawal") return <ArrowDownLeft size={12} />;
    if (type === "opening") return <LockOpen size={12} />;
    return <ArrowUpRight size={12} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-4" style={{ backgroundColor: "rgba(26,14,5,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FFFCF2] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col h-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #2C1505 0%, #4A2010 100%)" }}>
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-amber-300" />
            <div>
              <h2 className="font-semibold text-[#F5E6CA] text-sm" style={{ fontFamily: "var(--font-display)" }}>Cash Drawer</h2>
              <p className="text-xs text-amber-300/70">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isOpen ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
              {isOpen ? "● Open" : "● Closed"}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-amber-300/60 hover:text-amber-200 transition-colors"><X size={15} /></button>
          </div>
        </div>

        {/* Balance card */}
        {isOpen && (
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-border flex-shrink-0">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Current Balance</p>
            <p className="text-3xl font-bold font-mono text-primary mt-1">{fmt(currentBalance)}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-accent">
                <ArrowUpRight size={11} />
                In: {fmt(drawerDay!.transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <ArrowDownLeft size={11} />
                Out: {fmt(Math.abs(drawerDay!.transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Drawer not opened today */}
          {!drawerDay && (
            <div className="p-5 space-y-4">
              <div className="text-center py-4">
                <Banknote size={36} className="mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">Open Today's Drawer</p>
                <p className="text-xs text-muted-foreground mt-1">Enter the opening cash amount to start tracking today's transactions.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Opening Cash Balance (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₹</span>
                  <input type="number" value={openingInput} onChange={e => setOpeningInput(e.target.value)}
                    className="w-full pl-7 pr-4 py-3 rounded-xl bg-input-background border border-border text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <button onClick={handleOpen} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <LockOpen size={15} /> Open Drawer
              </button>
            </div>
          )}

          {/* Drawer closed for today */}
          {drawerDay && drawerDay.closingBalance !== null && (
            <div className="p-5 text-center space-y-3">
              <Lock size={32} className="mx-auto text-muted-foreground/40" />
              <p className="font-semibold">Drawer Closed</p>
              <p className="text-sm text-muted-foreground">Closing balance: <span className="font-mono font-bold text-primary">{fmt(drawerDay.closingBalance)}</span></p>
              <p className="text-xs text-muted-foreground">The drawer was closed for today. Open a new drawer tomorrow.</p>
            </div>
          )}

          {/* Drawer open */}
          {isOpen && (
            <div className="p-5 space-y-5">
              {/* Tabs */}
              <div className="flex gap-1 bg-muted p-1 rounded-xl">
                {(["summary", "history"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    {t === "summary" ? "Transactions" : "Full History"}
                  </button>
                ))}
              </div>

              {tab === "summary" && (
                <div className="space-y-4">
                  {/* Quick transaction */}
                  <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manual Entry</p>
                    <div className="flex gap-1.5">
                      {(["deposit", "withdraw"] as const).map(t => (
                        <button key={t} onClick={() => { setTxType(t); setTxError(""); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            txType === t
                              ? t === "deposit" ? "bg-accent text-accent-foreground border-accent" : "bg-destructive text-destructive-foreground border-destructive"
                              : "bg-card border-border text-muted-foreground"
                          }`}>
                          {t === "deposit" ? "＋ Deposit" : "－ Withdraw"}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">₹</span>
                      <input type="number" value={txAmount} onChange={e => { setTxAmount(e.target.value); setTxError(""); }}
                        placeholder="Amount"
                        className="w-full pl-7 pr-4 py-2 rounded-lg bg-card border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <input value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="Note (optional)"
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    {txError && <p className="text-xs text-destructive">{txError}</p>}
                    <button onClick={handleTx}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition-opacity flex items-center justify-center gap-2 ${
                        txType === "deposit" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"
                      } hover:opacity-90`}>
                      <Check size={13} /> Confirm {txType === "deposit" ? "Deposit" : "Withdrawal"}
                    </button>
                  </div>

                  {/* Recent transactions */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today's Activity</p>
                    <div className="space-y-1.5">
                      {[...drawerDay!.transactions].reverse().slice(0, 8).map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                          <div className={`p-1.5 rounded-lg ${tx.amount >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {txIcon(tx.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">{tx.time}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-mono font-bold ${txTypeColor(tx.type)}`}>
                              {tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{fmt(tx.balance)}</p>
                          </div>
                        </div>
                      ))}
                      {drawerDay!.transactions.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-4">No transactions yet today</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "history" && (
                <div className="space-y-1.5">
                  {[...drawerDay!.transactions].reverse().map(tx => (
                    <div key={tx.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                      <div className={`p-1.5 rounded-lg mt-0.5 flex-shrink-0 ${tx.amount >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {txIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold capitalize text-muted-foreground">{tx.type}</p>
                        <p className="text-sm font-medium leading-tight">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{tx.date} · {tx.time}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-mono font-bold text-sm ${txTypeColor(tx.type)}`}>
                          {tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">bal {fmt(tx.balance)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Close drawer */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">Ready to close the day? This will lock today's drawer.</p>
                <button onClick={onCloseDrawer}
                  className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-2">
                  <Lock size={13} /> Close Drawer — {fmt(currentBalance)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RetailX Platform Auth & Admin ──────────────────────────────────────────

type ShopStatus = "active" | "suspended" | "pending";
type ShopPlan   = "basic" | "standard" | "premium";

interface RegisteredShop {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  category: string;
  gstin: string;
  username: string;
  password: string;
  status: ShopStatus;
  plan: ShopPlan;
  registeredOn: string;
}

const PLAN_META: Record<ShopPlan, { label: string; cls: string; features: string[] }> = {
  basic:    { label: "Basic",    cls: "bg-gray-100 text-gray-700",   features: ["Billing", "Inventory", "5 Users"] },
  standard: { label: "Standard", cls: "bg-blue-100 text-blue-700",   features: ["All Basic", "Sales Reports", "Batch Tracking"] },
  premium:  { label: "Premium",  cls: "bg-amber-100 text-amber-700", features: ["All Standard", "Wastage Log", "Multi-branch"] },
};

const SEED_SHOPS: RegisteredShop[] = [
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", shopName: "Banke Bihari Sweets & Restaurants", ownerName: "Gopal Krishna Sharma", phone: "+91 99999 12345", email: "bb.sweets@gmail.com", address: "Shop No. 12, Purani Basti, Mathura Road", city: "Vrindavan", state: "Uttar Pradesh", category: "Sweets & Restaurant", gstin: "09AABCU9603R1ZM", username: "bankebiharipos", password: "bihari@123", status: "active", plan: "premium", registeredOn: "2024-01-15" },
  { id: "a47ac10b-58cc-4372-a567-0e02b2c3d480", shopName: "Sharma General Store",              ownerName: "Ramesh Sharma",         phone: "+91 98888 54321", email: "sharma.store@gmail.com", address: "14 Civil Lines, Mathura", city: "Mathura", state: "Uttar Pradesh", category: "Grocery & General", gstin: "09BBCDE9501R1ZX", username: "sharmastore",   password: "sharma@456", status: "active",    plan: "standard", registeredOn: "2024-02-20" },
  { id: "b47ac10b-58cc-4372-a567-0e02b2c3d481", shopName: "Gupta Medical Hall",                ownerName: "Suresh Gupta",          phone: "+91 97777 11111", email: "guptamed@gmail.com",    address: "22 Health Plaza, Agra",    city: "Agra",    state: "Uttar Pradesh", category: "Pharmacy",         gstin: "09CCDEF9402R1ZY", username: "guptamedical", password: "gupta@789", status: "suspended", plan: "basic",     registeredOn: "2024-03-10" },
  { id: "c47ac10b-58cc-4372-a567-0e02b2c3d482", shopName: "Patel Farsan & Snacks",             ownerName: "Dinesh Patel",          phone: "+91 96666 22222", email: "patelfarsan@gmail.com", address: "9 Gujarat Market, Surat",   city: "Surat",   state: "Gujarat",       category: "Namkeen & Snacks", gstin: "24DDEFG9301R1ZZ", username: "patelfarsan",  password: "patel@321", status: "pending",   plan: "basic",     registeredOn: "2024-04-05" },
];

interface AuthUser { id: string; email: string; name?: string; role: "admin" | "shop_owner"; shopId?: string; }

// ── Shared login form component ─────────────────────────────────────────────

function LoginPage({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await signIn(email.trim(), password);
      if (!user) {
        setError("Invalid email or password.");
      } else {
        onLogin(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ fontFamily: "var(--font-body)", backgroundColor: "#0F0A19" }}>
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] flex-shrink-0 p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0F0A19 0%, #1A1035 50%, #0D1B3E 100%)" }}>
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.1) 0%, transparent 60%)",
        }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
              <ShoppingBag size={18} className="text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>RetailX</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-semibold border border-indigo-500/30">POS Platform</span>
          </div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Smart POS for<br />every shop.
          </h1>
          <p className="text-indigo-200/60 text-sm leading-relaxed max-w-xs">
            One platform to manage billing, inventory, batches, wastage, and sales analytics — built for Indian retail.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            { icon: ShoppingCart, label: "Billing & Orders",      desc: "Fast checkout & invoices" },
            { icon: Package,      label: "Inventory & Batches",   desc: "Expiry-aware stock control" },
            { icon: BarChart2,    label: "Sales Analytics",       desc: "Category & product insights" },
            { icon: Recycle,      label: "Wastage Tracking",      desc: "Write-off log & loss reports" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{label}</p>
                <p className="text-xs text-indigo-200/40">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <p className="text-xs text-indigo-200/30">© 2024 RetailX Technologies · v2.1.0</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center">
              <ShoppingBag size={16} className="text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">RetailX</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl border p-8" style={{ backgroundColor: "#1A1530", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="mb-7">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Sign in to your store</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Enter your Supabase email and password.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Email</label>
                <div className="relative">
                  <Users size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                    placeholder="name@yourshop.com" autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Password</label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••" autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors p-0.5"
                    style={{ color: "rgba(255,255,255,0.3)" }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#FCA5A5" }}>
                  <AlertCircle size={13} className="flex-shrink-0" /> {error}
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 mt-1"
                style={{
                  backgroundColor: !email || !password ? "rgba(255,255,255,0.06)" : "#6366F1",
                  color: !email || !password ? "rgba(255,255,255,0.3)" : "white",
                  cursor: loading || !email || !password ? "not-allowed" : "pointer",
                }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />Signing in…</>
                  : <><ShieldCheck size={15} />Sign In</>}
              </button>
            </form>

            {/* Hint */}
            <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                Use your registered shop email.
              </p>
              <p className="text-xs text-muted-foreground">If you do not have credentials, ask your RetailX administrator to create your user in Supabase Auth.</p>
            </div>
          </div>

          <p className="text-center text-xs mt-5" style={{ color: "rgba(255,255,255,0.2)" }}>
            Credentials are provided by your RetailX administrator
          </p>
        </div>
      </div>
    </div>
  );
}

// ── RetailX Admin Panel ────────────────────────────────────────────────────

function AdminPanel({ onLogout, shops, shopsLoadError, onAddShop, onUpdateShopStatus }: {
  onLogout: () => void;
  shops: RegisteredShop[];
  shopsLoadError?: string | null;
  onAddShop: (s: RegisteredShop) => Promise<RegisteredShop>;
  onUpdateShopStatus: (id: string, status: ShopStatus) => void;
}) {
  const [tab, setTab] = useState<"shops" | "register">("shops");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShopStatus | "all">("all");
  const [viewCreds, setViewCreds] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  // Registration form
  const emptyForm = { shopName: "", ownerName: "", phone: "", email: "", city: "", state: "Uttar Pradesh", category: "Sweets & Restaurant", gstin: "", plan: "standard" as ShopPlan };
  const [form, setForm] = useState(emptyForm);
  const [genCreds, setGenCreds] = useState<{ username: string; password: string } | null>(null);
  const [formErr, setFormErr] = useState("");

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const generateUsername = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) + Math.floor(Math.random() * 100);
  const generatePassword = () => {
    const words = ["shop", "pos", "retail", "store"];
    return words[Math.floor(Math.random() * words.length)] + "@" + Math.floor(1000 + Math.random() * 9000);
  };

  const handleRegister = async () => {
    if (!form.shopName || !form.ownerName || !form.phone || !form.city || !form.email) {
      setFormErr("Shop name, owner, phone, city and email are required.");
      return;
    }
    if (shops.some(s => s.username === generateUsername(form.shopName))) { setFormErr("A shop with a similar name already exists."); return; }
    const username = generateUsername(form.shopName);
    const password = generatePassword();
    const shop: RegisteredShop = {
      id: crypto.randomUUID(),
      shopName: form.shopName, ownerName: form.ownerName,
      phone: form.phone, email: form.email,
      city: form.city, state: form.state,
      category: form.category, gstin: form.gstin,
      username, password,
      status: "active",
      plan: form.plan,
      registeredOn: todayISO,
    };
    try {
      const saved = await onAddShop(shop);
      setGenCreds({ username: saved.username ?? username, password: saved.password ?? password });
      setFormErr("");
      setForm(emptyForm);
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Failed to create shop");
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key); setTimeout(() => setCopied(""), 2000);
  };

  const filtered = shops.filter(s =>
    (statusFilter === "all" || s.status === statusFilter) &&
    (s.shopName.toLowerCase().includes(search.toLowerCase()) || s.ownerName.toLowerCase().includes(search.toLowerCase()) || s.username.includes(search.toLowerCase()))
  );

  const activeCount    = shops.filter(s => s.status === "active").length;
  const suspendedCount = shops.filter(s => s.status === "suspended").length;
  const pendingCount   = shops.filter(s => s.status === "pending").length;

  return (
    <div className="min-h-screen" style={{ fontFamily: "var(--font-body)", backgroundColor: "#0F0A19" }}>
      {/* Top nav */}
      <header className="border-b px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: "#1A1530", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <ShoppingBag size={14} className="text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-tight" style={{ fontFamily: "var(--font-display)" }}>RetailX</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "rgba(99,102,241,0.2)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.3)" }}>Admin Console</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            <ShieldCheck size={14} className="text-indigo-400" />
            <span>Platform Administrator</span>
          </div>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Shops",  value: shops.length,   color: "#6366F1", bg: "rgba(99,102,241,0.1)" },
            { label: "Active",       value: activeCount,    color: "#34D399", bg: "rgba(52,211,153,0.1)" },
            { label: "Suspended",    value: suspendedCount, color: "#F87171", bg: "rgba(248,113,113,0.1)" },
            { label: "Pending",      value: pendingCount,   color: "#FBBF24", bg: "rgba(251,191,36,0.1)" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-2xl p-4 border" style={{ backgroundColor: bg, borderColor: color + "30" }}>
              <div className="text-3xl font-black font-mono" style={{ color }}>{value}</div>
              <div className="text-xs font-semibold mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([["shops", "Registered Shops", Users], ["register", "Register New Shop", Plus]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setTab(id); setGenCreds(null); setForm(emptyForm); setFormErr(""); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: tab === id ? "#6366F1" : "rgba(255,255,255,0.05)",
                color: tab === id ? "white" : "rgba(255,255,255,0.4)",
                border: `1px solid ${tab === id ? "#6366F1" : "rgba(255,255,255,0.08)"}`,
              }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── Shops list ── */}
        {tab === "shops" && (
          <div className="space-y-4">
            {shopsLoadError && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold border"
                style={{ backgroundColor: "rgba(248,113,113,0.1)", borderColor: "rgba(248,113,113,0.35)", color: "#FCA5A5" }}>
                Failed to load shops: {shopsLoadError}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-52">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shops or owners…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} />
              </div>
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                {(["all", "active", "suspended", "pending"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-3 py-2 text-xs font-bold capitalize transition-colors"
                    style={{
                      backgroundColor: statusFilter === s ? "#6366F1" : "rgba(255,255,255,0.03)",
                      color: statusFilter === s ? "white" : "rgba(255,255,255,0.35)",
                    }}>{s}</button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Shop", "Owner", "City", "Category", "Plan", "Status", "Registered", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const pm = PLAN_META[s.plan] ?? PLAN_META.standard;
                    const showCreds = viewCreds === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: showCreds ? "rgba(99,102,241,0.05)" : "transparent" }}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white text-sm">{s.shopName}</div>
                            <div className="text-xs font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.id}</div>
                          </td>
                          <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.6)" }}>{s.ownerName}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.city}, {s.state}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.category}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pm.cls}`}>{pm.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              s.status === "active" ? "bg-green-900/40 text-green-400" :
                              s.status === "suspended" ? "bg-red-900/40 text-red-400" : "bg-amber-900/40 text-amber-400"
                            }`}>{s.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{s.registeredOn}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button onClick={() => setViewCreds(showCreds ? null : s.id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.2)" }}>
                                <KeyRound size={10} /> Creds
                              </button>
                              {s.status !== "suspended" ? (
                                <button onClick={() => onUpdateShopStatus(s.id, "suspended")}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                  style={{ backgroundColor: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                                  Suspend
                                </button>
                              ) : (
                                <button onClick={() => onUpdateShopStatus(s.id, "active")}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                  style={{ backgroundColor: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>
                                  Activate
                                </button>
                              )}
                              {s.status === "pending" && (
                                <button onClick={() => onUpdateShopStatus(s.id, "active")}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                  style={{ backgroundColor: "rgba(251,191,36,0.1)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.2)" }}>
                                  Approve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {showCreds && (
                          <tr key={`${s.id}-creds`} style={{ backgroundColor: "rgba(99,102,241,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td colSpan={8} className="px-4 py-3">
                              <div className="flex items-center gap-6 text-xs">
                                <span style={{ color: "rgba(255,255,255,0.4)" }}>Credentials for <strong className="text-white">{s.shopName}</strong>:</span>
                                <div className="flex items-center gap-2">
                                  <span style={{ color: "rgba(255,255,255,0.4)" }}>Username:</span>
                                  <span className="font-mono font-bold text-indigo-300">{s.username}</span>
                                  <button onClick={() => copy(s.username, `${s.id}-u`)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: copied === `${s.id}-u` ? "#34D399" : "rgba(255,255,255,0.3)" }}>
                                    {copied === `${s.id}-u` ? <Check size={11} /> : <Hash size={11} />}
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span style={{ color: "rgba(255,255,255,0.4)" }}>Password:</span>
                                  <span className="font-mono font-bold text-indigo-300">{s.password}</span>
                                  <button onClick={() => copy(s.password, `${s.id}-p`)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: copied === `${s.id}-p` ? "#34D399" : "rgba(255,255,255,0.3)" }}>
                                    {copied === `${s.id}-p` ? <Check size={11} /> : <Hash size={11} />}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No shops found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Register new shop ── */}
        {tab === "register" && (
          <div className="max-w-2xl space-y-5">
            {genCreds ? (
              /* Success screen */
              <div className="rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} className="text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Shop Registered!</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Share these credentials with the shop owner to access RetailX POS.</p>
                <div className="rounded-xl p-5 space-y-3 text-left" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {[["Username", genCreds.username, "u"], ["Password", genCreds.password, "p"]].map(([label, val, key]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-300 text-sm">{val}</span>
                        <button onClick={() => copy(val, key)}
                          className="p-1.5 rounded-lg transition-colors" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: copied === key ? "#34D399" : "#A5B4FC" }}>
                          {copied === key ? <Check size={12} /> : <Hash size={12} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setGenCreds(null); setForm(emptyForm); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                  style={{ backgroundColor: "#6366F1" }}>
                  Register Another Shop
                </button>
              </div>
            ) : (
              <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h3 className="font-bold text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>New Shop Registration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Shop Name *",   key: "shopName" as const,  placeholder: "e.g. Sharma General Store" },
                    { label: "Owner Name *",  key: "ownerName" as const, placeholder: "Full name" },
                    { label: "Phone *",       key: "phone" as const,     placeholder: "+91 99999 00000" },
                    { label: "Email",         key: "email" as const,     placeholder: "shop@example.com" },
                    { label: "City *",        key: "city" as const,      placeholder: "e.g. Lucknow" },
                    { label: "State",         key: "state" as const,     placeholder: "e.g. Uttar Pradesh" },
                    { label: "GSTIN",         key: "gstin" as const,     placeholder: "15-digit GST number" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</label>
                      <input value={form[key]} onChange={setF(key)} placeholder={placeholder}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Shop Category</label>
                    <select value={form.category} onChange={setF("category")}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
                      {["Sweets & Restaurant", "Grocery & General", "Pharmacy", "Namkeen & Snacks", "Electronics", "Clothing", "Bakery", "Other"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Plan</label>
                    <select value={form.plan} onChange={setF("plan")}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
                      {Object.entries(PLAN_META).map(([v, m]) => <option key={v} value={v}>{m.label} — {m.features.join(", ")}</option>)}
                    </select>
                  </div>
                </div>
                {formErr && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium"
                    style={{ backgroundColor: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", color: "#FCA5A5" }}>
                    <AlertCircle size={12} />{formErr}
                  </div>
                )}
                <button onClick={handleRegister}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#6366F1" }}>
                  <Plus size={14} /> Register Shop & Generate Credentials
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-shop data model ─────────────────────────────────────────────────────

interface ShopData {
  products:   Product[];
  orders:     Order[];
  refunds:    Refund[];
  batchMap:   Record<number, Batch[]>;
  wastageLog: WastageEntry[];
  drawerDay:  DrawerDay | null;
}

const emptyShopData = (): ShopData => ({
  products: [], orders: [], refunds: [], batchMap: {}, wastageLog: [], drawerDay: null,
});

// Banke Bihari (SHP-001) gets the demo seed data; all others start empty
const INITIAL_SHOP_DATA_MAP: Record<string, ShopData> = {
  "SHP-001": {
    products: INITIAL_PRODUCTS,
    orders: SEED_ORDERS,
    refunds: [],
    batchMap: {},
    wastageLog: [],
    drawerDay: null,
  },
};

// ── Root App ───────────────────────────────────────────────────────────────

type View = "dashboard" | "pos" | "inventory" | "orders" | "sales" | "wastage" | "settings";

export default function App() {
  const [authUser, setAuthUser]     = useState<AuthUser | null>(null);
  const [activeShop, setActiveShop] = useState<RegisteredShop | null>(null);
  const [shops, setShops]           = useState<RegisteredShop[]>([]);
  const [shopsLoadError, setShopsLoadError] = useState<string | null>(null);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [view, setView]             = useState<View>("pos");
  const [showDrawer, setShowDrawer] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSaveShop = useCallback(async (updates: Partial<RegisteredShop>) => {
    if (!activeShop) return false;

    const success = await updateShop(activeShop.id, updates);
    if (!success) return false;

    const updatedShop = { ...activeShop, ...updates };
    setActiveShop(updatedShop);
    setShops(prev => prev.map(s => s.id === activeShop.id ? updatedShop : s));
    return true;
  }, [activeShop]);

  // Initialize Supabase auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const user = await getAuthUser();
        if (!user) {
          setShopsLoading(false);
          return;
        }

        setAuthUser({
          id: user.id,
          email: user.email,
          role: user.role,
          shopId: user.shop_id,
          name: user.name,
        });

        if (user.role === 'admin') {
          try {
            const loadedShops = await fetchShops();
            setShops(loadedShops);
            setShopsLoadError(null);
            if (loadedShops.length > 0) {
              setActiveShop(loadedShops[0]);
            }
          } catch (err) {
            setShops([]);
            setShopsLoadError(
              err instanceof ShopFetchError ? err.message : 'Failed to load shops'
            );
          }
        } else if (user.shop_id) {
          const shop = await fetchShopById(user.shop_id);
          if (shop) {
            setActiveShop(shop);
          } else {
            console.warn(`Shop row not found for id=${user.shop_id}; using placeholder shop data.`);
            setActiveShop({
              id: user.shop_id,
              shopName: 'My Shop',
              ownerName: user.email || 'Shop Owner',
              phone: '',
              email: user.email || '',
              address: '',
              city: '',
              state: '',
              category: '',
              gstin: '',
              username: '',
              password: '',
              status: 'active',
              plan: 'standard',
              registeredOn: '',
            });
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setShopsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Use the authenticated user's shopId first, because activeShop may be a local fallback
  // when the backend shop row is not loadable due to RLS or missing permissions.
  const shopId = authUser?.shopId ?? activeShop?.id ?? null;
  const shopDataHook = useShopData(shopId);
  const { 
    products, 
    orders, 
    refunds, 
    batchMap, 
    wastageLog, 
    drawerDay,
    isLoading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    addBatch,
    updateBatch,
    deleteBatch,
    addOrder,
    updateOrder,
    addRefund,
    recordWastage,
    openDrawer,
    closeDrawer,
    addDrawerTx,
  } = shopDataHook;

  // ── Drawer helpers ───────────────────────────────────────────────────────

  const drawerBalance = useMemo(() => {
    if (!drawerDay || drawerDay.closingBalance !== null) return null;
    return drawerDay.transactions.reduce((s, t) => s + t.amount, 0);
  }, [drawerDay]);

  const handleWithdraw = useCallback((amount: number, note: string) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    addDrawerTx({ date: todayISO, time: nowTime(), type: "withdrawal", description: note, amount: -amount });
  }, [addDrawerTx]);

  const handleDeposit = useCallback((amount: number, note: string) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    addDrawerTx({ date: todayISO, time: nowTime(), type: "deposit", description: note, amount });
  }, [addDrawerTx]);

  // ── Order helpers ────────────────────────────────────────────────────────

  const handleOrderComplete = useCallback(async (order: Order) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

    const savedOrder = await addOrder(order, order.items);
    if (!savedOrder) {
      console.error('Checkout failed: order creation failed');
      return null;
    }

    const txAmount = savedOrder.total;
    const txType = savedOrder.paymentMode === 'Cash' ? 'sale' : 'sale';
    const description = `Sale ${savedOrder.id} — ${savedOrder.customerName} (${savedOrder.paymentMode})`;

    const drawerSuccess = await addDrawerTx({ 
      date: todayISO, 
      time: nowTime(), 
      type: txType, 
      description, 
      amount: txAmount 
    });

    if (!drawerSuccess) {
      console.error('Checkout partial failure: order saved but drawer transaction failed');
    }

    return savedOrder;
  }, [addOrder, addDrawerTx]);

  const handleRefund = useCallback(async (refund: Refund, order: Order): Promise<boolean> => {
    const success = await addRefund(refund, order.items);
    if (!success) return false;

    const todayISO = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const description = `Refund ${refund.id} for ${refund.orderId} — ${refund.customerName} (${refund.refundMode})`;

    const drawerSuccess = await addDrawerTx({
      date: todayISO,
      time: nowTimeStr,
      type: 'refund',
      description,
      amount: -refund.amount,
    });

    if (!drawerSuccess) {
      console.warn('Refund saved but drawer transaction failed');
    }

    return true;
  }, [addRefund, addDrawerTx]);

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "pos", label: "Billing Counter", icon: ShoppingCart },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "orders", label: "Order Records", icon: ClipboardList },
    { id: "sales", label: "Sales Records", icon: BarChart2 },
    { id: "wastage", label: "Wastage Log", icon: Recycle },
    { id: "settings", label: "Shop Settings", icon: Settings },
  ];

  const lowStockCount = products.filter(p => {
    const batches = refreshBatchStatuses(batchMap[p.id] ?? [], p.category);
    const s = batches.length > 0 ? sellableQty(batches) : 0;
    return s <= p.lowStockThreshold;
  }).length;

  // ── Loading and Error States ────────────────────────────────────────────

  if (shopsLoading || (activeShop && isLoading)) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center">
          <Loader size={32} className="animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center max-w-md">
          <AlertCircle size={32} className="mx-auto mb-3 text-destructive" />
          <h1 className="text-lg font-semibold mb-2">Error Loading Data</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  // ── Auth gates ──────────────────────────────────────────────────────────
  if (!authUser) {
    return (
      <LoginPage
        onLogin={async user => {
          // Map backend/supabase shape (snake_case) to app shape (camelCase)
          const mapped = {
            id: user.id,
            email: user.email,
            role: (user.role as any) || user.role,
            shopId: (user as any).shop_id || (user as any).shopId,
            name: (user as any).name || (user as any).full_name || user.email || '',
          } as AuthUser;

          setAuthUser(mapped);

          if (mapped.shopId) {
            const shop = await fetchShopById(mapped.shopId);
            if (shop) setActiveShop(shop);
            else {
              console.warn(`Logged in user shop row not found for shopId=${mapped.shopId}; using placeholder shop data.`);
              setActiveShop({
                id: mapped.shopId,
                shopName: 'My Shop',
                ownerName: mapped.name || 'Shop Owner',
                phone: '',
                email: mapped.email || '',
                address: '',
                city: '',
                state: '',
                category: '',
                gstin: '',
                username: '',
                password: '',
                status: 'active',
                plan: 'standard',
                registeredOn: '',
              });
            }
          }

          if (mapped.role === 'admin') {
            try {
              const loadedShops = await fetchShops();
              setShops(loadedShops);
              setShopsLoadError(null);
            } catch (err) {
              setShops([]);
              setShopsLoadError(
                err instanceof ShopFetchError ? err.message : 'Failed to load shops'
              );
            }
          }
        }}
      />
    );
  }
  const handleLogout = async () => {
    await signOut();
    setAuthUser(null);
    setActiveShop(null);
  };

  if (authUser.role === "admin") {
    return (
      <AdminPanel
        onLogout={handleLogout}
        shops={shops}
        shopsLoadError={shopsLoadError}
        onAddShop={async s => {
          const savedShop = await addShop(s);
          if (!savedShop) {
            throw new Error('Shop provisioning failed');
          }
          setShops(prev => [...prev, savedShop]);
          return savedShop;
        }}
        onUpdateShopStatus={(id, status) => setShops(prev => prev.map(s => s.id === id ? { ...s, status } : s))}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "var(--font-body)", backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <aside className={`flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-56" : "w-16"}`}
        style={{ backgroundColor: "var(--sidebar)", color: "var(--sidebar-foreground)" }}>
        {/* Brand */}
        <div className="px-4 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#E8691A]/30 border border-[#E8691A]/40 flex items-center justify-center">
                <ShoppingBag size={14} style={{ color: "#E8A870" }} />
              </div>
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="text-xs font-black leading-tight truncate" style={{ fontFamily: "var(--font-display)", color: "var(--sidebar-primary)" }}>
                  {activeShop ? activeShop.shopName.split(" ").slice(0, 3).join(" ") : "RetailX POS"}
                </div>
                <div className="text-xs opacity-50 leading-tight truncate">
                  {activeShop ? `${activeShop.city} · ${(PLAN_META[activeShop.plan] ?? PLAN_META.standard).label}` : "Dashboard"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button key={id} onClick={() => setView(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                  active ? "text-sidebar-primary-foreground" : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: active ? "var(--sidebar-primary)" : "transparent",
                  color: active ? "var(--sidebar-primary-foreground)" : "var(--sidebar-foreground)",
                }}>
                <Icon size={17} className="flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
                {id === "inventory" && lowStockCount > 0 && (
                  <span className={`ml-auto rounded-full bg-destructive text-destructive-foreground text-xs font-bold w-5 h-5 flex items-center justify-center ${!sidebarOpen ? "absolute -top-1 -right-1" : ""}`}>
                    {lowStockCount}
                  </span>
                )}
                {id === "wastage" && wastageLog.length > 0 && (
                  <span className={`ml-auto rounded-full bg-orange-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center ${!sidebarOpen ? "absolute -top-1 -right-1" : ""}`}>
                    {wastageLog.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom info */}
        <div className="px-3 py-4 border-t space-y-3" style={{ borderColor: "var(--sidebar-border)" }}>
          {/* Logged-in user */}
          <div className={`flex items-center gap-2.5 ${sidebarOpen ? "px-1" : "justify-center"}`}>
            <div className="w-7 h-7 rounded-lg bg-[#E8691A]/30 border border-[#E8691A]/40 flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ color: "#E8A870" }}>
              {authUser.name.charAt(0)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--sidebar-foreground)" }}>{authUser.name}</p>
                <p className="text-xs opacity-50" style={{ color: "var(--sidebar-foreground)" }}>{authUser.role}</p>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout} title="Sign out"
                className="p-1.5 rounded-lg opacity-50 hover:opacity-90 hover:bg-red-900/30 transition-all flex-shrink-0"
                style={{ color: "var(--sidebar-foreground)" }}>
                <LogOut size={13} />
              </button>
            )}
          </div>
          {!sidebarOpen && (
            <button onClick={handleLogout} title="Sign out"
              className="w-full flex justify-center p-1.5 rounded-lg opacity-40 hover:opacity-80 hover:bg-red-900/30 transition-all"
              style={{ color: "var(--sidebar-foreground)" }}>
              <LogOut size={13} />
            </button>
          )}

          <button onClick={() => setSidebarOpen(v => !v)} className="text-xs opacity-40 hover:opacity-70 transition-opacity flex items-center gap-2 w-full">
            <ChevronDown size={12} className={`transition-transform flex-shrink-0 ${sidebarOpen ? "rotate-90" : "-rotate-90"}`} />
            {sidebarOpen && "Collapse"}
          </button>
          {sidebarOpen && (
            <div className="text-xs opacity-30 leading-relaxed">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Star size={9} />POS v1.0 · {today()}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {navItems.find(n => n.id === view)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Drawer widget */}
            <button
              onClick={() => setShowDrawer(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:shadow-sm ${
                drawerBalance !== null
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-card border-border text-muted-foreground"
              }`}>
              <Wallet size={13} />
              {drawerBalance !== null ? (
                <span className="font-mono">{fmt(drawerBalance)}</span>
              ) : (
                <span>Cash Drawer</span>
              )}
              {drawerBalance === null && <span className="text-red-400 font-medium">● Closed</span>}
              {drawerBalance !== null && <span className="text-green-600 font-medium">● Open</span>}
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="hidden sm:inline">Shop Open</span>
              </div>
              <span className="font-mono hidden md:inline">{today()}</span>
            </div>
          </div>
        </header>

        <div className={`px-6 py-6 ${view === "pos" ? "h-[calc(100vh-57px)] flex flex-col" : ""}`}>
          {view === "dashboard" && <Dashboard orders={orders} products={products} batchMap={batchMap} />}
          {view === "pos" && <div className="flex-1 min-h-0"><POS products={products} onOrderComplete={handleOrderComplete} batchMap={batchMap} shop={activeShop} /></div>}
          {view === "inventory" && <Inventory products={products} onAdd={addProduct} onUpdate={updateProduct} onDelete={deleteProduct} batchMap={batchMap} onAddBatch={addBatch} onDeleteBatch={deleteBatch} onUpdateBatch={updateBatch} onWaste={recordWastage} />}
          {view === "wastage" && <WastageLog entries={wastageLog} />}
          {view === "orders" && <Orders orders={orders} refunds={refunds} onRefund={handleRefund} shop={activeShop} />}
          {view === "sales" && <SalesRecords orders={orders} refunds={refunds} />}
          {view === "settings" && <ShopSettings activeShop={activeShop} onSave={handleSaveShop} />}
        </div>
      </main>

      {showDrawer && (
        <DrawerPanel
          drawerDay={drawerDay}
          onClose={() => setShowDrawer(false)}
          onOpenDrawer={openDrawer}
          onCloseDrawer={closeDrawer}
          onWithdraw={handleWithdraw}
          onDeposit={handleDeposit}
        />
      )}

      <style>{`
        .scrollbar-hide { scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @media print {
          body > * { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>
    </div>
  );
}
