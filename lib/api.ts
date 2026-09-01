const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type TargetCustomer = {
  id?: string;
  name: string;
  phone_number: string;
  reason_to_choose: string;
  address: string;
  website: string;
  facebook: string;
  summary_about_the_target_customer: string;
  target_customer_list_id?: string;
  created_at?: string;
};

export type TargetCustomerList = {
  id: string;
  name: string;
  description: string;
  clerk_id: string;
  created_at?: string;
};

export type SearchTargetCustomersResponse = {
  search_id: string;
  list: TargetCustomerList | null;
  customers: TargetCustomer[];
  saved: boolean;
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

export async function fetchTargetCustomerLists(
  token: string,
): Promise<TargetCustomerList[]> {
  return apiJson<TargetCustomerList[]>(
    "/api/target-customers/lists",
    token,
  );
}

export async function createTargetCustomerList(
  token: string,
  name: string,
  description = "",
): Promise<TargetCustomerList> {
  return apiJson<TargetCustomerList>("/api/target-customers/lists", token, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function searchTargetCustomers(
  query: string,
  token: string,
  targetCustomerListId: string,
): Promise<SearchTargetCustomersResponse> {
  return apiJson<SearchTargetCustomersResponse>(
    "/api/target-customers/search-target-customers",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        query,
        target_customer_list_id: targetCustomerListId,
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );
}

export async function removeFoundTargetCustomer(
  token: string,
  searchId: string,
  customerId: string,
): Promise<SearchTargetCustomersResponse> {
  return apiJson<SearchTargetCustomersResponse>(
    `/api/target-customers/search-sessions/${searchId}/customers/${customerId}`,
    token,
    { method: "DELETE" },
  );
}

export async function confirmTargetCustomers(
  token: string,
  searchId: string,
): Promise<SearchTargetCustomersResponse> {
  return apiJson<SearchTargetCustomersResponse>(
    `/api/target-customers/search-sessions/${searchId}/confirm`,
    token,
    { method: "POST" },
  );
}
