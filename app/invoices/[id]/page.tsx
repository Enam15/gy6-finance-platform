import { notFound } from "next/navigation";
import { InvoiceService } from "@/services/invoice-service";
import { invoiceToForm } from "@/lib/invoice/form";
import { InvoiceEditor } from "../_components/invoice-editor";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await new InvoiceService().getInvoice(id);
  if (!result.ok) notFound();

  return (
    <InvoiceEditor
      mode="edit"
      invoiceId={id}
      initial={invoiceToForm(result.value)}
    />
  );
}
