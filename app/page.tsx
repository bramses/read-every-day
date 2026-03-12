import { unstable_noStore as noStore } from "next/cache";

import { ReadingTimeline } from "@/components/reading-timeline";
import { getReadingDataset } from "@/lib/reading-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  noStore();
  const data = await getReadingDataset();

  return <ReadingTimeline data={data} />;
}
