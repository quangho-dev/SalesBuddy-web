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

export type CustomerInput = {
  company_name: string;
  contact_person: string;
  address: string;
  phone_number: string;
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
