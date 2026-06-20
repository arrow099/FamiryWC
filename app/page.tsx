import { Dashboard } from "@/components/Dashboard";
import { buildStaticAppData } from "@/lib/app-data/buildAppData";
import { LAST_DASHBOARD_TAB_COOKIE_KEY } from "@/lib/dashboardPreferences";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const initialTab = cookieStore.get(LAST_DASHBOARD_TAB_COOKIE_KEY)?.value;
  return <Dashboard initialData={buildStaticAppData()} initialTab={initialTab} />;
}
