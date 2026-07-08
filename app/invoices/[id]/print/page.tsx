import { notFound } from "next/navigation";
import { InvoiceService } from "@/services/invoice-service";
import { toDocumentData, toAppendixData } from "@/lib/invoice/to-document";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import {
  InvoiceAppendix,
  hasAppendixContent,
} from "@/components/invoice/invoice-appendix";
import { InvoicePrintControls } from "../../_components/invoice-print-controls";

export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await new InvoiceService().getInvoice(id);
  if (!result.ok) notFound();

  const doc = toDocumentData(result.value);
  const appendix = toAppendixData(result.value);

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <InvoicePrintControls editHref={`/invoices/${id}`} />
      <div className="flex flex-col items-center gap-6 p-6 print:gap-0 print:p-0">
        <div className="invoice-print-scale shadow-lg print:shadow-none">
          <InvoiceDocument data={doc} />
        </div>
        {hasAppendixContent(appendix) && (
          <div className="invoice-print-scale shadow-lg print:break-before-page print:shadow-none">
            <InvoiceAppendix data={appendix} />
          </div>
        )}
      </div>
    </div>
  );
}
