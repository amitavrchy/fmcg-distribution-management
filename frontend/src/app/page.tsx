import type { Metadata } from "next";
import { Landing } from "@/components/marketing/landing";
import "./landing.css";
export const metadata: Metadata = {
  title: "DeshFlow · Keep distribution moving",
  description:
    "Connect your stockroom, field team and finance desk. DeshFlow brings FMCG procurement, sales, deliveries and settlement into one distribution workspace.",
};
export default function Page() {
  return <Landing />;
}
