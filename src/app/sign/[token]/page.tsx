import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import SignClient from "./SignClient";
import { renderPdfPageToPng } from "@/lib/pdf/renderPdfPageToImage";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: Props) {
  const { token } = await params;

  const supabase = createAdminClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, title, pdf_url, signer_name, signer_phone, status, sign_token, token_expires_at, signature_zones",
    )
    .eq("sign_token", token)
    .single();

  if (!contract) notFound();
  if (contract.status === "signed")
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <p className="text-2xl font-bold text-green-600 mb-2">이미 서명 완료된 계약서입니다</p>
          <p className="text-slate-500 text-sm">중복 서명은 불가합니다.</p>
        </div>
      </div>
    );
  if (new Date(contract.token_expires_at) < new Date())
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <p className="text-2xl font-bold text-red-500 mb-2">만료된 서명 링크입니다</p>
          <p className="text-slate-500 text-sm">담당자에게 새 링크를 요청해주세요.</p>
        </div>
      </div>
    );

  let previewImageDataUrl: string | null = null;
  const pdfPath = contract.pdf_url ? contract.pdf_url.split("/contracts/")[1] : null;
  if (pdfPath) {
    try {
      const { data: pdfBlob, error: dlErr } = await supabase.storage
        .from("contracts")
        .download(pdfPath);
      if (dlErr || !pdfBlob) throw new Error(dlErr?.message ?? "원본 PDF 다운로드 실패");
      const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
      const png = await renderPdfPageToPng(pdfBytes);
      previewImageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
    } catch (renderErr) {
      console.error("계약서 미리보기 이미지 생성 실패:", renderErr);
    }
  }

  return <SignClient contract={contract} previewImageDataUrl={previewImageDataUrl} />;
}
