"use client";
import { EnterpriseProvider } from "./provider";
import { ControlTower, Approvals } from "./control-tower";
import { Procurement } from "./procurement";
import { Warehouses } from "./warehouses";
import { Finance } from "./finance";
import { Returns } from "./returns";
import { Logistics } from "./logistics";
import { FieldExecution } from "./field";
import { Analytics } from "./analytics";
export const enterpriseSections = [
  "control",
  "procurement",
  "warehouses",
  "finance",
  "returns",
  "logistics",
  "field",
  "analytics",
  "approvals",
];
export function EnterpriseWorkspace({ section }: { section: string }) {
  return (
    <EnterpriseProvider>
      {section === "control" && <ControlTower />}
      {section === "procurement" && <Procurement />}
      {section === "warehouses" && <Warehouses />}
      {section === "finance" && <Finance />}
      {section === "returns" && <Returns />}
      {section === "logistics" && <Logistics />}
      {section === "field" && <FieldExecution />}
      {section === "analytics" && <Analytics />}
      {section === "approvals" && <Approvals />}
    </EnterpriseProvider>
  );
}
