/** Core of the recurring generator, kept separate so it can be tested directly. */
import { isSensitiveExpense, templateDueDate, type ExpenseType } from "./expenses";

export type RecurringTemplate = {
  id: string;
  expense_type: ExpenseType;
  vendor_id: string | null;
  employee_id: string | null;
  recipient_name: string | null;
  amount: number | string;
  currency: string;
  description: string;
  category: string | null;
  payment_method: "paypal" | "bank_transfer";
  due_day: number;
};

export type InsertResult = { id?: string; conflict?: boolean; error?: string };
export type DraftInserter = (row: Record<string, unknown>) => Promise<InsertResult>;

export type GenerateResult = { month: string; created: number; skipped: number; createdIds: string[] };

/**
 * Creates one DRAFT per template for the accounting month. Idempotent: an
 * existing draft for the same template + month is reported as skipped, so the
 * action can safely be retried.
 */
export async function generateDraftsForMonth(
  templates: RecurringTemplate[],
  month: string,
  insert: DraftInserter,
  options: { payrollAllowed: boolean },
): Promise<GenerateResult> {
  let created = 0;
  let skipped = 0;
  const createdIds: string[] = [];

  for (const template of templates) {
    if (isSensitiveExpense(template.expense_type, template.employee_id) && !options.payrollAllowed) {
      skipped += 1;
      continue;
    }
    const result = await insert({
      template_id: template.id,
      expense_type: template.expense_type,
      vendor_id: template.vendor_id,
      employee_id: template.employee_id,
      recipient_name: template.recipient_name,
      recipient_kind: template.employee_id ? "employee" : template.vendor_id ? "vendor" : "other",
      amount: template.amount,
      currency: template.currency,
      description: template.description,
      category: template.category,
      accounting_month: month,
      due_date: templateDueDate(month, template.due_day),
      payment_method: template.payment_method,
      status: "draft",
    });

    if (result.conflict) {
      skipped += 1;
      continue;
    }
    if (result.error) throw new Error(result.error);
    created += 1;
    if (result.id) createdIds.push(result.id);
  }

  return { month, created, skipped, createdIds };
}
