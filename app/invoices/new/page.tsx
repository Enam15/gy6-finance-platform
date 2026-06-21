import { InvoiceService } from "@/services/invoice-service";
import { blankInvoiceForm } from "@/lib/invoice/form";
import { InvoiceEditor } from "../_components/invoice-editor";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const number = await new InvoiceService().nextNumber();
  const todayIso = new Date().toISOString().slice(0, 10);
  return <InvoiceEditor mode="create" initial={blankInvoiceForm(number, todayIso)} />;
}
