import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CalendarX2,
  ChevronRight,
  Download,
  FileText,
  Plus,
} from "lucide-react";
import {
  cancelRequest,
  getExcusedHoursBudget,
  getOwnRequests,
  getRequestDetail,
  type RequestDetail,
} from "../api/requests.api";
import { getOwnLeaveBalance } from "../api/attendance.api";
import { NewRequestModal } from "../components/NewRequestModal";
import { EmptyState } from "../../../components/ui/primitives";
import { ErrorState, LoadingState } from "../../../components/async-state";
import { Drawer } from "../../../components/ui/drawer";
import { StatusBadge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/toast";
import { usePortalSession } from "../../../contexts/PortalSessionContext";
import { apiDownload, describeApiError } from "../../../lib/api-client";
import {
  activeLocale,
  formatDate,
  formatDateWithYear,
  formatTime,
  formatTimeLabel,
} from "../../../lib/format";
import { cn } from "../../../lib/utils";

type StatusFilter = "All" | "Pending" | "Approved" | "Rejected";

const PILL_FILTERS: StatusFilter[] = ["All", "Pending", "Approved", "Rejected"];
const PILL_STYLES: Record<StatusFilter, string> = {
  All: "bg-charcoal-100 text-charcoal-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Approved: "bg-brand-100 text-brand-700",
  Rejected: "bg-red-100 text-red-700",
};
const PILL_STYLES_ACTIVE: Record<StatusFilter, string> = {
  All: "bg-charcoal-800 text-white",
  Pending: "bg-yellow-500 text-white",
  Approved: "bg-brand-600 text-white",
  Rejected: "bg-red-500 text-white",
};

/** "2026-11" → "November 2026" (localized, matching the attendance month picker). */
function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(activeLocale(), {
    month: "long",
    year: "numeric",
  });
}

/** "2026-11" for today — the month the picker starts on and the only "no filter" month. */
function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10-20" + "2026-10-22" → "Oct 20 – Oct 22" (single date → one token). */
export function rangeLabel(start: string, end: string | null): string {
  if (!end || end === start) return formatDateWithYear(start);
  return `${formatDate(start)} – ${formatDateWithYear(end)}`;
}

/** 1.5 → "1.5 hrs", 0.5 → "30 min", 0 → "0 hrs" — the excused-hours bucket is measured in hours. */
function hoursLabel(hours: number): string {
  if (hours <= 0) return "0 hrs";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hr${rounded === 1 ? "" : "s"}`;
}

/**
 * What the employee can still ask for. This sits on the requests page because
 * the balance is the number every leave request is judged against — it is
 * reference material for the form below it, not for the attendance history.
 */
function LeaveBalancePanel({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation();
  const balanceQuery = useQuery({
    queryKey: ["portal", "leave-balance", employeeId],
    queryFn: ({ signal }) => getOwnLeaveBalance(employeeId, signal),
  });
  const budgetQuery = useQuery({
    queryKey: ["portal", "excused-hours", employeeId],
    queryFn: ({ signal }) => getExcusedHoursBudget(employeeId, signal),
  });

  const balance = balanceQuery.data ?? null;
  const budget = budgetQuery.data ?? null;
  const loading = balanceQuery.isLoading || budgetQuery.isLoading;
  const error = balanceQuery.isError
    ? describeApiError(balanceQuery.error)
    : null;
  const unpaidDays = balance?.unpaid.used ?? 0;

  const tiles = [
    balance && {
      key: "annual",
      label: t("Annual"),
      used: balance.dayOff.used,
      total: balance.dayOff.total,
      bar: "bg-brand-500",
      // Nothing is released before six completed months of service.
      note:
        balance.dayOff.total <= 0 ? t("After 6 months of service") : undefined,
    },
    balance && {
      key: "sick",
      label: t("Sick"),
      used: balance.sick.used,
      total: balance.sick.total,
      bar: "bg-red-400",
    },
    budget && {
      key: "excused",
      label: t("Excused hours"),
      used: budget.usedHours,
      total: budget.capHours,
      bar: "bg-violet-400",
      hours: true,
      // One shared monthly allowance: late arrival and early leave draw on the same pool.
      note: t("Late arrival + early leave"),
    },
  ].filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));

  return (
    <div className="card px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="bento-label">{t("LEAVE BALANCE")}</p>
        <p className="text-[10px] text-charcoal-400">
          {t("What you can still request this year")}
        </p>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {!error && tiles.length === 0 && loading && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-[68px] animate-pulse rounded-lg bg-charcoal-50"
              aria-hidden="true"
            />
          ))}
          <span className="sr-only">{t("Loading leave balance…")}</span>
        </div>
      )}

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map((tile) => {
            const remaining = Math.max(0, tile.total - tile.used);
            const usedPct =
              tile.total > 0
                ? Math.min(100, Math.round((tile.used / tile.total) * 100))
                : 0;
            const exhausted = tile.total > 0 && remaining <= 0;
            const low = !exhausted && usedPct >= 75;
            // "used / allowance" — the note below already states what is left, so the
            // fraction reports what has been consumed.
            const value = tile.hours
              ? hoursLabel(tile.used)
              : String(tile.used);
            const cap = tile.hours
              ? hoursLabel(tile.total)
              : String(tile.total);
            // The note still reports what is left, so the fraction and the note answer
            // different questions (used vs remaining).
            const leftValue = tile.hours
              ? hoursLabel(remaining)
              : String(remaining);
            return (
              <div
                key={tile.key}
                className="rounded-lg bg-charcoal-50 px-2.5 py-2"
              >
                <p className="bento-label truncate text-charcoal-500">
                  {tile.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 flex items-baseline gap-1 leading-none",
                    exhausted
                      ? "text-red-600"
                      : low
                        ? "text-yellow-600"
                        : "text-charcoal-900",
                  )}
                >
                  <span className="text-lg font-bold">{value}</span>
                  <span className="text-[10px] font-medium text-charcoal-400">
                    / {cap}
                  </span>
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-charcoal-200">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      exhausted
                        ? "bg-red-500"
                        : low
                          ? "bg-yellow-500"
                          : tile.bar,
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-1 truncate text-[9px] font-medium text-charcoal-400">
                  {tile.note ??
                    (exhausted
                      ? t("None left")
                      : low
                        ? t("{{percent}}% used", { percent: usedPct })
                        : t("{{value}} left", { value: leftValue }))}
                </p>
                {/* Days taken ahead of what the monthly accrual has earned: they even out
                    as the following months accrue, and only cost money if he leaves first. */}
                {tile.key === "annual" && unpaidDays > 0 && (
                  <p
                    className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-red-600"
                    title={t("Deducted if you leave")}
                  >
                    <AlertCircle
                      className="h-2.5 w-2.5 shrink-0"
                      aria-hidden="true"
                    />
                    {unpaidDays === 1
                      ? t("{{count}} unpaid day", { count: unpaidDays })
                      : t("{{count}} unpaid days", { count: unpaidDays })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyRequestsPage() {
  const { t } = useTranslation();
  const { me } = usePortalSession();
  const employeeId = me?.employeeId ?? null;
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-xl font-bold text-charcoal-900">
          {t("My Requests")}
        </h1>
        <Button
          size="sm"
          onClick={() => setNewOpen(true)}
          disabled={employeeId == null}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("New Request")}
        </Button>
      </div>

      {employeeId == null && (
        <EmptyState
          title={t("No employee profile")}
          hint={t(
            "This account is not linked to an employee profile, so it has no self-service requests.",
          )}
        />
      )}
      {employeeId != null && <LeaveBalancePanel employeeId={employeeId} />}
      {employeeId != null && (
        <RequestsWorkspace
          employeeId={employeeId}
          filter={filter}
          onFilter={setFilter}
          detailId={detailId}
          onDetail={setDetailId}
        />
      )}

      {newOpen && employeeId != null && (
        <NewRequestModal
          employeeId={employeeId}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}

function RequestsWorkspace({
  employeeId,
  filter,
  onFilter,
  detailId,
  onDetail,
}: {
  employeeId: number;
  filter: StatusFilter;
  onFilter: (filter: StatusFilter) => void;
  detailId: number | null;
  onDetail: (id: number | null) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["portal", "requests", employeeId, "list"],
    queryFn: ({ signal }) => getOwnRequests(employeeId, signal),
  });

  const requests = requestsQuery.data ?? [];
  const [typeFilter, setTypeFilter] = useState("All");
  // The list opens on the current month; the picker then steps back through the
  // earlier months that hold requests.
  const [currentMonth] = useState(currentMonthIso);
  const [month, setMonth] = useState(currentMonth);

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(requests.map((request) => request.type))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [requests],
  );

  // Months that actually hold a request (a range fills every month it covers),
  // newest first, with the running month always present.
  const monthOptions = useMemo(() => {
    const months = new Set<string>([currentMonth]);
    for (const request of requests) {
      const end = request.endDate ?? request.requestedDate;
      let [year, month] = request.requestedDate.slice(0, 7).split("-").map(Number);
      const [endYear, endMonth] = end.slice(0, 7).split("-").map(Number);
      // Bounded so a malformed range cannot spin.
      for (let i = 0; i < 24 && (year < endYear || (year === endYear && month <= endMonth)); i += 1) {
        months.add(`${year}-${String(month).padStart(2, "0")}`);
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [requests]);

  // Type + month scope; the status pills then count inside it so their numbers
  // always describe what the other filters leave on screen.
  const scoped = useMemo(
    () =>
      requests.filter((request) => {
        if (typeFilter !== "All" && request.type !== typeFilter) return false;
        if (month) {
          // "yyyy-MM" compares lexicographically; a range matches when it covers the month.
          const startMonth = request.requestedDate.slice(0, 7);
          const endMonth = (request.endDate ?? request.requestedDate).slice(0, 7);
          if (month < startMonth || month > endMonth) return false;
        }
        return true;
      }),
    [requests, typeFilter, month],
  );

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const request of scoped)
      byStatus.set(request.status, (byStatus.get(request.status) ?? 0) + 1);
    const pending =
      (byStatus.get("Pending") ?? 0) + (byStatus.get("Pending HR Review") ?? 0);
    return {
      All: scoped.length,
      Pending: pending,
      Approved: byStatus.get("Approved") ?? 0,
      Rejected: byStatus.get("Rejected") ?? 0,
    } satisfies Record<StatusFilter, number>;
  }, [scoped]);

  const filtered = useMemo(
    () =>
      filter === "All"
        ? scoped
        : scoped.filter((request) =>
            filter === "Pending"
              ? request.status === "Pending" ||
                request.status === "Pending HR Review"
              : request.status === filter,
          ),
    [filter, scoped],
  );

  const filtersActive = typeFilter !== "All" || month !== currentMonth;
  const clearFilters = () => {
    setTypeFilter("All");
    setMonth(currentMonth);
  };

  const cancelMutation = useMutation({
    mutationFn: (requestId: number) => cancelRequest(requestId),
    onSuccess: async () => {
      toast(t("Request cancelled"));
      await queryClient.invalidateQueries({ queryKey: ["portal", "requests"] });
    },
    onError: (error) => toast(describeApiError(error), "error"),
  });

  const downloadMutation = useMutation({
    mutationFn: (requestId: number) =>
      apiDownload(`/api/requests/${requestId}/attachment`),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName ?? "attachment";
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toast(describeApiError(error), "error"),
  });

  if (requestsQuery.isLoading)
    return <LoadingState label={t("Loading your requests…")} />;
  if (requestsQuery.isError) {
    return (
      <ErrorState
        message={describeApiError(requestsQuery.error)}
        onRetry={() => requestsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PILL_FILTERS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => onFilter(pill)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              filter === pill ? PILL_STYLES_ACTIVE[pill] : PILL_STYLES[pill],
            )}
          >
            {t(pill)}{" "}
            <span className="text-[10px] opacity-70">{counts[pill]}</span>
          </button>
        ))}

        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <div className="w-40 shrink-0">
            <select
              className="form-select"
              aria-label={t("Filter by type")}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">{t("All types")}</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="w-40 shrink-0">
            <select
              className="form-select"
              aria-label={t("Filter by month")}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {monthLabel(option)}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-semibold text-brand-600 hover:underline"
            >
              {t("Clear")}
            </button>
          )}
        </div>
      </div>

      <div className="card hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-charcoal-100 text-charcoal-500">
                <th className="px-4 py-2.5 font-medium">{t("Date")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Submitted")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Type")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Reason")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Status")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((request) => {
                // The employee's own words first; a manager note stands in when the
                // request carried no reason.
                const note =
                  request.reason?.trim() || request.bmComment?.trim() || "";
                return (
                  <tr
                    key={request.id}
                    className="cursor-pointer border-b border-charcoal-50 transition-colors last:border-0 hover:bg-charcoal-50"
                    onClick={() => onDetail(request.id)}
                  >
                    <td className="px-4 py-2.5">
                      {rangeLabel(request.requestedDate, request.endDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-charcoal-600">
                      {request.submittedAt
                        ? formatTime(request.submittedAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {request.type}
                        {request.calculatedDays != null && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {t("Cover: {{count}}", {
                              count: request.calculatedDays,
                            })}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-charcoal-600">
                      {note ? (
                        <span
                          className="block max-w-[280px] truncate"
                          title={note}
                        >
                          {note}
                        </span>
                      ) : (
                        <span className="text-charcoal-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={
                          request.status === "Pending"
                            ? "Awaiting Manager"
                            : request.status
                        }
                      />
                    </td>
                    <td className="px-2">
                      <ChevronRight
                        className="h-3.5 w-3.5 text-charcoal-400"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1.5 lg:hidden">
        {filtered.map((request) => (
          <div
            key={request.id}
            className="card card-interactive cursor-pointer p-3"
            onClick={() => onDetail(request.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-charcoal-100 text-charcoal-600">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-charcoal-900">
                    <span className="min-w-0 truncate">{request.type}</span>
                    {request.calculatedDays != null && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {t("Cover: {{count}}", {
                          count: request.calculatedDays,
                        })}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-charcoal-500">
                    #{request.id} · {formatDate(request.submittedDate)}
                  </p>
                  <p className="text-[10px] text-charcoal-500">
                    {rangeLabel(request.requestedDate, request.endDate)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge
                  status={
                    request.status === "Pending"
                      ? "Awaiting Manager"
                      : request.status
                  }
                />
                <ChevronRight
                  className="h-3.5 w-3.5 text-charcoal-400"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={<FileText className="h-10 w-10" aria-hidden="true" />}
          title={
            filtersActive && filter === "All"
              ? t("No requests match these filters")
              : filter === "All"
                ? t("No requests yet")
                : t("No {{status}} requests", { status: t(filter) })
          }
          hint={
            filtersActive
              ? undefined
              : filter === "All"
                ? t("Submit a new request to see it here.")
                : undefined
          }
        />
      )}

      <RequestDetailDrawer
        requestId={detailId}
        onClose={() => onDetail(null)}
        onCancel={(id) => cancelMutation.mutate(id)}
        cancelling={cancelMutation.isPending}
        onDownload={(id) => downloadMutation.mutate(id)}
        downloading={downloadMutation.isPending}
      />
    </div>
  );
}

/* ==================== Detail drawer ==================== */

function RequestDetailDrawer({
  requestId,
  onClose,
  onCancel,
  cancelling,
  onDownload,
  downloading,
}: {
  requestId: number | null;
  onClose: () => void;
  onCancel: (id: number) => void;
  cancelling: boolean;
  onDownload: (id: number) => void;
  downloading: boolean;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["portal", "requests", requestId, "detail"],
    queryFn: ({ signal }) => getRequestDetail(requestId!, signal),
    enabled: requestId != null,
    retry: false,
  });

  const detail: RequestDetail | undefined = query.data;
  // System-generated cover requests are not employee-filed, so they can't be
  // cancelled from the employee side.
  const canCancel =
    detail != null &&
    detail.type !== "Unscheduled Attendance" &&
    (detail.status === "Pending" || detail.status === "Pending HR Review");

  return (
    <Drawer
      open={requestId != null}
      title={detail ? detail.type : t("Request")}
      onClose={onClose}
    >
      {query.isLoading && <LoadingState label={t("Loading request…")} />}
      {query.isError && (
        <ErrorState
          message={describeApiError(query.error)}
          onRetry={() => query.refetch()}
        />
      )}
      {detail && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={
                  detail.status === "Pending"
                    ? "Awaiting Manager"
                    : detail.status
                }
              />
              <span className="text-[10px] font-medium text-charcoal-400">
                #{detail.id}
              </span>
              {detail.calculatedDays != null && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {detail.calculatedDays === 1
                    ? t("Cover: {{count}} day", {
                        count: detail.calculatedDays,
                      })
                    : t("Cover: {{count}} days", {
                        count: detail.calculatedDays,
                      })}
                </span>
              )}
            </div>
          </div>

          {detail.hrDecision && (
            <div
              className={cn(
                "rounded-lg border p-3",
                detail.hrDecision === "Approved"
                  ? "border-brand-200 bg-brand-50"
                  : "border-red-200 bg-red-50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="bento-label text-charcoal-500">FINAL DECISION</p>
                <span className="badge badge-gray text-[9px]">
                  {detail.hrDecision}
                </span>
                {detail.payment && (
                  <span
                    className={cn(
                      "badge text-[9px]",
                      detail.payment === "paid" ? "badge-green" : "badge-red",
                    )}
                  >
                    {detail.payment === "paid" ? "Paid" : "Unpaid"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-charcoal-700">
                {detail.payment === "paid"
                  ? "Deducted from your leave balance."
                  : detail.payment === "unpaid"
                    ? "Recorded as unpaid — a payroll deduction applies."
                    : detail.hrDecision === "Approved"
                      ? "Approved by HR."
                      : "Rejected by HR."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-charcoal-50 p-2.5 text-center">
              <p className="bento-label mb-0.5">{t("TYPE")}</p>
              <p className="text-xs font-semibold text-charcoal-900">
                {detail.type}
              </p>
            </div>
            <div className="rounded-lg bg-charcoal-50 p-2.5 text-center">
              <p className="bento-label mb-0.5">{t("SUBMITTED")}</p>
              <p className="text-xs font-semibold text-charcoal-900">
                {formatDateWithYear(detail.submittedDate)}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-charcoal-50 p-3">
            <p className="bento-label mb-1">{t("REQUESTED DATE")}</p>
            <p className="text-sm font-bold text-charcoal-900">
              {rangeLabel(detail.requestedDate, detail.endDate)}
            </p>
            {detail.calculatedDays != null && (
              <p className="mt-1 text-xs text-violet-700">
                {t("Cover / extra days:")}{" "}
                <span className="font-semibold">{detail.calculatedDays}</span>
              </p>
            )}
            {detail.type === "Unscheduled Attendance" && (
              <p className="mt-1 text-[10px] text-charcoal-500">
                {t(
                  "Recorded automatically at the attendance station — you can't cancel it, but agreeing doesn't change your monthly day-off balance.",
                )}
              </p>
            )}
          </div>

          <div>
            <p className="bento-label mb-1">{t("REASON")}</p>
            <p className="rounded-lg bg-charcoal-50 p-2.5 text-xs text-charcoal-700">
              {detail.reason && formatTimeLabel(detail.reason)}
            </p>
          </div>

          {detail.bmComment && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="bento-label mb-1 text-blue-600">
                {t("TEAM LEAD / BRANCH MANAGER COMMENT")}
              </p>
              <p className="text-xs text-charcoal-700">{detail.bmComment}</p>
            </div>
          )}
          {detail.hrComment && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="bento-label mb-1 text-brand-600">
                {t("HR COMMENT")}
              </p>
              <p className="text-xs text-charcoal-700">{detail.hrComment}</p>
            </div>
          )}

          <div>
            <p className="bento-label mb-2">{t("APPROVAL WORKFLOW")}</p>
            <div className="space-y-0">
              {detail.timeline.map((step, index) => (
                <div key={step.step + index} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "mt-0.5 h-3 w-3 flex-shrink-0 rounded-full",
                        step.done
                          ? "bg-brand-500 ring-2 ring-brand-100"
                          : "bg-charcoal-300",
                      )}
                    />
                    {index < detail.timeline.length - 1 && (
                      <div className="my-0.5 h-6 w-0.5 bg-charcoal-200" />
                    )}
                  </div>
                  <div className="pb-3">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        step.done ? "text-charcoal-900" : "text-charcoal-400",
                      )}
                    >
                      {step.step}
                    </p>
                    <p
                      className={cn(
                        "text-[10px]",
                        step.done ? "text-charcoal-500" : "text-charcoal-400",
                      )}
                    >
                      {formatTimeLabel(step.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-charcoal-100 pt-2">
            {canCancel && (
              <Button
                variant="dangerOutline"
                size="sm"
                className="flex-1 justify-center"
                disabled={cancelling}
                onClick={() => onCancel(detail.id)}
              >
                <CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" />
                {cancelling ? t("Cancelling…") : t("Cancel Request")}
              </Button>
            )}
            {detail.status === "Approved" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center"
                disabled={downloading}
                onClick={() => onDownload(detail.id)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {downloading ? t("Downloading…") : t("Download")}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 justify-center"
              onClick={onClose}
            >
              {t("Close")}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
