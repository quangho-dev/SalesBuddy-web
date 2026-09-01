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
  created_at?: string;
};

export async function searchTargetCustomers(
  query: string,
  token: string,
): Promise<TargetCustomer[]> {
  const response = await fetch(
    `${API_URL}/api/target-customers/search-target-customers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(180_000),
    },
  );

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

  return (await response.json()) as TargetCustomer[];
}
