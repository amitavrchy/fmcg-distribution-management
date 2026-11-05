import { Workspace } from "@/components/workspace";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "orders",
      "deliveries",
      "outlets",
      "inventory",
      "catalog",
      "beats",
      "collections",
      "schemes",
      "targets",
      "claims",
      "team",
      "sync",
      "settings",
    ].includes(section)
  )
    notFound();
  return <Workspace section={section} />;
}
