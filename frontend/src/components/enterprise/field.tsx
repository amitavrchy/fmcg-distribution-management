"use client";
import { useState } from "react";
import {
  Plus,
  ClipboardList,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Target,
} from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Field, Modal, Panel, SimpleForm } from "../ui";
import { Metrics, Tabs, Actions } from "./common";
import { BusinessForm } from "./forms";
import { date, money, label } from "@/lib/format";
export function FieldExecution() {
  const { user, data: base } = useApp(),
    { data, act, run, working } = useEnterprise(),
    [tab, setTab] = useState("tasks"),
    [form, setForm] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [checks, setChecks] = useState<boolean[]>([]);
  const task = data.tasks.find((t) => t.id === selected),
    manager = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role);
  return (
    <>
      <Metrics
        items={[
          {
            label: "Open execution tasks",
            value: data.summary.openTasks,
            detail: "Assigned checklists across outlets",
          },
          {
            label: "Overdue tasks",
            value: data.summary.lateTasks,
            tone: "rose",
            detail: "Follow up with the field team",
          },
          {
            label: "Sales pipeline",
            value: money(data.summary.pipelineMinor),
            detail: "Qualified through negotiation",
          },
          {
            label: "Execution completion",
            value: `${data.tasks.length ? Math.round((data.tasks.filter((t) => t.status === "COMPLETED").length / data.tasks.length) * 100) : 0}%`,
            detail: "Evidence-backed completed tasks",
          },
        ]}
      />
      <div className="enterprise-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "tasks", label: "Execution board", count: data.tasks.length },
            {
              id: "pipeline",
              label: "Sales opportunities",
              count: data.opportunities.length,
            },
          ]}
        />
        <Actions>
          <button className="button" onClick={() => setForm("opportunity")}>
            <Target size={16} />
            Opportunity
          </button>
          {manager && (
            <button className="button primary" onClick={() => setForm("task")}>
              <Plus size={17} />
              Assign task
            </button>
          )}
        </Actions>
      </div>
      {tab === "tasks" && (
        <div className="field-board">
          {[
            {
              id: "urgent",
              title: "Needs attention",
              test: (t: (typeof data.tasks)[number]) =>
                t.status !== "COMPLETED" &&
                (t.priority === "URGENT" || new Date(t.dueOn) < new Date()),
            },
            {
              id: "open",
              title: "Planned execution",
              test: (t: (typeof data.tasks)[number]) =>
                t.status !== "COMPLETED" &&
                t.priority !== "URGENT" &&
                new Date(t.dueOn) >= new Date(),
            },
            {
              id: "done",
              title: "Completed & evidenced",
              test: (t: (typeof data.tasks)[number]) =>
                t.status === "COMPLETED",
            },
          ].map((column) => (
            <section className="kanban-column" key={column.id}>
              <header>
                <span className={`column-dot ${column.id}`} />
                <h2>{column.title}</h2>
                <b>{data.tasks.filter(column.test).length}</b>
              </header>
              {data.tasks.filter(column.test).map((t) => (
                <button
                  className="task-card"
                  key={t.id}
                  onClick={() => {
                    setSelected(t.id);
                    setChecks(t.checklist.map(() => false));
                  }}
                >
                  <div>
                    <Badge value={t.type} />
                    <Badge value={t.priority} />
                  </div>
                  <h3>{t.title}</h3>
                  <p>
                    <MapPin size={14} />
                    {t.outlet.name}
                  </p>
                  <div className="task-checklist-preview">
                    {t.checklist.slice(0, 2).map((c) => (
                      <span key={c}>
                        <CheckCircle2 size={14} />
                        {c}
                      </span>
                    ))}
                  </div>
                  <footer>
                    <span>
                      {base.users.find((u) => u.id === t.assignedTo)
                        ?.fullName || "Assigned SR"}
                    </span>
                    <span>{date(t.dueOn)}</span>
                  </footer>
                </button>
              ))}
              {!data.tasks.some(column.test) && (
                <div className="kanban-placeholder">No tasks in this stage</div>
              )}
            </section>
          ))}
        </div>
      )}
      {tab === "pipeline" && (
        <div className="opportunity-board">
          {["QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].map(
            (stage, index) => (
              <section className="kanban-column" key={stage}>
                <header>
                  <span className={`column-dot stage-${index}`} />
                  <h2>{label(stage)}</h2>
                  <b>
                    {data.opportunities.filter((o) => o.stage === stage).length}
                  </b>
                </header>
                {data.opportunities
                  .filter((o) => o.stage === stage)
                  .map((o) => (
                    <div className="opportunity-card" key={o.id}>
                      <h3>{o.title}</h3>
                      <p>
                        {base.outlets.find((v) => v.id === o.outletId)?.name}
                      </p>
                      <strong>{money(o.valueMinor)}</strong>
                      <span className="cell-sub">
                        Close by {date(o.expectedOn)}
                      </span>
                      {o.notes && <p className="opportunity-note">{o.notes}</p>}
                      {!["WON", "LOST"].includes(o.stage) && (
                        <div className="row-actions">
                          <button
                            className="button small"
                            disabled={working}
                            onClick={() =>
                              void run(
                                `opportunities/${o.id}`,
                                {
                                  stage: ["PROPOSAL", "NEGOTIATION", "WON"][
                                    index
                                  ],
                                },
                                "PATCH",
                              )
                            }
                          >
                            {index === 2 ? "Mark won" : "Advance"}
                            <ArrowRight size={14} />
                          </button>
                          <button
                            className="button small danger"
                            disabled={working}
                            onClick={() =>
                              void run(
                                `opportunities/${o.id}`,
                                { stage: "LOST" },
                                "PATCH",
                              )
                            }
                          >
                            Lost
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </section>
            ),
          )}
        </div>
      )}
      {task && (
        <Modal title={task.title} onClose={() => setSelected(null)}>
          <div className="detail-overview">
            <div>
              <h3>{task.outlet.name}</h3>
              <p>
                {task.outlet.address} · due {date(task.dueOn)}
              </p>
            </div>
            <Badge value={task.status} />
          </div>
          {task.status === "COMPLETED" ? (
            <>
              <div className="completed-checklist">
                {task.checklist.map((c) => (
                  <p key={c}>
                    <CheckCircle2 size={18} />
                    {c}
                  </p>
                ))}
              </div>
              <p className="callout">
                {task.result?.notes || "Execution completed"} · Evidence:{" "}
                {task.evidenceReference || "Not required"}
              </p>
            </>
          ) : (
            <SimpleForm
              submit="Complete task with evidence"
              onSubmit={async (f) => {
                await act(`tasks/${task.id}/complete`, {
                  checks,
                  notes: f.get("notes"),
                  evidenceReference: f.get("evidenceReference"),
                });
                setSelected(null);
              }}
            >
              <div className="form-full task-checklist">
                {task.checklist.map((c, i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      checked={checks[i] || false}
                      onChange={(e) =>
                        setChecks(
                          checks.map((v, j) =>
                            i === j ? e.target.checked : v,
                          ),
                        )
                      }
                      required
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
              <Field label="Findings / execution notes">
                <textarea name="notes" maxLength={1000} />
              </Field>
              <Field label="Photo / audit evidence reference">
                <input
                  name="evidenceReference"
                  required={task.type !== "FOLLOW_UP"}
                  maxLength={300}
                  placeholder="Company evidence reference or document link"
                />
              </Field>
            </SimpleForm>
          )}
        </Modal>
      )}
      {form && <BusinessForm mode={form} onClose={() => setForm("")} />}
    </>
  );
}
