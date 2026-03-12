import { ReadingTimeline } from "@/components/reading-timeline";
import { getReadingDataset } from "@/lib/reading-data";

export default async function Home() {
  const data = await getReadingDataset();

  return <ReadingTimeline data={data} />;
}
