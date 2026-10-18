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
