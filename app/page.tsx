import { PdfUploader } from "@/components/pdf-uploader";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Shipping Order Comparator</h1>
          <p className="text-muted-foreground">
            Upload two shipping order PDFs to compare and identify discrepancies using AI
          </p>
        </div>
        <PdfUploader />
      </div>
    </main>
  );
}
