import { Dashboard } from "@/components/Dashboard";
import { buildStaticAppData } from "@/lib/app-data/buildAppData";

export default function Page() {
  return <Dashboard initialData={buildStaticAppData()} />;
}
