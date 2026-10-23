const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type CustomerInteraction = {
  id?: string;
  content: string;
  created_at?: string;
};

export type Customer = {
  id: string;
  clerk_id: string;
  company_name: string;
  contact_person: string;
  address: string;
  phone_number: string;
  tax_code: string;
  website: string;
  facebook: string;
  zalo: string;
  notes: string;
  interaction_history: CustomerInteraction[];
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  clerk_id: string;
  product_code: string;
  name: string;
  product_type: string;
  unit: string;
  selling_price: number | string;
  stock: number | string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  product_code: string;
  name: string;
  product_type: string;
  unit: string;
  selling_price: number;
  stock: number;
  notes: string;
};

export type ProductImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  products: Product[];
};

export type CustomerImportResult = {
  imported: number;
  skipped: number;
  customers: Customer[];
};

export type OrderCustomer = {
  id: string;
  company_name: string;
  contact_person: string;
  phone_number: string;
  address?: string;
  tax_code?: string;
};

export type OrderItem = {
  id: string;
  product_name: string;
  unit: string;
  quantity: number | string;
  selling_price: number | string;
  vat_invoice: boolean;
  notes: string;
};

export type Order = {
  id: string;
  clerk_id: string;
  customer_id: string;
  order_date: string;
  notes: string;
  is_paid: boolean;
  quote_id?: string | null;
  drive_file_id?: string;
  drive_file_name?: string;
  drive_web_link?: string;
  created_at: string;
  updated_at: string;
  customers?: OrderCustomer | null;
  items: OrderItem[];
};

export type OrderItemInput = {
  product_name: string;
  unit: string;
  quantity: number;
  selling_price: number;
  vat_invoice: boolean;
  notes: string;
};

export type OrderInput = {
  customer_id: string;
  order_date?: string | null;
  notes: string;
  is_paid: boolean;
  items: OrderItemInput[];
};

export type PaymentMethod = "cash" | "bank_transfer";

export type Payment = {
  id: string;
  order_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
};

export type PaymentInput = {
  order_id: string;
  amount: number;
  payment_date?: string | null;
  payment_method: PaymentMethod;
};

export type QuoteItem = {
  id: string;
  product_name: string;
  unit: string;
  quantity: number | string;
  selling_price: number | string;
  vat_invoice: boolean;
  notes: string;
};

export type Quote = {
  id: string;
  clerk_id: string;
  customer_id: string;
  notes: string;
  subtotal: number | string;
  vat_total: number | string;
  grand_total: number | string;
  drive_file_id?: string;
  drive_file_name?: string;
  drive_web_link?: string;
  created_at: string;
  updated_at: string;
  customers?: OrderCustomer | null;
  items: QuoteItem[];
};

export type QuoteItemInput = {
  product_name: string;
  unit: string;
  quantity: number;
  selling_price: number;
  vat_invoice: boolean;
  notes: string;
};

export type QuoteInput = {
  customer_id: string;
  notes: string;
  items: QuoteItemInput[];
};

export type CustomerInput = {
  company_name: string;
  contact_person: string;
  address: string;
  phone_number: string;
  tax_code: string;
  website: string;
  facebook: string;
  zalo: string;
  notes: string;
  interaction_history?: CustomerInteraction[];
};

async function apiJson<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // keep default message
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function sendChatMessage(
  prompt: string,
  token: string,
  threadId: string,
): Promise<string> {
  const payload = await apiJson<{ response: string }>("/api/chat/", token, {
    method: "POST",
    body: JSON.stringify({ prompt, thread_id: threadId }),
    signal: AbortSignal.timeout(300_000),
  });
  const reply = payload.response;
  return typeof reply === "string" ? reply : JSON.stringify(reply);
}

export async function listCustomers(token: string): Promise<Customer[]> {
  return apiJson<Customer[]>("/api/customers/", token);
}

export async function getCustomer(
  token: string,
  customerId: string,
): Promise<Customer> {
  return apiJson<Customer>(`/api/customers/${customerId}`, token);
}

export async function createCustomer(
  token: string,
  payload: CustomerInput,
): Promise<Customer> {
  return apiJson<Customer>("/api/customers/", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomer(
  token: string,
  customerId: string,
  payload: Partial<CustomerInput>,
): Promise<Customer> {
  return apiJson<Customer>(`/api/customers/${customerId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomer(
  token: string,
  customerId: string,
): Promise<{ deleted: boolean; customer: Customer }> {
  return apiJson<{ deleted: boolean; customer: Customer }>(
    `/api/customers/${customerId}`,
    token,
    { method: "DELETE" },
  );
}

export async function importCustomers(
  token: string,
  file: File,
): Promise<CustomerImportResult> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_URL}/api/customers/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // keep default message
    }
    throw new Error(detail);
  }
  return (await response.json()) as CustomerImportResult;
}

export async function downloadCustomerTemplate(token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/customers/template`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Không tải được file mẫu.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mau-khach-hang.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function listProducts(token: string): Promise<Product[]> {
  return apiJson<Product[]>("/api/products/", token);
}

export async function getProduct(
  token: string,
  productId: string,
): Promise<Product> {
  return apiJson<Product>(`/api/products/${productId}`, token);
}

export async function createProduct(
  token: string,
  payload: ProductInput,
): Promise<Product> {
  return apiJson<Product>("/api/products/", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(
  token: string,
  productId: string,
  payload: Partial<ProductInput>,
): Promise<Product> {
  return apiJson<Product>(`/api/products/${productId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(
  token: string,
  productId: string,
): Promise<{ deleted: boolean; product: Product }> {
  return apiJson<{ deleted: boolean; product: Product }>(
    `/api/products/${productId}`,
    token,
    { method: "DELETE" },
  );
}

export async function importProducts(
  token: string,
  file: File,
): Promise<ProductImportResult> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_URL}/api/products/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // keep default message
    }
    throw new Error(detail);
  }
  return (await response.json()) as ProductImportResult;
}

export async function downloadProductTemplate(token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/products/template`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Không tải được file mẫu.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mau-san-pham.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function listOrders(
  token: string,
  filters?: { customerId?: string; isPaid?: boolean },
): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filters?.customerId) {
    params.set("customer_id", filters.customerId);
  }
  if (filters?.isPaid !== undefined) {
    params.set("is_paid", String(filters.isPaid));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiJson<Order[]>(`/api/orders/${query}`, token);
}

export async function getOrder(token: string, orderId: string): Promise<Order> {
  return apiJson<Order>(`/api/orders/${orderId}`, token);
}

export async function createOrder(
  token: string,
  payload: OrderInput,
): Promise<Order> {
  return apiJson<Order>("/api/orders/", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrder(
  token: string,
  orderId: string,
  payload: Partial<OrderInput>,
): Promise<Order> {
  return apiJson<Order>(`/api/orders/${orderId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteOrder(
  token: string,
  orderId: string,
): Promise<{ deleted: boolean; order: Order }> {
  return apiJson<{ deleted: boolean; order: Order }>(
    `/api/orders/${orderId}`,
    token,
    { method: "DELETE" },
  );
}

export type OrderFileCustomerInput = {
  company_name?: string;
  contact_person?: string;
  address?: string;
  phone_number?: string;
  tax_code?: string;
  email?: string;
};

export type GenerateOrderFileInput = {
  order_id?: string;
  customer?: OrderFileCustomerInput;
  notes?: string;
  items?: OrderItemInput[];
  order_number?: string;
  order_date?: string;
};

export type GeneratedOrderFile = {
  file_id: string;
  file_name: string;
  web_link: string;
  sheet_name: string;
  summary: string;
  template_name: string;
  order: Record<string, unknown>;
};

export async function generateOrderFile(
  token: string,
  payload: GenerateOrderFileInput,
): Promise<GeneratedOrderFile> {
  return apiJson<GeneratedOrderFile>("/api/orders/generate-file", token, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
}

export async function listPayments(
  token: string,
  orderId?: string,
): Promise<Payment[]> {
  const query = orderId
    ? `?order_id=${encodeURIComponent(orderId)}`
    : "";
  return apiJson<Payment[]>(`/api/payments/${query}`, token);
}

export async function getPayment(
  token: string,
  paymentId: string,
): Promise<Payment> {
  return apiJson<Payment>(`/api/payments/${paymentId}`, token);
}

export async function createPayment(
  token: string,
  payload: PaymentInput,
): Promise<Payment> {
  return apiJson<Payment>("/api/payments/", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePayment(
  token: string,
  paymentId: string,
  payload: Partial<PaymentInput>,
): Promise<Payment> {
  return apiJson<Payment>(`/api/payments/${paymentId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePayment(
  token: string,
  paymentId: string,
): Promise<{ deleted: boolean; payment: Payment }> {
  return apiJson<{ deleted: boolean; payment: Payment }>(
    `/api/payments/${paymentId}`,
    token,
    { method: "DELETE" },
  );
}

export async function listQuotes(
  token: string,
  customerId?: string,
): Promise<Quote[]> {
  const query = customerId
    ? `?customer_id=${encodeURIComponent(customerId)}`
    : "";
  return apiJson<Quote[]>(`/api/quotes/${query}`, token);
}

export async function getQuote(token: string, quoteId: string): Promise<Quote> {
  return apiJson<Quote>(`/api/quotes/${quoteId}`, token);
}

export async function createQuote(
  token: string,
  payload: QuoteInput,
): Promise<Quote> {
  return apiJson<Quote>("/api/quotes/", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQuote(
  token: string,
  quoteId: string,
  payload: Partial<QuoteInput>,
): Promise<Quote> {
  return apiJson<Quote>(`/api/quotes/${quoteId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuote(
  token: string,
  quoteId: string,
): Promise<{ deleted: boolean; quote: Quote }> {
  return apiJson<{ deleted: boolean; quote: Quote }>(
    `/api/quotes/${quoteId}`,
    token,
    { method: "DELETE" },
  );
}

export async function convertQuoteToOrder(
  token: string,
  quoteId: string,
): Promise<Order> {
  return apiJson<Order>(`/api/quotes/${quoteId}/convert-to-order`, token, {
    method: "POST",
  });
}

export type QuoteFileCustomerInput = {
  company_name?: string;
  contact_person?: string;
  address?: string;
  phone_number?: string;
  tax_code?: string;
  email?: string;
};

export type GenerateQuoteFileInput = {
  quote_id?: string;
  customer?: QuoteFileCustomerInput;
  notes?: string;
  items?: QuoteItemInput[];
  quote_number?: string;
  quote_date?: string;
};

export type GeneratedQuoteFile = {
  file_id: string;
  file_name: string;
  web_link: string;
  sheet_name: string;
  summary: string;
  template_name: string;
  quote: Record<string, unknown>;
};

export async function generateQuoteFile(
  token: string,
  payload: GenerateQuoteFileInput,
): Promise<GeneratedQuoteFile> {
  return apiJson<GeneratedQuoteFile>("/api/quotes/generate-file", token, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
}
